import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FIXTURE_ORDER_ID,
  V3Error,
  dialPrefix,
  formatCountdown,
  formatDecimalUsd,
  formatFaceValue,
  formatShopDenomination,
  formatShopSummary,
  formatUsd,
  fulfillerRating,
  normalizePhone,
  phonePlaceholder,
  setFetch,
  shopQuoteLines,
  shopTimeline,
  validEmail,
  v3,
} from "./v3-client";
import { fixtureFulfillers, fixtureQuote } from "./__fixtures__/shop";

afterEach(() => {
  setFetch(undefined);
  vi.unstubAllEnvs();
});

const response = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("shop inputs and presentation", () => {
  it("normalizes local and international phone numbers", () => {
    expect(dialPrefix("VN")).toBe("+84");
    expect(normalizePhone("0912 345 678", "VN")).toBe("+84912345678");
    expect(normalizePhone("+84 (912) 345-678", "VN")).toBe("+84912345678");
    expect(normalizePhone("415 555 0123", "US")).toBe("+14155550123");
    expect(normalizePhone("abc", "VN")).toBeUndefined();
    expect(normalizePhone("123", "VN")).toBeUndefined();
  });

  it("uses each country's own dial code and rejects other countries' numbers", () => {
    expect(dialPrefix("AU")).toBe("+61");
    expect(dialPrefix("TH")).toBe("+66");
    expect(dialPrefix("DE")).toBe("+49");
    expect(normalizePhone("0412 345 678", "AU")).toBe("+61412345678");
    expect(normalizePhone("081 234 5678", "TH")).toBe("+66812345678");
    expect(normalizePhone("0151 23456789", "DE")).toBe("+4915123456789");
    expect(normalizePhone("98765 43210", "IN")).toBe("+919876543210");
    expect(normalizePhone("0084 912 345 678", "VN")).toBe("+84912345678");
    // A Thai number must not be turned into +84 or accepted for a Vietnamese top-up.
    expect(normalizePhone("+66 81 234 5678", "VN")).toBeUndefined();
    expect(normalizePhone("+84 912 345 678", "AU")).toBeUndefined();
    // NANP shares +1: a Canadian (Toronto 416) number is not a US number.
    expect(normalizePhone("416 555 0199", "CA")).toBe("+14165550199");
    expect(normalizePhone("+1 416 555 0199", "US")).toBeUndefined();
  });

  it("shows a valid local sample number for every shop country", () => {
    for (const country of ["VN", "US", "AU", "GB", "CA", "DE", "FR", "ES", "PT", "IT", "AE", "IN", "ID", "PH", "TH", "SG"]) {
      const sample = phonePlaceholder(country);
      expect(sample, country).not.toBe("");
      expect(normalizePhone(sample, country), country).toMatch(/^\+\d+$/);
    }
  });

  it("formats face values consistently", () => {
    expect(formatFaceValue("50000", "VND")).toBe("50.000 ₫");
    expect(formatFaceValue("25", "USD")).toBe("$25");
    expect(formatFaceValue("25.5", "USD")).toBe("$25.5");
    expect(formatFaceValue("25", "EUR")).toBe("25 EUR");
    expect(formatShopDenomination("50,000 VND")).toBe("50,000 VND");
    expect(formatShopDenomination("50000 VND")).toBe("50,000 VND");
    expect(formatShopDenomination("25 USD")).toBe("25.00 USD");
    expect(formatShopDenomination("Travel pack")).toBe("Travel pack");
  });

  it("validates email and renders every price recipient", () => {
    expect(validEmail(" buyer@example.com ")).toBe(true);
    expect(validEmail("buyer@invalid")).toBe(false);
    expect(formatDecimalUsd("4.975")).toBe("$4.98");

    const quote = fixtureQuote({
      country: "VN",
      brand_name: "Viettel",
      denomination: "50000 VND",
      beneficiary: "+84912345678",
      buyer_email: "buyer@example.com",
    }).quote;
    const lines = shopQuoteLines(quote);

    expect(lines).toHaveLength(7);
    expect(lines[0].amount).toBe("50.000 ₫");
    expect(lines.map((line) => line.recipient)).toEqual([
      "Product",
      "Cryptorefills",
      "1Click network",
      "fulfiller (price-change cushion)",
      "fulfiller",
      "Fulfil",
      "You pay",
    ]);
    expect(lines.every((line) => line.explain.length > 0)).toBe(true);
    expect(lines.at(-1)?.amount).toMatch(/^\$\d+\.\d{2}$/);
    expect(lines.at(-1)?.amount).toBe("$2.14");
  });

  it("formats USDC base units with exact rounding", () => {
    expect(formatUsd("2140000")).toBe("$2.14");
    expect(formatUsd("1")).toBe("$0.00");
    expect(formatUsd("5000")).toBe("$0.01");
    expect(formatUsd("12345678901234567890")).toBe("$12,345,678,901,234.57");
    const usd = fixtureQuote({
      country: "US",
      brand_name: "Amazon",
      product_value: "25",
      beneficiary: "buyer@example.com",
      buyer_email: "buyer@example.com",
    });
    expect(usd.quote.fx_usd).toBe("25000000");
    expect(usd.spec).toMatchObject({
      beneficiary_hash: expect.any(String),
      delivery_type: "by_email",
      denomination: "",
      product_value: "25",
      v: 1,
    });
    expect(shopQuoteLines(usd.quote)[0].amount).toBe("$25 (about $25.00)");
  });

  it("formats a range order and reads nested fulfiller ratings", () => {
    expect(formatShopSummary({
      brand: "Amazon", product_value: "25", masked_beneficiary: "••••",
    })).toBe("$25");
    expect(formatShopSummary({
      brand: "Viettel", denomination: "", product_value: "50000", masked_beneficiary: "••••",
    }, "VND")).toBe("50.000 ₫");
    expect(fulfillerRating(fixtureFulfillers()[0])).toBe(4.9);
    expect(fulfillerRating({ ...fixtureFulfillers()[0], profile: null })).toBeNull();
  });

  it("formats expiry and all timeline states", () => {
    expect(formatCountdown("2026-01-01T00:05:00Z", Date.parse("2026-01-01T00:00:00Z"))).toBe("5:00");
    expect(formatCountdown("2026-01-01T00:00:00Z", Date.parse("2026-01-01T00:05:00Z"))).toBe("0:00");
    const statuses = {
      funded: [1, false],
      claimed: [1, false],
      sent: [2, false],
      verifying: [2, false],
      proof_rejected: [2, false],
      verified: [2, false],
      under_review: [2, false],
      paid: [4, true],
      closed: [4, true],
      cancelled: [0, true],
      expired: [0, true],
      disputed: [2, false],
      resolved: [2, true],
    } as const;
    for (const [status, [step, terminal]] of Object.entries(statuses)) {
      expect(shopTimeline(status as keyof typeof statuses)).toMatchObject({ step, terminal });
    }
    expect(shopTimeline("future_status" as "funded")).toMatchObject({ step: 2, terminal: false });
  });
});

