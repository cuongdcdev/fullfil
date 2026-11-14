import assert from "node:assert/strict";
import test from "node:test";
import { IntearRouter, parseInstructions, TOKEN_IN } from "../src/intear.mjs";

test("Intear exact-output request uses NEP-141 IDs and selects lowest worst-case input", async () => {
  const seen = [];
  const quote = (amount) => ({ dex_id: amount === "7" ? "Rhea" : "Plach",
    estimated_amount: { amount_in: amount }, worst_case_amount: { amount_in: amount },
    token_output: "nep141:token.near", execution_instructions: [{ NearTransaction: {
      receiver_id: "usdc.near", actions: [{ FunctionCall: { method_name: "ft_transfer_call", args: "e30=", gas: 10000000000000, deposit: "1" } }],
      is_fee_transaction: false,
    } }] });
  const router = new IntearRouter({ fetchImpl: async (url) => {
    seen.push(new URL(url));
    return Response.json([quote("7"), quote("5")]);
  } });
  const route = await router.quote({ token_contract: "token.near", amount_out: "100" }, "agent.near");
  assert.equal(route.dex_id, "Plach");
  assert.equal(seen[0].searchParams.get("token_in"), TOKEN_IN);
  assert.equal(seen[0].searchParams.get("token_out"), "nep141:token.near");
  assert.equal(seen[0].searchParams.get("amount_out"), "100");
  assert.equal(seen[0].searchParams.get("trader_account_id"), "agent.near");
  assert.equal(parseInstructions(route.execution_instructions)[0].actions[0].methodName, "ft_transfer_call");
  assert.throws(() => parseInstructions([{ EvmTransaction: {} }]), { code: "unsupported_instruction" });
  assert.throws(() => parseInstructions([{ NearTransaction: { receiver_id: "x", actions: [{ Delegate: {} }] } }]), { code: "unsupported_action" });
});
