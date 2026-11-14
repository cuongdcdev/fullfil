import { describe, expect, it } from "vitest";
import { shopperLimits } from "./limits";

describe("shopper spending limits", () => {
  it("defaults to 5 USDC per order, zero reserve, and 15 minutes to claim", () => {
    expect(shopperLimits()).toEqual({
      maxUsdc: 5_000_000n, reserveUsdc: 0n, minTimeLeftMs: 900_000,
    });
  });

  it("parses a reserve in USDC base units and rejects invalid values", () => {
    expect(shopperLimits("3", "1.25"))
      .toEqual({ maxUsdc: 3_000_000n, reserveUsdc: 1_250_000n,
        minTimeLeftMs: 900_000 });
    expect(() => shopperLimits("5", "-1")).toThrow();
    expect(() => shopperLimits("5", "0.0000001")).toThrow();
    expect(() => shopperLimits("0", "0")).toThrow();
  });

  it("accepts only a positive safe integer minimum time in milliseconds", () => {
    expect(shopperLimits("5", "0", "600000").minTimeLeftMs).toBe(600_000);
    for (const input of ["", "0", "-1", "1.5", "1e3", "9007199254740992"]) {
      expect(() => shopperLimits("5", "0", input)).toThrow(
        "Invalid shopper minimum time left");
    }
  });
});
