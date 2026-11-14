import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const viewMock = vi.hoisted(() => vi.fn());
vi.mock("../../apps/web/lib/server/v3/rpc", () => ({
  view: viewMock,
  NEAR_RPC_CONFIG_TTL_MS: 60_000,
}));

import {
  __resetVerifierCodeCacheForTests,
  CODE_MISSING_TTL_MS,
  CODE_OK_TTL_MS,
  verifierCode,
} from "../../apps/web/lib/server/v3/verifier-code";

const VERSION = "dc16e5ae4d065d556b848cdf532cb84a9f7aed7dd6a626f5192b4c4ed30efabb";
const PROJECT = "nearfullfil.near/email-verifier";

describe("verifierCode", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    __resetVerifierCodeCacheForTests();
    viewMock.mockReset().mockResolvedValue({ active_version: VERSION });
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.useFakeTimers({ toFake: ["Date"] });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("reports available when the wasm answers 200 (Range ignored)", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 200, headers: { "content-length": "685266" } }));
    const result = await verifierCode(PROJECT);
    expect(result).toMatchObject({
      version: "dc16e5ae…",
      url: `https://main.fastfs.io/nearfullfil.near/outlayer.near/${VERSION}.wasm`,
      available: true,
    });
    expect(viewMock).toHaveBeenCalledWith("outlayer.near", "get_project", { project_id: PROJECT }, expect.anything());
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Range).toBe("bytes=0-0");
  });

  it("reports available:false on 404", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 404 }));
    expect((await verifierCode(PROJECT)).available).toBe(false);
  });

  it("reports available:false for an empty file", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 200, headers: { "content-length": "0" } }));
    expect((await verifierCode(PROJECT)).available).toBe(false);
  });

  it("reports unknown (null) on timeout, 5xx or RPC failure, and does not cache it", async () => {
    fetchMock.mockRejectedValueOnce(new DOMException("timed out", "TimeoutError"));
    expect((await verifierCode(PROJECT)).available).toBeNull();
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 503 }));
    expect((await verifierCode(PROJECT)).available).toBeNull();
    viewMock.mockRejectedValueOnce(new Error("rpc down"));
    expect(await verifierCode(PROJECT)).toMatchObject({ available: null, version: null, url: null });
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }));
    expect((await verifierCode(PROJECT)).available).toBe(true);
  });

  it("caches positive results for 5 minutes and negative ones for 60 seconds", async () => {
    vi.setSystemTime(new Date("2026-11-10T10:00:00Z"));
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    await verifierCode(PROJECT);
    await verifierCode(PROJECT);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.setSystemTime(Date.now() + CODE_OK_TTL_MS + 1);
    fetchMock.mockImplementation(async () => new Response(null, { status: 404 }));
    expect((await verifierCode(PROJECT)).available).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await verifierCode(PROJECT);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.setSystemTime(Date.now() + CODE_MISSING_TTL_MS + 1);
    fetchMock.mockImplementation(async () => new Response(null, { status: 200 }));
    expect((await verifierCode(PROJECT)).available).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
