import { createHash, randomBytes } from "node:crypto";
import {
  canonicalJson,
  cryptorefillsSpec,
  normalizeBeneficiary,
  productKind,
  specHash,
  type CryptorefillsKind,
  type DeliveryType,
} from "@fulfil/core";
import { get, list, listEntries, put, remove } from "../db";
import { buildPayload, intentFromInput } from "./intents";
import type { Session } from "./auth";
import { mode } from "./config";
import { escrowBackend } from "./escrow";
import { CryptorefillsClient, CryptorefillsRpcError, requiredString } from "../../../../shopper/src/cryptorefills";
import { HttpError } from "../../../../shopper/src/diagnostics";
import { OneClickClient } from "../../../../shopper/src/oneclick";
import { calculateQuote, quoteOrder, usdcUnits } from "../../../../shopper/src/quote";
import { normalizePhone } from "../../v3-client";

// Static on purpose: Cryptorefills has no country-list tool. A country costs one
// listBrands call; brand products are fetched lazily, one call per opened brand.
const COUNTRY_NAMES: Record<string, string> = {
  VN: "Vietnam", US: "United States", AU: "Australia", GB: "United Kingdom",
  CA: "Canada", DE: "Germany", FR: "France", ES: "Spain", PT: "Portugal", IT: "Italy",
  AE: "United Arab Emirates", IN: "India", ID: "Indonesia", PH: "Philippines",
  TH: "Thailand", SG: "Singapore",
};
// Cryptorefills changes rarely and every quote is re-validated live, so a stale
// catalog can show an old price hint but never mis-charge.
const CATALOG_TTL = 6 * 60 * 60_000;
const BRAND_TTL = 6 * 60 * 60_000;
const COLD_FAILURE_COOLDOWN = 30_000;
const REFRESH_FAILURE_COOLDOWN = 60_000;
const RATE_LIMIT_BREAKER_MS = 5 * 60_000;
const WARM_GAP_MS = 3_000;
const UNFUNDED_RETENTION_MS = 7 * 24 * 60 * 60_000;
const UNFUNDED_QUOTE_GRACE_MS = 60 * 60_000;
const CALL_TIMEOUT = 7_000;
const RETRY_DELAYS = [200, 500];
const BROWSER_USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

export class ShopNotFoundError extends Error {
  constructor(message = "Product not found") { super(message); }
}
export class ShopUpstreamError extends Error {
  constructor() { super("The shop catalog is unavailable. Please try again."); }
}

export function categoryDisplayName(category: string): string {
  const names: Record<string, string> = {
    "e-sim": "eSIM", esim: "eSIM", eSIM: "eSIM",
    mobile_credits: "Mobile top-up", mobile_data: "Mobile data",
    giftcards: "Gift cards", gift_cards: "Gift cards", games: "Games",
    "e-commerce": "Online shopping", retail: "Shopping",
  };
  return names[category] ?? category.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export type ShopProduct = {
  denomination: string;
  label?: string;
  product_value_range?: { min: string; max: string; currency: string };
  face_value: { amount: string; currency: string };
  cost_usdc: string;
};
/** One purchasable variant of a brand (kind and delivery come from its products). */
export type ShopBrand = {
  brand_name: string;
  slug?: string;
  family: string;
  category: string;
  logo_url: string;
  kind: CryptorefillsKind;
  delivery_type: DeliveryType;
  products: ShopProduct[];
};
/** A listBrands row: enough to render the catalog grid without any product call. */
export type ShopListing = {
  brand_name: string;
  slug: string;
  family: string;
  brand_id?: string;
  logo_url: string;
  bg_color?: string;
  category: string;
  listing_kind: "giftcard" | "mobile_recharge";
  product_type?: string;
  price_range?: string;
};
export type ShopCatalog = {
  country: string;
  categories: { category: string; display_name?: string; brands: ShopListing[] }[];
};
export type ShopBrandDetail = {
  country: string;
  slug: string;
  brand_name: string;
  logo_url: string;
  category: string;
  variants: ShopBrand[];
};
export type SpecSummary = {
  order_id?: string;
  created_at?: string;
  brand: string;
  denomination: string;
  product_value: string;
  currency: string;
  masked_beneficiary: string;
};

export function maskBeneficiary(value: string): string {
  return value.length > 4 ? `${value.slice(0, 2)}••••${value.slice(-2)}` : "••••";
}

export function storedSpecSummary(id: string): SpecSummary | undefined {
  const stored = get<SpecSummary>(`v3:spec_summary:${id}`);
  if (!stored) return undefined;
  const { order_id: _orderId, created_at: _createdAt, ...publicSummary } = stored;
  return publicSummary;
}
export type StoredSpec = {
  order_id: string;
  kind: string;
  spec: string;
  spec_hash: string;
  beneficiary: string;
  buyer_email: string;
  buyer: string;
  quoted_by: string | null;
  quote: Record<string, unknown>;
  expires_at: string;
  created_at?: string;
};

const mockBrands = {
  categories: [
    {
      category: "mobile_credits",
      brands: [
        {
          brand: "Viettel Mobile Credits",
          family: "mobile",
          brand_id: "mock-viettel",
          logo_url: "https://assets.example.invalid/viettel.png",
          category: "mobile_credits",
          kind: "mobile_recharge",
          min: "10,000₫",
          max: "50,000₫",
          is_out_of_stock: false,
        },
        {
          brand: "Out of stock",
          family: "mobile",
          brand_id: "mock-out",
          logo_url: "",
          category: "mobile_credits",
          kind: "mobile_recharge",
          is_out_of_stock: true,
        },
      ],
    },
    {
      category: "games",
      brands: [
        {
          brand: "Synthetic Game Card",
          family: "games",
          brand_id: "mock-game",
          logo_url: "https://assets.example.invalid/game-card.png",
          category: "games",
          kind: "giftcard",
          min: "$5",
          max: "$5",
          is_out_of_stock: false,
        },
      ],
    },
    {
      category: "e-sim",
      brands: [{
        brand: "Travel eSIM",
        family: "travel",
        brand_id: "mock-esim",
        logo_url: "https://assets.example.invalid/esim.png",
        category: "e-sim",
        kind: "giftcard",
        min: "$5",
        max: "$5",
        is_out_of_stock: false,
      }],
    },
  ],
};
const mockProducts = {
  products: [
    {
      brand_name: "Viettel Mobile Credits",
      denomination: "20000 VND",
      coin_amount: "0.89",
      delivery_type: "by_phone",
      face_value: { amount: "20000", currency: "VND" },
    },
    {
      brand_name: "Viettel Mobile Credits",
      denomination: "10000 VND",
      coin_amount: "0.4",
      delivery_type: "by_phone",
      face_value: { amount: "10000", currency: "VND" },
    },
    {
      brand_name: "Viettel Mobile Credits",
      denomination: "range",
      min: "10000",
      max: "50000",
      currency: "VND",
      coin_amount: "1.1",
      delivery_type: "by_phone",
      face_value: { amount: "", currency: "VND" },
    },
    {
      brand_name: "Synthetic Game Card",
      denomination: "5 USD",
      coin_amount: "5.2",
      delivery_type: "by_email",
      face_value: { amount: "5", currency: "USD" },
    },
    {
      brand_name: "Travel eSIM",
      denomination: "1 GB 3 days",
      data_amount: "1",
      duration_days: 3,
      coin_amount: "5.2",
      delivery_type: "by_email",
      face_value: { amount: "5", currency: "USD" },
    },
  ],
};

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Cryptorefills upstream response has an unknown shape");
  }
  return value as Record<string, unknown>;
}
function array(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    throw new Error("Cryptorefills upstream response has an unknown shape");
  }
  return value.map(record);
}
function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}
function price(value: unknown): string {
  const input = String(value ?? "");
  return /^\d+(?:\.\d{1,6})?$/.test(input) ? input : "";
}
function decimal(value: unknown): string {
  const input = String(value ?? "");
  return /^\d+(?:\.\d+)?$/.test(input) ? input : "";
}
function productRows(value: unknown): Record<string, unknown>[] {
  const groups = Array.isArray(value) ? value.map(record) : [record(value)];
  return groups.flatMap((group) => array(group.products ?? group.items).map((product) => ({
    ...group,
    ...product,
    brand_name: product.brand_name ?? product.brand ?? group.brand_name ?? group.brand,
    family: product.family ?? group.family,
    category: group.category ?? product.category,
    product_category: product.category,
    kind: group.kind ?? product.kind,
    product_kind: product.kind,
    logo_url: group.logo_url ?? product.logo_url,
    is_out_of_stock: group.is_out_of_stock === true || product.is_out_of_stock === true,
  })));
}

