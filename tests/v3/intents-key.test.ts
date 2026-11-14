import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateKeyPairSync, sign as cryptoSign } from "node:crypto";
import bs58 from "bs58";

vi.hoisted(() => {
  process.env.DATABASE_URL = `file:/tmp/fulfil-intents-key-${process.pid}.db`;
  process.env.FULFIL_MODE = "mock";
  process.env.NODE_ENV = "test";
});

import { POST } from "../../apps/web/lib/server/v3/handler";
import {
  IntentsKeyMissingError,
  cookieHeader,
  isMissingKeyRpcError,
  type Session,
} from "../../apps/web/lib/server/v3/auth";
import {
  buildPayload,
  intentFromInput,
  validateSignedPayload,
} from "../../apps/web/lib/server/v3/intents";
import { submitIntents } from "../../apps/web/lib/server/v3/service";
import { nep413Digest } from "../../apps/web/lib/server/v3/auth";

function fixture() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const raw = publicKey.export({ format: "der", type: "spki" }).subarray(-32);
  const key = `ed25519:${bs58.encode(raw)}`;
  const sign = (payload: { message: string; nonce: string; recipient: string }) =>
    `ed25519:${bs58.encode(cryptoSign(null, nep413Digest(payload), privateKey))}`;
  return { key, sign };
}

const session = (account_id: string): Session => ({
  account_id,
  standard: "nep413",
  exp: Date.now() + 60_000,
});

async function signed(s: Session, k: ReturnType<typeof fixture>) {
  const built = await buildPayload(s, [intentFromInput({ kind: "bond", amount: "100" })]);
  const payload = built.payload_to_sign as { message: string; nonce: string; recipient: string };
  return { standard: "nep413", payload, public_key: k.key, signature: k.sign(payload) };
}

beforeEach(() => {
  process.env.FULFIL_MODE = "mock";
});
afterEach(() => vi.restoreAllMocks());

describe("intents key registration", () => {
  it("recognises missing-key RPC errors only", () => {
    expect(isMissingKeyRpcError("NEAR RPC query failed: public key ed25519:abc doesn't exist")).toBe(true);
    expect(isMissingKeyRpcError("smart contract panicked: Public key is not registered")).toBe(true);
    expect(isMissingKeyRpcError("NEAR RPC HTTP 503")).toBe(false);
    expect(isMissingKeyRpcError("NEAR RPC returned no view result")).toBe(false);
  });

  it("lets the same payload be signed again after a missing-key rejection", async () => {
    const k = fixture();
    const s = session("meteorkent.near");
    const body = await signed(s, k);
    await expect(validateSignedPayload(s, body, async () => false)).rejects.toBeInstanceOf(
      IntentsKeyMissingError,
    );
    // Key now registered: the nonce was not burned by the failed attempt.
    expect(await validateSignedPayload(s, body, async () => true)).toEqual(body);
  });

  it("answers 400 intents_key_missing with the public key over HTTP", async () => {
    const k = fixture();
    const s = session("meteorkent.near");
    const body = await signed(s, k);
    // Mock mode never has a registry, so a named account's key is unregistered.
    const response = await POST(
      new Request("http://localhost/api/v3/intents/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: cookieHeader(s).split(";")[0] },
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ path: ["intents", "submit"] }) },
    );
    expect(response.status).toBe(400);
    const json = (await response.json()) as { error: Record<string, string> };
    expect(json.error.code).toBe("intents_key_missing");
    expect(json.error.public_key).toBe(k.key);
    expect(json.error.message).not.toMatch(/FullAccess|RPC/);
  });

  it("maps a simulate_intents public-key panic to intents_key_missing and frees the nonce", async () => {
    const k = fixture();
    const s = session("meteorkent.near");
    const body = await signed(s, k);
    const normalized = await validateSignedPayload(s, body, async () => true);
    process.env.FULFIL_MODE = "live";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: "x",
            error: { cause: { name: "CONTRACT_EXECUTION_ERROR", info: { error_message: "public key does not exist" } } },
          }),
        ),
      ),
    );
    const intents = JSON.parse(body.payload.message).intents;
    const error = await submitIntents(s, normalized, intents).catch((e) => e);
    vi.unstubAllGlobals();
    expect(error).toBeInstanceOf(IntentsKeyMissingError);
    expect(error.publicKey).toBe(k.key);
    // Nonce released, so the same payload validates again.
    process.env.FULFIL_MODE = "mock";
    expect(await validateSignedPayload(s, body, async () => true)).toEqual(body);
  });

  it("keeps other simulate RPC failures as upstream errors", async () => {
    const k = fixture();
    const s = session("meteorkent.near");
    const body = await signed(s, k);
    const normalized = await validateSignedPayload(s, body, async () => true);
    process.env.FULFIL_MODE = "live";
    vi.stubGlobal("fetch", vi.fn(async () => new Response("down", { status: 503 })));
    const intents = JSON.parse(body.payload.message).intents;
    const error = await submitIntents(s, normalized, intents).catch((e) => e);
    vi.unstubAllGlobals();
    expect(error).not.toBeInstanceOf(IntentsKeyMissingError);
    expect(String(error.message)).toMatch(/^NEAR RPC/);
  });
});
