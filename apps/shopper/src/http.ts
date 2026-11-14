import { TimeoutError } from "./diagnostics";

export const DEFAULT_HTTP_TIMEOUT_MS = 20_000;

export function normalizeTimeoutError(error: unknown): unknown {
  if (error instanceof TimeoutError) return error;
  if (error instanceof DOMException &&
    (error.name === "AbortError" || error.name === "TimeoutError")) {
    return new TimeoutError();
  }
  return error;
}

export async function fetchWithTimeout(
  http: typeof fetch,
  url: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = DEFAULT_HTTP_TIMEOUT_MS,
): Promise<Response> {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1) {
    throw new RangeError("Invalid HTTP timeout");
  }
  const deadline = AbortSignal.timeout(timeoutMs);
  const signal = init.signal ? AbortSignal.any([init.signal, deadline]) : deadline;
  try {
    return await http(url, { ...init, signal });
  } catch (error) {
    throw normalizeTimeoutError(error);
  }
}

export async function responseJson<T>(response: Response): Promise<T> {
  try {
    return await response.json() as T;
  } catch (error) {
    throw normalizeTimeoutError(error);
  }
}

export async function responseText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch (error) {
    throw normalizeTimeoutError(error);
  }
}
