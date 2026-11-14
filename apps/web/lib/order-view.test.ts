import { describe, expect, it } from "vitest";
import { fixtureOrder } from "./__fixtures__/shop";
import { detailPathFor, orderTitle, showsVnd, timelineFor } from "./order-view";
import { formatUsd, orderTotal, type OrderStatus } from "./v3-client";
import { describe as describeWalletError } from "./wallet/near";

describe("order detail presentation", () => {
  it("routes known kinds and keeps legacy orders on the bank page", () => {
    expect(detailPathFor({ id: "one" })).toBe("/pay/one");
    expect(detailPathFor({ id: "one", kind: "bank_transfer" })).toBe("/pay/one");
    expect(detailPathFor({ id: "one", kind: "in_person" })).toBe("/shop/orders/one");
    expect(detailPathFor({ id: "one", kind: "token_buy" })).toBe("/shop/orders/one");
    expect(showsVnd("bank_transfer")).toBe(true);
    expect(showsVnd("in_person")).toBe(false);
    expect(showsVnd("token_buy")).toBe(false);
    expect(showsVnd("cryptorefills_topup")).toBe(false);
  });

  it("maps each kind through its own timeline", () => {
    expect(timelineFor("bank_transfer", "paid")).toMatchObject({ steps: ["Paid", "Local found", "Shop paid", "Done"], step: 4, done: true });
    expect(timelineFor("in_person", "paid")).toMatchObject({ steps: ["Paid", "Helper accepted", "Handed over (QR receipt)", "Verified", "Done"], step: 5, done: true });
    expect(timelineFor("in_person", "verified").step).toBe(4);
    expect(timelineFor("token_buy", "verified")).toMatchObject({ steps: ["Paid", "Agent bought token", "OutLayer verified", "Done"], step: 3, done: false });
    expect(timelineFor("cryptorefills_topup", "paid")).toMatchObject({ steps: ["Paid", "Purchased", "Verified", "Delivered"], step: 4, done: true });
    expect(timelineFor("cryptorefills_code", "paid").step).toBe(4);
    for (const status of ["cancelled", "expired", "resolved"] as OrderStatus[]) {
      expect(timelineFor("in_person", status).terminal).toBe(true);
    }
    expect(timelineFor("token_buy", "under_review").terminal).toBe(false);
  });

  it("shows an in-person receipt in dollars even when VND is zero", () => {
    const order = fixtureOrder("DEV-INPERSON-1").order;
    expect(order).toMatchObject({ kind: "in_person", status: "paid", amount_vnd: 0, fulfiller: "fullfiller1.near" });
    expect(orderTitle(order)).toBe("Phở bò takeaway");
    expect(formatUsd(order.pay_amount)).toBe("$1.00");
    expect(formatUsd(order.reward)).toBe("$0.05");
    expect(formatUsd(orderTotal(order))).toBe("$1.05");
    expect(orderTitle(fixtureOrder("DEV-TOKEN-1").order)).toBe("20 DEMO");
    expect(orderTitle(fixtureOrder("DEV-SHOP-1").order)).toContain("Viettel");
    expect(orderTitle(fixtureOrder("DEV-CODE-1").order)).toContain("Demo gift card");
  });
});

describe("NEAR wallet errors", () => {
  it("turns missing accounts into a connect request without leaking library text", () => {
    const error = describeWalletError(new Error("No accounts found"));
    expect(error.message).toBe("Connect your wallet to continue.");
    expect(error.needsConnect).toBe(true);
    expect(describeWalletError(new Error("opaque connector failure")).message).toBe("Your wallet could not do that. Try again.");
    expect(describeWalletError(new Error("request timeout")).message).toBe("Your wallet took too long. Try again.");
  });
});
