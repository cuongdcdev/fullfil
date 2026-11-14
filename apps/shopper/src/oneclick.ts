import { usdcUnits } from "./quote";
import { HttpError, TimeoutError } from "./diagnostics";
import { fetchWithTimeout, responseJson } from "./http";

export const ORIGIN_USDC = "nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1";
export const BASE_USDC = "nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near";
export type SwapQuote = { depositAddress: string; amountIn: string; amountOut: string };

export class OneClickClient {
  constructor(
    private readonly http: typeof fetch = fetch,
    private readonly jwt = process.env.ONECLICK_JWT,
  ) {}

  private headers() {
    return {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
      ...(this.jwt ? { Authorization: `Bearer ${this.jwt}` } : {}),
    };
  }

  async quote(input: {
    dry: boolean;
    amount: string;
    recipient: string;
    refundTo: string;
    deadline?: string;
  }): Promise<SwapQuote> {
    const response = await fetchWithTimeout(this.http, "https://1click.chaindefuser.com/v0/quote", {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        dry: input.dry,
        swapType: "EXACT_OUTPUT",
        originAsset: ORIGIN_USDC,
        depositType: "INTENTS",
        destinationAsset: BASE_USDC,
        amount: input.amount,
        recipient: input.recipient,
        recipientType: "DESTINATION_CHAIN",
        refundTo: input.refundTo,
        refundType: "INTENTS",
        slippageTolerance: 100,
        deadline: input.deadline ?? new Date(Date.now() + 10 * 60_000).toISOString(),
      }),
    });
    if (!response.ok) throw new HttpError(response.status);
    const envelope = await responseJson<{ quote?: Partial<SwapQuote> }>(response).catch((error) => {
      if (error instanceof TimeoutError) throw error;
      throw new Error("1Click upstream response has an unknown shape");
    });
    const quote = envelope.quote;
    if (!quote || !/^\d+$/.test(quote.amountIn ?? "") ||
      !/^\d+$/.test(quote.amountOut ?? "") ||
      (!input.dry && !quote.depositAddress)) {
      throw new Error("1Click upstream response has an unknown shape");
    }
    return {
      depositAddress: quote.depositAddress ?? "",
      amountIn: quote.amountIn!,
      amountOut: quote.amountOut!,
    };
  }

  async submit(txHash: string, depositAddress: string): Promise<void> {
    const response = await fetchWithTimeout(this.http, "https://1click.chaindefuser.com/v0/deposit/submit", {
      method: "POST", headers: this.headers(), body: JSON.stringify({ txHash, depositAddress }),
    }, 30_000);
    if (!response.ok) throw new HttpError(response.status);
  }

  async status(depositAddress: string): Promise<string> {
    const url = new URL("https://1click.chaindefuser.com/v0/status");
    url.searchParams.set("depositAddress", depositAddress);
    const response = await fetchWithTimeout(this.http, url, { headers: this.headers() });
    if (!response.ok) throw new HttpError(response.status);
    const result = await responseJson<{ status?: unknown }>(response).catch((error) => {
      if (error instanceof TimeoutError) throw error;
      throw new Error("1Click upstream response has an unknown shape");
    });
    if (typeof result.status !== "string") {
      throw new Error("1Click upstream response has an unknown shape");
    }
    return result.status;
  }
}

export { usdcUnits };
