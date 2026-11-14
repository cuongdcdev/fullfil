import { describe, expect, it } from "vitest";
import { POPULAR_TOKENS, isStableSymbol } from "./popular-tokens";

describe("popular tokens", () => {
  it("has 6-8 unique entries, includes BLACKDRAGON first, and no stablecoins", () => {
    expect(POPULAR_TOKENS.length).toBeGreaterThanOrEqual(6);
    expect(POPULAR_TOKENS.length).toBeLessThanOrEqual(8);
    expect(POPULAR_TOKENS[0].symbol).toBe("BLACKDRAGON");
    const ids = POPULAR_TOKENS.flatMap((t) => t.ids);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of POPULAR_TOKENS) {
      expect(t.ids.length).toBeGreaterThan(0);
      expect(isStableSymbol(t.symbol)).toBe(false);
      for (const id of t.ids) expect(id).toMatch(/^[a-z0-9._-]{2,64}$/);
    }
    expect(["USDC", "USDT", "DAI", "USDt"].every(isStableSymbol)).toBe(true);
  });
});
