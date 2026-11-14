import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.FULFIL_MODE = "mock";
  process.env.DATABASE_URL = `file:/tmp/fulfil-shop-hardening-${process.pid}.db`;
});

import { get, put, remove } from "../../apps/web/lib/server/db";
import {
  brandVariantsFromMcp,
  catalogBlocked,
  catalogFromBrands,
  listingSlug,
  resetCatalogBreaker,
  retryCatalogCall,
  shopBrand,
  shopCatalog,
  shopCountries,
  shopEstimate,
  shopPopular,
  popularFromCatalog,
  shopQuote,
  productKind,
  esimLabel,
  ShopUpstreamError,
  ShopNotFoundError,
} from "../../apps/web/lib/server/v3/shop";
import { GET, POST } from "../../apps/web/lib/server/v3/handler";
import { cookieHeader } from "../../apps/web/lib/server/v3/auth";
import { rankBrands } from "../../apps/web/lib/shop-search";
import { quoteOrder } from "../../apps/shopper/src/quote";
import esimSample from "../fixtures/cryptorefills-esim-sample.json";
import { formatShopDenomination } from "../../apps/web/lib/v3-client";
import { HttpError } from "../../apps/shopper/src/diagnostics";
import { brandFn, variantsByCategory as catalogFromMcp } from "./shop-helpers";

const brands = { categories: [{ category: "mobile_credits", brands: [
  { brand: "Viettel", family: "mobile", delivery_type: "by_phone" },
] }] };
const products = { products: [{ brand_name: "Viettel", denomination: "20000 VND",
  coin_amount: "1", delivery_type: "by_phone" }] };
const context = (path: string) => ({ params: Promise.resolve({ path: path.split("/") }) });