describe("development fixtures", () => {
  it("uses fixtures only for missing shop routes", async () => {
    setFetch((async () => response(404, { error: { code: "missing", message: "Missing" } })) as typeof fetch);

    expect((await v3.shopCountries())[0].code).toBe("VN");
    expect((await v3.shopCatalog("VN")).categories[0].brands[0].slug).toBe("viettel");
    expect((await v3.shopBrand("VN", "viettel")).variants[0].products).toHaveLength(6);
    expect((await v3.shopPopular("VN"))[0].brand_name).toBe("Viettel");
    expect((await v3.shopQuote({
      country: "VN",
      brand_name: "Viettel",
      denomination: "50000 VND",
      beneficiary: "+84912345678",
      buyer_email: "buyer@example.com",
    })).fixture).toBe(true);
    expect((await v3.order(FIXTURE_ORDER_ID)).order.fulfiller_listed).toBe(false);
    expect(await v3.fulfillers()).toHaveLength(2);
  });

  it("does not replace an unrelated missing order", async () => {
    setFetch((async () => response(404, { error: { code: "not_found", message: "Order not found" } })) as typeof fetch);
    await expect(v3.order("REAL-MISSING-ORDER")).rejects.toMatchObject({
      code: "not_found",
      status: 404,
      message: "Order not found",
    });
  });

  it("keeps other failures visible", async () => {
    setFetch((async () => response(503, { error: { code: "unavailable", message: "Try later" } })) as typeof fetch);
    await expect(v3.shopCountries()).rejects.toMatchObject({ status: 503 });

    setFetch((async () => response(401, { error: { code: "session", message: "Log in" } })) as typeof fetch);
    await expect(v3.shopQuote({
      country: "VN",
      brand_name: "Viettel",
      beneficiary: "a",
      buyer_email: "a@b.com",
    })).rejects.toBeInstanceOf(V3Error);
  });

  it("does not use fixtures in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    setFetch((async () => response(404, { error: { code: "missing", message: "Missing" } })) as typeof fetch);
    await expect(v3.shopCountries()).rejects.toMatchObject({ status: 404 });
    await expect(v3.order(FIXTURE_ORDER_ID)).rejects.toMatchObject({ status: 404 });
  });

  it("prefers live API data", async () => {
    setFetch((async () => response(200, [{ code: "SG", name: "Singapore", brand_count: 1 }])) as typeof fetch);
    expect((await v3.shopCountries())[0].code).toBe("SG");
  });
});
