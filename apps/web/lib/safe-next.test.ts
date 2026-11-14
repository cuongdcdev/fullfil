import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-next";

describe("safeNextPath", () => {
  it("keeps a local path with its query and hash", () => {
    expect(safeNextPath("/shop/VN/x?y=1#z")).toBe("/shop/VN/x?y=1#z");
  });

  it.each([
    null,
    "//evil.com",
    "/\\evil.com",
    "/\t/evil.com",
    "/\n/evil.com",
    "https://evil.com",
    "javascript:alert(1)",
  ])("rejects an unsafe destination: %s", (next) => {
    expect(safeNextPath(next)).toBe("/");
  });
});
