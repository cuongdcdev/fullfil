import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtempSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { Commands, requiredFloat } from "../src/commands.mjs";
import { USDC_CONTRACT, STORAGE_DEPOSIT } from "../src/common.mjs";

const account = "agent.near";
const order = { id: "FUL-1", pay_amount: "2000000", reward: "100000" };
const spec = { amount_out: "100", token_contract: "token.near" };
const route = { worst_case_amount: { amount_in: "1000000" }, estimated_amount: { amount_in: "900000" },
  execution_instructions: [{ NearTransaction: { receiver_id: USDC_CONTRACT, actions: [
    { FunctionCall: { method_name: "ft_transfer_call", args: "e30=", gas: 30000000000000, deposit: "1" } },
  ] } }] };

function fixture({ wallet = "0", intents = "2000000", registered = true } = {}) {
  const sent = [];
  let currentWallet = BigInt(wallet);
  let currentIntents = BigInt(intents);
  const rpc = {
    tokenBalance: async (contract) => {
      assert.equal(contract, USDC_CONTRACT);
      return currentWallet.toString();
    },
    view: async (contract, method, args) => {
      if (method === "mt_balance_of") {
        assert.equal(contract, "intents.near");
        assert.deepEqual(args, { account_id: account, token_id: `nep141:${USDC_CONTRACT}` });
        return currentIntents.toString();
      }
      if (method === "storage_balance_of") return registered ? { total: STORAGE_DEPOSIT } : null;
      if (method === "has_public_key") return true;
      if (method === "get_profile") return { profile: {} };
      assert.fail(`unexpected view ${method}`);
    },
    viewAccount: async () => ({ amount: "123456789" }),
    sendActions: async (tx) => {
      sent.push(tx);
      if (tx.receiverId === "intents.near") {
        const units = BigInt(JSON.parse(tx.actions[0].args).amount);
        currentWallet += units;
        currentIntents -= units;
      }
      return { tx_hash: `hash-${sent.length}` };
    },
  };
  const client = new Commands({ accountId: account, signer: {}, api: {}, rpc,
    router: { quote: async () => route, outcome: async () => null } });
  return { client, rpc, sent };
}

test("withdraw uses exact intents action and registered wallet sends one transaction", async () => {
  const { client, sent } = fixture();
  const result = await client.withdrawToWallet("1000000");
  assert.equal(sent.length, 1);
  assert.equal(sent[0].receiverId, "intents.near");
  assert.deepEqual(sent[0].actions.map((a) => ({ method: a.methodName, gas: a.gas, deposit: a.deposit })),
    [{ method: "ft_withdraw", gas: "50000000000000", deposit: "1" }]);
  assert.deepEqual(JSON.parse(sent[0].actions[0].args),
    { token: USDC_CONTRACT, receiver_id: account, amount: "1000000" });
  assert.deepEqual(result, { withdrawn: "1000000", tx_hash: "hash-1", wallet_usdc_before: "0",
    wallet_usdc_after: "1000000", intents_usdc_before: "2000000", intents_usdc_after: "1000000" });
});

test("withdraw registers USDC storage in a separate first transaction", async () => {
  const { client, sent } = fixture({ registered: false });
  const result = await client.withdrawToWallet();
  assert.deepEqual(sent.map((tx) => tx.receiverId), [USDC_CONTRACT, "intents.near"]);
  assert.deepEqual(JSON.parse(sent[0].actions[0].args), { account_id: account, registration_only: true });
  assert.equal(sent[0].actions[0].methodName, "storage_deposit");
  assert.equal(sent[0].actions[0].deposit, STORAGE_DEPOSIT);
  assert.equal(sent[0].actions[0].gas, "30000000000000");
  assert.equal(result.storage_tx_hash, "hash-1");
  assert.equal(result.tx_hash, "hash-2");
});

test("withdraw rejects excess or zero, and dry-run sends nothing", async () => {
  const { client, sent } = fixture({ intents: "500" });
  await assert.rejects(client.withdrawToWallet("501"), { code: "insufficient_intents_balance" });
  const preview = await client.withdrawToWallet(null, true);
  assert.equal(preview.withdrawn, "500");
  assert.equal(preview.storage_registration_needed, false);
  assert.equal(sent.length, 0);
  await assert.rejects(client.withdrawToWallet("0"), { code: "nothing_to_withdraw" });
});

test("balances returns wallet, intents, NEAR yocto and account", async () => {
  const { client } = fixture({ wallet: "9", intents: "8" });
  assert.deepEqual(await client.balances(), { wallet_usdc: "9", intents_usdc: "8",
    near: "123456789", account_id: account });
});

test("buy tops up full intents balance before route, and reports it", async () => {
  const { client, sent } = fixture({ wallet: "1000", intents: "2000000" });
  client.ownedClaim = async () => ({ chain: order, spec });
  client.tokenBalance = async () => 100n;
  const result = await client.buy(order.id);
  assert.deepEqual(sent.map((tx) => tx.receiverId), ["intents.near", USDC_CONTRACT]);
  assert.equal(result.auto_withdraw.withdrawn, "2000000");
  assert.equal(result.auto_withdraw.tx_hash, "hash-1");
  assert.deepEqual(result.tx_hashes, ["hash-2"]);
});

test("buy insufficient float sends no transaction", async () => {
  const { client, sent } = fixture({ wallet: "100", intents: "100" });
  client.ownedClaim = async () => ({ chain: order, spec });
  await assert.rejects(client.buy(order.id), { code: "insufficient_float" });
  assert.equal(sent.length, 0);
});

test("run checks float before claim and dry-run reports shortage without sending", async () => {
  const { client, sent } = fixture({ wallet: "100", intents: "100" });
  const calls = [];
  client.api.authCall = async (name) => { calls.push(name); return {}; };
  client.orders = async () => ({ orders: [{ id: order.id, own_order: false, claimable: true,
    estimate: { profitable: true, profit_usdc: "100" } }] });
  client.quote = async () => ({ profitable: true, usdc_in: "1000000" });
  const preview = await client.run(true);
  assert.equal(preview.float.sufficient, false);
  await assert.rejects(client.run(), { code: "insufficient_float" });
  assert.deepEqual(calls, []);
  assert.deepEqual(sent, []);
  assert.equal(requiredFloat("1000000"), 1010000n);
});

test("bundled CLI emits JSON from direct and symlinked paths", async () => {
  const skillDir = dirname(fileURLToPath(new URL("../fulfil-agent.mjs", import.meta.url)));
  const temp = mkdtempSync(join(tmpdir(), "fulfil-symlink-"));
  symlinkSync(skillDir, join(temp, "link"), "dir");
  for (const path of [join(skillDir, "fulfil-agent.mjs"), join(temp, "link", "fulfil-agent.mjs")]) {
    const output = await new Promise((resolve, reject) => {
      execFile(process.execPath, [path, "help"], { env: { PATH: process.env.PATH } }, (error, stdout) => {
        if (error) reject(error);
        else resolve(stdout);
      });
    });
    assert.ok(output.trim(), `No JSON from ${path}`);
    assert.equal(JSON.parse(output.trim()).ok, true);
    assert.equal(output.trim().split("\n").length, 1);
  }
});
