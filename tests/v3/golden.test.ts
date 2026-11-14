import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { bankTransferSpec, canonicalJson, samplePhoQr, specHash } from "../../packages/core/src/index";

vi.hoisted(() => {
  process.env.DATABASE_URL = `file:/tmp/fulfil-v3-golden-${process.pid}-${Date.now()}.db`;
  process.env.FULFIL_MODE = "mock";
});

import { intentFromInput } from "../../apps/web/lib/server/v3/intents";
import { cookieHeader } from "../../apps/web/lib/server/v3/auth";
import { LiveEscrow, MockEscrow } from "../../apps/web/lib/server/v3/escrow";
import { GET as getV3 } from "../../apps/web/lib/server/v3/handler";
import { USDC_TOKEN } from "../../apps/web/lib/server/v3/config";
import { get, put } from "../../apps/web/lib/server/db";
import {
  callRelayer,
  prepareOrder,
  submitIntents,
  submitRelayerProof,
} from "../../apps/web/lib/server/v3/service";

const MH = "1111111111111111111111111111111111111111111111111111111111111111";
const PROOF = "2222222222222222222222222222222222222222222222222222222222222222";
const TXREF = "3333333333333333333333333333333333333333333333333333333333333333";
let sequence = 0;
const runTag = Math.random().toString(36).slice(2, 6).toUpperCase();
const nextId = () => `FUL-${runTag}${String(++sequence).padStart(4, "0")}`;
const proofFor = (id: string) => createHash("sha256").update(id).digest("hex");
const bankSpec = canonicalJson(bankTransferSpec(50000, MH));
const bankHash = specHash(bankSpec);
const auth = (op: string, fields: Record<string, unknown> = {}) => {
  if (op === "submit_proof" && !get(`v3:spec:${fields.order_id}`)) {
    put(`v3:spec:${fields.order_id}`, "v3:spec", { spec: bankSpec });
  }
  return intentFromInput({ kind: "auth_call", op, ...fields });
};
const fund = (id: string, deadline: bigint, pay = "2000000", reward = "100000") => {
  put(`v3:spec:${id}`, "v3:spec", { spec: bankSpec });
  return intentFromInput({
    kind: "fund",
    order: {
      id,
      kind: "bank_transfer",
      spec_hash: bankHash,
      pay_amount: pay,
      reward,
      deadline_ns: String(deadline),
    },
  });
};

