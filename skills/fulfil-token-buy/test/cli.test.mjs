import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { FulfilApi } from "../src/api.mjs";
import { baseEncode } from "near-api-js";
import { AgentError, canonicalJson, sha256Hex } from "../src/common.mjs";
import { AgentSigner } from "../src/keys.mjs";
import { main, parseArgs, runCli } from "../src/cli.mjs";

const bundleUrl = new URL("../fulfil-agent.mjs", import.meta.url);
const bundle = fileURLToPath(bundleUrl);

test("built bundle runs --help and prints JSON without a synthetic key", async () => {
  const secret = `ed25519:${baseEncode(Buffer.alloc(32, 11))}`;
  const oldArgs = process.argv;
  const oldWrite = process.stdout.write;
  const oldKey = process.env.NEAR_PRIVATE_KEY;
  let output = "";
  try {
    process.argv = [process.execPath, bundle, "--help"];
    process.env.NEAR_PRIVATE_KEY = secret;
    process.stdout.write = (chunk) => {
      output += chunk;
      return true;
    };
    await import(bundleUrl.href);
    await new Promise((resolve) => setImmediate(resolve));
  } finally {
    process.argv = oldArgs;
    process.stdout.write = oldWrite;
    if (oldKey === undefined) delete process.env.NEAR_PRIVATE_KEY;
    else process.env.NEAR_PRIVATE_KEY = oldKey;
  }
  const jsonStart = output.indexOf('{"ok":');
  assert.ok(jsonStart >= 0);
  assert.equal(JSON.parse(output.slice(jsonStart).split("\n")[0]).ok, true);
  assert.equal(output.includes(secret), false);
});

test("CLI errors are JSON and do not expose the key", async () => {
  const secret = `ed25519:${baseEncode(Buffer.alloc(32, 12))}`;
  let output = "";
  const code = await runCli(["claim"], { NEAR_PRIVATE_KEY: secret }, (line) => { output += line; });
  assert.equal(code, 1);
  assert.equal(JSON.parse(output).error.code, "missing_account");
  assert.equal(output.includes(secret), false);
});

test("every command path emits exactly one JSON document on stdout", async () => {
  const commands = {};
  const invocations = [
    ["setup"], ["setup", "--dry-run"], ["orders"], ["quote", "FUL-1234"],
    ["claim", "FUL-1234"], ["buy", "FUL-1234"], ["deliver", "FUL-1234"],
    ["prove", "FUL-1234", "2rTjKfSa7uKx89mRnYq3bC6nQw4eD1pZ5tH8vL9sM2xA"],
    ["status", "FUL-1234"], ["release", "FUL-1234"], ["run"], ["run", "--dry-run"],
    ["balances"], ["withdraw", "--all"], ["withdraw", "--amount", "10", "--dry-run"],
    ["--help"], ["bogus"],
  ];
  for (const command of ["setup", "orders", "quote", "claim", "buy", "deliver", "prove", "status", "release", "run", "balances", "withdrawToWallet"]) {
    commands[command] = async () => {
      console.log("library chatter");
      console.warn("Retrying");
      process.stdout.write("stray output\n");
      return { command };
    };
  }
  const deps = { loadSigner: async () => ({ publicKey: "ed25519:synthetic" }),
    api: { loadCookie: async () => {} }, rpc: {}, router: {}, commands };
  for (const argv of invocations) {
    let output = "";
    const exit = await runCli(argv, { NEAR_ACCOUNT_ID: "agent.near" }, (line) => { output += line; }, deps);
    assert.equal(output.endsWith("\n"), true);
    assert.equal(output.trim().startsWith("{"), true);
    const parsed = JSON.parse(output);
    assert.equal(typeof parsed.ok, "boolean");
    assert.equal(exit === 0, parsed.ok);
  }
});

test("withdraw options are exclusive and amount belongs only to withdraw or deliver", async () => {
  assert.equal(parseArgs(["withdraw", "--all"]).all, true);
  let output = "";
  const deps = { loadSigner: async () => ({}), api: {}, rpc: {}, router: {}, commands: {} };
  for (const argv of [["withdraw", "--all", "--amount", "1"], ["balances", "--amount", "1"],
    ["deliver", "FUL-1", "--all"]]) {
    output = "";
    const code = await runCli(argv, { NEAR_ACCOUNT_ID: "agent.near" }, (line) => { output += line; }, deps);
    assert.equal(code, 1);
    assert.equal(JSON.parse(output).error.code, "usage");
  }
});

test("CLI serializes upstream API error details as JSON", async () => {
  const upstream = new AgentError("upstream_error", "NEAR RPC returned no view result");
  upstream.http_status = 502;
  let output = "";
  const code = await runCli(["claim", "FUL-1234"], { NEAR_ACCOUNT_ID: "agent.near" },
    (line) => { output += line; }, {
      loadSigner: async () => ({ publicKey: "ed25519:synthetic" }),
      api: {}, rpc: {}, router: {},
      commands: { claim: async () => { throw upstream; } },
    });
  assert.equal(code, 1);
  assert.deepEqual(JSON.parse(output), { ok: false, error: {
    code: "upstream_error", message: "NEAR RPC returned no view result", http_status: 502,
  } });
});

