import { describe, expect, it } from "vitest";
import { chmodSync, mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileJournal, serializeJournalEvent } from "./journal";
import type { OrderState } from "./state";

describe("shopper audit journal", () => {
  it("serializes only approved fields from a state containing secrets", () => {
    const state = {
      phase: "paying",
      cr_order_id: "cr-1",
      cr_order_token: "synthetic-token",
      beneficiary: "synthetic-beneficiary",
      buyer_email: "buyer@example.test",
      voucher: "synthetic-voucher",
      redeem_code: "synthetic-code",
      wallet_address: "https://example.test/?token=synthetic-url-token",
      deposit_address: "deposit-1",
      amount_in: "900000",
      tx_hash: "tx-1",
      balance_before_payment: "1000000",
    } as OrderState & Record<string, string>;
    const line = serializeJournalEvent({
      order_id: "FUL-TEST01", from_phase: "cr_created", to_phase: "paying",
      stage: "pay", state,
    }, () => Date.parse("2030-01-01T00:00:00Z"));

    expect(JSON.parse(line)).toEqual({
      ts: "2030-01-01T00:00:00.000Z", order_id: "FUL-TEST01",
      from_phase: "cr_created", to_phase: "paying", stage: "pay",
      cr_order_id: "cr-1", deposit_address: "deposit-1", amount_in: "900000",
      tx_hash: "tx-1", balance_before: "1000000", balance_after: null,
      error_code: null,
    });
    for (const secret of ["synthetic-token", "synthetic-beneficiary", "buyer@example.test",
      "synthetic-voucher", "synthetic-code", "synthetic-url-token"]) {
      expect(line).not.toContain(secret);
    }
  });

  it("appends JSON lines with mode 0600 and fixes an existing journal's mode", () => {
    const dir = mkdtempSync(join(tmpdir(), "shopper-journal-"));
    const path = join(dir, "shopper-events.jsonl");
    const journal = new FileJournal(join(dir, "shopper-state.json"), () => 1_893_456_000_000);
    journal.record({ order_id: "FUL-TEST01", stage: "claim", to_phase: "claimed" });
    expect(statSync(path).mode & 0o777).toBe(0o600);
    chmodSync(path, 0o666);
    const reopened = new FileJournal(join(dir, "shopper-state.json"));
    reopened.record({ order_id: "FUL-TEST01", stage: "pay", from_phase: "paying" });
    expect(statSync(path).mode & 0o777).toBe(0o600);
    expect(readFileSync(path, "utf8").trim().split("\n")).toHaveLength(2);
  });

  it("rejects an unsafe order ID and excludes URL-like metadata", () => {
    expect(() => serializeJournalEvent({
      order_id: "https://example.test/?token=secret", stage: "pay",
    })).toThrow("Invalid journal order ID");
    const line = serializeJournalEvent({
      order_id: "FUL-TEST01", stage: "pay", state: {
        phase: "paying", cr_order_id: "https://example.test/?token=secret",
      },
      error_code: "synthetic-secret-code",
    });
    expect(line).not.toContain("secret");
    expect(JSON.parse(line).cr_order_id).toBeNull();
    expect(JSON.parse(line).error_code).toBe("unknown");
  });

  it("retains the safe kind mismatch refusal code", () => {
    const line = serializeJournalEvent({
      order_id: "FUL-TEST01", from_phase: "spec_fetched", stage: "validate",
      error_code: "kind_mismatch",
    });
    expect(JSON.parse(line).error_code).toBe("kind_mismatch");
  });

  it("records a sent step without exposing the order token", () => {
    const line = serializeJournalEvent({
      order_id: "FUL-TEST01", from_phase: "paid_submitted", stage: "sent",
      state: { phase: "paid_submitted", tx_hash: "synthetic-tx",
        cr_order_token: "synthetic-secret-order-token", sent_marked_at: 1_800_000_000_000 },
    });
    expect(JSON.parse(line)).toMatchObject({
      stage: "sent", tx_hash: "synthetic-tx", to_phase: null,
    });
    expect(line).not.toContain("synthetic-secret-order-token");
  });
});
