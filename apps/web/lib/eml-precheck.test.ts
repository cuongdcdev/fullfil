import { describe, expect, it } from "vitest";
import { precheckEml } from "./eml-precheck";
import { vpbankEml } from "./__fixtures__/vpbank-eml";

const order = { code: "FUL-8K2Q", amountVnd: 10000, accountLast4: "6789" };
const failed = (r: ReturnType<typeof precheckEml>) => r.checks.filter((c) => c.ok === false).map((c) => c.id);

describe("precheckEml", () => {
  it("accepts a valid VPBank email (quoted-printable)", () => {
    const r = precheckEml(vpbankEml(), order);
    expect(failed(r)).toEqual([]);
    expect(r.ready).toBe(true);
    expect(r.bank).toBe("VPBank");
  });
  it("accepts base64 body, bytes input, Vietnamese amount format and spaced code", () => {
    const eml = vpbankEml({ base64: true, amount: "10.000 ₫", code: "FUL 8K2Q" });
    const r = precheckEml(new TextEncoder().encode(eml), order);
    expect(failed(r)).toEqual([]);
  });
  it("rejects text pasted into one line", () => {
    const eml = vpbankEml().replace(/\r\n/g, " ");
    const r = precheckEml(eml, order);
    expect(r.ready).toBe(false);
    expect(r.checks[0]).toMatchObject({ id: "real_email", ok: false });
    expect(r.checks[0].fix).toMatch(/Download the original file/);
  });
  it("rejects a forwarded email", () => {
    const r = precheckEml(
      vpbankEml({ subject: "Fwd: VPBank thong bao", dkim: "v=1; a=rsa-sha256; d=gmail.com; s=x; b=Zg==" }),
      order,
    );
    expect(failed(r)).toContain("not_forward");
    expect(failed(r)).toContain("bank_stamp");
    expect(r.ready).toBe(false);
  });
  it("rejects a wrong amount", () => {
    const r = precheckEml(vpbankEml({ amount: "20,000 VND" }), order);
    expect(failed(r)).toEqual(["amount"]);
  });
  it("rejects a missing order code", () => {
    const r = precheckEml(vpbankEml({ code: "FUL-ZZZZ" }), order);
    expect(failed(r)).toEqual(["code"]);
  });
  it("rejects a signature with an l= tag", () => {
    const r = precheckEml(vpbankEml({ dkim: "v=1; a=rsa-sha256; d=vpb.com.vn; s=s; l=120; b=Zg==" }), order);
    expect(failed(r)).toContain("bank_stamp");
    expect(r.ready).toBe(false);
  });
  it("rejects a missing signature", () => {
    expect(failed(precheckEml(vpbankEml({ dkim: null }), order))).toEqual(["bank_stamp"]);
  });
  it("reads alphanumeric e-wallet accounts (MoMo PSP…)", () => {
    const r = precheckEml(vpbankEml({ account: "PSP2610510800006789" }), order);
    expect(r.checks.find((c) => c.id === "account")?.ok).toBe(true);
  });

  it("only warns on a different account", () => {
    const r = precheckEml(vpbankEml({ account: "0123450000" }), order);
    expect(r.checks.find((c) => c.id === "account")?.ok).toBe("warn");
    expect(r.ready).toBe(true);
  });
  it("checks the date against claimedAt with 10 minutes of slack", () => {
    const sent = Date.parse("2026-11-07T10:15:00+07:00");
    expect(precheckEml(vpbankEml(), { ...order, claimedAt: sent + 5 * 60_000 }).ready).toBe(true);
    const r = precheckEml(vpbankEml(), { ...order, claimedAt: sent + 30 * 60_000 });
    expect(failed(r)).toEqual(["date"]);
  });
  it("rejects files over 64 KB", () => {
    const r = precheckEml(vpbankEml() + "X".repeat(70_000), order);
    expect(failed(r)).toContain("size");
  });
});
