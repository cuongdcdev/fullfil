import { describe, expect, it } from "vitest";
import { displayName, formatVolume, groupEntries, inferType, mergeFulfillers, parseProfile, totals } from "./fulfillers-directory";

const raw = (over: Record<string, unknown> = {}) => ({
  account_id: "x.near",
  profile: { bank_bin: "970432", account_last4: "1234", registered_at: "1" },
  stats: { jobs_done: 4, star_sum: 20, star_count: 4, disputes_won: 1, disputes_lost: 0, volume: "2491733" },
  level: 0, approved: true, ...over,
});

describe("parseProfile", () => {
  it("reads public stats and never exposes bank fields", () => {
    const profile = parseProfile(raw())!;
    expect(profile).toMatchObject({ approved: true, jobsDone: 4, rating: 5, volume: BigInt(2_491_733), disputesWon: 1 });
    expect(JSON.stringify(profile, (_k, v) => (typeof v === "bigint" ? String(v) : v))).not.toMatch(/970432|1234|bank/);
  });
  it("gives no rating without stars and tolerates junk", () => {
    expect(parseProfile(raw({ stats: { jobs_done: 2, star_sum: 0, star_count: 0, volume: "2100000" } }))?.rating).toBeNull();
    expect(parseProfile(null)).toBeNull();
    expect(parseProfile({ stats: 5 })).toBeNull();
  });
});

describe("names and types", () => {
  it("cleans registry names and prettifies accounts", () => {
    expect(displayName("fullfiller1.near", "Fullfiller One — VietQR bank transfers")).toBe("Fulfiller One");
    expect(displayName("hermes-fulfiller.near")).toBe("Hermes fulfiller");
    expect(displayName("shopper.nearfullfil.near")).toBe("Shopper");
  });
  it("infers person, shopper bot and AI agent", () => {
    expect(inferType("fullfiller1.near", ["bank_transfer"], "human")).toBe("human");
    expect(inferType("shopper.nearfullfil.near", ["cryptorefills_topup"], "Fulfil", true)).toBe("shopper_bot");
    expect(inferType("hermes-fulfiller.near", ["token_buy"])).toBe("ai_agent");
    expect(inferType("someone.near", ["token_buy"])).toBe("ai_agent");
    expect(inferType("someone.near", ["in_person"])).toBe("human");
  });
});

describe("mergeFulfillers", () => {
  const registry = [
    { account_id: "shopper.nearfullfil.near", name: "Official Fulfil Shopper", kinds: ["cryptorefills_topup", "cryptorefills_code"], operator: "Fulfil", official: true },
    { account_id: "fullfiller1.near", name: "Fullfiller One — VietQR", kinds: ["bank_transfer"], operator: "human" },
  ];
  const orders = [
    { fulfiller: "fullfiller1.near", kind: "in_person" },
    { fulfiller: "hermes-fulfiller.near", kind: "token_buy" },
    { fulfiller: null, kind: "token_buy" },
  ];
  const profiles = {
    "fullfiller1.near": parseProfile(raw()),
    "hermes-fulfiller.near": parseProfile(raw({ stats: { jobs_done: 2, star_sum: 0, star_count: 0, volume: "2100000" }, approved: false })),
    "shopper.nearfullfil.near": parseProfile(raw({ stats: { jobs_done: 1, star_sum: 0, star_count: 0, volume: "959094" }, approved: false })),
  };
  const merged = mergeFulfillers({ registry, orders, profiles });
  it("includes chain-only fulfillers and sorts by jobs done", () => {
    expect(merged.map((e) => e.account)).toEqual(["fullfiller1.near", "hermes-fulfiller.near", "shopper.nearfullfil.near"]);
    const hermes = merged[1];
    expect(hermes).toMatchObject({ listed: false, type: "ai_agent", name: "Hermes fulfiller" });
    expect(merged[0].kinds.sort()).toEqual(["bank_transfer", "in_person"]);
    expect(merged[2]).toMatchObject({ official: true, type: "shopper_bot", name: "Official Fulfil Shopper" });
  });
  it("groups by kind and totals the stats", () => {
    const groups = groupEntries(merged);
    expect(groups.nearby.map((e) => e.account)).toEqual(["fullfiller1.near"]);
    expect(groups.qr).toHaveLength(1);
    expect(groups.token.map((e) => e.account)).toEqual(["hermes-fulfiller.near"]);
    expect(groups.online.map((e) => e.account)).toEqual(["shopper.nearfullfil.near"]);
    expect(totals(merged)).toEqual({ jobs: 7, volume: BigInt(2_491_733 + 2_100_000 + 959_094) });
    expect(formatVolume(BigInt(2_491_733))).toBe("$2.49");
  });
  it("keeps entries when no profile could be read", () => {
    const offline = mergeFulfillers({ registry, orders: [], profiles: {} });
    expect(offline).toHaveLength(2);
    expect(offline.every((e) => e.profile === null)).toBe(true);
  });
});
