import { createHash } from "node:crypto";

export const MOCK_VND_PER_USD = 25_400;
export const PAY_WITH = ["USDC", "NEAR", "ZEC", "BTC"] as const;
export type PayWith = (typeof PAY_WITH)[number];
export type FxQuote = {
  vndPerUsd: number;
  source: "mock" | "coingecko" | "mock-fallback";
  at: string;
};
const browserUserAgent =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

/** VND per USD. Fixed mock rate unless FX_SOURCE=coingecko (public endpoint, no key, mock fallback). */
export async function getFxQuote(): Promise<FxQuote> {
  const at = new Date().toISOString();
  if ((process.env.FX_SOURCE || "").toLowerCase() !== "coingecko")
    return { vndPerUsd: MOCK_VND_PER_USD, source: "mock", at };
  try {
    const response = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=vnd",
      {
        headers: { "User-Agent": browserUserAgent, Accept: "application/json" },
        signal: AbortSignal.timeout(3000),
      },
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const rate = Number(
      ((await response.json()) as { tether?: { vnd?: number } }).tether?.vnd,
    );
    if (!Number.isFinite(rate) || rate < 10_000 || rate > 100_000)
      throw new Error("Implausible rate");
    return { vndPerUsd: Math.round(rate), source: "coingecko", at };
  } catch {
    return { vndPerUsd: MOCK_VND_PER_USD, source: "mock-fallback", at };
  }
}

// Mock USD prices for the NEAR Intents funding quote. Not market data.
const mockUsdPrice: Record<PayWith, number> = {
  USDC: 1,
  NEAR: 3.2,
  ZEC: 48,
  BTC: 95_000,
};
export type IntentsFundingQuote = {
  payWith: PayWith;
  payAmount: number;
  usdPrice: number;
  intentId: string;
  mock: true;
};
export function mockIntentsFunding(
  payWith: PayWith,
  usd: number,
  orderId: string,
): IntentsFundingQuote {
  if (!PAY_WITH.includes(payWith)) throw new Error("Unsupported payWith token");
  const usdPrice = mockUsdPrice[payWith];
  return {
    payWith,
    payAmount: Math.ceil((usd / usdPrice) * 1e6) / 1e6,
    usdPrice,
    intentId: `mock-intent-${createHash("sha256").update(orderId).digest("hex").slice(0, 12)}`,
    mock: true,
  };
}
