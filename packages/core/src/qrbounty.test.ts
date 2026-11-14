import { describe, expect, it } from "vitest";
import {
  QR_STAGES,
  accountMatches,
  parseBankNotice,
  parseVietQr,
  priceQr,
  qrTerminal,
  qrTransition,
  samplePhoQr,
  transferCodeFrom,
} from "./qrbounty";

describe("qr bounty core", () => {
  it("parses the fictional VietQR and masks the account", () => {
    const qr = parseVietQr(samplePhoQr(50_000));
    expect(qr).toMatchObject({ name: "PHO BAY SAO DEMO", bank: "Orchid Bank", accountMasked: "•••• 4321", amountVnd: 50_000 });
    expect(parseVietQr(samplePhoQr(null)).amountVnd).toBeUndefined();
    expect(() => parseVietQr(samplePhoQr(1).replace("6304", "6305"))).toThrow();
  });
  it("converts VND to USD rounding up, plus the reward", () => {
    expect(priceQr(50_000, 25_400, 3)).toEqual({ principalUsd: 1.97, rewardUsd: 3, totalUsd: 4.97 });
    expect(() => priceQr(50_000, 25_400, -1)).toThrow();
    expect(() => priceQr(10, 25_400, 3)).toThrow();
  });
  it("matches masked, full or hashed accounts", () => {
    expect(accountMatches("xxxxxx4321", "0987654321")).toBe(true);
    expect(accountMatches("xxxxxx9999", "0987654321")).toBe(false);
    expect(accountMatches("xxxx4321", "0987654321")).toBe(false);
    expect(accountMatches("0987654321", "0987654321")).toBe(true);
  });
  it("parses a bank notification", () => {
    const n = parseBankNotice(
      "Tai khoan 0123xxxx89 -50,000 VND luc 12:31 06/11/2026.\r\nNguoi nhan: X - STK xxxxxx4321\r\nND: FUL-8K2Q pho. So du 1,250,000 VND.\r\nMa giao dich: LTB1\r\n",
    );
    expect(n).toMatchObject({ amountVnd: 50_000, debit: true, recipient: "xxxxxx4321", note: "FUL-8K2Q pho", ref: "LTB1" });
    expect(n.at?.toISOString()).toBe("2026-11-06T05:31:00.000Z");
  });
  it("generates transfer codes from an unambiguous alphabet", () => {
    expect(transferCodeFrom(Uint8Array.from([0, 1, 2, 3]))).toBe("FUL-ABCD");
  });
  it("only allows the documented stage transitions", () => {
    expect(QR_STAGES).toHaveLength(13);
    expect(qrTransition("transfer_sent", "timeout")).toBe("under_review");
    // A timeout after the transfer was sent can never reach a refund.
    for (const stage of ["transfer_sent", "verifying", "awaiting_confirmation", "under_review"] as const)
      for (const event of ["timeout", "deny", "reject_proof"] as const) {
        try {
          expect(qrTransition(stage, event)).not.toBe("refunded");
        } catch {
          /* illegal is fine */
        }
      }
    for (const stage of ["done", "refunded", "cancelled", "expired"] as const) {
      expect(qrTerminal(stage)).toBe(true);
      expect(() => qrTransition(stage, "claim")).toThrow();
    }
    expect(() => qrTransition("claimed", "cancel")).toThrow();
    expect(() => qrTransition("finding_local", "sent")).toThrow();
  });
});
