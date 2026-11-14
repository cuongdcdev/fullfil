import {
  formatShopSummary,
  formatTokenAmount,
  tokenBuyInfo,
  type V3Order,
} from "./v3-client";

export type ActivityKind = "nearby" | "online" | "memecoin" | "local_qr";
export type ActivityRole = "buying" | "earning";
export type ActivityStatus = { label: string; tone: "good" | "bad" | "warn" | "neutral" };

export function activityKind(order: Pick<V3Order, "kind">): ActivityKind {
  if (order.kind === "in_person") return "nearby";
  if (order.kind === "cryptorefills_topup" || order.kind === "cryptorefills_code") return "online";
  if (order.kind === "token_buy") return "memecoin";
  return "local_qr";
}

/** Brand from the stored summary, ignoring empty or placeholder values. */
function knownBrand(order: V3Order): string {
  const brand = order.spec_summary?.brand?.trim() ?? "";
  return /^unknown$/i.test(brand) ? "" : brand;
}

export function activityTitle(order: V3Order): string {
  const kind = activityKind(order);
  if (kind === "nearby") return knownBrand(order) || "Nearby item";
  if (kind === "online") {
    const summary = order.spec_summary;
    if (!summary || !knownBrand(order)) return "Online order";
    const value = formatShopSummary(summary, summary.currency);
    const suffix = order.kind === "cryptorefills_code" ? " gift card" : " top-up";
    return `${summary.brand} ${value === "Value unavailable" ? "" : value + suffix}`.trim();
  }
  if (kind === "memecoin") {
    const { token, spec } = tokenBuyInfo(order);
    if (token?.symbol && spec?.amount_out) {
      try {
        return `${formatTokenAmount(spec.amount_out, token.decimals)} ${token.symbol}`;
      } catch {
        // Older orders may have incomplete token metadata.
      }
    }
    return token?.symbol ? `Buy ${token.symbol}` : "Token order";
  }
  return order.amount_vnd > 0
    ? `QR payment · ${new Intl.NumberFormat("vi-VN").format(order.amount_vnd)} ₫`
    : "QR payment";
}

export function activityStatus(order: V3Order, role: ActivityRole): ActivityStatus {
  const earning = role === "earning";
  switch (order.status) {
    case "funded": return { label: "Waiting for a helper", tone: "warn" };
    case "claimed": {
      if (!earning) return { label: "Helper is on it", tone: "warn" };
      const job = activityKind(order);
      const label = job === "nearby" ? "Your turn: bring the item"
        : job === "local_qr" ? "Your turn: pay the shop"
          : job === "memecoin" ? "Your turn: buy the token"
            : "Your turn: fill the order";
      return { label, tone: "warn" };
    }
    case "sent": return { label: earning ? "Add proof of payment" : "Checking the proof", tone: "warn" };
    case "verifying":
    case "proof_rejected":
    case "verified": return { label: activityKind(order) === "memecoin"
      ? "Being verified by OutLayer (an independent checker)"
      : "Checking the proof", tone: "warn" };
    case "paid":
    case "closed": return { label: earning ? "Paid to you" : "Done", tone: "good" };
    case "resolved": return order.verdict === "buyer"
      ? { label: earning ? "Refunded to buyer" : "Refunded", tone: "neutral" }
      : { label: "Review complete", tone: "neutral" };
    case "cancelled": return { label: "Cancelled", tone: "neutral" };
    case "expired": return { label: "Expired", tone: "neutral" };
    case "disputed":
    case "under_review": return { label: "Being reviewed", tone: "warn" };
  }
}

export function activityHref(order: V3Order, role: ActivityRole = "buying"): string {
  if (role === "earning" && (activityKind(order) === "local_qr" || activityKind(order) === "nearby")) {
    return `/earn/active?job=${encodeURIComponent(order.id)}`;
  }
  return orderDetailHref(order);
}

/** Buyer-facing detail page for an order; the order API behind it is public. */
export function orderDetailHref(order: Pick<V3Order, "id" | "kind">): string {
  const id = encodeURIComponent(order.id);
  return activityKind(order) === "local_qr" ? `/pay/${id}` : `/shop/orders/${id}`;
}

function timestampMs(value: string | undefined): number | undefined {
  if (!value) return undefined;
  if (/^\d+$/.test(value)) {
    const n = BigInt(value);
    const ms = n > BigInt(10_000_000_000_000) ? n / BigInt(1_000_000) : n;
    const result = Number(ms);
    return Number.isFinite(result) ? result : undefined;
  }
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? undefined : ms;
}

export function activityTimestamp(order: V3Order): number | undefined {
  return timestampMs(order.created_at) ?? timestampMs(order.claimed_at_ns) ??
    timestampMs(order.claimed_at) ?? timestampMs(order.paid_at_ns) ?? timestampMs(order.paid_at);
}

export function activityDate(order: V3Order, now: number): { relative: string; absolute: string } | undefined {
  const ms = activityTimestamp(order);
  if (ms === undefined) return undefined;
  const elapsed = Math.max(0, now - ms);
  const minutes = Math.floor(elapsed / 60_000);
  const hours = Math.floor(elapsed / 3_600_000);
  const days = Math.floor(elapsed / 86_400_000);
  const relative = minutes < 1 ? "just now" : hours < 1 ? `${minutes} min ago` :
    days < 1 ? `${hours} h ago` : `${days} d ago`;
  return { relative, absolute: new Date(ms).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) };
}