export { productKind };
function faceValue(product: Record<string, unknown>) {
  const face = product.face_value ? record(product.face_value) : {};
  const amount = face.amount && typeof face.amount === "object" ? record(face.amount) : null;
  return {
    amount: amount?.type === "fixed" ? decimal(amount.price) : decimal(face.amount),
    currency: text(face.currency_code ?? face.currency),
    range: amount?.type === "range" ? amount : null,
  };
}
function productRange(product: Record<string, unknown>) {
  const face = faceValue(product);
  const range = product.product_value_range ? record(product.product_value_range)
    : product.range ? record(product.range)
      : face.range ?? (product.denomination === "range" ? product : null);
  if (!range) return null;
  const min = decimal(face.range?.min ?? range.min);
  const max = decimal(face.range?.max ?? range.max);
  const currency = face.currency || text(range.currency);
  return min && max && currency ? { min, max, currency } : null;
}
function usdcDecimal(units: string): string {
  const whole = BigInt(units) / BigInt(1_000_000);
  const fraction = (BigInt(units) % BigInt(1_000_000)).toString()
    .padStart(6, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : String(whole);
}

export function esimLabel(product: Record<string, unknown>, category: string): string | undefined {
  if (!/e.?sim/i.test(category)) return undefined;
  const explicit = (value: unknown, units: RegExp): string => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const field = value as Record<string, unknown>;
      return explicit(`${field.amount ?? field.value ?? ""} ${field.unit ?? ""}`, units);
    }
    const match = String(value ?? "").match(units);
    return match ? match[0].replace(/\s+/g, " ").trim() : "";
  };
  const denomination = text(product.denomination);
  const data = explicit(product.data_amount ?? product.data ?? product.data_allowance,
    /\b\d+(?:\.\d+)?\s*(?:GB|MB)\b/i) ||
    (product.data_gb !== undefined ? `${product.data_gb} GB` : "") ||
    explicit(denomination, /\b\d+(?:\.\d+)?\s*(?:GB|MB)\b/i);
  const duration = explicit(product.duration ?? product.validity,
    /\b\d+\s*(?:days?|weeks?)\b/i) ||
    (product.duration_days !== undefined ? `${product.duration_days} days` : "") ||
    (product.validity_days !== undefined ? `${product.validity_days} days` : "") ||
    explicit(denomination, /\b\d+\s*(?:days?|weeks?)\b/i);
  return data && duration ? `${data} · ${duration}` : denomination || undefined;
}

