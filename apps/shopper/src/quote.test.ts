import { describe, expect, it } from "vitest";
import { calculateQuote, quoteOrder } from "./quote";

describe("shopper quote", () => {
  it("rejects prices below the merchant minimum", async () => {
    await expect(quoteOrder({ validateOrder: async () => ({ coin_amount: "0.599999" }), dryQuote: async () => ({ amountIn: "1", amountOut: "1" }) })).rejects.toThrow("below");
  });
  it("rounds buffer and reward up and applies the reward floor", () => {
    const quote = calculateQuote(600_001n, 610_000n, 600_000n, 1_000);
    expect(quote).toMatchObject({ merchant_price: "600001", transfer_fee: "10000", buffer: "12001", reward: "50000", pay_amount: "622002", total: "672002", expires_at: new Date(301_000).toISOString(), deadline_ns: "1801000000000" });
    expect(calculateQuote(2_000_001n, 2_000_001n, 2_000_001n).reward).toBe("100001");
  });
});
