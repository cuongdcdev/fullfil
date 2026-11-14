import { describe, expect, it, vi } from "vitest";
import { CryptorefillsClient, CryptorefillsRpcError, parseMcpResponse, requiredString } from "./cryptorefills";
import { OneClickClient, BASE_USDC, ORIGIN_USDC } from "./oneclick";
import productGroups from "../../../tests/fixtures/cryptorefills-products-vn.json";

describe("upstream client boundaries", () => {
  it("parses JSON and SSE MCP envelopes and rejects unknown shapes", () => {
    const envelope = JSON.stringify({ result: { structuredContent: { result: { coin_amount: "0.89" } } } });
    expect(parseMcpResponse(envelope)).toEqual({ coin_amount: "0.89" });
    expect(parseMcpResponse(`event: message\ndata: ${envelope}\n\n`)).toEqual({ coin_amount: "0.89" });
    expect(() => parseMcpResponse('{"result":{}}')).toThrow("unknown shape");
  });

  it("accepts the real grouped product array in JSON and SSE envelopes", () => {
    const raw = JSON.stringify(productGroups);
    const result = parseMcpResponse(raw);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual(productGroups.result.structuredContent.result);
    expect(parseMcpResponse(`data: ${raw}\n\n`)).toEqual(result);
  });

  it("preserves an upstream JSON-RPC rejection detail without exposing it as the public error", async () => {
    const envelope = JSON.stringify({
      jsonrpc: "2.0",
      error: { code: -32602, message: "Synthetic beneficiary rejected" },
    });
    const http = vi.fn(async () => new Response(envelope, { status: 400 }));
    const client = new CryptorefillsClient(http as typeof fetch);
    const error = await client.validateOrder({ beneficiary_account: "+84900000001" })
      .catch((value: unknown) => value);
    expect(error).toBeInstanceOf(CryptorefillsRpcError);
    expect((error as CryptorefillsRpcError).message).toBe("Cryptorefills upstream error");
    expect((error as CryptorefillsRpcError).detail).toBe("Synthetic beneficiary rejected");
  });

  it("accepts extra object fields and decimal values encoded as strings or numbers", async () => {
    const envelope = JSON.stringify({ result: { structuredContent: { result: {
      order_state: "Done", extra: { ignored: true }, coin_amount: "0.88",
    } } } });
    const http = vi.fn(async () => new Response(envelope));
    const client = new CryptorefillsClient(http as typeof fetch);
    expect(await client.getOrderStatus("synthetic-order", "synthetic-token"))
      .toMatchObject({ order_state: "Done" });
    expect(requiredString({ coin_amount: "0.88" }, "coin_amount")).toBe("0.88");
    expect(requiredString({ coin_amount: 0.88 }, "coin_amount")).toBe("0.88");
  });

  it("builds the exact dry 1Click request without touching the network", async () => {
    const http = vi.fn(async () => new Response(JSON.stringify({ quote: {
      depositAddress: "deposit-1", amountIn: "910000", amountOut: "900000",
    } })));
    const client = new OneClickClient(http as typeof fetch, "synthetic-jwt");
    const quote = await client.quote({ dry: true, amount: "900000", recipient: "0x0000000000000000000000000000000000000001",
      refundTo: "shopper.test", deadline: "2030-01-01T00:00:00.000Z" });
    expect(quote.amountIn).toBe("910000");
    const [url, request] = http.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://1click.chaindefuser.com/v0/quote");
    expect(request.headers).toMatchObject({ Authorization: "Bearer synthetic-jwt" });
    expect(JSON.parse(String(request.body))).toMatchObject({ dry: true, swapType: "EXACT_OUTPUT",
      originAsset: ORIGIN_USDC, destinationAsset: BASE_USDC, depositType: "INTENTS",
      recipientType: "DESTINATION_CHAIN", refundType: "INTENTS", refundTo: "shopper.test",
      amount: "900000", slippageTolerance: 100 });
  });
});
