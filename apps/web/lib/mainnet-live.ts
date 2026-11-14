/**
 * Read-only NEAR mainnet data for the judges section on Home.
 * Pure helpers (parse, stats, tx mapping) plus a cached fetcher. No keys, no signing.
 */
export const ESCROW_ACCOUNT = "nearfullfil.near";
export const NEARBLOCKS_ACCOUNT_URL = `https://nearblocks.io/address/${ESCROW_ACCOUNT}`;
export const NEARBLOCKS_TXNS_URL = `https://nearblocks.io/address/${ESCROW_ACCOUNT}?tab=txns`;
export const nearblocksTx = (hash: string) => `https://nearblocks.io/txns/${hash}`;

const MAINNET_RPCS = ["https://rpc.mainnet.near.org", "https://rpc.mainnet.fastnear.com"];
const TIMEOUT_MS = 4000;
const CACHE_MS = 60_000;
const USER_AGENT = "fulfil-web";

export type ChainOrder = {
  id: string;
  buyer: string;
  fulfiller: string | null;
  kind: string;
  status: string;
  payAmount: bigint;
  reward: bigint;
  createdAt: number | null; // ms
  claimedAt: number | null;
  paidAt: number | null;
  attempts: number;
};
export type ChainStats = {
  ordersOnChain: number;
  paid: number;
  usdcSettled: bigint;
  profiles: number;
  medianClaimToPaidMs: number | null;
};
export type ChainTx = { hash: string; method: string; ok: boolean };
export type LiveSnapshot = {
  orders: ChainOrder[];
  stats: ChainStats;
  txs: Record<string, ChainTx[]>;
  /** When this snapshot was last refreshed from the chain (ms). */
  fetchedAt: number;
};

const SETTLED = new Set(["paid", "closed", "resolved"]);

/** Nanosecond string -> ms, or null when missing. */
export function nsToMs(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d{10,}$/.test(value)) return null;
  return Number(BigInt(value) / BigInt(1_000_000));
}

function big(value: unknown): bigint {
  try {
    return typeof value === "string" && /^\d+$/.test(value) ? BigInt(value) : BigInt(0);
  } catch {
    return BigInt(0);
  }
}

export function parseOrders(raw: unknown): ChainOrder[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const o = item as Record<string, unknown>;
    if (typeof o.id !== "string" || typeof o.status !== "string" || typeof o.kind !== "string") return [];
    return [{
      id: o.id,
      buyer: String(o.buyer ?? ""),
      fulfiller: typeof o.fulfiller === "string" ? o.fulfiller : null,
      kind: o.kind,
      status: o.status,
      payAmount: big(o.pay_amount),
      reward: big(o.reward),
      createdAt: nsToMs(o.created_at),
      claimedAt: nsToMs(o.claimed_at),
      paidAt: nsToMs(o.paid_at),
      attempts: Number(o.attempts ?? 0) || 0,
    }];
  });
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/** counts = the contract's get_counts: [orders stored, profiles]. */
export function computeStats(orders: ChainOrder[], counts: unknown): ChainStats {
  const pair = Array.isArray(counts) ? counts : [];
  const stored = Number(pair[0]);
  const profiles = Number(pair[1]);
  const settled = orders.filter((order) => SETTLED.has(order.status));
  const durations = orders.flatMap((order) =>
    order.claimedAt !== null && order.paidAt !== null && order.paidAt >= order.claimedAt && order.status !== "resolved"
      ? [order.paidAt - order.claimedAt] : []);
  return {
    ordersOnChain: Number.isFinite(stored) ? stored : orders.length,
    paid: orders.filter((order) => order.status === "paid" || order.status === "closed").length,
    usdcSettled: settled.reduce((sum, order) => sum + order.payAmount + order.reward, BigInt(0)),
    profiles: Number.isFinite(profiles) ? profiles : 0,
    medianClaimToPaidMs: median(durations),
  };
}

const ORDER_ID = /FUL-[A-F0-9]{8}/g;

/** NearBlocks txns -> order id -> transactions whose call args mention that order. Deduped by hash. */
export function mapTxnsToOrders(txns: unknown): Record<string, ChainTx[]> {
  const result: Record<string, ChainTx[]> = {};
  if (!Array.isArray(txns)) return result;
  const seen = new Set<string>();
  for (const txn of txns) {
    if (!txn || typeof txn !== "object") continue;
    const t = txn as { transaction_hash?: unknown; actions?: unknown; outcomes?: { status?: unknown } };
    const hash = t.transaction_hash;
    if (typeof hash !== "string" || !Array.isArray(t.actions)) continue;
    for (const action of t.actions as { method?: unknown; args?: unknown }[]) {
      const ids = new Set(typeof action?.args === "string" ? action.args.match(ORDER_ID) ?? [] : []);
      for (const id of ids) {
        const key = `${id}:${hash}`;
        if (seen.has(key)) continue;
        seen.add(key);
        (result[id] ??= []).push({ hash, method: String(action.method ?? ""), ok: t.outcomes?.status === true });
      }
    }
  }
  return result;
}

/** The most useful successful transaction for an order, if any. */
export function bestTx(txs: ChainTx[] | undefined): ChainTx | undefined {
  if (!txs?.length) return undefined;
  const rank = (tx: ChainTx) => (tx.ok ? 0 : 10) + (tx.method === "on_verify_result" ? 0 : tx.method === "on_auth" ? 1 : 2);
  return [...txs].sort((a, b) => rank(a) - rank(b))[0];
}

