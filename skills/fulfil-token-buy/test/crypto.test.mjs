import assert from "node:assert/strict";
import { createHash, createPublicKey, verify } from "node:crypto";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { actions, baseDecode, baseEncode, createTransaction, encodeTransaction,
  KeyPair, KeyPairSigner, PublicKey } from "near-api-js";
import { AgentSigner, loadSigner } from "../src/keys.mjs";

function oldNep413Digest(payload) {
  const u32 = (value) => {
    const bytes = Buffer.alloc(4);
    bytes.writeUInt32LE(value);
    return bytes;
  };
  const string = (value) => {
    const bytes = Buffer.from(value);
    return Buffer.concat([u32(bytes.length), bytes]);
  };
  return createHash("sha256").update(Buffer.concat([
    u32(2 ** 31 + 413), string(payload.message), Buffer.from(payload.nonce, "base64"),
    string(payload.recipient), Buffer.from([0]),
  ])).digest();
}

test("Borsh transaction bytes match a manually laid out known answer", () => {
  const transaction = createTransaction(
    "a", PublicKey.fromString(`ed25519:${baseEncode(Buffer.alloc(32))}`), "b", 1n,
    [actions.functionCall("x", Buffer.from([0x0a, 0x0b]), 2n, 3n), actions.transfer(4n)],
    Buffer.alloc(32, 0x11),
  );
  const expected = [
    "0100000061", // signer_id string
    "00", "00".repeat(32), // Ed25519 public key
    "0100000000000000", // nonce u64
    "0100000062", // receiver_id string
    "11".repeat(32), // block hash
    "02000000", // two actions
    "02", "0100000078", "020000000a0b", "0200000000000000", "03000000000000000000000000000000",
    "03", "04000000000000000000000000000000",
  ].join("");
  assert.equal(Buffer.from(encodeTransaction(transaction)).toString("hex"), expected);
  assert.equal(baseDecode(baseEncode(Buffer.alloc(32))).length, 32);
});

test("near-api-js transaction signing matches the Borsh transaction hash", async () => {
  const signer = new AgentSigner(`ed25519:${baseEncode(Buffer.alloc(32, 7))}`);
  const tx = createTransaction("agent.near", KeyPair.fromString(`ed25519:${baseEncode(Buffer.alloc(32, 7))}`).getPublicKey(),
    "token.near", 10n, [actions.transfer(1n)], Buffer.alloc(32, 3));
  const signed = await new KeyPairSigner(signer.keyPair).signTransaction(tx);
  assert.equal(Buffer.from(signed.signedTransaction.encode()).length, Buffer.from(encodeTransaction(tx)).length + 65);
  assert.equal(Buffer.from(signed.txHash).toString("hex"), createHash("sha256").update(encodeTransaction(tx)).digest("hex"));
});

test("NEP-413 signature verifies against the independent legacy digest", async () => {
  const signer = new AgentSigner(`ed25519:${baseEncode(Buffer.alloc(32, 9))}`);
  const payload = { message: "synthetic login", nonce: Buffer.alloc(32, 1).toString("base64"), recipient: "fulfil.example" };
  const publicKey = createPublicKey({
    key: Buffer.concat([
      Buffer.from("302a300506032b6570032100", "hex"),
      baseDecode(signer.publicKey.slice(8)),
    ]),
    format: "der",
    type: "spki",
  });
  const signature = baseDecode((await signer.signNep413(payload)).slice(8));
  assert.equal(verify(null, oldNep413Digest(payload), publicKey, signature), true);
});

test("credential fallback reads only a synthetic key under a temporary home", async () => {
  const home = await mkdtemp(join(tmpdir(), "fulfil-key-test-"));
  const directory = join(home, ".near-credentials", "mainnet");
  await mkdir(directory, { recursive: true });
  const secret = `ed25519:${baseEncode(Buffer.alloc(32, 13))}`;
  await writeFile(join(directory, "synthetic.near.json"), JSON.stringify({ private_key: secret }), { mode: 0o600 });
  const signer = await loadSigner("synthetic.near", {}, home);
  assert.ok(signer.publicKey.startsWith("ed25519:"));
  assert.notEqual(signer.publicKey, secret);
});

test("64-byte key suffix must match the derived public key", () => {
  const malformed = Buffer.concat([Buffer.alloc(32, 15), Buffer.alloc(32, 16)]);
  assert.throws(() => new AgentSigner(`ed25519:${baseEncode(malformed)}`), { code: "invalid_key" });
});
