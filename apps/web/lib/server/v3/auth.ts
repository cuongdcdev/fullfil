import {
  createHash,
  createHmac,
  createPublicKey,
  randomBytes,
  timingSafeEqual,
  verify as cryptoVerify,
} from "node:crypto";
import bs58 from "bs58";
import { verifyMessage } from "viem";
import { sql } from "drizzle-orm";
import { db, get, put } from "../db";
import { mode } from "./config";
import { isFullAccessKey, isIntentsPublicKey } from "./rpc";

export type Standard = "nep413" | "erc191";
export type Session = { account_id: string; standard: Standard; exp: number };
type Challenge = {
  nonce: string;
  message: string;
  recipient: string;
  expires_at: number;
  used: boolean;
};
const cookieName = "fulfil_v3_session";
type SessionGlobals = typeof globalThis & {
  __fulfilSessionSecret?: Buffer;
  __fulfilSessionWarningShown?: boolean;
};

function secret(): Buffer {
  if (process.env.SESSION_SECRET)
    return Buffer.from(process.env.SESSION_SECRET);
  if (mode() === "live")
    throw new Error("SESSION_SECRET is required in live mode");
  const shared = globalThis as SessionGlobals;
  if (!shared.__fulfilSessionWarningShown) {
    console.warn(
      "Fulfil v3 mock session secret is process-local; sessions expire on restart.",
    );
    shared.__fulfilSessionWarningShown = true;
  }
  shared.__fulfilSessionSecret ??= randomBytes(32);
  return shared.__fulfilSessionSecret;
}

const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const bytes = (value: string) => Buffer.from(value, "utf8");
const u32 = (value: number) => {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value);
  return buffer;
};
const borshString = (value: string) =>
  Buffer.concat([u32(bytes(value).length), bytes(value)]);

export function nep413Digest(payload: {
  message: string;
  nonce: string;
  recipient: string;
}): Buffer {
  const nonce = Buffer.from(payload.nonce, "base64");
  if (nonce.length !== 32 || nonce.toString("base64") !== payload.nonce)
    throw new Error("Invalid NEP-413 nonce");
  const data = Buffer.concat([
    u32(2 ** 31 + 413),
    borshString(payload.message),
    nonce,
    borshString(payload.recipient),
    Buffer.from([0]),
  ]);
  return createHash("sha256").update(data).digest();
}

export function verifyNep413Signature(
  payload: { message: string; nonce: string; recipient: string },
  publicKey: string,
  signature: string,
): boolean {
  if (!publicKey.startsWith("ed25519:")) return false;
  try {
    const key = Buffer.from(bs58.decode(publicKey.slice(8)));
    const sig = signature.startsWith("ed25519:")
      ? Buffer.from(bs58.decode(signature.slice(8)))
      : Buffer.from(signature, "base64");
    if (key.length !== 32 || sig.length !== 64) return false;
    const spki = Buffer.concat([
      Buffer.from("302a300506032b6570032100", "hex"),
      key,
    ]);
    return cryptoVerify(
      null,
      nep413Digest(payload),
      createPublicKey({ key: spki, format: "der", type: "spki" }),
      sig,
    );
  } catch {
    return false;
  }
}

/** The NEP-413 signer key is valid for the account but intents.near does not know it yet. */
export class IntentsKeyMissingError extends Error {
  constructor(public publicKey: string) {
    super(
      "Your wallet key is not set up for NEAR Intents yet. Enable it once, then sign again.",
    );
    this.name = "IntentsKeyMissingError";
  }
}

/** True when a NEAR RPC error text says an account or public key is unknown. */
export function isMissingKeyRpcError(message: string): boolean {
  return /public.?key[^"]{0,80}(doesn'?t exist|does not exist|not found|unknown|not registered|not exist)|(unknown|invalid|no such|missing)[^"]{0,40}public.?key|public key is not (registered|found)/i.test(
    message,
  );
}

/**
 * Gate for submitting intents to intents.near. Being a FullAccess key on the
 * account is not enough: for named accounts intents.near only accepts keys in
 * its own registry (public_keys_of / add_public_key). Throws
 * IntentsKeyMissingError when the key is not registered.
 */
export async function assertIntentsKeyRegistered(
  accountId: string,
  publicKey: string,
  intentsKey = isIntentsPublicKey,
): Promise<void> {
  let registered: boolean;
  try {
    registered = (await intentsKey(accountId, publicKey)) === true;
  } catch (e) {
    if (e instanceof Error && isMissingKeyRpcError(e.message))
      registered = false;
    else throw e;
  }
  if (!registered) throw new IntentsKeyMissingError(publicKey);
}

export async function isAuthorizedNearKey(
  accountId: string,
  publicKey: string,
  fullAccess = isFullAccessKey,
  intentsKey = isIntentsPublicKey,
): Promise<boolean> {
  try {
    if (await fullAccess(accountId, publicKey)) return true;
  } catch {
    // A missing access key is expected for an intents-only signer.
  }
  try {
    return (await intentsKey(accountId, publicKey)) === true;
  } catch {
    return false;
  }
}

