import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash, randomBytes } from "node:crypto";

vi.hoisted(() => {
  process.env.DATABASE_URL = `file:/tmp/fulfil-in-person-tests-${process.pid}.db`;
  process.env.FULFIL_MODE = "mock";
  process.env.NODE_ENV = "test";
});

import { canonicalJson, inPersonSpec, specHash } from "../../packages/core/src/spec";
import { MockEscrow } from "../../apps/web/lib/server/v3/escrow";
import { confirmInPerson, expireInPerson, inPersonMeetup, prepareInPerson } from "../../apps/web/lib/server/v3/in-person";
import { get, list } from "../../apps/web/lib/server/db";
import { put, remove } from "../../apps/web/lib/server/db";
import { pruneStoredSpecs } from "../../apps/web/lib/server/v3/shop";
import { cookieHeader } from "../../apps/web/lib/server/v3/auth";
import { GET as getV3, POST as postV3 } from "../../apps/web/lib/server/v3/handler";
import type { Session } from "../../apps/web/lib/server/v3/auth";

let buyer: Session;
let fulfiller: Session;
let stranger: Session;
const secret = "11".repeat(32);
const deliveryHash = createHash("sha256").update(Buffer.from(secret, "hex")).digest("hex");
const input = { area: "Da Nang", item_desc: "A book", price: "1000000", delivery_hash: deliveryHash,
  meetup_address: "Library entrance", meetup_contact: "Call on arrival", deadline_hours: 24 };

beforeEach(() => {
  process.env.FULFIL_MODE = "mock";
  const exp = Date.now() + 60_000;
  const suffix = randomBytes(4).toString("hex");
  buyer = { account_id: `buyer-${suffix}.test`, standard: "nep413", exp };
  fulfiller = { account_id: `fulfiller-${suffix}.test`, standard: "nep413", exp };
  stranger = { account_id: `stranger-${suffix}.test`, standard: "nep413", exp };
});

