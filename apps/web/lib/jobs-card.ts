import { activityKind } from "./activity";
import { formatUsd, orderTotal, type V3Order } from "./v3-client";

export type JobFilter = "all" | "nearby" | "qr" | "online";
export type JobGroup = Exclude<JobFilter, "all">;

/** Minutes a fulfiller has to pay after accepting a Local QR job (escrow bank_transfer claim timeout). */
export const QR_CLAIM_MINUTES = 15;

export function jobGroup(order: Pick<V3Order, "kind">): JobGroup {
  const kind = activityKind(order as V3Order);
  return kind === "nearby" ? "nearby" : kind === "local_qr" ? "qr" : "online";
}

/** Online kinds are done by agents (bots); a human cannot accept them. */
export const isAgentJob = (order: Pick<V3Order, "kind">) => jobGroup(order) === "online";

export function filterCounts(jobs: Pick<V3Order, "kind">[]): Record<JobFilter, number> {
  const counts: Record<JobFilter, number> = { all: jobs.length, nearby: 0, qr: 0, online: 0 };
  for (const job of jobs) counts[jobGroup(job)] += 1;
  return counts;
}

export function filterJobs<T extends Pick<V3Order, "kind">>(jobs: T[], filter: JobFilter): T[] {
  return filter === "all" ? jobs : jobs.filter((job) => jobGroup(job) === filter);
}

/** The money lines on a job card. All USD strings come from the same helpers as the rest of the app. */
export function jobMoney(order: Pick<V3Order, "pay_amount" | "reward" | "amount_vnd" | "merchant_bank" | "merchant_name">) {
  return {
    reward: formatUsd(order.reward),
    payFirst: formatUsd(order.pay_amount),
    paidBack: formatUsd(orderTotal(order)),
    payVnd: order.amount_vnd > 0 ? new Intl.NumberFormat("vi-VN").format(order.amount_vnd) + " ₫" : null,
    payTo: order.merchant_bank || order.merchant_name || null,
  };
}

export function buyerLabel(account: string, profile?: { display_name?: string | null; completed_orders?: number } | null): string {
  const short = account.length > 22 ? `${account.slice(0, 10)}…${account.slice(-6)}` : account;
  const name = profile?.display_name?.trim() || short;
  const done = profile?.completed_orders;
  if (done === undefined) return name;
  return `${name} · ${done} ${done === 1 ? "order" : "orders"} completed`;
}

const FINISHED = ["paid", "closed", "resolved"];
const nsToMs = (value: string | null | undefined) => (value && /^\d{10,}$/.test(value) ? Number(BigInt(value) / BigInt(1_000_000)) : undefined);

/** Finished jobs this account did (the buyer won no refund), newest first. */
export function completedJobs<T extends Pick<V3Order, "fulfiller" | "status" | "verdict" | "paid_at" | "ended_at">>(orders: T[], me: string): T[] {
  return orders
    .filter((o) => o.fulfiller === me && FINISHED.includes(o.status) && o.verdict !== "buyer")
    .sort((a, b) => (nsToMs(b.paid_at ?? b.ended_at) ?? 0) - (nsToMs(a.paid_at ?? a.ended_at) ?? 0));
}

/** USDC units earned (pay + reward) from jobs finished in the last 7 days. */
export function earnedThisWeek(orders: Pick<V3Order, "fulfiller" | "status" | "verdict" | "paid_at" | "ended_at" | "pay_amount" | "reward">[], me: string, now: number): bigint {
  const since = now - 7 * 24 * 3_600_000;
  return completedJobs(orders, me)
    .filter((o) => (nsToMs(o.paid_at ?? o.ended_at) ?? 0) >= since)
    .reduce((sum, o) => sum + BigInt(o.pay_amount) + BigInt(o.reward), BigInt(0));
}

/** Jobs this account is currently working on. */
export function activeCount(orders: Pick<V3Order, "fulfiller" | "status">[], me: string, active: readonly string[]): number {
  return orders.filter((o) => o.fulfiller === me && active.includes(o.status)).length;
}
