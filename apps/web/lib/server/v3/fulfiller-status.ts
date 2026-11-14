import { verifyRegistryProof, type RegistryEntry } from "../registry-proof";
import { isFullAccessKey, isIntentsPublicKey } from "./rpc";

const KEY_TTL_MS = 10 * 60_000;
const KEY_NEGATIVE_TTL_MS = 3_000;
const keyCache = new Map<string, { until: number; authorized: boolean }>();

type KeyChecks = {
  fullAccess: (accountId: string, publicKey: string) => Promise<boolean>;
  intents: (accountId: string, publicKey: string) => Promise<boolean>;
  clock: () => number;
};

export async function registryEntryVerified(
  entry: RegistryEntry,
  checks: KeyChecks = {
    fullAccess: isFullAccessKey,
    intents: isIntentsPublicKey,
    clock: Date.now,
  },
): Promise<boolean> {
  if (!verifyRegistryProof(entry)) return false;
  const cacheKey = `${entry.account_id}:${entry.proof.public_key}`;
  const cached = keyCache.get(cacheKey);
  if (cached && cached.until > checks.clock()) return cached.authorized;
  let authorized = false;
  let rpcError = false;
  try {
    authorized = await checks.fullAccess(entry.account_id, entry.proof.public_key);
  } catch {
    rpcError = true;
    // A missing FullAccess key can still be registered with Intents.
  }
  if (!authorized) {
    try {
      authorized = await checks.intents(entry.account_id, entry.proof.public_key);
    } catch {
      rpcError = true;
      authorized = false;
    }
  }
  if (authorized || !rpcError) {
    keyCache.set(cacheKey, {
      until: checks.clock() + (authorized ? KEY_TTL_MS : KEY_NEGATIVE_TTL_MS),
      authorized,
    });
  }
  return authorized;
}

export function officialFulfiller(accountId: string, configured = process.env.OFFICIAL_FULFILLERS ?? ""): boolean {
  return configured.split(",").map((value) => value.trim().toLowerCase())
    .filter(Boolean).includes(accountId.toLowerCase());
}