function dedupeProducts(items: ShopProduct[]): ShopProduct[] {
  const unique = new Map<string, ShopProduct>();
  for (const item of items) {
    const key = item.product_value_range
      ? `range:${JSON.stringify(item.product_value_range)}`
      : `fixed:${item.denomination.toLowerCase()}`;
    const previous = unique.get(key);
    if (!previous || BigInt(item.cost_usdc) < BigInt(previous.cost_usdc)) unique.set(key, item);
  }
  return [...unique.values()];
}

/** Deterministic from listBrands data alone (delivery type is per product, so it is not part of it). */
export function listingSlug(
  name: string, family: string, listingKind: string, brandId = "",
): string {
  const stem = name.normalize("NFKD").toLowerCase().replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "brand";
  const hash = createHash("sha256")
    .update(`${name}\u0000${family}\u0000${listingKind}\u0000${brandId}`.toLowerCase())
    .digest("hex").slice(0, 8);
  return `${stem}-${hash}`;
}

function priceRange(min: string, max: string): string | undefined {
  if (min && max) return min === max ? min : `${min} – ${max}`;
  if (min) return `From ${min}`;
  if (max) return `Up to ${max}`;
  return undefined;
}

/** Country catalog from a single listBrands response; no product data. */
export function catalogFromBrands(country: string, brandsResult: unknown): ShopCatalog {
  const groups = array(record(brandsResult).categories);
  const grouped = new Map<string, ShopListing[]>();
  const seen = new Set<string>();
  for (const group of groups) {
    for (const row of array(group.brands)) {
      if (row.is_out_of_stock === true) continue;
      const brandName = text(row.brand ?? row.brand_name);
      if (!brandName) continue;
      const family = text(row.family);
      const listingKind = row.kind === "mobile_recharge" ? "mobile_recharge" : "giftcard";
      const brandId = text(row.brand_id);
      const slug = listingSlug(brandName, family, listingKind, brandId);
      // A brand is repeated under additional categories; list it once.
      if (seen.has(slug)) continue;
      seen.add(slug);
      const category = text(row.category) || text(group.category) || "other";
      const listing: ShopListing = {
        brand_name: brandName,
        slug,
        family,
        ...(brandId ? { brand_id: brandId } : {}),
        logo_url: text(row.logo_url),
        ...(text(row.bg_color) ? { bg_color: text(row.bg_color) } : {}),
        category,
        listing_kind: listingKind,
        ...(text(row.product_type) ? { product_type: text(row.product_type) } : {}),
        ...(priceRange(text(row.min), text(row.max))
          ? { price_range: priceRange(text(row.min), text(row.max)) } : {}),
      };
      const list = grouped.get(category) ?? [];
      list.push(listing);
      grouped.set(category, list);
    }
  }
  return {
    country,
    categories: [...grouped].map(([category, brands]) => ({
      category, display_name: categoryDisplayName(category), brands,
    })),
  };
}

/** Purchasable variants of one listed brand from its listProductsForCountry response. */
export function brandVariantsFromMcp(listing: ShopListing, productsResult: unknown): ShopBrand[] {
  const variants = new Map<string, ShopBrand>();
  for (const product of productRows(productsResult)) {
    if (text(product.brand_name) !== listing.brand_name) continue;
    if (listing.family && text(product.family) && text(product.family) !== listing.family) continue;
    const delivery = text(product.delivery_type);
    if (delivery !== "by_phone" && delivery !== "by_email") continue;
    if (product.is_out_of_stock === true || (product.coin && product.coin !== "USDC")) continue;
    const cost = price(product.coin_amount ?? product.cost_usdc);
    if (!cost || usdcUnits(cost) < BigInt(600_000)) continue;
    const denominationText = text(product.denomination);
    const isRange = product.is_dynamic === true || denominationText === "range" ||
      faceValue(product).range !== null;
    const range = isRange ? productRange(product) : null;
    if (isRange && !range) continue;
    const denomination = isRange ? "" : denominationText;
    if (!denomination && !range) continue;
    const category = text(product.category) || listing.category;
    const deliveryType = delivery as DeliveryType;
    const kind = productKind(product, deliveryType, category);
    if (kind === "cryptorefills_code" && deliveryType !== "by_email") continue;
    const face = faceValue(product);
    const label = esimLabel(product, category);
    const item: ShopProduct = {
      denomination,
      ...(label ? { label } : {}),
      ...(range ? { product_value_range: range } : {}),
      face_value: {
        amount: face.amount || denomination.match(/^\d+(?:\.\d+)?/)?.[0] || "",
        currency: face.currency || (range?.currency ?? denomination.split(" ").at(-1) ?? ""),
      },
      cost_usdc: usdcUnits(cost).toString(),
    };
    const key = `${category}:${kind}:${delivery}`;
    let variant = variants.get(key);
    if (!variant) {
      variant = {
        brand_name: listing.brand_name,
        slug: listing.slug,
        family: listing.family || text(product.family),
        category,
        logo_url: listing.logo_url || text(product.logo_url),
        kind,
        delivery_type: deliveryType,
        products: [],
      };
      variants.set(key, variant);
    }
    variant.products.push(item);
  }
  return [...variants.values()].map((variant) => ({
    ...variant, products: dedupeProducts(variant.products),
  }));
}

type CatalogClient = Pick<CryptorefillsClient, "listBrands" | "listProducts">;
type CacheEntry<T> = { until: number; value: T };
const pendingLoads = new Map<string, Promise<unknown>>();
const refreshCooldown = new Map<string, number>();
const coldFailureCooldown = new Map<string, number>();
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// Process-wide: after a 429 the IP is blocked for a few minutes, so catalog and
// brand loads stop touching Cryptorefills and serve cache, leaving the rest of the
// budget to quotes.
let rateLimitedUntil = 0;
export function catalogBlocked(now: number): boolean {
  return rateLimitedUntil > now;
}
export function resetCatalogBreaker(): void {
  rateLimitedUntil = 0;
}

