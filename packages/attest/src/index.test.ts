import { describe, expect, it } from "vitest";
import { Wallet } from "ethers";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import {
  bundleHash,
  replayEventLog,
  sha256Bytes,
  verifyBundle,
  verifyNvidiaVerdict,
  type AttestationBundle,
} from "./index.js";

async function fixture(): Promise<AttestationBundle> {
  const wallet = new Wallet("0x" + "1".repeat(64));
  const request = '{"model":"fixture-flash","messages":[]}';
  const response = '{"id":"test","choices":[]}';
  const text = `fixture-flash:${sha256Bytes(request)}:${sha256Bytes(response)}`;
  const bundle: AttestationBundle = {
    model: "fixture-flash",
    nonce: "a".repeat(64),
    request,
    response,
    mock: false,
    preflightAt: "2026-10-29T00:00:00Z",
    responseReceivedAt: "2026-10-29T00:00:01Z",
    signature: {
      text,
      signature: await wallet.signMessage(text),
      signing_address: wallet.address,
      signing_algo: "ecdsa",
      signature_kind: "provider_tee",
    },
    attestationReport: {
      model_attestations: [
        {
          signing_address: wallet.address,
          signing_algo: "ecdsa",
          intel_quote: "00",
        },
      ],
    },
  };
  bundle.hash = bundleHash(bundle);
  return bundle;
}

describe("offline attestation policy", () => {
  it("verifies GPU verdicts only against independently supplied keys and the nonce", async () => {
    const { publicKey, privateKey } = await generateKeyPair("ES384");
    const jwk = {
      ...(await exportJWK(publicKey)),
      kid: "test-key",
      alg: "ES384",
    };
    const token = await new SignJWT({
      eat_nonce: "a".repeat(64),
      "x-nvidia-overall-att-result": true,
    })
      .setProtectedHeader({ alg: "ES384", kid: "test-key" })
      .setIssuer("https://nras.attestation.nvidia.com")
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(privateKey);
    expect(
      await verifyNvidiaVerdict(token, { keys: [jwk] }, "a".repeat(64)),
    ).toBe(true);
    expect(
      await verifyNvidiaVerdict(token, { keys: [jwk] }, "b".repeat(64)),
    ).toBe(false);
    expect(await verifyNvidiaVerdict(token, { keys: [] }, "a".repeat(64))).toBe(
      false,
    );
    expect(
      await verifyNvidiaVerdict(
        token,
        { keys: [jwk] },
        "a".repeat(64),
        new Date(Date.now() + 7_200_000),
      ),
    ).toBe(false);
  });
  it("never promotes mock evidence to verified", async () => {
    const result = await verifyBundle({ ...(await fixture()), mock: true });
    expect(result.verified).toBe(false);
    expect(result.mock).toBe(true);
  });

  it("verifies EIP-191 independently but refuses absent hardware roots", async () => {
    const result = await verifyBundle(await fixture());
    expect(
      result.checks.find((check) => check.id === "response_signature")?.pass,
    ).toBe(true);
    expect(
      result.checks.find((check) => check.id === "exact_bytes")?.pass,
    ).toBe(true);
    expect(
      result.checks.find((check) => check.id === "model_0.intel_root")?.pass,
    ).toBe(false);
    expect(result.verified).toBe(false);
  });

  it("detects response tampering even if the attacker rehashes the bundle", async () => {
    const bundle = await fixture();
    bundle.response = '{"id":"tampered"}';
    bundle.hash = bundleHash(bundle);
    const result = await verifyBundle(bundle);
    expect(
      result.checks.find((check) => check.id === "exact_bytes")?.pass,
    ).toBe(false);
    expect(result.verified).toBe(false);
  });

  it("rejects equivalent JSON reserialized with different wire bytes", async () => {
    const bundle = await fixture();
    bundle.request = JSON.stringify(
      JSON.parse(String(bundle.request)),
      null,
      2,
    );
    const result = await verifyBundle(bundle);
    expect(
      result.checks.find((check) => check.id === "exact_bytes")?.pass,
    ).toBe(false);
  });

  it("rejects a gateway signature as model-level proof", async () => {
    const bundle = await fixture();
    (bundle.signature as Record<string, unknown>).signature_kind = "gateway";
    const result = await verifyBundle(bundle);
    expect(
      result.checks.find((check) => check.id === "signature_kind")?.pass,
    ).toBe(false);
  });

  it("rejects ambiguous report signers and post-hoc reports", async () => {
    const bundle = await fixture();
    const report = bundle.attestationReport as {
      model_attestations: unknown[];
    };
    report.model_attestations.push(report.model_attestations[0]);
    bundle.preflightAt = "2026-10-29T00:00:02Z";
    const result = await verifyBundle(bundle);
    expect(
      result.checks.find((check) => check.id === "unique_signer")?.pass,
    ).toBe(false);
    expect(
      result.checks.find((check) => check.id === "preflight_order")?.pass,
    ).toBe(false);
  });

  it("handles malformed bundles without accepting them", async () => {
    const result = await verifyBundle({
      ...(await fixture()),
      signature: { error_code: "unavailable" },
    });
    expect(result.verified).toBe(false);
  });

  it("rejects tampered RTMR3 event digests", () => {
    expect(() =>
      replayEventLog([
        {
          imr: 3,
          event_type: 1,
          event: "test",
          event_payload: "aa",
          digest: "00",
        },
      ]),
    ).toThrow("digest mismatch");
    expect(replayEventLog([])).toEqual(Buffer.alloc(48));
  });
});
