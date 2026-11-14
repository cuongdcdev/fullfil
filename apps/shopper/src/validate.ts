import { codeHint, deliveryMatchesKind, normalizeBeneficiary } from "@fulfil/core";

type RecordValue = Record<string, unknown>;

function record(value: unknown): RecordValue | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as RecordValue : null;
}

function nonempty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function sameText(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

export function validateResponseMatches(
  orderKind: string, spec: RecordValue, beneficiary: string, response: unknown,
): boolean {
  const result = record(response);
  if (!result || !Array.isArray(result.problems) || result.problems.length !== 0 ||
    !Array.isArray(result.deliveries) || result.deliveries.length !== 1) return false;

  const delivery = record(result.deliveries[0]);
  const deliverable = record(delivery?.deliverable);
  if (!delivery || !deliverable || !nonempty(delivery.kind) ||
    !nonempty(delivery.delivery_state) || !nonempty(deliverable.brand_name) ||
    !nonempty(deliverable.beneficiary_account)) return false;

  const deliveryType = orderKind === "cryptorefills_topup" ? "by_phone" :
    orderKind === "cryptorefills_code" ? "by_email" : null;
  if (!deliveryType || spec.delivery_type !== deliveryType ||
    deliverable.delivery_type !== deliveryType || !nonempty(beneficiary)) return false;

  try {
    if (normalizeBeneficiary(deliverable.beneficiary_account, deliveryType) !==
      normalizeBeneficiary(beneficiary, deliveryType)) return false;
  } catch {
    return false;
  }
  if (!nonempty(spec.brand_name) ||
    !sameText(deliverable.brand_name, spec.brand_name)) return false;

  if (orderKind === "cryptorefills_topup") {
    if (!nonempty(deliverable.family) ||
      (spec.family !== undefined &&
        (!nonempty(spec.family) || !sameText(deliverable.family, spec.family))) ||
      codeHint(deliverable.family) || codeHint(deliverable.brand_name) ||
      codeHint(delivery.kind) ||
      !deliveryMatchesKind(orderKind, deliveryType, deliverable)) return false;
  }

  if (deliverable.country_code !== undefined && spec.country !== undefined &&
    (!nonempty(deliverable.country_code) || !nonempty(spec.country) ||
      !sameText(deliverable.country_code, spec.country))) return false;
  return true;
}
