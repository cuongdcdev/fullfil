import assert from "node:assert/strict";
import test from "node:test";
import { NearRpc, parseRpcUrls } from "../src/rpc.mjs";
import { baseEncode } from "near-api-js";
import { AgentSigner } from "../src/keys.mjs";
import { USDC_CONTRACT } from "../src/common.mjs";

const ok = (result) => Response.json({ jsonrpc: "2.0", result });

test("RPC rotates in order across 5xx, 429, timeout and network errors", async () => {
  const urls = ["https://one.test", "https://two.test", "https://three.test", "https://four.test", "https://five.test"];
  const seen = [];
  const rpc = new NearRpc({ urls, timeoutMs: 5, fetchImpl: async (url, options) => {
    seen.push(url);
    if (url === urls[0]) return new Response("", { status: 503 });
    if (url === urls[1]) return new Response("", { status: 429 });
    if (url === urls[2]) {
      return new Promise((_, reject) => options.signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true }));
    }
    if (url === urls[3]) throw new TypeError("network failed");
    return ok({ hello: "world" });
  } });
  assert.deepEqual(await rpc.call("block", { finality: "final" }), { hello: "world" });
  assert.deepEqual(seen, urls);
  await rpc.call("block", { finality: "final" });
  assert.equal(seen.at(-1), urls[4], "successful endpoint becomes first on the next call");
});

test("deterministic RPC handler error does not rotate", async () => {
  const seen = [];
  const rpc = new NearRpc({ urls: ["https://one.test", "https://two.test"], fetchImpl: async (url) => {
    seen.push(url);
    return Response.json({ error: { name: "HANDLER_ERROR", message: "UNKNOWN_ACCOUNT" } });
  } });
  await assert.rejects(rpc.call("query", {}), { code: "rpc_error" });
  assert.deepEqual(seen, ["https://one.test"]);
});

test("contract method errors are deterministic", async () => {
  let calls = 0;
  const rpc = new NearRpc({ urls: ["https://one.test", "https://two.test"], fetchImpl: async () => {
    calls++;
    return Response.json({ error: { name: "HANDLER_ERROR", message: "MethodNotFound" } });
  } });
  await assert.rejects(rpc.view("token.near", "unknown_method", {}), { code: "rpc_error" });
  assert.equal(calls, 1);
});

test("transient JSON-RPC server error rotates", async () => {
  let calls = 0;
  const rpc = new NearRpc({ urls: ["https://one.test", "https://two.test"], fetchImpl: async () => {
    calls++;
    return calls === 1 ? Response.json({ error: { name: "TIMEOUT_ERROR", message: "Server error" } }) : ok("done");
  } });
  assert.equal(await rpc.call("query", {}), "done");
  assert.equal(calls, 2);
});

test("NEAR_RPC_URLS overrides and trims endpoints", () => {
  assert.deepEqual(parseRpcUrls(" https://a.test , https://b.test "), ["https://a.test", "https://b.test"]);
  assert.equal(parseRpcUrls(undefined).length, 4);
  assert.throws(() => parseRpcUrls("https://a.test, "), { code: "invalid_config" });
});

test("a timed-out send retries exactly the same signed transaction", async () => {
  const signer = new AgentSigner(`ed25519:${baseEncode(Buffer.alloc(32, 7))}`);
  const sends = [];
  const urls = ["https://one.test", "https://two.test"];
  const rpc = new NearRpc({ urls, timeoutMs: 5, fetchImpl: async (url, options) => {
    const request = JSON.parse(options.body);
    if (request.method === "query") return ok({ nonce: 9, permission: "FullAccess" });
    if (request.method === "block") return ok({ header: { hash: baseEncode(Buffer.alloc(32, 1)) } });
    sends.push({ url, signed: request.params.signed_tx_base64 });
    if (url === urls[0]) {
      return new Promise((_, reject) => options.signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true }));
    }
    return ok({ status: { SuccessValue: "" }, transaction: { hash: "synthetic-hash" } });
  } });
  const result = await rpc.sendActions({ accountId: "agent.near", signer, receiverId: "token.near",
    actions: [{ type: "Transfer", deposit: "1" }] });
  assert.equal(result.tx_hash, "synthetic-hash");
  assert.deepEqual(sends.map((send) => send.url), urls);
  assert.equal(sends[0].signed, sends[1].signed);
});

test("NEP-141 balance helper uses token metadata and caches decimals", async () => {
  const methods = [];
  const rpc = new NearRpc({ urls: ["https://one.test"], fetchImpl: async (_, options) => {
    const request = JSON.parse(options.body);
    const method = request.params.method_name;
    methods.push(method);
    const value = method === "ft_metadata"
      ? { spec: "ft-1.0.0", name: "Test Token", symbol: "TEST", decimals: 18 }
      : "123456789012345678901";
    return ok({ result: [...Buffer.from(JSON.stringify(value))], block_hash: "synthetic", block_height: 1 });
  } });
  assert.equal(await rpc.tokenBalance("token.near", "agent.near"), 123456789012345678901n);
  assert.equal((await rpc.token("token.near")).metadata.decimals, 18);
  assert.equal(await rpc.tokenBalance("token.near", "agent.near"), 123456789012345678901n);
  assert.deepEqual(methods, ["ft_metadata", "ft_balance_of", "ft_balance_of"]);
  await rpc.tokenBalance(USDC_CONTRACT, "agent.near");
  assert.equal(methods.at(-1), "ft_balance_of", "known mainnet USDC uses near-api-js's bundled metadata");
});
