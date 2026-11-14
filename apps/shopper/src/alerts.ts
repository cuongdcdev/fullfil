import { safeCycleStage, safeDiagnosticCode, type CycleStage } from "./diagnostics";
import type { Phase } from "./state";

export type AlertInput = {
  order_id: string;
  phase: "uncertain" | "failed";
  stage: CycleStage;
  code: string;
};

export type Alerter = { alert(input: AlertInput): void };

const USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const safeValue = /^[A-Za-z0-9_.:-]{1,160}$/;

export function safeAlertValue(value: string): string {
  return safeValue.test(value) ? value : "unknown";
}

export function alertLine(input: AlertInput): string {
  return `ALERT order=${safeAlertValue(input.order_id)} phase=${safeAlertValue(input.phase)} ` +
    `stage=${safeCycleStage(input.stage)} code=${safeDiagnosticCode(input.code)}`;
}

export function alertInput(
  orderId: string,
  phase: Phase,
  stage: CycleStage,
  code: string,
): AlertInput {
  if (phase !== "uncertain" && phase !== "failed") {
    throw new Error("Invalid alert phase");
  }
  return { order_id: safeAlertValue(orderId), phase, stage: safeCycleStage(stage),
    code: safeDiagnosticCode(code) };
}

export class WebhookAlerter implements Alerter {
  private readonly url?: string;

  constructor(
    webhookUrl: string | undefined,
    private readonly http: typeof fetch = fetch,
    private readonly log: (line: string) => void = console.error,
    private readonly clock: () => number = Date.now,
  ) {
    if (!webhookUrl) return;
    let url: URL;
    try {
      url = new URL(webhookUrl);
    } catch {
      throw new Error("Invalid shopper alert webhook");
    }
    if (url.username || url.password || url.hash ||
      (url.protocol !== "https:" && !(url.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(url.hostname)))) {
      throw new Error("Invalid shopper alert webhook");
    }
    this.url = url.toString();
  }

  alert(input: AlertInput): void {
    this.log(alertLine(input));
    void this.send(input).catch(() => {});
  }

  async send(input: AlertInput): Promise<void> {
    if (!this.url) return;
    const response = await this.http(this.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": USER_AGENT },
      body: JSON.stringify({
        order_id: safeAlertValue(input.order_id),
        phase: safeAlertValue(input.phase),
        stage: safeCycleStage(input.stage),
        code: safeDiagnosticCode(input.code),
        ts: new Date(this.clock()).toISOString(),
      }),
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) throw new Error("Shopper alert webhook failed");
  }
}