export function createChallenge(): {
  nonce: string;
  message: string;
  recipient: string;
  expires_at: string;
} {
  db.run(sql`
    DELETE FROM records
    WHERE kind = 'v3:challenge'
      AND json_extract(value, '$.expires_at') <= ${Date.now()}
  `);
  const nonce = randomBytes(32).toString("base64");
  const base = new URL(
    process.env.PUBLIC_BASE_URL || "http://localhost:3000",
  );
  const recipient = base.host;
  const issuedAt = new Date().toISOString();
  const expiresAt = Date.now() + 5 * 60_000;
  const message = `${recipient} wants you to sign in with your wallet:\nFulfil\n\nSign in to Fulfil.\n\nURI: ${base.origin}\nVersion: 1\nNonce: ${nonce}\nIssued At: ${issuedAt}\nExpiration Time: ${new Date(expiresAt).toISOString()}`;
  put(`v3:challenge:${digest(message)}`, "v3:challenge", {
    nonce,
    message,
    recipient,
    expires_at: expiresAt,
    used: false,
  } satisfies Challenge);
  return {
    nonce,
    message,
    recipient,
    expires_at: new Date(expiresAt).toISOString(),
  };
}

export async function verifyLogin(
  input: Record<string, unknown>,
  fullAccess = isFullAccessKey,
  intentsKey = isIntentsPublicKey,
): Promise<Session> {
  const message = String(input.message || "");
  const key = `v3:challenge:${digest(message)}`;
  const challenge = get<Challenge>(key);
  if (
    !challenge ||
    challenge.used ||
    challenge.expires_at < Date.now() ||
    challenge.message !== message
  ) {
    throw new Error("Invalid, expired, or used challenge");
  }
  const domain = new URL(process.env.PUBLIC_BASE_URL || "http://localhost:3000").host;
  if (challenge.recipient !== domain || !message.startsWith(`${domain} wants you to sign in with your wallet:`)) {
    throw new Error("Login domain mismatch");
  }
  // Reserve before awaiting cryptographic or RPC work. SQLite makes this
  // conditional update atomic across Next workers; an invalid attempt consumes
  // the challenge, which avoids an authentication replay race.
  const reservation = db.run(sql`
    UPDATE records
    SET value = json_set(value, '$.used', 1)
    WHERE key = ${key}
      AND kind = 'v3:challenge'
      AND json_extract(value, '$.used') = 0
      AND json_extract(value, '$.expires_at') > ${Date.now()}
  `) as { changes?: number };
  if (reservation.changes !== 1)
    throw new Error("Invalid, expired, or used challenge");
  let accountId: string;
  let standard: Standard;
  if (input.standard === "nep413") {
    const publicKey = String(input.public_key || "");
    const nonce = String(input.nonce || "");
    const recipient = String(input.recipient || "");
    accountId = String(input.account_id || "");
    if (
      nonce !== challenge.nonce ||
      recipient !== challenge.recipient ||
      !verifyNep413Signature(
        { message, nonce, recipient },
        publicKey,
        String(input.signature || ""),
      )
    )
      throw new Error("Invalid NEP-413 signature");
    const implicit = /^[a-f0-9]{64}$/.test(accountId);
    const implicitMatches =
      implicit &&
      Buffer.from(bs58.decode(publicKey.slice(8))).toString("hex") ===
        accountId;
    if (
      !implicitMatches &&
      !(await isAuthorizedNearKey(accountId, publicKey, fullAccess, intentsKey))
    )
      throw new Error("NEAR key is not FullAccess or registered on intents.near");
    standard = "nep413";
  } else if (input.standard === "erc191") {
    accountId = String(input.address || "").toLowerCase();
    if (
      !/^0x[a-f0-9]{40}$/.test(accountId) ||
      !(await verifyMessage({
        address: accountId as `0x${string}`,
        message,
        signature: String(input.signature || "") as `0x${string}`,
      }))
    )
      throw new Error("Invalid ERC-191 signature");
    standard = "erc191";
  } else throw new Error("Unsupported signing standard");
  return {
    account_id: accountId,
    standard,
    exp: Date.now() + 24 * 60 * 60_000,
  };
}

export function signSession(session: Session): string {
  const body = Buffer.from(JSON.stringify(session)).toString("base64url");
  const signature = createHmac("sha256", secret())
    .update(body)
    .digest("base64url");
  return `${body}.${signature}`;
}

export function readSession(token: string | undefined): Session | undefined {
  if (!token) return undefined;
  const [body, signature, extra] = token.split(".");
  if (!body || !signature || extra) return undefined;
  const expected = createHmac("sha256", secret()).update(body).digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    return undefined;
  try {
    const session = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as Session;
    if (
      !session.account_id ||
      !["nep413", "erc191"].includes(session.standard) ||
      session.exp <= Date.now()
    )
      return undefined;
    return session;
  } catch {
    return undefined;
  }
}

export function sessionFromRequest(request: Request): Session | undefined {
  const token = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`))
    ?.slice(cookieName.length + 1);
  return readSession(token);
}

export function cookieHeader(session?: Session): string {
  const attributes = [
    `${cookieName}=${session ? signSession(session) : ""}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (process.env.NODE_ENV === "production") attributes.push("Secure");
  if (!session) attributes.push("Max-Age=0");
  return attributes.join("; ");
}

export function bearerMatches(
  request: Request,
  configured: string | undefined,
): boolean | undefined {
  if (!configured) return undefined;
  const supplied =
    request.headers.get("authorization")?.replace(/^Bearer /i, "") || "";
  const a = Buffer.from(supplied);
  const b = Buffer.from(configured);
  return a.length === b.length && timingSafeEqual(a, b);
}
