import { describe, expect, it, vi } from "vitest";
import { ShopperEscrowRpc } from "./rpc";

const order = {
  id: "FUL-TEST01",
  kind: "cryptorefills_topup",
  status: "claimed",
  spec_hash: "a".repeat(64),
  fulfiller: "shopper.test",
  pay_amount: "1000000",
  quoted_by: "shopper.test",
  created_at: "1800000000000000000",
  deadline_ns: "1800001800000000000",
  sent_at: null,
};

describe("shopper escrow RPC", () => {
  it("reads the final get_order view directly from NEAR RPC", async () => {
    const http = vi.fn(async () => new Response(JSON.stringify({
      result: { result: [...Buffer.from(JSON.stringify(order))] },
    })));
    const rpc = new ShopperEscrowRpc(http as typeof fetch);

    expect(await rpc.getOrder(order.id)).toEqual(order);

    const [url, init] = http.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://rpc.mainnet.fastnear.com");
    expect(init.headers).toMatchObject({
      "Content-Type": "application/json",
      "User-Agent": expect.stringContaining("Mozilla/5.0"),
    });
    const request = JSON.parse(String(init.body));
    expect(request).toMatchObject({
      jsonrpc: "2.0",
      method: "query",
      params: {
        request_type: "call_function",
        finality: "final",
        account_id: "nearfullfil.near",
        method_name: "get_order",
      },
    });
    expect(JSON.parse(Buffer.from(request.params.args_base64, "base64").toString()))
      .toEqual({ id: order.id });
  });

  it("rejects malformed RPC results and never treats them as an order", async () => {
    const http = vi.fn(async () => new Response(JSON.stringify({ result: { result: [123] } })));
    const rpc = new ShopperEscrowRpc(http as typeof fetch);
    await expect(rpc.getOrder(order.id)).rejects.toThrow();
  });

  it("parses an optional claimed_at timestamp and rejects a malformed one", async () => {
    const claimed = { ...order, claimed_at: "1800000060000000000" };
    const http = vi.fn(async () => new Response(JSON.stringify({
      result: { result: [...Buffer.from(JSON.stringify(claimed))] },
    })));
    const rpc = new ShopperEscrowRpc(http as typeof fetch);
    expect(await rpc.getOrder(order.id)).toEqual(claimed);

    http.mockImplementation(async () => new Response(JSON.stringify({
      result: { result: [...Buffer.from(JSON.stringify({ ...claimed, claimed_at: "bad" }))] },
    })));
    await expect(rpc.getOrder(order.id)).rejects.toThrow("Invalid escrow order view");
    http.mockImplementation(async () => new Response(JSON.stringify({
      result: { result: [...Buffer.from(JSON.stringify({ ...claimed, claimed_at: 123 }))] },
    })));
    await expect(rpc.getOrder(order.id)).rejects.toThrow("Invalid escrow order view");
  });

  it("reads the kind proof timeout used by recovery", async () => {
    const config = { cryptorefills_topup: { proof_timeout_ns: "1800000000000" } };
    const http = vi.fn(async () => new Response(JSON.stringify({
      result: { result: [...Buffer.from(JSON.stringify(config))] },
    })));
    const rpc = new ShopperEscrowRpc(http as typeof fetch);

    expect(await rpc.getKinds()).toEqual(config);
    const [, init] = http.mock.calls[0] as unknown as [string, RequestInit];
    const request = JSON.parse(String(init.body));
    expect(request.params.method_name).toBe("get_kinds");
  });

  it("reads and caches the kind claim timeout from get_kinds", async () => {
    const kinds = { cryptorefills_topup: {
      proof_timeout_ns: "1800000000000", claim_timeout_ns: "900000000000",
    } };
    const http = vi.fn(async () => new Response(JSON.stringify({
      result: { result: [...Buffer.from(JSON.stringify(kinds))] },
    })));
    const rpc = new ShopperEscrowRpc(http as typeof fetch);

    expect(await rpc.getClaimTimeoutNs("cryptorefills_topup")).toBe("900000000000");
    expect(await rpc.getClaimTimeoutNs("cryptorefills_topup")).toBe("900000000000");
    expect(await rpc.getClaimTimeoutNs("unknown_kind")).toBeNull();
    expect(http).toHaveBeenCalledTimes(1);
    const [, init] = http.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body)).params.method_name).toBe("get_kinds");
  });

  it("uses the configured RPC URL and escrow account", async () => {
    const previousUrl = process.env.NEAR_RPC_URL;
    const previousContract = process.env.SHOPPER_ESCROW_CONTRACT;
    process.env.NEAR_RPC_URL = "https://rpc.example.test";
    process.env.SHOPPER_ESCROW_CONTRACT = "escrow.test";
    const http = vi.fn(async () => new Response(JSON.stringify({
      result: { result: [...Buffer.from("null")] },
    })));
    try {
      const rpc = new ShopperEscrowRpc(http as typeof fetch);
      expect(await rpc.getOrder(order.id)).toBeNull();
      const [url, init] = http.mock.calls[0] as unknown as [string, RequestInit];
      expect(url).toBe("https://rpc.example.test");
      expect(JSON.parse(String(init.body)).params.account_id).toBe("escrow.test");
    } finally {
      if (previousUrl === undefined) delete process.env.NEAR_RPC_URL;
      else process.env.NEAR_RPC_URL = previousUrl;
      if (previousContract === undefined) delete process.env.SHOPPER_ESCROW_CONTRACT;
      else process.env.SHOPPER_ESCROW_CONTRACT = previousContract;
    }
  });
});
