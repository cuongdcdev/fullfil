/**
 * Downloads a logo for every coin 1Click can take for Add money and stores it in
 * apps/web/public/coins/, with a manifest the server reads
 * (apps/web/lib/server/v3/coin-icons.json: coingeckoId -> public path).
 * 1Click has no icons, so logos come from CoinGecko by each token's coingeckoId.
 * Re-run when 1Click adds coins: `pnpm coin-icons`. Existing icons are kept.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT_DIR = path.join(ROOT, "apps/web/public/coins");
const MANIFEST = path.join(ROOT, "apps/web/lib/server/v3/coin-icons.json");
const HEADERS = { Accept: "application/json", "User-Agent": "fulfil-mvp/0.1" };
const MAX_BYTES = 200_000;

function imageExt(bytes: Uint8Array): string | undefined {
  const hex = Buffer.from(bytes.subarray(0, 12)).toString("hex");
  if (hex.startsWith("89504e47")) return "png";
  if (hex.startsWith("ffd8ff")) return "jpg";
  if (hex.startsWith("47494638")) return "gif";
  if (hex.startsWith("52494646") && hex.slice(16, 24) === "57454250") return "webp";
  return undefined;
}

async function json(url: string): Promise<unknown> {
  const response = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`${url} -> HTTP ${response.status}`);
  return response.json();
}

async function main() {
  const tokens = (await json("https://1click.chaindefuser.com/v0/tokens")) as Record<string, unknown>[];
  const ids = [...new Set(tokens.map((t) => t.coingeckoId).filter(
    (id): id is string => typeof id === "string" && /^[a-z0-9-]+$/.test(id),
  ))];
  const manifest: Record<string, string> = JSON.parse(await readFile(MANIFEST, "utf8").catch(() => "{}"));
  const todo = ids.filter((id) => !manifest[id]);
  console.log(`${ids.length} coingecko ids, ${todo.length} without an icon yet`);
  await mkdir(OUT_DIR, { recursive: true });

  for (let i = 0; i < todo.length; i += 250) {
    const batch = todo.slice(i, i + 250);
    const rows = (await json(
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&per_page=250&ids=${batch.join(",")}`,
    )) as Record<string, unknown>[];
    for (const row of rows) {
      const id = String(row.id ?? "");
      const image = String(row.image ?? "").replace("/large/", "/small/");
      if (!batch.includes(id) || !image.startsWith("https://coin-images.coingecko.com/")) continue;
      try {
        const response = await fetch(image, { headers: HEADERS, signal: AbortSignal.timeout(20_000) });
        const bytes = new Uint8Array(await response.arrayBuffer());
        const ext = response.ok && bytes.length <= MAX_BYTES ? imageExt(bytes) : undefined;
        if (!ext) {
          console.warn(`skip ${id}: not a small png/jpg/gif/webp`);
          continue;
        }
        await writeFile(path.join(OUT_DIR, `${id}.${ext}`), bytes);
        manifest[id] = `/coins/${id}.${ext}`;
      } catch (e) {
        console.warn(`skip ${id}: ${(e as Error).message}`);
      }
    }
  }

  const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)));
  await writeFile(MANIFEST, `${JSON.stringify(sorted, null, 2)}\n`);
  console.log(`manifest: ${Object.keys(sorted).length} icons; missing: ${ids.filter((id) => !sorted[id]).join(", ") || "none"}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
