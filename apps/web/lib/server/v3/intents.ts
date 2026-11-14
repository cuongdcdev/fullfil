import { createHash, randomBytes } from "node:crypto";
import bs58 from "bs58";
import { recoverMessageAddress } from "viem";
import { sql } from "drizzle-orm";
import { db, get, put } from "../db";
import { assertIntentsKeyRegistered, type Session, verifyNep413Signature } from "./auth";
import { escrowContract, intentsContract, mode, USDC_TOKEN } from "./config";
import { isIntentsPublicKey, view } from "./rpc";

export type Intent = Record<string, unknown> & { intent: string };
type Issued = {
  account_id: string;
  expires: number;
  used: boolean;
  payload_hash: string;
  standard: string;
};
const amount = (value: unknown) => {
  const result = String(value ?? "");
  if (!/^[1-9]\d*$/.test(result))
    throw new Error("Amount must be a positive integer string");
  return result;
};
const string = (value: unknown, name: string) => {
  if (typeof value !== "string" || !value || value.length > 1000)
    throw new Error(`Invalid ${name}`);
  return value;
};

export function intentFromInput(input: Record<string, unknown>): Intent {
  if (input.kind === "fund") {
    const order = input.order as Record<string, unknown>;
    if (!order || !/^[A-Z0-9-]{6,16}$/.test(String(order.id)))
      throw new Error("Invalid order id");
    const payAmount = amount(order.pay_amount);
    const reward = String(order.reward ?? "");
    if (!/^\d+$/.test(reward) || !/^[a-f0-9]{64}$/.test(String(order.spec_hash)) ||
      !["bank_transfer", "cryptorefills_topup", "cryptorefills_code", "in_person", "token_buy"].includes(String(order.kind)))
      throw new Error("Invalid order parameters");
    const fundOrder = {
      id: order.id,
      kind: order.kind,
      spec_hash: order.spec_hash,
      pay_amount: payAmount,
      reward,
      deadline_ns: String(order.deadline_ns),
      ...(order.quoted_by ? { quoted_by: string(order.quoted_by, "quoted_by") } : {}),
    };
    const message = { op: "fund", order: fundOrder,
      ...(["in_person", "token_buy"].includes(String(order.kind)) ? { spec: string(input.spec, "spec") } : {}) };
    if (!/^\d+$/.test(fundOrder.deadline_ns))
      throw new Error("Invalid order parameters");
    return {
      intent: "transfer",
      receiver_id: escrowContract(),
      tokens: { [USDC_TOKEN]: (BigInt(payAmount) + BigInt(reward)).toString() },
      msg: JSON.stringify(message),
    };
  }
  if (input.kind === "bond")
    return {
      intent: "transfer",
      receiver_id: escrowContract(),
      tokens: { [USDC_TOKEN]: amount(input.amount) },
      msg: JSON.stringify({ op: "bond" }),
    };
  if (input.kind === "transfer")
    return {
      intent: "transfer",
      receiver_id: string(input.receiver_id, "receiver_id"),
      tokens: { [string(input.token_id, "token_id")]: amount(input.amount) },
    };
  if (input.kind === "ft_withdraw")
    return {
      intent: "ft_withdraw",
      token: string(input.token, "token"),
      receiver_id: string(input.receiver_id, "receiver_id"),
      amount: amount(input.amount),
    };
  if (input.kind === "auth_call") {
    const op = string(input.op, "op");
    const fields: Record<string, string[]> = {
      register_fulfiller: [],
      claim: ["order_id"],
      release_claim: ["order_id"],
      sent: ["order_id"],
      submit_proof: ["order_id", "proof_sha256"],
      confirm_delivery: ["order_id", "secret_hex"],
      cancel: ["order_id"],
      dispute: ["order_id", "reason_code"],
      rate: ["order_id", "stars"],
      withdraw_bond: ["amount"],
    };
    if (!fields[op]) throw new Error("Unsupported auth_call op");
    const msg: Record<string, unknown> = { op };
    if (op === "register_fulfiller") {
      if (input.bank_bin !== undefined) msg.bank_bin = string(input.bank_bin, "bank_bin");
      if (input.account_last4 !== undefined) msg.account_last4 = string(input.account_last4, "account_last4");
    }
    for (const field of fields[op]) {
      msg[field] =
        field === "stars" || field === "reason_code"
          ? Number(input[field])
          : field === "secret_hex" && typeof input[field] === "string" &&
              (input[field] as string).length <= 1_000
            ? input[field]
            : string(input[field], field);
    }
    if (
      op === "rate" &&
      (!Number.isInteger(msg.stars) ||
        Number(msg.stars) < 1 ||
        Number(msg.stars) > 5)
    )
      throw new Error("Invalid stars");
    if (op === "withdraw_bond") msg.amount = amount(msg.amount);
    if (
      op === "dispute" &&
      (!Number.isInteger(msg.reason_code) ||
        Number(msg.reason_code) < 0 ||
        Number(msg.reason_code) > 255)
    )
      throw new Error("Invalid reason_code");
    if (op === "submit_proof") {
      if (!/^[a-f0-9]{64}$/.test(String(msg.proof_sha256))) throw new Error("Invalid proof_sha256");
      const stored = get<{ spec: string }>(`v3:spec:${String(msg.order_id)}`);
      if (!stored) throw new Error("Order spec not found");
      msg.spec = stored.spec;
    }
    return {
      intent: "auth_call",
      contract_id: escrowContract(),
      msg: JSON.stringify(msg),
      attached_deposit: "0",
      min_gas:
        op === "submit_proof" ? "200000000000000" :
          op === "confirm_delivery" ? "80000000000000" : "20000000000000",
    };
  }
  throw new Error("Unsupported intent kind");
}

