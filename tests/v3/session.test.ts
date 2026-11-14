import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.DATABASE_URL = `file:/tmp/fulfil-v3-session-${process.pid}-${Date.now()}.db`;
  process.env.FULFIL_MODE = "mock";
});

describe("v3 session secret", () => {
  it("survives module reloads and still prefers SESSION_SECRET", async () => {
    const previousEnv = process.env.SESSION_SECRET;
    const shared = globalThis as typeof globalThis & {
      __fulfilSessionSecret?: Buffer;
      __fulfilSessionWarningShown?: boolean;
    };
    const previousGenerated = shared.__fulfilSessionSecret;
    const previousWarning = shared.__fulfilSessionWarningShown;
    const session = {
      account_id: "synthetic-user.test",
      standard: "nep413" as const,
      exp: Date.now() + 60_000,
    };

    try {
      delete process.env.SESSION_SECRET;
      delete shared.__fulfilSessionSecret;
      delete shared.__fulfilSessionWarningShown;
      vi.resetModules();
      const first = await import("../../apps/web/lib/server/v3/auth");
      const generatedToken = first.signSession(session);
      const generatedSecret = shared.__fulfilSessionSecret;

      vi.resetModules();
      const second = await import("../../apps/web/lib/server/v3/auth");
      expect(second.readSession(generatedToken)).toEqual(session);
      expect(shared.__fulfilSessionSecret).toBe(generatedSecret);

      process.env.SESSION_SECRET = "synthetic-explicit-session-secret";
      vi.resetModules();
      const third = await import("../../apps/web/lib/server/v3/auth");
      expect(third.readSession(generatedToken)).toBeUndefined();
      const configuredToken = third.signSession(session);

      vi.resetModules();
      const fourth = await import("../../apps/web/lib/server/v3/auth");
      expect(fourth.readSession(configuredToken)).toEqual(session);
    } finally {
      if (previousEnv === undefined) delete process.env.SESSION_SECRET;
      else process.env.SESSION_SECRET = previousEnv;
      if (previousGenerated === undefined) delete shared.__fulfilSessionSecret;
      else shared.__fulfilSessionSecret = previousGenerated;
      if (previousWarning === undefined) delete shared.__fulfilSessionWarningShown;
      else shared.__fulfilSessionWarningShown = previousWarning;
      vi.resetModules();
    }
  });
});
