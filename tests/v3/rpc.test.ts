import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isProviderError,
  __resetRpcStateForTests,
  invalidateRpcCache,
  isFullAccessKey,
  isIntentsPublicKey,
  queryRpc,
  view,
} from "../../apps/web/lib/server/v3/rpc";
import { checkAccount } from "../../apps/web/lib/server/v3/token-buy";

const originalMode = process.env.FULFIL_MODE;
const originalUrl = process.env.NEAR_RPC_URL;
const originalRps = process.env.NEAR_RPC_MAX_RPS;
const originalConcurrency = process.env.NEAR_RPC_MAX_CONCURRENCY;
const originalTokenBuyUrls = process.env.TOKEN_BUY_RPC_URLS;

beforeEach(() => {
  __resetRpcStateForTests();
  process.env.NEAR_RPC_URL = "https://one.test,https://two.test";
  process.env.NEAR_RPC_MAX_RPS = "10000";
});

afterEach(() => {
  vi.restoreAllMocks();
  if (originalMode === undefined) delete process.env.FULFIL_MODE;
  else process.env.FULFIL_MODE = originalMode;
  if (originalUrl === undefined) delete process.env.NEAR_RPC_URL;
  else process.env.NEAR_RPC_URL = originalUrl;
  if (originalRps === undefined) delete process.env.NEAR_RPC_MAX_RPS;
  else process.env.NEAR_RPC_MAX_RPS = originalRps;
  if (originalConcurrency === undefined) delete process.env.NEAR_RPC_MAX_CONCURRENCY;
  else process.env.NEAR_RPC_MAX_CONCURRENCY = originalConcurrency;
  if (originalTokenBuyUrls === undefined) delete process.env.TOKEN_BUY_RPC_URLS;
  else process.env.TOKEN_BUY_RPC_URLS = originalTokenBuyUrls;
});

function viewResponse(value: unknown): Response {
  return new Response(JSON.stringify({
    result: { result: [...Buffer.from(JSON.stringify(value))] },
  }));
}