function isRateLimited(cause: unknown): boolean {
  if (cause instanceof HttpError) return cause.status === 429;
  if (cause instanceof CryptorefillsRpcError) {
    return /rate.?limit|too many requests/i.test(cause.detail);
  }
  return !!cause && typeof cause === "object" && (cause as { status?: unknown }).status === 429;
}

export async function retryCatalogCall<T>(
  call: () => Promise<T>,
  options: {
    timeoutMs?: number;
    delays?: number[];
    sleep?: (ms: number) => Promise<void>;
    now?: () => number;
  } = {},
): Promise<T> {
  const delays = options.delays ?? RETRY_DELAYS;
  for (let attempt = 0; ; attempt += 1) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        call(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new ShopUpstreamError()), options.timeoutMs ?? CALL_TIMEOUT);
        }),
      ]);
    } catch (cause) {
      if (isRateLimited(cause)) {
        // Retrying a rate limit only extends the block.
        rateLimitedUntil = Math.max(rateLimitedUntil,
          (options.now ?? Date.now)() + RATE_LIMIT_BREAKER_MS);
        throw new ShopUpstreamError();
      }
      if (attempt >= delays.length) throw new ShopUpstreamError();
      await (options.sleep ?? sleep)(delays[attempt]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}

/**
 * Stale-while-revalidate over the SQLite store: fresh entries are returned as is,
 * stale ones are returned immediately while one background load refreshes them,
 * and a cold miss waits for the single in-flight load.
 */
async function cachedLoad<T>(
  key: string,
  kind: string,
  ttl: number,
  clock: () => number,
  load: () => Promise<T>,
): Promise<T> {
  const cached = get<CacheEntry<T>>(key);
  if (cached && cached.until > clock()) return cached.value;
  if (cached && (catalogBlocked(clock()) || (refreshCooldown.get(key) ?? 0) > clock())) {
    return cached.value;
  }
  const pending = pendingLoads.get(key) as Promise<T> | undefined;
  if (pending) return cached?.value ?? pending;
  if (!cached && (catalogBlocked(clock()) || (coldFailureCooldown.get(key) ?? 0) > clock())) {
    throw new ShopUpstreamError();
  }
  const loading = (async () => {
    const value = await load();
    put(key, kind, { until: clock() + ttl, value } satisfies CacheEntry<T>);
    refreshCooldown.delete(key);
    coldFailureCooldown.delete(key);
    return value;
  })();
  pendingLoads.set(key, loading);
  void loading.finally(() => pendingLoads.delete(key)).catch(() => undefined);
  if (cached) {
    void loading.catch(() => { refreshCooldown.set(key, clock() + REFRESH_FAILURE_COOLDOWN); });
    return cached.value;
  }
  void loading.catch(() => { coldFailureCooldown.set(key, clock() + COLD_FAILURE_COOLDOWN); });
  return loading;
}

function catalogKey(country: string, currentMode: string): string {
  return `v3:catalog:v3:${currentMode}:${country}`;
}
function brandKey(country: string, slug: string, currentMode: string): string {
  return `v3:brand:v1:${currentMode}:${country}:${slug}`;
}

function defaultCatalogClient(): CatalogClient {
  return webCryptorefillsClient();
}

function webCryptorefillsClient(): CryptorefillsClient {
  return new CryptorefillsClient((input, init) => fetch(input, {
    ...init,
    headers: { ...init?.headers, "User-Agent": BROWSER_USER_AGENT },
    signal: AbortSignal.timeout(CALL_TIMEOUT),
  }));
}

/** Country brand list: exactly one upstream listBrands call per refresh. */
export async function shopCatalog(
  country = "VN",
  client: CatalogClient = defaultCatalogClient(),
  clock: () => number = Date.now,
): Promise<ShopCatalog> {
  if (!COUNTRY_NAMES[country]) throw new ShopNotFoundError("Country not found");
  const currentMode = mode();
  return cachedLoad(catalogKey(country, currentMode), "v3:catalog", CATALOG_TTL, clock, async () => {
    const brands = currentMode === "mock" ? mockBrands
      : await retryCatalogCall(() => client.listBrands(country), { now: clock });
    try {
      return catalogFromBrands(country, brands);
    } catch {
      throw new ShopUpstreamError();
    }
  });
}

function findListing(catalog: ShopCatalog, slugOrName: string): ShopListing | undefined {
  const listings = catalog.categories.flatMap((category) => category.brands);
  return listings.find((item) => item.slug === slugOrName) ??
    listings.find((item) => item.brand_name === slugOrName);
}

/** Products of one brand: one listProductsForCountry call, cached per country and brand. */
export async function shopBrand(
  country: string,
  slugOrName: string,
  client: CatalogClient = defaultCatalogClient(),
  clock: () => number = Date.now,
): Promise<ShopBrandDetail> {
  const catalog = await shopCatalog(country, client, clock);
  const listing = findListing(catalog, slugOrName);
  if (!listing) throw new ShopNotFoundError("Brand not found");
  const currentMode = mode();
  return cachedLoad(brandKey(country, listing.slug, currentMode), "v3:brand", BRAND_TTL, clock, async () => {
    const products = currentMode === "mock" ? mockProducts
      : await retryCatalogCall(() => client.listProducts(country, listing.family), { now: clock });
    let variants: ShopBrand[];
    try {
      variants = brandVariantsFromMcp(listing, products);
    } catch {
      throw new ShopUpstreamError();
    }
    return {
      country, slug: listing.slug, brand_name: listing.brand_name,
      logo_url: listing.logo_url, category: listing.category, variants,
    };
  });
}

export async function shopPopular(country = "VN") {
  const catalog = await shopCatalog(country);
  return popularFromCatalog(catalog);
}

export function popularFromCatalog(catalog: ShopCatalog): ShopListing[] {
  const country = catalog.country;
  const curated: Record<string, string[]> = {
    VN: ["viettel", "mobifone", "vinaphone", "steam", "lazada"],
    US: ["amazon", "steam", "netflix", "target"],
    DE: ["telekom", "vodafone", "amazon", "steam"],
    GB: ["ee", "vodafone", "amazon", "steam"],
    IN: ["airtel", "jio", "amazon"],
    PH: ["globe", "smart", "shopee"],
    TH: ["ais", "dtac", "true"],
    SG: ["singtel", "starhub", "amazon"],
    AU: ["boost", "lebara", "lycamobile", "amazon", "steam"],
    CA: ["bell", "telus", "koodo", "amazon", "steam"],
    FR: ["free", "lebara", "lyca", "amazon", "steam"],
    ES: ["blau", "digimobil", "amazon", "steam"],
    IT: ["iliad", "ho mobile", "kena", "amazon", "steam"],
    AE: ["du credits", "etisalat", "virgin", "amazon", "steam"],
    ID: ["telkomsel", "indosat", "axis", "steam"],
    PT: ["meo", "nos", "vodafone", "amazon", "steam"],
  };
  const rank = curated[country] ?? [];
  const unique = new Map<string, ShopListing>();
  for (const category of catalog.categories) {
    for (const brand of category.brands) {
      if (!unique.has(brand.brand_name.toLowerCase())) unique.set(brand.brand_name.toLowerCase(), brand);
    }
  }
  const position = (brand: ShopListing) => {
    const found = rank.findIndex((name) => brand.brand_name.toLowerCase().includes(name));
    return found === -1 ? 100 : found;
  };
  // Array.prototype.sort is stable: ties keep the upstream listing order.
  const sorted = [...unique.values()].sort((a, b) =>
    Number(b.listing_kind === "mobile_recharge") - Number(a.listing_kind === "mobile_recharge") ||
    position(a) - position(b));
  const selected: ShopListing[] = [];
  const counts = new Map<string, number>();
  for (const item of sorted) {
    if (selected.length >= 6) break;
    if ((counts.get(item.category) ?? 0) >= 2) continue;
    selected.push(item);
    counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
  }
  for (const item of sorted) {
    if (selected.length >= 6) break;
    if (!selected.includes(item)) selected.push(item);
  }
  return selected;
}

export async function shopCountries(
  _client: CatalogClient = defaultCatalogClient(),
  _clock: () => number = Date.now,
) {
  return Object.entries(COUNTRY_NAMES).map(([code, name]) => ({
    code, name,
    brand_count: get<CacheEntry<ShopCatalog>>(catalogKey(code, mode()))?.value.categories
      .reduce((count, category) => count + category.brands.length, 0) ?? 0,
  }));
}

/** Loads the brand list (listBrands only) of every country that has no cache entry yet. */
export async function warmCatalog(options: {
  client?: CatalogClient;
  clock?: () => number;
  gapMs?: number;
  sleep?: (ms: number) => Promise<void>;
} = {}): Promise<void> {
  const clock = options.clock ?? Date.now;
  for (const country of Object.keys(COUNTRY_NAMES)) {
    if (mode() === "mock" || catalogBlocked(clock())) return;
    if (get(catalogKey(country, mode()))) continue;
    await shopCatalog(country, options.client, clock).catch(() => undefined);
    await (options.sleep ?? sleep)(options.gapMs ?? WARM_GAP_MS);
  }
}

let warming = false;
let nextWarm = 0;
export function warmCatalogInBackground(): void {
  if (warming || mode() === "mock" || process.env.NODE_ENV === "test") return;
  if (nextWarm > Date.now()) return;
  warming = true;
  nextWarm = Date.now() + 60_000;
  void warmCatalog().finally(() => { warming = false; });
}

type EstimateFee = { until: number; fee: string };
const pendingFees = new Map<string, Promise<string>>();
const feeFailureCooldown = new Map<string, number>();

export async function shopEstimate(
  country: string,
  brandInput: string,
  dependencies: {
    brand?: typeof shopBrand;
    oneClick?: Pick<OneClickClient, "quote">;
    clock?: () => number;
  } = {},
) {
  const clock = dependencies.clock ?? Date.now;
  const brand = await (dependencies.brand ?? shopBrand)(country, brandInput);
  const unique = new Map<string, ShopProduct>();
  for (const variant of brand.variants) {
    for (const item of variant.products) {
      if (!item.product_value_range && item.cost_usdc && !unique.has(item.denomination)) {
        unique.set(item.denomination, item);
      }
    }
  }
  const products = [...unique.values()];
  if (!products.length) return { country, brand: brand.slug, estimated: true, products: [] };
  const cacheKey = `v3:estimate_fee:${mode()}:${country}:${brand.slug}`;
  const cached = get<EstimateFee>(cacheKey);
  let fee = cached?.until && cached.until > clock() ? cached.fee : undefined;
  if (!fee) {
    let pending = pendingFees.get(cacheKey);
    if (!pending) {
      if ((feeFailureCooldown.get(cacheKey) ?? 0) > clock()) throw new ShopUpstreamError();
      pending = (async () => {
        const sample = products[Math.floor(products.length / 2)];
        const merchant = BigInt(sample.cost_usdc);
        if (mode() === "mock") return ((merchant + BigInt(99)) / BigInt(100)).toString();
        const oneClick = dependencies.oneClick ?? new OneClickClient((input, init) => fetch(input, {
          ...init,
          signal: AbortSignal.timeout(CALL_TIMEOUT),
        }));
        const quotedBy = process.env.SHOPPER_ACCOUNT_ID || "shopper.near";
        const result = await oneClick.quote({
          dry: true,
          amount: merchant.toString(),
          recipient: process.env.SHOPPER_QUOTE_RECIPIENT ||
            "0x0000000000000000000000000000000000000001",
          refundTo: quotedBy,
        });
        return (BigInt(result.amountIn) > BigInt(result.amountOut)
          ? BigInt(result.amountIn) - BigInt(result.amountOut) : BigInt(0)).toString();
      })();
      pendingFees.set(cacheKey, pending);
      void pending.finally(() => pendingFees.delete(cacheKey)).catch(() => undefined);
    }
    try {
      fee = await pending;
      put(cacheKey, "v3:estimate_fee", { until: clock() + CATALOG_TTL, fee } satisfies EstimateFee);
      feeFailureCooldown.delete(cacheKey);
    } catch {
      feeFailureCooldown.set(cacheKey, clock() + COLD_FAILURE_COOLDOWN);
      throw new ShopUpstreamError();
    }
  }
  return {
    country,
    brand: brand.slug,
    estimated: true,
    products: products.map((product) => ({
      denomination: product.denomination,
      total: calculateQuote(
        BigInt(product.cost_usdc),
        BigInt(product.cost_usdc) + BigInt(fee),
        BigInt(product.cost_usdc),
        clock(),
      ).total,
    })),
  };
}

export function storedSpec(id: string): StoredSpec | undefined {
  return get<StoredSpec>(`v3:spec:${id}`);
}

export async function pruneStoredSpecs(clock: () => number = Date.now): Promise<number> {
  let removed = 0;
  const backend = escrowBackend();
  for (const stored of list<StoredSpec>("v3:spec")) {
    // Older bank-transfer records predate quote storage. They are still valid
    // spec records and must not break a later opportunistic sweep.
    const quoteExpires = Date.parse(String(stored.quote?.expires_at || stored.expires_at));
    if (Number.isFinite(quoteExpires) && quoteExpires >= clock()) {
      continue;
    }
    let order;
    try {
      order = await backend.order(stored.order_id);
    } catch {
      continue;
    }
    const submitted = get(`v3:submitted:${stored.order_id}`);
    const expiredUnfunded = !order && !submitted &&
      Number.isFinite(quoteExpires) && quoteExpires + UNFUNDED_QUOTE_GRACE_MS < clock();
    const final = order && ["paid", "closed", "resolved", "cancelled", "expired"]
      .includes(order.status);
    const finalAtNs = order?.ended_at || order?.paid_at;
    const finalGraceElapsed = final && finalAtNs &&
      Number(BigInt(finalAtNs) / BigInt(1_000_000)) +
        24 * 60 * 60_000 < clock();
    if (expiredUnfunded || finalGraceElapsed) {
      remove(`v3:spec:${stored.order_id}`);
      if (stored.kind === "in_person") remove(`v3:meetup:${stored.order_id}`);
      if (expiredUnfunded && stored.kind === "token_buy") {
        remove(`v3:token_public:${stored.order_id}`);
      }
      // The prepared order has no beneficiary or buyer email. Keep it after
      // finalization because bank order views use it to verify merchant data.
      if (expiredUnfunded) remove(`v3:prepared:${stored.order_id}`);
      removed += 1;
    }
  }
  for (const entry of listEntries<SpecSummary>("v3:spec_summary")) {
    const summary = entry.value;
    const id = summary.order_id ?? entry.key.slice("v3:spec_summary:".length);
    const retainedKey = `v3:spec_summary_retained:${id}`;
    if (get(retainedKey)) continue;
    let createdAt = summary.created_at;
    if (!createdAt || !Number.isFinite(Date.parse(createdAt))) {
      const seenKey = `v3:spec_summary_seen:${id}`;
      createdAt = get<{ created_at: string }>(seenKey)?.created_at;
      if (!createdAt || !Number.isFinite(Date.parse(createdAt))) {
        createdAt = new Date(clock()).toISOString();
        put(seenKey, "v3:spec_summary_seen", { created_at: createdAt });
      }
    }
    if (Date.parse(createdAt) + UNFUNDED_RETENTION_MS >= clock()) continue;
    if (get(`v3:submitted:${id}`)) {
      put(retainedKey, "v3:spec_summary_retained", { retained_at: new Date(clock()).toISOString() });
      continue;
    }
    let order;
    try {
      order = await backend.order(id);
    } catch {
      continue;
    }
    if (order || get(`v3:submitted:${id}`)) {
      put(retainedKey, "v3:spec_summary_retained", { retained_at: new Date(clock()).toISOString() });
      continue;
    }
    remove(entry.key);
    remove(`v3:spec:${id}`);
    remove(`v3:token_public:${id}`);
    remove(`v3:meetup:${id}`);
    remove(`v3:prepared:${id}`);
    remove(`v3:spec_summary_seen:${id}`);
    removed += 1;
  }
  for (const entry of listEntries<{ expires_at?: string }>("v3:meetup")) {
    const id = entry.key.slice("v3:meetup:".length);
    const expiresAt = entry.value.expires_at ?? storedSpec(id)?.expires_at;
    const expiresMs = Date.parse(String(expiresAt ?? ""));
    if (!Number.isFinite(expiresMs) || expiresMs < clock()) {
      remove(entry.key);
      removed += 1;
    }
  }
  return removed;
}

let nextSpecSweep = 0;
let sweepPending: Promise<number> | undefined;
export async function pruneStoredSpecsIfDue(
  clock: () => number = Date.now,
  sweep: (clock: () => number) => Promise<number> = pruneStoredSpecs,
): Promise<number> {
  const time = clock();
  if (sweepPending) return sweepPending;
  if (time < nextSpecSweep && time >= nextSpecSweep - 60_000) return 0;
  nextSpecSweep = time + 60_000;
  sweepPending = sweep(clock).finally(() => { sweepPending = undefined; });
  return sweepPending;
}

type QuoteBrand = Pick<ShopBrand, "kind" | "delivery_type">;
type QuoteProduct = Omit<ShopProduct, "cost_usdc"> & { cost_usdc?: string };

async function liveRangeSelection(
  country: string,
  brandName: string,
  productValue: string,
  requestedSlug: string,
  client: CatalogClient,
  clock: () => number,
): Promise<{ brand: QuoteBrand; product: QuoteProduct } | null> {
  // The brand list comes from the cached country catalog; only the families of the
  // matching listings are fetched live, because unpriced ranges are not cached.
  const catalog = await shopCatalog(country, client, clock);
  const listed = catalog.categories.flatMap((category) => category.brands)
    .filter((listing) => listing.brand_name === brandName &&
      (!requestedSlug || listing.slug === requestedSlug));
  const families = [...new Set(listed.map((listing) => listing.family).filter(Boolean))];
  const selections: { brand: QuoteBrand; product: QuoteProduct }[] = [];
  for (const family of families) {
    const groups = await retryCatalogCall(() => client.listProducts(country, family), { now: clock });
    let products: Record<string, unknown>[];
    try {
      products = productRows(groups);
    } catch {
      throw new ShopUpstreamError();
    }
    for (const candidate of products) {
      if (text(candidate.brand_name) !== brandName || candidate.is_out_of_stock === true ||
        (candidate.coin && candidate.coin !== "USDC")) continue;
      const categoryListing = listed.find((listing) => listing.family === family &&
        (!text(candidate.family) || text(candidate.family) === listing.family));
      if (!categoryListing) continue;
      const range = productRange(candidate);
      const delivery = text(candidate.delivery_type);
      if (!range || (delivery !== "by_phone" && delivery !== "by_email") ||
        candidate.is_dynamic !== true || !decimal(productValue) ||
        Number(productValue) < Number(range.min) ||
        Number(productValue) > Number(range.max)) continue;
      const category = text(candidate.category) || categoryListing.category;
      const deliveryType = delivery as DeliveryType;
      const kind = productKind(candidate, deliveryType, category);
      if (kind === "cryptorefills_code" && deliveryType !== "by_email") continue;
      selections.push({
        brand: { kind, delivery_type: deliveryType },
        product: {
          denomination: "",
          product_value_range: range,
          face_value: { amount: "", currency: range.currency },
        },
      });
    }
  }
  if (selections.length > 1) throw new Error("Ambiguous product selection");
  return selections[0] ?? null;
}

export async function shopQuote(
  session: Session,
  input: Record<string, unknown>,
  dependencies?: {
    catalog?: typeof shopCatalog;
    brand?: typeof shopBrand;
    cryptorefills?: Pick<CryptorefillsClient, "validateOrder"> &
      Partial<Pick<CryptorefillsClient, "listBrands" | "listProducts">>;
    oneClick?: Pick<OneClickClient, "quote">;
    clock?: () => number;
  },
) {
  await pruneStoredSpecsIfDue(dependencies?.clock ?? Date.now);
  const country = String(input.country ?? "VN");
  const brandName = String(input.brand_name ?? "");
  const requestedSlug = String(input.brand_slug ?? "");
  const denomination = input.denomination === undefined ? "" : String(input.denomination);
  const productValue = input.product_value === undefined ? "" : String(input.product_value);
  if (!COUNTRY_NAMES[country]) throw new ShopNotFoundError("Country not found");
  if (!!denomination === !!productValue) {
    throw new Error("Invalid product selection");
  }
  const cryptorefills = dependencies?.cryptorefills ?? webCryptorefillsClient();
  let brand: QuoteBrand | undefined;
  let product: QuoteProduct | undefined;
  const clock = dependencies?.clock ?? Date.now;
  const catalogClient = "listBrands" in cryptorefills && "listProducts" in cryptorefills
    ? cryptorefills as CatalogClient : undefined;
  if (productValue && mode() === "live" && !dependencies?.catalog && !dependencies?.brand) {
    const selected = await liveRangeSelection(country, brandName, productValue, requestedSlug,
      catalogClient ?? webCryptorefillsClient(), clock);
    brand = selected?.brand;
    product = selected?.product;
  } else {
    const loadBrand = dependencies?.brand ?? ((c: string, slug: string) =>
      shopBrand(c, slug, catalogClient, clock));
    let slugs: string[];
    if (dependencies?.brand && !dependencies.catalog) {
      slugs = [requestedSlug || brandName];
    } else {
      const catalog = await (dependencies?.catalog ?? shopCatalog)(country, catalogClient, clock);
      slugs = catalog.categories.flatMap((category) => category.brands)
        .filter((listing) => listing.brand_name === brandName &&
          (!requestedSlug || listing.slug === requestedSlug))
        .map((listing) => listing.slug);
    }
    const details = await Promise.all(slugs.map((slug) => loadBrand(country, slug)));
    const matching = details.flatMap((detail) => detail.variants)
      .filter((candidate) => candidate.brand_name === brandName &&
        candidate.products.some((item) => denomination
          ? item.denomination === denomination
          : !!item.product_value_range));
    if (matching.length > 1) throw new Error("Ambiguous product selection");
    const selected = matching[0];
    brand = selected;
    product = selected?.products.find((item) => denomination
      ? item.denomination === denomination
      : !!item.product_value_range);
  }
  if (!brand) throw new ShopNotFoundError("Brand not found");
  if (!product) {
    throw new ShopNotFoundError();
  }
  if ((brand.kind === "cryptorefills_topup" && brand.delivery_type !== "by_phone") ||
    (brand.kind === "cryptorefills_code" && brand.delivery_type !== "by_email")) {
    throw new ShopNotFoundError("Product not available");
  }
  if (productValue && (
    !/^\d+(?:\.\d+)?$/.test(productValue) ||
    Number(productValue) < Number(product.product_value_range?.min) ||
    Number(productValue) > Number(product.product_value_range?.max)
  )) {
    throw new Error("Product value out of range");
  }
  const beneficiary = normalizeBeneficiary(String(input.beneficiary ?? ""), brand.delivery_type);
  if (brand.delivery_type === "by_phone" && normalizePhone(beneficiary, country) !== beneficiary) {
    throw new Error(`Phone number must be a valid ${COUNTRY_NAMES[country]} number`);
  }
  const buyerEmail = normalizeBeneficiary(String(input.buyer_email ?? ""), "by_email");
  const quotedBy = process.env.SHOPPER_ACCOUNT_ID || (mode() === "mock" ? "shopper.mock.near" : "");
  if (!quotedBy) {
    throw new Error("SHOPPER_ACCOUNT_ID is required in live mode");
  }
  const delivery = {
    brand_name: brandName,
    country_code: country,
    beneficiary_account: beneficiary,
    ...(denomination
      ? { denomination }
      : { denomination: "range", product_value: productValue }),
  };
  const oneClick = dependencies?.oneClick ?? new OneClickClient();
  let calculated: Awaited<ReturnType<typeof quoteOrder>>;
  try {
    calculated = await quoteOrder({
      validateOrder: async () => {
        if (mode() === "mock") return { coin_amount: usdcDecimal(product.cost_usdc ?? "") };
        try {
          return { coin_amount: requiredString(await cryptorefills.validateOrder(delivery), "coin_amount") };
        } catch {
          throw new ShopUpstreamError();
        }
      },
      dryQuote: async (amount) => {
        if (mode() === "mock") {
          return {
            amountIn: String(BigInt(amount) +
              (BigInt(amount) + BigInt(99)) / BigInt(100)),
            amountOut: amount,
          };
        }
        try {
          return await oneClick.quote({
            dry: true,
            amount,
            recipient: process.env.SHOPPER_QUOTE_RECIPIENT ||
              "0x0000000000000000000000000000000000000001",
            refundTo: quotedBy,
          });
        } catch {
          throw new ShopUpstreamError();
        }
      },
    }, clock);
  } catch (error) {
    if (error instanceof Error && error.message === "Merchant price below 0.6 USDC") {
      throw error;
    }
    throw new ShopUpstreamError();
  }
  const specObject = cryptorefillsSpec({
    beneficiary,
    brand_name: brandName,
    country,
    delivery_type: brand.delivery_type,
    denomination: denomination || undefined,
    product_value: productValue || undefined,
  });
  const spec = canonicalJson(specObject);
  const id = `FUL-${randomBytes(4).toString("hex").toUpperCase()}`;
  const order = {
    id,
    kind: brand.kind,
    spec_hash: specHash(spec),
    pay_amount: calculated.pay_amount,
    reward: calculated.reward,
    deadline_ns: calculated.deadline_ns,
    quoted_by: quotedBy,
  };
  const quote = {
    face_value: productValue ? {
      amount: productValue,
      currency: product.product_value_range?.currency || product.face_value.currency,
    } : product.face_value,
    fx_usd: product.face_value.currency === "USD" ? String(usdcUnits(productValue || product.face_value.amount)) : null,
    merchant_price: calculated.merchant_price,
    transfer_fee: calculated.transfer_fee,
    buffer: calculated.buffer,
    reward: calculated.reward,
    platform_fee: "0",
    total: calculated.total,
    quoted_by: quotedBy,
    expires_at: calculated.expires_at,
    explain: {
      merchant_price: "Cryptorefills receives this payment for the product.",
      transfer_fee: "1Click solvers receive this for transferring payment to Base.",
      buffer: "The fulfiller keeps unused buffer after price changes.",
      reward: "The fulfiller receives this for completing the order.",
    },
  };
  put(`v3:spec:${id}`, "v3:spec", {
    order_id: id,
    kind: brand.kind,
    spec,
    spec_hash: order.spec_hash,
    beneficiary,
    buyer_email: buyerEmail,
    buyer: session.account_id,
    quoted_by: quotedBy,
    quote,
    expires_at: new Date(Number(BigInt(order.deadline_ns) / BigInt(1_000_000)) +
      24 * 60 * 60_000).toISOString(),
    created_at: new Date(clock()).toISOString(),
  } satisfies StoredSpec);
  put(`v3:spec_summary:${id}`, "v3:spec_summary", {
    order_id: id,
    created_at: new Date(clock()).toISOString(),
    brand: brandName,
    denomination,
    product_value: productValue,
    currency: quote.face_value.currency,
    masked_beneficiary: maskBeneficiary(beneficiary),
  } satisfies SpecSummary);
  put(`v3:prepared:${id}`, "v3:prepared", {
    account_id: session.account_id,
    order,
    expires_at: calculated.expires_at,
  });
  return {
    order_id: id,
    kind: brand.kind,
    spec: specObject,
    spec_hash: order.spec_hash,
    quote,
    payload: await buildPayload(session, [intentFromInput({ kind: "fund", order })]),
  };
}
