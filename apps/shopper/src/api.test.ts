import { describe, expect, it, vi } from "vitest";
import { FulfilApiClient, type IntentSigner } from "./api";
import { ORIGIN_USDC } from "./oneclick";
import { HttpError, TimeoutError } from "./diagnostics";

const now = Date.parse("2030-01-01T00:00:00.000Z");
const accountId = "shopper.test";
const escrow = "nearfullfil.near";
const expected = { kind: "auth_call", op: "claim", order_id: "FUL-TEST01" };

function build(intent: Record<string, unknown>) {
  return {
    payload_to_sign: {
      message: JSON.stringify({
        signer_id: accountId,
        deadline: new Date(now + 300_000).toISOString(),
        intents: [intent],
      }),
      nonce: Buffer.alloc(32).toString("base64"),
      recipient: "intents.near",
    },
  };
}

function fixture(built: ReturnType<typeof build>) {
  const http = vi.fn(async (url: string) => new Response(JSON.stringify(
    url.endsWith("/intents/build") ? built : { tx_hash: "submitted" },
  )));
  const signer = {
    publicKey: "ed25519:synthetic",
    sign: vi.fn(() => "ed25519:synthetic"),
  } as unknown as IntentSigner;
  return {
    client: new FulfilApiClient("https://api.example.test", accountId, signer,
      http as typeof fetch, () => now),
    http,
    signer,
  };
}

function authIntent(message: Record<string, unknown> = { op: "claim", order_id: "FUL-TEST01" }) {
  return {
    intent: "auth_call",
    contract_id: escrow,
    msg: JSON.stringify(message),
    attached_deposit: "0",
    min_gas: "20000000000000",
  };
}

function loginChallenge(overrides: Partial<{
  message: string;
  nonce: string;
  recipient: string;
  expires_at: string;
}> = {}) {
  const nonce = overrides.nonce ?? Buffer.alloc(32, 1).toString("base64");
  const recipient = overrides.recipient ?? "api.example.test";
  const expiresAt = overrides.expires_at ?? new Date(now + 300_000).toISOString();
  return {
    nonce,
    recipient,
    expires_at: expiresAt,
    message: overrides.message ?? `${recipient} wants you to sign in with your wallet:\nFulfil\n\n` +
      `Sign in to Fulfil.\n\nURI: https://${recipient}\nVersion: 1\nNonce: ${nonce}\n` +
      `Issued At: ${new Date(now).toISOString()}\nExpiration Time: ${expiresAt}`,
  };
}

