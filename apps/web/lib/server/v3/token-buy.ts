import { randomBytes } from "node:crypto";
import { canonicalJson, isNearAccountId, specHash, tokenBuySpec } from "@fulfil/core";
import { get, put } from "../db";
import type { Session } from "./auth";
import { browserUserAgent, escrowContract, mode, USDC_TOKEN } from "./config";
import { buildPayload, intentFromInput } from "./intents";
import { queryRpc } from "./rpc";

type Token = {
  account_id: string;
  symbol: string;
  name: string;
  decimals: number;
  icon: string;
  price_usd: number;
  liquidity_usd: number;
  reputation: string;
};
type BuyToken = Pick<Token, "account_id" | "symbol" | "decimals" | "icon" | "price_usd">;

export class TokenBuyError extends Error {
  constructor(public code: string, message: string, public status = 400) {
    super(message);
  }
}

const mockTokens: Token[] = [
  { account_id: "blackdragon.near", symbol: "BLACKDRAGON", name: "Black Dragon", decimals: 18,
    icon: "", price_usd: 0.002, liquidity_usd: 250_000, reputation: "NotFake" },
  { account_id: "token.0xshitzu.near", symbol: "SHITZU", name: "SHITZU", decimals: 18,
    icon: "", price_usd: 0.0014, liquidity_usd: 150_000, reputation: "NotFake" },
  { account_id: "ftv2.nekotoken.near", symbol: "NEKO", name: "NEKO", decimals: 24,
    icon: "", price_usd: 0.000012, liquidity_usd: 33_000, reputation: "NotFake" },
  { account_id: "token.v2.ref-finance.near", symbol: "REF", name: "Ref Finance Token", decimals: 18,
    icon: "", price_usd: 0.065, liquidity_usd: 220_000, reputation: "Reputable" },
  { account_id: "unpriced.near", symbol: "EMPTY", name: "Unpriced Token", decimals: 18,
    icon: "", price_usd: 0, liquidity_usd: 0, reputation: "NotFake" },
  { account_id: "risky.near", symbol: "RISK", name: "Risk Token", decimals: 18,
    icon: "", price_usd: 0.01, liquidity_usd: 100, reputation: "Unknown" },
  { account_id: "noroute.near", symbol: "NOROUTE", name: "No Route Token", decimals: 18,
    icon: "", price_usd: 0.01, liquidity_usd: 10, reputation: "NotFake" },
];
const cache = new Map<string, { expires: number; value: Token[] }>();
const TOKEN_API = "https://api.intea.rs";
const ROUTER_API = "https://router.intear.tech";

function tokenFrom(value: unknown, key?: string): Token | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const id = item.account_id ?? item.id ?? key;
  const price = Number(item.price_usd ?? 0);
  if (!isNearAccountId(id) || !Number.isFinite(price)) return null;
  const decimals = Number(item.decimals ?? 0);
  return {
    account_id: id,
    symbol: String(item.symbol ?? ""),
    name: String(item.name ?? ""),
    decimals: Number.isSafeInteger(decimals) && decimals >= 0 ? decimals : 0,
    icon: String(item.icon ?? ""),
    price_usd: price,
    liquidity_usd: Number(item.liquidity_usd ?? 0) || 0,
    reputation: String(item.reputation ?? "Unknown"),
  };
}

const TOKEN_FIELDS = "symbol,name,decimals,icon_hash,price_usd,liquidity_usd,reputation";

/** Intear returns a table `{columns, rows}`; `account_id` is always the first column. */
function tableRows(value: unknown): Record<string, unknown>[] | null {
  const record = value && typeof value === "object" ? value as Record<string, unknown> : null;
  if (!record || !Array.isArray(record.columns) || !Array.isArray(record.rows)) return null;
  const columns = record.columns.map(String);
  return record.rows.filter(Array.isArray).map((row) => {
    const item: Record<string, unknown> = {};
    columns.forEach((column, index) => { item[column] = (row as unknown[])[index]; });
    if (typeof item.icon_hash === "string" && /^[A-Za-z0-9_-]+$/.test(item.icon_hash)) {
      item.icon = `${TOKEN_API}/icon/${item.icon_hash}.webp`;
    }
    return item;
  });
}

