import { describe, expect, it, vi } from "vitest";
vi.hoisted(() => {
  process.env.FULFIL_MODE = "mock";
  process.env.DATABASE_URL = `file:/tmp/fulfil-shop-catalog-${process.pid}.db`;
});
import {
  brandVariantsFromMcp,
  catalogBlocked,
  catalogFromBrands,
  listingSlug,
  pruneStoredSpecs,
  pruneStoredSpecsIfDue,
  resetCatalogBreaker,
  retryCatalogCall,
  ShopUpstreamError,
  shopBrand,
  shopCatalog,
  shopCountries,
  shopQuote,
  warmCatalog,
} from "../../apps/web/lib/server/v3/shop";
import { HttpError } from "../../apps/shopper/src/diagnostics";
import { listingsOf, variantsByCategory as catalogFromMcp } from "./shop-helpers";
import { get, put, remove } from "../../apps/web/lib/server/db";
import { MockEscrow } from "../../apps/web/lib/server/v3/escrow";
import { parseMcpResponse } from "../../apps/shopper/src/cryptorefills";
import brandsVn from "../fixtures/cryptorefills-brands-vn.json";
import productsVn from "../fixtures/cryptorefills-products-vn.json";
import brandsUs from "../fixtures/cryptorefills-brands-us.json";
import productsUs from "../fixtures/cryptorefills-products-us.json";

