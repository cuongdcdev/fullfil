import { createHash, createPrivateKey, createPublicKey, sign } from "node:crypto";
import bs58 from "bs58";
import { ORIGIN_USDC } from "./oneclick";
import { HttpError } from "./diagnostics";
import { fetchWithTimeout, responseJson } from "./http";

const PKCS8_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");
function u32(value: number): Buffer {
  const bytes = Buffer.alloc(4);
  bytes.writeUInt32LE(value);
  return bytes;
}

function borshString(value: string): Buffer {
  const bytes = Buffer.from(value);
  return Buffer.concat([u32(bytes.length), bytes]);
}

export function nep413Digest(payload: { message: string; nonce: string; recipient: string }): Buffer {
  const nonce = Buffer.from(payload.nonce, "base64");
  if (nonce.length !== 32) {
    throw new Error("Invalid NEP-413 nonce");
  }
  const bytes = Buffer.concat([
    u32(2 ** 31 + 413),
    borshString(payload.message),
    nonce,
    borshString(payload.recipient),
    Buffer.from([0]),
  ]);
  return createHash("sha256").update(bytes).digest();
}

export class IntentSigner {
  private readonly key;
  readonly publicKey: string;

  constructor(secret: string) {
    if (!secret.startsWith("ed25519:")) {
      throw new Error("Expected ed25519 private key");
    }
    const raw = Buffer.from(bs58.decode(secret.slice(8)));
    if (raw.length !== 64 && raw.length !== 32) {
      throw new Error("Invalid ed25519 private key");
    }
    this.key = createPrivateKey({
      key: Buffer.concat([PKCS8_PREFIX, raw.subarray(0, 32)]),
      format: "der",
      type: "pkcs8",
    });
    const publicRaw = createPublicKey(this.key).export({ format: "der", type: "spki" }).subarray(-32);
    this.publicKey = `ed25519:${bs58.encode(publicRaw)}`;
  }
  sign(payload: { message: string; nonce: string; recipient: string }): string {
    return `ed25519:${bs58.encode(sign(null, nep413Digest(payload), this.key))}`;
  }
}

export class FulfilApiClient {
  private cookie = "";
  private loginInFlight?: Promise<void>;

  constructor(
    readonly baseUrl: string,
    readonly accountId: string,
    readonly signer: IntentSigner,
    private readonly http: typeof fetch = fetch,
    private readonly clock: () => number = Date.now,
  ) {
    const url = new URL(baseUrl);
    if (url.username || url.password || url.search || url.hash ||
      (url.protocol !== "https:" && !(url.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(url.hostname)))) {
      throw new Error("FULFIL_API_URL must use HTTPS or local HTTP");
    }
  }

