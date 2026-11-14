#!/usr/bin/env node
// Fulfil token_buy poller: cheap discovery loop that wakes a ZeroClaw agent
// only when there is work to do.
//
// Every POLL_MS it runs `node fulfil-agent.mjs orders` (no LLM call). When an
// order is claimable, not ours and estimated profitable, and no agent run is in
// progress, it launches ONE ZeroClaw one-shot run for the most profitable order
// and waits for it (hard timeout). Zero dependencies; Node 20+.
//
// Configuration (environment, all optional except NEAR_ACCOUNT_ID):
//   NEAR_ACCOUNT_ID        fulfiller account (required; the CLI reads its key itself)
//   FULFIL_SKILL_DIR       real path of the fulfil-token-buy skill (default: ../.. from this file)
//   FULFIL_AGENT_HOME      state/log dir (default: ~/fulfil-agent)
//   ZEROCLAW_RUN           launcher taking the prompt as $1 (default: $FULFIL_AGENT_HOME/zc-run.sh)
//   POLL_MS=5000  BACKOFF_MS=30000  RUN_TIMEOUT_MS=900000  RETRIGGER_MS=1200000
//   ORDERS_TIMEOUT_MS=60000  LOG_MAX_BYTES=5242880
//   FLOAT_CHECK_MS=600000  FLOAT_MIN_USDC=1500000 (USDC base units)
//
// The poller also calls the CLI to withdraw idle USDC and release abandoned claims.
// The CLI performs all signing and transaction submission.

import { execFile, spawn } from "node:child_process";
import { appendFileSync, closeSync, mkdirSync, openSync, readFileSync, renameSync,
  statSync, unlinkSync, writeFileSync, writeSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deliveryEvidence, shouldAutoRelease, shouldWithdraw } from "./poller-lib.mjs";

const env = process.env;
const num = (name, fallback) => (Number.isFinite(Number(env[name])) && env[name] !== "" ? Number(env[name]) : fallback);

const ACCOUNT = env.NEAR_ACCOUNT_ID;
const SKILL_DIR = resolve(env.FULFIL_SKILL_DIR || join(dirname(fileURLToPath(import.meta.url)), "..", ".."));
const CLI = join(SKILL_DIR, "fulfil-agent.mjs");
const HOME_DIR = resolve(env.FULFIL_AGENT_HOME || join(homedir(), "fulfil-agent"));
const ZC_RUN = env.ZEROCLAW_RUN || join(HOME_DIR, "zc-run.sh");
const LOG = join(HOME_DIR, "agent.log");
const LOCK = join(HOME_DIR, "agent.lock");
const STATE = join(HOME_DIR, "poller-state.json");
const RUNS_DIR = join(HOME_DIR, "runs");
const POLL_MS = num("POLL_MS", 5_000);
const BACKOFF_MS = num("BACKOFF_MS", 30_000);
const RUN_TIMEOUT_MS = num("RUN_TIMEOUT_MS", 15 * 60_000);
const RETRIGGER_MS = num("RETRIGGER_MS", 20 * 60_000);
const ORDERS_TIMEOUT_MS = num("ORDERS_TIMEOUT_MS", 60_000);
const LOG_MAX_BYTES = num("LOG_MAX_BYTES", 5 * 1024 * 1024);
const FLOAT_CHECK_MS = num("FLOAT_CHECK_MS", 600_000);
const FLOAT_MIN_USDC = env.FLOAT_MIN_USDC || "1500000";
const RUN_OUTPUT_MAX = 256 * 1024;
const ORDER_ID = /^[A-Za-z0-9_-]{1,64}$/;

if (!ACCOUNT || !/^[a-z0-9._-]+$/.test(ACCOUNT)) {
  console.error("poller: NEAR_ACCOUNT_ID is required");
  process.exit(2);
}
mkdirSync(RUNS_DIR, { recursive: true });

// ── logging: one JSON line per event, size-capped with a single .1 rotation ──
function log(event) {
  const line = `${JSON.stringify({ ts: new Date().toISOString(), ...event })}\n`;
  try {
    if (statSync(LOG).size + line.length > LOG_MAX_BYTES) renameSync(LOG, `${LOG}.1`);
  } catch { /* no log yet */ }
  appendFileSync(LOG, line, { mode: 0o600 });
}

// ── persistent re-trigger memory, so a pm2 restart does not re-launch an order ──
let recent = {};
try { recent = JSON.parse(readFileSync(STATE, "utf8")).recent || {}; } catch { /* fresh */ }
function remember(id) {
  const now = Date.now();
  recent[id] = now;
  for (const [key, at] of Object.entries(recent)) if (now - at > RETRIGGER_MS) delete recent[key];
  writeFileSync(STATE, JSON.stringify({ recent }), { mode: 0o600 });
}
const recentlyTriggered = (id) => Date.now() - (recent[id] || 0) < RETRIGGER_MS;

