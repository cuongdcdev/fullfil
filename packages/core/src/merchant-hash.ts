import { createHash } from "node:crypto";

export function normalizeAccount(account: string): string {
  return account.trim().toUpperCase().replace(/[\p{White_Space}.-]/gu, "");
}

export function merchantHash(account: string): string {
  return createHash("sha256")
    .update(normalizeAccount(account), "utf8")
    .digest("hex");
}

/** Alias used by the v3 backend. */
export const normalizeMerchantAccount = normalizeAccount;
