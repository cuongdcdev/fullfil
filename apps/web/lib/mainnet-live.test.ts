import { describe, expect, it } from "vitest";
import { bestTx, computeStats, formatDuration, fromStored, isTerminal, mapTxnsToOrders, median, mergeOrders, parseOrders, relativeTime, toStored, usdcFromUnits, type StoredOrder } from "./mainnet-live";

const ns = (ms: number) => String(BigInt(ms) * BigInt(1_000_000));
const raw = (over: Record<string, unknown>) => ({
  id: "FUL-AAAAAAAA", buyer: "b.near", fulfiller: "f.near", kind: "token_buy", status: "paid",
  pay_amount: "1000000", reward: "50000", created_at: ns(1_000_000), claimed_at: ns(1_010_000), paid_at: ns(1_040_000), attempts: 1, ...over,
});

describe("parseOrders", () => {
  it("keeps valid orders and drops junk", () => {
    const orders = parseOrders([raw({}), null, { id: 5 }, raw({ id: "FUL-BBBBBBBB", fulfiller: null, claimed_at: null })]);
    expect(orders.map((o) => o.id)).toEqual(["FUL-AAAAAAAA", "FUL-BBBBBBBB"]);
    expect(orders[0]).toMatchObject({ payAmount: BigInt(1_000_000), reward: BigInt(50_000), claimedAt: 1_010_000, paidAt: 1_040_000 });
    expect(orders[1].claimedAt).toBeNull();
    expect(parseOrders("nope")).toEqual([]);
  });
});

describe("computeStats", () => {
  const orders = parseOrders([
    raw({}),
    raw({ id: "FUL-CCCCCCCC", paid_at: ns(1_110_000) }),
    raw({ id: "FUL-DDDDDDDD", status: "resolved", pay_amount: "393701", reward: "100000" }),
    raw({ id: "FUL-EEEEEEEE", status: "funded", paid_at: null }),
  ]);
  it("counts paid, settled USDC and median claim-to-paid", () => {
    const stats = computeStats(orders, [7, 4]);
    expect(stats.ordersOnChain).toBe(7);
    expect(stats.profiles).toBe(4);
    expect(stats.paid).toBe(2);
    expect(stats.usdcSettled).toBe(BigInt(1_050_000 * 2 + 493_701));
    expect(stats.medianClaimToPaidMs).toBe(65_000); // 30 s and 100 s
  });
  it("falls back to list length when counts are missing", () => {
    expect(computeStats(orders, undefined)).toMatchObject({ ordersOnChain: 4, profiles: 0 });
  });
});

describe("median and formatting", () => {
  it("handles empty, odd and even lists", () => {
    expect(median([])).toBeNull();
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(3);
  });
  it("formats durations, times and USDC", () => {
    expect(formatDuration(27_700)).toBe("28s");
    expect(formatDuration(5 * 60_000)).toBe("5 min");
    expect(formatDuration(null)).toBe("n/a");
    expect(relativeTime(1000, 1000 + 3 * 3_600_000)).toBe("3 h ago");
    expect(usdcFromUnits(BigInt(1_234_560_000))).toBe("$1,234.56");
  });
});

describe("mapTxnsToOrders", () => {
  const txn = (hash: string, method: string, args: string | null, ok = true) =>
    ({ transaction_hash: hash, outcomes: { status: ok }, actions: [{ method, args }] });
  it("maps order ids found in call args to deduped transactions", () => {
    const map = mapTxnsToOrders([
      txn("H1", "on_auth", JSON.stringify({ order_id: "FUL-AAAAAAAA" })),
      txn("H1", "on_auth", JSON.stringify({ order_id: "FUL-AAAAAAAA" })),
      txn("H2", "on_verify_result", JSON.stringify({ id: "FUL-AAAAAAAA", also: "FUL-BBBBBBBB" })),
      txn("H3", "expire", JSON.stringify({ order_id: "FUL-BBBBBBBB" }), false),
      txn("H4", "add_version", null),
      { nope: true },
    ]);
    expect(map["FUL-AAAAAAAA"].map((t) => t.hash)).toEqual(["H1", "H2"]);
    expect(map["FUL-BBBBBBBB"].map((t) => t.hash)).toEqual(["H2", "H3"]);
    expect(Object.keys(map)).toHaveLength(2);
  });
  it("prefers a successful verification transaction", () => {
    const map = mapTxnsToOrders([
      txn("F", "expire", "FUL-AAAAAAAA", false),
      txn("A", "on_auth", "FUL-AAAAAAAA"),
      txn("V", "on_verify_result", "FUL-AAAAAAAA"),
    ]);
    expect(bestTx(map["FUL-AAAAAAAA"])?.hash).toBe("V");
    expect(bestTx(undefined)).toBeUndefined();
  });
});