describe("shopper intent signing boundary", () => {
  it("accepts a single exact claim and transfer", async () => {
    const claim = fixture(build(authIntent()));
    await claim.client.signAndSubmit(expected);
    expect(claim.signer.sign).toHaveBeenCalledTimes(1);
    const transferInput = {
      kind: "transfer",
      token_id: ORIGIN_USDC,
      amount: "900000",
      receiver_id: "deposit.test",
    };
    const transfer = fixture(build({
      intent: "transfer",
      receiver_id: "deposit.test",
      tokens: { [ORIGIN_USDC]: "900000" },
    }));
    await transfer.client.signAndSubmit(transferInput);
    expect(transfer.signer.sign).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["wrong signer", (built: ReturnType<typeof build>) => {
      const data = JSON.parse(built.payload_to_sign.message);
      data.signer_id = "attacker.test";
      built.payload_to_sign.message = JSON.stringify(data);
    }],
    ["wrong recipient", (built: ReturnType<typeof build>) => {
      built.payload_to_sign.recipient = "attacker.test";
    }],
    ["wrong escrow contract", (built: ReturnType<typeof build>) => {
      const data = JSON.parse(built.payload_to_sign.message);
      data.intents[0].contract_id = "attacker.test";
      built.payload_to_sign.message = JSON.stringify(data);
    }],
    ["extra intent", (built: ReturnType<typeof build>) => {
      const data = JSON.parse(built.payload_to_sign.message);
      data.intents.push(authIntent());
      built.payload_to_sign.message = JSON.stringify(data);
    }],
    ["wrong operation", (built: ReturnType<typeof build>) => {
      const data = JSON.parse(built.payload_to_sign.message);
      data.intents[0] = authIntent({ op: "release_claim", order_id: "FUL-TEST01" });
      built.payload_to_sign.message = JSON.stringify(data);
    }],
    ["wrong order", (built: ReturnType<typeof build>) => {
      const data = JSON.parse(built.payload_to_sign.message);
      data.intents[0] = authIntent({ op: "claim", order_id: "FUL-OTHER1" });
      built.payload_to_sign.message = JSON.stringify(data);
    }],
    ["stale deadline", (built: ReturnType<typeof build>) => {
      const data = JSON.parse(built.payload_to_sign.message);
      data.deadline = new Date(now - 1).toISOString();
      built.payload_to_sign.message = JSON.stringify(data);
    }],
    ["distant deadline", (built: ReturnType<typeof build>) => {
      const data = JSON.parse(built.payload_to_sign.message);
      data.deadline = new Date(now + 900_001).toISOString();
      built.payload_to_sign.message = JSON.stringify(data);
    }],
  ])("rejects %s before signing", async (_name, mutate) => {
    const built = build(authIntent());
    mutate(built);
    const { client, http, signer } = fixture(built);
    await expect(client.signAndSubmit(expected)).rejects.toThrow();
    expect(signer.sign).not.toHaveBeenCalled();
    expect(http).toHaveBeenCalledTimes(1);
  });

  it.each([
    [{ [ORIGIN_USDC]: "900001" }, "deposit.test"],
    [{ [ORIGIN_USDC]: "900000" }, "attacker.test"],
    [{ "nep141:wrong": "900000" }, "deposit.test"],
  ])("rejects an altered transfer", async (tokens, receiver) => {
    const built = build({ intent: "transfer", receiver_id: receiver, tokens });
    const { client, http, signer } = fixture(built);
    await expect(client.signAndSubmit({ kind: "transfer", token_id: ORIGIN_USDC,
      amount: "900000", receiver_id: "deposit.test" })).rejects.toThrow();
    expect(signer.sign).not.toHaveBeenCalled();
    expect(http).toHaveBeenCalledTimes(1);
  });

  it("rejects an altered proof spec or hash", async () => {
    const built = build({ ...authIntent({ op: "submit_proof", order_id: "FUL-TEST01",
      proof_sha256: "a".repeat(64), spec: "attacker" }), min_gas: "200000000000000" });
    const { client, http } = fixture(built);
    await expect(client.submitBuilt(built, { kind: "auth_call", op: "submit_proof",
      order_id: "FUL-TEST01", proof_sha256: "a".repeat(64), spec: "trusted" })).rejects.toThrow();
    expect(http).not.toHaveBeenCalled();
  });

  it("rejects an Intents authorization disguised as a login challenge", async () => {
    const challenge = loginChallenge({
      recipient: "intents.near",
      message: JSON.stringify({
        signer_id: accountId,
        deadline: new Date(now + 300_000).toISOString(),
        intents: [authIntent()],
      }),
    });
    const http = vi.fn(async () => new Response(JSON.stringify(challenge)));
    const signer = {
      publicKey: "ed25519:synthetic",
      sign: vi.fn(() => "ed25519:synthetic"),
    } as unknown as IntentSigner;
    const client = new FulfilApiClient("https://api.example.test", accountId, signer,
      http as typeof fetch, () => now);

    await expect(client.login()).rejects.toThrow("Unsafe login challenge");

    expect(signer.sign).not.toHaveBeenCalled();
    expect(http).toHaveBeenCalledTimes(1);
  });

  it("signs a short-lived Fulfil login challenge for the configured host", async () => {
    const challenge = loginChallenge();
    const http = vi.fn(async () => new Response(JSON.stringify(challenge)));
    const signer = {
      publicKey: "ed25519:synthetic",
      sign: vi.fn(() => "ed25519:synthetic"),
    } as unknown as IntentSigner;
    const client = new FulfilApiClient("https://api.example.test", accountId, signer,
      http as typeof fetch, () => now);

    await client.login();

    expect(signer.sign).toHaveBeenCalledTimes(1);
    expect(http).toHaveBeenCalledTimes(2);
  });

  it("logs in after a 401 and retries the original POST once", async () => {
    const paths: string[] = [];
    const http = vi.fn(async (url: string) => {
      const path = new URL(url).pathname;
      paths.push(path);
      if (path.endsWith("/auth/challenge")) return Response.json(loginChallenge());
      if (path.endsWith("/auth/verify")) {
        return new Response("{}", { headers: { "set-cookie": "session=fresh; HttpOnly" } });
      }
      if (paths.filter((item) => item === path).length === 1) {
        return new Response("rejected", { status: 401 });
      }
      return Response.json({ ok: true });
    });
    const signer = {
      publicKey: "ed25519:synthetic",
      sign: vi.fn(() => "ed25519:synthetic"),
    } as unknown as IntentSigner;
    const client = new FulfilApiClient("https://api.example.test", accountId, signer,
      http as typeof fetch, () => now);

    await expect(client.request("POST", "/proofs", { id: "synthetic" }))
      .resolves.toEqual({ ok: true });
    expect(paths).toEqual([
      "/api/v3/proofs", "/api/v3/auth/challenge", "/api/v3/auth/verify", "/api/v3/proofs",
    ]);
    const calls = http.mock.calls as unknown as Array<[string, RequestInit]>;
    expect(calls[3]?.[1]).toMatchObject({
      method: "POST", body: JSON.stringify({ id: "synthetic" }),
      headers: expect.objectContaining({ Cookie: "session=fresh" }),
    });
  });

  it("throws after a second 401 without starting another login", async () => {
    const paths: string[] = [];
    const http = vi.fn(async (url: string) => {
      const path = new URL(url).pathname;
      paths.push(path);
      if (path.endsWith("/auth/challenge")) return Response.json(loginChallenge());
      if (path.endsWith("/auth/verify")) return Response.json({});
      return new Response("rejected", { status: 401 });
    });
    const signer = {
      publicKey: "ed25519:synthetic",
      sign: vi.fn(() => "ed25519:synthetic"),
    } as unknown as IntentSigner;
    const client = new FulfilApiClient("https://api.example.test", accountId, signer,
      http as typeof fetch, () => now);

    await expect(client.request("GET", "/me")).rejects.toMatchObject({ status: 401 });
    expect(paths).toEqual([
      "/api/v3/me", "/api/v3/auth/challenge", "/api/v3/auth/verify", "/api/v3/me",
    ]);
  });

  it("does not retry non-401 errors or login requests", async () => {
    const signer = { publicKey: "ed25519:synthetic" } as IntentSigner;
    const http = vi.fn(async () => new Response("failure", { status: 503 }));
    const client = new FulfilApiClient("https://api.example.test", accountId, signer,
      http as typeof fetch, () => now);

    await expect(client.request("GET", "/me")).rejects.toBeInstanceOf(HttpError);
    expect(http).toHaveBeenCalledTimes(1);
    http.mockImplementation(async () => new Response("unauthorized", { status: 401 }));
    await expect(client.request("POST", "/auth/challenge", {}))
      .rejects.toMatchObject({ status: 401 });
    expect(http).toHaveBeenCalledTimes(2);
  });

  it("does not re-login or resend a timed-out pay POST", async () => {
    const http = vi.fn(async () => {
      throw new DOMException("synthetic timeout", "TimeoutError");
    });
    const signer = { publicKey: "ed25519:synthetic" } as IntentSigner;
    const client = new FulfilApiClient("https://api.example.test", accountId, signer,
      http as typeof fetch, () => now);

    await expect(client.request("POST", "/intents/submit", { synthetic: true }))
      .rejects.toBeInstanceOf(TimeoutError);
    expect(http).toHaveBeenCalledTimes(1);
  });

  it("shares one login across concurrent 401 responses", async () => {
    const paths: string[] = [];
    const http = vi.fn(async (url: string, init?: RequestInit) => {
      const path = new URL(url).pathname;
      paths.push(path);
      if (path.endsWith("/auth/challenge")) return Response.json(loginChallenge());
      if (path.endsWith("/auth/verify")) {
        return new Response("{}", { headers: { "set-cookie": "session=fresh" } });
      }
      if (!(init?.headers as Record<string, string>)?.Cookie) {
        return new Response("rejected", { status: 401 });
      }
      return Response.json({ ok: true });
    });
    const signer = {
      publicKey: "ed25519:synthetic",
      sign: vi.fn(() => "ed25519:synthetic"),
    } as unknown as IntentSigner;
    const client = new FulfilApiClient("https://api.example.test", accountId, signer,
      http as typeof fetch, () => now);

    await expect(Promise.all([
      client.request("GET", "/me"), client.request("GET", "/orders"),
    ])).resolves.toEqual([{ ok: true }, { ok: true }]);
    expect(paths.filter((path) => path.endsWith("/auth/challenge"))).toHaveLength(1);
    expect(paths.filter((path) => path.endsWith("/auth/verify"))).toHaveLength(1);
  });

  it("requires HTTPS except local HTTP", () => {
    const signer = { publicKey: "synthetic" } as IntentSigner;
    expect(() => new FulfilApiClient("http://api.example.test", accountId, signer)).toThrow();
    expect(() => new FulfilApiClient("http://localhost:3000", accountId, signer)).not.toThrow();
    expect(() => new FulfilApiClient("http://127.0.0.1:3000", accountId, signer)).not.toThrow();
  });
});