describe("shop hardening", () => {
  it("rejects a live range phone product listed as eSIM when its row has no category", async () => {
    const previousMode = process.env.FULFIL_MODE;
    const previousShopper = process.env.SHOPPER_ACCOUNT_ID;
    process.env.FULFIL_MODE = "live";
    process.env.SHOPPER_ACCOUNT_ID = "shopper.test";
    remove("v3:catalog:v3:live:US");
    const listing = { categories: [{ category: "e-sim", brands: [
      { brand: "Travel eSIM", family: "travel", delivery_type: "by_phone" },
    ] }] };
    const groups = [{ family: "travel", brand: "Travel eSIM", products: [{
      kind: "mobile_topup", is_dynamic: true, denomination: "range",
      range: { min: "5", max: "20", currency: "USD" },
      coin_amount: "5", coin: "USDC", delivery_type: "by_phone",
    }] }];
    const listBrands = vi.fn(async () => listing);
    const listProducts = vi.fn(async () => groups);
    const validateOrder = vi.fn(async () => ({ coin_amount: "5" }));
    const quote = vi.fn(async () => ({ amountIn: "5050000", amountOut: "5000000" }));
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      result: { result: [...Buffer.from(JSON.stringify("00000000"))] },
    })));
    try {
      expect(catalogFromMcp("US", listing, groups).categories).toEqual([]);
      await expect(shopQuote(
        { account_id: "buyer.test", standard: "nep413", exp: Date.now() + 60_000 },
        { country: "US", brand_name: "Travel eSIM", product_value: "10",
          beneficiary: "+14155550123", buyer_email: "buyer@example.com" },
        { cryptorefills: { listBrands, listProducts, validateOrder } as never,
          oneClick: { quote } as never, clock: () => 1_800_000_000_000 },
      )).rejects.toBeInstanceOf(ShopNotFoundError);
      expect(validateOrder).not.toHaveBeenCalled();
    } finally {
      fetchMock.mockRestore();
      process.env.FULFIL_MODE = previousMode;
      process.env.SHOPPER_ACCOUNT_ID = previousShopper;
    }
  });

  it("uses the catalog category and slug for a live mobile range quote", async () => {
    const previousMode = process.env.FULFIL_MODE;
    const previousShopper = process.env.SHOPPER_ACCOUNT_ID;
    process.env.FULFIL_MODE = "live";
    process.env.SHOPPER_ACCOUNT_ID = "shopper.test";
    remove("v3:catalog:v3:live:US");
    const listing = { categories: [{ category: "mobile_credits", brands: [
      { brand: "Flexible Mobile", family: "mobile", delivery_type: "by_phone" },
    ] }] };
    const groups = [{ family: "mobile", brand: "Flexible Mobile", products: [{
      kind: "mobile_topup", is_dynamic: true, denomination: "range",
      range: { min: "5", max: "20", currency: "USD" },
      coin_amount: "5", coin: "USDC", delivery_type: "by_phone",
    }] }];
    const catalog = catalogFromMcp("US", listing, groups);
    const brand = catalog.categories[0].brands[0];
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      result: { result: [...Buffer.from(JSON.stringify("00000000"))] },
    })));
    try {
      const quote = (beneficiary: string) => shopQuote(
        { account_id: "buyer.test", standard: "nep413", exp: Date.now() + 60_000 },
        { country: "US", brand_name: "Flexible Mobile", brand_slug: brand.slug,
          product_value: "10", beneficiary, buyer_email: "buyer@example.com" },
        { cryptorefills: { listBrands: async () => listing, listProducts: async () => groups,
          validateOrder: async () => ({ coin_amount: "5" }) } as never,
          oneClick: { quote: async () => ({ amountIn: "5050000", amountOut: "5000000" }) } as never,
          clock: () => 1_800_000_000_000 },
      );
      // A US top-up cannot be sent to a Vietnamese or Canadian number.
      await expect(quote("+84912345678")).rejects.toThrow("valid United States number");
      await expect(quote("+14165550199")).rejects.toThrow("valid United States number");
      const result = await quote("+14155550123");
      expect(brand.kind).toBe("cryptorefills_topup");
      expect(result.kind).toBe(brand.kind);
    } finally {
      fetchMock.mockRestore();
      process.env.FULFIL_MODE = previousMode;
      process.env.SHOPPER_ACCOUNT_ID = previousShopper;
    }
  });

  it("allows topup kind only for exact phone delivery in a mobile category", () => {
    expect(productKind({ kind: "mobile_topup" }, "by_phone", "games"))
      .toBe("cryptorefills_code");
    for (const category of ["mobile_credits", "mobile_data", "mobile_topup"]) {
      expect(productKind({ kind: "mobile_topup" }, "by_phone", category))
        .toBe("cryptorefills_topup");
    }
    expect(productKind({ kind: "mobile_topup" }, "BY_PHONE" as never, "mobile_credits"))
      .toBe("cryptorefills_code");
  });

  it("drops phone-delivered eSIM fixture rows, including category case variations", () => {
    for (const country of ["VN", "US"] as const) {
      for (const group of esimSample[country]) {
        for (const category of ["e-sim", "E-SIM", "Gift_Card"]) {
          const listing = { categories: [{ category, brands: [
            { brand: group.brand, family: group.family },
          ] }] };
          const rows = [{ ...group, category, products: group.products.map((product) => ({
            ...product, delivery_type: "by_phone",
          })) }];
          expect(catalogFromMcp(country, listing, rows).categories).toEqual([]);
        }
      }
    }
  });

  it("drops unsupported and nonexact delivery types", () => {
    const listing = { categories: [{ category: "mobile_credits", brands: [
      { brand: "Phone", family: "mobile" },
    ] }] };
    for (const delivery_type of ["by_sms", "", "BY_PHONE", undefined]) {
      const product = { denomination: "5 USD", coin_amount: "5", kind: "mobile_topup",
        ...(delivery_type === undefined ? {} : { delivery_type }) };
      expect(catalogFromMcp("US", listing, [{ brand: "Phone", family: "mobile",
        products: [product] }]).categories).toEqual([]);
    }
  });

  it("keeps only mobile phone rows as topups for a merged brand", () => {
    const listing = { categories: [
      { category: "mobile_credits", brands: [{ brand: "Merged", family: "shared" }] },
      { category: "e-sim", brands: [{ brand: "Merged", family: "shared" }] },
    ] };
    const groups = [
      { category: "mobile_credits", brand: "Merged", family: "shared", products: [{
        denomination: "5 USD", coin_amount: "5", delivery_type: "by_phone",
        kind: "mobile_topup",
      }] },
      { category: "e-sim", brand: "Merged", family: "shared", products: [{
        denomination: "1 GB 3 days", coin_amount: "5", delivery_type: "by_phone",
        kind: "mobile_topup",
      }] },
    ];
    const catalog = catalogFromMcp("US", listing, groups);
    expect(catalog.categories).toHaveLength(1);
    expect(catalog.categories[0].category).toBe("mobile_credits");
    expect(catalog.categories[0].brands).toMatchObject([{
      kind: "cryptorefills_topup", delivery_type: "by_phone",
      products: [{ denomination: "5 USD" }],
    }]);
  });

  it("matches the exact Viettel brand name in shopQuote", async () => {
    const catalog = catalogFromMcp("VN", { categories: [{ category: "mobile_credits",
      brands: [{ brand: "Viettel", family: "mobile" }] }] }, [{
      brand: "Viettel", family: "mobile", products: [{ denomination: "20000 VND",
        coin_amount: "1", delivery_type: "by_phone" }],
    }]);
    await expect(shopQuote(
      { account_id: "buyer.test", standard: "nep413", exp: Date.now() + 60_000 },
      { country: "VN", brand_name: "viettel", denomination: "20000 VND",
        beneficiary: "+84900000001", buyer_email: "buyer@example.com" },
      { brand: brandFn("VN", catalog) },
    )).rejects.toBeInstanceOf(ShopNotFoundError);
  });

  it("keeps same-name code and top-up rows separate when quoting", async () => {
    const listing = { categories: [
      { category: "mobile_credits", brands: [{ brand: "Shared", family: "mobile" }] },
      { category: "games", brands: [{ brand: "Shared", family: "cards" }] },
    ] };
    const rows = [
      { category: "mobile_credits", family: "mobile", brand: "Shared", products: [
        { denomination: "5 USD", coin_amount: "5", delivery_type: "by_phone" },
      ] },
      { category: "games", family: "cards", brand: "Shared", products: [
        { denomination: "5 USD", coin_amount: "5", delivery_type: "by_email", kind: "giftcard" },
      ] },
    ];
    const catalog = catalogFromMcp("US", listing, rows);
    const brands = catalog.categories.flatMap((category) => category.brands);
    expect(brands).toHaveLength(2);
    expect(new Set(brands.map((brand) => brand.slug)).size).toBe(2);
    const code = brands.find((brand) => brand.kind === "cryptorefills_code")!;
    const session = { account_id: "buyer.test", standard: "nep413" as const, exp: Date.now() + 60_000 };
    const input = { country: "US", brand_name: "Shared", brand_slug: code.slug,
      denomination: "5 USD", beneficiary: "buyer@example.com", buyer_email: "buyer@example.com" };
    const result = await shopQuote(session, input, { brand: brandFn("US", catalog) });
    expect(result.kind).toBe("cryptorefills_code");
    expect(result.spec).toMatchObject({ brand_name: "Shared", delivery_type: "by_email" });
    await expect(shopQuote(session, { ...input, brand_name: "shared" }, {
      brand: brandFn("US", catalog),
    })).rejects.toMatchObject({ message: "Brand not found" });
    expect(productKind({ category: "mobile_credits", kind: "pin" }, "by_phone", "mobile_credits"))
      .toBe("cryptorefills_code");
    const unsafe = catalogFromMcp("US", { categories: [{ category: "mobile_credits",
      brands: [{ brand: "Phone PIN", family: "pin" }] }] }, [{
      category: "mobile_credits", family: "pin", brand: "Phone PIN", products: [{
        denomination: "5 USD", coin_amount: "5", delivery_type: "by_phone", kind: "pin",
      }],
    }]);
    expect(unsafe.categories).toEqual([]);
    await expect(shopQuote(session, { ...input, brand_name: "Phone PIN", brand_slug: undefined }, {
      brand: brandFn("US", unsafe),
    })).rejects.toMatchObject({ message: "Brand not found" });
  });

  it("uses each product row's upstream brand name for the quote", async () => {
    const catalog = catalogFromMcp("US", { categories: [{ category: "games", brands: [
      { brand: "Card A", family: "cards" }, { brand: "Card B", family: "cards" },
    ] }] }, [{ category: "games", family: "cards", brand: "Card A", products: [
      { brand_name: "Card B", denomination: "10 USD", coin_amount: "10", delivery_type: "by_email" },
    ] }]);
    const brands = catalog.categories.flatMap((category) => category.brands);
    expect(brands.map((brand) => brand.brand_name)).toEqual(["Card B"]);
    const result = await shopQuote(
      { account_id: "buyer.test", standard: "nep413", exp: Date.now() + 60_000 },
      { country: "US", brand_name: "Card B", brand_slug: brands[0].slug,
        denomination: "10 USD", beneficiary: "buyer@example.com", buyer_email: "buyer@example.com" },
      { brand: brandFn("US", catalog) },
    );
    expect(result.spec).toMatchObject({ brand_name: "Card B" });
  });

  it("labels only explicit eSIM units from public upstream samples", () => {
    for (const country of ["VN", "US"] as const) {
      for (const group of esimSample[country]) {
        for (const product of group.products) {
          expect(esimLabel(product, group.category)).toMatch(/days/);
        }
      }
    }
    expect(esimLabel({ denomination: "Plan", data_amount: "1", duration: 3 }, "e-sim"))
      .toBe("Plan");
    expect(formatShopDenomination("132499.9936 VND")).toBe("132,500 VND");
    expect(formatShopDenomination("5 USD")).toBe("5.00 USD");
  });

  it("mixes US popular brands across categories", () => {
    const brand = (name: string, listing_kind: "giftcard" | "mobile_recharge", category: string) => ({
      brand_name: name, slug: listingSlug(name, name, listing_kind), family: name, logo_url: "",
      category, listing_kind,
    });
    const picks = popularFromCatalog({ country: "US", categories: [
      { category: "mobile_credits", brands: [brand("Mobile A", "mobile_recharge", "mobile_credits"),
        brand("Mobile B", "mobile_recharge", "mobile_credits")] },
      { category: "giftcards", brands: [brand("Amazon", "giftcard", "giftcards"),
        brand("Netflix", "giftcard", "giftcards")] },
      { category: "games", brands: [brand("Steam", "giftcard", "games"), brand("Game B", "giftcard", "games")] },
    ] });
    expect(picks).toHaveLength(6);
    expect(picks[0].listing_kind).toBe("mobile_recharge");
    expect(picks.map((item) => item.brand_name)).toContain("Amazon");
    expect(picks.map((item) => item.brand_name)).toContain("Steam");
  });
  it("ranks curated Portuguese operators first among top-ups", () => {
    const row = (brand: string, kind: string) => ({ brand, family: brand, brand_id: brand, kind, category: brand });
    const catalog = catalogFromBrands("PT", { categories: [{ category: "x", brands: [
      row("Moche", "mobile_recharge"), row("NOS", "mobile_recharge"), row("MEO", "mobile_recharge"),
      row("Zzz Card", "giftcard"),
    ] }] });
    expect(popularFromCatalog(catalog).map((item) => item.brand_name).slice(0, 3))
      .toEqual(["MEO", "NOS", "Moche"]);
  });
  it("cools down a cold catalog failure before retrying upstream", async () => {
    process.env.FULFIL_MODE = "live";
    const key = "v3:catalog:v3:live:IN";
    remove(key);
    let now = 1_000;
    const client = {
      listBrands: vi.fn(async () => { throw new Error("upstream unavailable"); }),
      listProducts: vi.fn(),
    };
    try {
      await expect(shopCatalog("IN", client as never, () => now)).rejects.toBeInstanceOf(ShopUpstreamError);
      const firstCalls = client.listBrands.mock.calls.length;
      expect(firstCalls).toBeGreaterThan(0);
      await expect(shopCatalog("IN", client as never, () => now)).rejects.toBeInstanceOf(ShopUpstreamError);
      expect(client.listBrands).toHaveBeenCalledTimes(firstCalls);
      now += 30_001;
      await expect(shopCatalog("IN", client as never, () => now)).rejects.toBeInstanceOf(ShopUpstreamError);
      expect(client.listBrands.mock.calls.length).toBeGreaterThan(firstCalls);
    } finally {
      remove(key);
      process.env.FULFIL_MODE = "mock";
    }
  });

  it("cools down a failed estimate fee quote before retrying upstream", async () => {
    process.env.FULFIL_MODE = "live";
    const slug = "fee-cooldown-brand";
    const key = `v3:estimate_fee:live:GB:${slug}`;
    remove(key);
    let now = 1_000;
    const catalog = async () => ({ country: "GB", slug, brand_name: "Fee cooldown brand",
      logo_url: "", category: "games", variants: [{ brand_name: "Fee cooldown brand", slug,
        family: "games", category: "games", logo_url: "",
        kind: "cryptorefills_code" as const, delivery_type: "by_email" as const,
        products: [{ denomination: "5 USD", face_value: { amount: "5", currency: "USD" },
          cost_usdc: "5000000" }] }] });
    const quote = vi.fn(async () => { throw new Error("upstream unavailable"); });
    const estimate = () => shopEstimate("GB", slug, {
      brand: catalog as never, oneClick: { quote } as never, clock: () => now,
    });
    try {
      await expect(estimate()).rejects.toBeInstanceOf(ShopUpstreamError);
      expect(quote).toHaveBeenCalledTimes(1);
      await expect(estimate()).rejects.toBeInstanceOf(ShopUpstreamError);
      expect(quote).toHaveBeenCalledTimes(1);
      now += 30_001;
      await expect(estimate()).rejects.toBeInstanceOf(ShopUpstreamError);
      expect(quote).toHaveBeenCalledTimes(2);
    } finally {
      remove(key);
      process.env.FULFIL_MODE = "mock";
    }
  });

  it("retries with backoff and fails after a timeout", async () => {
    const pauses: number[] = [];
    const call = vi.fn().mockRejectedValueOnce(new Error("temporary"))
      .mockRejectedValueOnce(new Error("temporary"))
      .mockResolvedValue("ready");
    expect(await retryCatalogCall(call, {
      timeoutMs: 20, delays: [2, 4], sleep: async (ms) => { pauses.push(ms); },
    })).toBe("ready");
    expect(pauses).toEqual([2, 4]);
    await expect(retryCatalogCall(() => new Promise(() => undefined), {
      timeoutMs: 1, delays: [],
    })).rejects.toBeInstanceOf(ShopUpstreamError);
  });

  it("dedupes brands and denominations and gives eSIMs a readable label", () => {
    const result = catalogFromMcp("US", { categories: [
      { category: "e-sim", brands: [{ brand: "Travel eSIM", family: "travel" }] },
      { category: "games", brands: [{ brand: "Travel eSIM", family: "travel" }] },
    ] }, { products: [
      { brand_name: "Travel eSIM", denomination: "1 GB 3 days", data_amount: "1",
        duration_days: 3, coin_amount: "5", delivery_type: "by_email" },
      { brand_name: "Travel eSIM", denomination: "1 GB 3 days", data_amount: "1",
        duration_days: 3, coin_amount: "5", delivery_type: "by_email" },
    ] });
    const all = result.categories.flatMap((item) => item.brands);
    expect(all).toHaveLength(1);
    expect(all[0].slug).toBe(listingSlug("Travel eSIM", "travel", "giftcard"));
    expect(all[0].products).toHaveLength(1);
    expect(all[0].products[0].label).toBe("1 GB · 3 days");
    const listings = catalogFromBrands("US", { categories: [
      { category: "e-sim", brands: [{ brand: "Travel eSIM", family: "travel" }] },
      { category: "games", brands: [{ brand: "Travel eSIM", family: "travel" }] },
    ] });
    expect(listings.categories).toHaveLength(1);
    expect(listings.categories[0]).toMatchObject({ category: "e-sim", display_name: "eSIM" });
    expect(listingSlug("A-B", "f", "giftcard")).not.toBe(listingSlug("A B", "f", "giftcard"));
    expect(listingSlug("A", "f", "giftcard", "id-1")).not.toBe(listingSlug("A", "f", "giftcard", "id-2"));
    expect(listingSlug("A", "f", "giftcard")).toBe(listingSlug("A", "f", "giftcard"));
  });

  it("ranks exact brand names, then prefixes, word starts, and substrings", () => {
    const names = ["Super Viettel", "Viettel Plus", "MyViettel", "Viettel", "ViettelNow"]
      .map((brand_name) => ({ brand_name }));
    expect(rankBrands(names, "viettel").map((item) => item.brand_name))
      .toEqual(["Viettel", "Viettel Plus", "ViettelNow", "Super Viettel", "MyViettel"]);
    expect(rankBrands(names, "vittel")).toEqual([]);
  });

  it("uses the binding quote calculator for public estimates and caches the fee", async () => {
    process.env.FULFIL_MODE = "live";
    const slug = "viettel-estimate";
    const key = `v3:estimate_fee:live:VN:${slug}`;
    remove(key);
    const catalog = async () => ({ country: "VN", slug, brand_name: "Viettel", logo_url: "",
      category: "mobile_credits", variants: [{ brand_name: "Viettel", slug, family: "mobile",
        category: "mobile_credits", logo_url: "",
        kind: "cryptorefills_topup" as const, delivery_type: "by_phone" as const,
        products: [{ denomination: "20000 VND", face_value: { amount: "20000", currency: "VND" },
          cost_usdc: "1000000" }] }] });
    const quote = vi.fn(async () => ({ amountIn: "1100000", amountOut: "1000000", depositAddress: "" }));
    try {
      const estimate = await shopEstimate("VN", slug, { brand: catalog as never,
        oneClick: { quote } as never, clock: () => 1_000 });
      const binding = await quoteOrder({
        validateOrder: async () => ({ coin_amount: "1" }),
        dryQuote: async () => ({ amountIn: "1100000", amountOut: "1000000" }),
      }, () => 1_000);
      expect(estimate.products[0].total).toBe(binding.total);
      await shopEstimate("VN", slug, { brand: catalog as never, oneClick: { quote } as never,
        clock: () => 2_000 });
      expect(quote).toHaveBeenCalledTimes(1);
    } finally {
      remove(key);
      process.env.FULFIL_MODE = "mock";
    }
  });

  it("returns 404 for unknown country and brand, and 502 for an upstream failure", async () => {
    const missingCountry = await GET(new Request("http://local/api/v3/shop/catalog?country=XX"),
      context("shop/catalog"));
    expect(missingCountry.status).toBe(404);
    expect((await missingCountry.json()).error.code).toBe("not_found");
    const missingBrand = await GET(new Request("http://local/api/v3/shop/estimate?country=VN&brand=absent"),
      context("shop/estimate"));
    expect(missingBrand.status).toBe(404);

    process.env.FULFIL_MODE = "live";
    remove("v3:catalog:v3:live:DE");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("HTTP request failed"));
    try {
      const unavailable = await GET(new Request("http://local/api/v3/shop/catalog?country=DE"),
        context("shop/catalog"));
      expect(unavailable.status).toBe(502);
      expect((await unavailable.json()).error.code).toBe("upstream_unavailable");
    } finally {
      fetchMock.mockRestore();
      process.env.FULFIL_MODE = "mock";
    }
  });

  it("maps an upstream HTTP failure during the authenticated quote to 502", async () => {
    process.env.FULFIL_MODE = "live";
    const originalShopper = process.env.SHOPPER_ACCOUNT_ID;
    process.env.SHOPPER_ACCOUNT_ID = "shopper.test";
    const key = "v3:catalog:v3:live:VN";
    const slug = listingSlug("Viettel", "mobile", "mobile_recharge");
    const brandKeyName = `v3:brand:v1:live:VN:${slug}`;
    remove(key);
    put(key, "v3:catalog", { until: Date.now() + 60_000, value: {
      country: "VN", categories: [{ category: "mobile_credits", brands: [{
        brand_name: "Viettel", slug, family: "mobile", logo_url: "", category: "mobile_credits",
        listing_kind: "mobile_recharge",
      }] }],
    } });
    put(brandKeyName, "v3:brand", { until: Date.now() + 60_000, value: {
      country: "VN", slug, brand_name: "Viettel", logo_url: "", category: "mobile_credits",
      variants: [{ brand_name: "Viettel", slug, family: "mobile", category: "mobile_credits",
        logo_url: "", kind: "cryptorefills_topup", delivery_type: "by_phone", products: [{
          denomination: "20000 VND", face_value: { amount: "20000", currency: "VND" },
          cost_usdc: "1000000",
        }] }],
    } });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 503 }));
    try {
      const request = new Request("http://local/api/v3/shop/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: cookieHeader({
          account_id: "buyer.test", standard: "nep413", exp: Date.now() + 60_000,
        }) },
        body: JSON.stringify({ country: "VN", brand_name: "Viettel", denomination: "20000 VND",
          beneficiary: "+84900000001", buyer_email: "buyer@example.com" }),
      });
      const response = await POST(request, context("shop/quote"));
      expect(response.status).toBe(502);
      expect((await response.json()).error.code).toBe("upstream_unavailable");
    } finally {
      fetchMock.mockRestore();
      remove(key);
      remove(brandKeyName);
      process.env.SHOPPER_ACCOUNT_ID = originalShopper;
      process.env.FULFIL_MODE = "mock";
    }
  });

  it("lists countries without a network call", async () => {
    const listBrands = vi.fn(async () => { throw new Error("never called"); });
    expect(await shopCountries({ listBrands, listProducts: vi.fn() } as never)).toHaveLength(16);
    expect(listBrands).not.toHaveBeenCalled();
  });

  it("puts local mobile brands first in a deduped popular list", async () => {
    const key = "v3:catalog:v3:mock:VN";
    const item = (name: string, listing_kind: "giftcard" | "mobile_recharge") => ({
      brand_name: name, slug: listingSlug(name, "synthetic", listing_kind), family: "synthetic",
      logo_url: "", category: "x", listing_kind,
    });
    put(key, "v3:catalog", { until: Date.now() + 60_000, value: {
      country: "VN", categories: [
        { category: "games", brands: [item("Steam", "giftcard"), item("Steam", "giftcard")] },
        { category: "mobile_credits", brands: [item("Mobifone", "mobile_recharge"),
          item("Viettel", "mobile_recharge")] },
      ],
    } });
    try {
      expect((await shopPopular("VN")).map((brand) => brand.brand_name))
        .toEqual(["Viettel", "Mobifone", "Steam"]);
    } finally {
      remove(key);
    }
  });
});
