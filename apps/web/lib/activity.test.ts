import { describe, expect, it } from "vitest";
import { activityDate, activityHref, activityKind, activityStatus, activityTitle } from "./activity";
import type { V3Order } from "./v3-client";

const base: V3Order = {
  id: "FUL-123", buyer: "buyer.near", token: "usdc", pay_amount: "2000000", reward: "1000000",
  amount_vnd: 120000, merchant_hash: "hash", deadline_ns: "0", status: "funded",
  created_at: "2026-11-10T10:00:00.000Z",
};
const order = (patch: Partial<V3Order> = {}) => ({ ...base, ...patch });

describe("activity order display", () => {
  it("groups legacy QR and all newer order kinds", () => {
    expect(activityKind(order({ kind: undefined }))).toBe("local_qr");
    expect(activityKind(order({ kind: "bank_transfer" }))).toBe("local_qr");
    expect(activityKind(order({ kind: "in_person" }))).toBe("nearby");
    expect(activityKind(order({ kind: "cryptorefills_code" }))).toBe("online");
    expect(activityKind(order({ kind: "cryptorefills_topup" }))).toBe("online");
    expect(activityKind(order({ kind: "token_buy" }))).toBe("memecoin");
  });

  it("uses safe list summaries for titles", () => {
    expect(activityTitle(base)).toBe("QR payment · 120.000 ₫");
    expect(activityTitle(order({ kind: "in_person", spec_summary: { brand: "A bicycle", masked_beneficiary: "••••" } }))).toBe("A bicycle");
    expect(activityTitle(order({ kind: "cryptorefills_code", spec_summary: { brand: "Steam", denomination: "10 USD", masked_beneficiary: "••••" } }))).toBe("Steam 10.00 USD gift card");
    const token = order({ kind: "token_buy", amount_vnd: 0 }) as V3Order & { buy_token: unknown; spec: unknown };
    token.buy_token = { account_id: "token.near", symbol: "BLACKDRAGON", decimals: 6, price_usd: 0.1 };
    token.spec = { amount_out: "50000000", receiver: "buyer.near", token_contract: "token.near" };
    expect(activityTitle(token)).toBe("50 BLACKDRAGON");
    expect(activityTitle(order({ kind: "token_buy" }))).toBe("Token order");
  });

  it("maps statuses and role wording", () => {
    expect(activityStatus(order(), "buying")).toEqual({ label: "Waiting for a helper", tone: "warn" });
    expect(activityStatus(order({ status: "claimed" }), "earning").label).toBe("Your turn: pay the shop");
    expect(activityStatus(order({ kind: "token_buy", status: "verifying" }), "buying").label).toContain("OutLayer (an independent checker)");
    expect(activityStatus(order({ status: "resolved", verdict: "buyer" }), "buying").label).toBe("Refunded");
    expect(activityStatus(order({ status: "resolved", verdict: "fulfiller" }), "buying").label).toBe("Review complete");
    expect(activityStatus(order({ status: "paid" }), "earning").label).toBe("Paid to you");
    expect(activityStatus(order({ status: "under_review" }), "buying").label).toBe("Being reviewed");
  });

  it("links to the correct detail screens", () => {
    expect(activityHref(base)).toBe("/pay/FUL-123");
    expect(activityHref(base, "earning")).toBe("/earn/active?job=FUL-123");
    expect(activityHref(order({ kind: "in_person" }), "earning")).toBe("/earn/active?job=FUL-123");
    expect(activityHref(order({ kind: "in_person" }))).toBe("/shop/orders/FUL-123");
    for (const kind of ["cryptorefills_code", "cryptorefills_topup", "token_buy"]) {
      expect(activityHref(order({ kind }), "earning")).toBe("/shop/orders/FUL-123");
    }
  });

  it("formats ISO and nanosecond dates and hides missing dates", () => {
    const now = Date.parse("2026-11-10T12:00:00.000Z");
    expect(activityDate(base, now)?.relative).toBe("2 h ago");
    expect(activityDate(order({ created_at: "1794304800000000000" }), now)?.relative).toBe("2 h ago");
    expect(activityDate(order({ created_at: undefined, claimed_at: "2026-11-10T11:59:30.000Z" }), now)?.relative).toBe("just now");
    expect(activityDate(order({ created_at: undefined }), now)).toBeUndefined();
  });
});