// ── lock file: O_EXCL create; a lock whose pid is dead is stale ──
function pidAlive(pid) {
  try { process.kill(pid, 0); return true; } catch (error) { return error.code === "EPERM"; }
}
function acquireLock(orderId) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const fd = openSync(LOCK, "wx", 0o600);
      writeSync(fd, JSON.stringify({ pid: process.pid, order_id: orderId, started: new Date().toISOString() }));
      closeSync(fd);
      return true;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      let holder = null;
      try { holder = JSON.parse(readFileSync(LOCK, "utf8")); } catch { /* unreadable */ }
      if (holder?.pid && pidAlive(holder.pid)) return false;
      try { unlinkSync(LOCK); } catch { /* raced */ }
    }
  }
  return false;
}
function releaseLock() {
  try { unlinkSync(LOCK); } catch { /* already gone */ }
}

// ── CLI calls: orders/status/balances read; withdraw/release may send ──
function cli(args, timeout = ORDERS_TIMEOUT_MS) {
  return new Promise((resolveCli) => {
    execFile(process.execPath, [CLI, ...args], {
      cwd: SKILL_DIR, timeout, maxBuffer: 4 * 1024 * 1024,
      env: { ...env, NEAR_ACCOUNT_ID: ACCOUNT },
    }, (error, stdout) => {
      const last = String(stdout || "").trim().split("\n").pop();
      try { resolveCli(JSON.parse(last)); } catch {
        resolveCli({ ok: false, error: { code: error?.killed ? "orders_timeout" : "bad_cli_output" } });
      }
    });
  });
}

const profit = (order) => { try { return BigInt(order.estimate.profit_usdc); } catch { return 0n; } };
const summarize = (order) => ({
  id: order.id, symbol: order.buy_token?.symbol ?? null, claimable: order.claimable ?? null,
  own_order: order.own_order ?? null, profitable: order.estimate?.profitable ?? null,
  profit_usdc: order.estimate?.profit_usdc ?? null, estimate_error: order.estimate?.error ?? null,
  error: order.error ?? null,
});

function agentPrompt(order) {
  return [
    `Fulfil order ${order.id} end-to-end by following the fulfil-token-buy skill exactly.`,
    `Run every step as \`node ${CLI} <command>\` (absolute path, no cd, no env prefix; NEAR_ACCOUNT_ID is already set).`,
    "Steps, stopping on any error and acting on the skill's error table:",
    "1. `setup --dry-run`; only if a step is not registered, run `setup`.",
    `2. \`status ${order.id}\` and \`quote ${order.id}\`; stop if it is not funded, is our own order, the deadline is too close, or the quote is not profitable.`,
    `3. \`claim ${order.id}\`.`,
    `4. \`buy ${order.id}\`.`,
    `5. \`deliver ${order.id}\`.`,
    `6. \`prove ${order.id} <delivery tx_hash from step 5>\`.`,
    `7. \`status ${order.id}\`.`,
    "If you claimed but cannot deliver, release the claim. If deliver succeeded, never release; run prove with the delivery tx_hash. Do not touch any other order.",
    "Finish with a one-paragraph summary and a final line of compact JSON:",
    `{"order_id":"${order.id}","result":"paid|released|skipped|error","tx_hashes":[...],"last_status":"..."}`,
    `Poller estimate (may be stale): profit_usdc=${order.estimate?.profit_usdc ?? "?"}.`,
  ].join("\n");
}

let child = null;
function runAgent(order) {
  return new Promise((resolveRun) => {
    const started = Date.now();
    const runLog = join(RUNS_DIR, `${new Date(started).toISOString().replace(/[:.]/g, "-")}-${order.id}.log`);
    let output = "";
    let outputTruncated = false;
    let timedOut = false;
    child = spawn(ZC_RUN, [agentPrompt(order)], {
      cwd: HOME_DIR, detached: true, stdio: ["ignore", "pipe", "pipe"],
      env: { ...env, NEAR_ACCOUNT_ID: ACCOUNT },
    });
    const collect = (chunk) => {
      const text = String(chunk);
      const remaining = RUN_OUTPUT_MAX - output.length;
      if (text.length > remaining) outputTruncated = true;
      if (remaining > 0) output += text.slice(0, remaining);
    };
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    const killGroup = (signal) => { try { process.kill(-child.pid, signal); } catch { /* exited */ } };
    const timer = setTimeout(() => {
      timedOut = true;
      killGroup("SIGTERM");
      setTimeout(() => killGroup("SIGKILL"), 10_000).unref();
    }, RUN_TIMEOUT_MS);
    const finish = (code, signal) => {
      clearTimeout(timer);
      child = null;
      writeFileSync(runLog, output, { mode: 0o600 });
      let report = null;
      for (const line of output.trim().split("\n").reverse()) {
        const candidate = line.trim().replace(/^`+|`+$/g, "");
        if (candidate.startsWith("{") && candidate.includes("order_id")) {
          try { report = JSON.parse(candidate); break; } catch { /* keep looking */ }
        }
      }
      resolveRun({ exit_code: code, signal, timed_out: timedOut, duration_s: Math.round((Date.now() - started) / 1000),
        report, run_log: runLog, output, output_truncated: outputTruncated });
    };
    child.on("error", () => finish(-1, null));
    child.on("close", finish);
  });
}