export function formatDuration(ms: number | null): string {
  if (ms === null) return "n/a";
  const seconds = Math.round(ms / 1000);
  if (seconds < 90) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 90) return `${minutes} min`;
  const hours = minutes / 60;
  return hours < 48 ? `${Math.round(hours * 10) / 10} h` : `${Math.round(hours / 24)} d`;
}

export function relativeTime(ms: number | null, now = Date.now()): string {
  if (ms === null) return "";
  const diff = Math.max(0, now - ms);
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

export function usdcFromUnits(units: bigint): string {
  const cents = Number(units / BigInt(10_000));
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export const KIND_TITLES: Record<string, string> = {
  bank_transfer: "QR payment in Vietnam",
  cryptorefills_topup: "Phone top-up",
  cryptorefills_code: "Gift card",
  in_person: "In-person delivery",
  token_buy: "Token purchase by an AI agent",
};
export const shortAccountName = (id: string) => (id.length > 22 ? `${id.slice(0, 10)}…${id.slice(-8)}` : id);

/* ---------------------------------------------------- terminal orders: merge */

/** Orders in these states can never change again, so they are stored once and never re-fetched. */
export const TERMINAL_STATUSES = new Set(["paid", "closed", "resolved", "cancelled", "expired"]);
export const isTerminal = (status: string) => TERMINAL_STATUSES.has(status);

/** The JSON shape kept in the app database (bigint amounts as strings). */
export type StoredOrder = {
  id: string; buyer: string; fulfiller: string | null; kind: string; status: string;
  payAmount: string; reward: string; createdAt: number | null; claimedAt: number | null; paidAt: number | null; attempts: number;
  /** Resolved NearBlocks transaction, if one was found. */
  txHash?: string;
  /** True once the NearBlocks lookup ran for this order; it is never run again. */
  txChecked?: boolean;
};

export const toStored = (order: ChainOrder, extra: Pick<StoredOrder, "txHash" | "txChecked"> = {}): StoredOrder => ({
  id: order.id, buyer: order.buyer, fulfiller: order.fulfiller, kind: order.kind, status: order.status,
  payAmount: order.payAmount.toString(), reward: order.reward.toString(),
  createdAt: order.createdAt, claimedAt: order.claimedAt, paidAt: order.paidAt, attempts: order.attempts, ...extra,
});
export const fromStored = (stored: StoredOrder): ChainOrder => ({
  id: stored.id, buyer: stored.buyer, fulfiller: stored.fulfiller, kind: stored.kind, status: stored.status,
  payAmount: big(stored.payAmount), reward: big(stored.reward),
  createdAt: stored.createdAt, claimedAt: stored.claimedAt, paidAt: stored.paidAt, attempts: stored.attempts,
});

/**
 * Combine what is stored with a fresh `list_orders` result.
 * - A stored terminal order always wins (it is immutable) and is never overwritten.
 * - A fetched terminal order that is not stored yet is returned in `newTerminal` to be persisted.
 * - Non-terminal orders take the fetched (latest) version and are returned in `open`.
 * - Stored orders that fell out of the fetched window are kept.
 */
export function mergeOrders(stored: Map<string, StoredOrder>, fetched: ChainOrder[]) {
  const newTerminal: ChainOrder[] = [];
  const open: ChainOrder[] = [];
  for (const order of fetched) {
    if (stored.has(order.id)) continue;
    if (isTerminal(order.status)) newTerminal.push(order);
    else open.push(order);
  }
  const orders = [...[...stored.values()].map(fromStored), ...newTerminal, ...open]
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  return { orders, newTerminal, open };
}

/* ------------------------------------------------------------------ fetching */

export async function rpcView(method: string, args: unknown): Promise<unknown> {
  const body = JSON.stringify({
    jsonrpc: "2.0", id: "fulfil", method: "query",
    params: { request_type: "call_function", finality: "final", account_id: ESCROW_ACCOUNT, method_name: method,
      args_base64: Buffer.from(JSON.stringify(args)).toString("base64") },
  });
  let failure: unknown;
  for (const url of MAINNET_RPCS) {
    try {
      const response = await fetch(url, { method: "POST", body, headers: { "content-type": "application/json", "user-agent": USER_AGENT },
        signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
      const json = await response.json() as { result?: { result?: number[] } };
      const bytes = json.result?.result;
      if (!Array.isArray(bytes)) throw new Error("no result");
      return JSON.parse(Buffer.from(bytes).toString("utf8"));
    } catch (error) {
      failure = error;
    }
  }
  throw failure instanceof Error ? failure : new Error("rpc failed");
}

/** Up to 3 pages of the account's transactions, within one shared time budget. Missing data is fine. */
export async function fetchTxns(): Promise<unknown[]> {
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  const all: unknown[] = [];
  let cursor: string | undefined;
  try {
    for (let page = 0; page < 3; page++) {
      const url = `https://api.nearblocks.io/v1/account/${ESCROW_ACCOUNT}/txns?per_page=25${cursor ? `&cursor=${cursor}` : ""}`;
      const response = await fetch(url, { headers: { "user-agent": USER_AGENT }, signal, cache: "no-store" });
      if (!response.ok) break;
      const json = await response.json() as { txns?: unknown[]; cursor?: string };
      all.push(...(json.txns ?? []));
      cursor = json.cursor;
      if (!cursor) break;
    }
  } catch {
    /* rate limited or slow: links fall back to the account page */
  }
  return all;
}

export const SNAPSHOT_TTL_MS = CACHE_MS;
