/**
 * Typed client for the Fulfil v3 HTTP API (docs/pm/API_SPEC.md).
 * Everything here is plain TypeScript: no React, no wallet code, so it is easy to test.
 */
import { getCountryCallingCode, getExampleNumber, isSupportedCountry, parsePhoneNumberFromString } from "libphonenumber-js";
import mobileExamples from "libphonenumber-js/examples.mobile.json";

export const USDC_TOKEN =
  "nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1";
export const USDC_DECIMALS = 6;
export const FIXTURE_ORDER_ID = "DEV-SHOP-1";
export const FIXTURE_ORDER_IDS = [FIXTURE_ORDER_ID, "DEV-CODE-1", "DEV-INPERSON-1", "DEV-TOKEN-1", "DEV-BANK-1"] as const;

/* ------------------------------------------------------------------ types */

export type Standard = "nep413" | "erc191";
export type Challenge = { nonce: string; message: string; recipient: string; expires_at: string };
export type SessionInfo = { account_id: string; standard: Standard; expires_at: string };
export type SessionStatus = ({ authenticated: true } & SessionInfo) | { authenticated: false };
export type Nep413Payload = { message: string; nonce: string; recipient: string };
export type BuiltPayload = {
  standard: Standard;
  /** NEP-413: {message, nonce, recipient}. ERC-191: the exact JSON string to personal_sign. */
  payload_to_sign: Nep413Payload | string;
  nonce: string;
  deadline: string;
  intents: unknown[];
};
export type SignedIntent =
  | { standard: "nep413"; payload: Nep413Payload; public_key: string; signature: string }
  | { standard: "erc191"; payload: string; signature: string };

export type OrderStatus =
  | "funded" | "claimed" | "sent" | "verifying" | "proof_rejected"
  | "verified" | "under_review" | "paid" | "closed" | "disputed"
  | "resolved" | "cancelled" | "expired";
