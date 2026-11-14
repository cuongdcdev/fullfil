import { browserUserAgent, intentsContract, mode, rpcUrls } from "./config";

type RpcResult = {
  result?: { result?: number[]; permission?: unknown };
  error?: unknown;
};
type QueryOptions = { ttlMs?: number; allowRpcError?: boolean; urls?: string[] };

export const NEAR_RPC_DEFAULT_MAX_CONCURRENCY = 4;
export const NEAR_RPC_DEFAULT_MAX_RPS = 8;
export const NEAR_RPC_DEFAULT_TTL_MS = 3_000;
export const NEAR_RPC_CONFIG_TTL_MS = 60_000;

const cache = new Map<string, { value: RpcResult; expires: number }>();
const inFlight = new Map<string, Promise<RpcResult>>();
const cooldowns = new Map<string, number>();
const queue: Array<() => void> = [];
let preferred: string | undefined;
let active = 0;
let nextStart = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
let generation = 0;

function setting(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

function drain(): void {
  if (timer) clearTimeout(timer);
  timer = undefined;
  const cap = setting("NEAR_RPC_MAX_CONCURRENCY", NEAR_RPC_DEFAULT_MAX_CONCURRENCY);
  if (!queue.length || active >= cap) return;
  const delay = Math.max(0, nextStart - Date.now());
  if (delay) {
    timer = setTimeout(drain, delay);
    return;
  }
  active += 1;
  nextStart = Date.now() + Math.ceil(1_000 / setting("NEAR_RPC_MAX_RPS", NEAR_RPC_DEFAULT_MAX_RPS));
  queue.shift()!();
  if (queue.length && active < cap) timer = setTimeout(drain, Math.max(0, nextStart - Date.now()));
}

async function acquire(): Promise<void> {
  await new Promise<void>((resolve) => {
    queue.push(resolve);
    drain();
  });
}

function release(): void {
  active -= 1;
  drain();
}

function retryAfter(response: Response): number {
  const header = response.headers.get("Retry-After");
  if (!header) return 30_000;
  const seconds = Number(header);
  const duration = Number.isFinite(seconds) ? seconds * 1_000 : Date.parse(header) - Date.now();
  return Number.isFinite(duration) ? Math.min(120_000, Math.max(0, duration)) : 30_000;
}

function ttlFor(method: string, params: Record<string, unknown>, result: RpcResult): number {
  if (method !== "query") return NEAR_RPC_DEFAULT_TTL_MS;
  if (params.request_type === "view_access_key") {
    return result.result?.permission === "FullAccess" ? NEAR_RPC_CONFIG_TTL_MS : NEAR_RPC_DEFAULT_TTL_MS;
  }
  if (params.request_type !== "call_function") return NEAR_RPC_DEFAULT_TTL_MS;
  if (params.method_name === "has_public_key") {
    const bytes = result.result?.result;
    return bytes && Buffer.from(bytes).toString("utf8") === "true"
      ? NEAR_RPC_CONFIG_TTL_MS : NEAR_RPC_DEFAULT_TTL_MS;
  }
  return ["get_config", "get_kinds", "list_kinds"].includes(String(params.method_name))
    ? NEAR_RPC_CONFIG_TTL_MS : NEAR_RPC_DEFAULT_TTL_MS;
}

async function request(
  method: string,
  params: Record<string, unknown>,
  urls: string[],
): Promise<RpcResult> {
  const tried = new Set<string>();
  let lastError: Error | undefined;
  for (let attempt = 0; attempt < urls.length; attempt++) {
    await acquire();
    const ordered = preferred && urls.includes(preferred)
      ? [preferred, ...urls.filter((url) => url !== preferred)] : urls;
    const remaining = ordered.filter((url) => !tried.has(url));
    const ready = remaining.filter((url) => (cooldowns.get(url) ?? 0) <= Date.now());
    const url = ready[0] ?? (!tried.size ? [...remaining].sort((a, b) =>
      (cooldowns.get(a) ?? 0) - (cooldowns.get(b) ?? 0))[0] : undefined);
    if (!url) {
      release();
      break;
    }
    tried.add(url);
    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": browserUserAgent },
        body: JSON.stringify({ jsonrpc: "2.0", id: "fulfil-v3", method, params }),
        signal: AbortSignal.timeout(5_000),
      });
    } catch (error) {
      cooldowns.set(url, Date.now() + 10_000);
      lastError = new Error(`NEAR RPC unreachable: ${error instanceof Error ? error.message : "fetch failed"}`);
      release();
      continue;
    }
    release();
    if (response.status === 429 || response.status >= 500) {
      cooldowns.set(url, Date.now() + (response.status === 429 ? retryAfter(response) : 10_000));
      lastError = new Error(`NEAR RPC HTTP ${response.status}`);
      continue;
    }
    if (!response.ok) {
      // Auth/gateway problems at this provider: another endpoint may work.
      cooldowns.set(url, Date.now() + 30_000);
      lastError = new Error(`NEAR RPC HTTP ${response.status}`);
      continue;
    }
    let result: RpcResult;
    try {
      result = await response.json() as RpcResult;
    } catch {
      cooldowns.set(url, Date.now() + 10_000);
      lastError = new Error("NEAR RPC returned invalid JSON");
      continue;
    }
    if (isProviderError(result.error)) {
      // e.g. rpc.mainnet.near.org answers HTTP 200 with {code:-429, "DEPRECATED"}.
      cooldowns.set(url, Date.now() + 60_000);
      lastError = new Error(`NEAR RPC provider error: ${JSON.stringify(result.error).slice(0, 200)}`);
      continue;
    }
    preferred = url;
    return result;
  }
  throw lastError ?? new Error("NEAR RPC unavailable");
}