let stopping = false;
let errorStreak = 0;
let lastFoundKey = "";
let lastFoundAt = 0;
let lastFloatCheck = 0;

async function maintainFloat(force = false) {
  if (!force && Date.now() - lastFloatCheck < FLOAT_CHECK_MS) return;
  lastFloatCheck = Date.now();
  const balances = await cli(["balances"]);
  if (!balances.ok) {
    log({ event: "float_check_error", code: balances.error?.code ?? "unknown" });
    return;
  }
  if (!shouldWithdraw(balances, FLOAT_MIN_USDC)) return;
  const result = await cli(["withdraw", "--all"]);
  log({ event: "auto_withdraw", ok: result.ok, withdrawn: result.withdrawn ?? null,
    tx_hash: result.tx_hash ?? null, error: result.ok ? null : result.error?.code ?? "unknown" });
}

async function pollOnce() {
  await maintainFloat();
  const result = await cli(["orders"]);
  if (!result.ok) {
    errorStreak += 1;
    log({ event: "poll_error", code: result.error?.code ?? "unknown", http_status: result.error?.http_status ?? null,
      streak: errorStreak });
    return;
  }
  errorStreak = 0;
  const orders = Array.isArray(result.orders) ? result.orders : [];
  if (!orders.length) { lastFoundKey = ""; return; } // quiet poll: no log

  const candidates = orders
    .filter((o) => o.claimable === true && o.own_order === false && o.estimate?.profitable === true && ORDER_ID.test(String(o.id)))
    .filter((o) => !recentlyTriggered(o.id))
    .sort((a, b) => (profit(b) > profit(a) ? 1 : profit(b) < profit(a) ? -1 : 0));

  // Log polls that found orders; repeat an unchanged picture at most once a minute.
  const key = JSON.stringify(orders.map(summarize));
  if (candidates.length || key !== lastFoundKey || Date.now() - lastFoundAt > 60_000) {
    log({ event: "poll", orders: orders.map(summarize), candidates: candidates.map((o) => o.id) });
    lastFoundKey = key;
    lastFoundAt = Date.now();
  }
  if (!candidates.length) return;

  const order = candidates[0];
  if (!acquireLock(order.id)) {
    log({ event: "skip_locked", order_id: order.id });
    return;
  }
  remember(order.id);
  await maintainFloat(true);
  log({ event: "agent_start", order_id: order.id, profit_usdc: order.estimate?.profit_usdc ?? null });
  try {
    const run = await runAgent(order);
    const after = await cli(["status", order.id]);
    const { output, ...runSummary } = run;
    log({ event: "agent_end", order_id: order.id, ...runSummary,
      chain_status: after.ok ? after.status ?? null : null, fulfiller: after.ok ? after.fulfiller ?? null : null,
      status_error: after.ok ? null : after.error?.code ?? null });
    const evidence = deliveryEvidence(output, run.report, order.id);
    if (after.ok && after.status === "claimed" && after.fulfiller === ACCOUNT && after.delivery_tx_hash) {
      log({ event: "auto_release_skipped", order_id: order.id, reason: "delivery_tx_hash_present" });
    } else if (after.ok && after.status === "claimed" && after.fulfiller === ACCOUNT && evidence) {
      log({ event: "auto_release_skipped", order_id: order.id, reason: "delivery_evidence_in_run_output" });
    } else if (after.ok && after.status === "claimed" && after.fulfiller === ACCOUNT && run.output_truncated) {
      log({ event: "auto_release_skipped", order_id: order.id, reason: "run_output_truncated" });
    } else if (shouldAutoRelease({ run, status: after, account: ACCOUNT, deliveryEvidence: evidence })) {
      const released = await cli(["release", order.id]);
      log({ event: "auto_release", order_id: order.id, result: released });
    }
  } finally {
    releaseLock();
  }
}

function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  if (child) { try { process.kill(-child.pid, "SIGTERM"); } catch { /* gone */ } }
  releaseLock();
  log({ event: "poller_stop", signal });
  setTimeout(() => process.exit(0), 500);
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

log({ event: "poller_start", account: ACCOUNT, skill_dir: SKILL_DIR, poll_ms: POLL_MS, run_timeout_ms: RUN_TIMEOUT_MS });
while (!stopping) {
  try { await pollOnce(); } catch (error) {
    errorStreak += 1;
    log({ event: "poll_exception", message: String(error?.message || error).slice(0, 200), streak: errorStreak });
  }
  const wait = errorStreak >= 2 ? BACKOFF_MS : POLL_MS;
  await new Promise((r) => setTimeout(r, wait));
}
