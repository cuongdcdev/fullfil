import { afterEach, describe, expect, it } from "vitest";
import { allowRequest, resetRateLimits } from "../../apps/web/lib/server/v3/rate-limit";

afterEach(() => {
  delete process.env.RATE_LIMIT_SHOP_PER_MINUTE;
  resetRateLimits();
});

describe("shop rate limit identity", () => {
  it("uses Cloudflare's IP when the leftmost forwarded address rotates", () => {
    process.env.RATE_LIMIT_SHOP_PER_MINUTE = "1";
    resetRateLimits();
    const request = (spoofed: string) => new Request("http://local/api/v3/shop/catalog", {
      headers: { "cf-connecting-ip": "192.0.2.10", "x-forwarded-for": `${spoofed}, 192.0.2.20` },
    });
    expect(allowRequest(request("198.51.100.1"), "shop")).toBe(true);
    expect(allowRequest(request("198.51.100.2"), "shop")).toBe(false);
  });

  it("uses the rightmost forwarded address when no trusted IP header is present", () => {
    process.env.RATE_LIMIT_SHOP_PER_MINUTE = "1";
    resetRateLimits();
    const request = (spoofed: string) => new Request("http://local/api/v3/shop/catalog", {
      headers: { "x-forwarded-for": `${spoofed}, 192.0.2.20` },
    });
    expect(allowRequest(request("198.51.100.1"), "shop")).toBe(true);
    expect(allowRequest(request("198.51.100.2"), "shop")).toBe(false);
  });
});