describe("terminal orders and merging", () => {
  it("knows which statuses are final", () => {
    for (const status of ["paid", "closed", "resolved", "cancelled", "expired"]) expect(isTerminal(status)).toBe(true);
    for (const status of ["funded", "claimed", "sent", "verifying", "under_review", "disputed"]) expect(isTerminal(status)).toBe(false);
  });
  it("round-trips an order through its stored shape", () => {
    const [order] = parseOrders([raw({})]);
    const stored = toStored(order, { txHash: "H1", txChecked: true });
    expect(JSON.parse(JSON.stringify(stored))).toEqual(stored);
    expect(fromStored(stored)).toEqual(order);
  });

  const stored = (over: Record<string, unknown>, extra: Partial<StoredOrder> = {}) =>
    toStored(parseOrders([raw(over)])[0], extra);
  const map = (...items: StoredOrder[]) => new Map(items.map((item) => [item.id, item]));

  it("never replaces a stored terminal order and never returns it as new", () => {
    const old = stored({ id: "FUL-AAAAAAAA", status: "paid" }, { txHash: "H1", txChecked: true });
    const fetched = parseOrders([raw({ id: "FUL-AAAAAAAA", status: "paid", reward: "999" })]);
    const merged = mergeOrders(map(old), fetched);
    expect(merged.newTerminal).toEqual([]);
    expect(merged.orders).toHaveLength(1);
    expect(merged.orders[0].reward).toBe(BigInt(50_000)); // the stored copy, not the refetched one
  });
  it("appends new terminal orders for persisting and keeps non-terminal ones as open", () => {
    const old = stored({ id: "FUL-AAAAAAAA", status: "paid", created_at: ns(1_000_000) });
    const fetched = parseOrders([
      raw({ id: "FUL-AAAAAAAA", status: "paid", created_at: ns(1_000_000) }),
      raw({ id: "FUL-BBBBBBBB", status: "paid", created_at: ns(3_000_000) }),
      raw({ id: "FUL-CCCCCCCC", status: "funded", created_at: ns(4_000_000), fulfiller: null }),
    ]);
    const merged = mergeOrders(map(old), fetched);
    expect(merged.newTerminal.map((o) => o.id)).toEqual(["FUL-BBBBBBBB"]);
    expect(merged.open.map((o) => o.id)).toEqual(["FUL-CCCCCCCC"]);
    expect(merged.orders.map((o) => o.id)).toEqual(["FUL-CCCCCCCC", "FUL-BBBBBBBB", "FUL-AAAAAAAA"]); // newest first
  });
  it("updates an open order when it moves on and turns it terminal when it finishes", () => {
    const first = mergeOrders(map(), parseOrders([raw({ id: "FUL-DDDDDDDD", status: "funded", fulfiller: null })]));
    expect(first.open[0].status).toBe("funded");
    expect(first.newTerminal).toEqual([]);
    const second = mergeOrders(map(), parseOrders([raw({ id: "FUL-DDDDDDDD", status: "claimed" })]));
    expect(second.open[0].status).toBe("claimed");
    const third = mergeOrders(map(), parseOrders([raw({ id: "FUL-DDDDDDDD", status: "paid" })]));
    expect(third.open).toEqual([]);
    expect(third.newTerminal.map((o) => o.status)).toEqual(["paid"]);
  });
  it("keeps stored orders that fell out of the fetched window", () => {
    const old = stored({ id: "FUL-EEEEEEEE", status: "resolved" });
    const merged = mergeOrders(map(old), []);
    expect(merged.orders.map((o) => o.id)).toEqual(["FUL-EEEEEEEE"]);
    expect(merged.newTerminal).toEqual([]);
  });
});
