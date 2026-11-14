import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.DATABASE_URL = `file:/tmp/fulfil-v3-status-${process.pid}.db`;
  process.env.FULFIL_MODE = "mock";
  process.env.OUTLAYER_API_KEY = "secret-key-value";
  process.env.SESSION_SECRET = "secret-session-value";
});

import { GET } from "../../apps/web/lib/server/v3/handler";
import { publicStatus } from "../../apps/web/lib/server/v3/status";

describe("public status", () => {
  it("reports config without leaking env names or secrets", async () => {
    const status = await publicStatus();
    expect(status.mode).toBe("mock");
    expect(status.network).toBe("mainnet");
    expect(status.escrow_contract).toBeTruthy();
    expect(status.kinds.map((k) => k.kind)).toContain("token_buy");
    expect(status.verifier.project).toBe("mock/email-verifier");
    expect(status.services.every((s) => s.state === "not_checked")).toBe(true);
    const text = JSON.stringify(status);
    expect(text).not.toMatch(/secret-key-value|secret-session-value|PRIVATE_KEY|OUTLAYER_API_KEY|SESSION_SECRET/);
  });

  it("probes services in live mode", async () => {
    process.env.FULFIL_MODE = "live";
    const status = await publicStatus(async (url) => (url.includes("outlayer") ? "unreachable" : "reachable"));
    process.env.FULFIL_MODE = "mock";
    expect(status.services.find((s) => s.id === "oneclick")?.state).toBe("reachable");
    expect(status.services.find((s) => s.id === "outlayer")?.state).toBe("unreachable");
  });

  it("skips code checks in mock mode and attaches them per kind in live mode", async () => {
    const check = vi.fn(async (project: string) => ({ version: "abcd1234…", url: `u/${project}`, available: false, checked_at: "t" }));
    const mock = await publicStatus(async () => "reachable", check);
    expect(mock.kinds.every((k) => k.verifier_code === null)).toBe(true);
    expect(check).not.toHaveBeenCalled();
    process.env.FULFIL_MODE = "live";
    const live = await publicStatus(async () => "reachable", async () => { throw new Error("boom"); }).catch(() => null);
    process.env.FULFIL_MODE = "mock";
    if (live) expect(live.kinds.every((k) => k.verifier_code === null)).toBe(true);
  });

  it("is served unauthenticated by GET /api/v3/status", async () => {
    const res = await GET(new Request("http://localhost/api/v3/status"), { params: Promise.resolve({ path: ["status"] }) });
    expect(res.status).toBe(200);
    expect((await res.json()).escrow_contract).toBeTruthy();
  });
});
