import { describe, expect, it, vi } from "vitest";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import bs58 from "bs58";
import { samplePhoQr } from "../../packages/core/src/index";

vi.hoisted(() => {
  process.env.FULFIL_MODE = "mock";
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = `file:/tmp/fulfil-shop-flow-${process.pid}.db`;
  process.env.SHOPPER_ACCOUNT_ID = "shopper.test";
});

import { GET, POST } from "../../apps/web/lib/server/v3/handler";
import { GET as getBlob } from "../../apps/web/lib/server/v3/blob-handler";
import { cookieHeader, nep413Digest, type Session } from "../../apps/web/lib/server/v3/auth";
import { MockEscrow } from "../../apps/web/lib/server/v3/escrow";
import { resetRateLimits } from "../../apps/web/lib/server/v3/rate-limit";
import { get, put, remove } from "../../apps/web/lib/server/db";

function signer(accountId?: string) {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const raw = publicKey.export({ format: "der", type: "spki" }).subarray(-32);
  return {
    accountId: accountId ?? raw.toString("hex"),
    publicKey: `ed25519:${bs58.encode(raw)}`,
    sign: (payload: { message: string; nonce: string; recipient: string }) =>
      `ed25519:${bs58.encode(sign(null, nep413Digest(payload), privateKey))}`,
  };
}
function session(accountId: string): Session {
  return { account_id: accountId, standard: "nep413", exp: Date.now() + 60_000 };
}
function context(path: string) {
  return { params: Promise.resolve({ path: path.split("/") }) };
}
async function api(method: "GET" | "POST", path: string, account?: string, input?: unknown) {
  const request = new Request(`http://localhost/api/v3/${path}`, {
    method,
    headers: { ...(account ? { cookie: cookieHeader(session(account)) } : {}),
      ...(method === "POST" ? { "Content-Type": "application/json" } : {}) },
    ...(method === "POST" ? { body: JSON.stringify(input ?? {}) } : {}),
  });
  const response = method === "GET" ? await GET(request, context(path.split("?")[0])) : await POST(request, context(path));
  return { status: response.status, body: await response.json() as Record<string, any> };
}
async function signedIntent(actor: ReturnType<typeof signer>, input: Record<string, unknown>) {
  const built = await api("POST", "intents/build", actor.accountId, input);
  expect(built.status).toBe(200);
  const payload = built.body.payload_to_sign as { message: string; nonce: string; recipient: string };
  const submitted = await api("POST", "intents/submit", actor.accountId, {
    standard: "nep413", payload, public_key: actor.publicKey, signature: actor.sign(payload),
  });
  expect(submitted.status).toBe(200);
  return submitted.body;
}

