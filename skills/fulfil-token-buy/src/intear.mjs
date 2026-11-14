import { decimal, fail, USER_AGENT, USDC_CONTRACT } from "./common.mjs";

export const TOKEN_IN = `nep141:${USDC_CONTRACT}`;

export function quoteProfit(order, quote, minProfit = "0") {
  const pay = decimal(order.pay_amount, "pay_amount");
  const reward = decimal(order.reward, "reward");
  const fee = decimal(quote.fee_amount ?? "0", "fee_amount");
  const input = decimal(quote.worst_case_amount?.amount_in, "worst_case_amount.amount_in") + fee;
  const estimated = decimal(quote.estimated_amount?.amount_in, "estimated_amount.amount_in") + fee;
  const profit = pay + reward - input;
  return {
    usdc_in: input.toString(), estimated_usdc_in: estimated.toString(),
    income_usdc: (pay + reward).toString(), profit_usdc: profit.toString(),
    profitable: profit >= decimal(minProfit, "FULFIL_MIN_PROFIT_USDC"),
    near_costs: {
      route_storage_deposits: String(quote.storage_deposits ?? "0"),
      route_estimated_gas: String(quote.estimated_gas_usage ?? "0"),
      receiver_storage_if_unregistered: "1250000000000000000000",
      delivery_gas: "30000000000000 gas units estimated",
    },
  };
}

export class IntearRouter {
  constructor({ fetchImpl = fetch, baseUrl = "https://router.intear.tech", slippage = "0.03" } = {}) {
    if (!/^(0|1)(\.\d{1,6})?$/.test(slippage)) fail("invalid_config", "Invalid FULFIL_SLIPPAGE");
    const [whole, fraction = ""] = slippage.split(".");
    const millionths = BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, "0") || "0");
    if (millionths > 100_000n) fail("invalid_config", "FULFIL_SLIPPAGE exceeds 10%");
    this.fetch = fetchImpl;
    this.baseUrl = baseUrl;
    this.slippage = slippage;
  }

  async get(path, params) {
    const url = new URL(path, this.baseUrl);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    const response = await this.fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!response.ok) fail("router_http", `Intear router returned HTTP ${response.status}`);
    return response.json();
  }

  async quote(spec, accountId) {
    const tokenOut = `nep141:${spec.token_contract}`;
    const quotes = await this.get("/route", {
      token_in: TOKEN_IN, token_out: tokenOut, amount_out: spec.amount_out,
      slippage_type: "Fixed", slippage: this.slippage, trader_account_id: accountId,
    });
    if (!Array.isArray(quotes)) fail("invalid_route", "Intear route response is not an array");
    const valid = quotes.filter((quote) => quote?.token_output === tokenOut &&
      quote.worst_case_amount?.amount_in !== undefined &&
      Array.isArray(quote.execution_instructions));
    if (!valid.length) fail("no_route", "No deliverable exact-output route");
    valid.sort((a, b) => {
      const x = decimal(a.worst_case_amount.amount_in, "route amount");
      const y = decimal(b.worst_case_amount.amount_in, "route amount");
      return x < y ? -1 : x > y ? 1 : 0;
    });
    return valid[0];
  }

  async outcome(spec, accountId, txHashes, feeAmount = "0") {
    return this.get("/route/outcome", {
      token_in: TOKEN_IN, token_out: `nep141:${spec.token_contract}`,
      trader_account_id: accountId, tx_hashes: txHashes.join(","), fee_amount: feeAmount,
    });
  }
}

export function parseInstructions(instructions) {
  if (!Array.isArray(instructions) || !instructions.length) fail("invalid_route", "Route has no instructions");
  return instructions.map((instruction) => {
    if (!instruction || Object.keys(instruction).join() !== "NearTransaction") fail("unsupported_instruction", "Unsupported route instruction");
    const tx = instruction.NearTransaction;
    if (!tx || typeof tx.receiver_id !== "string" || !Array.isArray(tx.actions) || !tx.actions.length) {
      fail("invalid_route", "Invalid NearTransaction instruction");
    }
    const actions = tx.actions.map((action) => {
      if (action?.FunctionCall && Object.keys(action).join() === "FunctionCall") {
        const call = action.FunctionCall;
        if (typeof call.method_name !== "string" || typeof call.args !== "string") fail("invalid_route", "Invalid FunctionCall");
        const args = Buffer.from(call.args, "base64");
        if (args.toString("base64") !== call.args) fail("invalid_route", "Invalid base64 arguments");
        return { type: "FunctionCall", methodName: call.method_name, args,
          gas: decimal(call.gas, "gas", (1n << 64n) - 1n), deposit: decimal(call.deposit, "deposit") };
      }
      if (action?.Transfer && Object.keys(action).join() === "Transfer") {
        return { type: "Transfer", deposit: decimal(action.Transfer.deposit, "deposit") };
      }
      fail("unsupported_action", "Unsupported route action");
    });
    return { receiverId: tx.receiver_id, actions, isFee: tx.is_fee_transaction === true };
  });
}
