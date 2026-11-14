import type { ChainOrder } from "./mainnet-live";

/** Pure helpers for the public fulfillers directory. Bank fields from the chain are never read. */

export type FulfillerType = "human" | "shopper_bot" | "ai_agent";
export type KindGroup = "nearby" | "online" | "token" | "qr";
export type ProfileView = {
  approved: boolean;
  level: number;
  jobsDone: number;
  starSum: number;
  starCount: number;
  rating: number | null;
  volume: bigint;
  disputesWon: number;
  disputesLost: number;
};
export type RegistryEntry = { account_id: string; name: string; kinds: string[]; operator?: string; description?: string; official?: boolean };
export type DirectoryEntry = {
  account: string;
  name: string;
  type: FulfillerType;
  description: string;
  kinds: string[];
  official: boolean;
  listed: boolean;
  profile: ProfileView | null;
};

export const KIND_GROUPS: Record<string, KindGroup> = {
  in_person: "nearby", cryptorefills_topup: "online", cryptorefills_code: "online", token_buy: "token", bank_transfer: "qr",
};
export const GROUP_LABELS: Record<KindGroup, string> = { nearby: "Nearby", online: "Online", token: "Token", qr: "Local QR" };
export const TYPE_LABELS: Record<FulfillerType, string> = { human: "Person", shopper_bot: "Shopper bot", ai_agent: "AI agent" };

const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : 0);

/** Picks only the public numbers. `profile.bank_bin` and `account_last4` are deliberately ignored. */
export function parseProfile(raw: unknown): ProfileView | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as { stats?: Record<string, unknown>; level?: unknown; approved?: unknown };
  const stats = record.stats;
  if (!stats || typeof stats !== "object") return null;
  const starSum = num(stats.star_sum);
  const starCount = num(stats.star_count);
  let volume = BigInt(0);
  if (typeof stats.volume === "string" && /^\d+$/.test(stats.volume)) volume = BigInt(stats.volume);
  return {
    approved: record.approved === true,
    level: num(record.level),
    jobsDone: num(stats.jobs_done),
    starSum, starCount,
    rating: starCount > 0 ? starSum / starCount : null,
    volume,
    disputesWon: num(stats.disputes_won),
    disputesLost: num(stats.disputes_lost),
  };
}

export function inferType(account: string, kinds: string[], operator?: string, official?: boolean): FulfillerType {
  if (operator && operator.toLowerCase() === "human") return "human";
  if (/(hermes|agent)/i.test(account)) return "ai_agent";
  if (official || /shopper|bot/i.test(account)) return "shopper_bot";
  if (kinds.length && kinds.every((kind) => kind === "token_buy")) return "ai_agent";
  if (kinds.length && kinds.every((kind) => kind.startsWith("cryptorefills_"))) return "shopper_bot";
  return "human";
}

/** "Fullfiller One — VietQR bank transfers" -> "Fulfiller One"; "hermes-fulfiller.near" -> "Hermes fulfiller". */
export function displayName(account: string, registryName?: string): string {
  if (registryName) return registryName.split(/\s[—–-]\s/)[0].replaceAll("Fullfiller", "Fulfiller").trim();
  const base = account.replace(/\.(near|testnet)$/, "").replace(/\.nearfullfil$/, "").split(".")[0];
  const words = base.split(/[-_]+/).filter(Boolean).join(" ");
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : account;
}

const DESCRIPTIONS: Record<FulfillerType, string> = {
  human: "A person who completes jobs and is paid after the proof is verified.",
  shopper_bot: "An automated shopper that buys gift cards and top-ups with its own funds.",
  ai_agent: "An AI agent that buys tokens for buyers using only the public skill and CLI.",
};

export function mergeFulfillers(input: {
  registry: RegistryEntry[];
  orders: Pick<ChainOrder, "fulfiller" | "kind">[];
  profiles: Record<string, ProfileView | null>;
}): DirectoryEntry[] {
  const byAccount = new Map<string, { registry?: RegistryEntry; kinds: Set<string> }>();
  const slot = (account: string) => {
    let entry = byAccount.get(account);
    if (!entry) byAccount.set(account, (entry = { kinds: new Set() }));
    return entry;
  };
  for (const item of input.registry) {
    const entry = slot(item.account_id);
    entry.registry = item;
    item.kinds.forEach((kind) => entry.kinds.add(kind));
  }
  for (const order of input.orders) if (order.fulfiller) slot(order.fulfiller).kinds.add(order.kind);
  const entries = [...byAccount].map(([account, { registry, kinds }]): DirectoryEntry => {
    const kindList = [...kinds];
    const type = inferType(account, kindList, registry?.operator, registry?.official);
    return {
      account, type,
      name: displayName(account, registry?.name),
      description: registry?.description || DESCRIPTIONS[type],
      kinds: kindList,
      official: registry?.official === true,
      listed: !!registry,
      profile: input.profiles[account] ?? null,
    };
  });
  return entries.sort((a, b) =>
    (b.profile?.jobsDone ?? -1) - (a.profile?.jobsDone ?? -1) || Number(b.official) - Number(a.official) || a.name.localeCompare(b.name));
}

export function groupEntries(entries: DirectoryEntry[]): Record<KindGroup, DirectoryEntry[]> {
  const result: Record<KindGroup, DirectoryEntry[]> = { nearby: [], online: [], token: [], qr: [] };
  for (const entry of entries) {
    const groups = new Set(entry.kinds.map((kind) => KIND_GROUPS[kind]).filter(Boolean));
    groups.forEach((group) => result[group].push(entry));
  }
  return result;
}

export function formatVolume(units: bigint): string {
  const cents = Number(units / BigInt(10_000));
  return `$${(cents / 100).toFixed(2)}`;
}

export function totals(entries: DirectoryEntry[]) {
  return entries.reduce((sum, entry) => ({
    jobs: sum.jobs + (entry.profile?.jobsDone ?? 0),
    volume: sum.volume + (entry.profile?.volume ?? BigInt(0)),
  }), { jobs: 0, volume: BigInt(0) });
}