  async request<T>(method: "GET" | "POST", path: string, body?: unknown, retried = false): Promise<T> {
    const sentCookie = this.cookie;
    const response = await fetchWithTimeout(this.http, `${this.baseUrl.replace(/\/$/, "")}/api/v3${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
        ...(this.cookie ? { Cookie: this.cookie } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (response.status === 401 && !retried && !path.startsWith("/auth/")) {
      // A 401 rejects the request before handling, so one retry is safe for POSTs too.
      if (sentCookie === this.cookie) {
        await this.login();
      } else if (this.loginInFlight) {
        await this.loginInFlight;
      }
      return this.request(method, path, body, true);
    }
    if (!response.ok) {
      throw new HttpError(response.status);
    }
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) {
      this.cookie = setCookie.split(";")[0];
    }
    return responseJson<T>(response);
  }

  async login(): Promise<void> {
    if (this.loginInFlight) return this.loginInFlight;
    const login = this.performLogin();
    this.loginInFlight = login;
    try {
      await login;
    } finally {
      if (this.loginInFlight === login) this.loginInFlight = undefined;
    }
  }

  private async performLogin(): Promise<void> {
    const challenge = await this.request<{
      message: string;
      nonce: string;
      recipient: string;
      expires_at: string;
    }>("POST", "/auth/challenge", {});
    this.validateLoginChallenge(challenge);
    await this.request("POST", "/auth/verify", {
      standard: "nep413",
      account_id: this.accountId,
      public_key: this.signer.publicKey,
      signature: this.signer.sign(challenge),
      ...challenge,
    });
  }

  async readIntentsBalance(): Promise<bigint> {
    const me = await this.request<{ intents_balances: Record<string, string> }>("GET", "/me");
    const value = me.intents_balances[ORIGIN_USDC];
    if (typeof value !== "string" || !/^\d+$/.test(value)) {
      throw new Error("Invalid Intents balance");
    }
    return BigInt(value);
  }

  private validateLoginChallenge(challenge: {
    message: string;
    nonce: string;
    recipient: string;
    expires_at: string;
  }): void {
    const intentsContract = process.env.SHOPPER_INTENTS_CONTRACT || "intents.near";
    const configuredRecipient = process.env.SHOPPER_AUTH_RECIPIENT;
    const expectedRecipient = configuredRecipient || new URL(this.baseUrl).host;
    const expectedOrigin = process.env.SHOPPER_AUTH_ORIGIN ||
      (configuredRecipient ? `https://${configuredRecipient}` : new URL(this.baseUrl).origin);
    const maximumLifetime = Number(process.env.SHOPPER_MAX_AUTH_CHALLENGE_MS || 360_000);
    if (!Number.isSafeInteger(maximumLifetime) || maximumLifetime < 1_000 ||
      maximumLifetime > 900_000 ||
      new URL(`https://${expectedRecipient}`).host !== expectedRecipient ||
      new URL(expectedOrigin).host !== expectedRecipient ||
      challenge.recipient !== expectedRecipient || challenge.recipient === intentsContract ||
      typeof challenge.nonce !== "string" ||
      Buffer.from(challenge.nonce, "base64").length !== 32 ||
      Buffer.from(challenge.nonce, "base64").toString("base64") !== challenge.nonce) {
      throw new Error("Unsafe login challenge");
    }
    const match = challenge.message.match(
      /^([^\n]+) wants you to sign in with your wallet:\nFulfil\n\nSign in to Fulfil\.\n\nURI: ([^\n]+)\nVersion: 1\nNonce: ([^\n]+)\nIssued At: ([^\n]+)\nExpiration Time: ([^\n]+)$/,
    );
    const expiresAt = Date.parse(challenge.expires_at);
    const messageExpiry = Date.parse(match?.[5] || "");
    const issuedAt = Date.parse(match?.[4] || "");
    let uri: URL;
    try {
      uri = new URL(match?.[2] || "");
    } catch {
      throw new Error("Unsafe login challenge");
    }
    if (!match || match[1] !== expectedRecipient || uri.origin !== expectedOrigin ||
      match[3] !== challenge.nonce || !Number.isFinite(issuedAt) ||
      !Number.isFinite(expiresAt) || messageExpiry !== expiresAt ||
      issuedAt < this.clock() - maximumLifetime || issuedAt > this.clock() + 60_000 ||
      expiresAt - issuedAt > maximumLifetime || expiresAt <= this.clock() ||
      expiresAt > this.clock() + maximumLifetime) {
      throw new Error("Unsafe login challenge");
    }
  }

  async signAndSubmit(input: Record<string, unknown>): Promise<{ tx_hash?: string; order?: unknown }> {
    const built = await this.request<{
      payload_to_sign: { message: string; nonce: string; recipient: string };
    }>("POST", "/intents/build", input);
    return this.submitBuilt(built, input);
  }

  private validateBuilt(
    built: { payload_to_sign: { message: string; nonce: string; recipient: string } },
    expected: Record<string, unknown>,
  ): void {
    const payload = built.payload_to_sign;
    const intentsContract = process.env.SHOPPER_INTENTS_CONTRACT || "intents.near";
    const escrowContract = process.env.SHOPPER_ESCROW_CONTRACT || "nearfullfil.near";
    const maxWindow = Number(process.env.SHOPPER_MAX_SIGNING_WINDOW_MS || 360_000);
    if (!Number.isSafeInteger(maxWindow) || maxWindow < 1_000 || maxWindow > 900_000) {
      throw new Error("Invalid signing window");
    }
    const data = JSON.parse(payload.message) as Record<string, unknown>;
    const deadline = Date.parse(String(data.deadline));
    if (data.signer_id !== this.accountId || payload.recipient !== intentsContract ||
      (data.verifying_contract !== undefined && data.verifying_contract !== intentsContract) ||
      !Number.isFinite(deadline) || deadline <= this.clock() || deadline > this.clock() + maxWindow ||
      !Array.isArray(data.intents) || data.intents.length !== 1 ||
      typeof payload.nonce !== "string" ||
      Buffer.from(payload.nonce, "base64").length !== 32) {
      throw new Error("Unsafe intent build payload");
    }
    const actual = data.intents[0] as Record<string, unknown>;
    if (expected.kind === "auth_call") {
      if (!["claim", "release_claim", "submit_proof"].includes(String(expected.op)) ||
        typeof expected.order_id !== "string") throw new Error("Unsupported shopper intent");
      const message = JSON.parse(String(actual.msg)) as Record<string, unknown>;
      const expectedMessage: Record<string, unknown> = {
        op: expected.op,
        order_id: expected.order_id,
      };
      if (expected.op === "submit_proof") {
        expectedMessage.proof_sha256 = expected.proof_sha256;
        expectedMessage.spec = expected.spec;
        if (!/^[a-f0-9]{64}$/.test(String(expected.proof_sha256)) ||
          typeof expected.spec !== "string") throw new Error("Invalid expected proof");
      }
      const exact = (a: Record<string, unknown>, b: Record<string, unknown>) =>
        Object.keys(a).length === Object.keys(b).length &&
        Object.keys(b).every((key) => a[key] === b[key]);
      if (!exact(message, expectedMessage) ||
        !exact(actual, {
          intent: "auth_call",
          contract_id: escrowContract,
          msg: actual.msg,
          attached_deposit: "0",
          min_gas: expected.op === "submit_proof" ? "200000000000000" : "20000000000000",
        })) throw new Error("Unsafe intent build payload");
      return;
    }
    if (expected.kind === "transfer") {
      if (expected.token_id !== ORIGIN_USDC ||
        !/^[1-9]\d*$/.test(String(expected.amount)) ||
        typeof expected.receiver_id !== "string") throw new Error("Unsupported shopper transfer");
      if (Object.keys(actual).length !== 3 || actual.intent !== "transfer" ||
        actual.receiver_id !== expected.receiver_id ||
        !actual.tokens || typeof actual.tokens !== "object" ||
        Object.keys(actual.tokens).length !== 1 ||
        (actual.tokens as Record<string, unknown>)[ORIGIN_USDC] !== expected.amount) {
        throw new Error("Unsafe intent build payload");
      }
      return;
    }
    throw new Error("Unsupported shopper intent");
  }

  async submitBuilt(
    built: { payload_to_sign: { message: string; nonce: string; recipient: string } },
    expected: Record<string, unknown>,
  ) {
    this.validateBuilt(built, expected);
    return this.request<{ tx_hash?: string; order?: unknown }>("POST", "/intents/submit", {
      standard: "nep413",
      payload: built.payload_to_sign,
      public_key: this.signer.publicKey,
      signature: this.signer.sign(built.payload_to_sign),
    });
  }
}
