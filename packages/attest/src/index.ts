import {
  createHash,
  createPublicKey,
  verify as verifyCrypto,
} from "node:crypto";
import { verifyMessage } from "ethers";
import { createLocalJWKSet, jwtVerify, type JSONWebKeySet } from "jose";
import { verify as verifyQuote, type Collateral } from "@phala/dcap-qvl";

export interface AttestationBundle {
  id?: string;
  provider?: "near-ai" | "sage" | "mock";
  model: string;
  nonce: string;
  request: unknown;
  response: unknown;
  signature?: unknown;
  attestationReport?: unknown;
  createdAt?: string;
  mock: boolean;
  hash?: string;
  preflightAt?: string;
  responseReceivedAt?: string;
  collateral?: Record<string, Collateral>;
  gpuVerdicts?: Record<string, string>;
}

export interface VerificationCheck {
  id: string;
  pass: boolean;
  detail: string;
}

export interface VerificationResult {
  verified: boolean;
  mock: boolean;
  checks: VerificationCheck[];
}

/** Trust policy comes from the verifier operator, never from the untrusted bundle. */
export interface VerificationPolicy {
  now?: Date;
  allowedComposeHashes?: readonly string[];
  nvidiaJwks?: JSONWebKeySet;
  verifyGpu?: (
    report: Record<string, unknown>,
    nonce: string,
  ) => Promise<boolean>;
}

export async function verifyNvidiaVerdict(
  token: string,
  trustedKeys: JSONWebKeySet,
  nonce: string,
  now = new Date(),
): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, createLocalJWKSet(trustedKeys), {
      issuer: "https://nras.attestation.nvidia.com",
      algorithms: ["ES384"],
      currentDate: now,
      requiredClaims: ["exp", "iat"],
    });
    return (
      payload.eat_nonce === nonce &&
      payload["x-nvidia-overall-att-result"] === true
    );
  } catch {
    return false;
  }
}

export function sha256Bytes(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function object(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    return object(JSON.parse(value));
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Expected an object");
  }
  return value as Record<string, unknown>;
}

function hex(value: unknown): Buffer {
  if (typeof value !== "string" || !/^(?:0x)?(?:[a-f\d]{2})+$/i.test(value)) {
    throw new Error("Malformed hexadecimal value");
  }
  return Buffer.from(value.replace(/^0x/, ""), "hex");
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonical);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonical(item)]),
    );
  }
  return value;
}

export function bundleHash(bundle: AttestationBundle): string {
  return sha256Bytes(
    JSON.stringify(
      canonical({
        nonce: bundle.nonce,
        request: bundle.request,
        response: bundle.response,
        signature: bundle.signature,
        attestationReport: bundle.attestationReport,
      }),
    ),
  );
}

export function replayEventLog(value: unknown): Buffer {
  const events: unknown = typeof value === "string" ? JSON.parse(value) : value;
  if (!Array.isArray(events)) {
    throw new Error("Missing TDX event log");
  }
  let state: Buffer = Buffer.alloc(48);
  for (const entry of events) {
    const event = object(entry);
    if (event.imr !== 3) {
      continue;
    }
    if (
      !Number.isInteger(event.event_type) ||
      typeof event.event !== "string"
    ) {
      throw new Error("Malformed RTMR3 event");
    }
    const eventType = Buffer.alloc(4);
    eventType.writeUInt32LE(Number(event.event_type));
    const digest = createHash("sha384")
      .update(eventType)
      .update(":")
      .update(event.event)
      .update(":")
      .update(event.event_payload ? hex(event.event_payload) : Buffer.alloc(0))
      .digest();
    if (event.digest && !hex(event.digest).equals(digest)) {
      throw new Error("RTMR3 event digest mismatch");
    }
    state = createHash("sha384").update(state).update(digest).digest();
  }
  return state;
}