export type V3Order = {
  id: string;
  buyer: string;
  token: string;
  pay_amount: string;
  reward: string;
  amount_vnd: number;
  merchant_hash: string;
  merchant_mismatch?: boolean;
  /** List endpoint only: shop name and bank name (no account number). */
  merchant_name?: string | null;
  merchant_bank?: string | null;
  deadline_ns: string;
  /** Contract timestamp in nanoseconds; older mock data may use ISO. */
  created_at?: string;
  status: OrderStatus;
  fulfiller?: string;
  proof_sha256?: string;
  last_reject_reason?: string | null;
  verdict?: string;
  buyer_rating?: number;
  fulfiller_rating?: number;
  /** Mock backend: ISO string. Live contract: nanoseconds. Use claimedAtMs(). */
  claimed_at?: string;
  claimed_at_ns?: string;
  paid_at?: string;
  paid_at_ns?: string;
  ended_at?: string;
  kind?: string;
  spec_summary?: { brand: string; denomination?: string; product_value?: string; currency?: string; masked_beneficiary: string } | null;
  fulfiller_listed?: boolean;
};
export type TokenItem = {
  account_id: string; symbol: string; name: string; decimals: number; icon?: string | null;
  price_usd: number | string; liquidity_usd?: number | string; reputation?: string; warning?: string;
};
export type TokenAccountCheck = { account_id: string; exists: boolean; implicit: boolean };
export type TokenPrepareBody = {
  token_contract: string; spend_usdc: string; slippage_bps: number; receiver: string;
  receiver_confirmed?: boolean; deadline_hours?: number;
};
export type TokenPrepareResult = {
  order_id: string;
  order: { id: string; kind: "token_buy"; spec_hash: string; pay_amount: string; reward: string; deadline_ns: string };
  spec: { amount_out: string; receiver: string; token_contract: string; v: number };
  quote: {
    spend: string; estimated_out: string; amount_out: string; slippage_bps: number; reward: string;
    total: string; price_usd: number | string; route_dex: string; expires_at: string;
  };
  payload: BuiltPayload;
};
/** token_buy orders carry `buy_token` metadata and the public `spec`; `token` stays the pay-token string. */
export type TokenBuyOrderExtra = {
  buy_token?: unknown; spec?: { amount_out: string; receiver: string; token_contract: string };
  delivery_tx_hash?: string; delivery_tx?: string;
};
export function tokenBuyInfo(order: V3Order): {
  token?: Pick<TokenItem, "account_id" | "symbol" | "decimals" | "icon" | "price_usd">;
  spec?: NonNullable<TokenBuyOrderExtra["spec"]>; txHash?: string;
} {
  const o = order as unknown as TokenBuyOrderExtra;
  const token = o.buy_token && typeof o.buy_token === "object" ? (o.buy_token as TokenItem) : undefined;
  return { token, spec: o.spec, txHash: o.delivery_tx_hash ?? o.delivery_tx };
}
/** Base units -> readable amount, trimmed trailing zeros, at most `maxFrac` decimals shown. */
export function formatTokenAmount(units: string | bigint, decimals: number, maxFrac = 6): string {
  const v = BigInt(units);
  const base = BigInt(10) ** BigInt(decimals);
  const whole = v / base;
  let frac = (v % base).toString().padStart(decimals, "0").slice(0, maxFrac).replace(/0+$/, "");
  if (!frac && v > BigInt(0) && whole === BigInt(0)) return `<${decimals ? "0." + "0".repeat(Math.min(maxFrac, decimals) - 1) + "1" : "1"}`;
  return whole.toLocaleString("en-US") + (frac ? "." + frac : "");
}
export const formatPriceUsd = (p: number | string | undefined) => {
  const n = Number(p);
  if (!Number.isFinite(n) || n <= 0) return "n/a";
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(4)}`;
  if (n < 1e-12) return "< $0.000000000001";
  // Fixed decimals with 3 significant digits, never scientific notation.
  const decimals = Math.min(12, 2 - Math.floor(Math.log10(n)));
  return `$${n.toFixed(decimals)}`;
};
export const formatCompactUsd = (p: number | string | undefined) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(Number(p) || 0);
export const TOKEN_STEPS = ["Funded", "Claimed by agent", "Verifying (OutLayer)", "Paid"];
export function tokenTimeline(status: OrderStatus): Phase {
  const base = shopTimeline(status);
  switch (status) {
    case "funded": return { ...base, step: 1, title: "Waiting for an agent to claim your order…" };
    case "claimed": return { ...base, step: 2, title: "An agent is buying your tokens" };
    case "sent": case "verifying": case "proof_rejected": case "verified": case "under_review":
      return { ...base, step: 3, title: "Verifying delivery with NEAR OutLayer…" };
    case "paid": case "closed": return { ...base, step: 4, title: "Tokens delivered" };
    default: return base;
  }
}

export type ShopCountry = { code: string; name: string; brand_count: number };
export type ShopProduct = {
  denomination: string;
  label?: string;
  product_value_range?: { min: string; max: string; currency: string };
  face_value: { amount: string; currency: string };
  cost_usdc: string;
};
/** One purchasable variant of a brand; kind and delivery come from its products. */
export type ShopBrand = {
  brand_name: string;
  slug?: string;
  family: string;
  category?: string;
  logo_url: string;
  kind: "cryptorefills_topup" | "cryptorefills_code";
  delivery_type: "by_phone" | "by_email";
  products: ShopProduct[];
};
/** A catalog grid row from the country brand list; products load per brand. */
export type ShopListing = {
  brand_name: string;
  slug: string;
  family: string;
  logo_url: string;
  bg_color?: string;
  category: string;
  listing_kind: "giftcard" | "mobile_recharge";
  price_range?: string;
};
export type ShopCatalog = { country: string; categories: {
  category: string; display_name?: string; brands: ShopListing[];
}[] };
export type ShopBrandDetail = {
  country: string;
  slug: string;
  brand_name: string;
  logo_url: string;
  category: string;
  variants: ShopBrand[];
};
export type ShopEstimate = { country: string; brand: string; estimated: true;
  products: { denomination: string; total: string }[] };
export type ShopQuoteRequest = {
  country: string;
  brand_name: string;
  brand_slug?: string;
  denomination?: string;
  product_value?: string;
  beneficiary: string;
  buyer_email: string;
};
export type ShopQuote = {
  face_value: { amount: string; currency: string };
  fx_usd: string | null;
  merchant_price: string;
  transfer_fee: string;
  buffer: string;
  reward: string;
  platform_fee: string;
  total: string;
  quoted_by: string;
  expires_at: string;
  explain: { merchant_price: string; transfer_fee: string; buffer: string; reward: string };
};
export type ShopQuoteResult = {
  order_id: string;
  kind: ShopBrand["kind"];
  spec: Record<string, unknown>;
  spec_hash: string;
  quote: ShopQuote;
  payload: BuiltPayload;
  fixture?: boolean;
};
export type InPersonPrepareResult = {
  order_id: string;
  order: { id: string; kind: "in_person"; spec_hash: string; pay_amount: string; reward: string; deadline_ns: string };
  quote: {
    item_price: string;
    merchant_price: string;
    transfer_fee: string;
    buffer: string;
    reward: string;
    platform_fee: string;
    total: string;
    quoted_by: null;
    expires_at: string;
    explain: { merchant_price: string; transfer_fee: string; buffer: string; reward: string };
  };
  payload: BuiltPayload;
};
export type FulfillerEntry = {
  account_id: string;
  name: string;
  kinds: string[];
  operator: string;
  repo_url?: string;
  description: string;
  official: boolean;
  verified: boolean;
  proof?: unknown;
  profile?: { rating: { star_sum: number; star_count: number; avg: number | null } } | null;
  stats?: { jobs_done: number } | null;
  user_profile?: { display_name: string; bio: string };
};
export type UserProfile = {
  account_id: string;
  display_name: string;
  bio: string;
  contacts: { x?: string; telegram?: string; email?: string };
  updated_at: string | null;
};
export type PublicUserProfile = Pick<UserProfile, "account_id" | "display_name" | "bio"> & {
  kinds: string[];
  completed_orders: number;
};
export type OrderContact = Pick<UserProfile, "account_id" | "display_name" | "contacts">;
export function fulfillerRating(entry: FulfillerEntry): number | null {
  return entry.profile?.rating.avg ?? null;
}
export type V3Merchant = {
  id: string;
  bin: string;
  bank: string;
  account: string;
  name: string;
  amount_vnd: number;
  /** Ready-to-scan VietQR (amount and note filled in); only for the buyer and the claimed fulfiller. */
  pay_qr?: string | null;
};
/** Shape of `GET /api/v3/me` `profile` (the escrow profile view). `profile` inside is null until register_fulfiller. */
export type V3Profile = {
  account_id: string;
  profile: { bank_bin: string; account_last4: string; registered_at: string } | null;
  stats: { jobs_done: number };
  level: number;
  rating: { star_sum: number; star_count: number; avg: number | null };
  bond: { available: string; locked: string };
  approved: boolean;
};
export type Me = {
  account: string;
  intents_balances: Record<string, string>;
  profile: V3Profile | null;
  approved: boolean;
};
export type PrepareResult = {
  order: Omit<V3Order, "buyer" | "token" | "status">;
  merchant: V3Merchant;
  fx?: { vndPerUsd: number };
  payload: BuiltPayload;
};
export type SubmitResult = { status: string; tx_hash?: string; request_id?: string; order?: V3Order | null };
export type TopupQuote = {
  mock?: boolean;
  quote: {
    depositAddress: string;
    depositMemo?: string;
    amountIn?: string;
    amountOut?: string;
    amountOutFormatted?: string;
    deadline?: string;
  };
};
export type TopupStatus = { status: string; mock?: boolean };
export type WithdrawQuote = { quote?: TopupQuote; payload: BuiltPayload };
export type ProofUpload = { sha256: string; size: number; blob_url: string; payload: BuiltPayload };
export type AuthCallBody =
  | { op: "register_fulfiller"; bank_bin?: string; account_last4?: string }
  | { op: "claim" | "sent" | "cancel"; order_id: string }
  | { op: "submit_proof"; order_id: string; proof_sha256: string }
  | { op: "confirm_delivery"; order_id: string; secret_hex: string }
  | { op: "dispute"; order_id: string; reason_code: string }
  | { op: "rate"; order_id: string; stars: number }
  | { op: "withdraw_bond"; amount: string };

export class V3Error extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    /** Public key to register on intents.near (code "intents_key_missing" only). */
    public publicKey?: string,
  ) {
    super(message);
    this.name = "V3Error";
  }
}

/* ------------------------------------------------------------ http client */

type Fetch = typeof fetch;
let fetchImpl: Fetch | undefined;
/** Tests inject a fake fetch. */
export function setFetch(f: Fetch | undefined) {
  fetchImpl = f;
}

async function call<T>(method: "GET" | "POST" | "PUT", path: string, body?: unknown, raw?: BodyInit): Promise<T> {
  const f = fetchImpl ?? fetch;
  const init: RequestInit = { method, credentials: "same-origin" };
  if (raw !== undefined) init.body = raw;
  else if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers = { "Content-Type": "application/json" };
  }
  const response = await f(`/api/v3/${path}`, init);
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    data = undefined;
  }
  if (!response.ok) {
    const e = (data as { error?: { code?: string; message?: string; public_key?: string } } | undefined)?.error;
    // Raw details stay in the console; people see friendlyError().
    if (response.status >= 500 || !e?.message) console.warn(`[fulfil] ${method} ${path} -> ${response.status}`, e ?? "");
    throw new V3Error(e?.code ?? "http_error", e?.message ?? `Request failed (${response.status})`, response.status, e?.public_key);
  }
  return data as T;
}

const q = (params: Record<string, string | number | undefined>) => {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") s.set(k, String(v));
  const out = s.toString();
  return out ? `?${out}` : "";
};

async function withShopFixture<T>(
  request: () => Promise<T>,
  fallback: (fixtures: typeof import("./__fixtures__/shop")) => T,
): Promise<T> {
  try {
    return await request();
  } catch (error) {
    if (!(error instanceof V3Error) || error.status !== 404) throw error;
    if (process.env.NODE_ENV !== "production") {
      const fixtures = await import("./__fixtures__/shop");
      return fallback(fixtures);
    }
    throw error;
  }
}

export type PublicStatus = {
  mode: "mock" | "live";
  network: "mainnet" | "testnet";
  escrow_contract: string;
  intents_contract: string;
  paused: boolean | null;
  relayer: { account: string | null; configured: boolean };
  kinds: { kind: string; enabled: boolean; access: "open" | "approved" | "allowlist"; verifier: string | null; verifier_code: { version: string | null; url: string | null; available: boolean | null; checked_at: string } | null }[];
  verifier: { project: string | null; configured: boolean };
  services: { id: string; name: string; state: "reachable" | "unreachable" | "not_checked" }[];
  checked_at: string;
};

export const v3 = {
  status: () => call<PublicStatus>("GET", "status"),
  challenge: () => call<Challenge>("POST", "auth/challenge", {}),
  verify: (body: Record<string, unknown>) => call<SessionInfo>("POST", "auth/verify", body),
  session: () => call<SessionStatus>("GET", "auth/session"),
  logout: () => call<{ ok: true }>("POST", "auth/logout", {}),
  devLogin: (account_id: string, standard: Standard = "erc191") =>
    call<SessionInfo>("POST", "auth/dev-login", { account_id, standard }),
  me: () => call<Me>("GET", "me"),
  userProfile: (accountId: string) => call<PublicUserProfile>("GET", `user-profile/${encodeURIComponent(accountId)}`),
  myProfile: () => call<UserProfile>("GET", "me/profile"),
  saveMyProfile: (profile: Pick<UserProfile, "display_name" | "bio" | "contacts">) =>
    call<UserProfile>("PUT", "me/profile", profile),
  orderContact: (id: string) => call<OrderContact>("GET", `orders/${encodeURIComponent(id)}/contact`),
  orders: (p: { status?: string; account?: string; from?: number; limit?: number } = {}) =>
    call<{ orders: V3Order[]; next_from?: number }>("GET", `orders${q(p)}`),
  order: (id: string) => {
    const request = () => call<{ order: V3Order; merchant?: V3Merchant | null }>("GET", `orders/${encodeURIComponent(id)}`);
    return (FIXTURE_ORDER_IDS as readonly string[]).includes(id)
      ? withShopFixture(request, (fixtures) => fixtures.fixtureOrder(id))
      : request();
  },
  shopCountries: () =>
    withShopFixture(() => call<ShopCountry[]>("GET", "shop/countries"), (fixtures) => fixtures.fixtureCountries()),
  shopCatalog: (country: string) =>
    withShopFixture(() => call<ShopCatalog>("GET", `shop/catalog${q({ country })}`), (fixtures) => fixtures.fixtureCatalog(country)),
  shopBrand: (country: string, slug: string) =>
    withShopFixture(() => call<ShopBrandDetail>("GET", `shop/brand${q({ country, slug })}`), (fixtures) => fixtures.fixtureBrand(country, slug)),
  shopPopular: (country: string) =>
    withShopFixture(() => call<ShopListing[]>("GET", `shop/popular${q({ country })}`), (fixtures) => fixtures.fixturePopular(country)),
  shopEstimate: (country: string, brand: string) =>
    call<ShopEstimate>("GET", `shop/estimate${q({ country, brand })}`),
  shopQuote: (body: ShopQuoteRequest) =>
    withShopFixture(() => call<ShopQuoteResult>("POST", "shop/quote", body), (fixtures) => fixtures.fixtureQuote(body)),
  inPersonPrepare: (body: { area: string; item_desc: string; price: string; delivery_hash: string;
    meetup_address: string; meetup_contact: string; deadline_hours: number; reward_usdc?: string }) =>
    call<InPersonPrepareResult>("POST", "in-person/prepare", body),
  inPersonMeetup: (id: string) =>
    call<{ address: string; contact: string }>("GET", `jobs/${encodeURIComponent(id)}/meetup`),
  inPersonConfirm: (id: string, secret_hex: string) =>
    call<BuiltPayload>("POST", "in-person/confirm", { order_id: id, secret_hex }),
  inPersonExpire: (id: string) =>
    call<{ status: string }>("POST", "in-person/expire", { order_id: id }),
  tokenExpire: (id: string) =>
    call<{ status: string }>("POST", "token/expire", { order_id: id }),
  tokenSearch: (query: string) => call<TokenItem[]>("GET", `token/search${q({ q: query })}`),
  tokenInfo: (id: string) => call<TokenItem>("GET", `token/info${q({ id })}`),
  accountCheck: (id: string) => call<TokenAccountCheck>("GET", `account/check${q({ id })}`),
  tokenPrepare: (body: TokenPrepareBody) => call<TokenPrepareResult>("POST", "token/prepare", body),
  fulfillers: () =>
    withShopFixture(() => call<FulfillerEntry[]>("GET", "fulfillers"), (fixtures) => fixtures.fixtureFulfillers()),
  prepareOrder: (b: { qr_payload: string; amount_vnd?: number; reward_usdc: string }) =>
    call<PrepareResult>("POST", "orders/prepare", b),
  buildIntent: (b: Record<string, unknown>) => call<BuiltPayload>("POST", "intents/build", b),
  buildAuthCall: (b: AuthCallBody) => call<BuiltPayload>("POST", "intents/build", { kind: "auth_call", ...b }),
  /** Not used by the UI yet: the fulfiller deposit. See hand-back notes. */
  buildBond: (amount: string) => call<BuiltPayload>("POST", "intents/build", { kind: "bond", amount }),
  submit: (signed: SignedIntent) => call<SubmitResult>("POST", "intents/submit", signed),
  topupQuote: (b: { originAsset: string; amount: string; slippageTolerance?: number }) =>
    call<TopupQuote>("POST", "topup/quote", b),
  topupStatus: (depositAddress: string, depositMemo?: string) =>
    call<TopupStatus>("GET", `topup/status${q({ depositAddress, depositMemo })}`),
  topupTokens: () => call<{ tokens?: TopupToken[]; mock?: boolean }>("GET", "topup/tokens"),
  withdrawQuote: (b: Record<string, unknown>) => call<WithdrawQuote>("POST", "withdraw/quote", b),
  uploadProof: (orderId: string, bytes: Blob | ArrayBuffer | Uint8Array) =>
    call<ProofUpload>("POST", `proofs${q({ order_id: orderId })}`, undefined, bytes as BodyInit),
};

/* ------------------------------------------------------------ pure helpers */

/** "12.4" -> "12400000". Returns undefined for anything that is not a plain non-negative decimal. */
export function unitsFromDecimal(input: string, decimals = USDC_DECIMALS): string | undefined {
  const text = input.trim().replace(",", ".");
  const m = /^(\d+)(?:\.(\d*))?$/.exec(text);
  if (!m) return undefined;
  const frac = m[2] ?? "";
  if (frac.length > decimals) return undefined;
  return (BigInt(m[1]) * BigInt(10) ** BigInt(decimals) + BigInt(frac.padEnd(decimals, "0") || "0")).toString();
}

/** "12400000" -> "12.4" (trimmed). */
export function decimalFromUnits(units: string | bigint, decimals = USDC_DECIMALS): string {
  const v = BigInt(units || "0");
  const base = BigInt(10) ** BigInt(decimals);
  const whole = v / base;
  const frac = (v % base).toString().padStart(decimals, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole.toString();
}

/** USDC base units -> "$12.40" (rounded to cents, half up). */
export function formatUsd(units: string | bigint | undefined): string {
  const v = BigInt(units || "0");
  const cents = (v + BigInt(5_000)) / BigInt(10_000);
  const whole = cents / BigInt(100);
  const c = (cents % BigInt(100)).toString().padStart(2, "0");
  return `$${whole.toLocaleString("en-US")}.${c}`;
}

export const usdcBalance = (me: Pick<Me, "intents_balances"> | undefined) =>
  me?.intents_balances?.[USDC_TOKEN] ?? "0";

/** Short, readable account: 0x12…ab, kent-user1.near, a1b2…c3d4. */
export function shortAccount(id: string | undefined): string {
  if (!id) return "";
  if (/^0x[0-9a-fA-F]{40}$/.test(id)) return `${id.slice(0, 4)}…${id.slice(-2)}`;
  if (/^[0-9a-f]{64}$/.test(id)) return `${id.slice(0, 4)}…${id.slice(-4)}`;
  if (id.length > 24) return `${id.slice(0, 10)}…${id.slice(-8)}`;
  return id;
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
export function bytesToBase64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

/** When the fulfiller took the job, in epoch ms. Reads both the mock and the live field. */
export function claimedAtMs(order: Pick<V3Order, "claimed_at" | "claimed_at_ns">): number | undefined {
  if (order.claimed_at_ns && /^\d+$/.test(order.claimed_at_ns))
    return Number(BigInt(order.claimed_at_ns) / BigInt(1_000_000));
  if (order.claimed_at) {
    const t = Date.parse(order.claimed_at);
    if (!Number.isNaN(t)) return t;
  }
  return undefined;
}

export const orderTotal = (o: Pick<V3Order, "pay_amount" | "reward">) =>
  (BigInt(o.pay_amount) + BigInt(o.reward)).toString();

/** Same rounding as the server: pay_amount = ceil(vnd * 1e6 / rate). */
export function estimatePayUnits(amountVnd: number, vndPerUsd: number): string {
  if (!Number.isFinite(amountVnd) || !Number.isFinite(vndPerUsd) || vndPerUsd <= 0 || amountVnd <= 0) return "0";
  const rate = BigInt(Math.round(vndPerUsd));
  return ((BigInt(Math.round(amountVnd)) * BigInt(1_000_000) + rate - BigInt(1)) / rate).toString();
}

export type Phase = {
  /** Index into BUYER_STEPS (4 = all done). */
  step: number;
  title: string;
  tone: "good" | "bad" | "warn" | "neutral";
  done: boolean;
  /** No more changes expected: stop polling. */
  terminal: boolean;
};
export const BUYER_STEPS = ["Paid", "Local found", "Shop paid", "Done"];

/** Plain-words view of an order for the person who paid. */
export function buyerPhase(status: OrderStatus): Phase {
  switch (status) {
    case "funded":
      return { step: 1, title: "Finding a local to pay for you…", tone: "warn", done: false, terminal: false };
    case "claimed":
      return { step: 2, title: "A local is paying the shop", tone: "warn", done: false, terminal: false };
    case "sent":
    case "verifying":
    case "proof_rejected":
    case "verified":
    case "under_review":
      return { step: 3, title: "Checking the proof…", tone: "warn", done: false, terminal: false };
    case "paid":
    case "closed":
      return { step: 4, title: "Done! The shop got paid.", tone: "good", done: true, terminal: true };
    case "cancelled":
      return { step: 0, title: "Cancelled. Your money is back.", tone: "bad", done: false, terminal: true };
    case "expired":
      return { step: 0, title: "Expired. Your money is back.", tone: "bad", done: false, terminal: true };
    case "disputed":
      return { step: 3, title: "We're checking", tone: "warn", done: false, terminal: false };
    case "resolved":
      return { step: 3, title: "Review resolved", tone: "neutral", done: false, terminal: true };
    default:
      return { step: 0, title: "Working on it…", tone: "neutral", done: false, terminal: false };
  }
}

/** Plain words for a job as seen by the local. */
export function fulfillerPhase(status: OrderStatus): { title: string; done: boolean } {
  switch (status) {
    case "funded": return { title: "Open", done: false };
    case "claimed": return { title: "Pay the shop", done: false };
    case "sent": return { title: "Show proof", done: false };
    case "verifying":
    case "proof_rejected":
    case "verified": return { title: "Checking", done: false };
    case "paid":
    case "closed": return { title: "Paid", done: true };
    case "under_review":
    case "disputed": return { title: "Being reviewed", done: false };
    case "resolved": return { title: "Review resolved", done: true };
    case "cancelled": return { title: "Cancelled", done: true };
    case "expired": return { title: "Expired", done: true };
    default: return { title: status, done: false };
  }
}

/** Has this person already rated this order? */
export const ratingDone = (o: V3Order, viewer: string) =>
  viewer === o.buyer ? !!o.buyer_rating : viewer === o.fulfiller ? !!o.fulfiller_rating : true;

/** Total earned by a local from finished jobs (pay + reward), in USDC units. */
export function earnedUnits(orders: V3Order[], me: string): bigint {
  return orders
    .filter((o) => o.fulfiller === me && ["paid", "closed", "resolved"].includes(o.status) && o.verdict !== "buyer")
    .reduce((sum, o) => sum + BigInt(orderTotal(o)), BigInt(0));
}

/* -------- coins and networks (Add money / Withdraw) -------- */

export type Coin = { id: string; label: string; network: string; assetId: string; decimals: number; price?: number; icon?: string };
export type TopupToken = {
  assetId: string; symbol: string; blockchain?: string; decimals: number; price?: number; icon?: string;
};
const omft = (x: string) => `nep141:${x}.omft.near`;
const USDC_ICON = "/coins/usd-coin.png";
export const COINS: Coin[] = [
  { id: "usdc-base", label: "USDC", network: "Base", assetId: omft("base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"), decimals: 6, icon: USDC_ICON },
  { id: "usdc-arb", label: "USDC", network: "Arbitrum", assetId: omft("arb-0xaf88d065e77c8cc2239327c5edb3a432268e5831"), decimals: 6, icon: USDC_ICON },
  { id: "usdc-eth", label: "USDC", network: "Ethereum", assetId: omft("eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"), decimals: 6, icon: USDC_ICON },
  { id: "usdc-sol", label: "USDC", network: "Solana", assetId: omft("sol-5ce3bf3a31af18be40ba30f721101b4341690186"), decimals: 6, icon: USDC_ICON },
  { id: "usdc-near", label: "USDC", network: "NEAR", assetId: USDC_TOKEN, decimals: 6, icon: USDC_ICON },
  { id: "eth", label: "ETH", network: "Ethereum", assetId: omft("eth"), decimals: 18, icon: "/coins/ethereum.png" },
  { id: "near", label: "NEAR", network: "NEAR", assetId: "nep141:wrap.near", decimals: 24, icon: "/coins/near.jpg" },
];
/** The mock backend credits the typed amount 1:1 as dollars, so only dollar coins make sense there. */
export const dollarCoins = (coins: Coin[] = COINS) => coins.filter((c) => c.label === "USDC");
export const coinName = (c: Coin) => `${c.label} on ${c.network}`;

const CHAIN_NAMES: Record<string, string> = {
  near: "NEAR", eth: "Ethereum", base: "Base", arb: "Arbitrum", op: "Optimism", pol: "Polygon",
  bsc: "BNB Chain", avax: "Avalanche", sol: "Solana", btc: "Bitcoin", ton: "TON", tron: "Tron",
  xrp: "XRP Ledger", doge: "Dogecoin", ltc: "Litecoin", bch: "Bitcoin Cash", zec: "Zcash",
  sui: "Sui", aptos: "Aptos", cardano: "Cardano", gnosis: "Gnosis", scroll: "Scroll",
  bera: "Berachain", monad: "Monad", starknet: "Starknet", hypercore: "Hyperliquid", xlayer: "X Layer",
  dash: "Dash", plasma: "Plasma", abs: "Abstract", aleo: "Aleo", hood: "Robinhood Chain",
};
export const chainName = (chain: string) => CHAIN_NAMES[chain] ?? chain.charAt(0).toUpperCase() + chain.slice(1);

/** Popular coins shown first, in this order (owner, 2026-11-10); everything else follows by name. */
const FEATURED = [
  "USDC/near", "SHITZU/near", "wNEAR/near", "ZEC/zec", "SOL/sol", "USDT/near",
  "USDC/base", "USDC/arb", "USDC/eth", "USDC/sol", "USDT/tron", "USDT/eth", "USDT/sol",
  "ETH/eth", "BTC/btc", "BLACKDRAGON/near",
];

/** The 1Click token list, turned into coins people can add money from. */
export function coinsFromTokens(tokens: TopupToken[]): Coin[] {
  const rank = (t: TopupToken) => {
    const i = FEATURED.indexOf(`${t.symbol}/${t.blockchain}`);
    return i < 0 ? FEATURED.length : i;
  };
  return tokens
    .filter((t) => t.assetId && Number.isInteger(t.decimals))
    .map((t) => ({
      coin: {
        id: t.assetId,
        // wrap.near is plain NEAR to people (1Click wraps it), so name it that way.
        label: t.symbol === "wNEAR" && t.blockchain === "near" ? "NEAR" : t.symbol,
        network: chainName(t.blockchain ?? "near"),
        assetId: t.assetId,
        decimals: t.decimals,
        price: t.price,
        icon: t.icon,
      },
      t,
    }))
    .sort((a, b) => rank(a.t) - rank(b.t) || coinName(a.coin).localeCompare(coinName(b.coin)))
    .map((x) => x.coin);
}

/** Coins matching a search: exact symbol first, then symbol prefix, then name or network. */
export function searchCoins(coins: Coin[], query: string): Coin[] {
  const q = query.trim().toLowerCase();
  if (!q) return coins;
  const score = (c: Coin) => {
    const sym = c.label.toLowerCase();
    if (sym === q) return 0;
    if (sym.startsWith(q)) return 1;
    return coinName(c).toLowerCase().includes(q) ? 2 : -1;
  };
  return coins
    .map((c, i) => ({ c, i, s: score(c) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => a.s - b.s || a.i - b.i)
    .map((x) => x.c);
}

/** Coins that swap even in small amounts (all on NEAR), offered when a quote is refused. */
export function safeCoins(coins: Coin[]): Coin[] {
  const want = ["USDC", "USDT", "wNEAR", "NEAR"];
  return want
    .map((label) => coins.find((c) => c.label === label && c.network === "NEAR"))
    .filter((c): c is Coin => !!c)
    .slice(0, 3);
}

/** Basic shape check of a withdraw address for the chosen network. */
export function addressOk(network: string, address: string): boolean {
  const a = address.trim();
  if (network === "NEAR")
    return /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/.test(a) && a.length >= 2 && a.length <= 64;
  if (network === "Solana") return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a);
  return /^0x[0-9a-fA-F]{40}$/.test(a);
}

/** Rough dollar value of a typed amount, from the 1Click list price. */
export function roughUsd(coin: Coin, amount: string): number | undefined {
  const n = Number(amount);
  return coin.price && Number.isFinite(n) && n > 0 ? n * coin.price : undefined;
}

/** VPBank is the only real bank the Local QR verifier supports. The others are fictional demo banks (mock mode only). */
export const BANKS = [
  { bin: "970432", name: "VPBank", demo: false },
  { bin: "999701", name: "Lotus Bank", demo: true },
  { bin: "999702", name: "Jasmine Bank", demo: true },
  { bin: "999704", name: "Orchid Bank", demo: true },
];

export function topupPhase(status: string | undefined): "waiting" | "working" | "done" | "failed" {
  if (!status) return "waiting";
  const s = status.toUpperCase();
  if (s === "SUCCESS") return "done";
  if (s === "REFUNDED" || s === "FAILED") return "failed";
  if (s === "PROCESSING" || s === "KNOWN_DEPOSIT_TX") return "working";
  return "waiting";
}

/** Friendly text for an API error. */
const FIELD_NAMES: Record<string, string> = {
  "area": "Area", "item description": "Item description", "item price": "Item price",
  "exact place": "Exact place", "contact": "Contact", "deadline": "Finish-within time",
  "delivery hash": "Delivery code", "usdc amount": "Reward", "vnd amount": "Amount",
};

/** Turns raw "Invalid area" style server messages into plain words. */
export function plainValidation(message: string): string {
  const m = /^Invalid ([a-z ]+)$/i.exec(message.trim());
  if (!m) return message;
  const name = FIELD_NAMES[m[1].toLowerCase()];
  return name ? `Please check "${name}" and try again.` : message;
}

export const NETWORK_REFUSED = "The network didn't accept this. Try again in a minute.";

export function friendlyError(e: unknown): string {
  if (e instanceof V3Error) {
    if (e.status === 401) return "Please log in again.";
    if (e.code === "intents_key_missing")
      return "Your wallet isn't set up for NEAR Intents yet. Enable it once and try again.";
    if (e.status >= 500 || e.code === "upstream_error" || /^Request failed \(\d+\)$/.test(e.message))
      return NETWORK_REFUSED;
    if (/insufficient/i.test(e.message)) return "You don't have enough money. Add money first.";
    return plainValidation(e.message);
  }
  return e instanceof Error ? plainValidation(e.message) : "Something went wrong.";
}

export function dialPrefix(country: string): string {
  return isSupportedCountry(country) ? `+${getCountryCallingCode(country)}` : "";
}

/** The country's sample mobile number in local format, e.g. AU -> "0412 345 678". */
export function phonePlaceholder(country: string): string {
  if (!isSupportedCountry(country)) return "";
  return getExampleNumber(country, mobileExamples)?.formatNational() ?? "";
}

/**
 * Local or international input -> E.164, only when the number is valid and
 * belongs to `country` (a top-up for one country cannot go to another's number).
 */
export function normalizePhone(input: string, country: string): string | undefined {
  if (!isSupportedCountry(country)) return undefined;
  const phone = parsePhoneNumberFromString(input.trim().replace(/^00/, "+"), country);
  return phone?.isValid() && phone.country === country ? phone.number : undefined;
}

export function validEmail(input: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.trim());
}

export function formatDecimalUsd(value: string): string {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(value.trim());
  if (!match) return "$0.00";
  const fraction = (match[2] ?? "").padEnd(3, "0");
  const cents = BigInt(match[1]) * BigInt(100)
    + BigInt(fraction.slice(0, 2))
    + (Number(fraction[2]) >= 5 ? BigInt(1) : BigInt(0));
  return `$${(cents / BigInt(100)).toLocaleString("en-US")}.${String(cents % BigInt(100)).padStart(2, "0")}`;
}

export function formatFaceValue(amount: string, currency: string): string {
  if (currency === "VND" && /^\d+$/.test(amount)) {
    return `${BigInt(amount).toLocaleString("vi-VN")} ₫`;
  }
  if (currency === "USD" && /^\d+(?:\.\d+)?$/.test(amount)) {
    return `$${Number(amount).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  }
  return `${amount} ${currency}`;
}

