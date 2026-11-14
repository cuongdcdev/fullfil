import { afterEach, describe, expect, it, vi } from "vitest";
import { alertInput, alertLine, WebhookAlerter } from "./alerts";

describe("shopper alerts", () => {
  afterEach(() => vi.restoreAllMocks());

  it("prints exactly one safe line and posts only approved JSON fields", async () => {
    const http = vi.fn(async () => new Response(null, { status: 204 }));
    const log = vi.fn();
    const alerter = new WebhookAlerter("https://alerts.example.test/hook",
      http as typeof fetch, log, () => Date.parse("2030-01-01T00:00:00Z"));
    const input = alertInput("FUL-TEST01", "uncertain", "pay", "payment_unknown");
    alerter.alert(input);
    await vi.waitFor(() => expect(http).toHaveBeenCalledTimes(1));

    expect(log).toHaveBeenCalledExactlyOnceWith(
      "ALERT order=FUL-TEST01 phase=uncertain stage=pay code=payment_unknown");
    const [url, init] = http.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://alerts.example.test/hook");
    expect(init).toMatchObject({ method: "POST", headers: {
      "Content-Type": "application/json", "User-Agent": expect.stringContaining("Mozilla/5.0"),
    } });
    expect(JSON.parse(String(init.body))).toEqual({
      order_id: "FUL-TEST01", phase: "uncertain", stage: "pay",
      code: "payment_unknown", ts: "2030-01-01T00:00:00.000Z",
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("swallows webhook failures and timeouts without a second log line", async () => {
    const log = vi.fn();
    const http = vi.fn(async () => { throw new DOMException("timeout", "AbortError"); });
    const timeout = vi.spyOn(AbortSignal, "timeout");
    const alerter = new WebhookAlerter("http://localhost:3104/hook",
      http as typeof fetch, log);

    expect(() => alerter.alert(alertInput("FUL-TEST01", "failed", "proof", "HttpError_503")))
      .not.toThrow();
    await vi.waitFor(() => expect(http).toHaveBeenCalledTimes(1));
    expect(timeout).toHaveBeenCalledWith(5_000);
    expect(log).toHaveBeenCalledExactlyOnceWith(
      "ALERT order=FUL-TEST01 phase=failed stage=proof code=HttpError_503");

    const nonOk = new WebhookAlerter("https://alerts.example.test/hook",
      vi.fn(async () => new Response(null, { status: 500 })) as typeof fetch, log);
    nonOk.alert(alertInput("FUL-TEST02", "uncertain", "poll", "swap_timeout"));
    await Promise.resolve();
    expect(log).toHaveBeenCalledTimes(2);
  });

  it("rejects remote HTTP webhooks and sanitizes unsafe values", () => {
    expect(() => new WebhookAlerter("http://alerts.example.test/hook")).toThrow();
    expect(() => new WebhookAlerter("https://user:secret@alerts.example.test/hook")).toThrow();
    expect(alertLine({ order_id: "https://example.test/?token=secret", phase: "failed",
      stage: "unknown", code: "bad code" }))
      .toBe("ALERT order=unknown phase=failed stage=unknown code=unknown");
  });
});
