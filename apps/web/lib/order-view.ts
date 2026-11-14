import {
  buyerPhase,
  formatShopSummary,
  formatTokenAmount,
  shopTimeline,
  tokenBuyInfo,
  type OrderStatus,
  type Phase,
  type V3Order,
} from "./v3-client";

export type OrderView = Phase & { steps: string[] };

const BANK_STEPS = ["Paid", "Local found", "Shop paid", "Done"];
const IN_PERSON_STEPS = [
  "Paid",
  "Helper accepted",
  "Handed over (QR receipt)",
  "Verified",
  "Done",
];
const TOKEN_BUY_STEPS = ["Paid", "Agent bought token", "OutLayer verified", "Done"];
const SHOP_ORDER_STEPS = ["Paid", "Purchased", "Verified", "Delivered"];

export function isBankTransfer(kind?: string): boolean {
  return !kind || kind === "bank_transfer";
}

export function detailPathFor(order: Pick<V3Order, "id" | "kind">): string {
  return `${isBankTransfer(order.kind) ? "/pay" : "/shop/orders"}/${encodeURIComponent(order.id)}`;
}

export function showsVnd(kind?: string): boolean {
  return isBankTransfer(kind);
}

export function orderTitle(order: V3Order): string {
  if (order.kind === "in_person") return order.spec_summary?.brand || "Your item";
  if (order.kind === "token_buy") {
    const { token, spec } = tokenBuyInfo(order);
    const symbol = token?.symbol || "tokens";
    if (!spec) return symbol;
    const amount = token ? formatTokenAmount(spec.amount_out, token.decimals) : spec.amount_out;
    return `${amount} ${symbol}`;
  }
  if (!isBankTransfer(order.kind)) {
    const summary = order.spec_summary;
    return summary ? `${summary.brand} ${formatShopSummary(summary)}` : "Your order";
  }
  return "Shop payment";
}

function finalState(status: OrderStatus, reviewStep: number, doneStep: number, title: string): Phase | undefined {
  if (status === "cancelled" || status === "expired") {
    return {
      step: 0,
      title: status === "cancelled" ? "Order cancelled" : "Order expired",
      tone: "bad",
      done: false,
      terminal: true,
    };
  }
  if (status === "resolved") {
    return { step: reviewStep, title: "Review resolved", tone: "neutral", done: false, terminal: true };
  }
  if (status === "disputed" || status === "under_review") {
    return { step: reviewStep, title: "We're checking your order", tone: "warn", done: false, terminal: false };
  }
  if (status === "paid" || status === "closed") {
    return { step: doneStep, title, tone: "good", done: true, terminal: true };
  }
  return undefined;
}

export function timelineFor(kind: string | undefined, status: OrderStatus): OrderView {
  if (isBankTransfer(kind)) return { ...buyerPhase(status), steps: BANK_STEPS };

  if (kind === "in_person") {
    const steps = IN_PERSON_STEPS;
    const final = finalState(status, 3, steps.length, "Handed over and paid");
    if (final) return { ...final, steps };
    const step = status === "funded" ? 1 : status === "claimed" ? 2 : status === "verified" ? 4 : 3;
    const title = status === "funded"
      ? "Finding a helper…"
      : status === "claimed" ? "Meet your helper" : "Checking the handover…";
    return { steps, step, title, tone: "warn", done: false, terminal: false };
  }

  if (kind === "token_buy") {
    const steps = TOKEN_BUY_STEPS;
    const final = finalState(status, 2, steps.length, "Tokens delivered");
    if (final) return { ...final, steps };
    const step = status === "verified" ? 3 : status === "funded" || status === "claimed" ? 1 : 2;
    const title = status === "funded"
      ? "Finding an agent…"
      : status === "claimed"
        ? "An agent is buying your tokens"
        : status === "proof_rejected" ? "Delivery needs another check" : "Checking token delivery…";
    return { steps, step, title, tone: status === "verified" ? "good" : "warn", done: false, terminal: false };
  }

  const steps = SHOP_ORDER_STEPS;
  const base = shopTimeline(status);
  let step = 2;
  if (status === "funded" || status === "claimed") step = 1;
  if (status === "verified") step = 3;
  if (status === "paid" || status === "closed") step = steps.length;
  if (status === "cancelled" || status === "expired") step = 0;
  return { ...base, steps, step };
}