async function currentSalt(): Promise<Buffer> {
  if (mode() === "mock") return Buffer.alloc(4);
  const salt = await view<string>(intentsContract(), "current_salt");
  if (!/^[a-fA-F0-9]{8}$/.test(salt))
    throw new Error("Invalid intents current_salt");
  return Buffer.from(salt, "hex");
}

/** Defuse VersionedNonceBuilder: magic, version, salt, deadline ns, entropy. */
export function encodeVersionedNonce(
  salt: Buffer,
  deadline: string,
  entropy: Buffer = randomBytes(15),
): string {
  const deadlineMs = Date.parse(deadline);
  if (
    salt.length !== 4 ||
    entropy.length !== 15 ||
    !Number.isFinite(deadlineMs)
  ) {
    throw new Error("Invalid nonce inputs");
  }
  const result = Buffer.alloc(32);
  Buffer.from("5628f6c600", "hex").copy(result, 0);
  salt.copy(result, 5);
  result.writeBigUInt64LE(BigInt(deadlineMs) * BigInt(1_000_000), 9);
  entropy.copy(result, 17);
  return result.toString("base64");
}

export async function buildPayload(
  session: Session,
  intents: Intent[],
  fixed?: { nonce?: string; deadline?: string },
) {
  const deadline =
    fixed?.deadline || new Date(Date.now() + 5 * 60_000).toISOString();
  if (
    !Number.isFinite(Date.parse(deadline)) ||
    Date.parse(deadline) <= Date.now()
  )
    throw new Error("Expired or invalid intent deadline");
  const nonce =
    fixed?.nonce || encodeVersionedNonce(await currentSalt(), deadline);
  if (Buffer.from(nonce, "base64").length !== 32)
    throw new Error("Invalid intent nonce");
  const common = { signer_id: session.account_id, deadline, intents };
  const message = JSON.stringify(
    session.standard === "nep413"
      ? common
      : {
          signer_id: session.account_id,
          verifying_contract: intentsContract(),
          deadline,
          nonce,
          intents,
        },
  );
  const payload_to_sign =
    session.standard === "nep413"
      ? { message, nonce, recipient: intentsContract() }
      : message;
  put(`v3:intent:${nonce}`, "v3:intent", {
    account_id: session.account_id,
    expires: Date.parse(deadline),
    used: false,
    payload_hash: createHash("sha256").update(message).digest("hex"),
    standard: session.standard,
  } satisfies Issued);
  return {
    standard: session.standard,
    payload_to_sign,
    nonce,
    deadline,
    intents,
  };
}

/**
 * NEP-413 wallets return the signature as base64 (per the standard) or as
 * "ed25519:<base58>". intents.near needs the latter. Returns null if invalid.
 */
export function nep413SignatureToNear(signature: string): string | null {
  if (signature.startsWith("ed25519:")) return signature;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(signature)) return null;
  const bytes = Buffer.from(signature, "base64");
  return bytes.length === 64 ? `ed25519:${bs58.encode(bytes)}` : null;
}

export function encodeErc191Signature(hex: string): string {
  if (!/^0x[0-9a-fA-F]{130}$/.test(hex))
    throw new Error("Invalid EVM signature");
  const bytes = Buffer.from(hex.slice(2), "hex");
  let v = bytes[64];
  if (v >= 35) v = (v - 35) % 2;
  else if (v >= 27) v -= 27;
  if (v !== 0 && v !== 1) throw new Error("Invalid recovery id");
  bytes[64] = v;
  return `secp256k1:${bs58.encode(bytes)}`;
}