function tokenArray(value: unknown): Token[] {
  const table = tableRows(value);
  if (table) return table.map((item) => tokenFrom(item)).filter((item): item is Token => item !== null);
  const record = value && typeof value === "object" ? value as Record<string, unknown> : null;
  const entries: unknown = Array.isArray(value) ? value :
    Array.isArray(record?.tokens) ? record.tokens :
      Array.isArray(record?.results) ? record.results :
        Array.isArray(record?.data) ? record.data :
          Array.isArray(record?.items) ? record.items : record?.tokens ?? record?.data ?? record;
  if (Array.isArray(entries)) return entries.map((item) => tokenFrom(item)).filter((item): item is Token => item !== null);
  if (!entries || typeof entries !== "object") return [];
  return Object.entries(entries).map(([key, item]) => tokenFrom(item, key))
    .filter((item): item is Token => item !== null);
}

async function getJson(url: URL): Promise<unknown> {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": browserUserAgent },
      signal: AbortSignal.timeout(7_000),
    });
    if (!response.ok) throw new TokenBuyError("upstream_error", `Intear HTTP ${response.status}`, 502);
    return await response.json();
  } catch (error) {
    if (error instanceof TokenBuyError) throw error;
    throw new TokenBuyError("upstream_error", "Intear request failed", 502);
  }
}

async function cachedTokens(key: string, load: () => Promise<Token[]>): Promise<Token[]> {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  const value = await load();
  if (cache.size >= 1_000) {
    for (const [entry, cached] of cache) {
      if (cached.expires <= Date.now()) cache.delete(entry);
    }
    if (cache.size >= 1_000) cache.delete(cache.keys().next().value!);
  }
  cache.set(key, { value, expires: Date.now() + 60_000 });
  return value;
}

export async function searchTokens(query: string | null): Promise<Token[]> {
  const q = query?.trim() ?? "";
  if (q.length > 100) throw new TokenBuyError("invalid_request", "Search query is too long");
  return (await cachedTokens(`${mode()}:search:${q.toLowerCase()}`, async () => {
    if (mode() === "mock") return mockTokens.filter((token) =>
      token.account_id.includes(q.toLowerCase()) || token.symbol.toLowerCase().includes(q.toLowerCase()) ||
      token.name.toLowerCase().includes(q.toLowerCase()));
    const url = new URL("/tokens/search", TOKEN_API);
    url.searchParams.set("q", q);
    url.searchParams.set("min_reputation", "NotFake");
    url.searchParams.set("fields", TOKEN_FIELDS);
    url.searchParams.set("limit", "20");
    return tokenArray(await getJson(url));
  })).filter((token) => token.price_usd > 0 &&
    ["NotFake", "Reputable"].includes(token.reputation));
}

export async function tokenInfo(id: string | null): Promise<Token & { warning?: string }> {
  if (!isNearAccountId(id)) throw new TokenBuyError("invalid_request", "Invalid token contract");
  const tokens = await cachedTokens(`${mode()}:info:${id}`, async () => {
    if (mode() === "mock") return mockTokens.filter((token) => token.account_id === id);
    const url = new URL("/tokens", TOKEN_API);
    url.searchParams.set("ids", id);
    url.searchParams.set("fields", TOKEN_FIELDS);
    return tokenArray(await getJson(url));
  });
  const token = tokens.find((item) => item.account_id === id);
  if (!token || token.price_usd <= 0) {
    throw new TokenBuyError("token_unpriced", "Token has no price", 404);
  }
  return token.reputation === "NotFake" || token.reputation === "Reputable"
    ? token : { ...token, warning: "Token reputation is below NotFake" };
}

export async function checkAccount(id: string | null): Promise<{ account_id: string; exists: boolean; implicit: boolean }> {
  if (!isNearAccountId(id)) throw new TokenBuyError("invalid_request", "Invalid NEAR account ID");
  const implicit = /^[a-f0-9]{64}$/.test(id);
  if (mode() === "mock") {
    return { account_id: id, exists: id !== "missing.near" && !implicit, implicit };
  }
  const configured = process.env.TOKEN_BUY_RPC_URLS;
  const urls = configured?.split(",").map((url) => url.trim()).filter(Boolean);
  try {
    const response = await queryRpc("query", {
      request_type: "view_account",
      finality: "final",
      account_id: id,
    }, { allowRpcError: true, urls });
    if (response.result) return { account_id: id, exists: true, implicit };
    const error = response.error as { cause?: { name?: string }; name?: string } | undefined;
    if (error?.cause?.name === "UNKNOWN_ACCOUNT" || error?.name === "UNKNOWN_ACCOUNT") {
      return { account_id: id, exists: false, implicit };
    }
  } catch {
    // Preserve the public account-check error contract.
  }
  throw new TokenBuyError("upstream_error", "NEAR RPC account check failed", 502);
}

