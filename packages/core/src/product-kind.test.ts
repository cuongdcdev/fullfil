import { describe, expect, it } from "vitest";
import { codeHint, deliveryMatchesKind, productKind } from "./product-kind";

describe("Cryptorefills product kind", () => {
  it.each([
    "esim", "eSIM", "e-sim", "e_sim", "gift", "gift card", "gift_cards",
    "giftcards", "Giftcard", "voucher", "vouchers", "code", "codes",
    "PIN", "pins", "Mobile PIN", "prepaid card", "cards",
  ])("recognizes the code hint %s", (hint) => {
    expect(codeHint(hint)).toBe(true);
  });

  it.each(["Philippines", "Shopping", "Spinning", "Pinoy", "Cardinal"])(
    "does not treat %s as a code hint", (hint) => {
      expect(codeHint(hint)).toBe(false);
    });

  it.each([
    [{ category: "mobile_credits" }, "by_phone", "mobile_credits", "cryptorefills_topup"],
    [{ family: "Philippines" }, "by_phone", "mobile_data", "cryptorefills_topup"],
    [{ product_kind: "top-up" }, "by_phone", "Mobile Top Up", "cryptorefills_topup"],
    [{ product_type: "PIN" }, "by_phone", "mobile_credits", "cryptorefills_code"],
    [{ family: "eSIM" }, "by_phone", "mobile_data", "cryptorefills_code"],
    [{ denomination: "Gift Card 10" }, "by_phone", "mobile_credits", "cryptorefills_code"],
    [{ category: "mobile_credits" }, "by_email", "mobile_credits", "cryptorefills_code"],
    [{ product_kind: "top-up" }, "by_phone", "Shopping", "cryptorefills_code"],
    [{ product_kind: "top-up" }, "by_phone", "games", "cryptorefills_code"],
  ] as const)("classifies %j delivered %s in %s as %s", (product, delivery, category, kind) => {
    expect(productKind(product, delivery, category)).toBe(kind);
  });

  it("checks delivery, shared code hints, and supplied categories", () => {
    expect(deliveryMatchesKind("cryptorefills_topup", "by_email")).toBe(false);
    expect(deliveryMatchesKind("cryptorefills_code", "by_phone")).toBe(false);
    expect(deliveryMatchesKind("cryptorefills_topup", "by_phone",
      { family: "Philippines", denomination: "20000 PHP" })).toBe(true);
    expect(deliveryMatchesKind("cryptorefills_topup", "by_phone",
      { product: { product_type: "gift card" } })).toBe(false);
    expect(deliveryMatchesKind("cryptorefills_topup", "by_phone",
      { category: "mobile_data", family: "Pinoy" })).toBe(true);
    expect(deliveryMatchesKind("cryptorefills_topup", "by_phone",
      { category: "Shopping" })).toBe(false);
    expect(deliveryMatchesKind("cryptorefills_topup", "by_phone",
      { product: { category: "games" } })).toBe(false);
    expect(deliveryMatchesKind("cryptorefills_topup", "by_phone",
      ["Pinoy", "mobile_data"])).toBe(true);
    expect(deliveryMatchesKind("cryptorefills_topup", "by_phone",
      ["Mobile PIN"])).toBe(false);
    expect(deliveryMatchesKind("cryptorefills_code", "by_email")).toBe(true);
  });
});
