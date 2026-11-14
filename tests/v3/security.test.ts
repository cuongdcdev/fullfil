import { beforeEach, describe, expect, it, vi } from "vitest";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

vi.hoisted(() => {
  process.env.DATABASE_URL = `file:/tmp/fulfil-v3-security-${process.pid}.db`;
  process.env.FULFIL_MODE = "mock";
});

import { get, put } from "../../apps/web/lib/server/db";
import { createChallenge, verifyLogin, type Session } from "../../apps/web/lib/server/v3/auth";
import { LiveEscrow, MockEscrow } from "../../apps/web/lib/server/v3/escrow";
import { buildPayload, intentFromInput, validateSignedPayload } from "../../apps/web/lib/server/v3/intents";
import { allowRelayerSubmission, allowRequest, resetRateLimits } from "../../apps/web/lib/server/v3/rate-limit";
import { assertPreparedFunding, orderDetail, orderListItem, prepareOrder, resolveDispute, submitIntents } from "../../apps/web/lib/server/v3/service";
import { POST } from "../../apps/web/lib/server/v3/handler";
import { bankTransferSpec, canonicalJson, samplePhoQr, specHash } from "../../packages/core/src/index";

let serial = 0;
const session = (account_id: string): Session => ({ account_id, standard: "erc191", exp: Date.now() + 60_000 });
const id = () => `FUL-${Date.now().toString(36).toUpperCase()}-${++serial}`;
const hour = BigInt("3600000000000");
const hash = "a".repeat(64);
const bankSpec = canonicalJson(bankTransferSpec(50_000, hash));
const bankHash = specHash(bankSpec);
function bankOrder(orderId: string, deadlineNs: string) {
  put(`v3:spec:${orderId}`, "v3:spec", { spec: bankSpec });
  return { id: orderId, kind: "bank_transfer", spec_hash: bankHash,
    pay_amount: "2000000", reward: "100000", deadline_ns: deadlineNs };
}

beforeEach(() => {
  process.env.FULFIL_MODE = "mock";
  delete process.env.ARBITER_ENABLED;
  delete process.env.ARBITER_OUTLAYER_API_KEY;
  delete process.env.RATE_LIMIT_AUTH_PER_MINUTE;
  delete process.env.RELAYER_MAX_PER_ACCOUNT_PER_HOUR;
  resetRateLimits();
  vi.restoreAllMocks();
});

describe("funding and merchant binding", () => {
  it("requires the exact prepared order and its buyer for every fund intent", async () => {
    const buyer = session(`buyer-${++serial}.test`);
    const other = session(`other-${serial}.test`);
    const prepared = await prepareOrder(buyer, { qr_payload: samplePhoQr(), reward_usdc: "1" });
    const valid = intentFromInput({ kind: "fund", order: prepared.order });
    expect(() => assertPreparedFunding(buyer, [valid])).not.toThrow();
    expect(() => assertPreparedFunding(other, [valid])).toThrow(/prepared/);
    for (const field of ["id", "kind", "spec_hash", "pay_amount", "reward", "deadline_ns"] as const) {
      const changed = { ...prepared.order, [field]: field === "id" ? id() : field === "kind" ? "cryptorefills_topup" : field === "spec_hash" ? "b".repeat(64) : "999999" };
      expect(() => assertPreparedFunding(buyer, [intentFromInput({ kind: "fund", order: changed })])).toThrow(/prepared/);
    }
    await expect(submitIntents(other, { standard: "erc191" }, [valid])).rejects.toThrow(/prepared/);
  });

  it("hides an unverified merchant account and name from detail and list", async () => {
    const buyer = session(`buyer-${++serial}.test`);
    const prepared = await prepareOrder(buyer, { qr_payload: samplePhoQr(), reward_usdc: "1" });
    const escrow = new MockEscrow();
    await escrow.seed(buyer.account_id);
    await escrow.apply(buyer.account_id, [intentFromInput({ kind: "fund", order: prepared.order })]);
    const order = (await escrow.order(prepared.order.id))!;
    expect((await orderDetail(order.id, buyer.account_id))?.merchant?.account).toBe("0987654321");
    put(`v3:merchant:${order.id}`, "v3:merchant", { ...get(`v3:merchant:${order.id}`) as object, account: "9999999999" });
    expect((await orderDetail(order.id, buyer.account_id))?.merchant).toBeNull();
    expect((await orderDetail(order.id, buyer.account_id))?.order.merchant_mismatch).toBe(true);
    expect(orderListItem(order)).toMatchObject({ merchant_mismatch: true, merchant_name: null });
  });

  it("keeps an order list available when a retained spec record is malformed", async () => {
    const buyer = session(`buyer-${++serial}.test`);
    const prepared = await prepareOrder(buyer, { qr_payload: samplePhoQr(), reward_usdc: "1" });
    const escrow = new MockEscrow();
    await escrow.seed(buyer.account_id);
    await escrow.apply(buyer.account_id, [intentFromInput({ kind: "fund", order: prepared.order })]);
    const order = (await escrow.order(prepared.order.id))!;
    put(`v3:spec:${order.id}`, "v3:spec", { spec: "{not json" });

    expect(orderListItem(order).spec_summary).toMatchObject({
      currency: "VND",
      denomination: String(prepared.merchant.amount_vnd),
    });
  });
});