export function formatShopDenomination(denomination: string): string {
  const match = /^((?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?)\s*([A-Z]{3})$/.exec(denomination.trim());
  if (!match) return denomination;
  try {
    const amount = Number(match[1].replaceAll(",", ""));
    if (!Number.isFinite(amount)) return denomination;
    const parts = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: match[2],
    }).formatToParts(amount);
    return `${parts.filter((part) => part.type !== "currency" && part.type !== "literal")
      .map((part) => part.value).join("")} ${match[2]}`;
  } catch {
    return denomination;
  }
}

export function formatShopSummary(summary: NonNullable<V3Order["spec_summary"]>, currency?: string): string {
  if (summary.denomination) return formatShopDenomination(summary.denomination);
  // The order summary has no currency field; the current range catalog is USD.
  if (summary.product_value) return formatFaceValue(summary.product_value, currency || "USD");
  return "Value unavailable";
}

export type QuoteLine = { label: string; recipient: string; amount: string; explain: string };
export function shopQuoteLines(quote: ShopQuote): QuoteLine[] {
  const faceValue = formatFaceValue(quote.face_value.amount, quote.face_value.currency);
  const approximateUsd = quote.fx_usd === null ? "" : ` (about ${formatUsd(quote.fx_usd)})`;
  return [
    {
      label: "Face value",
      recipient: "Product",
      amount: `${faceValue}${approximateUsd}`,
      explain: "The value you receive.",
    },
    {
      label: "Shop price",
      recipient: "Cryptorefills",
      amount: formatUsd(quote.merchant_price),
      explain: quote.explain.merchant_price,
    },
    {
      label: "Transfer fee",
      recipient: "1Click network",
      amount: formatUsd(quote.transfer_fee),
      explain: quote.explain.transfer_fee,
    },
    {
      label: "Price cushion",
      recipient: "fulfiller (price-change cushion)",
      amount: formatUsd(quote.buffer),
      explain: quote.explain.buffer,
    },
    {
      label: "Reward",
      recipient: "fulfiller",
      amount: formatUsd(quote.reward),
      explain: quote.explain.reward,
    },
    {
      label: "Fulfil fee",
      recipient: "Fulfil",
      amount: formatUsd(quote.platform_fee),
      explain: "Fulfil does not charge a fee.",
    },
    {
      label: "Total",
      recipient: "You pay",
      amount: formatUsd(quote.total),
      explain: "Your full payment.",
    },
  ];
}

