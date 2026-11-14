import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { registryMessage, verifyRegistryProof, type RegistryEntry } from "../apps/web/lib/server/registry-proof";

export { registryMessage, verifyRegistryProof, type RegistryEntry } from "../apps/web/lib/server/registry-proof";
type Schema = { type?: string; required?: string[]; properties?: Record<string, Schema>;
  items?: Schema; minItems?: number; minLength?: number; enum?: string[]; pattern?: string;
  additionalProperties?: boolean };

const schema = JSON.parse(readFileSync(new URL("../fulfillers/registry.schema.json", import.meta.url), "utf8")) as Schema;
function checkSchema(value: unknown, rule: Schema, path: string, errors: string[]): void {
  const type = Array.isArray(value) ? "array" : value === null ? "null" : typeof value;
  if (rule.type && type !== rule.type) { errors.push(`${path}: expected ${rule.type}`); return; }
  if (type === "array") {
    const items = value as unknown[];
    if (rule.minItems !== undefined && items.length < rule.minItems) errors.push(`${path}: too few items`);
    items.forEach((item, index) => rule.items && checkSchema(item, rule.items, `${path}[${index}]`, errors));
  }
  if (type === "object") {
    const record = value as Record<string, unknown>;
    for (const key of rule.required ?? []) if (!(key in record)) errors.push(`${path}.${key}: required`);
    if (rule.additionalProperties === false) {
      for (const key of Object.keys(record)) if (!rule.properties?.[key]) errors.push(`${path}.${key}: unknown property`);
    }
    for (const [key, item] of Object.entries(record)) {
      if (rule.properties?.[key]) checkSchema(item, rule.properties[key], `${path}.${key}`, errors);
    }
  }
  if (type === "string") {
    const item = value as string;
    if (rule.minLength !== undefined && item.length < rule.minLength) errors.push(`${path}: too short`);
    if (rule.enum && !rule.enum.includes(item)) errors.push(`${path}: invalid value`);
    if (rule.pattern && !new RegExp(rule.pattern).test(item)) errors.push(`${path}: invalid pattern`);
  }
}

export function validateRegistry(input: unknown, strict = false): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  checkSchema(input, schema, "registry", errors);
  if (errors.length) return { errors, warnings };
  const seen = new Set<string>();
  for (const entry of input as RegistryEntry[]) {
    if (seen.has(entry.account_id)) errors.push(`duplicate account ${entry.account_id}`);
    seen.add(entry.account_id);
    const { proof, ...unsigned } = entry;
    const expected = registryMessage(unsigned);
    const messageMatches = proof.message === expected;
    if (!messageMatches) errors.push(`${entry.account_id}: proof message mismatch`);
    const placeholder = proof.signature === "ed25519:PLACEHOLDER_PM_MUST_SIGN";
    if (placeholder) {
      (strict ? errors : warnings).push(`${entry.account_id}: PM must replace placeholder proof and review on-chain key ownership`);
    } else if (messageMatches && !verifyRegistryProof(entry)) {
      errors.push(`${entry.account_id}: invalid NEP-413 signature`);
    }
  }
  return { errors, warnings };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const registry = JSON.parse(readFileSync(new URL("../fulfillers/registry.json", import.meta.url), "utf8"));
  const result = validateRegistry(registry, process.argv.includes("--strict"));
  result.warnings.forEach((warning) => console.warn(`warning: ${warning}`));
  result.errors.forEach((error) => console.error(`error: ${error}`));
  if (result.errors.length) process.exitCode = 1;
}