async function checkHardware(
  report: Record<string, unknown>,
  bundle: AttestationBundle,
  policy: VerificationPolicy,
  prefix: string,
): Promise<VerificationCheck[]> {
  const checks: VerificationCheck[] = [];
  const add = (id: string, pass: boolean, detail: string) => {
    checks.push({ id: `${prefix}.${id}`, pass, detail });
  };
  try {
    const quote = hex(report.intel_quote);
    const collateral = bundle.collateral?.[sha256Bytes(quote)];
    if (!collateral) {
      add(
        "intel_root",
        false,
        "Intel collateral is absent; hardware root was not verified.",
      );
      return checks;
    }
    const verified = verifyQuote(
      quote,
      collateral,
      Math.floor((policy.now ?? new Date()).getTime() / 1000),
    );
    add(
      "intel_root",
      verified.status === "UpToDate",
      `Intel production trust chain: ${verified.status}.`,
    );
    const td = verified.report.asTd10();
    if (!td) {
      add("tdx", false, "A supported TDX report is required.");
      return checks;
    }
    add(
      "debug_disabled",
      (td.tdAttributes[0]! & 1) === 0,
      "TDX debug bit must be disabled.",
    );
    const signer = hex(report.signing_address);
    const expectedLength =
      report.signing_algo === "ecdsa"
        ? 20
        : report.signing_algo === "ed25519"
          ? 32
          : 0;
    if (signer.length !== expectedLength) {
      throw new Error("Unsupported report signing identity");
    }
    const identity = Buffer.alloc(32);
    signer.copy(identity);
    const bound = report.tls_cert_fingerprint
      ? Buffer.from(
          sha256Bytes(
            Buffer.concat([signer, hex(report.tls_cert_fingerprint)]),
          ),
          "hex",
        )
      : identity;
    add(
      "quote_binding",
      Buffer.from(td.reportData).equals(
        Buffer.concat([bound, hex(bundle.nonce)]),
      ),
      "Verified quote must bind signer and fresh nonce.",
    );
    add(
      "nonce",
      report.request_nonce === bundle.nonce,
      "Report nonce must match the requested nonce.",
    );
    const info = object(report.info);
    const config = object(info.tcb_info);
    if (typeof config.app_compose !== "string") {
      throw new Error("Missing measured app_compose");
    }
    const composeHash = sha256Bytes(config.app_compose);
    const measured = Buffer.concat([
      Buffer.from([1]),
      Buffer.from(composeHash, "hex"),
      Buffer.alloc(15),
    ]);
    add(
      "configuration",
      Buffer.from(td.mrConfigId).equals(measured),
      "MRCONFIGID must match exact app_compose bytes.",
    );
    add(
      "event_log",
      replayEventLog(report.event_log).equals(Buffer.from(td.rtMr3)),
      "Event log must replay to the verified RTMR3.",
    );
    add(
      "measurement_policy",
      policy.allowedComposeHashes?.includes(composeHash) === true,
      `Configuration SHA-256 ${composeHash}; requires an operator-approved allowlist.`,
    );
    if (prefix.startsWith("model")) {
      const gpu = report.nvidia_payload
        ? object(report.nvidia_payload)
        : undefined;
      const nonceMatches = gpu?.nonce === bundle.nonce;
      let gpuVerified = false;
      if (nonceMatches && policy.verifyGpu) {
        gpuVerified = await policy.verifyGpu(report, bundle.nonce);
      } else if (nonceMatches && policy.nvidiaJwks) {
        const payloadText =
          typeof report.nvidia_payload === "string"
            ? report.nvidia_payload
            : JSON.stringify(report.nvidia_payload);
        const token = bundle.gpuVerdicts?.[sha256Bytes(payloadText)];
        if (token) {
          gpuVerified = await verifyNvidiaVerdict(
            token,
            policy.nvidiaJwks,
            bundle.nonce,
            policy.now,
          );
        }
      }
      add(
        "gpu_root",
        Boolean(gpuVerified),
        "GPU evidence requires a matching nonce and independently verified NVIDIA verdict.",
      );
    }
  } catch (error) {
    add(
      "hardware",
      false,
      error instanceof Error
        ? error.message
        : "Hardware proof verification failed.",
    );
  }
  return checks;
}

