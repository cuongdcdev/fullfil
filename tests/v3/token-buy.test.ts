import { beforeEach, describe, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";

vi.hoisted(() => {
  process.env.DATABASE_URL = `file:/tmp/fulfil-token-buy-${process.pid}.db`;
  process.env.FULFIL_MODE = "mock";
  process.env.NODE_ENV = "test";
  process.env.PROOF_BLOB_TOKEN = "synthetic-test-token";
});

import { GET, POST } from "../../apps/web/lib/server/v3/handler";
import { GET as getBlob } from "../../apps/web/lib/server/v3/blob-handler";
import { cookieHeader, type Session } from "../../apps/web/lib/server/v3/auth";
import { MockEscrow } from "../../apps/web/lib/server/v3/escrow";
import { resetRateLimits } from "../../apps/web/lib/server/v3/rate-limit";
import { proofBytes } from "../../apps/web/lib/server/v3/service";
import { pruneStoredSpecs } from "../../apps/web/lib/server/v3/shop";
import { get } from "../../apps/web/lib/server/db";
import { prepareInPerson } from "../../apps/web/lib/server/v3/in-person";
import { canonicalJson, specHash, tokenBuySpec } from "../../packages/core/src/spec";

let buyer: Session;
let agent: Session;
let stranger: Session;
const tokenInput = { token_contract: "blackdragon.near", spend_usdc: "1000001", receiver: "buyer.near" };
const txHash = "3".repeat(44);

function context(path: string) {
  return { params: Promise.resolve({ path: path.split("/") }) };
}

async function request(method: "GET" | "POST", path: string, session?: Session, input?: unknown) {
  const route = path.split("?")[0];
  const response = await (method === "GET" ? GET : POST)(new Request(`http://localhost/api/v3/${path}`, {
    method,
    headers: { ...(session ? { cookie: cookieHeader(session).split(";")[0] } : {}),
      ...(method === "POST" ? { "Content-Type": "application/json" } : {}) },
    ...(method === "POST" ? { body: JSON.stringify(input ?? {}) } : {}),
  }), context(route));
  return { status: response.status, body: await response.json() as Record<string, any> };
}

async function prepared(input: Record<string, unknown> = tokenInput) {
  const result = await request("POST", "token/prepare", buyer, input);
  expect(result.status).toBe(200);
  return result.body;
}

async function fundedAndClaimed() {
  const backend = new MockEscrow();
  await backend.seed(buyer.account_id);
  const created = await prepared();
  await backend.apply(buyer.account_id, created.payload.intents);
  await backend.apply(agent.account_id, [{ intent: "auth_call", msg: JSON.stringify({ op: "register_fulfiller" }) }]);
  await backend.apply(agent.account_id, [{ intent: "auth_call", msg: JSON.stringify({ op: "claim", order_id: created.order_id }) }]);
  return created;
}

beforeEach(() => {
  process.env.FULFIL_MODE = "mock";
  delete process.env.TOKEN_BUY_MAX_SPEND;
  resetRateLimits();
  const suffix = randomBytes(4).toString("hex");
  const exp = Date.now() + 60_000;
  buyer = { account_id: `buyer-${suffix}.near`, standard: "nep413", exp };
  agent = { account_id: `agent-${suffix}.near`, standard: "nep413", exp };
  stranger = { account_id: `stranger-${suffix}.near`, standard: "nep413", exp };
});

describe("token-buy API", () => {
  it("searches priced reputable tokens publicly and checks token info", async () => {
    const search = await request("GET", "token/search?q=dragon");
    expect(search.status).toBe(200);
    expect(search.body).toMatchObject([{ account_id: "blackdragon.near", symbol: "BLACKDRAGON" }]);
    expect((await request("GET", "token/search?q=risk")).body).toEqual([]);
    const risky = await request("GET", "token/info?id=risky.near");
    expect(risky.body.warning).toContain("below NotFake");
    expect((await request("GET", "token/info?id=unpriced.near")).body.error.code).toBe("token_unpriced");
    expect((await request("GET", "token/info?id=BAD!")).status).toBe(400);
  });

  it("uses the public shop IP limit for token search", async () => {
    process.env.RATE_LIMIT_SHOP_PER_MINUTE = "1";
    try {
      expect((await request("GET", "token/search?q=dragon")).status).toBe(200);
      expect((await request("GET", "token/search?q=dragon")).body.error.code).toBe("rate_limited");
    } finally {
      delete process.env.RATE_LIMIT_SHOP_PER_MINUTE;
    }
  });

  it("checks named, missing, and implicit accounts without a session", async () => {
    expect((await request("GET", "account/check?id=buyer.near")).body).toEqual({
      account_id: "buyer.near", exists: true, implicit: false,
    });
    expect((await request("GET", "account/check?id=missing.near")).body).toEqual({
      account_id: "missing.near", exists: false, implicit: false,
    });
    expect((await request("GET", `account/check?id=${"a".repeat(64)}`)).body).toEqual({
      account_id: "a".repeat(64), exists: false, implicit: true,
    });
    expect((await request("GET", "account/check?id=NOPE!")).status).toBe(400);
  });

  it("requires a session and enforces spend limits including override", async () => {
    expect((await request("POST", "token/prepare", undefined, tokenInput)).status).toBe(401);
    expect((await request("POST", "token/prepare", buyer, { ...tokenInput, spend_usdc: "0" })).body.error.code).toBe("below_min");
    expect((await request("POST", "token/prepare", buyer, { ...tokenInput, spend_usdc: "999999" })).body.error.code).toBe("below_min");
    expect((await request("POST", "token/prepare", buyer, { ...tokenInput, spend_usdc: "5000001" })).body.error.code).toBe("above_max");
    process.env.TOKEN_BUY_MAX_SPEND = "6000000";
    expect((await request("POST", "token/prepare", buyer, { ...tokenInput, spend_usdc: "5000001" })).status).toBe(200);
  });

  it("prepares for an ERC-191 buyer with a separately entered NEAR receiver", async () => {
    const evmBuyer: Session = { account_id: `0x${"1".repeat(40)}`, standard: "erc191", exp: Date.now() + 60_000 };
    const result = await request("POST", "token/prepare", evmBuyer, tokenInput);
    expect(result.status).toBe(200);
    expect(result.body.spec.receiver).toBe("buyer.near");
    expect(result.body.payload.standard).toBe("erc191");
  });

  it("removes public metadata for an abandoned unfunded quote", async () => {
    const created = await prepared();
    expect(get(`v3:token_public:${created.order_id}`)).toBeDefined();
    await pruneStoredSpecs(() => Date.parse(created.quote.expires_at) + 61 * 60_000);
    expect(get(`v3:token_public:${created.order_id}`)).toBeUndefined();
  });

  it("floors slippage using BigInt, defaults to 300 bps, and computes ceil 5% reward", async () => {
    const result = await prepared();
    const estimated = BigInt("1000001") * BigInt(500) + BigInt(7);
    expect(result.quote.slippage_bps).toBe(300);
    expect(result.quote.estimated_out).toBe(estimated.toString());
    expect(result.quote.amount_out).toBe((estimated * BigInt(9700) / BigInt(10000)).toString());
    expect(result.quote.reward).toBe("50001");
    expect(result.quote.total).toBe("1050002");
    expect(result.quote.expires_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(Number.isFinite(Date.parse(result.quote.expires_at))).toBe(true);
    expect(result.spec).toEqual(tokenBuySpec({ amount_out: result.quote.amount_out,
      receiver: "buyer.near", token_contract: "blackdragon.near" }));
    expect(result.order.spec_hash).toBe(specHash(canonicalJson(result.spec)));
    expect((await prepared({ ...tokenInput, slippage_bps: 0 })).quote.amount_out).toBe(estimated.toString());
    expect((await prepared({ ...tokenInput, slippage_bps: 1000 })).quote.amount_out)
      .toBe((estimated * BigInt(9000) / BigInt(10000)).toString());
    for (const slippage_bps of [-1, 1001, 1.5]) {
      expect((await request("POST", "token/prepare", buyer, { ...tokenInput, slippage_bps })).status).toBe(400);
    }
  });

  it("handles receiver confirmation, missing route, unpriced token, and deadline bounds", async () => {
    const missing = { ...tokenInput, receiver: "missing.near" };
    expect((await request("POST", "token/prepare", buyer, missing)).body.error.code).toBe("receiver_not_found");
    expect((await request("POST", "token/prepare", buyer, { ...missing, receiver_confirmed: true })).status).toBe(200);
    expect((await request("POST", "token/prepare", buyer, { ...tokenInput, receiver: "a".repeat(64) })).status).toBe(200);
    expect((await request("POST", "token/prepare", buyer, { ...tokenInput, token_contract: "noroute.near" })).body.error.code).toBe("no_route");
    expect((await request("POST", "token/prepare", buyer, { ...tokenInput, token_contract: "unpriced.near" })).body.error.code).toBe("token_unpriced");
    for (const deadline_hours of [0, 25, 1.5]) {
      expect((await request("POST", "token/prepare", buyer, { ...tokenInput, deadline_hours })).status).toBe(400);
    }
    const long = await prepared({ ...tokenInput, deadline_hours: 24 });
    expect(Number(BigInt(long.order.deadline_ns) / BigInt(1_000_000)) - Date.now()).toBeGreaterThan(23 * 60 * 60_000);
  });

  it("funds through the standard payload and exposes CLI order fields with kind filtering", async () => {
    const backend = new MockEscrow();
    await backend.seed(buyer.account_id);
    const created = await prepared();
    const intent = created.payload.intents[0];
    expect(JSON.parse(intent.msg).spec).toBe(canonicalJson(created.spec));
    expect(intent.tokens).toMatchObject({ "nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1": created.quote.total });
    const build = await request("POST", "intents/build", buyer, { kind: "fund", order: created.order, spec: canonicalJson(created.spec) });
    expect(build.status).toBe(200);
    await backend.apply(buyer.account_id, created.payload.intents);
    const list = await request("GET", "orders?kind=token_buy&status=funded", buyer);
    const order = list.body.orders.find((item: { id: string }) => item.id === created.order_id);
    expect(order).toMatchObject({ id: created.order_id, buyer: buyer.account_id,
      reward: created.order.reward, pay_amount: created.order.pay_amount,
      deadline_ns: created.order.deadline_ns, spec: created.spec,
      token: "nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1",
      buy_token: { account_id: "blackdragon.near", symbol: "BLACKDRAGON" },
      delivery_tx_hash: null });
    const detail = await request("GET", `orders/${created.order_id}`, agent);
    expect(detail.body.order).toMatchObject({ spec: created.spec, buyer: buyer.account_id,
      reward: created.order.reward, pay_amount: created.order.pay_amount,
      deadline_ns: created.order.deadline_ns,
      token: "nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1",
      buy_token: { account_id: "blackdragon.near", symbol: "BLACKDRAGON" },
      delivery_tx_hash: null });
    expect((await request("GET", "orders?kind=in_person&status=funded", buyer)).body.orders
      .some((item: { id: string }) => item.id === created.order_id)).toBe(false);
  });

  it("accepts only valid token proofs from the current claimer and serves canonical JSON blob", async () => {
    const created = await fundedAndClaimed();
    expect((await request("POST", "proofs", agent, { order_id: created.order_id, tx_hash: "bad" })).body.error.code).toBe("invalid_tx_hash");
    expect((await request("POST", "proofs", stranger, { order_id: created.order_id, tx_hash: txHash })).status).toBe(403);
    const upload = await request("POST", "proofs", agent, { order_id: created.order_id, tx_hash: txHash });
    expect(upload.status).toBe(200);
    const beforeSubmission = await request("GET", `orders/${created.order_id}`, buyer);
    expect(beforeSubmission.body.order.delivery_tx_hash).toBeNull();
    const bytes = proofBytes(upload.body.sha256);
    expect(bytes?.toString()).toBe(canonicalJson({ order_id: created.order_id, tx_hash: txHash }));
    const blob = await getBlob(new Request(`http://localhost/api/proof-blob/${upload.body.sha256}`, {
      headers: { Authorization: "Bearer synthetic-test-token" },
    }), { params: Promise.resolve({ sha256: upload.body.sha256 }) });
    expect(blob.status).toBe(200);
    expect(blob.headers.get("Content-Type")).toBe("application/json");
    expect(await blob.text()).toBe(bytes?.toString());
    const proofIntent = upload.body.payload.intents[0];
    expect(JSON.parse(proofIntent.msg)).toMatchObject({ op: "submit_proof", order_id: created.order_id,
      proof_sha256: upload.body.sha256, spec: canonicalJson(created.spec) });
    const built = await request("POST", "intents/build", agent, { kind: "auth_call", op: "submit_proof",
      order_id: created.order_id, proof_sha256: upload.body.sha256 });
    expect(built.status).toBe(200);
    expect((await request("POST", "intents/build", agent, { kind: "auth_call", op: "release_claim", order_id: created.order_id })).status).toBe(200);
    await new MockEscrow().apply(agent.account_id, built.body.intents);
    expect((await new MockEscrow().order(created.order_id))?.status).toBe("paid");
    const detail = await request("GET", `orders/${created.order_id}`, buyer);
    expect(detail.body.order).toMatchObject({
      token: "nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1",
      buy_token: { account_id: "blackdragon.near", symbol: "BLACKDRAGON" },
      delivery_tx_hash: txHash,
    });
    const list = await request("GET", "orders?kind=token_buy&status=paid", buyer);
    expect(list.body.orders.find((item: { id: string }) => item.id === created.order_id)).toMatchObject({
      token: "nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1",
      buy_token: { account_id: "blackdragon.near", symbol: "BLACKDRAGON" },
      delivery_tx_hash: txHash,
    });
    await pruneStoredSpecs(() => Date.now() + 48 * 60 * 60_000);
    const retained = await request("GET", `orders/${created.order_id}`, buyer);
    expect(retained.body.order).toMatchObject({
      spec: created.spec,
      buy_token: { account_id: "blackdragon.near" },
      delivery_tx_hash: txHash,
    });
  });

  it("releases token-buy claims and refunds them after deadline", async () => {
    const created = await fundedAndClaimed();
    const release = await request("POST", "intents/build", agent, { kind: "auth_call", op: "release_claim",
      order_id: created.order_id });
    expect(release.status).toBe(200);
    await new MockEscrow().apply(agent.account_id, release.body.intents);
    expect((await new MockEscrow().order(created.order_id))?.status).toBe("funded");
    expect((await request("POST", "token/expire", stranger, { order_id: created.order_id })).status).toBe(403);
    expect((await request("POST", "token/expire", buyer, { order_id: created.order_id })).status).toBe(400);
    const originalNow = Date.now;
    const pastDeadline = Number(BigInt(created.order.deadline_ns) / BigInt(1_000_000)) + 1;
    buyer.exp = pastDeadline + 60_000;
    Date.now = () => pastDeadline;
    try {
      const expired = await request("POST", "token/expire", buyer, { order_id: created.order_id });
      expect(expired.status).toBe(200);
    } finally {
      Date.now = originalNow;
    }
    expect((await new MockEscrow().order(created.order_id))?.status).toBe("expired");
  });

  it("rejects JSON token proofs for other order kinds", async () => {
    const backend = new MockEscrow();
    await backend.seed(buyer.account_id);
    await backend.seed(agent.account_id);
    const created = await prepareInPerson(buyer, { area: "Da Nang", item_desc: "A book",
      price: "1000000", delivery_hash: "1".repeat(64),
      meetup_address: "Library", meetup_contact: "Call" });
    await backend.apply(buyer.account_id, created.payload.intents as never[]);
    await backend.apply(agent.account_id, [{ intent: "auth_call", msg: JSON.stringify({ op: "register_fulfiller" }) }]);
    await backend.apply(agent.account_id, [{ intent: "auth_call", msg: JSON.stringify({ op: "claim", order_id: created.order_id }) }]);
    const response = await request("POST", "proofs", agent, { order_id: created.order_id, tx_hash: txHash });
    expect(response.status).toBe(400);
  });
});
