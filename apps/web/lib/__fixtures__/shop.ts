// DEV-ONLY MOCK, synthetic data. Never use these prices or payloads in production.
import {
  FIXTURE_ORDER_ID,
  unitsFromDecimal,
  type FulfillerEntry,
  type ShopBrand,
  type ShopBrandDetail,
  type ShopCatalog,
  type ShopListing,
  type ShopCountry,
  type ShopQuoteRequest,
  type ShopQuoteResult,
  type V3Order,
  type V3Merchant,
} from "../v3-client";

const costUnits = (amount: number, currency: string): string => {
  const units = BigInt(amount) * BigInt(1_000_000);
  return (currency === "VND" ? units / BigInt(25_400) : units).toString();
};

const topup = (brand_name: string): ShopBrand => ({
  brand_name,
  family: "Mobile top-up",
  logo_url: "",
  kind: "cryptorefills_topup",
  delivery_type: "by_phone",
  products: [10000, 20000, 50000, 100000, 200000, 500000].map((amount) => ({
    denomination: `${amount} VND`,
    face_value: { amount: String(amount), currency: "VND" },
    cost_usdc: costUnits(amount, "VND"),
  })),
});

const code = (brand_name: string, amount: number, currency: string): ShopBrand => ({
  brand_name,
  family: "Gift cards",
  logo_url: "",
  kind: "cryptorefills_code",
  delivery_type: "by_email",
  products: [{
    denomination: `${amount} ${currency}`,
    face_value: { amount: String(amount), currency },
    cost_usdc: costUnits(amount, currency),
  }],
});

const brandsByCountry: Record<string, { category: string; brands: ShopBrand[] }[]> = {
  VN: [
    { category: "Mobile top-ups", brands: [topup("Viettel"), topup("Mobifone")] },
    { category: "Gift cards", brands: [code("Steam", 100000, "VND"), code("Roblox", 100000, "VND")] },
    { category: "eSIM", brands: [{ ...code("Travel eSIM", 5, "USD"), family: "eSIM",
      products: [{ ...code("Travel eSIM", 5, "USD").products[0], label: "1 GB · 3 days" }] }] },
  ],
  US: [{
    category: "Gift cards",
    brands: [
      {
        ...code("Amazon", 10, "USD"),
        products: [{
          denomination: "",
          product_value_range: { min: "5", max: "100", currency: "USD" },
          face_value: { amount: "10", currency: "USD" },
          cost_usdc: "10000000",
        }],
      },
      code("Netflix", 25, "USD"),
    ],
  }],
};

const slugOf = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
const countryBrands = (country: string) => brandsByCountry[country] ?? brandsByCountry.VN;

export function fixtureCountries(): ShopCountry[] {
  return [
    { code: "VN", name: "Vietnam", brand_count: 5 },
    { code: "US", name: "United States", brand_count: 2 },
  ];
}

export function fixtureCatalog(country: string): ShopCatalog {
  return {
    country,
    categories: countryBrands(country).map(({ category, brands }) => ({
      category,
      brands: brands.map((brand): ShopListing => ({
        brand_name: brand.brand_name,
        slug: slugOf(brand.brand_name),
        family: brand.family,
        logo_url: brand.logo_url,
        category,
        listing_kind: brand.kind === "cryptorefills_topup" ? "mobile_recharge" : "giftcard",
      })),
    })),
  };
}

export function fixtureBrand(country: string, slug: string): ShopBrandDetail {
  const brand = countryBrands(country).flatMap((item) => item.brands)
    .find((item) => slugOf(item.brand_name) === slug || item.brand_name === slug);
  if (!brand) throw new Error("Product not found.");
  return {
    country, slug: slugOf(brand.brand_name), brand_name: brand.brand_name,
    logo_url: brand.logo_url, category: brand.family,
    variants: [{ ...brand, slug: slugOf(brand.brand_name) }],
  };
}

export function fixturePopular(country: string): ShopListing[] {
  return fixtureCatalog(country).categories.flatMap((category) => category.brands).slice(0, 3);
}

