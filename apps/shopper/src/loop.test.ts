import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { processOrder, recordState, runOnce, type BotClients } from "./loop";
import type { EscrowOrder } from "./rpc";
import { StateStore, type OrderState } from "./state";
import { canonicalJson, cryptorefillsSpec, specHash } from "@fulfil/core";
import { describeCycleError, HttpError, TimeoutError } from "./diagnostics";
import type { JournalInput } from "./journal";
import { StateLock } from "./lock";

const token = "synthetic-secret-order-token";
const salt = "1".repeat(32);
const spec = canonicalJson(cryptorefillsSpec({ brand_name: "Synthetic Mobile", country: "VN",
  denomination: "20000 VND", delivery_type: "by_phone", beneficiary: "+84900000001", salt }));
const order: EscrowOrder = {
  id: "FUL-TEST01",
  kind: "cryptorefills_topup",
  status: "funded",
  spec_hash: specHash(spec),
  fulfiller: null,
  pay_amount: "1000000",
  quoted_by: "shopper.test",
  created_at: "1800000000000000000",
  deadline_ns: "1800001800000000000",
  claimed_at: "1800000000000000000",
  sent_at: null,
};
const startMs = 1_800_000_000_000;

function validationResponse(
  request: Record<string, unknown>,
  kind = "mobile_recharge",
  family = "Synthetic Mobile",
): Record<string, unknown> {
  return {
    coin_amount: "0.89", problems: [], deliveries: [{
      id: "synthetic-delivery", delivery_state: "Created", kind,
      deliverable: { ...request, family, delivery_type: kind === "giftcard" ? "by_email" : "by_phone" },
    }],
  };
}

function realValidation(kind: "topup" | "code"): Record<string, unknown> {
  const filename = `cryptorefills-validate-${kind}-vn.json`;
  return JSON.parse(readFileSync(new URL(`../../../tests/fixtures/${filename}`, import.meta.url),
    "utf8")) as Record<string, unknown>;
}

function deadlineNs(deadlineMs: number): string {
  return (BigInt(deadlineMs) * 1_000_000n).toString();
}

const testLocks: StateLock[] = [];

function fixture() {
  const path = join(mkdtempSync(join(tmpdir(), "fulfil-shopper-")), "state.json");
  const lock = StateLock.acquire(path);
  testLocks.push(lock);
  const store = new StateStore(path, lock);
  const journal = { record: vi.fn((_entry: JournalInput) => {}) };
  const alerter = { alert: vi.fn() };
  const log = vi.fn();
  const intents: string[] = [];
  const api = {
    request: vi.fn(async (_method: "GET" | "POST", path: string) => {
      if (path.includes("/spec")) return { spec, beneficiary: "+84900000001", buyer_email: "buyer@example.com" };
      if (path === "/proofs") return { sha256: "a".repeat(64), payload: { payload_to_sign: { message: "proof", nonce: "", recipient: "intents.near" } } };
      return { order: { status: "claimed", fulfiller: "shopper.test", spec_hash: specHash(spec) } };
    }),
    signAndSubmit: vi.fn(async (input: Record<string, unknown>) => {
      intents.push(String(input.op ?? input.kind));
      return { tx_hash: "synthetic-tx" };
    }),
    submitBuilt: vi.fn(async () => ({ tx_hash: "synthetic-proof-tx" })),
  };
  const cryptorefills = {
    validateOrder: vi.fn(async (request: Record<string, unknown>) => validationResponse(request)),
    createOrder: vi.fn(async () => ({ order_id: "cr-1", order_token: token,
      wallet_address: "0x0000000000000000000000000000000000000001", coin_amount: "0.89" })),
    getOrderStatus: vi.fn(async () => ({ order_state: "Done" })),
  };
  const oneClick = {
    quote: vi.fn(async () => ({ amountIn: "900000", amountOut: "890000", depositAddress: "deposit-1" })),
    submit: vi.fn(async () => {}),
    status: vi.fn().mockResolvedValueOnce("PENDING").mockResolvedValue("SUCCESS"),
  };
  const escrow = {
    getOrder: vi.fn(async () => ({
      ...order,
      spec_hash: specHash(spec),
      status: store.get(order.id) ? "claimed" : "funded",
      fulfiller: store.get(order.id) ? "shopper.test" : null,
    })),
    getClaimTimeoutNs: vi.fn(async () => "1800000000000" as string | null),
  };
  const clients = { api, escrow, cryptorefills, oneClick, store, journal, alerter,
    accountId: "shopper.test", maxUsdc: BigInt(20_000_000), reserveUsdc: 0n,
    minTimeLeftMs: 900_000,
    clock: () => 1_800_000_000_000, sleep: async () => {}, readBalance: vi.fn(async () => 1_000_000n),
    log } as unknown as BotClients;
  return { clients, api, escrow, cryptorefills, oneClick, store, journal, alerter,
    path, lock, intents, log };
}

function setEscrowDeadline(test: ReturnType<typeof fixture>, deadlineMs: number): void {
  test.escrow.getOrder.mockImplementation(async () => ({
    ...order,
    deadline_ns: deadlineNs(deadlineMs),
    status: test.store.get(order.id) ? "claimed" : "funded",
    fulfiller: test.store.get(order.id) ? "shopper.test" : null,
  }));
}

function paidState(overrides: Partial<OrderState> = {}): OrderState {
  return {
    phase: "paid_submitted", paid_at: startMs, deposit_address: "deposit-1",
    tx_hash: "synthetic-tx", cr_order_id: "cr-1", cr_order_token: token,
    spec, beneficiary: "+84900000001", ...overrides,
  };
}

function productFixture(
  kind: string,
  deliveryType: "by_phone" | "by_email",
  brandName: string,
  denomination = "20000 VND",
  beneficiaryOverride?: string,
) {
  const test = fixture();
  const beneficiary = beneficiaryOverride ??
    (deliveryType === "by_phone" ? "+84900000001" : "buyer@example.com");
  const productSpec = canonicalJson(cryptorefillsSpec({
    brand_name: brandName, country: "VN", delivery_type: deliveryType,
    denomination, beneficiary, salt,
  }));
  const candidate = { ...order, kind, spec_hash: specHash(productSpec) };
  test.api.request.mockResolvedValueOnce({
    spec: productSpec, beneficiary, buyer_email: "buyer@example.com",
  } as never);
  test.escrow.getOrder.mockImplementation(async () => ({
    ...candidate,
    status: test.store.get(order.id) ? "claimed" : "funded",
    fulfiller: test.store.get(order.id) ? "shopper.test" : null,
  }));
  test.cryptorefills.validateOrder.mockImplementation(async (request) =>
    validationResponse(request, kind === "cryptorefills_code" ? "giftcard" : "mobile_recharge",
      brandName));
  return { test, candidate, productSpec };
}

