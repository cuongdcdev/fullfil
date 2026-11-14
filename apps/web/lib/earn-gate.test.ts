import { describe, expect, it } from "vitest";
import { bankOptions, hasDeposit, isLast4, isRegisteredFulfiller, registeredBank } from "./earn-gate";
import type { Me } from "./v3-client";

const view = (inner: NonNullable<Me["profile"]>["profile"]): Me => ({
  account: "a.near", intents_balances: {}, approved: false,
  profile: {
    account_id: "a.near", profile: inner, stats: { jobs_done: 0 }, level: 0,
    rating: { star_sum: 0, star_count: 0, avg: null }, bond: { available: "0", locked: "0" }, approved: false,
  },
});

describe("earn gate", () => {
  it("treats the always-present outer profile object as unregistered", () => {
    expect(isRegisteredFulfiller(view(null))).toBe(false);
    expect(isRegisteredFulfiller({ profile: null })).toBe(false);
    expect(isRegisteredFulfiller(null)).toBe(false);
  });
  it("is registered once the inner record exists, even delivery-only", () => {
    const deliveryOnly = view({ bank_bin: "", account_last4: "", registered_at: "1" });
    expect(isRegisteredFulfiller(deliveryOnly)).toBe(true);
    expect(registeredBank(deliveryOnly)).toBeNull();
    const bank = view({ bank_bin: "970432", account_last4: "1234", registered_at: "1" });
    expect(registeredBank(bank)).toEqual({ bin: "970432", name: "VPBank", last4: "1234" });
  });
  it("hides demo banks outside demo mode", () => {
    expect(bankOptions(false).map((b) => b.name)).toEqual(["VPBank"]);
    expect(bankOptions(true).length).toBeGreaterThan(1);
  });
  it("validates last 4 digits and deposits", () => {
    expect(isLast4("0123")).toBe(true);
    expect(isLast4("123")).toBe(false);
    expect(hasDeposit({ available: "0", locked: "0" })).toBe(false);
    expect(hasDeposit({ available: "0", locked: "5" })).toBe(true);
  });
});
