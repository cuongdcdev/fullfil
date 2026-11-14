import assert from "node:assert/strict";
import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { FulfilApi } from "../src/api.mjs";
import { baseEncode } from "near-api-js";
import { Commands } from "../src/commands.mjs";
import { canonicalJson } from "../src/common.mjs";
import { AgentSigner } from "../src/keys.mjs";

test("prove uploads JSON, verifies SHA and signs only the matching submit_proof intent", async () => {
  const signer = new AgentSigner(`ed25519:${baseEncode(Buffer.alloc(32, 4))}`);
  const nonce = Buffer.alloc(32, 2).toString("base64");
  const spec = { amount_out: "100", receiver: "buyer.near", token_contract: "token.near", v: 1 };
  const canonical = canonicalJson(spec);
  const sha = "a".repeat(64);
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url: String(url), body: JSON.parse(init.body) });
    if (String(url).endsWith("/proofs")) return Response.json({ sha256: sha });
    if (String(url).endsWith("/intents/build")) {
      return Response.json({ payload_to_sign: { recipient: "intents.near", nonce, message: JSON.stringify({
        signer_id: "agent.near", deadline: new Date(Date.now() + 120_000).toISOString(),
        intents: [{ intent: "auth_call", contract_id: "nearfullfil.near",
          msg: JSON.stringify({ op: "submit_proof", order_id: "FUL-1234", proof_sha256: sha, spec: canonical }),
          attached_deposit: "0", min_gas: "200000000000000" }],
      }) } });
    }
    return Response.json({ status: "submitted", tx_hash: "intent-hash" });
  };
  const api = new FulfilApi({ baseUrl: "https://fulfil.example", accountId: "agent.near", signer, fetchImpl });
  const client = new Commands({ accountId: "agent.near", signer, api, rpc: {}, router: {} });
  client.ownedClaim = async () => ({ canonical });
  const result = await client.prove("FUL-1234", "2rTjKfSa7uKx89mRnYq3bC6nQw4eD1pZ5tH8vL9sM2xA");
  assert.equal(result.proof_sha256, sha);
  assert.deepEqual(calls.map((call) => new URL(call.url).pathname), ["/api/v3/proofs", "/api/v3/intents/build", "/api/v3/intents/submit"]);
  assert.deepEqual(calls[0].body, { order_id: "FUL-1234", tx_hash: "2rTjKfSa7uKx89mRnYq3bC6nQw4eD1pZ5tH8vL9sM2xA" });
  assert.deepEqual(calls[1].body, { kind: "auth_call", op: "submit_proof", order_id: "FUL-1234", proof_sha256: sha });
  assert.equal(calls[2].body.standard, "nep413");
  assert.ok(calls[2].body.signature.startsWith("ed25519:"));
});

test("mismatched intent build is rejected before signing/submission", async () => {
  const signer = new AgentSigner(`ed25519:${baseEncode(Buffer.alloc(32, 5))}`);
  let submit = false;
  const api = new FulfilApi({ baseUrl: "https://fulfil.example", accountId: "agent.near", signer,
    fetchImpl: async (url) => {
      if (String(url).endsWith("/intents/submit")) submit = true;
      return Response.json({ payload_to_sign: { recipient: "intents.near", nonce: Buffer.alloc(32).toString("base64"),
        message: JSON.stringify({ signer_id: "agent.near", deadline: new Date(Date.now() + 120_000).toISOString(),
          intents: [{ intent: "auth_call", contract_id: "nearfullfil.near", msg: '{"op":"release_claim","order_id":"FUL-1234"}',
            attached_deposit: "0", min_gas: "20000000000000" }] }) } });
    } });
  await assert.rejects(api.authCall("claim", "FUL-1234"), { code: "unsafe_intent" });
  assert.equal(submit, false);
});

