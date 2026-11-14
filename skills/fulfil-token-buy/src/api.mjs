import { readFile, rename, stat, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AgentError, fail, sha256Hex, USER_AGENT } from "./common.mjs";

export class FulfilApi {
  constructor({ baseUrl = "https://fulfil.junstudio.xyz", accountId, signer, fetchImpl = fetch,
    clock = Date.now, escrowContract = "nearfullfil.near", intentsContract = "intents.near",
    cacheDir = tmpdir() }) {
    const url = new URL(baseUrl);
    if (url.username || url.password || url.search || url.hash || url.pathname !== "/" ||
        (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))) {
      fail("invalid_config", "FULFIL_API must be HTTPS or local HTTP");
    }
    this.baseUrl = url.origin;
    this.accountId = accountId;
    this.signer = signer;
    this.fetch = fetchImpl;
    this.clock = clock;
    this.escrowContract = escrowContract;
    this.intentsContract = intentsContract;
    this.cachePath = join(cacheDir, `fulfil-session-${sha256Hex(`${this.baseUrl}|${accountId}`)}.json`);
    this.cookie = "";
    this.expiresAt = 0;
  }

  async loadCookie() {
    try {
      const file = await stat(this.cachePath);
      if (!file.isFile() || (file.mode & 0o077) !== 0) return;
      const cached = JSON.parse(await readFile(this.cachePath, "utf8"));
      if (cached.expiresAt > this.clock() + 10_000 && /^fulfil_v3_session=[^;]+$/.test(cached.cookie)) {
        this.cookie = cached.cookie;
        this.expiresAt = cached.expiresAt;
      }
    } catch {
      // An absent or stale cache is normal.
    }
  }

  async request(method, path, body, retried = false) {
    if (!/^\/[a-zA-Z0-9_/?=&.%-]+$/.test(path) || path.includes("..")) fail("invalid_path", "Invalid API path");
    const response = await this.fetch(`${this.baseUrl}/api/v3${path}`, {
      method,
      headers: {
        "Content-Type": "application/json", "User-Agent": USER_AGENT,
        ...(this.cookie ? { Cookie: this.cookie } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (response.status === 401 && !retried && !path.startsWith("/auth/")) {
      if (!this.signer) fail("auth_required", "Session expired; signing key required for login");
      await this.login();
      return this.request(method, path, body, true);
    }
    if (!response.ok) {
      let code = `api_http_${response.status}`;
      let message = `Fulfil API returned HTTP ${response.status}`;
      try {
        const problem = await response.json();
        if (typeof problem?.error?.code === "string" && /^[a-zA-Z0-9_]{1,80}$/.test(problem.error.code)) {
          code = problem.error.code;
        }
        if (typeof problem?.error?.message === "string" && problem.error.message.length <= 500 &&
            !/ed25519:|fulfil_v3_session=|private.key|secret.key/i.test(problem.error.message)) {
          message = problem.error.message;
        }
      } catch {
        // The response may not be JSON.
      }
      const error = new AgentError(code, message);
      error.http_status = response.status;
      throw error;
    }
    const setCookie = response.headers.get("set-cookie");
    if (setCookie?.startsWith("fulfil_v3_session=")) this.cookie = setCookie.split(";")[0];
    return response.json();
  }

  validateChallenge(challenge) {
    const expected = new URL(this.baseUrl);
    const match = challenge.message?.match(/^([^\n]+) wants you to sign in with your wallet:\nFulfil\n\nSign in to Fulfil\.\n\nURI: ([^\n]+)\nVersion: 1\nNonce: ([^\n]+)\nIssued At: ([^\n]+)\nExpiration Time: ([^\n]+)$/);
    const nonce = Buffer.from(challenge.nonce || "", "base64");
    let origin;
    try {
      origin = new URL(match?.[2]).origin;
    } catch {
      fail("unsafe_challenge", "Invalid Fulfil login URI");
    }
    const issued = Date.parse(match?.[4]);
    const expiry = Date.parse(challenge.expires_at);
    if (!match || match[1] !== expected.host || origin !== expected.origin ||
        challenge.recipient !== expected.host || challenge.recipient === this.intentsContract ||
        match[3] !== challenge.nonce || nonce.length !== 32 || nonce.toString("base64") !== challenge.nonce ||
        Date.parse(match[5]) !== expiry || !Number.isFinite(issued) || !Number.isFinite(expiry) ||
        issued < this.clock() - 360_000 || issued > this.clock() + 60_000 ||
        expiry <= this.clock() || expiry - issued > 360_000 || expiry > this.clock() + 360_000) {
      fail("unsafe_challenge", "Unsafe Fulfil login challenge");
    }
  }

  async login() {
    if (!this.signer) fail("auth_required", "Signing key required for login");
    this.cookie = "";
    const challenge = await this.request("POST", "/auth/challenge", {});
    this.validateChallenge(challenge);
    const session = await this.request("POST", "/auth/verify", {
      standard: "nep413", account_id: this.accountId,
      public_key: this.signer.publicKey, signature: await this.signer.signNep413(challenge),
      message: challenge.message, nonce: challenge.nonce, recipient: challenge.recipient,
    });
    const expiresAt = Date.parse(session.expires_at);
    if (!this.cookie || !Number.isFinite(expiresAt) || expiresAt <= this.clock()) fail("auth_failed", "Fulfil login did not issue a valid session");
    this.expiresAt = expiresAt;
    const temporary = `${this.cachePath}.${randomUUID()}`;
    await writeFile(temporary, JSON.stringify({ cookie: this.cookie, expiresAt }), { mode: 0o600, flag: "wx" });
    await rename(temporary, this.cachePath);
  }

  validateBuilt(built, expected) {
    const payload = built?.payload_to_sign;
    if (built?.standard !== undefined && built.standard !== "nep413") fail("unsafe_intent", "Unsupported intent signing standard");
    if (!payload || typeof payload.message !== "string" || typeof payload.recipient !== "string") fail("unsafe_intent", "Invalid intent build");
    let data;
    try {
      data = JSON.parse(payload.message);
    } catch {
      fail("unsafe_intent", "Invalid intent message");
    }
    const deadline = Date.parse(data.deadline);
    const nonce = Buffer.from(payload.nonce || "", "base64");
    if (payload.recipient !== this.intentsContract || data.signer_id !== this.accountId ||
        (data.verifying_contract !== undefined && data.verifying_contract !== this.intentsContract) ||
        !Number.isFinite(deadline) || deadline <= this.clock() || deadline > this.clock() + 360_000 ||
        nonce.length !== 32 || nonce.toString("base64") !== payload.nonce ||
        !Array.isArray(data.intents) || data.intents.length !== 1) fail("unsafe_intent", "Unsafe intent build");
    const intent = data.intents[0];
    let message;
    try {
      message = JSON.parse(intent.msg);
    } catch {
      fail("unsafe_intent", "Invalid auth_call message");
    }
    const expectedMessage = expected.op === "register_fulfiller"
      ? { op: expected.op }
      : { op: expected.op, order_id: expected.order_id };
    if (expected.op === "submit_proof") {
      expectedMessage.proof_sha256 = expected.proof_sha256;
      expectedMessage.spec = expected.spec;
    }
    const exact = (actual, target) => actual && typeof actual === "object" &&
      Object.keys(actual).length === Object.keys(target).length &&
      Object.keys(target).every((key) => actual[key] === target[key]);
    if (!exact(message, expectedMessage) || !exact(intent, {
      intent: "auth_call", contract_id: this.escrowContract, msg: intent.msg,
      attached_deposit: "0", min_gas: expected.op === "submit_proof" ? "200000000000000" : "20000000000000",
    })) fail("unsafe_intent", "Intent build differs from requested operation");
    return payload;
  }

  async authCall(op, orderId, extras = {}) {
    if (!["register_fulfiller", "claim", "release_claim", "submit_proof"].includes(op)) fail("unsupported_intent", "Unsupported auth_call");
    const { spec, ...buildExtras } = extras;
    const request = op === "register_fulfiller"
      ? { kind: "auth_call", op }
      : { kind: "auth_call", op, order_id: orderId, ...buildExtras };
    const built = await this.request("POST", "/intents/build", request);
    const payload = this.validateBuilt(built, { ...request, spec });
    if (!this.signer) fail("auth_required", "Signing key required for intent submission");
    return this.request("POST", "/intents/submit", {
      standard: "nep413", payload, public_key: this.signer.publicKey,
      signature: await this.signer.signNep413(payload),
    });
  }
}
