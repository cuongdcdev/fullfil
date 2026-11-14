import { describe, expect, it } from "vitest";
import { describeCycleError, HttpError, safeDiagnosticCode, StageError,
  type CycleStage } from "./diagnostics";

describe("shopper cycle diagnostics", () => {
  it("keeps the delivery failure code", () => {
    expect(safeDiagnosticCode("delivery_failed")).toBe("delivery_failed");
  });

  it.each(["claim_timeout", "not_claimed"])("keeps sent skip code %s", (code) => {
    expect(safeDiagnosticCode(code)).toBe(code);
  });

  it.each<CycleStage>([
    "unknown", "startup", "journal", "poll", "order", "claim", "spec", "validate", "create",
    "quote", "balance", "pay", "delivery", "proof", "release",
  ])("reports stage %s", (stage) => {
    expect(describeCycleError(new StageError(stage, new Error("secret"))))
      .toBe(`Shopper cycle failed stage=${stage} kind=Error http=-`);
  });

  it("reports a numeric status only from a typed HTTP error", () => {
    expect(describeCycleError(new StageError("claim", new HttpError(401))))
      .toBe("Shopper cycle failed stage=claim kind=HttpError http=401");
    expect(describeCycleError(new StageError("pay", new Error("HTTP 503"))))
      .toBe("Shopper cycle failed stage=pay kind=Error http=-");
    expect(describeCycleError(new HttpError(Number.NaN)))
      .toBe("Shopper cycle failed stage=unknown kind=HttpError http=-");
  });

  it("handles unknown thrown values without exposing them", () => {
    expect(describeCycleError("secret"))
      .toBe("Shopper cycle failed stage=unknown kind=Unknown http=-");
    expect(describeCycleError(new StageError("poll", null)))
      .toBe("Shopper cycle failed stage=poll kind=Unknown http=-");
  });

  it("never prints messages, response bodies, tokens, or URLs", () => {
    const secret = "order_token=fake-token https://example.test/voucher?code=fake body={secret}";
    const output = describeCycleError(new StageError("delivery", new Error(secret)));
    expect(output).toBe("Shopper cycle failed stage=delivery kind=Error http=-");
    expect(output).not.toContain(secret);
    expect(output).not.toContain("fake-token");
    expect(output).not.toContain("https://");
    expect(output).not.toContain("body=");
  });
});
