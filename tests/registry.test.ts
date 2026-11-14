import { describe, expect, it, vi } from "vitest";
import { generateKeyPairSync, sign } from "node:crypto";
import bs58 from "bs58";
import { nep413Digest } from "../apps/shopper/src/api";
import { registryMessage, validateRegistry, verifyRegistryProof, type RegistryEntry } from "../scripts/validate-registry";
import { officialFulfiller, registryEntryVerified } from "../apps/web/lib/server/v3/fulfiller-status";

function signedEntry(withRepo = true): RegistryEntry {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const unsigned = { account_id: "synthetic.near", name: "Synthetic", kinds: ["cryptorefills_topup"],
    operator: "bot", ...(withRepo ? { repo_url: "https://example.com/repo" } : {}),
    description: "Synthetic test bot", official: false };
  const message = registryMessage(unsigned);
  const nonce = Buffer.alloc(32, 7).toString("base64");
  const signature = sign(null, nep413Digest({ message, nonce, recipient: "fulfil-registry" }), privateKey);
  return { ...unsigned, proof: { public_key: `ed25519:${bs58.encode(publicKey.export({ format: "der", type: "spki" }).subarray(-32))}`,
    signature: `ed25519:${bs58.encode(signature)}`, message, nonce } };
}

describe("registry validator", () => {
  it("accepts a valid signature and rejects tampering", () => {
    const entry = signedEntry();
    expect(verifyRegistryProof(entry)).toBe(true);
    expect(validateRegistry([entry], true).errors).toEqual([]);
    expect(verifyRegistryProof({ ...entry, name: "Tampered" })).toBe(false);
    expect(validateRegistry([{ ...entry, name: "Tampered" }], true).errors).toContain("synthetic.near: proof message mismatch");
    expect(validateRegistry([signedEntry(false)], true).errors).toEqual([]);
  });
  it("warns for placeholders unless strict, but always enforces schema", () => {
    const entry = signedEntry();
    entry.proof.signature = "ed25519:PLACEHOLDER_PM_MUST_SIGN";
    expect(verifyRegistryProof(entry)).toBe(false);
    expect(validateRegistry([entry]).warnings).toHaveLength(1);
    expect(validateRegistry([entry], true).errors).toHaveLength(1);
    expect(validateRegistry([{ ...entry, kinds: ["invalid"] }]).errors.length).toBeGreaterThan(0);
  });
  it("rejects a present but invalid real signature", () => {
    const entry = signedEntry();
    entry.proof.signature = `ed25519:${bs58.encode(Buffer.alloc(64, 1))}`;
    expect(validateRegistry([entry]).errors).toContain("synthetic.near: invalid NEP-413 signature");
    entry.proof.public_key = "ed25519:PLACEHOLDER_PM_MUST_SIGN";
    expect(validateRegistry([entry]).errors).toContain("synthetic.near: invalid NEP-413 signature");
  });
  it("requires the signing key to belong to the account and limits official badges", async () => {
    const valid = signedEntry();
    const fullAccess = async () => true;
    const noAccess = async () => false;
    expect(await registryEntryVerified(valid, {
      fullAccess, intents: noAccess, clock: () => 1_000,
    })).toBe(true);
    const unrelated = signedEntry();
    expect(await registryEntryVerified(unrelated, {
      fullAccess: noAccess, intents: noAccess, clock: () => 1_000,
    })).toBe(false);
    const intentsKey = signedEntry();
    expect(await registryEntryVerified(intentsKey, {
      fullAccess: async () => { throw new Error("missing access key"); },
      intents: async () => true,
      clock: () => 1_000,
    })).toBe(true);
    const placeholder = { ...signedEntry(), proof: {
      ...valid.proof, signature: "ed25519:PLACEHOLDER_PM_MUST_SIGN",
    } };
    expect(await registryEntryVerified(placeholder, {
      fullAccess, intents: noAccess, clock: () => 1_000,
    })).toBe(false);
    expect(officialFulfiller("synthetic.near", "other.near, synthetic.near")).toBe(true);
    expect(officialFulfiller("synthetic.near", "other.near")).toBe(false);
  });

  it("fails closed on RPC errors without caching the transient false result", async () => {
    const entry = signedEntry();
    const fullAccess = vi.fn().mockRejectedValueOnce(new Error("RPC unavailable"))
      .mockResolvedValueOnce(true);
    const intents = vi.fn().mockRejectedValueOnce(new Error("RPC unavailable"));
    const checks = { fullAccess, intents, clock: () => 1_000 };
    expect(await registryEntryVerified(entry, checks)).toBe(false);
    expect(await registryEntryVerified(entry, checks)).toBe(true);
    expect(fullAccess).toHaveBeenCalledTimes(2);
    expect(intents).toHaveBeenCalledTimes(1);
  });

  it("rechecks an unauthorized registry key after a short delay", async () => {
    const entry = signedEntry();
    const fullAccess = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const intents = vi.fn().mockResolvedValue(false);
    let now = 1_000;
    const checks = { fullAccess, intents, clock: () => now };
    expect(await registryEntryVerified(entry, checks)).toBe(false);
    now += 2_000;
    expect(await registryEntryVerified(entry, checks)).toBe(false);
    expect(fullAccess).toHaveBeenCalledTimes(1);
    now += 1_001;
    expect(await registryEntryVerified(entry, checks)).toBe(true);
    expect(fullAccess).toHaveBeenCalledTimes(2);
  });

  it("rejects an invalid proof before making either registry RPC check", async () => {
    const entry = signedEntry();
    entry.proof.signature = "ed25519:PLACEHOLDER_PM_MUST_SIGN";
    const fullAccess = vi.fn(async () => { throw new Error("RPC unavailable"); });
    const intents = vi.fn(async () => { throw new Error("RPC unavailable"); });
    expect(await registryEntryVerified(entry, { fullAccess, intents, clock: () => 1_000 })).toBe(false);
    expect(fullAccess).not.toHaveBeenCalled();
    expect(intents).not.toHaveBeenCalled();
  });
});