test("register_fulfiller intent has no order or bank fields and is verified before signing", async () => {
  const signer = new AgentSigner(`ed25519:${baseEncode(Buffer.alloc(32, 8))}`);
  const calls = [];
  const nonce = Buffer.alloc(32, 9).toString("base64");
  let extraBankField = false;
  const api = new FulfilApi({ baseUrl: "https://fulfil.example", accountId: "agent.near", signer,
    fetchImpl: async (url, init) => {
      const path = new URL(url).pathname;
      calls.push([path, JSON.parse(init.body)]);
      if (path.endsWith("/intents/build")) return Response.json({ payload_to_sign: {
        recipient: "intents.near", nonce, message: JSON.stringify({ signer_id: "agent.near",
          deadline: new Date(Date.now() + 120_000).toISOString(), intents: [{ intent: "auth_call",
            contract_id: "nearfullfil.near", msg: JSON.stringify({ op: "register_fulfiller",
              ...(extraBankField ? { bank_bin: "123456" } : {}) }),
            attached_deposit: "0", min_gas: "20000000000000" }] }),
      } });
      return Response.json({ status: "submitted" });
    } });
  await api.authCall("register_fulfiller");
  assert.deepEqual(calls[0][1], { kind: "auth_call", op: "register_fulfiller" });
  assert.equal(calls[1][0], "/api/v3/intents/submit");
  extraBankField = true;
  await assert.rejects(api.authCall("register_fulfiller"), { code: "unsafe_intent" });
  assert.equal(calls.filter(([path]) => path.endsWith("/intents/submit")).length, 1);
});

test("API JSON errors preserve safe code, message and HTTP status", async () => {
  const api = new FulfilApi({ baseUrl: "https://fulfil.example", accountId: "agent.near",
    fetchImpl: async () => Response.json({ error: { code: "upstream_error", message: "NEAR RPC returned no view result" } }, { status: 502 }) });
  await assert.rejects(api.request("GET", "/orders"), (error) =>
    error.code === "upstream_error" && error.message === "NEAR RPC returned no view result" && error.http_status === 502);
  api.fetch = async () => new Response("<html>failure</html>", { status: 503 });
  await assert.rejects(api.request("GET", "/orders"), (error) =>
    error.code === "api_http_503" && error.message === "Fulfil API returned HTTP 503" && error.http_status === 503);
});

test("login challenge is validated and session cache uses mode 0600", async () => {
  const signer = new AgentSigner(`ed25519:${baseEncode(Buffer.alloc(32, 6))}`);
  const nonce = Buffer.alloc(32, 3).toString("base64");
  const issued = new Date().toISOString();
  const expires = new Date(Date.now() + 300_000).toISOString();
  const message = `fulfil.example wants you to sign in with your wallet:\nFulfil\n\nSign in to Fulfil.\n\nURI: https://fulfil.example\nVersion: 1\nNonce: ${nonce}\nIssued At: ${issued}\nExpiration Time: ${expires}`;
  const cacheDir = await mkdtemp(join(tmpdir(), "fulfil-skill-test-"));
  const api = new FulfilApi({ baseUrl: "https://fulfil.example", accountId: "agent.near", signer, cacheDir,
    fetchImpl: async (url) => String(url).endsWith("/challenge")
      ? Response.json({ nonce, message, recipient: "fulfil.example", expires_at: expires })
      : Response.json({ account_id: "agent.near", expires_at: expires }, { headers: { "set-cookie": "fulfil_v3_session=synthetic; HttpOnly" } }) });
  await api.login();
  assert.equal((await stat(api.cachePath)).mode & 0o777, 0o600);
  assert.equal(JSON.parse(await readFile(api.cachePath, "utf8")).cookie, "fulfil_v3_session=synthetic");
  assert.throws(() => api.validateChallenge({ nonce, message: message.replace("fulfil.example", "evil.example"),
    recipient: "fulfil.example", expires_at: expires }), { code: "unsafe_challenge" });
});
