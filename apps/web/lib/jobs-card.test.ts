import { describe, expect, it } from "vitest";
import { activeCount, buyerLabel, completedJobs, earnedThisWeek, filterCounts, filterJobs, isAgentJob, jobGroup, jobMoney } from "./jobs-card";

const o = (kind?: string) => ({ kind });

describe("jobs card helpers", () => {
  it("groups kinds", () => {
    expect(jobGroup(o("in_person"))).toBe("nearby");
    expect(jobGroup(o("bank_transfer"))).toBe("qr");
    expect(jobGroup(o(undefined))).toBe("qr");
    expect(jobGroup(o("cryptorefills_topup"))).toBe("online");
    expect(jobGroup(o("token_buy"))).toBe("online");
    expect(isAgentJob(o("cryptorefills_code"))).toBe(true);
    expect(isAgentJob(o("bank_transfer"))).toBe(false);
  });
  it("counts and filters", () => {
    const jobs = [o("in_person"), o("bank_transfer"), o("bank_transfer"), o("token_buy")];
    expect(filterCounts(jobs)).toEqual({ all: 4, nearby: 1, qr: 2, online: 1 });
    expect(filterJobs(jobs, "qr")).toHaveLength(2);
    expect(filterJobs(jobs, "all")).toHaveLength(4);
  });
  it("builds the money breakdown", () => {
    const m = jobMoney({ pay_amount: "350000", reward: "100000", amount_vnd: 9000, merchant_bank: "VPBank", merchant_name: "Cafe" });
    expect(m.reward).toBe("$0.10");
    expect(m.paidBack).toBe("$0.45");
    expect(m.payFirst).toBe("$0.35");
    expect(m.payVnd).toContain("9.000");
    expect(m.payTo).toBe("VPBank");
    expect(jobMoney({ pay_amount: "1", reward: "1", amount_vnd: 0 }).payVnd).toBeNull();
  });
  it("labels buyers", () => {
    expect(buyerLabel("alice.near", { display_name: "Alice", completed_orders: 3 })).toBe("Alice · 3 orders completed");
    expect(buyerLabel("alice.near", { display_name: null, completed_orders: 1 })).toBe("alice.near · 1 order completed");
    expect(buyerLabel("a".repeat(64))).toContain("…");
  });
  it("counts active jobs", () => {
    expect(activeCount([{ fulfiller: "me", status: "claimed" }, { fulfiller: "me", status: "paid" }, { fulfiller: "x", status: "claimed" }], "me", ["claimed"])).toBe(1);
  });
});

describe("completed jobs and weekly earnings", () => {
  const ns = (ms: number) => String(BigInt(ms) * BigInt(1_000_000));
  const now = Date.UTC(2026, 10, 11);
  const day = 24 * 3_600_000;
  const job = (over: Record<string, unknown>) => ({
    fulfiller: "me", status: "paid", verdict: undefined, pay_amount: "1000000", reward: "50000",
    paid_at: ns(now - day), ended_at: undefined, ...over,
  }) as never;
  const orders = [
    job({ id: "a", paid_at: ns(now - 2 * day) }),
    job({ id: "b", paid_at: ns(now - 10 * day) }),
    job({ id: "c", status: "claimed", paid_at: undefined }),
    job({ id: "d", fulfiller: "other" }),
    job({ id: "e", status: "resolved", verdict: "buyer" }),
    job({ id: "f", paid_at: ns(now - day) }),
  ];
  it("lists only my finished jobs, newest first, without buyer-won disputes", () => {
    expect((completedJobs(orders, "me") as unknown as { id: string }[]).map((o) => o.id)).toEqual(["f", "a", "b"]);
  });
  it("sums pay plus reward from the last 7 days only", () => {
    expect(earnedThisWeek(orders, "me", now)).toBe(BigInt(2 * 1_050_000));
    expect(earnedThisWeek([], "me", now)).toBe(BigInt(0));
  });
});