export function fixtureQuote(request: ShopQuoteRequest): ShopQuoteResult {
  const brand = countryBrands(request.country).flatMap((item) => item.brands)
    .find((item) => item.brand_name === request.brand_name);
  const product = brand?.products.find((item) => item.denomination === request.denomination)
    ?? brand?.products[0];
  const face = request.product_value ?? product?.face_value.amount ?? "5";
  const currency = product?.face_value.currency ?? "USD";
  const merchant = currency === "VND"
    ? BigInt(face) * BigInt(1_000_000) / BigInt(25_400)
    : BigInt(unitsFromDecimal(face) ?? "0");
  const transfer = BigInt(30_000);
  const buffer = merchant * BigInt(2) / BigInt(100);
  const reward = merchant * BigInt(5) / BigInt(100) > BigInt(50_000)
    ? merchant * BigInt(5) / BigInt(100) : BigInt(50_000);

  return {
    order_id: FIXTURE_ORDER_ID,
    kind: brand?.kind ?? "cryptorefills_code",
    spec: {
      beneficiary_hash: "0".repeat(64),
      brand_name: request.brand_name,
      country: request.country,
      delivery_type: brand?.delivery_type ?? "by_email",
      denomination: request.denomination ?? "",
      product_value: request.product_value ?? "",
      salt: "0".repeat(32),
      v: 1,
    },
    spec_hash: "0".repeat(64),
    fixture: true,
    quote: {
      face_value: { amount: face, currency },
      fx_usd: currency === "USD" ? (unitsFromDecimal(face) ?? "0") : null,
      merchant_price: merchant.toString(),
      transfer_fee: transfer.toString(),
      buffer: buffer.toString(),
      reward: reward.toString(),
      platform_fee: "0",
      total: (merchant + transfer + buffer + reward).toString(),
      quoted_by: "official-shopper.near",
      expires_at: new Date(Date.now() + 300000).toISOString(),
      explain: {
        merchant_price: "The shop's price for this product.",
        transfer_fee: "Cost to move your payment to the shop.",
        buffer: "A small cushion if the shop price changes.",
        reward: "Paid to the person or bot that completes your order.",
      },
    },
    payload: {
      standard: "nep413",
      payload_to_sign: { message: "DEV ONLY — DO NOT SIGN", nonce: "", recipient: "" },
      nonce: "",
      deadline: "",
      intents: [],
    },
  };
}

export function fixtureOrder(id: string): { order: V3Order; merchant: V3Merchant | null } {
  const buyer = "0x1111111111111111111111111111111111111111";
  const base: V3Order = {
    id,
    buyer,
    token: "",
    pay_amount: "1000000",
    reward: "50000",
    amount_vnd: 0,
    merchant_hash: "",
    deadline_ns: "0",
    status: "paid",
    fulfiller: "fullfiller1.near",
  };
  if (id === "DEV-INPERSON-1") {
    return { order: { ...base, kind: "in_person", spec_summary: {
      brand: "Phở bò takeaway", masked_beneficiary: "District 1",
    } }, merchant: null };
  }
  if (id === "DEV-TOKEN-1") {
    return { order: { ...base, kind: "token_buy", pay_amount: "2000000", reward: "100000",
      buy_token: { account_id: "demo-token.near", symbol: "DEMO", name: "Demo token", decimals: 6, price_usd: 0.1 },
      spec: { token_contract: "demo-token.near", amount_out: "20000000", receiver: "buyer-demo.near" },
    } as V3Order, merchant: null };
  }
  if (id === "DEV-BANK-1") {
    return { order: { ...base, kind: "bank_transfer", pay_amount: "2000000", amount_vnd: 50000 },
      merchant: { id: "demo-merchant", bin: "000000", bank: "Demo bank", account: "0000", name: "Demo noodle shop", amount_vnd: 50000 } };
  }
  if (id === "DEV-CODE-1") {
    return { order: { ...base, kind: "cryptorefills_code", pay_amount: "5000000", reward: "250000",
      fulfiller: "official-shopper.near", spec_summary: {
      brand: "Demo gift card", denomination: "5 USD", masked_beneficiary: "demo@example.invalid",
    } }, merchant: null };
  }
  if (id !== FIXTURE_ORDER_ID) throw new Error("Order not found.");
  return {
    order: {
      id,
      buyer,
      token: "",
      pay_amount: "2000000",
      reward: "100000",
      amount_vnd: 0,
      merchant_hash: "",
      deadline_ns: "0",
      status: "claimed",
      kind: "cryptorefills_topup",
      fulfiller: "community-bot.near",
      fulfiller_listed: false,
      spec_summary: {
        brand: "Viettel",
        denomination: "50000 VND",
        masked_beneficiary: "+84 ••• ••• 678",
      },
    },
    merchant: null,
  };
}

export function fixtureFulfillers(): FulfillerEntry[] {
  return [
    {
      account_id: "official-shopper.near",
      name: "Official shopper bot",
      kinds: ["cryptorefills_topup", "cryptorefills_code"],
      operator: "Fulfil",
      repo_url: "",
      description: "Buys phone top-ups, gift cards, and eSIMs.",
      official: true,
      verified: false,
      stats: { jobs_done: 42 },
      profile: { rating: { star_sum: 206, star_count: 42, avg: 4.9 } },
    },
    {
      account_id: "fullfiller1.near",
      name: "Local bank helper",
      kinds: ["bank_transfer"],
      operator: "Community",
      repo_url: "",
      description: "Helps pay local bank transfers.",
      official: false,
      verified: false,
      stats: { jobs_done: 12 },
      profile: { rating: { star_sum: 58, star_count: 12, avg: 4.8 } },
    },
  ];
}
