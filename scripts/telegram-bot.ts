import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { setTimeout as sleep } from "node:timers/promises";

type Order = {
  id: string;
  kind: string;
  status: string;
  payAmount: string;
  reward: string;
  createdAt: number | null;
  txHash?: string;
};
type Summary = { brand?: string; denomination?: string };
type Row = { key: string; value: string };

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envFile = resolve(root, ".env");
if (existsSync(envFile)) process.loadEnvFile(envFile);

const dryRun = process.argv.includes("--dry-run");
const once = process.argv.includes("--once");
const backfill = process.argv.includes("--backfill");
const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;
const baseUrl = process.env.PUBLIC_BASE_URL?.replace(/\/+$/, "");
const dbPath = resolve(root, (process.env.DATABASE_URL || "data/dev.db").replace(/^file:/, ""));
const statePath = resolve(root, "data/telegram-bot-state.json");
const controller = new AbortController();
let stopping = false;

if (!dryRun && (!token || !chatId)) {
  throw new Error("TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are required");
}

const db = new DatabaseSync(dbPath, { readOnly: true });
const orderQuery = db.prepare(
  "SELECT key, value FROM records WHERE kind = 'mainnet:order' OR key = 'mainnet:snapshot'",
);
const summaryQuery = db.prepare("SELECT value FROM records WHERE key = ?");
const rawValues = new Map<string, string>();
const terminalOrders = new Map<string, Order>();
let openOrders: Order[] = [];
let dbClosed = false;

function closeDb(): void {
  if (dbClosed) return;
  db.close();
  dbClosed = true;
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    stopping = true;
    controller.abort();
    closeDb();
  });
}

const labels: Record<string, string> = {
  funded: "🆕 New job",
  claimed: "✋ Claimed",
  sent: "📤 Proof sent",
  verifying: "🔎 Verifying proof",
  proof_rejected: "🚫 Proof rejected",
  verified: "☑️ Proof verified",
  under_review: "🧐 Under review",
  paid: "✅ Paid",
  closed: "✅ Closed",
  disputed: "⚖️ Disputed",
  resolved: "🤝 Resolved",
  cancelled: "❌ Cancelled",
  expired: "⌛ Expired",
};

const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function usdc(units: string): string {
  const cents = (BigInt(units) + 5_000n) / 10_000n;
  return `${cents / 100n}.${(cents % 100n).toString().padStart(2, "0")} USDC`;
}

function title(order: Order, summary?: Summary): string {
  const brand = summary?.brand?.trim();
  const knownBrand = brand && !/^unknown$/i.test(brand) ? brand : "";
  if (order.kind === "in_person") return knownBrand || "Nearby item";
  if (order.kind === "cryptorefills_topup" || order.kind === "cryptorefills_code") {
    return knownBrand ? [knownBrand, summary?.denomination?.trim()].filter(Boolean).join(" ") : "Online order";
  }
  if (order.kind === "token_buy") return knownBrand ? `Buy ${knownBrand}` : "Memecoin buy";
  return knownBrand || "Local QR payment";
}

const link = (url: string, text: string) => `<a href="${escapeHtml(url).replace(/"/g, "&quot;")}">${text}</a>`;

/** Same routing as activityHref (apps/web/lib/activity.ts), buyer view. */
function orderPath(order: Order): string {
  const id = encodeURIComponent(order.id);
  const shop = ["in_person", "cryptorefills_topup", "cryptorefills_code", "token_buy"].includes(order.kind);
  return shop ? `/shop/orders/${id}` : `/pay/${id}`;
}

function message(order: Order, summary?: Summary): string {
  const lines = [
    `<b>${escapeHtml(labels[order.status] ?? `ℹ️ ${order.status}`)}</b>`,
    escapeHtml(title(order, summary)),
    `Reward: ${escapeHtml(usdc(order.reward))} · Pay: ${escapeHtml(usdc(order.payAmount))}`,
    `<code>${escapeHtml(order.id)}</code>`,
  ];
  const links: string[] = [];
  if (baseUrl) links.push(link(`${baseUrl}${orderPath(order)}`, "Open order"));
  if (order.txHash) links.push(link(`https://nearblocks.io/txns/${order.txHash}`, "View tx"));
  if (links.length) lines.push(links.join(" · "));
  return lines.join("\n");
}

function readOrders(): Order[] {
  const seen = new Set<string>();
  for (const row of orderQuery.all() as Row[]) {
    seen.add(row.key);
    if (rawValues.get(row.key) === row.value) continue;
    if (row.key === "mainnet:snapshot") {
      openOrders = (JSON.parse(row.value) as { open?: Order[] }).open ?? [];
    } else {
      terminalOrders.set(row.key, JSON.parse(row.value) as Order);
    }
    rawValues.set(row.key, row.value);
  }
  for (const key of rawValues.keys()) {
    if (seen.has(key)) continue;
    rawValues.delete(key);
    if (key === "mainnet:snapshot") openOrders = [];
    else terminalOrders.delete(key);
  }
  const orders = new Map(openOrders.map((order) => [order.id, order]));
  for (const order of terminalOrders.values()) orders.set(order.id, order);
  return [...orders.values()].sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
}

function summaryFor(id: string): Summary | undefined {
  const row = summaryQuery.get(`v3:spec_summary:${id}`) as { value: string } | undefined;
  return row ? JSON.parse(row.value) as Summary : undefined;
}

async function send(text: string): Promise<boolean> {
  if (dryRun) {
    console.log(`${text}\n`);
    return true;
  }
  while (!stopping) {
    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
        signal: controller.signal,
      });
      if (response.status === 429) {
        const body = await response.json() as { parameters?: { retry_after?: number } };
        const seconds = body.parameters?.retry_after ?? 1;
        console.error(`Telegram rate limited; retrying in ${seconds}s`);
        await sleep(Math.max(1, seconds) * 1_000, undefined, { signal: controller.signal });
        continue;
      }
      if (!response.ok) {
        console.error(`Telegram send failed (HTTP ${response.status})`);
        return false;
      }
      const body = await response.json() as { ok?: boolean; result?: { message_id?: number } };
      if (!body.ok) {
        console.error("Telegram send failed (API response not ok)");
        return false;
      }
      console.log(`Posted message ${body.result?.message_id}`);
      return true;
    } catch {
      if (!stopping) console.error("Telegram send failed (network error)");
      return false;
    }
  }
  return false;
}

const state: Record<string, string> = backfill || !existsSync(statePath)
  ? {}
  : JSON.parse(readFileSync(statePath, "utf8")) as Record<string, string>;

async function poll(): Promise<void> {
  const orders = readOrders();
  for (const order of orders) {
    if (stopping) break;
    if (state[order.id] === order.status) continue;
    if (!await send(message(order, summaryFor(order.id)))) continue;
    state[order.id] = order.status;
    if (!dryRun) {
      const temporary = `${statePath}.tmp`;
      writeFileSync(temporary, JSON.stringify(state, null, 2) + "\n");
      renameSync(temporary, statePath);
    }
    if (!dryRun && !stopping) {
      await sleep(1_000, undefined, { signal: controller.signal }).catch(() => {});
    }
  }
}

try {
  do {
    try {
      await poll();
    } catch (error) {
      if (!stopping) {
        console.error("Telegram poll failed:", error);
        if (once) process.exitCode = 1;
      }
    }
    if (once || stopping) break;
    await sleep(30_000, undefined, { signal: controller.signal }).catch(() => {});
  } while (!stopping);
} finally {
  closeDb();
}