describe("Intents key registration RPC", () => {
  it.each([
    [true, true],
    [false, false],
    ["true", false],
    [1, false],
  ])("accepts only JSON true (%s)", async (rpcValue, expected) => {
    process.env.FULFIL_MODE = "live";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(viewResponse(rpcValue));
    expect(await isIntentsPublicKey("alice.testnet", "ed25519:synthetic"))
      .toBe(expected);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBeTruthy();
    expect(options?.signal).toBeInstanceOf(AbortSignal);
    const request = JSON.parse(String(options?.body));
    expect(request.params).toMatchObject({
      request_type: "call_function",
      account_id: "intents.near",
      method_name: "has_public_key",
    });
    expect(JSON.parse(Buffer.from(request.params.args_base64, "base64").toString()))
      .toEqual({ account_id: "alice.testnet", public_key: "ed25519:synthetic" });
  });

  it("falls back to the next RPC on 429/5xx/abort and fails when all do", async () => {
    process.env.FULFIL_MODE = "live";
    const ok = () => new Response(JSON.stringify({
      result: { result: Array.from(Buffer.from("true")) },
    }));
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("rate limited", { status: 429 }))
      .mockRejectedValueOnce(new DOMException("aborted", "AbortError"))
      .mockResolvedValueOnce(ok());
    expect(await isIntentsPublicKey("alice.testnet", "ed25519:synthetic")).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const used = String(fetchMock.mock.calls[2][0]);

    fetchMock.mockReset();
    fetchMock.mockImplementation(async () => new Response("upstream unavailable", { status: 503 }));
    invalidateRpcCache();
    await expect(isIntentsPublicKey("alice.testnet", "ed25519:synthetic"))
      .rejects.toThrow(/NEAR RPC HTTP 503/);
    // The endpoint that answered last is tried first next time.
    expect(String(fetchMock.mock.calls[0][0])).toBe(used);
  });

  it("keeps FullAccess RPC behavior and skips the Intents check in mock mode", async () => {
    process.env.FULFIL_MODE = "mock";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ result: { permission: "FullAccess" } })),
    );
    expect(await isFullAccessKey("alice.testnet", "ed25519:synthetic"))
      .toBe(true);
    expect(await isIntentsPublicKey("alice.testnet", "ed25519:synthetic"))
      .toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("shared RPC traffic control", () => {
  it("treats provider JSON-RPC errors (HTTP 200, code -429) as endpoint failures", async () => {
    process.env.FULFIL_MODE = "live";
    expect(isProviderError({ code: -429, message: "DEPRECATED" })).toBe(true);
    expect(isProviderError({ code: -32000, name: "HANDLER_ERROR", cause: { name: "CONTRACT_EXECUTION_ERROR" } })).toBe(false);
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: -429, message: "THIS ENDPOINT IS DEPRECATED" } })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: { result: Array.from(Buffer.from("true")) } })));
    expect(await isIntentsPublicKey("alice.testnet", "ed25519:provider")).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).not.toBe(fetchMock.mock.calls[1][0]);
  });

  it("coalesces identical concurrent views and caches a successful view for its TTL", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async () => viewResponse({ id: "one" }));
    const [first, second] = await Promise.all([
      view("escrow.test", "get_order", { id: "one" }),
      view("escrow.test", "get_order", { id: "one" }),
    ]);
    expect(first).toEqual(second);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await view("escrow.test", "get_order", { id: "one" })).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const realNow = Date.now.bind(Date);
    const now = vi.spyOn(Date, "now").mockImplementation(() => realNow() + 3_100);
    await view("escrow.test", "get_order", { id: "one" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    now.mockRestore();
  });

  it("never caches or coalesces simulate_intents", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async () => viewResponse({ success: true }));
    await Promise.all([
      view("intents.test", "simulate_intents", { signed: ["same"] }),
      view("intents.test", "simulate_intents", { signed: ["same"] }),
    ]);
    await view("intents.test", "simulate_intents", { signed: ["same"] });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("keeps key success longer than a negative result and never caches RPC errors", async () => {
    process.env.FULFIL_MODE = "live";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async () => viewResponse(true));
    expect(await isIntentsPublicKey("alice.test", "ed25519:key")).toBe(true);
    const realNow = Date.now.bind(Date);
    const now = vi.spyOn(Date, "now").mockImplementation(() => realNow() + 4_000);
    expect(await isIntentsPublicKey("alice.test", "ed25519:key")).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    now.mockRestore();
    __resetRpcStateForTests();

    fetchMock.mockImplementation(async () => viewResponse(false));
    expect(await isIntentsPublicKey("bob.test", "ed25519:key")).toBe(false);
    const later = vi.spyOn(Date, "now").mockImplementation(() => realNow() + 4_000);
    expect(await isIntentsPublicKey("bob.test", "ed25519:key")).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    later.mockRestore();
    __resetRpcStateForTests();

    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ error: { name: "CONTRACT_ERROR" } })));
    await expect(view("escrow.test", "broken")).rejects.toThrow(/CONTRACT_ERROR/);
    await expect(view("escrow.test", "broken")).rejects.toThrow(/CONTRACT_ERROR/);
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("caps concurrent requests and spaces starts", async () => {
    process.env.NEAR_RPC_MAX_CONCURRENCY = "4";
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    let active = 0;
    let maximum = 0;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      active += 1;
      maximum = Math.max(maximum, active);
      await gate;
      active -= 1;
      return viewResponse(true);
    });
    const pending = Array.from({ length: 8 }, (_, i) => view("escrow.test", "get_order", { id: i }));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(maximum).toBeLessThanOrEqual(4);
    release();
    await Promise.all(pending);
    expect(fetchMock).toHaveBeenCalledTimes(8);
    expect(maximum).toBeLessThanOrEqual(4);

    __resetRpcStateForTests();
    process.env.NEAR_RPC_MAX_RPS = "20";
    const starts: number[] = [];
    fetchMock.mockImplementation(async () => {
      starts.push(Date.now());
      return viewResponse(true);
    });
    await Promise.all([
      view("escrow.test", "get_order", { id: "a" }),
      view("escrow.test", "get_order", { id: "b" }),
      view("escrow.test", "get_order", { id: "c" }),
    ]);
    expect(starts[1] - starts[0]).toBeGreaterThanOrEqual(40);
    expect(starts[2] - starts[1]).toBeGreaterThanOrEqual(40);
  });

  it("honors 429 Retry-After, retries the preferred endpoint later, and makes one attempt when all cool", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockImplementation(async () => viewResponse(true))
      .mockResolvedValueOnce(new Response("", { status: 429, headers: { "Retry-After": "2" } }))
      .mockResolvedValueOnce(viewResponse(true));
    await view("escrow.test", "get_order", { id: "first" });
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://one.test");
    expect(String(fetchMock.mock.calls[1][0])).toBe("https://two.test");
    await view("escrow.test", "get_order", { id: "second" });
    expect(String(fetchMock.mock.calls[2][0])).toBe("https://two.test");
    const realNow = Date.now.bind(Date);
    const now = vi.spyOn(Date, "now").mockImplementation(() => realNow() + 2_100);
    fetchMock.mockResolvedValueOnce(new Response("", { status: 503 }))
      .mockResolvedValueOnce(viewResponse(true));
    await view("escrow.test", "get_order", { id: "third" });
    expect(String(fetchMock.mock.calls[4][0])).toBe("https://one.test");
    now.mockRestore();

    __resetRpcStateForTests();
    fetchMock.mockReset().mockResolvedValue(new Response("", { status: 429 }));
    await expect(view("escrow.test", "get_order", { id: "all" })).rejects.toThrow(/429/);
    const attempted = fetchMock.mock.calls.length;
    await expect(view("escrow.test", "get_order", { id: "again" })).rejects.toThrow(/429/);
    expect(fetchMock.mock.calls.length).toBe(attempted + 1);
  });

  it("invalidates cached results and routes account checks through the shared queue", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async () => viewResponse(1));
    await view("escrow.test", "get_counts");
    await view("escrow.test", "get_counts");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    invalidateRpcCache();
    await view("escrow.test", "get_counts");
    expect(fetchMock).toHaveBeenCalledTimes(2);

    process.env.FULFIL_MODE = "live";
    process.env.TOKEN_BUY_RPC_URLS = "https://token-rpc.test";
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ result: { amount: "1" } })));
    expect(await checkAccount("buyer.near")).toEqual({
      account_id: "buyer.near", exists: true, implicit: false,
    });
    expect(await checkAccount("buyer.near")).toEqual({
      account_id: "buyer.near", exists: true, implicit: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const body = JSON.parse(String(fetchMock.mock.calls[2][1]?.body));
    expect(body.params.request_type).toBe("view_account");
    expect(fetchMock.mock.calls[2][0]).toBe("https://token-rpc.test");
  });
});
