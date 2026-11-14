import { describe, expect, it, vi } from "vitest";
import { canSubmitProof, formatRecoveryLine, recommendAction, recoverOrders,
  type RecoveryDeps, type RecoveryInputs } from "./recover";
import type { EscrowOrder } from "./rpc";
import type { OrderState } from "./state";

const now = Date.parse("2030-01-01T00:00:00Z");
const token = "synthetic-secret-order-token";
const state: OrderState = {
  phase: "uncertain", spec: "synthetic-spec", cr_order_id: "cr-1", cr_order_token: token,
  deposit_address: "deposit-1", amount_in: "900000", tx_hash: "tx-1",
  balance_before_payment: "2000000",
};
const order: EscrowOrder = {
  id: "FUL-TEST01", kind: "cryptorefills_topup", status: "claimed",
  spec_hash: "a".repeat(64), fulfiller: "shopper.test", pay_amount: "1000000",
  quoted_by: "shopper.test", created_at: String(BigInt(now) * 1_000_000n),
  deadline_ns: String(BigInt(now + 30 * 60_000) * 1_000_000n), sent_at: null,
};
const base: RecoveryInputs = {
  state, escrow: order, deliveryStatus: "Done", oneClickStatus: "SUCCESS",
  balance: 1_000_000n, accountId: "shopper.test", nowMs: now,
  kind: { proof_timeout_ns: String(30n * 60n * 1_000_000_000n) },
};

function fixture(input: RecoveryInputs = base) {
  const submitProof = vi.fn(async () => true);
  const deps = {
    store: { get: vi.fn(() => input.state), entries: vi.fn(() => [[order.id, input.state]]) },
    escrow: {
      getOrder: vi.fn(async () => input.escrow),
      getKinds: vi.fn(async () => ({ [order.kind]: input.kind })),
    },
    cryptorefills: { getOrderStatus: vi.fn(async () => ({ order_state: input.deliveryStatus })) },
    oneClick: { status: vi.fn(async () => input.oneClickStatus) },
    readBalance: vi.fn(async () => input.balance ?? 0n),
    accountId: input.accountId,
    clock: () => input.nowMs,
    submitProof,
  } as unknown as RecoveryDeps;
  return { deps, submitProof };
}