describe("shop catalog", () => {
  it("flattens real grouped MCP products and exact USDC prices", () => {
    const brands = parseMcpResponse(JSON.stringify(brandsVn));
    const groups = parseMcpResponse(JSON.stringify(productsVn));
    const catalog = catalogFromMcp("VN", brands, groups);
    const mobile = catalog.categories.flatMap((category) => category.brands)
      .find((brand) => brand.brand_name === "Viettel Mobile Credits");
    const lazada = catalog.categories.flatMap((category) => category.brands)
      .find((brand) => brand.brand_name === "Lazada");
    expect(mobile).toMatchObject({
      family: "Viettel Mobile",
      kind: "cryptorefills_topup",
      delivery_type: "by_phone",
      logo_url: "https://cdn.cryptorefills.com/logos_v2/viettel.webp",
      products: [{ denomination: "20000 VND", cost_usdc: "880000",
        face_value: { amount: "20000", currency: "VND" } }],
    });
    expect(lazada).toMatchObject({
      kind: "cryptorefills_code",
      delivery_type: "by_email",
      products: [{ denomination: "100000 VND", cost_usdc: "4110000" }],
    });
  });

  it("keeps Philippine phone top-ups with ordinary PIN substrings in names", () => {
    const listing = { categories: [{ category: "mobile_data", brands: [
      { brand: "Smart Philippines", family: "Philippines" },
      { brand: "Pinoy Load", family: "Pinoy" },
    ] }] };
    const groups = [
      { category: "mobile_data", brand: "Smart Philippines", family: "Philippines",
        products: [{ kind: "mobile_topup", denomination: "1 GB", coin_amount: "1",
          coin: "USDC", delivery_type: "by_phone" }] },
      { category: "mobile_data", brand: "Pinoy Load", family: "Pinoy",
        products: [{ kind: "mobile_topup", denomination: "2 GB", coin_amount: "2",
          coin: "USDC", delivery_type: "by_phone" }] },
    ];

    const catalog = catalogFromMcp("PH", listing, groups);

    expect(catalog.categories.flatMap((category) => category.brands)
      .map((brand) => [brand.brand_name, brand.kind, brand.delivery_type])).toEqual([
      ["Smart Philippines", "cryptorefills_topup", "by_phone"],
      ["Pinoy Load", "cryptorefills_topup", "by_phone"],
    ]);
  });

  it("uses product-group category when the brand listing category differs", () => {
    const brands = structuredClone(brandsVn.result.structuredContent.result);
    const mobile = brands.categories[0].brands[0];
    brands.categories[0].category = "games";
    mobile.category = "games";
    const catalog = catalogFromMcp("VN", brands,
      parseMcpResponse(JSON.stringify(productsVn)));
    const mobileCategory = catalog.categories.find((category) =>
      category.brands.some((brand) => brand.brand_name === "Viettel Mobile Credits"));
    expect(mobileCategory?.category).toBe("mobile_credits");
    expect(mobileCategory?.brands[0].kind).toBe("cryptorefills_topup");
  });

  it("does not quote a product row under a conflicting group brand", () => {
    const brands = {
      categories: [{
        category: "mobile_credits",
        brands: [{
          brand: "Group Mobile",
          family: "Group Family",
          logo_url: "https://assets.example.invalid/group.png",
          is_out_of_stock: false,
        }, {
          brand: "Unavailable Group",
          family: "Unavailable Family",
          is_out_of_stock: true,
        }, {
          brand: "Unavailable Product",
          family: "Product Stock Family",
          is_out_of_stock: false,
        }],
      }],
    };
    const groups = [{
      category: "mobile_credits",
      kind: "mobile_recharge",
      family: "Group Family",
      brand: "Group Mobile",
      logo_url: "https://assets.example.invalid/group.png",
      is_out_of_stock: false,
      products: [{
        brand_name: "Attacker Brand",
        family: "Attacker Family",
        category: "games",
        kind: "giftcard",
        logo_url: "https://assets.example.invalid/attacker.png",
        is_out_of_stock: false,
        denomination: "20000 VND",
        coin_amount: "0.88",
        coin: "USDC",
        delivery_type: "by_phone",
      }],
    }, {
      category: "mobile_credits",
      family: "Unavailable Family",
      brand: "Unavailable Group",
      is_out_of_stock: true,
      products: [{
        denomination: "20000 VND",
        coin_amount: "0.88",
        coin: "USDC",
        delivery_type: "by_phone",
      }],
    }, {
      category: "mobile_credits",
      family: "Product Stock Family",
      brand: "Unavailable Product",
      is_out_of_stock: false,
      products: [{
        is_out_of_stock: true,
        denomination: "20000 VND",
        coin_amount: "0.88",
        coin: "USDC",
        delivery_type: "by_phone",
      }],
    }];

    const catalog = catalogFromMcp("VN", brands, groups);

    expect(catalog.categories).toEqual([]);
  });

  it("omits unpriced dynamic products from the catalog", () => {
    const catalog = catalogFromMcp("US", parseMcpResponse(JSON.stringify(brandsUs)),
      parseMcpResponse(JSON.stringify(productsUs)));
    expect(catalog.categories).toEqual([]);
  });

  it("builds the country catalog from listBrands alone, with stable slugs and price text", () => {
    const catalog = catalogFromBrands("VN", parseMcpResponse(JSON.stringify(brandsVn)));
    const again = catalogFromBrands("VN", parseMcpResponse(JSON.stringify(brandsVn)));
    expect(again).toEqual(catalog);
    const viettel = listingsOf(catalog).find((brand) => brand.brand_name === "Viettel Mobile Credits");
    expect(viettel).toMatchObject({
      family: "Viettel Mobile",
      listing_kind: "mobile_recharge",
      logo_url: "https://cdn.cryptorefills.com/logos_v2/viettel.webp",
    });
    expect(viettel?.slug).toMatch(/^viettel-mobile-credits-[0-9a-f]{8}$/);
    expect(new Set(listingsOf(catalog).map((brand) => brand.slug)).size)
      .toBe(listingsOf(catalog).length);
  });

  it("lists a brand repeated under extra categories once and formats the price range", () => {
    const row = { brand: "Eva AU", family: "Eva AU", brand_id: "id-1", kind: "giftcard",
      category: "home", min: "A$50", max: "A$500", product_type: "physical", bg_color: "#bfbfbb",
      logo_url: "https://cdn.example.invalid/eva.webp" };
    const catalog = catalogFromBrands("AU", { categories: [
      { category: "new", brands: [row] },
      { category: "home", brands: [row, { ...row, brand: "Flat", brand_id: "id-2", min: "A$5", max: "A$5" },
        { ...row, brand: "Gone", brand_id: "id-3", is_out_of_stock: true }] },
    ] });
    expect(catalog.categories).toHaveLength(1);
    expect(catalog.categories[0]).toMatchObject({ category: "home", display_name: "Home" });
    expect(catalog.categories[0].brands.map((brand) => [brand.brand_name, brand.price_range]))
      .toEqual([["Eva AU", "A$50 – A$500"], ["Flat", "A$5"]]);
    expect(catalog.categories[0].brands[0]).toMatchObject({ bg_color: "#bfbfbb", product_type: "physical" });
  });

  it("loads a country with exactly one upstream call and no product calls", async () => {
    process.env.FULFIL_MODE = "live";
    remove("v3:catalog:v3:live:AU");
    const rows = Array.from({ length: 272 }, (_, index) => ({
      brand: `Brand ${index}`, family: `Family ${index}`, brand_id: `id-${index}`,
      kind: "giftcard", category: "retail", min: "A$5", max: "A$50", is_out_of_stock: false,
    }));
    const listBrands = vi.fn(async () => ({ categories: [{ category: "retail", brands: rows }] }));
    const listProducts = vi.fn();
    try {
      const catalog = await shopCatalog("AU", { listBrands, listProducts } as never, () => 5_000_000);
      expect(listingsOf(catalog)).toHaveLength(272);
      expect(listBrands).toHaveBeenCalledTimes(1);
      expect(listProducts).not.toHaveBeenCalled();
      await shopCatalog("AU", { listBrands, listProducts } as never, () => 5_000_000 + 5 * 60 * 60_000);
      expect(listBrands).toHaveBeenCalledTimes(1);
    } finally {
      remove("v3:catalog:v3:live:AU");
      process.env.FULFIL_MODE = "mock";
    }
  });

  it("fetches one brand's products with one call and serves the next view from cache", async () => {
    process.env.FULFIL_MODE = "live";
    remove("v3:catalog:v3:live:GB");
    const groups = parseMcpResponse(JSON.stringify(productsVn));
    const listBrands = vi.fn(async () => parseMcpResponse(JSON.stringify(brandsVn)));
    const listProducts = vi.fn(async (_country: string, family: string) =>
      (groups as Record<string, unknown>[]).filter((group) => group.family === family));
    const client = { listBrands, listProducts } as never;
    const clock = () => 7_000_000;
    try {
      const catalog = await shopCatalog("GB", client, clock);
      const slug = listingsOf(catalog).find((brand) => brand.brand_name === "Viettel Mobile Credits")!.slug;
      remove(`v3:brand:v1:live:GB:${slug}`);
      const detail = await shopBrand("GB", slug, client, clock);
      expect(listProducts).toHaveBeenCalledTimes(1);
      expect(listProducts).toHaveBeenCalledWith("GB", "Viettel Mobile");
      expect(detail).toMatchObject({ slug, brand_name: "Viettel Mobile Credits" });
      expect(detail.variants).toMatchObject([{
        kind: "cryptorefills_topup", delivery_type: "by_phone", slug,
        products: [{ denomination: "20000 VND", cost_usdc: "880000" }],
      }]);
      expect(await shopBrand("GB", slug, client, clock)).toEqual(detail);
      // An exact brand name resolves too.
      expect((await shopBrand("GB", "Viettel Mobile Credits", client, clock)).slug).toBe(slug);
      expect(listProducts).toHaveBeenCalledTimes(1);
      expect(listBrands).toHaveBeenCalledTimes(1);
      await expect(shopBrand("GB", "absent-brand", client, clock)).rejects.toThrow("Brand not found");
      expect(listProducts).toHaveBeenCalledTimes(1);
    } finally {
      remove("v3:catalog:v3:live:GB");
      process.env.FULFIL_MODE = "mock";
    }
  });

  it("serves a stale brand entry immediately and refreshes it once in the background", async () => {
    process.env.FULFIL_MODE = "live";
    remove("v3:catalog:v3:live:FR");
    const slug = listingSlug("Viettel", "mobile", "mobile_recharge");
    const key = `v3:brand:v1:live:FR:${slug}`;
    const stale = { country: "FR", slug, brand_name: "Viettel", logo_url: "", category: "mobile_credits",
      variants: [] };
    put(key, "v3:brand", { until: 1, value: stale });
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const listBrands = vi.fn(async () => ({ categories: [{ category: "mobile_credits", brands: [
      { brand: "Viettel", family: "mobile", kind: "mobile_recharge", category: "mobile_credits" },
    ] }] }));
    const listProducts = vi.fn(async () => { await gate; return { products: [{ brand_name: "Viettel",
      family: "mobile", denomination: "20000 VND", coin_amount: "1", delivery_type: "by_phone" }] }; });
    const client = { listBrands, listProducts } as never;
    const now = 10_000_000;
    try {
      expect(await shopBrand("FR", slug, client, () => now)).toEqual(stale);
      expect(await shopBrand("FR", slug, client, () => now)).toEqual(stale);
      await vi.waitFor(() => expect(listProducts).toHaveBeenCalledTimes(1));
      release();
      await vi.waitFor(() => expect(get<{ until: number; value: { variants: unknown[] } }>(key)?.value.variants)
        .toHaveLength(1));
      expect(get<{ until: number }>(key)?.until).toBe(now + 6 * 60 * 60_000);
      expect(listProducts).toHaveBeenCalledTimes(1);
    } finally {
      remove("v3:catalog:v3:live:FR");
      remove(key);
      process.env.FULFIL_MODE = "mock";
    }
  });

  it("does not retry a 429, trips the breaker and serves cache while it is open", async () => {
    process.env.FULFIL_MODE = "live";
    resetCatalogBreaker();
    const limited = vi.fn(async () => { throw new HttpError(429); });
    let now = 20_000_000;
    try {
      await expect(retryCatalogCall(limited, { delays: [1, 1], sleep: async () => undefined, now: () => now }))
        .rejects.toBeInstanceOf(ShopUpstreamError);
      expect(limited).toHaveBeenCalledTimes(1);
      expect(catalogBlocked(now)).toBe(true);
      expect(catalogBlocked(now + 5 * 60_000 - 1)).toBe(true);
      expect(catalogBlocked(now + 5 * 60_000)).toBe(false);

      // Cold: fails fast without touching the upstream.
      remove("v3:catalog:v3:live:ES");
      const listBrands = vi.fn(async () => ({ categories: [] }));
      await expect(shopCatalog("ES", { listBrands, listProducts: vi.fn() } as never, () => now))
        .rejects.toBeInstanceOf(ShopUpstreamError);
      expect(listBrands).not.toHaveBeenCalled();

      // Stale: served from cache, no background refresh while blocked.
      const stale = { country: "ES", categories: [] };
      put("v3:catalog:v3:live:ES", "v3:catalog", { until: 1, value: stale });
      expect(await shopCatalog("ES", { listBrands, listProducts: vi.fn() } as never, () => now))
        .toEqual(stale);
      expect(listBrands).not.toHaveBeenCalled();

      // After the breaker window the refresh runs again.
      now += 5 * 60_000;
      await shopCatalog("ES", { listBrands, listProducts: vi.fn() } as never, () => now);
      await vi.waitFor(() => expect(listBrands).toHaveBeenCalledTimes(1));
    } finally {
      resetCatalogBreaker();
      remove("v3:catalog:v3:live:ES");
      process.env.FULFIL_MODE = "mock";
    }
  });

  it("trips the breaker from a real 429 through a failing brand load", async () => {
    process.env.FULFIL_MODE = "live";
    resetCatalogBreaker();
    remove("v3:catalog:v3:live:CA");
    const listBrands = vi.fn(async () => { throw Object.assign(new Error("HTTP request failed"), { status: 429 }); });
    try {
      await expect(shopCatalog("CA", { listBrands, listProducts: vi.fn() } as never, () => 30_000_000))
        .rejects.toBeInstanceOf(ShopUpstreamError);
      expect(listBrands).toHaveBeenCalledTimes(1);
      expect(catalogBlocked(30_000_000)).toBe(true);
    } finally {
      resetCatalogBreaker();
      remove("v3:catalog:v3:live:CA");
      process.env.FULFIL_MODE = "mock";
    }
  });

  it("warms only uncached countries with listBrands, sequentially, and never loads products", async () => {
    process.env.FULFIL_MODE = "live";
    resetCatalogBreaker();
    const codes = ["VN", "US", "AU", "GB", "CA", "DE", "FR", "ES", "PT", "IT", "AE", "IN", "ID", "PH", "TH", "SG"];
    for (const code of codes) remove(`v3:catalog:v3:live:${code}`);
    put("v3:catalog:v3:live:VN", "v3:catalog", { until: 1, value: { country: "VN", categories: [] } });
    let active = 0;
    let maximum = 0;
    const listBrands = vi.fn(async (_country: string) => {
      active += 1;
      maximum = Math.max(maximum, active);
      await new Promise((resolve) => setTimeout(resolve, 0));
      active -= 1;
      return { categories: [{ category: "games", brands: [{ brand: "X", family: "x", kind: "giftcard" }] }] };
    });
    const listProducts = vi.fn();
    const pauses: number[] = [];
    try {
      await warmCatalog({ client: { listBrands, listProducts } as never, clock: () => 40_000_000,
        gapMs: 2_500, sleep: async (ms) => { pauses.push(ms); } });
      expect(listBrands.mock.calls.map((call) => call[0])).toEqual(codes.filter((code) => code !== "VN"));
      expect(maximum).toBe(1);
      expect(listProducts).not.toHaveBeenCalled();
      expect(pauses.every((ms) => ms === 2_500)).toBe(true);
      expect(pauses).toHaveLength(15);
      // Everything is cached now: a second pass makes no calls.
      await warmCatalog({ client: { listBrands, listProducts } as never, clock: () => 40_000_000,
        sleep: async () => undefined });
      expect(listBrands).toHaveBeenCalledTimes(15);
    } finally {
      for (const code of codes) remove(`v3:catalog:v3:live:${code}`);
      process.env.FULFIL_MODE = "mock";
    }
  });

  it("filters out stock, missing USDC price, small prices and unsupported delivery", () => {
    const catalog = catalogFromMcp("VN", { categories: [
      { category: "mobile_data", brands: [{ brand: "Mobile", family: "phone", logo_url: "https://assets.example.invalid/mobile.png", delivery_type: "by_phone", is_out_of_stock: false }] },
      { category: "games", brands: [{ brand: "Code", family: "games", delivery_type: "by_email", is_out_of_stock: false },
        { brand: "Out", family: "games", delivery_type: "by_email", is_out_of_stock: true }] },
    ] }, { products: [
      { brand_name: "Mobile", denomination: "20000 VND", coin_amount: "0.6", delivery_type: "by_phone" },
      { brand_name: "Mobile", denomination: "10000 VND", coin_amount: "0.59", delivery_type: "by_phone" },
      { brand_name: "Code", denomination: "5 USD", coin_amount: "5", delivery_type: "by_email" },
      { brand_name: "Code", denomination: "6 USD", delivery_type: "by_email" },
      { brand_name: "Mobile", denomination: "range", min: "10000", max: "50000", currency: "VND", coin_amount: "1", delivery_type: "by_phone" },
      { brand_name: "Out", denomination: "5 USD", coin_amount: "5", delivery_type: "by_email" },
    ] });
    expect(catalog.categories[0].brands[0]).toMatchObject({ kind: "cryptorefills_topup" });
    expect(catalog.categories[0].brands[0].logo_url).toBe("https://assets.example.invalid/mobile.png");
    expect(catalog.categories[0].brands[0].products).toContainEqual(expect.objectContaining({ cost_usdc: "600000" }));
    expect(catalog.categories[0].brands[0].products).toContainEqual(expect.objectContaining({
      denomination: "",
      product_value_range: { min: "10000", max: "50000", currency: "VND" },
    }));
    expect(catalog.categories[1].brands[0].kind).toBe("cryptorefills_code");
    expect(catalog.categories[1].brands).toHaveLength(1);
    const [listing] = listingsOf(catalogFromBrands("VN", { categories: [
      { category: "games", brands: [{ brand: "Code", family: "games" }] }] }));
    expect(() => brandVariantsFromMcp(listing, { unknown: [] })).toThrow("unknown shape");
  });
  it("caches the mock catalog for six hours with an injectable clock", async () => {
    remove("v3:catalog:v3:mock:PH");
    let now = 1_000;
    const first = await shopCatalog("PH", undefined, () => now);
    const written = get<{ until: number }>("v3:catalog:v3:mock:PH");
    expect(written?.until).toBe(1_000 + 6 * 60 * 60_000);
    now += 6 * 60 * 60_000 - 1;
    expect(await shopCatalog("PH", undefined, () => now)).toEqual(first);
    expect(get<{ until: number }>("v3:catalog:v3:mock:PH")?.until).toBe(written?.until);
    now += 2;
    expect(await shopCatalog("PH", undefined, () => now)).toEqual(first);
  });
  it("shares one cold catalog load and retries after an upstream failure", async () => {
    process.env.FULFIL_MODE = "live";
    remove("v3:catalog:v3:live:TH");
    remove("v3:catalog:v3:live:SG");
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const listBrands = vi.fn(async () => {
      await gate;
      return { categories: [{ category: "games", brands: [{ brand: "Synthetic",
        family: "games", kind: "giftcard" }] }] };
    });
    const listProducts = vi.fn();
    const client = { listBrands, listProducts } as never;
    try {
      const first = shopCatalog("TH", client, () => 2_000_000);
      const second = shopCatalog("TH", client, () => 2_000_000);
      await Promise.resolve();
      expect(listBrands).toHaveBeenCalledTimes(1);
      release();
      const [left, right] = await Promise.all([first, second]);
      expect(left).toBe(right);
      expect(listProducts).not.toHaveBeenCalled();

      listBrands.mockRejectedValueOnce(new Error("synthetic upstream failure"));
      await expect(shopCatalog("SG", client, () => 2_000_000))
        .resolves.toMatchObject({ country: "SG" });
      expect(listBrands).toHaveBeenCalledTimes(3);
    } finally {
      remove("v3:catalog:v3:live:TH");
      remove("v3:catalog:v3:live:SG");
      process.env.FULFIL_MODE = "mock";
    }
  });
  it("includes synthetic logo URLs and lazy mock products", async () => {
    remove("v3:catalog:v3:mock:VN");
    const catalog = await shopCatalog("VN");
    const brands = listingsOf(catalog);
    expect(brands.map((brand) => brand.logo_url)).toContain("https://assets.example.invalid/viettel.png");
    expect(brands.every((brand) => brand.logo_url.length > 0)).toBe(true);
    expect(brands.find((brand) => brand.brand_name === "Viettel Mobile Credits")?.price_range)
      .toBe("10,000₫ – 50,000₫");
    const esim = brands.find((brand) => brand.brand_name === "Travel eSIM")!;
    const detail = await shopBrand("VN", esim.slug);
    expect(detail.variants[0].products[0].label).toBe("1 GB · 3 days");
  });
  it("returns countries without calling the upstream", async () => {
    process.env.FULFIL_MODE = "live";
    let now = 1_000;
    const listBrands = vi.fn(async () => ({ categories: [
      { category: "games", brands: [{ brand: "Synthetic", is_out_of_stock: false }] },
    ] }));
    const client = { listBrands, listProducts: vi.fn() } as never;
    try {
      const first = await shopCountries(client, () => now);
      expect(listBrands).not.toHaveBeenCalled();
      now += 599_999;
      expect(await shopCountries(client, () => now)).toEqual(first);
      expect(listBrands).not.toHaveBeenCalled();
      now += 1;
      expect(await shopCountries(client, () => now)).toEqual(first);
      expect(listBrands).not.toHaveBeenCalled();
    } finally {
      process.env.FULFIL_MODE = "mock";
    }
  });
  it("returns countries even if the upstream would fail", async () => {
    process.env.FULFIL_MODE = "live";
    const listBrands = vi.fn(async () => { throw new Error("upstream failed"); });
    const client = { listBrands, listProducts: vi.fn() } as never;
    try {
      await expect(shopCountries(client, () => 2_000_000)).resolves.toHaveLength(16);
      expect(listBrands).not.toHaveBeenCalled();
    } finally {
      process.env.FULFIL_MODE = "mock";
    }
  });

  it("runs the stored-spec sweep at most once per minute", async () => {
    let now = 1_000;
    const sweep = vi.fn(async () => 1);
    expect(await pruneStoredSpecsIfDue(() => now, sweep)).toBe(1);
    now += 59_999;
    expect(await pruneStoredSpecsIfDue(() => now, sweep)).toBe(0);
    expect(sweep).toHaveBeenCalledTimes(1);
    now += 1;
    expect(await pruneStoredSpecsIfDue(() => now, sweep)).toBe(1);
    expect(sweep).toHaveBeenCalledTimes(2);
  });
  it("keeps an expired unfunded quote during funding grace, then prunes its prepared record", async () => {
    const id = "FUL-EXPIRED1";
    put(`v3:spec:${id}`, "v3:spec", {
      order_id: id,
      quote: { expires_at: new Date(1_000).toISOString() },
      expires_at: new Date(100_000).toISOString(),
    });
    put(`v3:prepared:${id}`, "v3:prepared", { account_id: "synthetic.test" });
    expect(await pruneStoredSpecs(() => 2_000)).toBe(0);
    expect(get(`v3:spec:${id}`)).toBeDefined();
    expect(get(`v3:prepared:${id}`)).toBeDefined();
    expect(await pruneStoredSpecs(() => 1_000 + 60 * 60_000)).toBe(0);
    expect(await pruneStoredSpecs(() => 1_000 + 60 * 60_000 + 1)).toBeGreaterThan(0);
    expect(get(`v3:spec:${id}`)).toBeUndefined();
    expect(get(`v3:prepared:${id}`)).toBeUndefined();
  });

  it("keeps a quote that becomes funded during the grace period", async () => {
    const id = `FUL-INFLIGHT-${process.pid}`;
    const specKey = `v3:spec:${id}`;
    const preparedKey = `v3:prepared:${id}`;
    put(specKey, "v3:spec", {
      order_id: id, quote: { expires_at: new Date(1_000).toISOString() },
      expires_at: new Date(100_000).toISOString(),
    });
    put(preparedKey, "v3:prepared", { account_id: "synthetic.test" });
    try {
      await pruneStoredSpecs(() => 2_000);
      expect(get(specKey)).toBeDefined();
      put(`v3:order:${id}`, "v3:order", { id, status: "funded" });
      await pruneStoredSpecs(() => 1_000 + 60 * 60_000 + 1);
      expect(get(specKey)).toBeDefined();
      expect(get(preparedKey)).toBeDefined();
    } finally {
      remove(specKey);
      remove(preparedKey);
      remove(`v3:order:${id}`);
    }
  });

  it("prunes seven-day-old unfunded summaries and prepared rows", async () => {
    const id = `UNFUNDED-${process.pid}`;
    const created = new Date(1_000).toISOString();
    put(`v3:spec_summary:${id}`, "v3:spec_summary", {
      order_id: id, created_at: created, brand: "Old", denomination: "5 USD",
      product_value: "", currency: "USD", masked_beneficiary: "••••",
    });
    put(`v3:prepared:${id}`, "v3:prepared", { account_id: "buyer.test" });
    expect(await pruneStoredSpecs(() => 1_000 + 7 * 24 * 60 * 60_000 - 1)).toBe(0);
    expect(get(`v3:spec_summary:${id}`)).toBeDefined();
    expect(await pruneStoredSpecs(() => 1_000 + 7 * 24 * 60 * 60_000 + 1)).toBe(1);
    expect(get(`v3:spec_summary:${id}`)).toBeUndefined();
    expect(get(`v3:prepared:${id}`)).toBeUndefined();
  });

  it("checks an old funded summary only once across sweeps", async () => {
    const id = `FUNDED-SUMMARY-${process.pid}`;
    const summaryKey = `v3:spec_summary:${id}`;
    const retainedKey = `v3:spec_summary_retained:${id}`;
    put(summaryKey, "v3:spec_summary", {
      order_id: id, created_at: new Date(1_000).toISOString(), brand: "Funded",
      denomination: "5 USD", product_value: "", currency: "USD", masked_beneficiary: "••••",
    });
    put(`v3:order:${id}`, "v3:order", { id, status: "funded" });
    const order = vi.spyOn(MockEscrow.prototype, "order");
    try {
      await pruneStoredSpecs(() => 1_000 + 8 * 24 * 60 * 60_000);
      await pruneStoredSpecs(() => 1_000 + 8 * 24 * 60 * 60_000 + 60_000);
      expect(order.mock.calls.filter(([orderId]) => orderId === id)).toHaveLength(1);
      expect(get(summaryKey)).toBeDefined();
      expect(get(retainedKey)).toBeDefined();
    } finally {
      order.mockRestore();
      remove(summaryKey);
      remove(retainedKey);
      remove(`v3:order:${id}`);
    }
  });

  it("retains a submitted summary without checking escrow", async () => {
    const id = `SUBMITTED-SUMMARY-${process.pid}`;
    const summaryKey = `v3:spec_summary:${id}`;
    const retainedKey = `v3:spec_summary_retained:${id}`;
    put(summaryKey, "v3:spec_summary", {
      order_id: id, created_at: new Date(1_000).toISOString(), brand: "Submitted",
      denomination: "5 USD", product_value: "", currency: "USD", masked_beneficiary: "••••",
    });
    put(`v3:submitted:${id}`, "v3:submitted", { submitted_at: new Date(2_000).toISOString() });
    const order = vi.spyOn(MockEscrow.prototype, "order");
    try {
      await pruneStoredSpecs(() => 1_000 + 8 * 24 * 60 * 60_000);
      await pruneStoredSpecs(() => 1_000 + 9 * 24 * 60 * 60_000);
      expect(order.mock.calls.filter(([orderId]) => orderId === id)).toHaveLength(0);
      expect(get(summaryKey)).toBeDefined();
      expect(get(retainedKey)).toBeDefined();
    } finally {
      order.mockRestore();
      remove(summaryKey);
      remove(retainedKey);
      remove(`v3:submitted:${id}`);
    }
  });

  it("retains a summary with invalid created_at and records its first seen time", async () => {
    const id = `INVALID-SUMMARY-${process.pid}`;
    const summaryKey = `v3:spec_summary:${id}`;
    const seenKey = `v3:spec_summary_seen:${id}`;
    put(summaryKey, "v3:spec_summary", {
      order_id: id, created_at: "invalid-date", brand: "Unknown",
      denomination: "5 USD", product_value: "", currency: "USD", masked_beneficiary: "••••",
    });
    try {
      expect(await pruneStoredSpecs(() => 1_000)).toBe(0);
      expect(get(summaryKey)).toBeDefined();
      expect(get(seenKey)).toEqual({ created_at: new Date(1_000).toISOString() });
    } finally {
      remove(summaryKey);
      remove(seenKey);
    }
  });

  it("removes final-order PII after grace but keeps its prepared funding record", async () => {
    const id = "FUL-FINAL01";
    put(`v3:spec:${id}`, "v3:spec", {
      order_id: id,
      quote: { expires_at: new Date(1_000).toISOString() },
      expires_at: new Date(1_000).toISOString(),
    });
    put(`v3:prepared:${id}`, "v3:prepared", {
      account_id: "synthetic.test",
      order: { id, kind: "bank_transfer" },
    });
    put(`v3:final:${id}`, "v3:final", {
      id,
      status: "paid",
      paid_at: String(1_000 * 1_000_000),
    });

    expect(await pruneStoredSpecs(() => 2_000 + 24 * 60 * 60_000)).toBeGreaterThan(0);
    expect(get(`v3:spec:${id}`)).toBeUndefined();
    expect(get(`v3:prepared:${id}`)).toMatchObject({ account_id: "synthetic.test" });
  });

  it("uses denomination range for flexible product validation while keeping the spec canonical", async () => {
    process.env.FULFIL_MODE = "live";
    process.env.SHOPPER_ACCOUNT_ID = "shopper.test";
    const validateOrder = vi.fn(async () => ({ coin_amount: "1" }));
    const quote = vi.fn(async () => ({ amountIn: "1010000", amountOut: "1000000", depositAddress: "" }));
    const rpcResult = new Response(JSON.stringify({
      result: { result: [...Buffer.from(JSON.stringify("00000000"))] },
    }));
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(rpcResult);
    try {
      const result = await shopQuote(
        { account_id: "buyer.test", standard: "nep413", exp: Date.now() + 60_000 },
        {
          country: "VN",
          brand_name: "Flexible Mobile",
          product_value: "30000",
          beneficiary: "+84900000003",
          buyer_email: "range-buyer@example.com",
        },
        {
          brand: async () => ({
            country: "VN",
            slug: "flexible-mobile",
            brand_name: "Flexible Mobile",
            logo_url: "",
            category: "mobile_credits",
            variants: [{
              brand_name: "Flexible Mobile",
              slug: "flexible-mobile",
              family: "mobile",
              category: "mobile_credits",
              logo_url: "",
              kind: "cryptorefills_topup",
              delivery_type: "by_phone",
              products: [{
                denomination: "",
                product_value_range: { min: "10000", max: "50000", currency: "VND" },
                face_value: { amount: "", currency: "VND" },
                cost_usdc: "1",
              }],
            }],
          }),
          cryptorefills: { validateOrder },
          oneClick: { quote },
          clock: () => 1_800_000_000_000,
        },
      );
      expect(validateOrder).toHaveBeenCalledWith({
        brand_name: "Flexible Mobile",
        country_code: "VN",
        beneficiary_account: "+84900000003",
        denomination: "range",
        product_value: "30000",
      });
      expect(result.spec).toMatchObject({ denomination: "", product_value: "30000" });
      expect(result.quote.face_value).toEqual({ amount: "30000", currency: "VND" });
    } finally {
      fetchMock.mockRestore();
      process.env.FULFIL_MODE = "mock";
      process.env.SHOPPER_ACCOUNT_ID = "shopper.test";
    }
  });

  it("finds an unpriced live range by family and quotes its selected value", async () => {
    process.env.FULFIL_MODE = "live";
    process.env.SHOPPER_ACCOUNT_ID = "shopper.test";
    remove("v3:catalog:v3:live:US");
    const listBrands = vi.fn(async () => parseMcpResponse(JSON.stringify(brandsUs)));
    const groups = structuredClone(productsUs.result.structuredContent.result);
    const first = groups[0].products[0];
    groups[0].products = [
      { ...first, range: { ...first.range, min: 2, max: 5 },
        face_value: { ...first.face_value, amount: { ...first.face_value.amount,
          min: "2.00", max: "5.00" } } },
      { ...first, range: { ...first.range, min: 10, max: 20 },
        face_value: { ...first.face_value, amount: { ...first.face_value.amount,
          min: "10.00", max: "20.00" } } },
    ];
    const listProducts = vi.fn(async () => groups);
    const validateOrder = vi.fn(async () => ({ coin_amount: "10.25", extra_field: true }));
    const quote = vi.fn(async () => ({ amountIn: "10300000", amountOut: "10250000", depositAddress: "" }));
    const rpcResult = new Response(JSON.stringify({
      result: { result: [...Buffer.from(JSON.stringify("00000000"))] },
    }));
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(rpcResult);
    try {
      const result = await shopQuote(
        { account_id: "buyer.test", standard: "nep413", exp: Date.now() + 60_000 },
        {
          country: "US",
          brand_name: "Target",
          product_value: "10",
          beneficiary: "buyer@example.com",
          buyer_email: "buyer@example.com",
        },
        {
          cryptorefills: { listBrands, listProducts, validateOrder } as never,
          oneClick: { quote } as never,
          clock: () => 1_800_000_000_000,
        },
      );
      expect(listBrands).toHaveBeenCalledTimes(1);
      expect(listProducts).toHaveBeenCalledTimes(1);
      expect(listProducts).toHaveBeenCalledWith("US", "Target");
      expect(validateOrder).toHaveBeenCalledWith({
        brand_name: "Target",
        country_code: "US",
        beneficiary_account: "buyer@example.com",
        denomination: "range",
        product_value: "10",
      });
      expect(result.quote.face_value).toEqual({ amount: "10", currency: "USD" });
      expect(result.quote.merchant_price).toBe("10250000");
      expect(result.spec).toMatchObject({ denomination: "", product_value: "10" });
    } finally {
      fetchMock.mockRestore();
      process.env.FULFIL_MODE = "mock";
    }
  });
});