describe("authentication and spend controls", () => {
  it("binds a SIWE-style ERC-191 challenge to PUBLIC_BASE_URL and prunes expired challenges", async () => {
    process.env.PUBLIC_BASE_URL = "https://fulfil.example.invalid";
    const wallet = privateKeyToAccount(generatePrivateKey());
    const challenge = createChallenge();
    expect(challenge.message).toContain("fulfil.example.invalid wants you to sign in");
    expect(challenge.message).toContain("Issued At:");
    expect(challenge.message).toContain(`Nonce: ${challenge.nonce}`);
    process.env.PUBLIC_BASE_URL = "https://other.example.invalid";
    await expect(verifyLogin({ standard: "erc191", address: wallet.address,
      signature: await wallet.signMessage({ message: challenge.message }), message: challenge.message })).rejects.toThrow(/domain/);
    delete process.env.PUBLIC_BASE_URL;
  });

  it("atomically reserves an issued nonce across concurrent signed submits", async () => {
    const wallet = privateKeyToAccount(generatePrivateKey());
    const user = session(wallet.address.toLowerCase());
    const built = await buildPayload(user, [intentFromInput({ kind: "bond", amount: "1" })]);
    const payload = built.payload_to_sign as string;
    const signed = { standard: "erc191", payload, signature: await wallet.signMessage({ message: payload }) };
    const results = await Promise.allSettled([validateSignedPayload(user, signed), validateSignedPayload(user, signed)]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
  });

  it("limits by IP and account and returns the API error shape", async () => {
    process.env.RATE_LIMIT_AUTH_PER_MINUTE = "1";
    const request = new Request("http://localhost/api/v3/auth/challenge", { method: "POST", headers: { "x-real-ip": "192.0.2.10" } });
    const context = { params: Promise.resolve({ path: ["auth", "challenge"] }) };
    expect((await POST(request, context)).status).toBe(200);
    const limited = await POST(request, context);
    expect(limited.status).toBe(429);
    expect(await limited.json()).toEqual({ error: { code: "rate_limited", message: "Too many requests" } });
    resetRateLimits();
    expect(allowRequest(request, "auth", "alice")).toBe(true);
    expect(allowRequest(new Request(request.url, { headers: { "x-real-ip": "192.0.2.11" } }), "auth", "alice")).toBe(false);
    process.env.RELAYER_MAX_PER_ACCOUNT_PER_HOUR = "1";
    expect(allowRelayerSubmission("alice")).toBe(true);
    expect(allowRelayerSubmission("alice")).toBe(false);
  });

  it("blocks relaying when simulate_intents fails", async () => {
    process.env.FULFIL_MODE = "live";
    process.env.OUTLAYER_API_KEY = "synthetic-relayer";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ result: { result: [...Buffer.from(JSON.stringify({ status: "failed" }))] } })));
    await expect(submitIntents(session("alice"), { standard: "erc191" }, [intentFromInput({ kind: "bond", amount: "1" })])).rejects.toThrow(/simulation/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    delete process.env.OUTLAYER_API_KEY;
  });
});

