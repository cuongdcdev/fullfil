import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWithTimeout, responseJson, responseText } from "./http";
import { TimeoutError } from "./diagnostics";
import { FulfilApiClient, type IntentSigner } from "./api";
import { OneClickClient } from "./oneclick";
import { CryptorefillsClient } from "./cryptorefills";
import { ShopperEscrowRpc } from "./rpc";

describe("shopper HTTP timeouts", () => {
  afterEach(() => vi.restoreAllMocks());

  it("aborts a slow fetch and maps the DOM timeout to TimeoutError", async () => {
    const slow = vi.fn((_url: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        signal?.addEventListener("abort", () => reject(signal.reason), { once: true });
      }));

    await expect(fetchWithTimeout(slow as typeof fetch, "https://example.test", {}, 10))
      .rejects.toBeInstanceOf(TimeoutError);
    expect(slow).toHaveBeenCalledTimes(1);
  });

  it("composes an existing signal and maps AbortError", async () => {
    const controller = new AbortController();
    const slow = vi.fn((_url: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        signal?.addEventListener("abort", () => reject(signal.reason), { once: true });
      }));
    const pending = fetchWithTimeout(slow as typeof fetch, "https://example.test",
      { signal: controller.signal }, 1_000);
    controller.abort(new DOMException("aborted", "AbortError"));

    await expect(pending).rejects.toBeInstanceOf(TimeoutError);
    const [, init] = slow.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.signal).not.toBe(controller.signal);
  });

  it("maps a timeout while reading a response body", async () => {
    const body = {
      json: async () => { throw new DOMException("late", "TimeoutError"); },
      text: async () => { throw new DOMException("late", "AbortError"); },
    } as unknown as Response;
    await expect(responseJson(body)).rejects.toBeInstanceOf(TimeoutError);
    await expect(responseText(body)).rejects.toBeInstanceOf(TimeoutError);
  });

  it("passes bounded signals through all four shopper clients", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout");
    const apiHttp = vi.fn(async () => Response.json({ ok: true }));
    const signer = { publicKey: "ed25519:synthetic" } as IntentSigner;
    const api = new FulfilApiClient("https://api.example.test", "shopper.test", signer,
      apiHttp as typeof fetch);
    await api.request("GET", "/me");

    const oneClickHttp = vi.fn(async (url: string | URL) => {
      if (String(url).includes("/quote")) {
        return Response.json({ quote: { amountIn: "900000", amountOut: "890000",
          depositAddress: "deposit-1" } });
      }
      if (String(url).includes("/status")) return Response.json({ status: "SUCCESS" });
      return Response.json({});
    });
    const oneClick = new OneClickClient(oneClickHttp as typeof fetch);
    await oneClick.quote({ dry: false, amount: "890000", recipient: "merchant.test",
      refundTo: "shopper.test" });
    await oneClick.submit("tx-1", "deposit-1");
    await oneClick.status("deposit-1");

    const cryptorefillsHttp = vi.fn(async () => Response.json({
      result: { structuredContent: { result: {} } },
    }));
    const cryptorefills = new CryptorefillsClient(cryptorefillsHttp as typeof fetch);
    await cryptorefills.call("synthetic", {});

    const rpcHttp = vi.fn(async () => Response.json({
      result: { result: [...Buffer.from("null")] },
    }));
    const rpc = new ShopperEscrowRpc(rpcHttp as typeof fetch);
    await rpc.getOrder("FUL-TEST01");

    for (const http of [apiHttp, oneClickHttp, cryptorefillsHttp, rpcHttp]) {
      for (const [, init] of http.mock.calls as unknown as Array<[unknown, RequestInit]>) {
        expect(init.signal).toBeInstanceOf(AbortSignal);
      }
    }
    expect(timeout.mock.calls.map(([ms]) => ms)).toEqual([
      20_000, 20_000, 30_000, 20_000, 20_000, 20_000,
    ]);
  });
});