async function routeQuote(token: string, spend: string, slippageBps: number, account: string) {
  if (mode() === "mock") {
    if (token === "noroute.near") throw new TokenBuyError("no_route", "No token route", 404);
    return { estimated_amount: { amount_out: (BigInt(spend) * BigInt(500) + BigInt(7)).toString() }, dex_id: "Mock DEX" };
  }
  const url = new URL("/route", ROUTER_API);
  url.searchParams.set("token_in", USDC_TOKEN);
  url.searchParams.set("token_out", `nep141:${token}`);
  url.searchParams.set("amount_in", spend);
  url.searchParams.set("slippage_type", "Fixed");
  url.searchParams.set("slippage", (slippageBps / 10_000).toString());
  url.searchParams.set("trader_account_id", account);
  const response = await getJson(url);
  const routes = Array.isArray(response) ? response : [];
  const valid = routes.filter((route): route is Record<string, unknown> => {
    if (!route || typeof route !== "object") return false;
    const item = route as Record<string, unknown>;
    const estimated = item.estimated_amount as Record<string, unknown> | undefined;
    return item.token_output === `nep141:${token}` &&
      typeof estimated?.amount_out === "string" && /^[1-9]\d*$/.test(estimated.amount_out);
  });
  valid.sort((a, b) => {
    const x = BigInt((a.estimated_amount as { amount_out: string }).amount_out);
    const y = BigInt((b.estimated_amount as { amount_out: string }).amount_out);
    return x > y ? -1 : x < y ? 1 : 0;
  });
  if (!valid.length) throw new TokenBuyError("no_route", "No token route", 404);
  return valid[0] as { estimated_amount: { amount_out: string }; dex_id?: string };
}