function erc191Hex(signature: string): `0x${string}` {
  if (signature.startsWith("0x")) return signature as `0x${string}`;
  if (!signature.startsWith("secp256k1:"))
    throw new Error("Invalid ERC-191 signature encoding");
  const bytes = Buffer.from(bs58.decode(signature.slice(10)));
  if (bytes.length !== 65 || bytes[64] > 1)
    throw new Error("Invalid ERC-191 signature bytes");
  bytes[64] += 27;
  return `0x${bytes.toString("hex")}`;
}

export async function validateSignedPayload(
  session: Session,
  signed: Record<string, unknown>,
  intentsKey = isIntentsPublicKey,
): Promise<Record<string, unknown>> {
  if (signed.standard !== session.standard)
    throw new Error("Signing standard mismatch");
  let message: string;
  let nonce: string;
  let normalized: Record<string, unknown>;
  if (session.standard === "nep413") {
    const payload = signed.payload as {
      message?: string;
      nonce?: string;
      recipient?: string;
    };
    if (
      !payload ||
      payload.recipient !== intentsContract() ||
      !payload.message ||
      !payload.nonce
    )
      throw new Error("Invalid NEP-413 payload");
    message = payload.message;
    nonce = payload.nonce;
    const publicKey = String(signed.public_key || "");
    const signature = nep413SignatureToNear(String(signed.signature || ""));
    if (
      !signature ||
      !verifyNep413Signature(
        { message, nonce, recipient: payload.recipient },
        publicKey,
        signature,
      )
    )
      throw new Error("Invalid intent signature");
    const implicitMatches =
      /^[a-f0-9]{64}$/.test(session.account_id) &&
      Buffer.from(bs58.decode(publicKey.slice(8))).toString("hex") ===
        session.account_id;
    // FullAccess on the account is not enough here: intents.near only honours
    // keys registered in its own registry (add_public_key), except implicit accounts.
    if (!implicitMatches)
      await assertIntentsKeyRegistered(session.account_id, publicKey, intentsKey);
    normalized = { ...signed, signature };
  } else {
    message = String(signed.payload || "");
    const signature = String(signed.signature || "");
    const address = await recoverMessageAddress({
      message,
      signature: erc191Hex(signature),
    });
    if (address.toLowerCase() !== session.account_id)
      throw new Error("Intent signer mismatch");
    normalized = {
      standard: "erc191",
      payload: message,
      signature: signature.startsWith("0x")
        ? encodeErc191Signature(signature)
        : signature,
    };
    nonce = String((JSON.parse(message) as { nonce?: string }).nonce || "");
  }
  const data = JSON.parse(message) as {
    signer_id?: string;
    verifying_contract?: string;
    deadline?: string;
    nonce?: string;
    intents?: Intent[];
  };
  if (data.signer_id?.toLowerCase() !== session.account_id.toLowerCase())
    throw new Error("Intent signer mismatch");
  if (
    session.standard === "erc191" &&
    (data.verifying_contract !== intentsContract() || data.nonce !== nonce)
  )
    throw new Error("Invalid verifier binding");
  if (
    !data.deadline ||
    Date.parse(data.deadline) <= Date.now() ||
    !Array.isArray(data.intents) ||
    !data.intents.length
  )
    throw new Error("Expired or empty intent");
  const issued = get<Issued>(`v3:intent:${nonce}`);
  if (
    !issued ||
    issued.used ||
    issued.expires <= Date.now() ||
    issued.account_id !== session.account_id ||
    issued.payload_hash !== createHash("sha256").update(message).digest("hex") ||
    issued.standard !== session.standard
  )
    throw new Error("Intent was not issued or was already used");
  const reservation = db.run(sql`
    UPDATE records
    SET value = json_set(value, '$.used', 1)
    WHERE key = ${`v3:intent:${nonce}`}
      AND kind = 'v3:intent'
      AND json_extract(value, '$.used') = 0
      AND json_extract(value, '$.expires') > ${Date.now()}
      AND json_extract(value, '$.account_id') = ${session.account_id}
      AND json_extract(value, '$.standard') = ${session.standard}
      AND json_extract(value, '$.payload_hash') = ${issued.payload_hash}
  `) as { changes?: number };
  if (reservation.changes !== 1)
    throw new Error("Intent was not issued or was already used");
  return normalized;
}
