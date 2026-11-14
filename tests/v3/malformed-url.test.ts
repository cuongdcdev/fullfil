import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "../../apps/web/middleware";

describe("malformed URL guard", () => {
  it("returns 400 for invalid percent-encoded paths", () => {
    const response = middleware(new NextRequest("http://localhost/%E0%A4%A"));
    expect(response.status).toBe(400);
  });

  it("passes valid paths through", () => {
    const response = middleware(new NextRequest("http://localhost/shop/VN"));
    expect(response.status).toBe(200);
  });
});
