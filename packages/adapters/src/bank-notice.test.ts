import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { evaluateBankProof } from "@fulfil/core";
import { verifyDkimSignature, verifyDkimEmail } from "./dkim";
import { getFxQuote, mockIntentsFunding } from "./fx";

const fixture = (name: string) => readFileSync(resolve(process.cwd(), "fixtures", name));
const expected = {
  amountVnd: 50_000,
  accountNumber: "0987654321",
  transferCode: "FUL-8K2Q",
  claimedAt: new Date("2026-11-06T05:20:00Z"),
};
const run = (name: string, used = new Set<string>()) =>
  evaluateBankProof({
    dkim: verifyDkimSignature(fixture(name)),
    expected,
    usedNullifiers: used,
    now: new Date("2026-11-06T06:00:00Z"),
  });

describe("Lotus Bank fixtures", () => {
  it("passes every check on the signed notification", () => {
    const result = run("lotus-notice-valid.eml");
    expect(result.checks.filter((c) => !c.pass)).toEqual([]);
    expect(result.bankRef).toBe("LTB202611061231A1B2C3");
  });
  it("fails the wrong-amount variant on amount only", () => {
    expect(run("lotus-notice-wrong-amount.eml").checks.filter((c) => !c.pass).map((c) => c.id)).toEqual(["amount"]);
  });
  it("fails the tampered variant on the signature", () => {
    expect(verifyDkimSignature(fixture("lotus-notice-tampered.eml")).reason).toContain("body hash");
    expect(run("lotus-notice-tampered.eml").pass).toBe(false);
  });
  it("detects a replayed bank reference", () => {
    const first = run("lotus-notice-valid.eml");
    expect(run("lotus-notice-valid.eml", new Set([first.nullifier!])).checks.find((c) => c.id === "not_reused")!.pass).toBe(false);
  });
  it("does not accept the ticket sender as a bank, and keeps ticket DKIM working", () => {
    const ticket = verifyDkimSignature(fixture("sample.eml"));
    expect(ticket.valid).toBe(true);
    expect(evaluateBankProof({ dkim: ticket, expected, usedNullifiers: new Set() }).checks.find((c) => c.id === "bank_domain")!.pass).toBe(false);
    expect(verifyDkimEmail(fixture("lotus-notice-valid.eml"), ["tickets.fulfil-demo.test"]).valid).toBe(false);
  });
});
describe("fx and funding adapters", () => {
  it("uses the fixed mock rate by default", async () => {
    delete process.env.FX_SOURCE;
    expect(await getFxQuote()).toMatchObject({ vndPerUsd: 25_400, source: "mock" });
  });
  it("quotes mock Intents funding", () => {
    expect(mockIntentsFunding("USDC", 4.97, "o1")).toMatchObject({ payAmount: 4.97, mock: true });
    expect(mockIntentsFunding("NEAR", 3.2, "o1").payAmount).toBe(1);
  });
});
