import { createHash } from "node:crypto";
import type {
  Check,
  Counters,
  Dispute,
  EvidenceFact,
  Fulfiller,
  OrderDetail,
  OrderState,
  Quote,
  Rubric,
  Spec,
} from "./types";

export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
export function sha256(value: unknown): string {
  return createHash("sha256")
    .update(typeof value === "string" ? value : canonical(value))
    .digest("hex");
}
export function cents(amount: number): number {
  const scaled = amount * 100;
  if (
    !Number.isFinite(amount) ||
    amount < 0 ||
    !Number.isSafeInteger(Math.round(scaled)) ||
    Math.abs(scaled - Math.round(scaled)) > 1e-8
  )
    throw new Error("Amount must be nonnegative whole cents");
  return Math.round(scaled);
}
export function usd(amountCents: number): number {
  return amountCents / 100;
}
export function tier(c: Counters): 0 | 1 | 2 | 3 {
  if (c.completed >= 100 && c.appealsWon >= 1) return 3;
  if (c.completed >= 25 && c.clean / c.completed >= 0.95) return 2;
  if (c.completed >= 5 && c.clean / c.completed >= 0.9 && c.disputesLost === 0)
    return 1;
  return 0;
}
export const bondBps = [10000, 5000, 2500, 1000] as const;
export const exposureMultiplier = [1, 2, 4, 10] as const;
export function requiredBond(
  totalUsd: number,
  fulfillerTier: 0 | 1 | 2 | 3,
): number {
  return usd(Math.ceil((cents(totalUsd) * bondBps[fulfillerTier]) / 10000));
}
export function assertQuoteAffordable(
  quote: Quote,
  fulfiller: Fulfiller,
  openExposureUsd: number,
  now: Date,
): void {
  const total = cents(quote.totalUsd);
  if (total !== cents(quote.costUsd) + cents(quote.feeUsd))
    throw new Error("Quote total mismatch");
  if (quote.bondLockUsd < requiredBond(quote.totalUsd, fulfiller.tier))
    throw new Error("Bond lock below tier requirement");
  if (cents(fulfiller.bondUsd - fulfiller.lockedUsd) < cents(quote.bondLockUsd))
    throw new Error("Insufficient free bond");
  if (
    cents(openExposureUsd + quote.totalUsd) >
    cents(fulfiller.bondUsd * exposureMultiplier[fulfiller.tier])
  )
    throw new Error("Exposure limit exceeded");
  if (new Date(quote.validUntil) <= now) throw new Error("Quote expired");
}
const transitions: Record<OrderState, Partial<Record<string, OrderState>>> = {
  Draft: { lock: "Quoting", post_qr: "Accepted" },
  Quoting: { accept_quote: "Accepted", timeout: "Expired" },
  Accepted: {
    fund: "Funded",
    cancel: "Cancelled",
    qr_fund: "Funded",
    qr_expire: "Expired",
  },
  Funded: {
    submit_evidence: "Purchased",
    timeout: "Refunded",
    qr_cancel: "Cancelled",
    qr_expire: "Expired",
    qr_refund: "Refunded",
    to_review: "Delivered",
  },
  Purchased: {
    verify_ok: "Delivered",
    verify_fail: "Rejected",
    to_review: "Delivered",
  },
  Delivered: { confirm: "Released", timeout: "Released", dispute: "Disputed" },
  Disputed: { verdict: "Resolved" },
  Resolved: {
    settle_release: "Released",
    settle_refund: "Refunded",
    appeal: "Disputed",
  },
  Rejected: { refund: "Refunded" },
  Released: {},
  Refunded: {},
  Cancelled: {},
  Expired: {},
};
export function transition(
  order: OrderDetail,
  action: string,
  at: Date,
  detail?: string,
  demoSecondsPerHour = 3600,
): OrderDetail {
  const next = transitions[order.state][action];
  if (!next) throw new Error(`Cannot ${action} from ${order.state}`);
  if (
    ((action === "confirm" && order.kind !== "qr_payment") ||
      (action === "timeout" && order.state === "Delivered")) &&
    !releaseGateOpen(order, at, demoSecondsPerHour)
  )
    throw new Error("Release gate closed");
  if (
    action === "timeout" &&
    order.state === "Funded" &&
    at < new Date(order.rubric.windows.purchaseDeadline)
  )
    throw new Error("Purchase deadline not reached");
  if (action === "verdict" && !order.dispute?.outcome)
    throw new Error("Validated verdict required");
  if (action === "appeal" && (order.dispute?.appealCount || !order.dispute))
    throw new Error("Appeal unavailable");
  if (action === "fund" && !order.quoteId)
    throw new Error("Accepted quote required");
  return {
    ...order,
    state: next,
    history: [
      ...order.history,
      {
        id: sha256(`${order.id}:${action}:${at.toISOString()}`).slice(0, 16),
        type: action,
        from: order.state,
        to: next,
        at: at.toISOString(),
        detail,
      },
    ],
  };
}
export function releaseGateOpen(
  order: OrderDetail,
  now: Date,
  secondsPerHour: number,
): boolean {
  if (order.state !== "Delivered") return false;
  if (order.kind === "qr_payment") return false;
  const tier = order.fulfiller?.tier;
  const gate =
    tier === 0
      ? "after_event"
      : tier === 3
        ? "immediate"
        : tier === 1 || tier === 2
          ? "after_challenge"
          : order.rubric.windows.releaseGate;
  if (gate === "immediate") return true;
  if (gate === "after_event")
    return (
      "date" in order.spec && now >= new Date(`${order.spec.date}T23:59:59Z`)
    );
  const delivered = [...order.history]
    .reverse()
    .find((e) => e.to === "Delivered");
  const hours =
    tier === 1 ? 24 : tier === 2 ? 6 : order.rubric.windows.autoAcceptHours;
  return (
    !!delivered &&
    now.getTime() >=
      new Date(delivered.at).getTime() + hours * secondsPerHour * 1000
  );
}
export function evaluateRubric(
  rubric: Rubric,
  evidence: EvidenceFact,
  spec: Spec,
  usedNullifiers: Set<string>,
): Check[] {
  const source: Record<string, unknown> = {
    ...evidence.extracted,
    dkimDomain: evidence.dkimDomain,
    dkimValid: evidence.dkimValid,
    nullifier: evidence.nullifier,
  };
  return rubric.deterministicChecks.map((check) => {
    const actual = source[check.field];
    let pass = false;
    switch (check.op) {
      case "eq":
      case "date_eq":
        pass = canonical(actual) === canonical(check.value);
        break;
      case "includes":
        pass = Array.isArray(actual)
          ? Array.isArray(check.value) &&
            check.value.every((v) => actual.includes(v))
          : String(actual ?? "").includes(String(check.value));
        break;
      case "lte":
        pass = typeof actual === "number" && actual <= Number(check.value);
        break;
      case "domain_in":
        pass = Array.isArray(check.value) && check.value.includes(actual);
        break;
      case "unused":
        pass = !usedNullifiers.has(String(actual));
        break;
    }
    if (check.field === "dkimValid") pass = evidence.dkimValid && pass;
    return {
      id: check.id,
      pass,
      detail: pass ? "Matched locked rubric" : `Mismatch for ${check.field}`,
    };
  });
}
export function lint(
  spec: Spec,
  rubric: Rubric,
): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  if (rubric.version !== 1 || !rubric.deterministicChecks.length)
    errors.push("Rubric needs deterministic checks");
  if (
    !Number.isFinite(rubric.disputeStakePct) ||
    rubric.disputeStakePct < 0 ||
    rubric.disputeStakePct > 100
  )
    errors.push("Invalid dispute stake");
  if ("category" in spec) {
    if (
      !spec.item ||
      !/^\d{4}-\d{2}-\d{2}$/.test(spec.date) ||
      spec.qty < 1 ||
      spec.names.length !== spec.qty ||
      cents(spec.maxCostUsd) <= 0
    )
      errors.push("Incomplete ticket specification");
    if (
      !spec.allowedSenderDomains.length ||
      !spec.evidenceClasses.includes("dkim_email")
    )
      errors.push("DKIM source required");
    const checks = rubric.deterministicChecks;
    if (
      !checks.some(
        (check) =>
          check.field === "dkimValid" &&
          check.op === "eq" &&
          check.value === true,
      )
    )
      errors.push("DKIM validity check must require true");
    if (
      !checks.some(
        (check) =>
          check.field === "dkimDomain" &&
          check.op === "domain_in" &&
          Array.isArray(check.value) &&
          spec.allowedSenderDomains.every((domain) =>
            (check.value as unknown[]).includes(domain),
          ),
      )
    )
      errors.push("DKIM domain allowlist check required");
    if (
      !checks.some(
        (check) =>
          check.field === "date" &&
          check.op === "date_eq" &&
          check.value === spec.date,
      )
    )
      errors.push("Locked date check required");
    if (
      !checks.some(
        (check) =>
          check.field === "qty" &&
          check.op === "eq" &&
          check.value === spec.qty,
      )
    )
      errors.push("Locked quantity check required");
    if (
      !checks.some(
        (check) =>
          check.field === "names" &&
          check.op === "includes" &&
          Array.isArray(check.value) &&
          spec.names.every((name) => (check.value as unknown[]).includes(name)),
      )
    )
      errors.push("Locked passenger names check required");
    if (
      !checks.some(
        (check) => check.field === "nullifier" && check.op === "unused",
      )
    )
      errors.push("Unused ticket nullifier check required");
    if (!rubric.aiChecks.some((check) => check.evidence.includes("ticket_pdf")))
      errors.push("Ticket PDF check required");
  } else if (spec.amountLocal <= 0 || !spec.payeeAccountHash)
    errors.push("Invalid QR payment");
  return { valid: errors.length === 0, errors, warnings: [] };
}
export function injectionDetected(text: string): boolean {
  return /\b(system:|developer:|ignore (all |the )?(previous|rubric|instructions)|override|you are now|refund me regardless)\b/i.test(
    text,
  );
}
export function disputeStake(
  escrowUsd: number,
  pct: number,
  appeal = false,
): number {
  return (
    Math.max(2, usd(Math.ceil((cents(escrowUsd) * pct) / 100))) *
    (appeal ? 2 : 1)
  );
}
export function majority(
  votes: { verdict: "fulfiller" | "buyer" | "split"; splitPct?: number }[],
): { outcome: Dispute["outcome"]; splitPct?: number } {
  const counts = new Map<string, number>();
  for (const v of votes)
    counts.set(v.verdict, (counts.get(v.verdict) ?? 0) + 1);
  const ranked = [...counts].sort((a, b) => b[1] - a[1]);
  if (!ranked.length || ranked[0][1] <= votes.length / 2)
    throw new Error("Court has no majority; escalate");
  if (ranked[0][0] === "split") {
    const pcts = votes
      .filter((v) => v.verdict === "split")
      .map((v) => v.splitPct);
    if (
      pcts.some(
        (p) => p === undefined || !Number.isInteger(p) || p < 0 || p > 100,
      ) ||
      new Set(pcts).size !== 1
    )
      throw new Error("Invalid split verdict");
    return { outcome: "split", splitPct: pcts[0] };
  }
  return { outcome: ranked[0][0] as "fulfiller" | "buyer" };
}