describe("escrow and arbiter alignment", () => {
  it("deletes cancelled and expired orders from the contract view but retains a final API record", async () => {
    let now = BigInt("1800000000000000000");
    const buyer = `buyer-${++serial}.test`;
    const mock = new MockEscrow({}, () => now);
    await mock.credit(buyer, "10000000");
    const fund = (orderId: string) => intentFromInput({ kind: "fund", order: bankOrder(orderId, String(now + hour)) });
    const first = id();
    await mock.apply(buyer, [fund(first)]);
    await mock.apply(buyer, [intentFromInput({ kind: "auth_call", op: "cancel", order_id: first })]);
    expect(await mock.get_order(first)).toBeNull();
    expect((await mock.order(first))?.status).toBe("cancelled");
    const second = id();
    await mock.apply(buyer, [fund(second)]);
    now += hour;
    await mock.expire(second);
    expect(await mock.get_order(second)).toBeNull();
    expect((await mock.order(second))?.status).toBe("expired");
  });

  it("serves a final cancellation from a submitted-fund record when get_order is null", async () => {
    process.env.FULFIL_MODE = "live";
    const orderId = id();
    put(`v3:submitted:${orderId}`, "v3:submitted", {
      account_id: "buyer.test",
      order: {
        id: orderId,
        kind: "bank_transfer",
        spec_hash: bankHash,
        pay_amount: "2000000",
        reward: "100000",
        deadline_ns: String(BigInt(Date.now() + 60_000) * BigInt(1_000_000)),
      },
      submitted_at_ns: String(BigInt(Date.now()) * BigInt(1_000_000)),
    });
    put(`v3:cancel_submitted:${orderId}`, "v3:cancel_submitted", true);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      result: { result: [...Buffer.from("null")] },
    })));
    const order = await new LiveEscrow().order(orderId);
    expect(order).toMatchObject({ id: orderId, buyer: "buyer.test", status: "cancelled" });
  });

  it("includes a submitted terminal order in a list without a prior detail request", async () => {
    process.env.FULFIL_MODE = "live";
    const orderId = id();
    put(`v3:submitted:${orderId}`, "v3:submitted", {
      account_id: "list-buyer.test",
      order: {
        id: orderId,
        kind: "bank_transfer",
        spec_hash: bankHash,
        pay_amount: "2000000",
        reward: "100000",
        deadline_ns: String(BigInt(Date.now() + 60_000) * BigInt(1_000_000)),
      },
      submitted_at_ns: String(BigInt(Date.now()) * BigInt(1_000_000)),
    });
    put(`v3:cancel_submitted:${orderId}`, "v3:cancel_submitted", true);
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({
        result: { result: [...Buffer.from("[]")] },
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        result: { result: [...Buffer.from("null")] },
      })));
    const orders = await new LiveEscrow().orders(undefined, "list-buyer.test");
    expect(orders).toContainEqual(expect.objectContaining({
      id: orderId,
      status: "cancelled",
    }));
  });

  it("requires approval, accepts proof from Claimed, and checks worker echoes", async () => {
    const now = BigInt("1800000000000000000");
    const buyer = `buyer-${++serial}.test`;
    const fulfiller = `ful-${serial}.test`;
    const mock = new MockEscrow({}, () => now);
    await mock.credit(buyer, "10000000");
    await mock.apply(fulfiller, [intentFromInput({ kind: "auth_call", op: "register_fulfiller", bank_bin: "970436", account_last4: "1234" })]);
    expect((await mock.profile(fulfiller)).approved).toBe(true);
    mock.approve_fulfiller(fulfiller, false);
    await mock.apply(fulfiller, [intentFromInput({
      kind: "auth_call", op: "register_fulfiller", bank_bin: "970436", account_last4: "1234",
    })]);
    expect((await mock.profile(fulfiller)).approved).toBe(false);
    const orderId = id();
    await mock.apply(buyer, [intentFromInput({ kind: "fund", order: bankOrder(orderId, String(now + hour)) })]);
    const claim = intentFromInput({ kind: "auth_call", op: "claim", order_id: orderId });
    await expect(mock.apply(fulfiller, [claim])).rejects.toThrow(/approved/);
    mock.approve_fulfiller(fulfiller, true);
    await mock.apply(fulfiller, [claim]);
    mock.setNextVerification(orderId, { ok: true, order_id: "FUL-WRONG", proof_sha256: hash });
    await mock.apply(fulfiller, [intentFromInput({ kind: "auth_call", op: "submit_proof", order_id: orderId, proof_sha256: hash })]);
    expect((await mock.order(orderId))?.last_reject_reason).toBe("order id mismatch");
  });

  it("returns a dry-run proposal without dedicated arbiter credentials", async () => {
    const now = BigInt("1800000000000000000");
    const buyer = `buyer-${++serial}.test`;
    const fulfiller = `ful-${serial}.test`;
    const mock = new MockEscrow({}, () => now);
    await mock.credit(buyer, "10000000");
    await mock.apply(fulfiller, [intentFromInput({ kind: "auth_call", op: "register_fulfiller", bank_bin: "970436", account_last4: "1234" })]);
    const orderId = id();
    await mock.apply(buyer, [intentFromInput({ kind: "fund", order: bankOrder(orderId, String(now + hour)) })]);
    await mock.apply(fulfiller, [intentFromInput({ kind: "auth_call", op: "claim", order_id: orderId })]);
    await mock.apply(fulfiller, [intentFromInput({ kind: "auth_call", op: "sent", order_id: orderId })]);
    for (let attempt = 0; attempt < 3; attempt++) {
      mock.setNextVerification(orderId, { ok: false, reason: "synthetic rejection" });
      await mock.apply(fulfiller, [intentFromInput({ kind: "auth_call", op: "submit_proof", order_id: orderId, proof_sha256: hash })]);
    }
    process.env.ARBITER_ENABLED = "1";
    const proposal = await resolveDispute(orderId, "synthetic statement");
    expect(proposal).toMatchObject({ dry_run: true, proposed_verdict: { verdict: proposal.verdict } });
    expect((await mock.order(orderId))?.status).toBe("under_review");
  });
});
