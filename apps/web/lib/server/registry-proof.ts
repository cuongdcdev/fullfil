import { createHash, createPublicKey, verify as cryptoVerify } from "node:crypto";
import bs58 from "bs58";
import { canonicalJson, sha256Hex } from "../../../../packages/core/src/spec";

export type RegistryEntry = {
  account_id: string;
  name: string;
  kinds: string[];
  operator: string;
  repo_url?: string;
  description: string;
  official: boolean;
  proof: { public_key: string; signature: string; message: string; nonce: string };
};

export function registryMessage(entry: Omit<RegistryEntry, "proof">): string {
  return `fulfil-registry:${entry.account_id}:${sha256Hex(canonicalJson(entry))}`;
}

function u32(value: number): Buffer {
  const bytes = Buffer.alloc(4);
  bytes.writeUInt32LE(value);
  return bytes;
}

function borshString(value: string): Buffer {
  const bytes = Buffer.from(value, "utf8");
  return Buffer.concat([u32(bytes.length), bytes]);
}

function registryDigest(message: string, nonceValue: string): Buffer {
  const nonce = Buffer.from(nonceValue, "base64");
  if (nonce.length !== 32 || nonce.toString("base64") !== nonceValue) {
    throw new Error("Invalid NEP-413 nonce");
  }
  const bytes = Buffer.concat([
    u32(2 ** 31 + 413),
    borshString(message),
    nonce,
    borshString("fulfil-registry"),
    Buffer.from([0]),
  ]);
  return createHash("sha256").update(bytes).digest();
}

export function verifyRegistryProof(entry: RegistryEntry): boolean {
  const { proof, ...unsigned } = entry;
  if (proof.message !== registryMessage(unsigned)) return false;
  if (!proof.public_key.startsWith("ed25519:") ||
    !proof.signature.startsWith("ed25519:")) return false;
  try {
    const key = Buffer.from(bs58.decode(proof.public_key.slice(8)));
    const signature = Buffer.from(bs58.decode(proof.signature.slice(8)));
    if (key.length !== 32 || signature.length !== 64) return false;
    const spki = Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), key]);
    return cryptoVerify(null, registryDigest(proof.message, proof.nonce),
      createPublicKey({ key: spki, format: "der", type: "spki" }), signature);
  } catch {
    return false;
  }
}
