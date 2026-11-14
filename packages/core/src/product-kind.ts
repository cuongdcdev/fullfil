import type { DeliveryType } from "./spec";

export type CryptorefillsKind = "cryptorefills_topup" | "cryptorefills_code";

const hintKeys = [
  "product_kind", "kind", "product_category", "category", "family",
  "product_type", "denomination",
] as const;
const codeHintPattern = /\b(?:e ?sims?|gift ?cards?|gifts?|vouchers?|codes?|pins?|cards?)\b/;
const mobileCategoryPattern = /^mobile_(?:credits?|data|top_?up|recharge|talk_time|bundles?|data_bundles?)$/;

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function codeHint(value: unknown): boolean {
  return codeHintPattern.test(text(value).toLowerCase().replace(/[_-]/g, " "));
}

function mobileCategory(value: string): boolean {
  return mobileCategoryPattern.test(value.toLowerCase().replace(/[- ]/g, "_"));
}

// Phone delivery is a direct top-up only for an explicit mobile category with
// no code-like product hint. All other products are codes.
export function productKind(
  product: Record<string, unknown>,
  delivery: DeliveryType,
  category: string,
): CryptorefillsKind {
  if (delivery !== "by_phone") return "cryptorefills_code";
  const hints = [...hintKeys.map((key) => product[key]), category];
  if (hints.some(codeHint)) return "cryptorefills_code";
  return mobileCategory(category) ? "cryptorefills_topup" : "cryptorefills_code";
}

// Shopper specs usually omit category. When the upstream response supplies
// one, require it to meet the same mobile-category rule as the catalog.
export function deliveryMatchesKind(
  kind: string,
  deliveryType: string,
  source: Record<string, unknown> | readonly unknown[] = {},
): boolean {
  if (kind === "cryptorefills_code") return deliveryType === "by_email";
  if (kind !== "cryptorefills_topup" || deliveryType !== "by_phone") return false;
  if (Array.isArray(source)) return !source.some(codeHint);

  const record = source as Record<string, unknown>;
  const nested = record.product && typeof record.product === "object" &&
    !Array.isArray(record.product) ? record.product as Record<string, unknown> : {};
  const hints = hintKeys.flatMap((key) => [record[key], nested[key]]);
  if (hints.some(codeHint)) return false;
  const categories = [record.category, record.product_category,
    nested.category, nested.product_category];
  return categories.every((category) => typeof category !== "string" ||
    mobileCategory(category));
}
