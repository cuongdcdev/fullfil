import { describe, expect, it } from "vitest";
import { OneClickError, quoteError, topupTokenList } from "./service";

describe("topupTokenList", () => {
  it("keeps plain-address chains and drops memo-only chains and bad rows", () => {
    const list = topupTokenList([
      { assetId: "nep141:sol.omft.near", symbol: "SOL", blockchain: "sol", decimals: 9, price: 150 },
      { assetId: "nep245:v2_1.omni.hot.tg:1100_x", symbol: "USDC", blockchain: "stellar", decimals: 7, price: 1 },
      { assetId: "1cs_v1:weird", symbol: "X", blockchain: "near", decimals: 6 },
      { assetId: "nep141:a.near", symbol: "A", blockchain: "near", decimals: "nope" },
      { assetId: "nep141:b.near", symbol: "B", blockchain: "near", decimals: 18, price: 0, coingeckoId: "bee" },
    ]);
    expect(list).toEqual([
      { assetId: "nep141:sol.omft.near", symbol: "SOL", blockchain: "sol", decimals: 9, price: 150, coingeckoId: undefined },
      { assetId: "nep141:b.near", symbol: "B", blockchain: "near", decimals: 18, price: undefined, coingeckoId: "bee" },
    ]);
    expect(topupTokenList({ error: "x" })).toEqual([]);
  });
});

describe("quoteError", () => {
  it("explains refused quotes in plain words", () => {
    const btc = { symbol: "BTC", decimals: 8 };
    expect(quoteError(new OneClickError(400, { message: "Amount is too low for bridge, try at least 6400" }), btc).message)
      .toBe("This amount is too small. Please use at least 0.000064 BTC.");
    expect(quoteError(new OneClickError(400, { message: "No liquidity available" }), { symbol: "ADA", decimals: 6 }).message)
      .toMatch(/^We can't swap this amount of ADA right now\. Try a bigger amount/);
    const other = new Error("network down");
    expect(quoteError(other)).toBe(other);
    const server = new OneClickError(500, { message: "boom" });
    expect(quoteError(server)).toBe(server);
  });
});
