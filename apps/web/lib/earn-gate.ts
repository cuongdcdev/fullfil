import { BANKS, type Me } from "./v3-client";

/** True only once `register_fulfiller` has run. `me.profile` itself is always an object, so look at the inner record. */
export function isRegisteredFulfiller(me: Pick<Me, "profile"> | null | undefined): boolean {
  return !!me?.profile?.profile;
}

/** The bank on chain, or null for delivery-only fulfillers (empty bin). */
export function registeredBank(me: Pick<Me, "profile"> | null | undefined): { bin: string; name: string; last4: string } | null {
  const p = me?.profile?.profile;
  if (!p || !p.bank_bin) return null;
  return { bin: p.bank_bin, name: BANKS.find((b) => b.bin === p.bank_bin)?.name ?? "Bank", last4: p.account_last4 };
}

/** Banks to offer: real ones only, plus the fictional demo banks when the demo (mock) backend is on. */
export function bankOptions(demo: boolean) {
  return BANKS.filter((b) => demo || !b.demo);
}

export const isLast4 = (value: string) => /^\d{4}$/.test(value);

/** Show the deposit rows only when some deposit exists. */
export function hasDeposit(bond: { available: string; locked: string } | undefined): boolean {
  if (!bond) return false;
  try {
    return BigInt(bond.available || "0") > BigInt(0) || BigInt(bond.locked || "0") > BigInt(0);
  } catch {
    return false;
  }
}