describe("contract message goldens", () => {
  it("matches every flat transfer and auth msg, including key order and gas", () => {
    put("v3:spec:FUL-0001", "v3:spec", { spec: bankSpec });
    const cases: Array<[Record<string, unknown>, string, string]> = [
      [
        {
          kind: "fund",
          order: {
            id: "FUL-0001",
            kind: "bank_transfer",
            spec_hash: bankHash,
            pay_amount: "2000000",
            reward: "100000",
            deadline_ns: "1800086400000000000",
          },
        },
        JSON.stringify({ op: "fund", order: { id: "FUL-0001", kind: "bank_transfer", spec_hash: bankHash,
          pay_amount: "2000000", reward: "100000", deadline_ns: "1800086400000000000" } }),
        "",
      ],
      [{ kind: "bond", amount: "100" }, '{"op":"bond"}', ""],
      [
        { kind: "auth_call", op: "register_fulfiller", bank_bin: "970436", account_last4: "1234" },
        '{"op":"register_fulfiller","bank_bin":"970436","account_last4":"1234"}',
        "20000000000000",
      ],
      [
        { kind: "auth_call", op: "claim", order_id: "FUL-0001" },
        '{"op":"claim","order_id":"FUL-0001"}',
        "20000000000000",
      ],
      [
        { kind: "auth_call", op: "sent", order_id: "FUL-0001" },
        '{"op":"sent","order_id":"FUL-0001"}',
        "20000000000000",
      ],
      [
        { kind: "auth_call", op: "submit_proof", order_id: "FUL-0001", proof_sha256: PROOF },
        JSON.stringify({ op: "submit_proof", order_id: "FUL-0001", proof_sha256: PROOF, spec: bankSpec }),
        "200000000000000",
      ],
      [
        { kind: "auth_call", op: "cancel", order_id: "FUL-0001" },
        '{"op":"cancel","order_id":"FUL-0001"}',
        "20000000000000",
      ],
      [
        { kind: "auth_call", op: "dispute", order_id: "FUL-0001", reason_code: 2 },
        '{"op":"dispute","order_id":"FUL-0001","reason_code":2}',
        "20000000000000",
      ],
      [
        { kind: "auth_call", op: "rate", order_id: "FUL-0001", stars: 5 },
        '{"op":"rate","order_id":"FUL-0001","stars":5}',
        "20000000000000",
      ],
      [
        { kind: "auth_call", op: "withdraw_bond", amount: "100" },
        '{"op":"withdraw_bond","amount":"100"}',
        "20000000000000",
      ],
    ];
    for (const [input, expected, gas] of cases) {
      const intent = intentFromInput(input);
      expect(intent.msg).toBe(expected);
      if (gas) {
        expect(intent.intent).toBe("auth_call");
        expect(intent.attached_deposit).toBe("0");
        expect(intent.min_gas).toBe(gas);
      } else {
        expect(intent.intent).toBe("transfer");
        expect(intent.tokens).toEqual({
          [USDC_TOKEN]: input.kind === "fund" ? "2100000" : "100",
        });
      }
    }
    expect(() => auth("dispute", { order_id: "FUL-0001", reason_code: "not_received" }))
      .toThrow("Invalid reason_code");
  });

  it("calls OutLayer with documented URL, headers, body, gas and deposit", async () => {
    process.env.FULFIL_MODE = "live";
    process.env.OUTLAYER_API_KEY = "synthetic-key";
    process.env.OUTLAYER_WALLET_ID = "unused-synthetic-id";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(JSON.stringify({ request_id: "req-1", status: "success", tx_hash: "tx-1", result: {} })),
    );
    put("v3:spec:FUL-0001", "v3:spec", { spec: bankSpec });
    const signed = { standard: "nep413", payload: { message: "synthetic" } };
    await callRelayer("intents.near", "execute_intents", { signed: [signed] });
    await submitRelayerProof("FUL-0001", PROOF);
    await callRelayer(
      "nearfullfil.near",
      "resolve_dispute",
      { order_id: "FUL-0001", verdict: "buyer", note_hash: MH },
      "100000000000000",
      "0",
      "synthetic-arbiter-key",
    );
    const expected = [
      {
        receiver_id: "intents.near",
        method_name: "execute_intents",
        args: { signed: [signed] },
        gas: "300000000000000",
        deposit: "0",
      },
      {
        receiver_id: "nearfullfil.near",
        method_name: "submit_proof",
        args: { order_id: "FUL-0001", proof_sha256: PROOF, spec: bankSpec },
        gas: "300000000000000",
        deposit: "0",
      },
      {
        receiver_id: "nearfullfil.near",
        method_name: "resolve_dispute",
        args: { order_id: "FUL-0001", verdict: "buyer", note_hash: MH },
        gas: "100000000000000",
        deposit: "0",
      },
    ];
    expect(fetchMock).toHaveBeenCalledTimes(3);
    for (const [index, call] of fetchMock.mock.calls.entries()) {
      const [url, options] = call;
      expect(url).toBe("https://api.outlayer.ai/wallet/v1/call");
      expect(options?.method).toBe("POST");
      expect(options?.headers).toEqual({
        "Content-Type": "application/json",
        Authorization: index === 2 ? "Bearer synthetic-arbiter-key" : "Bearer synthetic-key",
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
      });
      expect(JSON.parse(String(options?.body))).toEqual(expected[index]);
    }
    delete process.env.OUTLAYER_API_KEY;
    delete process.env.OUTLAYER_WALLET_ID;
  });

  it("polls processing and rejects failed requests", async () => {
    process.env.OUTLAYER_API_KEY = "synthetic-key";
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ request_id: "req-2", status: "processing" })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ request_id: "req-2", status: "success", tx_hash: "tx-2" })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "failed", result: { error: "synthetic failure" } })));
    vi.useFakeTimers();
    try {
      const result = callRelayer("intents.near", "execute_intents", { signed: [] });
      await vi.advanceTimersByTimeAsync(1000);
      expect((await result).status).toBe("success");
      expect(fetchMock.mock.calls[1][0]).toBe("https://api.outlayer.ai/wallet/v1/requests/req-2");
      await expect(callRelayer("intents.near", "execute_intents", { signed: [] }))
        .rejects.toThrow("synthetic failure");
    } finally {
      vi.useRealTimers();
      delete process.env.OUTLAYER_API_KEY;
    }
  });

  it("uses the contract's exact view method names and argument keys", async () => {
    const methods: Array<[string, Record<string, unknown>]> = [];
    const chainOrder = {
      id: "FUL-0001",
      claimed_at: "1800000000000000000",
      status: "proof_rejected",
    };
    const chainProfile = {
      account_id: "ful.test",
      profile: null,
      stats: { star_sum: 9, star_count: 2 },
      level: 1,
      bond: { available: "0", locked: "0" },
    };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, options) => {
      const query = JSON.parse(String(options?.body)) as {
        params: { method_name: string; args_base64: string; };
      };
      methods.push([
        query.params.method_name,
        JSON.parse(Buffer.from(query.params.args_base64, "base64").toString()),
      ]);
      const returned = query.params.method_name === "get_counts" ? [0, 0]
        : query.params.method_name === "list_orders" || query.params.method_name === "orders_by_account" ? [chainOrder]
          : query.params.method_name === "get_order" ? chainOrder
            : query.params.method_name === "get_profile" ? chainProfile
              : query.params.method_name === "get_owed" ? "0" : null;
      return new Response(JSON.stringify({
        result: { result: [...Buffer.from(JSON.stringify(returned))] },
      }));
    });
    const live = new LiveEscrow();
    const liveOrder = await live.order("FUL-0001");
    const listed = await live.orders("proof_rejected", undefined, 2, 7);
    const accountOrders = await live.orders(undefined, "ful.test", 3, 8);
    const profile = await live.profile("ful.test");
    await live.get_config();
    await live.is_nullifier_used(TXREF);
    await live.get_owed("ful.test", USDC_TOKEN);
    await live.get_counts();
    expect(liveOrder?.claimed_at_ns).toBe(chainOrder.claimed_at);
    expect(listed[0].claimed_at_ns).toBe(chainOrder.claimed_at);
    expect(accountOrders[0].claimed_at_ns).toBe(chainOrder.claimed_at);
    expect(profile.rating).toEqual({ star_sum: 9, star_count: 2, avg: 4.5 });
    expect(profile.level).toBe(1);
    expect(methods).toEqual([
      ["get_order", { id: "FUL-0001" }],
      ["list_orders", { status: "proof_rejected", from: 2, limit: 7 }],
      ["orders_by_account", { account_id: "ful.test", from: 3, limit: 8 }],
      ["get_profile", { account_id: "ful.test" }],
      ["get_config", {}],
      ["is_nullifier_used", { tx_ref_hash: TXREF }],
      ["get_owed", { account_id: "ful.test", token_id: USDC_TOKEN }],
      ["get_counts", {}],
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(8);
  });

  it("re-reads the order after a successful live execute_intents call", async () => {
    process.env.FULFIL_MODE = "live";
    process.env.OUTLAYER_API_KEY = "synthetic-key";
    const order = { id: "FUL-0001", status: "paid", claimed_at: "1800000000000000000" };
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({
        result: { result: [...Buffer.from(JSON.stringify({ status: "success" }))] },
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "success", tx_hash: "tx-1" })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        result: { result: [...Buffer.from(JSON.stringify(order))] },
      })));
    const result = await submitIntents(
      { account_id: "ful.test", standard: "nep413", exp: Date.now() + 60_000 },
      { standard: "nep413", payload: "synthetic" },
      [auth("sent", { order_id: "FUL-0001" })],
    );
    expect(result.order).toEqual({ ...order, kind: "bank_transfer", spec_hash: "", quoted_by: null,
      claimed_at_ns: order.claimed_at });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    delete process.env.OUTLAYER_API_KEY;
  });
});

