import { eq } from "drizzle-orm";
import { db, get, put, records } from "./db";
import {
  SNAPSHOT_TTL_MS, bestTx, computeStats, fetchTxns, fromStored, mapTxnsToOrders, mergeOrders, parseOrders, rpcView, toStored,
  type ChainTx, type LiveSnapshot, type StoredOrder,
} from "../mainnet-live";
import { parseProfile, type ProfileView } from "../fulfillers-directory";

/**
 * NEAR mainnet data, kept in the app's own database under `mainnet:*` keys. These never mix with mock order records
 * (`v3:*`). Terminal orders are immutable, so each is stored once and never fetched again. Pages read the stored
 * snapshot instantly; a background refresh (one at a time, about every 60 s) brings in only what is new or open.
 */
const ORDER_KIND = "mainnet:order";
const PROFILE_KIND = "mainnet:profile";
const SNAPSHOT_KEY = "mainnet:snapshot";
const RETRY_AFTER_FAILURE_MS = 10_000;

type Snapshot = { updatedAt: number; counts: unknown; open: StoredOrder[] };
type StoredProfile = { account: string; updatedAt: number; profile: Omit<ProfileView, "volume"> & { volume: string } };

const globals = globalThis as typeof globalThis & {
  __mainnetRefresh?: Promise<void>;
  __mainnetFailedAt?: number;
  __mainnetProfileRefresh?: Promise<void>;
};

const rows = <T>(kind: string): T[] => db.select().from(records).where(eq(records.kind, kind)).all().map((row) => JSON.parse(row.value) as T);

/* ----------------------------------------------------------------- orders */

/** Instant, synchronous read of what is stored. Null when nothing has ever been fetched. */
export function readSnapshot(): LiveSnapshot | null {
  const snap = get<Snapshot>(SNAPSHOT_KEY);
  const terminal = rows<StoredOrder>(ORDER_KIND);
  if (!snap && !terminal.length) return null;
  const stored = [...terminal, ...(snap?.open ?? [])];
  const orders = stored.map(fromStored).sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  const txs: Record<string, ChainTx[]> = {};
  for (const item of stored) if (item.txHash) txs[item.id] = [{ hash: item.txHash, method: "", ok: true }];
  return { orders, stats: computeStats(orders, snap?.counts), txs, fetchedAt: snap?.updatedAt ?? 0 };
}

async function refreshOrders(): Promise<void> {
  try {
    const [counts, raw] = await Promise.all([rpcView("get_counts", {}), rpcView("list_orders", { limit: 50 })]);
    const fetched = parseOrders(raw);
    if (!fetched.length) throw new Error("empty list_orders");
    const stored = new Map(rows<StoredOrder>(ORDER_KIND).map((order) => [order.id, order]));
    const merged = mergeOrders(stored, fetched);
    // NearBlocks is only asked about orders that have no transaction answer yet, and each order is only asked once.
    const unchecked = [...stored.values()].filter((order) => !order.txChecked);
    if (merged.newTerminal.length || unchecked.length) {
      const txns = await fetchTxns();
      const map = txns.length ? mapTxnsToOrders(txns) : {};
      for (const order of unchecked) {
        if (!txns.length) break;
        put(`${ORDER_KIND}:${order.id}`, ORDER_KIND, { ...order, txHash: bestTx(map[order.id])?.hash ?? order.txHash, txChecked: true });
      }
      for (const order of merged.newTerminal) {
        put(`${ORDER_KIND}:${order.id}`, ORDER_KIND, toStored(order, { txHash: bestTx(map[order.id])?.hash, txChecked: txns.length > 0 }));
      }
    }
    put(SNAPSHOT_KEY, "mainnet:snapshot", { updatedAt: Date.now(), counts, open: merged.open.map((order) => toStored(order)) } satisfies Snapshot);
    globals.__mainnetFailedAt = undefined;
  } catch {
    globals.__mainnetFailedAt = Date.now();
  }
}

/** Kick off a background refresh when the snapshot is stale. Never awaited by pages, and only one runs at a time. */
export function ensureFresh(): void {
  if (globals.__mainnetRefresh) return;
  const snap = get<Snapshot>(SNAPSHOT_KEY);
  if (snap && Date.now() - snap.updatedAt < SNAPSHOT_TTL_MS) return;
  if (globals.__mainnetFailedAt && Date.now() - globals.__mainnetFailedAt < RETRY_AFTER_FAILURE_MS) return;
  globals.__mainnetRefresh = refreshOrders().finally(() => { globals.__mainnetRefresh = undefined; });
}

/** What every page uses: the stored snapshot right now, plus whether a refresh is running (so the page can fill in). */
export function getMainnetState(): { snapshot: LiveSnapshot | null; refreshing: boolean } {
  const snapshot = readSnapshot();
  ensureFresh();
  return { snapshot, refreshing: !!globals.__mainnetRefresh };
}

/* --------------------------------------------------------------- profiles */

const serialize = (account: string, profile: ProfileView): StoredProfile =>
  ({ account, updatedAt: Date.now(), profile: { ...profile, volume: profile.volume.toString() } });
const deserialize = (stored: StoredProfile): ProfileView => ({ ...stored.profile, volume: BigInt(stored.profile.volume) });

export function readProfiles(accounts: string[]): { profiles: Record<string, ProfileView | null>; oldest: number | null } {
  const wanted = new Set(accounts);
  const profiles: Record<string, ProfileView | null> = {};
  let oldest: number | null = null;
  for (const stored of rows<StoredProfile>(PROFILE_KIND)) {
    if (!wanted.has(stored.account)) continue;
    profiles[stored.account] = deserialize(stored);
    oldest = oldest === null ? stored.updatedAt : Math.min(oldest, stored.updatedAt);
  }
  return { profiles, oldest };
}

/** Refresh stale or missing profile stats in the background. Only public stats are stored (never bank fields). */
export function ensureProfilesFresh(accounts: string[]): boolean {
  if (globals.__mainnetProfileRefresh) return true;
  const known = new Map(rows<StoredProfile>(PROFILE_KIND).map((stored) => [stored.account, stored.updatedAt]));
  const stale = accounts.filter((account) => Date.now() - (known.get(account) ?? 0) >= SNAPSHOT_TTL_MS);
  if (!stale.length) return false;
  globals.__mainnetProfileRefresh = Promise.all(stale.map(async (account) => {
    try {
      const profile = parseProfile(await rpcView("get_profile", { account_id: account }));
      if (profile) put(`${PROFILE_KIND}:${account}`, PROFILE_KIND, serialize(account, profile));
    } catch {
      /* keep the last good value */
    }
  })).then(() => undefined).finally(() => { globals.__mainnetProfileRefresh = undefined; });
  return true;
}