describe("shopper recovery", () => {
  it.each([
    ["delivered in time", base, "submit proof now"],
    ["refund pending", { ...base, deliveryStatus: "Failed", oneClickStatus: "INCOMPLETE_DEPOSIT" },
      "wait for 1Click refund"],
    ["refunded", { ...base, deliveryStatus: "Failed", oneClickStatus: "REFUNDED" },
      "wait for 1Click refund"],
    ["nothing paid", { ...base, state: { phase: "uncertain" },
      deliveryStatus: null, oneClickStatus: null }, "release claim"],
    ["payment may be pending", { ...base, state: {
      phase: "uncertain", deposit_address: "deposit-1", amount_in: "900000",
      balance_before_payment: "2000000",
    }, deliveryStatus: null, oneClickStatus: "PENDING_DEPOSIT", balance: 2_000_000n },
    "manual review"],
    ["lost paid value", { ...base, deliveryStatus: "Failed" }, "lost: amount 0.900000 USDC"],
    ["processing", { ...base, deliveryStatus: "Pending", oneClickStatus: "PROCESSING" },
      "manual review"],
    ["claim belongs to another account", { ...base, escrow: { ...order, fulfiller: "other.test" } },
      "manual review"],
  ] as const)("recommends %s", (_name, input, expected) => {
    expect(recommendAction(input as RecoveryInputs)).toBe(expected);
  });

  it("checks both the order deadline and the kind proof window", () => {
    expect(canSubmitProof(base)).toBe(true);
    expect(canSubmitProof({ ...base, escrow: {
      ...order, status: "sent", sent_at: String(BigInt(now) * 1_000_000n),
    } })).toBe(true);
    expect(canSubmitProof({ ...base, escrow: {
      ...order, deadline_ns: String(BigInt(now + 30_000) * 1_000_000n),
    } })).toBe(false);
    expect(canSubmitProof({ ...base, nowMs: now + 31 * 60_000 })).toBe(false);
    expect(canSubmitProof({ ...base, escrow: {
      ...order, sent_at: String(BigInt(now - 31 * 60_000) * 1_000_000n),
    } })).toBe(false);
    expect(canSubmitProof({ ...base, kind: undefined })).toBe(false);
  });

  it("recommends submitting proof for an in-time sent order", () => {
    const input: RecoveryInputs = {
      ...base,
      escrow: { ...order, status: "sent",
        sent_at: String(BigInt(now) * 1_000_000n) },
    };
    expect(recommendAction(input)).toBe("submit proof now");
  });

  it("prints a read-only report without the order token or voucher data", async () => {
    const { deps, submitProof } = fixture();
    const lines = await recoverOrders(deps);
    expect(lines).toEqual([
      "order=FUL-TEST01 escrow=claimed cryptorefills=Done oneclick=SUCCESS " +
      "balance=1.000000 USDC action=submit proof now",
    ]);
    expect(JSON.stringify(lines)).not.toContain(token);
    expect(submitProof).not.toHaveBeenCalled();
  });

  it("reports lost USDC for a failed delivery after the claim is released", async () => {
    const input: RecoveryInputs = {
      ...base,
      state: { ...state, phase: "failed", delivery_failed: true },
      escrow: { ...order, status: "funded", fulfiller: null },
      deliveryStatus: "Failed",
    };
    const { deps } = fixture(input);

    expect(await recoverOrders(deps)).toEqual([
      "order=FUL-TEST01 escrow=funded cryptorefills=Failed oneclick=SUCCESS " +
      "balance=1.000000 USDC action=lost: amount 0.900000 USDC",
    ]);
  });

  it("refuses --submit-proof when the claim is gone or the deadline passed", async () => {
    for (const input of [
      { ...base, escrow: { ...order, fulfiller: "other.test" } },
      { ...base, nowMs: now + 31 * 60_000 },
    ]) {
      const { deps, submitProof } = fixture(input);
      const lines = await recoverOrders(deps, order.id, true);
      expect(lines.at(-1)).toBe("order=FUL-TEST01 refused: proof not claimable or deadline passed");
      expect(submitProof).not.toHaveBeenCalled();
    }
  });

  it("calls the shared proof step only when explicitly requested and claimable", async () => {
    const { deps, submitProof } = fixture();
    const lines = await recoverOrders(deps, order.id, true);
    expect(submitProof).toHaveBeenCalledOnce();
    expect(lines.at(-1)).toBe("order=FUL-TEST01 proof submitted");
  });

  it("does not claim proof submission when the shared step declined", async () => {
    const { deps, submitProof } = fixture();
    submitProof.mockResolvedValueOnce(false);
    const lines = await recoverOrders(deps, order.id, true);
    expect(lines.at(-1)).toBe("order=FUL-TEST01 proof not submitted; check shopper state");
  });

  it("hides unexpected upstream status text in report lines", () => {
    const line = formatRecoveryLine(order.id, {
      ...base, deliveryStatus: `Done ${token}`,
      oneClickStatus: `https://example.test/?token=${token}`,
    }, "manual review");
    expect(line).not.toContain(token);
    expect(line).toContain("cryptorefills=unknown oneclick=unknown");
  });

  it("does not send a URL-like deposit value to 1Click during recovery", async () => {
    const input = { ...base, state: {
      ...state, deposit_address: `https://example.test/?token=${token}`,
    } };
    const { deps } = fixture(input);
    const lines = await recoverOrders(deps);
    expect(deps.oneClick.status).not.toHaveBeenCalled();
    expect(JSON.stringify(lines)).not.toContain(token);
  });
});
