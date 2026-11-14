export type CycleStage =
  | "unknown" | "startup" | "journal" | "poll" | "order" | "claim" | "spec" | "validate"
  | "create" | "quote" | "balance" | "pay" | "sent" | "delivery" | "proof" | "release";

const stages = new Set<CycleStage>([
  "unknown", "startup", "journal", "poll", "order", "claim", "spec", "validate",
  "create", "quote", "balance", "pay", "sent", "delivery", "proof", "release",
]);

export function safeCycleStage(value: unknown): CycleStage {
  return typeof value === "string" && stages.has(value as CycleStage)
    ? value as CycleStage : "unknown";
}

export class StageError extends Error {
  constructor(readonly stage: CycleStage, override readonly cause: unknown) {
    super("Shopper stage failed");
    this.name = "StageError";
  }
}

export class HttpError extends Error {
  constructor(readonly status: number) {
    super("HTTP request failed");
    this.name = "HttpError";
  }
}

export class TimeoutError extends Error {
  constructor() {
    super("HTTP request timed out");
    this.name = "TimeoutError";
  }
}

export function isTimeoutError(error: unknown): boolean {
  while (error instanceof StageError) error = error.cause;
  return error instanceof TimeoutError;
}

export async function atStage<T>(stage: CycleStage, work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    throw new StageError(stage, error);
  }
}

export function describeCycleError(error: unknown): string {
  let stage: CycleStage = "unknown";
  while (error instanceof StageError) {
    stage = safeCycleStage(error.stage);
    error = error.cause;
  }
  const kind = error instanceof TimeoutError ? "Timeout" :
    error instanceof HttpError ? "HttpError" :
    error instanceof TypeError ? "TypeError" :
    error instanceof RangeError ? "RangeError" :
    error instanceof SyntaxError ? "SyntaxError" :
    error instanceof Error ? "Error" : "Unknown";
  const http = error instanceof HttpError && Number.isSafeInteger(error.status) &&
    error.status >= 100 && error.status <= 599 ? String(error.status) : "-";
  return `Shopper cycle failed stage=${stage} kind=${kind} http=${http}`;
}

export function cycleErrorCode(error: unknown): string {
  const description = describeCycleError(error);
  const kind = description.match(/ kind=([A-Za-z0-9_]+) http=([0-9]+|-)/);
  if (!kind) return "Unknown";
  return kind[2] === "-" ? kind[1] : `${kind[1]}_${kind[2]}`;
}

const applicationCodes = new Set([
  "claim_lost", "order_missing", "payment_unknown", "refund_unconfirmed",
  "swap_timeout", "delivery_timeout", "delivery_failed", "reserve_floor",
  "kind_mismatch", "deadline_near", "deadline_passed",
  "claim_timeout_near", "claim_timeout_unknown", "claim_timeout", "not_claimed",
]);
const errorKinds = new Set([
  "Timeout", "HttpError", "TypeError", "RangeError", "SyntaxError", "Error", "Unknown",
]);

export function safeDiagnosticCode(code: unknown): string {
  if (typeof code !== "string") return "unknown";
  if (applicationCodes.has(code) || errorKinds.has(code)) return code;
  const match = /^HttpError_([1-5]\d{2})$/.exec(code);
  return match ? code : "unknown";
}
