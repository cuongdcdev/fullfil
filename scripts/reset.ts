import { rmSync } from "node:fs";
import { resolve } from "node:path";
const path =
  process.env.DATABASE_URL?.replace(/^file:/, "") ||
  resolve(process.cwd(), "data/dev.db");
for (const suffix of ["", "-wal", "-shm"])
  rmSync(`${path}${suffix}`, { force: true });
await import("../apps/web/lib/server/db");
process.stdout.write(`Reset and seeded ${path}\n`);