/**
 * True for errors from the RPC provider itself (rate limit, missing API key,
 * deprecated endpoint, unsupported method), as opposed to a node HANDLER_ERROR
 * such as a contract panic, which is the same on every node.
 */
export function isProviderError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: unknown; name?: unknown; message?: unknown };
  if (e.name === "HANDLER_ERROR" || e.code === -32000) return false;
  if (e.code === -429 || e.code === -32601) return true;
  return /rate.?limit|too many|deprecated|api.?key|quota/i.test(String(e.message ?? ""));
}

/** All NEAR JSON-RPC reads share the same queue, endpoint health, and cache. */
export async function queryRpc(
  method: string,
  params: Record<string, unknown>,
  options: QueryOptions = {},
): Promise<RpcResult> {
  const simulation = method === "query" && params.method_name === "simulate_intents";
  const cacheable = method === "query" && !simulation && options.ttlMs !== 0;
  const urls = options.urls?.length ? [...new Set(options.urls)] : rpcUrls();
  const key = JSON.stringify([method, params, urls]);
  if (cacheable) {
    const hit = cache.get(key);
    if (hit && hit.expires > Date.now()) return hit.value;
    const pending = inFlight.get(key);
    if (pending) return pending;
  }
  const startedAt = generation;
  const pending = request(method, params, urls).then((result) => {
    if (result.error) {
      if (!options.allowRpcError) throw new Error(`NEAR RPC query failed: ${JSON.stringify(result.error)}`);
      return result;
    }
    if (cacheable && result.result && startedAt === generation) {
      const ttl = options.ttlMs ?? ttlFor(method, params, result);
      if (ttl > 0) {
        if (cache.size >= 1_000) {
          for (const [cachedKey, cached] of cache) {
            if (cached.expires <= Date.now()) cache.delete(cachedKey);
          }
          if (cache.size >= 1_000) cache.delete(cache.keys().next().value!);
        }
        cache.set(key, { value: result, expires: Date.now() + ttl });
      }
    }
    return result;
  }).finally(() => {
    if (inFlight.get(key) === pending) inFlight.delete(key);
  });
  if (cacheable) inFlight.set(key, pending);
  return pending;
}

export function invalidateRpcCache(): void {
  generation += 1;
  cache.clear();
  inFlight.clear();
}

export function __resetRpcStateForTests(): void {
  invalidateRpcCache();
  cooldowns.clear();
  preferred = undefined;
  if (timer) clearTimeout(timer);
  timer = undefined;
  queue.length = 0;
  active = 0;
  nextStart = 0;
}

export async function view<T>(
  accountId: string,
  methodName: string,
  args: unknown = {},
  options: { ttlMs?: number } = {},
): Promise<T> {
  const response = await queryRpc("query", {
    request_type: "call_function",
    finality: "final",
    account_id: accountId,
    method_name: methodName,
    args_base64: Buffer.from(JSON.stringify(args)).toString("base64"),
  }, options);
  const bytes = response.result?.result;
  if (!bytes) throw new Error("NEAR RPC returned no view result");
  return JSON.parse(Buffer.from(bytes).toString("utf8")) as T;
}

export async function isFullAccessKey(accountId: string, publicKey: string): Promise<boolean> {
  const response = await queryRpc("query", {
    request_type: "view_access_key",
    finality: "final",
    account_id: accountId,
    public_key: publicKey,
  });
  return response.result?.permission === "FullAccess";
}

export async function isIntentsPublicKey(accountId: string, publicKey: string): Promise<boolean> {
  if (mode() === "mock") return false;
  return (await view<unknown>(intentsContract(), "has_public_key", {
    account_id: accountId,
    public_key: publicKey,
  })) === true;
}
