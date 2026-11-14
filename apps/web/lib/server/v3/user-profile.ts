import { z } from "zod";
import { get, put } from "../db";
import type { V3Order } from "./escrow";

const cleanText = (value: string) => value
  .replace(/<[^>]*>/g, "")
  .replace(/[<>\x00-\x1f\x7f]/g, "")
  .trim();
const optionalText = (limit: number) => z.string().transform(cleanText)
  .pipe(z.string().max(limit));
const handle = (pattern: RegExp) => z.string().trim()
  .refine((value) => value === "" || pattern.test(value), "Invalid handle")
  .transform((value) => value.replace(/^@/, ""));

export const userProfileInput = z.object({
  display_name: optionalText(60),
  bio: optionalText(280),
  contacts: z.object({
    x: handle(/^@?[A-Za-z0-9_]{1,15}$/).optional(),
    telegram: handle(/^@?[A-Za-z][A-Za-z0-9_]{4,31}$/).optional(),
    email: z.string().trim().max(254).email().or(z.literal("")).optional(),
  }).strict(),
}).strict();

export type UserProfile = {
  account_id: string;
  display_name: string;
  bio: string;
  contacts: { x?: string; telegram?: string; email?: string };
  updated_at: string | null;
};

export function userProfile(accountId: string): UserProfile {
  return get<UserProfile>(`v3:user-profile:${accountId}`) ?? {
    account_id: accountId,
    display_name: "",
    bio: "",
    contacts: {},
    updated_at: null,
  };
}

export function saveUserProfile(accountId: string, input: unknown): UserProfile {
  const parsed = userProfileInput.parse(input);
  const contacts = Object.fromEntries(
    Object.entries(parsed.contacts).filter(([, value]) => value),
  ) as UserProfile["contacts"];
  const profile = {
    account_id: accountId,
    display_name: parsed.display_name,
    bio: parsed.bio,
    contacts,
    updated_at: new Date().toISOString(),
  };
  put(`v3:user-profile:${accountId}`, "v3:user-profile", profile);
  return profile;
}

const finalStatuses = new Set(["paid", "closed", "resolved", "cancelled", "expired"]);
const sevenDaysMs = 7 * 24 * 60 * 60_000;

function timestampMs(value: string | null | undefined): number | null {
  if (!value) return null;
  if (/^\d+$/.test(value)) {
    const number = Number(value);
    if (!Number.isFinite(number)) return null;
    return value.length >= 16 ? number / 1_000_000 : number;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function canSeeCounterpartyContacts(order: V3Order, caller: string, now = Date.now()): boolean {
  if (!order.fulfiller || !order.claimed_at || ![order.buyer, order.fulfiller].includes(caller))
    return false;
  if (order.status === "funded") return false;
  if (!finalStatuses.has(order.status)) return true;
  const ended = timestampMs(order.ended_at) ?? timestampMs(order.paid_at);
  return ended !== null && ended <= now && now - ended <= sevenDaysMs;
}
