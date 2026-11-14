import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chmod } from "node:fs/promises";
import { build } from "esbuild";

const here = dirname(fileURLToPath(import.meta.url));

await build({
  entryPoints: [join(here, "src", "cli.mjs")], outfile: join(here, "fulfil-agent.mjs"),
  bundle: true, platform: "node", format: "esm", target: "node20",
  banner: { js: "#!/usr/bin/env node\nimport { createRequire } from 'node:module';\nconst require = createRequire(import.meta.url);" },
  legalComments: "none",
});
await chmod(join(here, "fulfil-agent.mjs"), 0o755);
process.stdout.write("Built skills/fulfil-token-buy/fulfil-agent.mjs\n");
