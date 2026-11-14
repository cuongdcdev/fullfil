import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  verifyBundle,
  type AttestationBundle,
  type VerificationPolicy,
} from "./index.js";

const filename = process.argv[2];
if (!filename) {
  console.error(
    "Usage: pnpm verify:bundle <bundle.json> [--policy trusted-policy.json]",
  );
  process.exitCode = 2;
} else {
  try {
    const bundle = JSON.parse(
      await readFile(resolve(filename), "utf8"),
    ) as AttestationBundle;
    let policy: VerificationPolicy = {};
    if (process.argv[3] === "--policy" && process.argv[4]) {
      policy = JSON.parse(await readFile(resolve(process.argv[4]), "utf8"));
      // Verification time is local wall-clock time, never supplied by the bundle.
      delete policy.now;
    } else if (process.argv.length > 3) {
      throw new Error("Expected --policy followed by a trusted policy file.");
    }
    const result = await verifyBundle(bundle, policy);
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.verified ? 0 : 1;
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Could not verify bundle.",
    );
    process.exitCode = 2;
  }
}
