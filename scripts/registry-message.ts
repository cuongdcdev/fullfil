import { readFileSync } from "node:fs";
import { registryMessage, type RegistryEntry } from "./validate-registry";

const accountId = process.argv[2];
if (!accountId) throw new Error("Usage: npx tsx scripts/registry-message.ts ACCOUNT_ID");
const entries = JSON.parse(readFileSync(new URL("../fulfillers/registry.json", import.meta.url), "utf8")) as RegistryEntry[];
const entry = entries.find((item) => item.account_id === accountId);
if (!entry) throw new Error("Registry account not found");
const { proof: _proof, ...unsigned } = entry;
console.log(registryMessage(unsigned));
