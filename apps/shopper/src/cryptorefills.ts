import { HttpError } from "./diagnostics";
import { fetchWithTimeout, responseText } from "./http";

export type CryptorefillsResult = Record<string, unknown> | Record<string, unknown>[];
export type FetchLike = typeof fetch;
const endpoint = "https://api.cryptorefills.com/mcp/http";

export class CryptorefillsRpcError extends Error {
  constructor(readonly detail: string) {
    super("Cryptorefills upstream error");
  }
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Cryptorefills upstream response has an unknown shape");
  }
  return value as Record<string, unknown>;
}

export function parseMcpResponse(text: string): CryptorefillsResult {
  let envelope: Record<string, unknown>;
  try {
    if (/^data:/m.test(text)) {
      const events = text.split(/\r?\n/).filter((line) => line.startsWith("data:"));
      const event = events.map((line) => line.slice(5).trim()).filter((line) => line && line !== "[DONE]").at(-1);
      if (!event) throw new Error("empty event stream");
      envelope = object(JSON.parse(event));
    } else {
      envelope = object(JSON.parse(text));
    }
  } catch {
    throw new Error("Cryptorefills upstream response has an unknown shape");
  }
  if (envelope.error) {
    const error = object(envelope.error);
    throw new CryptorefillsRpcError(String(error.message ?? "Unknown JSON-RPC error"));
  }
  try {
    const result = object(object(envelope.result).structuredContent).result;
    return Array.isArray(result) ? result.map(object) : object(result);
  } catch {
    throw new Error("Cryptorefills upstream response has an unknown shape");
  }
}

export class CryptorefillsClient {
  constructor(private readonly http: FetchLike = fetch) {}

  async call(name: string, args: Record<string, unknown>): Promise<CryptorefillsResult> {
    const response = await fetchWithTimeout(this.http, endpoint, {
      method: "POST",
      headers: {
        "User-Agent": "Cryptorefills-MCP/1.0",
        Accept: "application/json, text/event-stream",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
    });
    const body = await responseText(response);
    if (!response.ok) {
      try {
        parseMcpResponse(body);
      } catch (error) {
        if (error instanceof CryptorefillsRpcError) throw error;
      }
      throw new HttpError(response.status);
    }
    return parseMcpResponse(body);
  }

  async listBrands(country: string) {
    return object(await this.call("listBrands", { country_code: country }));
  }
  listProducts(country: string, family?: string, brand?: string) {
    return this.call("listProductsForCountry", {
      country_code: country, coin: "USDC",
      ...(family ? { family_name: family } : {}),
      ...(brand ? { brand_name: brand } : {}),
    });
  }
  async validateOrder(delivery: Record<string, unknown>) {
    return object(await this.call("validateOrder", {
      body: {
        payment: { type: "via", payment_via: "USER_WALLET", coin: "USDC", network: "Base" },
        deliveries: [delivery],
      },
    }));
  }
  async createOrder(email: string, delivery: Record<string, unknown>) {
    return object(await this.call("createOrder", {
      body: {
        user: { email },
        payment: { type: "via", payment_via: "USER_WALLET", coin: "USDC", network: "Base" },
        deliveries: [delivery],
      },
    }));
  }
  async getOrderStatus(id: string, token: string) {
    return object(await this.call("getOrderStatus", { order_id: id, order_token: token }));
  }
}

export function requiredString(result: Record<string, unknown>, field: string): string {
  const value = result[field];
  if ((typeof value !== "string" && typeof value !== "number") || !String(value)) {
    throw new Error("Cryptorefills upstream response has an unknown shape");
  }
  return String(value);
}