describe("v3 FX estimate", () => {
  it("quotes principal with the configured mock rate without a session or network", async () => {
    const previousSource = process.env.FX_SOURCE;
    const previousRate = process.env.FULFIL_MOCK_VND_PER_USD;
    process.env.FULFIL_MODE = "mock";
    process.env.FX_SOURCE = "coingecko";
    process.env.FULFIL_MOCK_VND_PER_USD = "25000";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      throw new Error("FX test must not call the network");
    });
    const context = { params: Promise.resolve({ path: ["fx"] }) };
    try {
      const response = await getV3(
        new Request("http://localhost/api/v3/fx?vnd=50000"),
        context,
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        amount_vnd: 50000,
        estimated_usd: 2,
        pay_amount: "2000000",
        vnd_per_usd: 25000,
        source: "mock",
      });
      const prepared = await prepareOrder(
        { account_id: "synthetic-buyer.test", standard: "nep413", exp: Date.now() + 60_000 },
        { qr_payload: samplePhoQr(50000), amount_vnd: 50000, reward_usdc: "0" },
      );
      expect(prepared.order.pay_amount).toBe("2000000");
      for (const invalid of ["", "0", "abc", "999999999999999999999"]) {
        const bad = await getV3(
          new Request(`http://localhost/api/v3/fx?vnd=${invalid}`),
          context,
        );
        expect(bad.status).toBe(400);
      }
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      if (previousSource === undefined) delete process.env.FX_SOURCE;
      else process.env.FX_SOURCE = previousSource;
      if (previousRate === undefined) delete process.env.FULFIL_MOCK_VND_PER_USD;
      else process.env.FULFIL_MOCK_VND_PER_USD = previousRate;
      fetchMock.mockRestore();
    }
  });
});

