import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createHash,
  generateKeyPairSync,
  randomBytes,
  sign as cryptoSign,
} from "node:crypto";
import bs58 from "bs58";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

vi.hoisted(() => {
  process.env.DATABASE_URL = `file:/tmp/fulfil-v3-tests-${process.pid}.db`;
  process.env.FULFIL_MODE = "mock";
  process.env.NODE_ENV = "test";
});

import {
  normalizeMerchantAccount,
  merchantHash,
  samplePhoQr,
  bankTransferSpec,
  canonicalJson,
  specHash,
} from "../../packages/core/src/index";
import {
  cookieHeader,
  createChallenge,
  IntentsKeyMissingError,
  nep413Digest,
  readSession,
  signSession,
  verifyLogin,
  verifyNep413Signature,
  type Session,
} from "../../apps/web/lib/server/v3/auth";
import {
  buildPayload,
  encodeErc191Signature,
  encodeVersionedNonce,
  intentFromInput,
  validateSignedPayload,
} from "../../apps/web/lib/server/v3/intents";
import { MockEscrow } from "../../apps/web/lib/server/v3/escrow";
import {
  callRelayer,
  orderDetail,
  prepareOrder,
  proofBytes,
  resolveDispute,
  saveProof,
  submitIntents,
  topupQuote,
  topupStatus,
} from "../../apps/web/lib/server/v3/service";
import { USDC_TOKEN } from "../../apps/web/lib/server/v3/config";
import { GET as getBlob } from "../../apps/web/app/api/proof-blob/[sha256]/route";
import { GET as getV3 } from "../../apps/web/lib/server/v3/handler";
import { put } from "../../apps/web/lib/server/db";

function nearFixture() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const raw = publicKey.export({ format: "der", type: "spki" }).subarray(-32);
  const accountId = raw.toString("hex");
  const key = `ed25519:${bs58.encode(raw)}`;
  const sign = (
    payload: { message: string; nonce: string; recipient: string },
    base64 = false,
  ) => {
    const bytes = cryptoSign(null, nep413Digest(payload), privateKey);
    return base64 ? bytes.toString("base64") : `ed25519:${bs58.encode(bytes)}`;
  };
  return { accountId, key, sign };
}

function nearSession(accountId: string): Session {
  return {
    account_id: accountId,
    standard: "nep413",
    exp: Date.now() + 60_000,
  };
}

async function signedNear(
  session: Session,
  key: ReturnType<typeof nearFixture>,
  input: Record<string, unknown>,
) {
  const built = await buildPayload(session, [intentFromInput(input)]);
  const payload = built.payload_to_sign as {
    message: string;
    nonce: string;
    recipient: string;
  };
  return {
    standard: "nep413",
    payload,
    public_key: key.key,
    signature: key.sign(payload),
  };
}

beforeEach(() => {
  process.env.FULFIL_MODE = "mock";
  delete process.env.PROOF_BLOB_TOKEN;
});
afterEach(() => vi.restoreAllMocks());