export function formatCountdown(expiresAt: string, now = Date.now()): string {
  const seconds = Math.max(0, Math.ceil((Date.parse(expiresAt) - now) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export const SHOP_STEPS = ["Paid", "Fulfiller working", "Delivered", "Fulfiller paid"];
export function shopTimeline(status: OrderStatus): Phase {
  switch (status) {
    case "funded":
      return { step: 1, title: "Finding someone to complete your order…", tone: "warn", done: false, terminal: false };
    case "claimed":
      return { step: 1, title: "Your order is being prepared", tone: "warn", done: false, terminal: false };
    case "sent":
    case "verifying":
      return { step: 2, title: "Checking delivery…", tone: "warn", done: false, terminal: false };
    case "proof_rejected":
      return { step: 2, title: "Delivery needs another check", tone: "warn", done: false, terminal: false };
    case "verified":
      return { step: 2, title: "Delivery verified", tone: "good", done: false, terminal: false };
    case "under_review":
      return { step: 2, title: "Delivery is under review", tone: "warn", done: false, terminal: false };
    case "paid":
    case "closed":
      return { step: 4, title: "Delivered and complete", tone: "good", done: true, terminal: true };
    case "cancelled":
      return { step: 0, title: "Order cancelled", tone: "bad", done: false, terminal: true };
    case "expired":
      return { step: 0, title: "Order expired", tone: "bad", done: false, terminal: true };
    case "disputed":
      return { step: 2, title: "We're checking your order", tone: "warn", done: false, terminal: false };
    case "resolved":
      return { step: 2, title: "Review resolved", tone: "neutral", done: false, terminal: true };
    default:
      return { step: 2, title: "Checking your order", tone: "neutral", done: false, terminal: false };
  }
}