export async function prepareTokenBuy(session: Session, input: Record<string, unknown>) {
  const contract = input.token_contract;
  const receiver = input.receiver;
  if (!isNearAccountId(contract) || !isNearAccountId(receiver)) {
    throw new TokenBuyError("invalid_request", "Invalid token contract or receiver");
  }
  if (typeof input.spend_usdc !== "string" || !/^(0|[1-9]\d*)$/.test(input.spend_usdc)) {
    throw new TokenBuyError("invalid_request", "Invalid spend_usdc");
  }
  const spend = BigInt(input.spend_usdc);
  if (spend < BigInt(1_000_000)) throw new TokenBuyError("below_min", "Minimum spend is 1 USDC");
  const configuredMax = process.env.TOKEN_BUY_MAX_SPEND ?? "5000000";
  if (!/^[1-9]\d*$/.test(configuredMax)) throw new Error("Invalid TOKEN_BUY_MAX_SPEND");
  if (spend > BigInt(configuredMax)) throw new TokenBuyError("above_max", "Spend exceeds beta limit");
  const slippage = input.slippage_bps === undefined ? 300 : input.slippage_bps;
  if (typeof slippage !== "number" || !Number.isInteger(slippage) || slippage < 0 || slippage > 1000) {
    throw new TokenBuyError("invalid_request", "Invalid slippage_bps");
  }
  const hours = input.deadline_hours === undefined ? 1 : input.deadline_hours;
  if (typeof hours !== "number" || !Number.isInteger(hours) || hours < 1 || hours > 24) {
    throw new TokenBuyError("invalid_request", "Invalid deadline_hours");
  }
  const [token, account] = await Promise.all([tokenInfo(contract), checkAccount(receiver)]);
  if (!account.exists && !account.implicit && input.receiver_confirmed !== true) {
    throw new TokenBuyError("receiver_not_found", "Receiver account does not exist");
  }
  const quoteAccount = process.env.TOKEN_BUY_QUOTE_ACCOUNT_ID || escrowContract();
  if (!isNearAccountId(quoteAccount)) throw new Error("Invalid TOKEN_BUY_QUOTE_ACCOUNT_ID");
  const route = await routeQuote(contract, input.spend_usdc, slippage, quoteAccount);
  const estimated = BigInt(route.estimated_amount.amount_out);
  const minimum = estimated * BigInt(10_000 - slippage) / BigInt(10_000);
  if (minimum <= BigInt(0)) throw new TokenBuyError("no_route", "Route output is too small", 404);
  const specObject = tokenBuySpec({ token_contract: contract, receiver, amount_out: minimum.toString() });
  const spec = canonicalJson(specObject);
  const fivePercent = (spend * BigInt(5) + BigInt(99)) / BigInt(100);
  const reward = fivePercent > BigInt(50_000) ? fivePercent : BigInt(50_000);
  const total = spend + reward;
  const id = `FUL-${randomBytes(4).toString("hex").toUpperCase()}`;
  const deadlineMs = Date.now() + hours * 60 * 60_000;
  const expires_at = new Date(Date.now() + 5 * 60_000).toISOString();
  const order = { id, kind: "token_buy", spec_hash: specHash(spec), pay_amount: spend.toString(),
    reward: reward.toString(), deadline_ns: (BigInt(deadlineMs) * BigInt(1_000_000)).toString() };
  const buy_token = { account_id: token.account_id, symbol: token.symbol,
    decimals: token.decimals, icon: token.icon, price_usd: token.price_usd };
  const quote = { spend: spend.toString(), estimated_out: estimated.toString(), amount_out: minimum.toString(),
    slippage_bps: slippage, reward: reward.toString(), total: total.toString(),
    price_usd: token.price_usd, route_dex: String(route.dex_id ?? ""), expires_at };
  put(`v3:spec:${id}`, "v3:spec", { order_id: id, kind: "token_buy", spec, spec_hash: order.spec_hash,
    beneficiary: receiver, buyer_email: "", buyer: session.account_id, quoted_by: null,
    buy_token, quote, expires_at: new Date(deadlineMs + 24 * 60 * 60_000).toISOString() });
  put(`v3:token_public:${id}`, "v3:token_public", { spec: specObject, buy_token });
  put(`v3:spec_summary:${id}`, "v3:spec_summary", { brand: token.symbol, denomination: minimum.toString(),
    product_value: spend.toString(), currency: "USDC", masked_beneficiary: receiver });
  put(`v3:prepared:${id}`, "v3:prepared", { account_id: session.account_id, order, expires_at });
  return { order_id: id, order, spec: specObject, quote,
    payload: await buildPayload(session, [intentFromInput({ kind: "fund", order, spec })]) };
}

function storedDeliveryHash(id: string, proofSha256: string | null): string | null {
  if (!proofSha256 || !/^[a-f0-9]{64}$/.test(proofSha256)) return null;
  const proof = get<{ base64: string; content_type?: string }>(`v3:proof:${proofSha256}`);
  if (proof?.content_type !== "application/json") return null;
  try {
    const value = JSON.parse(Buffer.from(proof.base64, "base64").toString("utf8")) as Record<string, unknown>;
    if (value.order_id === id && typeof value.tx_hash === "string" &&
      /^[1-9A-HJ-NP-Za-km-z]{43,44}$/.test(value.tx_hash)) return value.tx_hash;
  } catch {
    // A missing or malformed retained proof must not hide the order.
  }
  return null;
}

export async function tokenOrderFields(id: string, proofSha256: string | null = null) {
  const stored = get<{ kind: string; spec: string; buy_token?: BuyToken }>(`v3:spec:${id}`);
  const retained = get<{ spec: ReturnType<typeof tokenBuySpec>; buy_token: BuyToken }>(`v3:token_public:${id}`);
  if (stored?.kind !== "token_buy" && !retained) return {};
  try {
    const parsed = stored?.kind === "token_buy"
      ? JSON.parse(stored.spec) as ReturnType<typeof tokenBuySpec> : retained!.spec;
    const spec = tokenBuySpec(parsed);
    const token = await tokenInfo(spec.token_contract).catch(() => null);
    const buy_token = token ? { account_id: token.account_id, symbol: token.symbol,
      decimals: token.decimals, icon: token.icon, price_usd: token.price_usd } : stored?.buy_token ?? retained?.buy_token;
    return { spec, delivery_tx_hash: storedDeliveryHash(id, proofSha256),
      ...(buy_token ? { buy_token } : {}) };
  } catch {
    return {};
  }
}