describe("mock contract state machine", () => {
  let now: bigint;
  let mock: MockEscrow;
  let buyer: string;
  let fulfiller: string;

  beforeEach(async () => {
    process.env.FULFIL_MODE = "mock";
    now = BigInt("1800000000000000000");
    buyer = `buyer-${++sequence}.test`;
    fulfiller = `ful-${sequence}.test`;
    mock = new MockEscrow({}, () => now);
    await mock.credit(buyer, "100000000");
    await mock.credit(fulfiller, "100000000");
  });

  async function register(): Promise<void> {
    await mock.apply(fulfiller, [auth("register_fulfiller", {
      bank_bin: "970436", account_last4: "1234",
    })]);
  }
  async function sentOrder(id = nextId()): Promise<string> {
    await register();
    await mock.apply(buyer, [fund(id, now + BigInt(24) * HOUR)]);
    await mock.apply(fulfiller, [auth("claim", { order_id: id })]);
    await mock.apply(fulfiller, [auth("sent", { order_id: id })]);
    return id;
  }
  const HOUR = BigInt("3600000000000");

  it("runs the happy path and returns exact view shapes and nanosecond timestamps", async () => {
    const id = await sentOrder();
    const claimed = await mock.order(id);
    expect(claimed?.claimed_at).toBe(String(now));
    expect(claimed?.claimed_at_ns).toBe(String(now));
    expect(claimed?.status).toBe("sent");
    expect((await mock.get_order(id))?.id).toBe(id);
    expect((await mock.orders("sent", fulfiller))[0].id).toBe(id);
    expect((await mock.list_orders("sent"))[0].id).toBe(id);
    expect((await mock.orders_by_account(fulfiller))[0].id).toBe(id);
    const response = await getV3(
      new Request(`http://localhost/api/v3/orders?account=${fulfiller}&status=sent`, {
        headers: {
          cookie: cookieHeader({
            account_id: fulfiller,
            standard: "nep413",
            exp: Date.now() + 60_000,
          }),
        },
      }),
      { params: Promise.resolve({ path: ["orders"] }) },
    );
    const jobs = (await response.json()) as { orders: Array<{ code: string; claimed_at_ns: string }> };
    expect(jobs.orders[0]).toMatchObject({ code: id, claimed_at_ns: String(now) });
    expect((await mock.profile(fulfiller)).profile?.registered_at).toBe(String(now));
    expect((await mock.get_profile(fulfiller)).account_id).toBe(fulfiller);
    expect((await mock.profile(fulfiller)).rating).toEqual({
      star_sum: 0,
      star_count: 0,
      avg: null,
    });
    await mock.apply(fulfiller, [auth("submit_proof", { order_id: id, proof_sha256: proofFor(id) })]);
    expect((await mock.order(id))?.status).toBe("paid");
    expect((await mock.order(id))?.nullifier).toBe(proofFor(id));
    expect(mock.is_nullifier_used(proofFor(id))).toBe(id);
    expect((await mock.profile(fulfiller)).stats.jobs_done).toBe(1);
    expect((await mock.profile(buyer)).stats.jobs_as_buyer).toBe(1);
    await mock.apply(buyer, [auth("rate", { order_id: id, stars: 5 })]);
    expect((await mock.profile(fulfiller)).rating).toEqual({
      star_sum: 10,
      star_count: 2,
      avg: 5,
    });
    expect(mock.get_counts()[0]).toBeGreaterThan(0);
  });

  it("rejects three proofs, enters under_review, and allows fulfiller dispute", async () => {
    const id = await sentOrder();
    for (let attempt = 1; attempt <= 3; attempt++) {
      mock.setNextVerification(id, { ok: false, reason: "synthetic reject" });
      await mock.apply(fulfiller, [auth("submit_proof", { order_id: id, proof_sha256: proofFor(id) })]);
      expect((await mock.order(id))?.status).toBe(attempt === 3 ? "under_review" : "proof_rejected");
    }
    await expect(mock.relayerSubmitProof(id, proofFor(id))).rejects.toThrow("not awaiting proof");
    await mock.apply(fulfiller, [auth("dispute", { order_id: id, reason_code: 3 })]);
    expect((await mock.order(id))?.disputed_by).toBe(fulfiller);
    await mock.resolve(id, "buyer", MH);
    expect((await mock.order(id))?.verdict_note_hash).toBe(MH);
    expect((await mock.profile(fulfiller)).stats.disputes_lost).toBe(1);
  });

  it("accepts relayer proof with the same guards and challenge-window finalize", async () => {
    const challenge = BigInt(10) * BigInt(60) * BigInt(1_000_000_000);
    mock = new MockEscrow({ challenge_window_ns: String(challenge) }, () => now);
    const id = await sentOrder();
    expect((await mock.relayerSubmitProof(id, proofFor(id))).status).toBe("verified");
    await expect(mock.finalize(id)).rejects.toThrow("challenge window open");
    now += challenge;
    expect((await mock.finalize(id)).status).toBe("paid");
  });

  it("splits escrow before payout and slashes held bond after payout", async () => {
    mock = new MockEscrow({ bond_per_job_bps: 5000 }, () => now);
    await mock.apply(fulfiller, [intentFromInput({ kind: "bond", amount: "5000000" })]);
    const first = await sentOrder();
    mock.setNextVerification(first, { ok: false, reason: "synthetic reject" });
    for (let attempt = 0; attempt < 3; attempt++) {
      mock.setNextVerification(first, { ok: false });
      await mock.apply(fulfiller, [auth("submit_proof", { order_id: first, proof_sha256: proofFor(first) })]);
    }
    const buyerBefore = BigInt(await mock.balance(buyer));
    await mock.resolve(first, "split");
    expect(BigInt(await mock.balance(buyer)) - buyerBefore).toBe(BigInt(1_050_000));
    const second = await sentOrder();
    await mock.relayerSubmitProof(second, proofFor(second));
    await mock.apply(buyer, [auth("dispute", { order_id: second, reason_code: 1 })]);
    const buyerBeforeSlash = BigInt(await mock.balance(buyer));
    await mock.resolve(second, "buyer");
    expect(BigInt(await mock.balance(buyer)) - buyerBeforeSlash).toBe(BigInt(1_050_000));
    expect((await mock.profile(fulfiller)).bond.locked).toBe("0");
  });

  it("pays the fulfiller from escrow on a pre-payout fulfiller verdict", async () => {
    const id = await sentOrder();
    for (let attempt = 0; attempt < 3; attempt++) {
      mock.setNextVerification(id, { ok: false, reason: "synthetic reject" });
      await mock.apply(fulfiller, [auth("submit_proof", {
        order_id: id,
        proof_sha256: proofFor(id),
      })]);
    }
    const before = BigInt(await mock.balance(fulfiller));
    const resolved = await mock.resolve(id, "fulfiller");
    expect(resolved.verdict).toBe("fulfiller");
    expect(BigInt(await mock.balance(fulfiller)) - before).toBe(BigInt(2_100_000));
    expect((await mock.profile(fulfiller)).stats.jobs_done).toBe(1);
    expect((await mock.profile(buyer)).stats.disputes_lost).toBe(1);
  });

  it("holds bond for 24h, weighs ratings, and awards level one after five jobs", async () => {
    mock = new MockEscrow({ bond_per_job_bps: 5000 }, () => now);
    await mock.apply(fulfiller, [intentFromInput({ kind: "bond", amount: "10000000" })]);
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) {
      const id = await sentOrder();
      ids.push(id);
      await mock.relayerSubmitProof(id, proofFor(id));
      await mock.apply(buyer, [auth("rate", { order_id: id, stars: 5 })]);
    }
    expect((await mock.profile(fulfiller)).level).toBe(1);
    expect((await mock.profile(fulfiller)).stats.star_count).toBe(10);
    await expect(mock.releaseBond(ids[0])).rejects.toThrow("bond hold not over");
    now += BigInt(24) * HOUR;
    expect((await mock.releaseBond(ids[0])).status).toBe("closed");
  });

  it("reaches level two after twenty jobs and rejects an invalid fund", async () => {
    mock = new MockEscrow({ min_order_amount: "100000" }, () => now);
    await register();
    for (let index = 0; index < 20; index++) {
      const id = nextId();
      await mock.apply(buyer, [fund(id, now + BigInt(24) * HOUR)]);
      await mock.apply(fulfiller, [auth("claim", { order_id: id })]);
      await mock.apply(fulfiller, [auth("sent", { order_id: id })]);
      await mock.relayerSubmitProof(id, proofFor(id));
    }
    expect((await mock.profile(fulfiller)).level).toBe(2);
    const tooSmall = fund(nextId(), now + HOUR, "50000", "0");
    await expect(mock.apply(buyer, [tooSmall])).rejects.toThrow("order too small");
    const wrongToken = {
      ...fund(nextId(), now + HOUR),
      tokens: { "nep141:other.test": "2100000" },
    };
    await mock.credit(buyer, "2100000", "nep141:other.test");
    await expect(mock.apply(buyer, [wrongToken])).rejects.toThrow("token not accepted");
  });

  it("enforces claim, proof, and expiry timeouts, bond withdrawal and open-order limit", async () => {
    mock = new MockEscrow({ bond_per_job_bps: 5000 }, () => now);
    await register();
    await mock.apply(fulfiller, [intentFromInput({ kind: "bond", amount: "5000000" })]);
    const id = nextId();
    await mock.apply(buyer, [fund(id, now + HOUR)]);
    await mock.apply(fulfiller, [auth("claim", { order_id: id })]);
    await mock.apply(fulfiller, [auth("withdraw_bond", { amount: "1000000" })]);
    expect((await mock.profile(fulfiller)).bond.available).toBe("2950000");
    now += HOUR / BigInt(4);
    expect((await mock.timeout(id)).status).toBe("funded");
    expect((await mock.profile(fulfiller)).stats.active_claims).toBe(0);
    now += HOUR;
    expect((await mock.expire(id)).status).toBe("expired");
    const proofId = await sentOrder();
    now += BigInt(2) * HOUR;
    await expect(mock.relayerSubmitProof(proofId, proofFor(proofId)))
      .rejects.toThrow("proof window over");
    expect((await mock.timeout(proofId)).status).toBe("under_review");
    for (let index = 0; index < 19; index++) {
      await mock.apply(buyer, [fund(nextId(), now + HOUR)]);
    }
    await expect(mock.apply(buyer, [fund(nextId(), now + HOUR)]))
      .rejects.toThrow("too many open orders");
  });

  it("limits a fulfiller to three active claims", async () => {
    await register();
    const ids = Array.from({ length: 4 }, () => nextId());
    for (const id of ids) {
      await mock.apply(buyer, [fund(id, now + HOUR)]);
    }
    for (const id of ids.slice(0, 3)) {
      await mock.apply(fulfiller, [auth("claim", { order_id: id })]);
    }
    await expect(mock.apply(fulfiller, [auth("claim", { order_id: ids[3] })]))
      .rejects.toThrow("too many active claims");
  });

  it("claims with no bond when minimum and per-job bond are zero", async () => {
    expect(mock.get_config()).toMatchObject({
      min_bond: "0",
      bond_per_job_bps: 0,
    });
    await register();
    const id = nextId();
    await mock.apply(buyer, [fund(id, now + HOUR)]);
    await mock.apply(fulfiller, [auth("claim", { order_id: id })]);
    expect((await mock.order(id))?.status).toBe("claimed");
    expect((await mock.order(id))?.bond_locked).toBe("0");
    expect((await mock.profile(fulfiller)).bond).toEqual({
      available: "0",
      locked: "0",
    });
  });
});
