export const MIN_PRICE = BigInt(600_000);
const ceilPercent = (value: bigint, percent: bigint) =>
  (value * percent + BigInt(99)) / BigInt(100);

export type QuoteClients = {
  validateOrder: () => Promise<{ coin_amount: string }>;
  dryQuote: (amount: string) => Promise<{ amountIn: string; amountOut: string }>;
};

export function usdcUnits(decimal: string): bigint {
  if (!/^\d+(?:\.\d{1,6})?$/.test(decimal)) throw new Error("Invalid USDC price");
  const [whole, fraction = ""] = decimal.split(".");
  return BigInt(whole) * BigInt(1_000_000) + BigInt(fraction.padEnd(6, "0"));
}

export function calculateQuote(merchantPrice: bigint, amountIn: bigint, amountOut: bigint, now = Date.now()) {
  if (merchantPrice < MIN_PRICE) throw new Error("Merchant price below 0.6 USDC");
  const transferFee = amountIn > amountOut ? amountIn - amountOut : BigInt(0);
  const buffer = ceilPercent(merchantPrice, BigInt(2));
  const reward = [ceilPercent(merchantPrice, BigInt(5)), BigInt(50_000)]
    .reduce((a, b) => a > b ? a : b);
  const payAmount = merchantPrice + transferFee + buffer;
  return {
    merchant_price: merchantPrice.toString(),
    transfer_fee: transferFee.toString(),
    buffer: buffer.toString(),
    reward: reward.toString(),
    pay_amount: payAmount.toString(),
    total: (payAmount + reward).toString(),
    expires_at: new Date(now + 5 * 60_000).toISOString(),
    deadline_ns: String(BigInt(now + 30 * 60_000) * BigInt(1_000_000)),
  };
}

export async function quoteOrder(clients: QuoteClients, clock: () => number = Date.now) {
  const validated = await clients.validateOrder();
  const merchantPrice = usdcUnits(validated.coin_amount);
  if (merchantPrice < MIN_PRICE) throw new Error("Merchant price below 0.6 USDC");
  const swap = await clients.dryQuote(merchantPrice.toString());
  return calculateQuote(merchantPrice, BigInt(swap.amountIn), BigInt(swap.amountOut), clock());
}
