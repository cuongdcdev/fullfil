import { describe, expect, it } from "vitest";

describe("Vitest environment isolation", () => {
  it("starts tests in mock mode without external service keys", () => {
    expect(process.env.FULFIL_MODE).toBe("mock");
    expect(process.env.OUTLAYER_API_KEY).toBe("");
    expect(process.env.NEAR_AI_API_KEY).toBe("");
    expect(process.env.SAGE_API_KEY).toBe("");
  });
});
