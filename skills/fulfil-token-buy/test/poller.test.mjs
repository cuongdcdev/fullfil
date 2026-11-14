import assert from "node:assert/strict";
import test from "node:test";
import { deliveryEvidence, shouldAutoRelease, shouldWithdraw } from "../examples/zeroclaw/poller-lib.mjs";

test("poller releases only an abandoned owned claim without delivery", () => {
  const account = "agent.near";
  const status = { ok: true, order_id: "FUL-1", status: "claimed", fulfiller: account, delivery_tx_hash: null };
  assert.equal(shouldAutoRelease({ run: { timed_out: true, exit_code: 0, report: { result: "paid" } }, status, account }), false);
  assert.equal(shouldAutoRelease({ run: { timed_out: false, exit_code: 1 }, status, account }), true);
  assert.equal(shouldAutoRelease({ run: { timed_out: false, exit_code: 0, report: { result: "error" } }, status, account }), true);
  assert.equal(shouldAutoRelease({ run: { timed_out: false, exit_code: 0, report: { result: "paid" } }, status, account }), false);
  for (const changed of [
    { delivery_tx_hash: "delivery" }, { fulfiller: "other.near" }, { ok: false },
    { status: "paid" }, { status: "proof_rejected" },
  ]) assert.equal(shouldAutoRelease({ run: { timed_out: true }, status: { ...status, ...changed }, account }), false);
});

test("delivery evidence recognizes deliver result, invocation and cautious reports", () => {
  const delivered = JSON.stringify({ ok: true, order_id: "FUL-1", tx_hash: "transfer-hash",
    receiver: "buyer.near", amount: "100", storage_deposit: "0" });
  assert.equal(deliveryEvidence(`claim FUL-1\n${delivered}`, null, "FUL-1"), true);
  assert.equal(deliveryEvidence(delivered, null, "FUL-2"), false);
  assert.equal(deliveryEvidence("node /skill/fulfil-agent.mjs deliver FUL-1", null, "FUL-1"), true);
  assert.equal(deliveryEvidence("deliver FUL-1", null, "FUL-1"), true);
  assert.equal(deliveryEvidence("deliver FUL-12", null, "FUL-1"), false);
  assert.equal(deliveryEvidence("claim FUL-1\nbuy FUL-1\n{\"ok\":true,\"tx_hashes\":[\"swap\"]}", null, "FUL-1"), false);
  assert.equal(deliveryEvidence("", { result: "paid" }, "FUL-1"), true);
  assert.equal(deliveryEvidence("", { result: "error", tx_hashes: ["possible-delivery"] }, "FUL-1"), true);
  assert.equal(deliveryEvidence("", { result: "skipped", tx_hashes: ["swap"] }, "FUL-1"), false);
});

test("poller never auto-releases when output may show delivery before prove", () => {
  const account = "agent.near";
  const status = { ok: true, order_id: "FUL-1", status: "claimed", fulfiller: account, delivery_tx_hash: null };
  const failed = { timed_out: true, exit_code: 1, report: { result: "error" } };
  const delivered = JSON.stringify({ ok: true, order_id: "FUL-1", tx_hash: "transfer-hash",
    receiver: "buyer.near", storage_deposit: "0" });
  assert.equal(shouldAutoRelease({ run: { ...failed, output: delivered }, status, account }), false);
  assert.equal(shouldAutoRelease({ run: { ...failed, output: "node fulfil-agent.mjs deliver FUL-1" }, status, account }), false);
  assert.equal(shouldAutoRelease({ run: { ...failed, output: "claim FUL-1\nbuy FUL-1" }, status, account }), true);
  assert.equal(shouldAutoRelease({ run: { ...failed, output: "", output_truncated: true }, status, account }), false);
});

test("poller withdraws only when wallet is below threshold and intents has USDC", () => {
  const balances = { ok: true, wallet_usdc: "1499999", intents_usdc: "1" };
  assert.equal(shouldWithdraw(balances, "1500000"), true);
  assert.equal(shouldWithdraw({ ...balances, wallet_usdc: "1500000" }, "1500000"), false);
  assert.equal(shouldWithdraw({ ...balances, intents_usdc: "0" }, "1500000"), false);
  assert.equal(shouldWithdraw({ ...balances, ok: false }, "1500000"), false);
  assert.equal(shouldWithdraw({ ...balances, wallet_usdc: "bad" }, "1500000"), false);
});