describe("shop route flow", () => {
  it("returns a quiet logged-out session and an authenticated session", async () => {
    expect(await api("GET", "auth/session")).toEqual({
      status: 200, body: { authenticated: false },
    });
    const signedIn = await api("GET", "auth/session", "buyer.test");
    expect(signedIn.status).toBe(200);
    expect(signedIn.body).toMatchObject({ authenticated: true, account_id: "buyer.test" });
  });
  it("expresses USD face value and catalog cost in USDC base units", async () => {
    const catalog = await api("GET", "shop/catalog?country=VN");
    const listings = catalog.body.categories.flatMap((category: Record<string, any>) => category.brands);
    expect(listings.every((brand: Record<string, unknown>) => !("products" in brand))).toBe(true);
    const listed = listings.find((brand: Record<string, unknown>) => brand.brand_name === "Synthetic Game Card");
    const detail = await api("GET", `shop/brand?country=VN&slug=${encodeURIComponent(listed.slug)}`);
    expect(detail.status).toBe(200);
    expect(detail.body).toMatchObject({ slug: listed.slug, brand_name: "Synthetic Game Card" });
    expect(detail.body.variants[0].products[0].cost_usdc).toBe("5200000");
    expect(detail.body.variants.flatMap((variant: Record<string, any>) => variant.products)
      .every((product: Record<string, unknown>) => /^\d+$/.test(String(product.cost_usdc))))
      .toBe(true);
    const missing = await api("GET", "shop/brand?country=VN&slug=absent");
    expect(missing.status).toBe(404);
    expect((await api("GET", "shop/brand?country=XX&slug=absent")).status).toBe(404);

    const quote = await api("POST", "shop/quote", "buyer.test", {
      country: "VN",
      brand_name: "Synthetic Game Card",
      denomination: "5 USD",
      beneficiary: "recipient@example.com",
      buyer_email: "buyer@example.com",
    });
    expect(quote.status).toBe(200);
    expect(quote.body.quote.fx_usd).toBe("5000000");
    expect(quote.body.quote.face_value).toEqual({ amount: "5", currency: "USD" });
    expect(quote.body.spec).toMatchObject({ denomination: "5 USD", product_value: "" });
    expect(get(`v3:spec_summary:${quote.body.order_id}`)).toMatchObject({ currency: "USD" });
  });

  it("retains a range product's local currency on order details and lists", async () => {
    const buyer = signer();
    const escrow = new MockEscrow();
    await escrow.seed(buyer.accountId);
    const quoted = await api("POST", "shop/quote", buyer.accountId, {
      country: "VN",
      brand_name: "Viettel Mobile Credits",
      product_value: "30000",
      beneficiary: "+84900000001",
      buyer_email: "buyer@example.com",
    });
    expect(quoted.status).toBe(200);
    expect(quoted.body.quote.face_value).toEqual({ amount: "30000", currency: "VND" });
    const fundOrder = JSON.parse(quoted.body.payload.intents[0].msg).order;
    await signedIntent(buyer, { kind: "fund", order: fundOrder });
    const id = quoted.body.order_id as string;
    const expectedSummary = {
      brand: "Viettel Mobile Credits",
      denomination: "",
      product_value: "30000",
      currency: "VND",
      masked_beneficiary: "+8••••01",
    };
    const detail = await api("GET", `orders/${id}`, buyer.accountId);
    expect(detail.body.order.spec_summary).toEqual(expectedSummary);
    const list = await api("GET", "orders?status=funded", buyer.accountId);
    expect(list.body.orders.find((order: Record<string, unknown>) => order.id === id).spec_summary)
      .toEqual(expectedSummary);

    remove(`v3:spec:${id}`);
    const retainedDetail = await api("GET", `orders/${id}`, buyer.accountId);
    const retainedList = await api("GET", "orders?status=funded", buyer.accountId);
    expect(retainedDetail.body.order.spec_summary).toEqual(expectedSummary);
    expect(retainedList.body.orders.find((order: Record<string, unknown>) => order.id === id).spec_summary)
      .toEqual(expectedSummary);
  });

  it("serves all four public GET routes without a cookie and limits them by IP", async () => {
    resetRateLimits();
    const publicRoutes = ["shop/countries", "shop/catalog?country=VN", "shop/popular?country=VN", "fulfillers"];
    for (const path of publicRoutes) {
      const response = await api("GET", path);
      expect(response.status).toBe(200);
      if (path === "fulfillers") {
        const fulfiller = (response.body as unknown as Array<Record<string, any>>)[0];
        expect(fulfiller).toMatchObject({
          verified: false,
          official: false,
          proof: { public_key: expect.any(String), signature: expect.any(String),
            message: expect.any(String), nonce: expect.any(String) },
          profile: { rating: { star_sum: expect.any(Number), star_count: expect.any(Number) } },
        });
        expect(fulfiller.profile.rating).toHaveProperty("avg");
        expect(fulfiller.stats).toEqual(fulfiller.profile.stats);
      }
    }

    process.env.RATE_LIMIT_SHOP_PER_MINUTE = "2";
    resetRateLimits();
    const requestFor = (path: string) => new Request(`http://localhost/api/v3/${path}`, {
      headers: { "x-forwarded-for": "203.0.113.42" },
    });
    try {
      expect((await GET(requestFor("shop/countries"), context("shop/countries"))).status).toBe(200);
      expect((await GET(requestFor("shop/catalog"), context("shop/catalog"))).status).toBe(200);
      const limited = await GET(requestFor("fulfillers"), context("fulfillers"));
      expect(limited.status).toBe(429);
      expect(await limited.json()).toEqual({
        error: { code: "rate_limited", message: "Too many requests" },
      });
    } finally {
      delete process.env.RATE_LIMIT_SHOP_PER_MINUTE;
      resetRateLimits();
    }
  });

  it("rejects an expired quote when building or submitting funding", async () => {
    const buyer = signer();
    const quoted = await api("POST", "shop/quote", buyer.accountId, {
      country: "VN",
      brand_name: "Viettel Mobile Credits",
      denomination: "20000 VND",
      beneficiary: "+84900000002",
      buyer_email: "expired-buyer@example.com",
    });
    expect(quoted.status).toBe(200);
    const id = quoted.body.order_id as string;
    const prepared = get<Record<string, unknown>>(`v3:prepared:${id}`)!;
    put(`v3:prepared:${id}`, "v3:prepared", {
      ...prepared,
      expires_at: new Date(0).toISOString(),
    });

    const fund = JSON.parse(quoted.body.payload.intents[0].msg).order;
    const built = await api("POST", "intents/build", buyer.accountId, {
      kind: "fund",
      order: fund,
    });
    expect(built.status).toBe(400);
    expect(built.body.error.message).toMatch(/prepared order/i);

    const payload = quoted.body.payload.payload_to_sign as {
      message: string;
      nonce: string;
      recipient: string;
    };
    const submitted = await api("POST", "intents/submit", buyer.accountId, {
      standard: "nep413",
      payload,
      public_key: buyer.publicKey,
      signature: buyer.sign(payload),
    });
    expect(submitted.status).toBe(400);
    expect(submitted.body.error.message).toMatch(/prepared order/i);
  });

  it("quotes, funds, claims, protects the spec, verifies JSON proof and pays", async () => {
    const buyer = signer();
    const fulfiller = signer();
    process.env.SHOPPER_ACCOUNT_ID = fulfiller.accountId;
    process.env.SHOPPER_INTENTS_PUBLIC_KEY = fulfiller.publicKey;
    process.env.PROOF_BLOB_TOKEN = "synthetic-blob-token";
    const escrow = new MockEscrow();
    await escrow.seed(buyer.accountId);
    await escrow.seed(fulfiller.accountId);
    const publicCatalog = await api("GET", "shop/catalog?country=VN");
    expect(publicCatalog.status).toBe(200);
    const viettel = publicCatalog.body.categories[0].brands[0];
    expect(viettel.brand_name).toBe("Viettel Mobile Credits");
    const viettelProducts = await api("GET", `shop/brand?country=VN&slug=${encodeURIComponent(viettel.slug)}`);
    expect(viettelProducts.body.variants[0].products[0].cost_usdc).toBe("890000");
    const quoted = await api("POST", "shop/quote", buyer.accountId, {
      country: "VN", brand_name: "Viettel Mobile Credits", denomination: "20000 VND",
      beneficiary: "+84900000001", buyer_email: "buyer@example.com",
    });
    expect(quoted.status).toBe(200);
    expect(quoted.body.quote.fx_usd).toBeNull();
    for (const field of ["merchant_price", "transfer_fee", "buffer", "reward", "platform_fee", "total"]) {
      expect(quoted.body.quote[field]).toMatch(/^\d+$/);
    }
    const id = quoted.body.order_id as string;
    const fundMessage = JSON.parse(quoted.body.payload.intents[0].msg);
    expect(fundMessage.order).toMatchObject({ id, kind: "cryptorefills_topup", spec_hash: quoted.body.spec_hash });
    await signedIntent(buyer, { kind: "fund", order: fundMessage.order });
    const fundedDetail = await api("GET", `orders/${id}`, buyer.accountId);
    expect(fundedDetail.body.order).toMatchObject({
      status: "funded",
      kind: "cryptorefills_topup",
      spec_summary: {
        brand: "Viettel Mobile Credits",
        denomination: "20000 VND",
        product_value: "",
        currency: "VND",
        masked_beneficiary: "+8••••01",
      },
      fulfiller_listed: false,
    });
    expect((await api("GET", `jobs/${id}/spec`)).status).toBe(401);
    expect((await api("GET", `jobs/${id}/spec`, buyer.accountId)).status).toBe(403);
    await signedIntent(fulfiller, { kind: "auth_call", op: "register_fulfiller" });
    await signedIntent(fulfiller, { kind: "auth_call", op: "claim", order_id: id });
    expect((await api("GET", `orders/${id}`, buyer.accountId)).body.order).toMatchObject({
      status: "claimed",
      kind: "cryptorefills_topup",
      spec_summary: fundedDetail.body.order.spec_summary,
      fulfiller_listed: false,
    });
    const job = await api("GET", `jobs/${id}/spec`, fulfiller.accountId);
    expect(job).toMatchObject({ status: 200, body: { beneficiary: "+84900000001", buyer_email: "buyer@example.com" } });
    const other = signer();
    expect((await api("GET", `jobs/${id}/spec`, other.accountId)).status).toBe(403);
    const detail = await api("GET", `orders/${id}`, buyer.accountId);
    expect(detail.body.order).toMatchObject({ kind: "cryptorefills_topup", fulfiller_listed: false });
    expect(JSON.stringify(detail.body)).not.toContain("buyer@example.com");
    expect(JSON.stringify(detail.body)).not.toContain("+84900000001");
    const proof = await api("POST", "proofs", fulfiller.accountId, {
      order_id: id,
      cr_order_id: `synthetic-cr-order-${id}`,
      cr_order_token: `synthetic-cr-token-${id}`,
    });
    expect(proof.status).toBe(200);
    const blob = await getBlob(new Request(`http://localhost/api/proof-blob/${proof.body.sha256}`, {
      headers: { Authorization: "Bearer synthetic-blob-token" },
    }), { params: Promise.resolve({ sha256: proof.body.sha256 }) });
    expect(blob.headers.get("content-type")).toBe("application/json");
    expect(await blob.json()).toEqual({
      cr_order_id: `synthetic-cr-order-${id}`,
      cr_order_token: `synthetic-cr-token-${id}`,
    });
    const proofPayload = proof.body.payload.payload_to_sign as { message: string; nonce: string; recipient: string };
    const submitted = await api("POST", "intents/submit", fulfiller.accountId, {
      standard: "nep413", payload: proofPayload, public_key: fulfiller.publicKey,
      signature: fulfiller.sign(proofPayload),
    });
    expect(submitted.status).toBe(200);
    const paidDetail = await api("GET", `orders/${id}`, buyer.accountId);
    expect(paidDetail.body.order).toMatchObject({
      status: "paid",
      kind: "cryptorefills_topup",
      spec_summary: fundedDetail.body.order.spec_summary,
      fulfiller_listed: false,
    });
    remove(`v3:spec:${id}`);
    expect((await api("GET", `orders/${id}`, buyer.accountId)).body.order.spec_summary)
      .toEqual(fundedDetail.body.order.spec_summary);
    process.env.SHOPPER_ACCOUNT_ID = "shopper.test";
    delete process.env.SHOPPER_INTENTS_PUBLIC_KEY;
    delete process.env.PROOF_BLOB_TOKEN;
  });

  it("returns bank order fields through funded, claimed, sent, rejected, and paid states", async () => {
    const buyer = signer();
    const fulfiller = signer();
    const escrow = new MockEscrow();
    await escrow.seed(buyer.accountId);
    await escrow.seed(fulfiller.accountId);

    const prepared = await api("POST", "orders/prepare", buyer.accountId, {
      qr_payload: samplePhoQr(50_000),
      amount_vnd: 50_000,
      reward_usdc: "0.05",
    });
    expect(prepared.status).toBe(200);
    const fundOrder = JSON.parse(prepared.body.payload.intents[0].msg).order;
    const id = fundOrder.id as string;
    await signedIntent(buyer, { kind: "fund", order: fundOrder });

    const detail = async () => (await api("GET", `orders/${id}`, buyer.accountId)).body.order;
    const funded = await detail();
    expect(funded).toMatchObject({
      status: "funded",
      kind: "bank_transfer",
      spec_summary: {
        brand: "VPBank",
        denomination: "50000",
        product_value: "",
        currency: "VND",
        masked_beneficiary: expect.any(String),
      },
      fulfiller_listed: false,
    });
    expect(funded.spec_summary.masked_beneficiary).toContain("••••");
    const fundedList = await api("GET", "orders?status=funded", buyer.accountId);
    expect(fundedList.body.orders.find((order: Record<string, unknown>) => order.id === id).spec_summary)
      .toEqual(funded.spec_summary);

    await signedIntent(fulfiller, {
      kind: "auth_call",
      op: "register_fulfiller",
      bank_bin: "970436",
      account_last4: "1234",
    });
    await signedIntent(fulfiller, { kind: "auth_call", op: "claim", order_id: id });
    expect(await detail()).toMatchObject({
      status: "claimed",
      kind: "bank_transfer",
      spec_summary: funded.spec_summary,
      fulfiller_listed: false,
    });

    await signedIntent(fulfiller, { kind: "auth_call", op: "sent", order_id: id });
    expect((await detail()).status).toBe("sent");
    escrow.setNextVerification(id, { ok: false, reason: "synthetic rejection" });
    const rejectedProof = createHash("sha256").update(`${id}:rejected`).digest("hex");
    const acceptedProof = createHash("sha256").update(`${id}:accepted`).digest("hex");
    await signedIntent(fulfiller, {
      kind: "auth_call",
      op: "submit_proof",
      order_id: id,
      proof_sha256: rejectedProof,
    });
    expect((await detail()).status).toBe("proof_rejected");
    escrow.setNextVerification(id, { ok: true });
    await signedIntent(fulfiller, {
      kind: "auth_call",
      op: "submit_proof",
      order_id: id,
      proof_sha256: acceptedProof,
    });
    expect(await detail()).toMatchObject({
      status: "paid",
      kind: "bank_transfer",
      spec_summary: funded.spec_summary,
      fulfiller_listed: false,
    });
    remove(`v3:spec:${id}`);
    expect((await detail()).spec_summary).toEqual(funded.spec_summary);
    const retainedList = await api("GET", "orders", buyer.accountId);
    expect(retainedList.body.orders.find((order: Record<string, unknown>) => order.id === id).spec_summary)
      .toEqual(funded.spec_summary);
  });

  it("keeps contract status and summary fields on live order details", async () => {
    const previousMode = process.env.FULFIL_MODE;
    const previousSecret = process.env.SESSION_SECRET;
    process.env.FULFIL_MODE = "live";
    process.env.SESSION_SECRET = "synthetic-live-session-secret";

    const orders = new Map([
      ["FUL-LIVE001", {
        id: "FUL-LIVE001",
        buyer: "live-buyer.test",
        fulfiller: "shopper.nearfullfil.near",
        status: "verifying",
        kind: "cryptorefills_code",
        spec_hash: "1".repeat(64),
        claimed_at: "1800000000000000000",
      }],
      ["FUL-LIVE002", {
        id: "FUL-LIVE002",
        buyer: "live-buyer.test",
        fulfiller: "fullfiller1.near",
        status: "sent",
        kind: "bank_transfer",
        spec_hash: "2".repeat(64),
        claimed_at: "1800000000000000000",
      }],
      ["FUL-LIVE003", {
        id: "FUL-LIVE003",
        buyer: "live-buyer.test",
        fulfiller: null,
        status: "funded",
        kind: "cryptorefills_code",
        spec_hash: "3".repeat(64),
        claimed_at: null,
      }],
    ]);
    put("v3:spec_summary:FUL-LIVE001", "v3:spec_summary", {
      brand: "Synthetic Game Card",
      denomination: "5 USD",
      masked_beneficiary: "bu••••om",
    });
    put("v3:spec_summary:FUL-LIVE002", "v3:spec_summary", {
      brand: "VPBank",
      denomination: "50000",
      masked_beneficiary: "09••••21",
    });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, options) => {
      const rpc = JSON.parse(String(options?.body)) as {
        params: { method_name: string; args_base64: string };
      };
      const args = JSON.parse(Buffer.from(rpc.params.args_base64, "base64").toString()) as { id?: string };
      const result = rpc.params.method_name === "get_order"
        ? orders.get(args.id ?? "") ?? null
        : rpc.params.method_name === "list_orders" ? [...orders.values()] : null;
      return new Response(JSON.stringify({
        result: { result: [...Buffer.from(JSON.stringify(result))] },
      }));
    });

    try {
      const code = await api("GET", "orders/FUL-LIVE001", "live-buyer.test");
      expect(code.status).toBe(200);
      expect(code.body.order).toMatchObject({
        status: "verifying",
        kind: "cryptorefills_code",
        spec_summary: {
          brand: "Synthetic Game Card",
          denomination: "5 USD",
          currency: "USD",
          masked_beneficiary: "bu••••om",
        },
        fulfiller_listed: true,
      });

      const bank = await api("GET", "orders/FUL-LIVE002", "live-buyer.test");
      expect(bank.status).toBe(200);
      expect(bank.body.order).toMatchObject({
        status: "sent",
        kind: "bank_transfer",
        spec_summary: {
          brand: "VPBank",
          denomination: "50000",
          currency: "VND",
          masked_beneficiary: "09••••21",
        },
        fulfiller_listed: true,
      });

      // Order detail is public, but never shows the pay QR to an anonymous viewer.
      const anonymous = await api("GET", "orders/FUL-LIVE002");
      expect(anonymous.status).toBe(200);
      expect(anonymous.body.order).toMatchObject({ id: "FUL-LIVE002", status: "sent" });
      expect(anonymous.body.merchant?.pay_qr ?? null).toBeNull();

      const missingSummary = await api("GET", "orders/FUL-LIVE003", "live-buyer.test");
      expect(missingSummary.status).toBe(200);
      expect(missingSummary.body.order.spec_summary).toEqual({
        brand: "Unknown",
        denomination: "",
        product_value: "",
        currency: "",
        masked_beneficiary: "••••",
      });
      const list = await api("GET", "orders", "live-buyer.test");
      expect(list.status).toBe(200);
      expect(list.body.orders.find((order: Record<string, unknown>) => order.id === "FUL-LIVE001")
        .spec_summary.currency).toBe("USD");
      expect(list.body.orders.find((order: Record<string, unknown>) => order.id === "FUL-LIVE002")
        .spec_summary.currency).toBe("VND");
    } finally {
      fetchMock.mockRestore();
      process.env.FULFIL_MODE = previousMode;
      if (previousSecret === undefined) {
        delete process.env.SESSION_SECRET;
      } else {
        process.env.SESSION_SECRET = previousSecret;
      }
    }
  });
});