describe("wallet authentication", () => {
  it("accepts a named Intents key, rejects an unregistered key, and skips RPC for implicit accounts", async () => {
    const key = nearFixture();
    const fullAccess = vi.fn(async () => false);
    const intentsKey = vi.fn(async () => true);
    const named = createChallenge();
    const namedInput = {
      standard: "nep413",
      account_id: "fulfiller.testnet",
      public_key: key.key,
      signature: key.sign(named, true),
      ...named,
    };
    expect((await verifyLogin(namedInput, fullAccess, intentsKey)).account_id)
      .toBe("fulfiller.testnet");
    expect(fullAccess).toHaveBeenCalledWith("fulfiller.testnet", key.key);
    expect(intentsKey).toHaveBeenCalledWith("fulfiller.testnet", key.key);

    const fullAccessChallenge = createChallenge();
    intentsKey.mockClear();
    expect((await verifyLogin(
      {
        ...namedInput,
        ...fullAccessChallenge,
        signature: key.sign(fullAccessChallenge, true),
      },
      async () => true,
      intentsKey,
    )).account_id).toBe("fulfiller.testnet");
    expect(intentsKey).not.toHaveBeenCalled();

    const rejected = createChallenge();
    await expect(verifyLogin(
      { ...namedInput, ...rejected, signature: key.sign(rejected, true) },
      fullAccess,
      async () => false,
    )).rejects.toThrow(/registered on intents/);

    const unavailable = createChallenge();
    await expect(verifyLogin(
      { ...namedInput, ...unavailable, signature: key.sign(unavailable, true) },
      async () => {
        throw new Error("private RPC details");
      },
      async () => {
        throw new Error("private RPC details");
      },
    )).rejects.toThrow("NEAR key is not FullAccess or registered on intents.near");

    fullAccess.mockClear();
    intentsKey.mockClear();
    const implicit = createChallenge();
    expect((await verifyLogin(
      {
        ...namedInput,
        ...implicit,
        account_id: key.accountId,
        signature: key.sign(implicit, true),
      },
      fullAccess,
      intentsKey,
    )).account_id).toBe(key.accountId);
    expect(fullAccess).not.toHaveBeenCalled();
    expect(intentsKey).not.toHaveBeenCalled();
  });

  it("verifies a fresh NEP-413 signature, rejects wrong key, function key, tampering, replay and expiry", async () => {
    const key = nearFixture();
    const challenge = createChallenge();
    const valid = {
      standard: "nep413",
      account_id: key.accountId,
      public_key: key.key,
      signature: key.sign(challenge, true),
      ...challenge,
    };
    expect((await verifyLogin(valid)).account_id).toBe(key.accountId);
    await expect(verifyLogin(valid)).rejects.toThrow(/used/);
    const second = createChallenge();
    await expect(
      verifyLogin({
        ...valid,
        ...second,
        signature: key.sign(second, true),
        message: `${second.message}x`,
      }),
    ).rejects.toThrow();
    const wrong = nearFixture();
    await expect(
      verifyLogin({ ...valid, ...createChallenge(), public_key: wrong.key }),
    ).rejects.toThrow();
    const named = createChallenge();
    await expect(
      verifyLogin(
        {
          ...valid,
          ...named,
          account_id: "named.near",
          signature: key.sign(named, true),
        },
        async () => false,
      ),
    ).rejects.toThrow(/FullAccess/);
    const expired = createChallenge();
    vi.setSystemTime(Date.now() + 5 * 60_000 + 1);
    await expect(
      verifyLogin({ ...valid, ...expired, signature: key.sign(expired, true) }),
    ).rejects.toThrow(/expired/);
    vi.useRealTimers();
  });

  it("atomically consumes a challenge before concurrent verification", async () => {
    const key = nearFixture();
    const challenge = createChallenge();
    const request = {
      standard: "nep413",
      account_id: key.accountId,
      public_key: key.key,
      signature: key.sign(challenge, true),
      ...challenge,
    };
    const outcomes = await Promise.allSettled([
      verifyLogin(request),
      verifyLogin(request),
    ]);
    expect(
      outcomes.filter((outcome) => outcome.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      outcomes.filter((outcome) => outcome.status === "rejected"),
    ).toHaveLength(1);
  });

  it("verifies ERC-191 challenge with a generated wallet and rejects tampering", async () => {
    const account = privateKeyToAccount(generatePrivateKey());
    const challenge = createChallenge();
    const signature = await account.signMessage({ message: challenge.message });
    expect(
      (
        await verifyLogin({
          standard: "erc191",
          address: account.address,
          signature,
          message: challenge.message,
        })
      ).account_id,
    ).toBe(account.address.toLowerCase());
    const another = createChallenge();
    await expect(
      verifyLogin({
        standard: "erc191",
        address: account.address,
        signature,
        message: another.message,
      }),
    ).rejects.toThrow();
  });

  it("signs cookies and rejects tampering and expiry", () => {
    const token = signSession(nearSession("tester.near"));
    expect(readSession(token)?.account_id).toBe("tester.near");
    expect(readSession(`${token}x`)).toBeUndefined();
    expect(
      readSession(
        signSession({ ...nearSession("tester.near"), exp: Date.now() - 1 }),
      ),
    ).toBeUndefined();
  });
});

describe("intents", () => {
  it("accepts registered named signers and rejects unregistered ones", async () => {
    const key = nearFixture();
    const named = nearSession("fulfiller.testnet");
    const intentsKey = vi.fn(async () => true);
    const signed = await signedNear(named, key, { kind: "bond", amount: "100" });
    expect(await validateSignedPayload(named, signed, intentsKey)).toEqual(signed);
    expect(intentsKey).toHaveBeenCalledWith(named.account_id, key.key);

    // FullAccess on the account is not enough: intents.near must know the key.
    const rejected = await signedNear(named, key, { kind: "bond", amount: "100" });
    const missing = await validateSignedPayload(named, rejected, async () => false).catch((e) => e);
    expect(missing).toBeInstanceOf(IntentsKeyMissingError);
    expect(missing.publicKey).toBe(key.key);

    // A view call that panics with a missing-key error also means "not registered".
    const panicked = await signedNear(named, key, { kind: "bond", amount: "100" });
    await expect(validateSignedPayload(named, panicked, async () => {
      throw new Error("NEAR RPC query failed: public key ed25519:abc doesn't exist");
    })).rejects.toBeInstanceOf(IntentsKeyMissingError);

    // Other RPC failures are not reported as a missing key.
    const unavailable = await signedNear(named, key, { kind: "bond", amount: "100" });
    await expect(validateSignedPayload(named, unavailable, async () => {
      throw new Error("NEAR RPC HTTP 503");
    })).rejects.toThrow("NEAR RPC HTTP 503");

    intentsKey.mockClear();
    const implicit = nearSession(key.accountId);
    const implicitSigned = await signedNear(implicit, key, { kind: "bond", amount: "100" });
    expect(await validateSignedPayload(implicit, implicitSigned, intentsKey))
      .toEqual(implicitSigned);
    expect(intentsKey).not.toHaveBeenCalled();

    const b64 = await signedNear(named, key, { kind: "bond", amount: "100" });
    const nearSig = b64.signature;
    b64.signature = key.sign(b64.payload, true);
    expect(await validateSignedPayload(named, b64, intentsKey))
      .toEqual({ ...b64, signature: nearSig });
  });

  const order = {
    id: "FUL-ABCD",
    kind: "bank_transfer",
    spec_hash: specHash(bankTransferSpec(50_000, "a".repeat(64))),
    pay_amount: "2000000",
    reward: "300000",
    deadline_ns: "1700000000000000000",
  };
  const nonce = Buffer.alloc(32, 7).toString("base64");
  const deadline = "2099-01-01T00:00:00.000Z";

  it("uses the Defuse expirable versioned nonce layout", () => {
    const nonce = Buffer.from(
      encodeVersionedNonce(
        Buffer.from("01020304", "hex"),
        "2030-01-02T03:04:05.000Z",
        Buffer.alloc(15, 0xaa),
      ),
      "base64",
    );
    expect(nonce).toHaveLength(32);
    expect(nonce.subarray(0, 5).toString("hex")).toBe("5628f6c600");
    expect(nonce.subarray(5, 9).toString("hex")).toBe("01020304");
    expect(nonce.readBigUInt64LE(9)).toBe(
      BigInt(Date.parse("2030-01-02T03:04:05.000Z")) * BigInt(1_000_000),
    );
    expect(nonce.subarray(17)).toEqual(Buffer.alloc(15, 0xaa));
  });

  it("builds golden fund, bond, all auth operations and withdrawal for both standards", async () => {
    const spec = canonicalJson(bankTransferSpec(50_000, "a".repeat(64)));
    put(`v3:spec:${order.id}`, "v3:spec", { spec });
    const inputs: Record<string, unknown>[] = [
      { kind: "fund", order },
      { kind: "bond", amount: "100" },
      {
        kind: "auth_call",
        op: "register_fulfiller",
        bank_bin: "999704",
        account_last4: "4321",
      },
      ...["claim", "sent", "cancel"].map((op) => ({
        kind: "auth_call",
        op,
        order_id: order.id,
      })),
      {
        kind: "auth_call",
        op: "submit_proof",
        order_id: order.id,
        proof_sha256: "b".repeat(64),
      },
      {
        kind: "auth_call",
        op: "dispute",
        order_id: order.id,
        reason_code: 1,
      },
      { kind: "auth_call", op: "rate", order_id: order.id, stars: 5 },
      { kind: "auth_call", op: "withdraw_bond", amount: "100" },
      {
        kind: "ft_withdraw",
        token: "usdc.near",
        receiver_id: "alice.near",
        amount: "100",
      },
    ];
    const auth = (msg: Record<string, unknown>) => ({
      intent: "auth_call",
      contract_id: "nearfullfil.near",
      msg: JSON.stringify(msg),
      attached_deposit: "0",
      min_gas: msg.op === "submit_proof" ? "200000000000000" : "20000000000000",
    });
    const expected = [
      {
        intent: "transfer",
        receiver_id: "nearfullfil.near",
        tokens: { [USDC_TOKEN]: "2300000" },
        msg: JSON.stringify({ op: "fund", order }),
      },
      {
        intent: "transfer",
        receiver_id: "nearfullfil.near",
        tokens: { [USDC_TOKEN]: "100" },
        msg: '{"op":"bond"}',
      },
      auth({
        op: "register_fulfiller",
        bank_bin: "999704",
        account_last4: "4321",
      }),
      auth({ op: "claim", order_id: order.id }),
      auth({ op: "sent", order_id: order.id }),
      auth({ op: "cancel", order_id: order.id }),
      auth({
        op: "submit_proof",
        order_id: order.id,
        proof_sha256: "b".repeat(64),
        spec,
      }),
      auth({ op: "dispute", order_id: order.id, reason_code: 1 }),
      auth({ op: "rate", order_id: order.id, stars: 5 }),
      auth({ op: "withdraw_bond", amount: "100" }),
      {
        intent: "ft_withdraw",
        token: "usdc.near",
        receiver_id: "alice.near",
        amount: "100",
      },
    ];
    for (const standard of ["nep413", "erc191"] as const) {
      const session = {
        account_id:
          standard === "erc191" ? "0x" + "a".repeat(40) : "alice.near",
        standard,
        exp: Date.now() + 60_000,
      };
      for (const [index, input] of inputs.entries()) {
        const intent = intentFromInput(input);
        expect(intent).toEqual(expected[index]);
        const built = await buildPayload(session, [intent], {
          nonce,
          deadline,
        });
        const message =
          standard === "nep413"
            ? (built.payload_to_sign as { message: string }).message
            : (built.payload_to_sign as string);
        const parsed = JSON.parse(message);
        expect(parsed.signer_id).toBe(session.account_id);
        expect(parsed.intents).toEqual([expected[index]]);
        expect(parsed.deadline).toBe(deadline);
        if (standard === "erc191")
          expect(parsed).toMatchObject({
            nonce,
            verifying_contract: "intents.near",
          });
        else
          expect(built.payload_to_sign).toMatchObject({
            nonce,
            recipient: "intents.near",
          });
        expect(message).toBe(
          JSON.stringify(
            standard === "nep413"
              ? {
                  signer_id: session.account_id,
                  deadline,
                  intents: [expected[index]],
                }
              : {
                  signer_id: session.account_id,
                  verifying_contract: "intents.near",
                  deadline,
                  nonce,
                  intents: [expected[index]],
                },
          ),
        );
      }
    }
    expect(intentFromInput(inputs[0])).toEqual({
      intent: "transfer",
      receiver_id: "nearfullfil.near",
      tokens: { [USDC_TOKEN]: "2300000" },
      msg: JSON.stringify({ op: "fund", order }),
    });
  });

  it("round trips NEP-413 and ERC-191 and rejects signer mismatch", async () => {
    const key = nearFixture();
    const near = nearSession(key.accountId);
    const signed = await signedNear(near, key, { kind: "bond", amount: "100" });
    expect(await validateSignedPayload(near, signed)).toEqual(signed);
    await expect(validateSignedPayload(near, signed)).rejects.toThrow(
      /already used/,
    );
    const account = privateKeyToAccount(generatePrivateKey());
    const evm: Session = {
      account_id: account.address.toLowerCase(),
      standard: "erc191",
      exp: Date.now() + 60_000,
    };
    const built = await buildPayload(evm, [
      intentFromInput({ kind: "bond", amount: "100" }),
    ]);
    const message = built.payload_to_sign as string;
    const signature = await account.signMessage({ message });
    const encoded = encodeErc191Signature(signature);
    expect(encoded).toMatch(/^secp256k1:/);
    expect(
      (
        await validateSignedPayload(evm, {
          standard: "erc191",
          payload: message,
          signature,
        })
      ).signature,
    ).toBe(encoded);
    const bad = await buildPayload(evm, [
      intentFromInput({ kind: "bond", amount: "100" }),
    ]);
    const badMessage = bad.payload_to_sign as string;
    const badSignature = await account.signMessage({ message: badMessage });
    await expect(
      validateSignedPayload(
        { ...evm, account_id: "0x" + "b".repeat(40) },
        { standard: "erc191", payload: badMessage, signature: badSignature },
      ),
    ).rejects.toThrow(/signer mismatch/);
  });
});

describe("merchant and mock escrow", () => {
  it("hashes the account alone after uppercase and separator removal", () => {
    expect(normalizeMerchantAccount(" ab-12. 34 ")).toBe("AB1234");
    expect(merchantHash(" ab-12. 34 ")).toBe(
      createHash("sha256").update("AB1234").digest("hex"),
    );
  });

  it("runs funding, claim, send, proof, payout, rating, cancellation and dispute", async () => {
    const buyerKey = nearFixture();
    const fulfillerKey = nearFixture();
    const buyer = nearSession(buyerKey.accountId);
    const fulfiller = nearSession(fulfillerKey.accountId);
    const backend = new MockEscrow();
    await backend.seed(buyer.account_id);
    await backend.seed(fulfiller.account_id);
    const prepared = await prepareOrder(buyer, {
      qr_payload: samplePhoQr(),
      reward_usdc: "1.50",
    });
    expect(prepared.order.spec_hash).toBe(specHash(bankTransferSpec(50_000, merchantHash("0987654321"))));
    const fund = await signedNear(buyer, buyerKey, {
      kind: "fund",
      order: prepared.order,
    });
    const verified = await validateSignedPayload(buyer, fund);
    const funded = await submitIntents(
      buyer,
      verified,
      JSON.parse(fund.payload.message).intents,
    );
    expect(funded.order?.status).toBe("funded");
    const id = prepared.order.id;
    expect(
      (await orderDetail(id, fulfiller.account_id))?.merchant?.account,
    ).toMatch(/^••••/);
    expect((await orderDetail(id, buyer.account_id))?.merchant?.account).toBe(
      "0987654321",
    );
    for (const input of [
      {
        kind: "auth_call",
        op: "register_fulfiller",
        bank_bin: "999704",
        account_last4: "4321",
      },
      { kind: "auth_call", op: "claim", order_id: id },
      { kind: "auth_call", op: "sent", order_id: id },
    ])
      await backend.apply(fulfiller.account_id, [intentFromInput(input)]);
    const jobsResponse = await getV3(
      new Request(`http://localhost/api/v3/orders?account=${fulfiller.account_id}`, {
        headers: { cookie: cookieHeader(fulfiller) },
      }),
      { params: Promise.resolve({ path: ["orders"] }) },
    );
    const jobs = (await jobsResponse.json()) as {
      orders: Array<Record<string, unknown>>;
    };
    const job = jobs.orders.find((item) => item.id === id);
    expect(job).toMatchObject({
      id,
      code: id,
      merchant_name: prepared.merchant.name,
    });
    expect(job?.claimed_at_ns).toMatch(/^\d+$/);
    expect(job?.claimed_at_ns).toBe((await backend.order(id))?.claimed_at);
    const proof = await saveProof(
      fulfiller,
      id,
      Buffer.from(`From: demo@example.invalid\r\n\r\nSynthetic proof ${id}`),
    );
    expect(proofBytes(proof.sha256)?.length).toBe(proof.size);
    await backend.apply(fulfiller.account_id, proof.payload.intents);
    expect((await backend.order(id))?.status).toBe("paid");
    await backend.apply(buyer.account_id, [
      intentFromInput({
        kind: "auth_call",
        op: "rate",
        order_id: id,
        stars: 5,
      }),
    ]);
    await backend.apply(buyer.account_id, [
      intentFromInput({
        kind: "auth_call",
        op: "dispute",
        order_id: id,
        reason_code: 1,
      }),
    ]);
    expect((await resolveDispute(id)).dry_run).toBe(true);
    expect((await backend.resolve(id, "buyer")).status).toBe("resolved");
    const second = await prepareOrder(buyer, {
      qr_payload: samplePhoQr(),
      reward_usdc: "1",
    });
    await backend.apply(buyer.account_id, [
      intentFromInput({ kind: "fund", order: second.order }),
    ]);
    await backend.apply(buyer.account_id, [
      intentFromInput({
        kind: "auth_call",
        op: "cancel",
        order_id: second.order.id,
      }),
    ]);
    expect((await backend.order(second.order.id))?.status).toBe("cancelled");
  });

  it("credits mock top-up only once", async () => {
    const account = nearSession(nearFixture().accountId);
    const quote = await topupQuote(account, {
      originAsset: USDC_TOKEN,
      amount: "1000",
    });
    const address = String(
      (quote.quote as { depositAddress: string }).depositAddress,
    );
    await topupStatus(account, address);
    await topupStatus(account, address);
    expect(await new MockEscrow().balance(account.account_id)).toBe("1000");
  });

  it("accepts non-NEP-141 asset IDs from the 1Click token catalog", async () => {
    const account = nearSession(nearFixture().accountId);
    expect(
      (
        await topupQuote(account, {
          originAsset: "nep245:catalog.near:asset",
          amount: "1000",
        })
      ).mock,
    ).toBe(true);
  });
});

describe("proof blob and relayer", () => {
  it("enforces missing, wrong, correct and unset blob tokens and proof size", async () => {
    const session = nearSession(nearFixture().accountId);
    await expect(
      saveProof(session, "FUL-NOPE", Buffer.alloc(65_537)),
    ).rejects.toThrow("PROOF_TOO_LARGE");
    const proof = randomBytes(32);
    const sha256 = createHash("sha256").update(proof).digest("hex");
    const ctx = { params: Promise.resolve({ sha256 }) };
    expect(
      (
        await getBlob(
          new Request("http://localhost/api/proof-blob/" + sha256),
          ctx,
        )
      ).status,
    ).toBe(503);
    process.env.PROOF_BLOB_TOKEN = "test-token";
    expect(
      (
        await getBlob(
          new Request("http://localhost/api/proof-blob/" + sha256),
          ctx,
        )
      ).status,
    ).toBe(401);
    expect(
      (
        await getBlob(
          new Request("http://localhost/api/proof-blob/" + sha256, {
            headers: { Authorization: "Bearer wrong" },
          }),
          ctx,
        )
      ).status,
    ).toBe(401);
    expect(
      (
        await getBlob(
          new Request("http://localhost/api/proof-blob/" + sha256, {
            headers: { Authorization: "Bearer test-token" },
          }),
          ctx,
        )
      ).status,
    ).toBe(404);
    put(`v3:proof:${sha256}`, "v3:proof", {
      base64: proof.toString("base64"),
    });
    const ok = await getBlob(
      new Request("http://localhost/api/proof-blob/" + sha256, {
        headers: { Authorization: "Bearer test-token" },
      }),
      ctx,
    );
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-type")).toBe("message/rfc822");
    expect(Buffer.from(await ok.arrayBuffer())).toEqual(proof);
  });

  it("sends exact execute_intents call through OutLayer in live mode", async () => {
    process.env.FULFIL_MODE = "live";
    process.env.OUTLAYER_API_KEY = "synthetic-key";
    process.env.OUTLAYER_WALLET_ID = "synthetic-wallet";
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({ status: "success", tx_hash: "synthetic-tx" }),
          { status: 200 },
        ),
      );
    const signed = {
      standard: "erc191",
      payload: "{}",
      signature: "secp256k1:synthetic",
    };
    await callRelayer("intents.near", "execute_intents", { signed: [signed] });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.outlayer.ai/wallet/v1/call");
    expect((options?.headers as Record<string, string>).Authorization).toBe(
      "Bearer synthetic-key",
    );
    expect(JSON.parse(String(options?.body))).toEqual({
      receiver_id: "intents.near",
      method_name: "execute_intents",
      args: { signed: [signed] },
      gas: "300000000000000",
      deposit: "0",
    });
    delete process.env.OUTLAYER_API_KEY;
    delete process.env.OUTLAYER_WALLET_ID;
  });
});
