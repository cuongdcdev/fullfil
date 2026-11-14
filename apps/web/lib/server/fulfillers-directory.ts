import registryJson from "../../../../fulfillers/registry.json";
import { mergeFulfillers, type DirectoryEntry, type RegistryEntry } from "../fulfillers-directory";
import { ensureProfilesFresh, getMainnetState, readProfiles } from "./mainnet-store";

/** Registry listings merged with stored on-chain stats. Instant: reads the database and refreshes in the background. */
export function getDirectory(forceOffline = false): { entries: DirectoryEntry[]; live: boolean; loading: boolean; updatedAt: number | null } {
  const registry = registryJson as RegistryEntry[];
  if (forceOffline) return { entries: mergeFulfillers({ registry, orders: [], profiles: {} }), live: false, loading: false, updatedAt: null };
  const { snapshot, refreshing } = getMainnetState();
  const orders = snapshot?.orders ?? [];
  const accounts = [...new Set([...registry.map((item) => item.account_id), ...orders.flatMap((order) => (order.fulfiller ? [order.fulfiller] : []))])];
  const profileRefreshing = ensureProfilesFresh(accounts);
  const { profiles, oldest } = readProfiles(accounts);
  const live = Object.keys(profiles).length > 0;
  return { entries: mergeFulfillers({ registry, orders, profiles }), live, loading: refreshing || profileRefreshing, updatedAt: oldest };
}