describe("shopper state machine", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    for (const lock of testLocks.splice(0)) lock.release();
  });

  it("marks sent once after polled swap SUCCESS, with the transfer hash saved", async () => {
    const test = fixture();
    test.api.signAndSubmit.mockImplementation(async (input) => {
      if (input.op === "sent") {
        expect(test.store.get(order.id)).toMatchObject({
          phase: "paid_submitted", tx_hash: "synthetic-tx",
          swap_succeeded_at: startMs,
        });
        expect(test.oneClick.status).toHaveBeenCalledTimes(2);
        expect(test.cryptorefills.getOrderStatus).not.toHaveBeenCalled();
      }
      return { tx_hash: "synthetic-tx" };
    });

    await processOrder(order, test.clients);

    expect(test.api.signAndSubmit.mock.calls.filter(([input]) => input.op === "sent"))
      .toEqual([[{ kind: "auth_call", op: "sent", order_id: order.id }]]);
    expect(test.store.get(order.id)?.sent_marked_at).toBe(startMs);
    expect(test.journal.record).toHaveBeenCalledWith(expect.objectContaining({
      order_id: order.id, from_phase: "paid_submitted", to_phase: null,
      stage: "sent", state: expect.objectContaining({ tx_hash: "synthetic-tx" }),
    }));
  });

  it("marks sent after an immediate swap SUCCESS", async () => {
    const test = fixture();
    test.oneClick.status.mockReset().mockResolvedValue("SUCCESS");

    await processOrder(order, test.clients);

    expect(test.oneClick.status).toHaveBeenCalledTimes(1);
    expect(test.api.signAndSubmit.mock.calls.filter(([input]) => input.op === "sent"))
      .toHaveLength(1);
    expect(test.store.get(order.id)?.swap_succeeded_at).toBe(startMs);
  });

  it.each(["sent", "verifying", "proof_rejected", "verified", "under_review",
    "paid", "closed", "disputed", "resolved"])(
    "records an already %s chain order without signing sent again", async (status) => {
      const test = fixture();
      test.store.set(order.id, paidState());
      test.escrow.getOrder.mockResolvedValue({
        ...order, status, fulfiller: "shopper.test", sent_at: deadlineNs(startMs),
      });
      test.oneClick.status.mockReset().mockResolvedValue("SUCCESS");

      await processOrder(order, test.clients);

      expect(test.api.signAndSubmit.mock.calls.filter(([input]) => input.op === "sent"))
        .toHaveLength(0);
      expect(test.store.get(order.id)?.sent_marked_at).toBe(startMs);
    });

  it.each([
    { label: "timeout", failure: () => new TimeoutError(), kind: "Timeout" },
    { label: "error", failure: () => new Error(token), kind: "Error" },
  ])("continues proof after a sent-mark $label", async ({ failure, kind }) => {
    const test = fixture();
    test.api.signAndSubmit.mockImplementation(async (input) => {
      if (input.op === "sent") throw failure();
      return { tx_hash: "synthetic-tx" };
    });

    await processOrder(order, test.clients);

    expect(test.store.get(order.id)?.phase).toBe("proof_submitted");
    expect(test.store.get(order.id)?.sent_marked_at).toBeUndefined();
    expect(test.api.submitBuilt).toHaveBeenCalledTimes(1);
    expect(test.log).toHaveBeenCalledWith(
      `Shopper order sent-mark failed order=${order.id} stage=sent kind=${kind} http=-`);
    expect(JSON.stringify(test.log.mock.calls)).not.toContain(token);
    expect(test.alerter.alert).not.toHaveBeenCalled();
  });

  it("keeps the sent flag and continues proof when the sent journal write fails", async () => {
    const test = fixture();
    test.journal.record.mockImplementation((entry) => {
      if (entry.stage === "sent") throw new Error("synthetic journal failure");
    });

    await processOrder(order, test.clients);

    expect(test.store.get(order.id)).toMatchObject({
      phase: "proof_submitted", sent_marked_at: startMs,
    });
    expect(test.api.signAndSubmit.mock.calls.filter(([input]) => input.op === "sent"))
      .toHaveLength(1);
    expect(test.log).toHaveBeenCalledWith(
      `Shopper order sent-mark failed order=${order.id} stage=sent kind=Error http=-`);
    expect(test.alerter.alert).not.toHaveBeenCalled();
  });

  it("retries sent on the next cycle without resending the transfer", async () => {
    const test = fixture();
    test.store.set(order.id, paidState());
    test.api.signAndSubmit.mockRejectedValueOnce(new TimeoutError());
    test.oneClick.status.mockReset().mockResolvedValue("SUCCESS");
    test.cryptorefills.getOrderStatus.mockRejectedValueOnce(new Error("delivery unavailable"));

    await expect(processOrder(order, test.clients)).rejects.toSatisfy((error: unknown) =>
      describeCycleError(error) === "Shopper cycle failed stage=delivery kind=Error http=-");
    expect(test.store.get(order.id)?.sent_marked_at).toBeUndefined();
    expect(test.store.get(order.id)?.swap_succeeded_at).toBe(startMs);

    test.api.request.mockResolvedValueOnce({ orders: [] } as never);
    await runOnce(test.clients);

    expect(test.api.signAndSubmit.mock.calls.filter(([input]) => input.op === "sent"))
      .toHaveLength(2);
    expect(test.api.signAndSubmit.mock.calls.filter(([input]) => input.kind === "transfer"))
      .toHaveLength(0);
    expect(test.store.get(order.id)?.sent_marked_at).toBe(startMs);
  });

  it("does not re-sign sent after restarting with a persisted flag", async () => {
    const test = fixture();
    test.store.set(order.id, paidState({ swap_succeeded_at: startMs,
      sent_marked_at: startMs }));
    test.oneClick.status.mockReset().mockResolvedValue("SUCCESS");
    const restarted = new StateStore(test.path, test.lock);

    await processOrder(order, { ...test.clients, store: restarted });

    expect(restarted.get(order.id)?.phase).toBe("proof_submitted");
    expect(test.api.signAndSubmit.mock.calls.filter(([input]) => input.op === "sent"))
      .toHaveLength(0);
  });

  it("does not mark sent for a delivered state without swap confirmation", async () => {
    const test = fixture();
    test.store.set(order.id, paidState({ phase: "delivered" }));

    await processOrder(order, test.clients);

    expect(test.api.signAndSubmit.mock.calls.filter(([input]) => input.op === "sent"))
      .toHaveLength(0);
  });

  it.each(["delivered", "proof_uploaded"] as const)(
    "retries sent from %s after a persisted swap confirmation", async (phase) => {
      const test = fixture();
      test.store.set(order.id, paidState({
        phase,
        swap_succeeded_at: startMs,
        ...(phase === "proof_uploaded" ? { proof_sha256: "a".repeat(64) } : {}),
      }));

      await processOrder(order, test.clients);

      expect(test.api.signAndSubmit.mock.calls.filter(([input]) => input.op === "sent"))
        .toHaveLength(1);
      expect(test.store.get(order.id)?.sent_marked_at).toBe(startMs);
      expect(test.store.get(order.id)?.phase).toBe("proof_submitted");
    });

  it("skips sent after the on-chain claim timeout", async () => {
    const test = fixture();
    test.store.set(order.id, paidState());
    test.escrow.getOrder.mockImplementation(async () => ({
      ...order, claimed_at: deadlineNs(startMs - 10 * 60_000),
      status: test.store.get(order.id) ? "claimed" : "funded",
      fulfiller: test.store.get(order.id) ? "shopper.test" : null,
    }));
    test.escrow.getClaimTimeoutNs.mockResolvedValue("600000000000");
    test.oneClick.status.mockReset().mockResolvedValue("SUCCESS");
    test.cryptorefills.getOrderStatus.mockRejectedValue(new Error("delivery unavailable"));

    await expect(processOrder(order, test.clients)).rejects.toThrow();

    expect(test.api.signAndSubmit.mock.calls.filter(([input]) => input.op === "sent"))
      .toHaveLength(0);
    expect(test.log).toHaveBeenCalledWith(
      `Shopper order sent-mark skipped order=${order.id} stage=sent code=claim_timeout`);
    expect(test.store.get(order.id)?.swap_succeeded_at).toBe(startMs);
    expect(test.store.get(order.id)).toMatchObject({
      phase: "paid_submitted", sent_blocked_alerted_at: startMs,
    });
    expect(test.alerter.alert).toHaveBeenCalledExactlyOnceWith({
      order_id: order.id, phase: "uncertain", stage: "sent", code: "claim_timeout",
    });

    const restarted = new StateStore(test.path, test.lock);
    await expect(processOrder(order, { ...test.clients, store: restarted })).rejects.toThrow();
    expect(restarted.get(order.id)?.phase).toBe("paid_submitted");
    expect(test.alerter.alert).toHaveBeenCalledTimes(1);
  });

  it("alerts when the sent mark is blocked by a lost claim", async () => {
    const test = fixture();
    test.store.set(order.id, paidState());
    const claimed = { ...order, status: "claimed", fulfiller: "shopper.test" };
    test.escrow.getOrder.mockResolvedValue(claimed)
      .mockResolvedValueOnce(claimed)
      .mockResolvedValueOnce(claimed)
      .mockResolvedValueOnce({ ...claimed, fulfiller: "other.test" });
    test.oneClick.status.mockReset().mockResolvedValue("SUCCESS");
    test.cryptorefills.getOrderStatus.mockRejectedValue(new Error("delivery unavailable"));

    await expect(processOrder(order, test.clients)).rejects.toThrow();

    expect(test.alerter.alert).toHaveBeenCalledExactlyOnceWith({
      order_id: order.id, phase: "uncertain", stage: "sent", code: "claim_lost",
    });
    expect(test.store.get(order.id)?.phase).toBe("paid_submitted");
    expect(test.store.get(order.id)?.sent_blocked_alerted_at).toBe(startMs);
    expect(test.api.signAndSubmit.mock.calls.filter(([input]) => input.op === "sent"))
      .toHaveLength(0);
  });

  it("continues proof when a sent-skip alert sink throws", async () => {
    const test = fixture();
    test.store.set(order.id, paidState());
    test.escrow.getOrder.mockResolvedValue({
      ...order, status: "claimed", fulfiller: "shopper.test",
      claimed_at: deadlineNs(startMs - 10 * 60_000),
    });
    test.escrow.getClaimTimeoutNs.mockResolvedValue("600000000000");
    test.oneClick.status.mockReset().mockResolvedValue("SUCCESS");
    test.alerter.alert.mockImplementation(() => { throw new Error("alert sink failed"); });

    await processOrder(order, test.clients);

    expect(test.store.get(order.id)?.phase).toBe("proof_submitted");
    expect(test.store.get(order.id)?.sent_blocked_alerted_at).toBe(startMs);
    expect(test.api.submitBuilt).toHaveBeenCalledTimes(1);
  });

  it("attempts sent when the kind timeout view fails", async () => {
    const test = fixture();
    test.store.set(order.id, paidState());
    test.escrow.getOrder.mockImplementation(async () => ({
      ...order, claimed_at: deadlineNs(startMs - 60_000),
      status: test.store.get(order.id) ? "claimed" : "funded",
      fulfiller: test.store.get(order.id) ? "shopper.test" : null,
    }));
    test.escrow.getClaimTimeoutNs.mockRejectedValue(new Error("kind view unavailable"));
    test.oneClick.status.mockReset().mockResolvedValue("SUCCESS");

    await processOrder(order, test.clients);

    expect(test.api.signAndSubmit.mock.calls.filter(([input]) => input.op === "sent"))
      .toHaveLength(1);
    expect(test.store.get(order.id)?.sent_marked_at).toBe(startMs);
  });

  it("skips a listed order with less than the minimum time left", async () => {
    const test = fixture();
    setEscrowDeadline(test, startMs + 14 * 60_000);
    test.api.request.mockResolvedValueOnce({ orders: [{ id: order.id }] } as never);

    await runOnce(test.clients);

    expect(test.api.signAndSubmit).not.toHaveBeenCalled();
    expect(test.store.get(order.id)).toBeUndefined();
    expect(test.journal.record).not.toHaveBeenCalled();
  });

  it("claims when the chain deadline meets the minimum time left", async () => {
    const test = fixture();
    setEscrowDeadline(test, startMs + 15 * 60_000);

    await processOrder(order, test.clients);

    expect(test.intents).toContain("claim");
    expect(test.store.get(order.id)?.phase).toBe("proof_submitted");
  });

  it("releases before createOrder when the deadline becomes near", async () => {
    const test = fixture();
    const deadlineMs = startMs + 30 * 60_000;
    let clockMs = startMs;
    test.clients.clock = () => clockMs;
    setEscrowDeadline(test, deadlineMs);
    test.cryptorefills.validateOrder.mockImplementation(async (request) => {
      clockMs = deadlineMs - 9 * 60_000;
      return validationResponse(request);
    });

    await processOrder(order, test.clients);

    expect(test.store.get(order.id)?.phase).toBe("released");
    expect(test.cryptorefills.createOrder).not.toHaveBeenCalled();
    expect(test.intents).not.toContain("transfer");
    expect(test.alerter.alert).not.toHaveBeenCalled();
    expect(test.log).toHaveBeenCalledWith(
      `Shopper order refused order=${order.id} stage=create code=deadline_near`);
    expect(test.journal.record).toHaveBeenCalledWith(expect.objectContaining({
      stage: "create", error_code: "deadline_near", to_phase: null,
    }));
  });

  it("releases an unpaid merchant order when the deadline becomes near before pay", async () => {
    const test = fixture();
    const deadlineMs = startMs + 30 * 60_000;
    let clockMs = startMs;
    test.clients.clock = () => clockMs;
    setEscrowDeadline(test, deadlineMs);
    test.oneClick.quote.mockImplementation(async () => {
      clockMs = deadlineMs - 9 * 60_000;
      return { amountIn: "900000", amountOut: "890000", depositAddress: "deposit-1" };
    });

    await processOrder(order, test.clients);

    expect(test.cryptorefills.createOrder).toHaveBeenCalledTimes(1);
    expect(test.store.get(order.id)?.phase).toBe("released");
    expect(test.api.signAndSubmit.mock.calls.filter(([input]) => input.kind === "transfer"))
      .toHaveLength(0);
    expect(test.alerter.alert).not.toHaveBeenCalled();
    expect(test.log).toHaveBeenCalledWith(
      `Shopper order refused order=${order.id} stage=pay code=deadline_near`);
    expect(test.journal.record).toHaveBeenCalledWith(expect.objectContaining({
      stage: "pay", error_code: "deadline_near", to_phase: null,
    }));
  });

  it("proceeds when at least eight minutes of claim time remain", async () => {
    const test = fixture();
    test.escrow.getClaimTimeoutNs.mockResolvedValue("480000000000");

    await processOrder(order, test.clients);

    expect(test.cryptorefills.createOrder).toHaveBeenCalledTimes(1);
    expect(test.api.signAndSubmit.mock.calls.filter(([input]) => input.kind === "transfer"))
      .toHaveLength(1);
    expect(test.store.get(order.id)?.phase).toBe("proof_submitted");
  });

  it("releases before createOrder when fewer than eight claim minutes remain", async () => {
    const test = fixture();
    let clockMs = startMs;
    test.clients.clock = () => clockMs;
    setEscrowDeadline(test, startMs + 60 * 60_000);
    test.cryptorefills.validateOrder.mockImplementation(async (request) => {
      clockMs = startMs + 23 * 60_000;
      return validationResponse(request);
    });

    await processOrder(order, test.clients);

    expect(test.store.get(order.id)?.phase).toBe("released");
    expect(test.cryptorefills.createOrder).not.toHaveBeenCalled();
    expect(test.api.signAndSubmit.mock.calls.filter(([input]) => input.kind === "transfer"))
      .toHaveLength(0);
    expect(test.alerter.alert).not.toHaveBeenCalled();
    expect(test.log).toHaveBeenCalledWith(
      `Shopper order refused order=${order.id} stage=create code=claim_timeout_near`);
    expect(test.journal.record).toHaveBeenCalledWith(expect.objectContaining({
      stage: "create", error_code: "claim_timeout_near", to_phase: null,
    }));
  });

  it("releases before pay when fewer than eight claim minutes remain", async () => {
    const test = fixture();
    let clockMs = startMs;
    test.clients.clock = () => clockMs;
    setEscrowDeadline(test, startMs + 60 * 60_000);
    test.oneClick.quote.mockImplementation(async () => {
      clockMs = startMs + 23 * 60_000;
      return { amountIn: "900000", amountOut: "890000", depositAddress: "deposit-1" };
    });

    await processOrder(order, test.clients);

    expect(test.cryptorefills.createOrder).toHaveBeenCalledTimes(1);
    expect(test.store.get(order.id)?.phase).toBe("released");
    expect(test.api.signAndSubmit.mock.calls.filter(([input]) => input.kind === "transfer"))
      .toHaveLength(0);
    expect(test.alerter.alert).not.toHaveBeenCalled();
    expect(test.log).toHaveBeenCalledWith(
      `Shopper order refused order=${order.id} stage=pay code=claim_timeout_near`);
    expect(test.journal.record).toHaveBeenCalledWith(expect.objectContaining({
      stage: "pay", error_code: "claim_timeout_near", to_phase: null,
    }));
  });

  it("fails closed when claimed_at is null", async () => {
    const test = fixture();
    test.escrow.getOrder.mockImplementation(async () => ({
      ...order, claimed_at: null,
      status: test.store.get(order.id) ? "claimed" : "funded",
      fulfiller: test.store.get(order.id) ? "shopper.test" : null,
    }));

    await processOrder(order, test.clients);

    expect(test.store.get(order.id)?.phase).toBe("released");
    expect(test.cryptorefills.createOrder).not.toHaveBeenCalled();
    expect(test.api.signAndSubmit.mock.calls.filter(([input]) => input.kind === "transfer"))
      .toHaveLength(0);
    expect(test.alerter.alert).not.toHaveBeenCalled();
    expect(test.log).toHaveBeenCalledWith(
      `Shopper order refused order=${order.id} stage=create code=claim_timeout_unknown`);
    expect(test.journal.record).toHaveBeenCalledWith(expect.objectContaining({
      stage: "create", error_code: "claim_timeout_unknown", to_phase: null,
    }));
  });

  it("fails closed when the kind timeout view throws", async () => {
    const test = fixture();
    test.escrow.getClaimTimeoutNs.mockRejectedValue(new Error("synthetic view failure"));

    await processOrder(order, test.clients);

    expect(test.store.get(order.id)?.phase).toBe("released");
    expect(test.cryptorefills.createOrder).not.toHaveBeenCalled();
    expect(test.api.signAndSubmit.mock.calls.filter(([input]) => input.kind === "transfer"))
      .toHaveLength(0);
    expect(test.alerter.alert).not.toHaveBeenCalled();
    expect(test.log).toHaveBeenCalledWith(
      `Shopper order refused order=${order.id} stage=create code=claim_timeout_unknown`);
    expect(test.journal.record).toHaveBeenCalledWith(expect.objectContaining({
      stage: "create", error_code: "claim_timeout_unknown", to_phase: null,
    }));
  });

  it("fails closed when the kind timeout field is missing", async () => {
    const test = fixture();
    test.escrow.getClaimTimeoutNs.mockResolvedValue(null);

    await processOrder(order, test.clients);

    expect(test.store.get(order.id)?.phase).toBe("released");
    expect(test.cryptorefills.createOrder).not.toHaveBeenCalled();
    expect(test.api.signAndSubmit.mock.calls.filter(([input]) => input.kind === "transfer"))
      .toHaveLength(0);
    expect(test.log).toHaveBeenCalledWith(
      `Shopper order refused order=${order.id} stage=create code=claim_timeout_unknown`);
  });

  it("alerts once when the deadline passes after payment", async () => {
    const test = fixture();
    const deadlineMs = startMs + 30 * 60_000;
    let clockMs = startMs;
    test.clients.clock = () => clockMs;
    setEscrowDeadline(test, deadlineMs);
    test.api.signAndSubmit.mockImplementation(async (input) => {
      if (input.kind === "transfer") clockMs = deadlineMs;
      return { tx_hash: "synthetic-tx" };
    });

    await processOrder(order, test.clients);

    expect(test.store.get(order.id)?.phase).toBe("uncertain");
    expect(test.store.get(order.id)?.tx_hash).toBe("synthetic-tx");
    expect(test.alerter.alert).toHaveBeenCalledTimes(1);
    expect(test.alerter.alert).toHaveBeenCalledWith({
      order_id: order.id, phase: "uncertain", stage: "proof", code: "deadline_passed",
    });
    expect(test.cryptorefills.getOrderStatus).not.toHaveBeenCalled();
  });

  it("stops a paid swap when polling reaches the proof margin", async () => {
    const test = fixture();
    const deadlineMs = startMs + 30 * 60_000;
    let clockMs = startMs;
    test.clients.clock = () => clockMs;
    setEscrowDeadline(test, deadlineMs);
    test.oneClick.status.mockReset().mockImplementationOnce(async () => {
      clockMs = deadlineMs - 30_000;
      return "PENDING";
    });

    await processOrder(order, test.clients);

    expect(test.store.get(order.id)?.phase).toBe("uncertain");
    expect(test.oneClick.submit).not.toHaveBeenCalled();
    expect(test.alerter.alert).toHaveBeenCalledTimes(1);
    expect(test.alerter.alert).toHaveBeenCalledWith({
      order_id: order.id, phase: "uncertain", stage: "proof", code: "deadline_passed",
    });
  });

  it.each([
    ["cryptorefills_topup", "by_email", "Synthetic Mobile"],
    ["cryptorefills_code", "by_phone", "Synthetic Gift Card"],
  ] as const)("releases a contradictory %s with %s and brand %s", async (
    kind, deliveryType, brandName,
  ) => {
    const { test, candidate } = productFixture(kind, deliveryType, brandName);

    await processOrder(candidate, test.clients);

    expect(test.store.get(order.id)?.phase).toBe("released");
    expect(test.cryptorefills.validateOrder).not.toHaveBeenCalled();
    expect(test.cryptorefills.createOrder).not.toHaveBeenCalled();
    expect(test.api.signAndSubmit.mock.calls.filter(([input]) => input.kind === "transfer"))
      .toHaveLength(0);
    expect(test.intents).toContain("release_claim");
    expect(test.alerter.alert).not.toHaveBeenCalled();
    expect(test.log).toHaveBeenCalledWith(
      `Shopper order refused order=${order.id} stage=validate code=kind_mismatch`);
    expect(test.journal.record).toHaveBeenCalledWith(expect.objectContaining({
      order_id: order.id, from_phase: "spec_fetched", to_phase: null,
      stage: "validate", error_code: "kind_mismatch",
    }));
  });

  it("releases when validation reports product_type gift card", async () => {
    const { test, candidate } = productFixture(
      "cryptorefills_topup", "by_phone", "Synthetic Mobile");
    test.cryptorefills.validateOrder.mockImplementationOnce(async (request) => {
      const result = validationResponse(request);
      const item = (result.deliveries as Array<Record<string, unknown>>)[0];
      (item.deliverable as Record<string, unknown>).product_type = "gift card";
      return result;
    });

    await processOrder(candidate, test.clients);

    expect(test.store.get(order.id)?.phase).toBe("released");
    expect(test.cryptorefills.createOrder).not.toHaveBeenCalled();
    expect(test.intents).not.toContain("transfer");
  });

  it("accepts a Smart Philippines top-up with a mobile category from validation", async () => {
    const { test, candidate } = productFixture(
      "cryptorefills_topup", "by_phone", "Smart Philippines");
    test.cryptorefills.validateOrder.mockImplementationOnce(async (request) => {
      const result = validationResponse(request, "mobile_recharge", "Philippines");
      const delivery = (result.deliveries as Array<Record<string, unknown>>)[0];
      (delivery.deliverable as Record<string, unknown>).category = "mobile_data";
      return result;
    });

    await processOrder(candidate, test.clients);

    expect(test.store.get(order.id)?.phase).toBe("proof_submitted");
    expect(test.cryptorefills.createOrder).toHaveBeenCalledTimes(1);
  });

  it("releases a top-up when validation reports a non-mobile category", async () => {
    const { test, candidate } = productFixture(
      "cryptorefills_topup", "by_phone", "Smart Philippines");
    test.cryptorefills.validateOrder.mockImplementationOnce(async (request) => {
      const result = validationResponse(request, "mobile_recharge", "Philippines");
      const delivery = (result.deliveries as Array<Record<string, unknown>>)[0];
      (delivery.deliverable as Record<string, unknown>).category = "Shopping";
      return result;
    });

    await processOrder(candidate, test.clients);

    expect(test.store.get(order.id)?.phase).toBe("released");
    expect(test.cryptorefills.createOrder).not.toHaveBeenCalled();
    expect(test.api.signAndSubmit.mock.calls.filter(([input]) => input.kind === "transfer"))
      .toHaveLength(0);
  });

  it.each([
    ["topup", "cryptorefills_topup", "by_phone", "Viettel Mobile Credits",
      "20000 VND", "+84901234567"],
    ["code", "cryptorefills_code", "by_email", "Razer Gold USD",
      "1 USD", "synthetic@example.test"],
  ] as const)("accepts the real sanitized %s validation response", async (
    fixtureKind, kind, deliveryType, brand, denomination, beneficiary,
  ) => {
    const { test, candidate } = productFixture(
      kind, deliveryType, brand, denomination, beneficiary);
    candidate.pay_amount = "2000000";
    test.cryptorefills.validateOrder.mockResolvedValueOnce(realValidation(fixtureKind));

    await processOrder(candidate, test.clients);

    expect(test.store.get(order.id)?.phase).toBe("proof_submitted");
    expect(test.cryptorefills.createOrder).toHaveBeenCalledTimes(1);
    expect(test.api.signAndSubmit.mock.calls.filter(([input]) => input.kind === "transfer"))
      .toHaveLength(1);
  });

  it.each([
    ["topup response for code order", "cryptorefills_code", "by_email",
      "Viettel Mobile Credits", "synthetic@example.test", "topup"],
    ["code response for topup order", "cryptorefills_topup", "by_phone",
      "Razer Gold USD", "+84901234567", "code"],
  ] as const)("refuses a %s", async (
    _label, kind, deliveryType, brand, beneficiary, responseKind,
  ) => {
    const { test, candidate } = productFixture(
      kind, deliveryType, brand, "20000 VND", beneficiary);
    test.cryptorefills.validateOrder.mockResolvedValueOnce(realValidation(responseKind));

    await processOrder(candidate, test.clients);

    expect(test.cryptorefills.validateOrder).toHaveBeenCalledTimes(1);
    expect(test.store.get(order.id)?.phase).toBe("released");
    expect(test.cryptorefills.createOrder).not.toHaveBeenCalled();
    expect(test.api.signAndSubmit.mock.calls.filter(([input]) => input.kind === "transfer"))
      .toHaveLength(0);
    expect(test.log).toHaveBeenCalledWith(
      `Shopper order refused order=${order.id} stage=validate code=kind_mismatch`);
    expect(test.alerter.alert).not.toHaveBeenCalled();
  });

  it.each([
    ["eSIM brand", (result: Record<string, unknown>) => {
      const item = (result.deliveries as Array<Record<string, unknown>>)[0];
      (item.deliverable as Record<string, unknown>).brand_name = "Viettel eSIM";
    }],
    ["beneficiary mismatch", (result: Record<string, unknown>) => {
      const item = (result.deliveries as Array<Record<string, unknown>>)[0];
      (item.deliverable as Record<string, unknown>).beneficiary_account = "+84901234568";
    }],
    ["brand mismatch", (result: Record<string, unknown>) => {
      const item = (result.deliveries as Array<Record<string, unknown>>)[0];
      (item.deliverable as Record<string, unknown>).brand_name = "Another Mobile";
    }],
    ["two deliveries", (result: Record<string, unknown>) => {
      const deliveries = result.deliveries as Array<Record<string, unknown>>;
      deliveries.push(structuredClone(deliveries[0]));
    }],
    ["zero deliveries", (result: Record<string, unknown>) => {
      result.deliveries = [];
    }],
    ["validation problems", (result: Record<string, unknown>) => {
      result.problems = [{ message: "synthetic problem" }];
    }],
    ["missing deliverable field", (result: Record<string, unknown>) => {
      const item = (result.deliveries as Array<Record<string, unknown>>)[0];
      delete (item.deliverable as Record<string, unknown>).family;
    }],
  ] as const)("refuses a validated top-up with %s", async (_label, mutate) => {
    const { test, candidate } = productFixture(
      "cryptorefills_topup", "by_phone", "Viettel Mobile Credits",
      "20000 VND", "+84901234567");
    const response = realValidation("topup");
    mutate(response);
    test.cryptorefills.validateOrder.mockResolvedValueOnce(response);

    await processOrder(candidate, test.clients);

    expect(test.cryptorefills.validateOrder).toHaveBeenCalledTimes(1);
    expect(test.store.get(order.id)?.phase).toBe("released");
    expect(test.cryptorefills.createOrder).not.toHaveBeenCalled();
    expect(test.api.signAndSubmit.mock.calls.filter(([input]) => input.kind === "transfer"))
      .toHaveLength(0);
    expect(test.log).toHaveBeenCalledWith(
      `Shopper order refused order=${order.id} stage=validate code=kind_mismatch`);
    expect(test.alerter.alert).not.toHaveBeenCalled();
  });

  it("uses one trimmed beneficiary for the hash, validation, and creation", async () => {
    const { test, candidate } = productFixture(
      "cryptorefills_topup", "by_phone", "Viettel Mobile Credits",
      "20000 VND", "  +84901234567  ");
    test.cryptorefills.validateOrder.mockResolvedValueOnce(realValidation("topup"));

    await processOrder(candidate, test.clients);

    expect(test.store.get(order.id)?.phase).toBe("proof_submitted");
    expect(test.cryptorefills.validateOrder).toHaveBeenCalledWith(expect.objectContaining({
      beneficiary_account: "+84901234567",
    }));
    expect(test.cryptorefills.createOrder).toHaveBeenCalledWith(
      "buyer@example.com", expect.objectContaining({ beneficiary_account: "+84901234567" }));
  });

  it("does not pay a contradictory order resumed from cr_created", async () => {
    const { test, candidate, productSpec } = productFixture(
      "cryptorefills_topup", "by_phone", "Synthetic Mobile", "Gift Card 10");
    test.store.set(order.id, {
      phase: "cr_created", spec: productSpec, beneficiary: "+84900000001",
      cr_order_id: "cr-1", cr_order_token: token, cr_created_at: 1_800_000_000_000,
    });

    await processOrder(candidate, test.clients);

    expect(test.store.get(order.id)?.phase).toBe("released");
    expect(test.oneClick.quote).not.toHaveBeenCalled();
    expect(test.intents).not.toContain("transfer");
    expect(test.journal.record).toHaveBeenCalledWith(expect.objectContaining({
      from_phase: "cr_created", stage: "validate", error_code: "kind_mismatch",
    }));
  });

  it.each([
    ["cryptorefills_topup", "by_phone", "Synthetic Mobile"],
    ["cryptorefills_topup", "by_phone", "Smart Philippines"],
    ["cryptorefills_topup", "by_phone", "Pinoy Load"],
    ["cryptorefills_code", "by_email", "Synthetic Gift Card"],
  ] as const)("processes a matching %s delivered %s", async (
    kind, deliveryType, brandName,
  ) => {
    const { test, candidate } = productFixture(kind, deliveryType, brandName);

    await processOrder(candidate, test.clients);

    expect(test.store.get(order.id)?.phase).toBe("proof_submitted");
    expect(test.cryptorefills.createOrder).toHaveBeenCalledTimes(1);
    expect(test.api.signAndSubmit.mock.calls.filter(([input]) => input.kind === "transfer"))
      .toHaveLength(1);
  });
  it("fsyncs journal steps before purchase and payment calls", async () => {
    const test = fixture();
    const calls: string[] = [];
    test.journal.record.mockImplementation((entry) => {
      if (entry.to_phase === null) calls.push(`journal:${entry.stage}`);
    });
    test.cryptorefills.createOrder.mockImplementation(async () => {
      calls.push("createOrder");
      return { order_id: "cr-1", order_token: token,
        wallet_address: "0x0000000000000000000000000000000000000001", coin_amount: "0.89" };
    });
    test.api.signAndSubmit.mockImplementation(async (input) => {
      if (input.kind === "transfer") calls.push("signAndSubmit:transfer");
      return { tx_hash: "synthetic-tx" };
    });

    await processOrder(order, test.clients);

    expect(calls.indexOf("journal:create")).toBeLessThan(calls.indexOf("createOrder"));
    expect(calls.indexOf("journal:pay")).toBeLessThan(calls.indexOf("signAndSubmit:transfer"));
    const transitions = test.journal.record.mock.calls
      .map(([entry]) => entry.to_phase)
      .filter((phase) => phase !== null);
    expect(transitions).toEqual([
      "claiming", "claimed", "spec_fetched", "creating", "cr_created", "paying",
      "paid_submitted", "delivered", "proof_uploaded", "proof_submitted",
    ]);
  });

  it("blocks purchase and releases the claim if the pre-create journal write fails", async () => {
    const test = fixture();
    test.journal.record.mockImplementation((entry) => {
      if (entry.stage === "create" && entry.to_phase === null) throw new Error("disk full");
    });

    await expect(processOrder(order, test.clients)).rejects.toSatisfy((error: unknown) =>
      describeCycleError(error) === "Shopper cycle failed stage=journal kind=Error http=-");

    expect(test.cryptorefills.createOrder).not.toHaveBeenCalled();
    expect(test.intents).toContain("release_claim");
    expect(test.intents).not.toContain("transfer");
  });

  it("blocks payment when the pre-pay journal write fails", async () => {
    const test = fixture();
    test.journal.record.mockImplementation((entry) => {
      if (entry.stage === "pay" && entry.to_phase === null) throw new Error("disk full");
    });

    await expect(processOrder(order, test.clients)).rejects.toSatisfy((error: unknown) =>
      describeCycleError(error) === "Shopper cycle failed stage=journal kind=Error http=-");

    expect(test.intents).toContain("claim");
    expect(test.intents).not.toContain("transfer");
    expect(test.store.get(order.id)?.phase).toBe("paying");
    const restarted = new StateStore(test.path, test.lock);
    await processOrder(order, { ...test.clients, store: restarted });
    expect(restarted.get(order.id)?.phase).toBe("uncertain");
    expect(test.intents).not.toContain("transfer");
  });

  it("marks a timed-out transfer uncertain and never retries the pay", async () => {
    const test = fixture();
    test.api.signAndSubmit.mockImplementation(async (input) => {
      if (input.kind === "transfer") throw new TimeoutError();
      return { tx_hash: "synthetic-tx" };
    });

    await expect(processOrder(order, test.clients)).rejects.toSatisfy((error: unknown) =>
      describeCycleError(error) === "Shopper cycle failed stage=pay kind=Timeout http=-");
    expect(test.store.get(order.id)?.phase).toBe("uncertain");
    expect(test.alerter.alert).toHaveBeenCalledWith({
      order_id: order.id, phase: "uncertain", stage: "pay", code: "Timeout",
    });
    expect(test.api.signAndSubmit.mock.calls.filter(([input]) => input.kind === "transfer"))
      .toHaveLength(1);

    test.api.request.mockResolvedValue({ orders: [] } as never);
    await runOnce(test.clients);
    expect(test.api.signAndSubmit.mock.calls.filter(([input]) => input.kind === "transfer"))
      .toHaveLength(1);
  });

  it("retries a timed-out 1Click notification without repeating the transfer", async () => {
    const test = fixture();
    test.oneClick.submit.mockRejectedValueOnce(new TimeoutError());

    await expect(processOrder(order, test.clients)).rejects.toSatisfy((error: unknown) =>
      describeCycleError(error) === "Shopper cycle failed stage=pay kind=Timeout http=-");
    expect(test.store.get(order.id)?.phase).toBe("paid_submitted");
    expect(test.alerter.alert).not.toHaveBeenCalled();
    expect(test.oneClick.submit).toHaveBeenCalledTimes(1);

    test.api.request.mockResolvedValue({ orders: [] } as never);
    test.oneClick.status.mockReset().mockResolvedValue("PENDING");
    test.oneClick.submit.mockRejectedValueOnce(new Error("notification still unavailable"));
    await expect(runOnce(test.clients)).rejects.toSatisfy((error: unknown) =>
      describeCycleError(error) === "Shopper cycle failed stage=pay kind=Error http=-");
    expect(test.oneClick.submit).toHaveBeenCalledTimes(2);
    expect(test.store.get(order.id)?.phase).toBe("paid_submitted");
    expect(test.api.signAndSubmit.mock.calls.filter(([input]) => input.kind === "transfer"))
      .toHaveLength(1);
  });

  it("keeps the payment hash when the paid_submitted journal entry fails", async () => {
    const test = fixture();
    test.journal.record.mockImplementation((entry) => {
      if (entry.to_phase === "paid_submitted") throw new Error("disk full");
    });

    await expect(processOrder(order, test.clients)).rejects.toSatisfy((error: unknown) =>
      describeCycleError(error) === "Shopper cycle failed stage=journal kind=Error http=-");

    const restarted = new StateStore(test.path, test.lock);
    expect(restarted.get(order.id)).toMatchObject({
      phase: "paid_submitted", tx_hash: "synthetic-tx", cr_order_token: token,
    });
    expect(test.intents).toContain("transfer");
  });

  it("keeps the Cryptorefills token when the cr_created journal entry fails", async () => {
    const test = fixture();
    test.journal.record.mockImplementation((entry) => {
      if (entry.to_phase === "cr_created") throw new Error("disk full");
    });

    await expect(processOrder(order, test.clients)).rejects.toSatisfy((error: unknown) =>
      describeCycleError(error) === "Shopper cycle failed stage=journal kind=Error http=-");

    const restarted = new StateStore(test.path, test.lock);
    expect(restarted.get(order.id)).toMatchObject({
      phase: "cr_created", cr_order_id: "cr-1", cr_order_token: token,
    });
    expect(test.cryptorefills.createOrder).toHaveBeenCalledTimes(1);
    expect(test.intents).not.toContain("transfer");
  });

  it("keeps an observed balance after a post-debit journal failure", async () => {
    const test = fixture();
    test.store.set(order.id, {
      phase: "paid_submitted", paid_at: 1_800_000_000_000,
      balance_before_payment: "2000000", amount_in: "900000",
      deposit_address: "deposit-1", tx_hash: "synthetic-tx",
      cr_order_id: "cr-1", cr_order_token: token, spec,
    });
    test.journal.record.mockImplementation((entry) => {
      if (entry.stage === "balance" && entry.to_phase === null) throw new Error("disk full");
    });

    await expect(processOrder(order, test.clients)).rejects.toSatisfy((error: unknown) =>
      describeCycleError(error) === "Shopper cycle failed stage=journal kind=Error http=-");

    expect(new StateStore(test.path).get(order.id)?.balance_after_payment).toBe("1000000");
  });

  it("does not create another merchant order when restarting from creating", async () => {
    const test = fixture();
    test.store.set(order.id, { phase: "creating", spec, beneficiary: "+84900000001" });
    const restarted = new StateStore(test.path, test.lock);

    await processOrder(order, { ...test.clients, store: restarted });

    expect(test.cryptorefills.createOrder).not.toHaveBeenCalled();
    expect(restarted.get(order.id)?.phase).toBe("released");
  });

  it("releases before payment when a transfer would cross the reserve", async () => {
    const test = fixture();
    test.clients.reserveUsdc = 200_000n;

    await processOrder(order, test.clients);

    expect(test.store.get(order.id)?.phase).toBe("released");
    expect(test.intents).toContain("release_claim");
    expect(test.intents).not.toContain("transfer");
    expect(test.journal.record).toHaveBeenCalledWith(expect.objectContaining({
      stage: "balance", error_code: "reserve_floor",
      state: expect.objectContaining({
        amount_in: "900000", balance_before_payment: "1000000",
      }),
    }));
  });

  it("alerts once on a failed phase transition with a safe code", () => {
    const test = fixture();
    recordState(test.clients, order.id, { phase: "failed" }, "proof", "HttpError_503");
    recordState(test.clients, order.id, { phase: "failed" }, "proof", "HttpError_503");

    expect(test.alerter.alert).toHaveBeenCalledExactlyOnceWith({
      order_id: order.id, phase: "failed", stage: "proof", code: "HttpError_503",
    });
  });

  it("labels a failed order poll with its typed HTTP status", async () => {
    const test = fixture();
    test.api.request.mockRejectedValueOnce(new HttpError(503));

    await expect(runOnce(test.clients)).rejects.toSatisfy((error: unknown) =>
      describeCycleError(error) === "Shopper cycle failed stage=poll kind=HttpError http=503");
  });

  it("labels a failed claim without exposing the upstream message", async () => {
    const test = fixture();
    test.api.signAndSubmit.mockRejectedValueOnce(new Error(`secret ${token}`));

    await expect(processOrder(order, test.clients)).rejects.toSatisfy((error: unknown) =>
      describeCycleError(error) === "Shopper cycle failed stage=claim kind=Error http=-");
  });

  it("uses the escrow view when the Fulfil API lies about hash and owner", async () => {
    const test = fixture();
    test.api.request.mockImplementation(async (_method, path) => {
      if (path.includes("/spec")) {
        return { spec, beneficiary: "+84900000001", buyer_email: "buyer@example.com" } as never;
      }
      if (path === "/proofs") {
        return { sha256: "a".repeat(64), payload: { payload_to_sign: {
          message: "proof", nonce: "", recipient: "intents.near",
        } } } as never;
      }
      return { order: { status: "funded", fulfiller: "attacker.test",
        spec_hash: "0".repeat(64) } } as never;
    });

    await processOrder(order, test.clients);

    expect(test.store.get(order.id)?.phase).toBe("proof_submitted");
    expect(test.cryptorefills.createOrder).toHaveBeenCalledTimes(1);
    expect(test.escrow.getOrder).toHaveBeenCalledWith(order.id);
  });

  it("rejects the chain hash even when the Fulfil API reports the expected hash", async () => {
    const test = fixture();
    test.escrow.getOrder.mockImplementation(async () => ({
      ...order,
      spec_hash: "0".repeat(64),
      status: test.store.get(order.id) ? "claimed" : "funded",
      fulfiller: test.store.get(order.id) ? "shopper.test" : null,
    }));

    await processOrder(order, test.clients);

    expect(test.store.get(order.id)?.phase).toBe("released");
    expect(test.cryptorefills.createOrder).not.toHaveBeenCalled();
    expect(test.intents).not.toContain("transfer");
  });

  it("does not act on an API claim when the chain has another fulfiller", async () => {
    const test = fixture();
    test.store.set(order.id, { phase: "claimed" });
    test.escrow.getOrder.mockImplementation(async () => ({
      ...order,
      spec_hash: specHash(spec),
      status: "claimed",
      fulfiller: "other.test",
    }));

    await processOrder(order, test.clients);

    expect(test.store.get(order.id)?.phase).toBe("uncertain");
    expect(test.cryptorefills.createOrder).not.toHaveBeenCalled();
    expect(test.intents).not.toContain("release_claim");
  });

  it("uses chain fields when choosing an API-listed funded order", async () => {
    const test = fixture();
    test.api.request.mockImplementation(async (_method, path) => {
      if (path.startsWith("/orders?")) {
        return { orders: [{ id: order.id, kind: "bank_transfer", status: "paid",
          pay_amount: "999999999", quoted_by: "attacker.test", created_at: "0" }] } as never;
      }
      if (path.includes("/spec")) {
        return { spec, beneficiary: "+84900000001", buyer_email: "buyer@example.com" } as never;
      }
      return { sha256: "a".repeat(64), payload: { payload_to_sign: {
        message: "proof", nonce: "", recipient: "intents.near",
      } } } as never;
    });

    await runOnce(test.clients);

    expect(test.intents).toContain("claim");
    expect(test.store.get(order.id)?.phase).toBe("proof_submitted");
  });

  it("ignores an API-listed funded order when the chain says it is paid", async () => {
    const test = fixture();
    test.api.request.mockResolvedValue({ orders: [order] } as never);
    test.escrow.getOrder.mockResolvedValue({ ...order, spec_hash: specHash(spec),
      status: "paid", fulfiller: "other.test" });

    await runOnce(test.clients);

    expect(test.intents).toEqual([]);
    expect(test.store.get(order.id)).toBeUndefined();
  });

  it("reconciles an uploaded proof from chain status instead of API status", async () => {
    const test = fixture();
    test.store.set(order.id, {
      phase: "proof_uploaded",
      spec,
      proof_sha256: "a".repeat(64),
    });
    test.escrow.getOrder.mockResolvedValue({ ...order,
      status: "paid", fulfiller: "shopper.test" });
    test.api.request.mockResolvedValue({ order: { status: "claimed",
      fulfiller: "shopper.test" } } as never);

    await processOrder(order, test.clients);

    expect(test.store.get(order.id)?.phase).toBe("proof_submitted");
    expect(test.intents).toEqual([]);
  });
  it("completes a top-up and stores tokens in a private file", async () => {
    const test = fixture();
    await processOrder(order, test.clients);
    expect(test.store.get(order.id)?.phase).toBe("proof_submitted");
    expect(test.intents).toEqual(["claim", "transfer", "sent"]);
    expect(test.cryptorefills.createOrder).toHaveBeenCalledTimes(1);
    expect(test.oneClick.submit).toHaveBeenCalledWith("synthetic-tx", "deposit-1");
    expect(statSync(test.path).mode & 0o777).toBe(0o600);
    expect(readFileSync(test.path, "utf8")).toContain(token);
  });
  it("releases on Cryptorefills failure without logging the token", async () => {
    const test = fixture();
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    test.cryptorefills.createOrder.mockRejectedValueOnce(new Error(token));
    await processOrder(order, test.clients);
    expect(test.store.get(order.id)?.phase).toBe("released");
    expect(test.intents).toContain("release_claim");
    expect(JSON.stringify(log.mock.calls)).not.toContain(token);
  });
  it.each(["REFUNDED", "FAILED"])("does not mark sent after a %s swap", async (status) => {
    const test = fixture();
    test.oneClick.status.mockReset().mockResolvedValue(status);
    test.clients.readBalance = vi.fn().mockResolvedValueOnce(1_000_000n)
      .mockResolvedValueOnce(100_000n).mockResolvedValueOnce(1_000_000n);
    await processOrder(order, test.clients);
    expect(test.store.get(order.id)?.phase).toBe("released");
    expect(test.intents).toContain("release_claim");
    expect(test.api.signAndSubmit.mock.calls.filter(([input]) => input.op === "sent"))
      .toHaveLength(0);
  });
  it("does not release a refunded transfer until the balance is restored", async () => {
    const test = fixture();
    test.oneClick.status.mockReset().mockResolvedValue("REFUNDED");
    test.clients.readBalance = vi.fn().mockResolvedValueOnce(1_000_000n)
      .mockResolvedValueOnce(100_000n).mockResolvedValueOnce(100_000n);
    await processOrder(order, test.clients);
    expect(test.store.get(order.id)?.phase).toBe("paid_submitted");
    expect(test.intents).not.toContain("release_claim");
    test.clients.readBalance = vi.fn(async () => 1_000_000n);
    await processOrder(order, test.clients);
    expect(test.store.get(order.id)?.phase).toBe("released");
    expect(test.intents).toContain("release_claim");
  });
  it("does not mistake an undebited balance for a refund", async () => {
    const test = fixture();
    test.oneClick.status.mockReset().mockResolvedValue("REFUNDED");
    await processOrder(order, test.clients);
    expect(test.store.get(order.id)?.phase).toBe("paid_submitted");
    expect(test.intents).not.toContain("release_claim");
  });

  it("resumes a paid order despite an old claim timestamp", async () => {
    const test = fixture();
    test.store.set(order.id, {
      phase: "paid_submitted", started_at: 1, paid_at: 1_800_000_000_000,
      balance_before_payment: "1000000", deposit_address: "deposit-1",
      tx_hash: "synthetic-tx", cr_order_id: "cr-1", cr_order_token: token,
      spec, beneficiary: "+84900000001",
    });
    test.oneClick.status.mockReset().mockResolvedValue("SUCCESS");
    const restarted = new StateStore(test.path, test.lock);
    await processOrder(order, { ...test.clients, store: restarted });
    expect(restarted.get(order.id)?.phase).toBe("proof_submitted");
    expect(test.intents).not.toContain("release_claim");
  });

  it("marks a post-payment swap timeout uncertain and alerts with the id only", async () => {
    const test = fixture();
    test.store.set(order.id, {
      phase: "paid_submitted", started_at: 1, paid_at: 1_800_000_000_000 - 20 * 60_000,
      balance_before_payment: "1000000", deposit_address: "deposit-1",
      tx_hash: "synthetic-tx", cr_order_id: "cr-1", cr_order_token: token,
    });
    test.oneClick.status.mockReset().mockResolvedValue("PENDING");
    await processOrder(order, test.clients);
    expect(test.store.get(order.id)?.phase).toBe("uncertain");
    expect(test.intents).not.toContain("release_claim");
    expect(test.api.signAndSubmit.mock.calls.filter(([input]) => input.op === "sent"))
      .toHaveLength(0);
    expect(test.alerter.alert).toHaveBeenCalledWith({
      order_id: order.id, phase: "uncertain", stage: "poll", code: "swap_timeout",
    });
  });

  it("marks an expired paid order uncertain when 1Click status cannot be read", async () => {
    const test = fixture();
    test.store.set(order.id, {
      phase: "paid_submitted",
      paid_at: 1_800_000_000_000 - 20 * 60_000,
      deposit_address: "deposit-1",
      tx_hash: "synthetic-tx",
      cr_order_id: "cr-1",
      cr_order_token: token,
    });
    test.oneClick.status.mockReset().mockRejectedValueOnce(new HttpError(503));

    await processOrder(order, test.clients);

    expect(test.store.get(order.id)?.phase).toBe("uncertain");
    expect(test.intents).not.toContain("release_claim");
    expect(test.alerter.alert).toHaveBeenCalledWith({
      order_id: order.id, phase: "uncertain", stage: "poll", code: "HttpError_503",
    });
  });

  it("continues a successful swap when a post-payment balance read fails", async () => {
    const test = fixture();
    test.store.set(order.id, {
      phase: "paid_submitted",
      paid_at: 1_800_000_000_000,
      deposit_address: "deposit-1",
      tx_hash: "synthetic-tx",
      cr_order_id: "cr-1",
      cr_order_token: token,
      spec,
    });
    test.clients.readBalance = vi.fn(async () => {
      throw new Error("synthetic balance failure");
    });
    test.oneClick.status.mockReset().mockResolvedValue("SUCCESS");

    await processOrder(order, test.clients);

    expect(test.store.get(order.id)?.phase).toBe("proof_submitted");
    expect(test.intents).not.toContain("release_claim");
  });

  it("releases the claim and alerts when delivery fails after a successful swap", async () => {
    const test = fixture();
    test.store.set(order.id, {
      phase: "paid_submitted", paid_at: 1_800_000_000_000,
      deposit_address: "deposit-1", tx_hash: "synthetic-tx",
      cr_order_id: "cr-1", cr_order_token: token,
    });
    test.oneClick.status.mockReset().mockResolvedValue("SUCCESS");
    test.cryptorefills.getOrderStatus.mockResolvedValue({ order_state: "Failed" });
    await processOrder(order, test.clients);
    expect(test.store.get(order.id)).toMatchObject({ phase: "failed", delivery_failed: true });
    expect(test.intents).toContain("release_claim");
    expect(test.journal.record).toHaveBeenCalledWith(expect.objectContaining({
      to_phase: "failed", stage: "release", error_code: "delivery_failed",
    }));
    expect(test.alerter.alert).toHaveBeenCalledWith({
      order_id: order.id, phase: "failed", stage: "release", code: "delivery_failed",
    });
  });

  it("finishes a resumed delivery-failure release as failed", async () => {
    const test = fixture();
    test.store.set(order.id, {
      phase: "releasing", delivery_failed: true, tx_hash: "synthetic-tx",
      deposit_address: "deposit-1", amount_in: "900000",
      cr_order_id: "cr-1", cr_order_token: token,
    });
    const restarted = new StateStore(test.path, test.lock);

    await processOrder(order, { ...test.clients, store: restarted });

    expect(restarted.get(order.id)?.phase).toBe("failed");
    expect(test.intents).toContain("release_claim");
    expect(test.alerter.alert).toHaveBeenCalledWith({
      order_id: order.id, phase: "failed", stage: "release", code: "delivery_failed",
    });
  });

  it("finishes a resumed delivery failure as failed when the claim was already released", async () => {
    const test = fixture();
    test.store.set(order.id, { phase: "releasing", delivery_failed: true, tx_hash: "synthetic-tx" });
    test.escrow.getOrder.mockResolvedValue({ ...order, status: "funded", fulfiller: null });

    await processOrder(order, test.clients);

    expect(test.store.get(order.id)?.phase).toBe("failed");
    expect(test.intents).not.toContain("release_claim");
    expect(test.alerter.alert).toHaveBeenCalledWith({
      order_id: order.id, phase: "failed", stage: "release", code: "delivery_failed",
    });
  });

  it("rejects a mismatched on-chain spec hash before creating or paying", async () => {
    const test = fixture();
    test.escrow.getOrder.mockImplementation(async () => ({
      ...order,
      spec_hash: "0".repeat(64),
      status: test.store.get(order.id) ? "claimed" : "funded",
      fulfiller: test.store.get(order.id) ? "shopper.test" : null,
    }));
    await processOrder(order, test.clients);
    expect(test.store.get(order.id)?.phase).toBe("released");
    expect(test.cryptorefills.createOrder).not.toHaveBeenCalled();
    expect(test.intents).not.toContain("transfer");
    expect((test.clients.log as ReturnType<typeof vi.fn>).mock.calls).toEqual([
      [`Shopper rejected order ${order.id} before payment`],
    ]);
  });

  it("rejects a beneficiary hash mismatch before creating or paying", async () => {
    const test = fixture();
    test.api.request.mockImplementation(async (_method, path) => path.includes("/spec")
      ? { spec, beneficiary: "+84900000002", buyer_email: "buyer@example.com" } as never
      : { order: { status: "claimed", fulfiller: "shopper.test", spec_hash: specHash(spec) } } as never);
    await processOrder(order, test.clients);
    expect(test.store.get(order.id)?.phase).toBe("released");
    expect(test.cryptorefills.createOrder).not.toHaveBeenCalled();
    expect(test.intents).not.toContain("transfer");
    expect((test.clients.log as ReturnType<typeof vi.fn>).mock.calls).toEqual([
      [`Shopper rejected order ${order.id} before payment`],
    ]);
  });

  it("does not create an upstream order after a resumed claim is reassigned", async () => {
    const test = fixture();
    test.store.set(order.id, {
      phase: "spec_fetched",
      spec,
      beneficiary: "+84900000001",
      buyer_email: "buyer@example.com",
    });
    test.escrow.getOrder.mockResolvedValue({
      ...order,
      fulfiller: "other-fulfiller.test",
      spec_hash: specHash(spec),
      status: "claimed",
    });

    await processOrder(order, test.clients);

    expect(test.store.get(order.id)?.phase).toBe("uncertain");
    expect(test.cryptorefills.createOrder).not.toHaveBeenCalled();
    expect(test.intents).not.toContain("transfer");
    expect(test.intents).not.toContain("release_claim");
  });

  it("rejects a spec with fields outside the Cryptorefills v1 schema", async () => {
    const test = fixture();
    const extraFieldSpec = canonicalJson({
      ...JSON.parse(spec),
      unexpected: "value",
    });
    test.store.set(order.id, {
      phase: "spec_fetched",
      spec: extraFieldSpec,
      beneficiary: "+84900000001",
      buyer_email: "buyer@example.com",
    });
    test.api.request.mockResolvedValue({
      order: {
        fulfiller: "shopper.test",
        spec_hash: specHash(extraFieldSpec),
        status: "claimed",
      },
    } as never);

    await processOrder(order, test.clients);

    expect(test.store.get(order.id)?.phase).toBe("released");
    expect(test.cryptorefills.createOrder).not.toHaveBeenCalled();
  });

  it("resumes after creation without a duplicate purchase or payment", async () => {
    const test = fixture();
    const state: OrderState = { phase: "cr_created", started_at: 1_800_000_000_000,
      cr_created_at: 1_800_000_000_000, spec,
      beneficiary: "+84900000001", buyer_email: "buyer@example.com", cr_order_id: "cr-1",
      cr_order_token: token, wallet_address: "0x0000000000000000000000000000000000000001", coin_amount: "0.89" };
    test.store.set(order.id, state);
    const restarted = new StateStore(test.path, test.lock);
    await processOrder(order, { ...test.clients, store: restarted });
    expect(test.cryptorefills.createOrder).not.toHaveBeenCalled();
    expect(test.intents.filter((intent) => intent === "transfer")).toHaveLength(1);
    expect(restarted.get(order.id)?.phase).toBe("proof_submitted");
  });

  it("releases a stale upstream order before submitting payment after restart", async () => {
    const test = fixture();
    test.store.set(order.id, {
      phase: "cr_created",
      started_at: 1,
      cr_created_at: 1_800_000_000_000 - 20 * 60_000,
      spec,
      beneficiary: "+84900000001",
      buyer_email: "buyer@example.com",
      cr_order_id: "cr-1",
      cr_order_token: token,
      wallet_address: "0x0000000000000000000000000000000000000001",
      coin_amount: "0.89",
    });

    await processOrder(order, test.clients);

    expect(test.store.get(order.id)?.phase).toBe("released");
    expect(test.oneClick.quote).not.toHaveBeenCalled();
    expect(test.intents).toContain("release_claim");
    expect(test.intents).not.toContain("transfer");
  });

  it("releases a legacy upstream state without a creation timestamp before payment", async () => {
    const test = fixture();
    test.store.set(order.id, {
      phase: "cr_created",
      spec,
      beneficiary: "+84900000001",
      buyer_email: "buyer@example.com",
      cr_order_id: "cr-1",
      cr_order_token: token,
      wallet_address: "0x0000000000000000000000000000000000000001",
      coin_amount: "0.89",
    });

    await processOrder(order, test.clients);

    expect(test.store.get(order.id)?.phase).toBe("released");
    expect(test.oneClick.quote).not.toHaveBeenCalled();
    expect(test.intents).toContain("release_claim");
  });

  it("fails closed after a crash during payment", async () => {
    const test = fixture();
    test.store.set(order.id, { phase: "paying", deposit_address: "deposit-1", amount_in: "900000" });
    await processOrder(order, test.clients);
    expect(test.store.get(order.id)?.phase).toBe("uncertain");
    expect(test.intents).toEqual([]);
  });

  it("keeps a created order pre-payment when the final order lookup fails", async () => {
    const test = fixture();
    test.store.set(order.id, {
      phase: "cr_created", cr_created_at: startMs, spec,
      cr_order_id: "cr-1", cr_order_token: token,
      wallet_address: "0x0000000000000000000000000000000000000001",
      coin_amount: "0.89",
    });
    let lookups = 0;
    test.escrow.getOrder.mockImplementation(async () => {
      if (++lookups === 3) throw new Error("temporary RPC failure");
      return { ...order, status: "claimed", fulfiller: "shopper.test" };
    });

    await expect(processOrder(order, test.clients)).rejects.toSatisfy((error: unknown) =>
      describeCycleError(error) === "Shopper cycle failed stage=order kind=Error http=-");

    expect(test.oneClick.quote).toHaveBeenCalledTimes(1);
    expect(test.store.get(order.id)?.phase).toBe("cr_created");
    expect(test.journal.record.mock.calls.some(([entry]) => entry.to_phase === "paying"))
      .toBe(false);
    expect(test.api.signAndSubmit.mock.calls.filter(([input]) => input.kind === "transfer"))
      .toHaveLength(0);
    expect(test.alerter.alert).not.toHaveBeenCalled();
  });

  it("reconciles a release that completed before the state file was updated", async () => {
    const test = fixture();
    test.store.set(order.id, { phase: "releasing" });
    test.escrow.getOrder.mockResolvedValue({ ...order,
      spec_hash: specHash(spec), status: "funded", fulfiller: null });

    await processOrder(order, test.clients);

    expect(test.store.get(order.id)?.phase).toBe("released");
    expect(test.intents).toEqual([]);
  });

  it("does not pay after the claim has been reassigned", async () => {
    const test = fixture();
    test.store.set(order.id, {
      phase: "cr_created",
      started_at: 1_800_000_000_000,
      cr_created_at: 1_800_000_000_000,
      spec,
      beneficiary: "+84900000001",
      buyer_email: "buyer@example.com",
      cr_order_id: "cr-1",
      cr_order_token: token,
      wallet_address: "0x0000000000000000000000000000000000000001",
      coin_amount: "0.89",
    });
    test.escrow.getOrder.mockResolvedValue({ ...order,
      spec_hash: specHash(spec), status: "funded", fulfiller: null });

    await processOrder(order, test.clients);

    expect(test.store.get(order.id)?.phase).toBe("uncertain");
    expect(test.oneClick.quote).not.toHaveBeenCalled();
    expect(test.intents).toEqual([]);
  });

  it("sends flexible products to Cryptorefills with denomination range", async () => {
    const test = fixture();
    const rangeSpec = canonicalJson(cryptorefillsSpec({
      brand_name: "Synthetic Flexible Mobile", country: "VN", product_value: "30000",
      delivery_type: "by_phone", beneficiary: "+84900000001", salt,
    }));
    test.escrow.getOrder.mockResolvedValue({ ...order, status: "claimed",
      fulfiller: "shopper.test", spec_hash: specHash(rangeSpec) });
    test.store.set(order.id, {
      phase: "spec_fetched",
      started_at: 1_800_000_000_000,
      spec: rangeSpec,
      beneficiary: "+84900000001",
      buyer_email: "buyer@example.com",
    });

    await processOrder(order, test.clients);

    expect(test.cryptorefills.validateOrder).toHaveBeenCalledWith({
      brand_name: "Synthetic Flexible Mobile",
      country_code: "VN",
      beneficiary_account: "+84900000001",
      denomination: "range",
      product_value: "30000",
    });
    expect(test.cryptorefills.createOrder).toHaveBeenCalledWith(
      "buyer@example.com",
      expect.objectContaining({ denomination: "range", product_value: "30000" }),
    );
  });
});
