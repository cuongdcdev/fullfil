import { createHash } from "node:crypto";

export const USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
export const USDC_CONTRACT = "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1";
export const STORAGE_DEPOSIT = "1250000000000000000000";

export class AgentError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "AgentError";
    this.code = code;
  }
}

export function fail(code, message) {
  throw new AgentError(code, message);
}

export function decimal(value, label, max = (1n << 128n) - 1n) {
  if (typeof value === "number" && !Number.isSafeInteger(value)) fail("invalid_amount", `Invalid ${label}`);
  if (!/^(0|[1-9]\d*)$/.test(String(value))) fail("invalid_amount", `Invalid ${label}`);
  const number = BigInt(value);
  if (number > max) fail("invalid_amount", `${label} exceeds supported range`);
  return number;
}

export function canonicalJson(value) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) fail("invalid_spec", "Spec numbers must be safe integers");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  fail("invalid_spec", "Unsupported spec value");
}

export function sha256Hex(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function parseSpec(value, expectedHash) {
  const spec = typeof value === "string" ? JSON.parse(value) : value;
  if (!spec || typeof spec !== "object" || Array.isArray(spec) ||
      Object.keys(spec).sort().join(",") !== "amount_out,receiver,token_contract,v" ||
      typeof spec.receiver !== "string" || !spec.receiver ||
      typeof spec.token_contract !== "string" || !spec.token_contract ||
      spec.v !== 1) fail("invalid_spec", "Invalid token-buy spec");
  decimal(spec.amount_out, "amount_out");
  const canonical = canonicalJson(spec);
  if (expectedHash && sha256Hex(canonical) !== expectedHash) fail("spec_mismatch", "API spec does not match chain spec_hash");
  return { spec, canonical };
}

export function guardDeadline(order, marginSeconds, now = Date.now()) {
  const left = decimal(order.deadline_ns, "deadline_ns") - BigInt(now) * 1_000_000n;
  if (left <= BigInt(marginSeconds) * 1_000_000_000n) {
    fail("deadline_too_close", "Order deadline is past or inside the safety margin");
  }
}
