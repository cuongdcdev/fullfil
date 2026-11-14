const BASE_URL = "http://fulfil.invalid";

export function safeNextPath(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || /[\x00-\x1f\x7f\\]/.test(next)) {
    return "/";
  }
  try {
    const parsed = new URL(next, BASE_URL);
    return parsed.origin === BASE_URL ? parsed.pathname + parsed.search + parsed.hash : "/";
  } catch {
    return "/";
  }
}
