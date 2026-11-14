import { browserUserAgent } from "./config";
import { NEAR_RPC_CONFIG_TTL_MS, view } from "./rpc";

/** Whether the verifier's WASM (its program code) can be fetched from FastFS. */
export type VerifierCode = {
  /** Short active version hash (first 8 hex chars plus an ellipsis), or null if unknown. */
  version: string | null;
  url: string | null;
  /** true = code online, false = missing (proofs will fail), null = could not check. */
  available: boolean | null;
  checked_at: string;
};

export const CODE_OK_TTL_MS = 5 * 60_000;
export const CODE_MISSING_TTL_MS = 60_000;
const CODE_TIMEOUT_MS = 4_000;
const FASTFS = "https://main.fastfs.io";

const cache = new Map<string, { value: VerifierCode; expires: number }>();

export function __resetVerifierCodeCacheForTests(): void {
  cache.clear();
}

export function wasmUrl(owner: string, version: string): string {
  return `${FASTFS}/${encodeURIComponent(owner)}/outlayer.near/${encodeURIComponent(version)}.wasm`;
}

const shortVersion = (v: string) => (v.length > 8 ? `${v.slice(0, 8)}…` : v);

/** HEAD is not supported by FastFS (404 even for existing files), so ask for one byte. */
async function probeWasm(url: string): Promise<boolean | null> {
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { "User-Agent": browserUserAgent, Range: "bytes=0-0" },
      signal: AbortSignal.timeout(CODE_TIMEOUT_MS),
      cache: "no-store",
    });
    // FastFS ignores Range and answers 200 with the full length; never read the body.
    void res.body?.cancel().catch(() => undefined);
    if (res.status === 404 || res.status === 410) return false;
    if (res.status !== 200 && res.status !== 206) return null;
    const range = res.headers.get("content-range")?.match(/\/(\d+)$/);
    const header = range ? range[1] : res.headers.get("content-length");
    // A missing length is fine; an explicit zero is an empty file.
    if (header !== null && header !== undefined && Number(header) <= 0) return false;
    return true;
  } catch {
    return null;
  }
}

export async function verifierCode(projectId: string): Promise<VerifierCode> {
  const hit = cache.get(projectId);
  if (hit && hit.expires > Date.now()) return hit.value;
  const checked_at = new Date().toISOString();
  const unknown: VerifierCode = { version: null, url: null, available: null, checked_at };
  const slash = projectId.indexOf("/");
  if (slash <= 0) return unknown;
  const owner = projectId.slice(0, slash);
  let version: string | undefined;
  try {
    const project = await view<{ active_version?: string } | null>(
      "outlayer.near", "get_project", { project_id: projectId }, { ttlMs: NEAR_RPC_CONFIG_TTL_MS });
    version = project?.active_version;
  } catch {
    return unknown;
  }
  let value: VerifierCode;
  let ttl: number;
  if (!version) {
    value = { version: null, url: null, available: false, checked_at };
    ttl = CODE_MISSING_TTL_MS;
  } else {
    const url = wasmUrl(owner, version);
    const available = await probeWasm(url);
    value = { version: shortVersion(version), url, available, checked_at };
    ttl = available === true ? CODE_OK_TTL_MS : available === false ? CODE_MISSING_TTL_MS : 0;
  }
  if (ttl > 0) cache.set(projectId, { value, expires: Date.now() + ttl });
  return value;
}
