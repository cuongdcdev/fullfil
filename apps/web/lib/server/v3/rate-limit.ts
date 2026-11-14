type Bucket = { tokens: number; updatedAt: number };
const buckets = new Map<string, Bucket>();
const relayerSubmissions = new Map<string, number[]>();

function setting(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

function take(key: string, capacity: number, refillMs: number): boolean {
  const now = Date.now();
  if (buckets.size > 10_000) {
    for (const [entry, value] of buckets) {
      if (now - value.updatedAt > refillMs) buckets.delete(entry);
    }
  }
  const bucket = buckets.get(key) || { tokens: capacity, updatedAt: now };
  bucket.tokens = Math.min(capacity, bucket.tokens +
    (Math.max(0, now - bucket.updatedAt) * capacity) / refillMs);
  bucket.updatedAt = now;
  if (bucket.tokens < 1) {
    buckets.set(key, bucket);
    return false;
  }
  bucket.tokens -= 1;
  buckets.set(key, bucket);
  return true;
}

export function resetRateLimits(): void {
  buckets.clear();
  relayerSubmissions.clear();
}

export function allowRequest(request: Request, route: "auth" | "submit" | "proofs" | "topup" | "shop", account?: string): boolean {
  const defaults = { auth: 20, submit: 30, proofs: 20, topup: 30, shop: 60 };
  const limit = setting(`RATE_LIMIT_${route.toUpperCase()}_PER_MINUTE`, defaults[route]);
  const forwarded = request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim();
  const ip = request.headers.get("cf-connecting-ip")?.trim()
    || request.headers.get("x-real-ip")?.trim() || forwarded || "unknown";
  const ipAllowed = take(`${route}:ip:${ip}`, limit, 60_000);
  const accountAllowed = account ? take(`${route}:account:${account}`, limit, 60_000) : true;
  return ipAllowed && accountAllowed;
}

export function allowRelayerSubmission(account: string): boolean {
  const now = Date.now();
  const recent = (relayerSubmissions.get(account) || [])
    .filter((at) => at > now - 60 * 60_000);
  if (recent.length >= setting("RELAYER_MAX_PER_ACCOUNT_PER_HOUR", 20)) {
    relayerSubmissions.set(account, recent);
    return false;
  }
  recent.push(now);
  relayerSubmissions.set(account, recent);
  return true;
}