/** Offline by default: verification never fetches keys, sends evidence, or trusts stored pass flags. */
export async function verifyBundle(
  bundle: AttestationBundle,
  policy: VerificationPolicy = {},
): Promise<VerificationResult> {
  const checks: VerificationCheck[] = [];
  const add = (id: string, pass: boolean, detail: string) => {
    checks.push({ id, pass, detail });
  };
  const mock = bundle.mock === true || bundle.provider === "mock";
  add(
    "authentic_source",
    !mock,
    mock
      ? "MOCK (not verified): fictional demonstration bundle."
      : "Real-provider bundle; all checks below must pass.",
  );
  if (mock) {
    return { verified: false, mock: true, checks };
  }
  if (bundle.provider === "sage") {
    add(
      "provider_format",
      false,
      "Sage P256 proof is not a NEAR provider_tee proof. Escalate; never infer verification.",
    );
    return { verified: false, mock: false, checks };
  }
  try {
    add(
      "nonce_format",
      /^[a-f\d]{64}$/i.test(bundle.nonce),
      "Nonce must be 32 bytes of hexadecimal.",
    );
    if (
      typeof bundle.request !== "string" ||
      typeof bundle.response !== "string"
    ) {
      throw new Error("Exact request and response byte strings are required.");
    }
    const request = object(bundle.request);
    add(
      "request_model",
      request.model === bundle.model,
      "Original request must use the canonical signed model id.",
    );
    add(
      "bundle_hash",
      typeof bundle.hash === "string" && bundle.hash === bundleHash(bundle),
      "Stored bundle hash must cover the exact response and evidence.",
    );
    const signature = object(bundle.signature);
    add(
      "signature_kind",
      signature.signature_kind === "provider_tee",
      "Only provider_tee binds inference to a model-serving TEE.",
    );
    const expectedText = `${bundle.model}:${sha256Bytes(bundle.request)}:${sha256Bytes(bundle.response)}`;
    add(
      "exact_bytes",
      signature.text === expectedText,
      "Signature text must cover canonical model id and SHA-256 of exact wire bytes.",
    );
    const report = object(bundle.attestationReport);
    const candidates = Array.isArray(report.model_attestations)
      ? report.model_attestations.map(object)
      : [];
    const matches = candidates.filter(
      (candidate) =>
        String(candidate.signing_address).toLowerCase() ===
          String(signature.signing_address).toLowerCase() &&
        candidate.signing_algo === (signature.signing_algo ?? "ecdsa"),
    );
    add(
      "unique_signer",
      matches.length === 1,
      "Signer and algorithm must match exactly one retained model report.",
    );
    let signatureValid = false;
    if (
      typeof signature.text === "string" &&
      typeof signature.signature === "string"
    ) {
      if (!signature.signing_algo || signature.signing_algo === "ecdsa") {
        const recovered = verifyMessage(signature.text, signature.signature);
        signatureValid =
          recovered.toLowerCase() ===
          String(signature.signing_address).toLowerCase();
      } else if (signature.signing_algo === "ed25519") {
        const publicBytes = hex(signature.signing_address);
        const key = createPublicKey({
          key: Buffer.concat([
            Buffer.from("302a300506032b6570032100", "hex"),
            publicBytes,
          ]),
          format: "der",
          type: "spki",
        });
        signatureValid = verifyCrypto(
          null,
          Buffer.from(signature.text),
          key,
          hex(signature.signature),
        );
      }
    }
    add(
      "response_signature",
      signatureValid,
      "Cryptographic response signature must recover to the reported signer.",
    );
    const preflight = Date.parse(bundle.preflightAt ?? "");
    const responseTime = Date.parse(bundle.responseReceivedAt ?? "");
    add(
      "preflight_order",
      Number.isFinite(preflight) &&
        Number.isFinite(responseTime) &&
        preflight <= responseTime,
      "Bundle must retain preflight and response receipt timestamps; client timing is an explicit trust assumption.",
    );
    add(
      "model_reports",
      candidates.length > 0,
      "At least one model report is required and every candidate is checked.",
    );
    for (const [index, candidate] of candidates.entries()) {
      checks.push(
        ...(await checkHardware(candidate, bundle, policy, `model_${index}`)),
      );
    }
    if (report.gateway_attestation) {
      checks.push(
        ...(await checkHardware(
          object(report.gateway_attestation),
          bundle,
          policy,
          "gateway",
        )),
      );
    } else {
      add("gateway", false, "Gateway preflight report is missing.");
    }
  } catch (error) {
    add(
      "format",
      false,
      error instanceof Error ? error.message : "Malformed verification bundle.",
    );
  }
  return {
    verified: checks.length > 0 && checks.every((check) => check.pass),
    mock: false,
    checks,
  };
}
