import { describe, expect, it } from "vitest";
import { buildVietQr, parseVietQr, bankNameFromBin, crc16, tlv } from "./index";

describe("buildVietQr", () => {
  const args = { bin: "971025", account: "PSP2610510800000167", amountVnd: 10000, note: "FUL-2A6D0AEE" };
  it("round-trips through parseVietQr", () => {
    const qr = buildVietQr(args);
    const p = parseVietQr(qr);
    expect(p.bankBin).toBe("971025");
    expect(p.accountNumber).toBe(args.account);
    expect(p.amountVnd).toBe(10000);
    expect(p.bank).toBe("MoMo (e-wallet)");
    expect(tlv(tlv(qr).get("62")!).get("08")).toBe("FUL-2A6D0AEE");
    expect(tlv(qr).get("01")).toBe("12");
    expect(qr.slice(-4)).toBe(crc16(qr.slice(0, -4)));
  });
  it("rejects bad input", () => {
    expect(() => buildVietQr({ ...args, bin: "12" })).toThrow();
    expect(() => buildVietQr({ ...args, amountVnd: 1.5 })).toThrow();
    expect(() => buildVietQr({ ...args, note: "x".repeat(26) })).toThrow();
  });
  it("names real BINs", () => {
    expect(bankNameFromBin("970432")).toBe("VPBank");
    expect(bankNameFromBin("123456")).toBe("Bank 123456");
  });
});
