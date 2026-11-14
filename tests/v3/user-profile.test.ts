import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.DATABASE_URL = `file:/tmp/fulfil-user-profile-${process.pid}-${Date.now()}.db`;
  process.env.FULFIL_MODE = "mock";
  process.env.NODE_ENV = "test";
});

import { GET, PUT } from "../../apps/web/lib/server/v3/handler";
import { PUT as routePut } from "../../apps/web/app/api/v3/[...path]/route";
import { signSession } from "../../apps/web/lib/server/v3/auth";
import { canSeeCounterpartyContacts, userProfileInput } from "../../apps/web/lib/server/v3/user-profile";
import { put } from "../../apps/web/lib/server/db";
import type { V3Order } from "../../apps/web/lib/server/v3/escrow";

const buyer = "buyer.example.near";
const fulfiller = "fulfiller.example.near";
const stranger = "stranger.example.near";
const cookie = (account: string) => `fulfil_v3_session=${signSession({
  account_id: account,
  standard: "nep413",
  exp: Date.now() + 60_000,
})}`;
const context = (path: string) => ({ params: Promise.resolve({ path: path.split("/") }) });
const request = (path: string, account?: string, method = "GET", value?: unknown) => new Request(
  `http://localhost:3000/api/v3/${path}`,
  {
    method,
    headers: {
      ...(account ? { cookie: cookie(account) } : {}),
      ...(value ? { "content-type": "application/json" } : {}),
    },
    body: value ? JSON.stringify(value) : undefined,
  },
);
const profile = {
  display_name: "Example User",
  bio: "Synthetic bio",
  contacts: { x: "@example_user", telegram: "@example_user", email: "user@example.com" },
};
const order = (overrides: Partial<V3Order> = {}): V3Order => ({
  id: "PROFILE-ORDER",
  buyer,
  fulfiller,
  claimed_at: String(Date.now() * 1_000_000),
  status: "claimed",
  ended_at: null,
  paid_at: null,
  ...overrides,
} as V3Order);

describe("user profile", () => {
  it("cleans text, normalizes handles, and rejects bad values", () => {
    expect(userProfileInput.parse({
      ...profile,
      display_name: "  <b>Example</b>\u0001 Name  ",
      bio: "<script>hello</script> <world> there\u0000",
    })).toMatchObject({
      display_name: "Example Name",
      bio: "hello  there",
      contacts: { x: "example_user", telegram: "example_user" },
    });
    expect(() => userProfileInput.parse({ ...profile, bio: "x".repeat(281) })).toThrow();
    expect(() => userProfileInput.parse({ ...profile, contacts: { x: "bad-handle" } })).toThrow();
    expect(() => userProfileInput.parse({ ...profile, contacts: { telegram: "@abcd" } })).toThrow();
    expect(() => userProfileInput.parse({ ...profile, contacts: { email: "not-an-email" } })).toThrow();
  });

  it("uses the session account and keeps contacts out of public responses", async () => {
    const saved = await routePut(request("me/profile", buyer, "PUT", { ...profile, account_id: stranger }), context("me/profile"));
    expect(saved.status).toBe(200);
    expect((await saved.json()).account_id).toBe(buyer);
    const own = await GET(request("me/profile", buyer), context("me/profile"));
    expect((await own.json()).contacts.email).toBe("user@example.com");
    const publicResponse = await GET(request(`user-profile/${buyer}`), context(`user-profile/${buyer}`));
    expect(publicResponse.status).toBe(200);
    const publicBody = await publicResponse.json();
    expect(publicBody).not.toHaveProperty("contacts");
    expect(publicBody.display_name).toBe("Example User");
    expect(await GET(request("me/profile"), context("me/profile"))).toHaveProperty("status", 401);
    expect(await PUT(request("me/profile", buyer, "PUT", { ...profile, bio: "x".repeat(281) }), context("me/profile"))).toHaveProperty("status", 400);
  });

  it("allows only claimed-order participants and expires final access after seven days", async () => {
    const now = Date.now();
    const active = order();
    expect(canSeeCounterpartyContacts(active, buyer, now)).toBe(true);
    expect(canSeeCounterpartyContacts(active, fulfiller, now)).toBe(true);
    expect(canSeeCounterpartyContacts(active, stranger, now)).toBe(false);
    expect(canSeeCounterpartyContacts(order({ fulfiller: null, claimed_at: null, status: "funded" }), buyer, now)).toBe(false);
    expect(canSeeCounterpartyContacts(order({ status: "paid", ended_at: String((now - 8 * 86_400_000) * 1_000_000) }), buyer, now)).toBe(false);
    expect(canSeeCounterpartyContacts(order({ status: "paid", ended_at: String((now - 6 * 86_400_000) * 1_000_000) }), buyer, now)).toBe(true);
    expect(canSeeCounterpartyContacts(order({ status: "closed", ended_at: null }), buyer, now)).toBe(false);

    put(`v3:order:${active.id}`, "v3:order", active);
    const path = `orders/${active.id}/contact`;
    const buyerContact = await GET(request(path, buyer), context(path));
    expect(buyerContact.status).toBe(200);
    expect(await buyerContact.json()).toEqual({ account_id: fulfiller, display_name: "", contacts: {} });
    const fulfillerContact = await GET(request(path, fulfiller), context(path));
    expect(fulfillerContact.status).toBe(200);
    expect((await fulfillerContact.json()).contacts.email).toBe("user@example.com");
    expect((await GET(request(path, stranger), context(path))).status).toBe(403);
    expect((await GET(request(path), context(path))).status).toBe(401);
    put(`v3:order:${active.id}`, "v3:order", order({ fulfiller: null, claimed_at: null, status: "funded" }));
    expect((await GET(request(path, buyer), context(path))).status).toBe(403);
    put(`v3:order:${active.id}`, "v3:order", order({ status: "paid", ended_at: String((now - 8 * 86_400_000) * 1_000_000) }));
    expect((await GET(request(path, buyer), context(path))).status).toBe(403);
    put(`v3:order:${active.id}`, "v3:order", order({ status: "paid", ended_at: String((now - 6 * 86_400_000) * 1_000_000) }));
    expect((await GET(request(path, buyer), context(path))).status).toBe(200);
  });
});