describe("in-person orders", () => {
  it("uses a 24-hour claim and proof window in mock escrow", () => {
    const config = new MockEscrow().config.kinds.in_person;
    expect(config.proof_timeout_ns).toBe(config.claim_timeout_ns);
    expect(config.proof_timeout_ns).toBe("86400000000000");
  });

  it("refuses to build a sent intent for an in-person order", async () => {
    const backend = new MockEscrow();
    await backend.seed(buyer.account_id);
    const prepared = await prepareInPerson(buyer, input);
    await backend.apply(buyer.account_id, prepared.payload.intents as never[]);
    const before = list<Record<string, unknown>>("v3:intent").length;
    const response = await postV3(new Request("http://localhost/api/v3/intents/build", {
      method: "POST",
      headers: { cookie: cookieHeader(buyer).split(";")[0], "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "auth_call", op: "sent", order_id: prepared.order_id }),
    }), { params: Promise.resolve({ path: ["intents", "build"] }) });
    expect(response.status).not.toBe(200);
    expect(await response.text()).toContain("in-person");
    expect(list<Record<string, unknown>>("v3:intent")).toHaveLength(before);
  });

  it("retains meetup only through its grace period, even without its spec", async () => {
    const prepared = await prepareInPerson(buyer, input);
    const key = `v3:meetup:${prepared.order_id}`;
    const meetup = get<{ address: string; contact: string; expires_at: string }>(key)!;
    expect(Date.parse(meetup.expires_at)).toBeGreaterThan(Date.now());
    remove(`v3:spec:${prepared.order_id}`);
    await pruneStoredSpecs(() => Date.parse(meetup.expires_at) + 1);
    expect(get(key)).toBeUndefined();
  });

  it("cleans legacy meetup records using their spec expiry and removes orphans", async () => {
    const prepared = await prepareInPerson(buyer, input);
    const key = `v3:meetup:${prepared.order_id}`;
    const spec = get<{ expires_at: string }>(`v3:spec:${prepared.order_id}`)!;
    put(`v3:submitted:${prepared.order_id}`, "v3:submitted", { submitted_at: new Date().toISOString() });
    put(key, "v3:meetup", { address: "Library", contact: "Call" });
    await pruneStoredSpecs(() => Date.parse(spec.expires_at) - 1);
    expect(get(key)).toBeDefined();
    remove(`v3:spec:${prepared.order_id}`);
    await pruneStoredSpecs(() => Date.parse(spec.expires_at) + 1);
    expect(get(key)).toBeUndefined();
  });

  it("cleans meetup details after a paid order's retention period", async () => {
    const backend = new MockEscrow();
    await backend.seed(buyer.account_id);
    await backend.seed(fulfiller.account_id);
    const prepared = await prepareInPerson(buyer, input);
    await backend.apply(buyer.account_id, prepared.payload.intents as never[]);
    await backend.apply(fulfiller.account_id, [{ intent: "auth_call", msg: JSON.stringify({ op: "register_fulfiller" }) }]);
    await backend.apply(fulfiller.account_id, [{ intent: "auth_call", msg: JSON.stringify({ op: "claim", order_id: prepared.order_id }) }]);
    await backend.apply(fulfiller.account_id, [{ intent: "auth_call", msg: JSON.stringify({ op: "confirm_delivery", order_id: prepared.order_id, secret_hex: secret }) }]);
    const key = `v3:meetup:${prepared.order_id}`;
    const expiresAt = get<{ expires_at: string }>(key)!.expires_at;
    expect((await backend.order(prepared.order_id))?.status).toBe("paid");
    await pruneStoredSpecs(() => Date.parse(expiresAt) + 1);
    expect(get(key)).toBeUndefined();
  });
  it("validates item, cap and meetup fields before preparing", async () => {
    await expect(prepareInPerson(buyer, { ...input, item_desc: "bad\ntext" })).rejects.toThrow();
    await expect(prepareInPerson(buyer, { ...input, meetup_address: "bad\u007f" })).rejects.toThrow();
    await expect(prepareInPerson(buyer, { ...input, price: "20000000" })).rejects.toThrow();
    await expect(prepareInPerson(buyer, { ...input, deadline_hours: 25 })).rejects.toThrow();
    const prepared = await prepareInPerson(buyer, input);
    expect(prepared.order.kind).toBe("in_person");
    expect(prepared.order.reward).toBe("50000");
    expect(prepared.order.pay_amount).toBe(input.price);
    expect(prepared.order.spec_hash).toBe(specHash(inPersonSpec(input)));
    expect((prepared.payload.intents[0] as { msg: string }).msg).toContain(canonicalJson(inPersonSpec(input)).replaceAll('"', '\\"'));
  });

  it("reveals meetup only to the current claimed fulfiller and never stores the code", async () => {
    const backend = new MockEscrow();
    await backend.seed(buyer.account_id);
    await backend.seed(fulfiller.account_id);
    const prepared = await prepareInPerson(buyer, input);
    await backend.apply(buyer.account_id, prepared.payload.intents as never[]);
    await expect(inPersonMeetup(buyer, prepared.order_id)).rejects.toThrow("FORBIDDEN");
    await expect(inPersonMeetup(stranger, prepared.order_id)).rejects.toThrow("FORBIDDEN");
    await backend.apply(fulfiller.account_id, [{ intent: "auth_call", msg: JSON.stringify({ op: "register_fulfiller" }) }]);
    await backend.apply(fulfiller.account_id, [{ intent: "auth_call", msg: JSON.stringify({ op: "claim", order_id: prepared.order_id }) }]);
    expect(await inPersonMeetup(fulfiller, prepared.order_id)).toEqual({ address: input.meetup_address, contact: input.meetup_contact });
    const url = `http://localhost/api/v3/jobs/${prepared.order_id}/meetup`;
    const context = { params: Promise.resolve({ path: ["jobs", prepared.order_id, "meetup"] }) };
    const read = (session?: Session) => getV3(new Request(url, { headers: session
      ? { cookie: cookieHeader(session).split(";")[0] } : {} }), context);
    expect((await read()).status).toBe(401);
    expect((await read(buyer)).status).toBe(403);
    expect((await read(stranger)).status).toBe(403);
    expect((await read(fulfiller)).status).toBe(200);
    await expect(confirmInPerson(stranger, prepared.order_id, secret)).rejects.toThrow("FORBIDDEN");
    const logs = ["log", "info", "warn", "error"].map((name) =>
      vi.spyOn(console, name as "log").mockImplementation(() => undefined));
    const confirmed = await postV3(new Request("http://localhost/api/v3/in-person/confirm", {
      method: "POST",
      headers: { cookie: cookieHeader(fulfiller).split(";")[0], "Content-Type": "application/json" },
      body: JSON.stringify({ order_id: prepared.order_id, secret_hex: secret }),
    }), { params: Promise.resolve({ path: ["in-person", "confirm"] }) });
    expect(confirmed.status).toBe(200);
    const built = await confirmed.json() as Awaited<ReturnType<typeof confirmInPerson>>;
    expect(JSON.parse((built.intents[0] as { msg: string }).msg)).toEqual({ op: "confirm_delivery", order_id: prepared.order_id, secret_hex: secret });
    expect((built.intents[0] as { min_gas: string }).min_gas).toBe("80000000000000");
    expect(list<Record<string, unknown>>("v3:intent").every((record) => !JSON.stringify(record).includes(secret))).toBe(true);
    expect(logs.every((spy) => !JSON.stringify(spy.mock.calls).includes(secret))).toBe(true);
    logs.forEach((spy) => spy.mockRestore());
    expect(get<Record<string, unknown>>(`v3:meetup:${prepared.order_id}`)).not.toHaveProperty("secret");
    await backend.apply(fulfiller.account_id, built.intents as never[]);
    expect((await backend.order(prepared.order_id))?.status).toBe("paid");
  });

  it("persists six wrong-code attempts, blocks a seventh, then refunds after deadline", async () => {
    let clock = BigInt(Date.now()) * BigInt(1_000_000);
    const backend = new MockEscrow({}, () => clock);
    await backend.seed(buyer.account_id);
    await backend.seed(fulfiller.account_id);
    const prepared = await prepareInPerson(buyer, { ...input, deadline_hours: 1 });
    await backend.apply(buyer.account_id, prepared.payload.intents as never[]);
    await backend.apply(fulfiller.account_id, [{ intent: "auth_call", msg: JSON.stringify({ op: "register_fulfiller" }) }]);
    await backend.apply(fulfiller.account_id, [{ intent: "auth_call", msg: JSON.stringify({ op: "claim", order_id: prepared.order_id }) }]);
    const wrong = { intent: "auth_call", msg: JSON.stringify({ op: "confirm_delivery", order_id: prepared.order_id,
      secret_hex: "22".repeat(32) }) };
    for (let attempt = 1; attempt <= 6; attempt++) {
      const submission = attempt === 1
        ? { intent: "auth_call", msg: JSON.stringify({ op: "confirm_delivery", order_id: prepared.order_id,
          secret_hex: "11" }) }
        : wrong;
      await backend.apply(fulfiller.account_id, [submission]);
      expect((await backend.order(prepared.order_id))?.total_proof_attempts).toBe(attempt);
    }
    await expect(backend.apply(fulfiller.account_id, [wrong])).rejects.toThrow("proof budget used");
    expect((await backend.order(prepared.order_id))?.status).toBe("claimed");
    clock = BigInt(prepared.order.deadline_ns) + BigInt(1);
    await backend.expire(prepared.order_id);
    expect((await backend.order(prepared.order_id))?.status).toBe("expired");
    expect((await backend.profile(fulfiller.account_id)).stats.active_claims).toBe(0);
  });

  it("allows an attempt after two hours but rejects confirmation at the order deadline", async () => {
    let clock = BigInt(Date.now()) * BigInt(1_000_000);
    const backend = new MockEscrow({}, () => clock);
    await backend.seed(buyer.account_id);
    await backend.seed(fulfiller.account_id);
    const prepared = await prepareInPerson(buyer, { ...input, deadline_hours: 4 });
    await backend.apply(buyer.account_id, prepared.payload.intents as never[]);
    await backend.apply(fulfiller.account_id, [{
      intent: "auth_call",
      msg: JSON.stringify({ op: "register_fulfiller" }),
    }]);
    await backend.apply(fulfiller.account_id, [{
      intent: "auth_call",
      msg: JSON.stringify({ op: "claim", order_id: prepared.order_id }),
    }]);
    clock += 2n * 60n * 60n * 1_000_000_000n;
    await backend.apply(fulfiller.account_id, [{
      intent: "auth_call",
      msg: JSON.stringify({ op: "confirm_delivery", order_id: prepared.order_id, secret_hex: "00".repeat(32) }),
    }]);
    expect((await backend.order(prepared.order_id))?.total_proof_attempts).toBe(1);
    clock = BigInt(prepared.order.deadline_ns);
    await expect(backend.apply(fulfiller.account_id, [{
      intent: "auth_call",
      msg: JSON.stringify({ op: "confirm_delivery", order_id: prepared.order_id, secret_hex: secret }),
    }])).rejects.toThrow("order expired");
  });

  it("refuses the confirm route before the claim's safe end without issuing an intent", async () => {
    const base = Date.now();
    const now = vi.spyOn(Date, "now").mockReturnValue(base);
    try {
      const backend = new MockEscrow();
      await backend.seed(buyer.account_id);
      await backend.seed(fulfiller.account_id);
      const prepared = await prepareInPerson(buyer, { ...input, deadline_hours: 4 });
      await backend.apply(buyer.account_id, prepared.payload.intents as never[]);
      await backend.apply(fulfiller.account_id, [{ intent: "auth_call", msg: JSON.stringify({ op: "register_fulfiller" }) }]);
      await backend.apply(fulfiller.account_id, [{ intent: "auth_call", msg: JSON.stringify({ op: "claim", order_id: prepared.order_id }) }]);
      const claimedAt = BigInt((await backend.order(prepared.order_id))!.claimed_at_ns!);
      const claimEndMs = Number((claimedAt + BigInt(backend.config.kinds.in_person.claim_timeout_ns)) / BigInt(1_000_000));
      const orderEndMs = Number(BigInt(prepared.order.deadline_ns) / BigInt(1_000_000));
      const safeEndMs = Math.min(claimEndMs, orderEndMs);
      const issuedBefore = list<Record<string, unknown>>("v3:intent").length;
      for (const currentTime of [safeEndMs - 90_000, safeEndMs + 1]) {
        now.mockReturnValue(currentTime);
        const currentFulfiller = { ...fulfiller, exp: currentTime + 60_000 };
        const response = await postV3(new Request("http://localhost/api/v3/in-person/confirm", {
          method: "POST",
          headers: { cookie: cookieHeader(currentFulfiller).split(";")[0], "Content-Type": "application/json" },
          body: JSON.stringify({ order_id: prepared.order_id, secret_hex: secret }),
        }), { params: Promise.resolve({ path: ["in-person", "confirm"] }) });
        expect(response.status).toBe(400);
        expect(await response.text()).toContain("Claim window is ending; the code was not sent");
        expect(list<Record<string, unknown>>("v3:intent")).toHaveLength(issuedBefore);
      }
    } finally {
      now.mockRestore();
    }
  });

  it("caps an issued confirmation deadline before the safe end and records that deadline", async () => {
    const base = Date.now();
    const now = vi.spyOn(Date, "now").mockReturnValue(base);
    try {
      const backend = new MockEscrow();
      await backend.seed(buyer.account_id);
      await backend.seed(fulfiller.account_id);
      const prepared = await prepareInPerson(buyer, { ...input, deadline_hours: 4 });
      await backend.apply(buyer.account_id, prepared.payload.intents as never[]);
      await backend.apply(fulfiller.account_id, [{ intent: "auth_call", msg: JSON.stringify({ op: "register_fulfiller" }) }]);
      await backend.apply(fulfiller.account_id, [{ intent: "auth_call", msg: JSON.stringify({ op: "claim", order_id: prepared.order_id }) }]);
      const claimedAt = BigInt((await backend.order(prepared.order_id))!.claimed_at_ns!);
      const claimEndMs = Number((claimedAt + BigInt(backend.config.kinds.in_person.claim_timeout_ns)) / BigInt(1_000_000));
      const orderEndMs = Number(BigInt(prepared.order.deadline_ns) / BigInt(1_000_000));
      const safeEndMs = Math.min(claimEndMs, orderEndMs);
      now.mockReturnValue(safeEndMs - 4 * 60_000);
      const built = await confirmInPerson(fulfiller, prepared.order_id, secret);
      expect(Date.parse(built.deadline)).toBeLessThanOrEqual(safeEndMs - 60_000);
      expect(Date.parse(built.deadline)).toBeLessThanOrEqual(Date.now() + 5 * 60_000);
      expect(Date.parse(built.deadline)).toBeGreaterThan(Date.now());
      expect(get<{ expires: number }>(`v3:intent:${built.nonce}`)?.expires).toBe(Date.parse(built.deadline));
    } finally {
      now.mockRestore();
    }
  });

  it("caps an issued confirmation deadline before the order deadline", async () => {
    const base = Date.now();
    const now = vi.spyOn(Date, "now").mockReturnValue(base);
    try {
      const backend = new MockEscrow();
      await backend.seed(buyer.account_id);
      await backend.seed(fulfiller.account_id);
      const prepared = await prepareInPerson(buyer, { ...input, deadline_hours: 1 });
      await backend.apply(buyer.account_id, prepared.payload.intents as never[]);
      await backend.apply(fulfiller.account_id, [{ intent: "auth_call", msg: JSON.stringify({ op: "register_fulfiller" }) }]);
      await backend.apply(fulfiller.account_id, [{ intent: "auth_call", msg: JSON.stringify({ op: "claim", order_id: prepared.order_id }) }]);
      now.mockReturnValue(base + 56 * 60_000);
      const built = await confirmInPerson(fulfiller, prepared.order_id, secret);
      const orderEndMs = Number(BigInt(prepared.order.deadline_ns) / BigInt(1_000_000));
      expect(Date.parse(built.deadline)).toBeLessThanOrEqual(orderEndMs - 60_000);
      expect(Date.parse(built.deadline)).toBeLessThanOrEqual(Date.now() + 5 * 60_000);
    } finally {
      now.mockRestore();
    }
  });

  it("allows only the buyer to refund a claimed order after the deadline", async () => {
    const base = Date.now();
    const now = vi.spyOn(Date, "now").mockReturnValue(base);
    try {
      const backend = new MockEscrow();
      await backend.seed(buyer.account_id);
      await backend.seed(fulfiller.account_id);
      const prepared = await prepareInPerson(buyer, { ...input, deadline_hours: 1 });
      await backend.apply(buyer.account_id, prepared.payload.intents as never[]);
      await backend.apply(fulfiller.account_id, [{ intent: "auth_call", msg: JSON.stringify({ op: "register_fulfiller" }) }]);
      await backend.apply(fulfiller.account_id, [{ intent: "auth_call", msg: JSON.stringify({ op: "claim", order_id: prepared.order_id }) }]);
      await expect(expireInPerson(buyer, prepared.order_id)).rejects.toThrow("deadline");
      now.mockReturnValue(base + 60 * 60_000 + 1);
      await expect(expireInPerson(fulfiller, prepared.order_id)).rejects.toThrow("FORBIDDEN");
      const currentBuyer = { ...buyer, exp: Date.now() + 60_000 };
      const response = await postV3(new Request("http://localhost/api/v3/in-person/expire", {
        method: "POST",
        headers: { cookie: cookieHeader(currentBuyer).split(";")[0], "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: prepared.order_id }),
      }), { params: Promise.resolve({ path: ["in-person", "expire"] }) });
      expect(response.status).toBe(200);
      expect((await backend.order(prepared.order_id))?.status).toBe("expired");
    } finally {
      now.mockRestore();
    }
  });
});
