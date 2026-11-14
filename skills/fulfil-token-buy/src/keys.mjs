import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { baseDecode, baseEncode, KeyPair, KeyPairSigner } from "near-api-js";
import { fail } from "./common.mjs";

export class AgentSigner {
  constructor(secret) {
    if (typeof secret !== "string" || !secret.startsWith("ed25519:")) {
      fail("invalid_key", "Expected ed25519 private key");
    }
    let raw;
    try {
      raw = baseDecode(secret.slice(8));
    } catch {
      fail("invalid_key", "Invalid ed25519 private key encoding");
    }
    if (raw.length !== 32 && raw.length !== 64) {
      fail("invalid_key", "Invalid ed25519 private key length");
    }
    try {
      this.keyPair = KeyPair.fromString(secret);
    } catch {
      fail("invalid_key", "Invalid ed25519 private key");
    }
    const publicKey = this.keyPair.getPublicKey();
    if (raw.length === 64 && !Buffer.from(raw.subarray(32)).equals(Buffer.from(publicKey.data))) {
      fail("invalid_key", "Secret public-key suffix does not match seed");
    }
    this.publicKey = publicKey.toString();
    this.keyPairSigner = new KeyPairSigner(this.keyPair);
  }

  async signNep413(payload) {
    const nonce = Buffer.from(payload.nonce || "", "base64");
    if (nonce.length !== 32 || nonce.toString("base64") !== payload.nonce) {
      fail("invalid_nonce", "Invalid NEP-413 nonce");
    }
    const signed = await this.keyPairSigner.signNep413Message("", {
      message: payload.message,
      recipient: payload.recipient,
      nonce,
    });
    return `ed25519:${baseEncode(signed.signature)}`;
  }
}

export async function loadSigner(accountId, env = process.env, home = homedir()) {
  let secret = env.NEAR_PRIVATE_KEY;
  if (!secret) {
    if (!/^[a-z0-9._-]+$/.test(accountId) || accountId.includes("..")) {
      fail("invalid_account", "Invalid NEAR account ID");
    }
    const credential = JSON.parse(await readFile(join(home, ".near-credentials", "mainnet", `${accountId}.json`), "utf8"));
    secret = credential.private_key || credential.secret_key;
  }
  return new AgentSigner(secret);
}