test("read commands can log in off-chain while dry-run never submits an intent or transaction", async () => {
  assert.equal(parseArgs(["deliver", "FUL-1234", "--amount", "200"]).amount, "200");
  const secret = `ed25519:${baseEncode(Buffer.alloc(32, 14))}`;
  const signer = new AgentSigner(secret);
  const nonce = Buffer.alloc(32, 5).toString("base64");
  const spec = { amount_out: "100", receiver: "buyer.near", token_contract: "token.near", v: 1 };
  const chain = { id: "FUL-1234", kind: "token_buy", status: "funded", buyer: "buyer.near",
    fulfiller: null, deadline_ns: (BigInt(Date.now() + 600_000) * 1_000_000n).toString(),
    pay_amount: "1000000", reward: "50000", spec_hash: sha256Hex(canonicalJson(spec)) };
  const buyToken = { account_id: "token.near", symbol: "TOK", decimals: 18 };
  const order = { ...chain, spec, token: "nep141:usdc.near", buy_token: buyToken, delivery_tx_hash: null };
  const route = { dex_id: "Rhea", estimated_amount: { amount_in: "900000" },
    worst_case_amount: { amount_in: "950000" }, token_output: "nep141:token.near",
    execution_instructions: [{ NearTransaction: { receiver_id: "usdc.near", actions: [{ FunctionCall: {
      method_name: "ft_transfer_call", args: "e30=", gas: 10000000000000, deposit: "1",
    } }], is_fee_transaction: false } }] };
  for (const args of [["orders"], ["quote", "FUL-1234"], ["run", "--dry-run"]]) {
    const cacheDir = await mkdtemp(join(tmpdir(), "fulfil-cli-dry-test-"));
    const paths = [];
    const issued = new Date().toISOString();
    const expires = new Date(Date.now() + 300_000).toISOString();
    const message = `fulfil.example wants you to sign in with your wallet:\nFulfil\n\nSign in to Fulfil.\n\nURI: https://fulfil.example\nVersion: 1\nNonce: ${nonce}\nIssued At: ${issued}\nExpiration Time: ${expires}`;
    const fetchImpl = async (url, init = {}) => {
      const parsed = new URL(url);
      paths.push(parsed.pathname);
      if (parsed.pathname === "/api/v3/auth/challenge") {
        return Response.json({ nonce, message, recipient: "fulfil.example", expires_at: expires });
      }
      if (parsed.pathname === "/api/v3/auth/verify") {
        assert.ok(JSON.parse(init.body).signature.startsWith("ed25519:"));
        return Response.json({ account_id: "agent.near", expires_at: expires },
          { headers: { "set-cookie": "fulfil_v3_session=synthetic; HttpOnly" } });
      }
      if (parsed.pathname === "/api/v3/orders" || parsed.pathname === "/api/v3/orders/FUL-1234") {
        if (!init.headers.Cookie) return Response.json({ error: { code: "unauthorized" } }, { status: 401 });
        return Response.json(parsed.pathname.endsWith("/FUL-1234") ? { order } : { orders: [order] });
      }
      if (parsed.pathname === "/route") return Response.json([route]);
      assert.fail(`Unexpected request: ${parsed.pathname}`);
    };
    const api = new FulfilApi({ baseUrl: "https://fulfil.example", accountId: "agent.near", signer,
      fetchImpl, cacheDir });
    const rpc = {
      view: async (_, method) => {
        if (method === "has_public_key") return true;
        if (method === "get_profile") return { profile: {} };
        if (method === "mt_balance_of") return "0";
        assert.equal(method, "get_order");
        return chain;
      },
      tokenBalance: async () => "2000000",
      sendActions: async () => assert.fail("dry-run sent a NEAR transaction"),
    };
    const result = await main(args, { NEAR_ACCOUNT_ID: "agent.near", NEAR_PRIVATE_KEY: secret }, {
      loadSigner: async () => signer, api, rpc, fetchImpl,
    });
    assert.equal(result.ok, true);
    if (args[0] === "orders") {
      assert.deepEqual(result.orders[0].buy_token, buyToken);
      assert.equal(result.orders[0].delivery_tx_hash, null);
      assert.equal("token" in result.orders[0], false);
    }
    if (args[0] === "run") assert.equal(result.action, "dry_run");
    assert.ok(paths.includes("/api/v3/auth/challenge"));
    assert.ok(paths.includes("/api/v3/auth/verify"));
    assert.equal(paths.some((path) => path.startsWith("/api/v3/intents/") || path === "/api/v3/proofs"), false);
    assert.equal(JSON.stringify(result).includes(secret), false);
  }
});
