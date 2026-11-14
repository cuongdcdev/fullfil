import { sha256 } from "./logic";
import type { QrPaymentSpec } from "./types";

export function crc16(input: string): string {
  let crc = 0xffff;
  for (const char of Buffer.from(input, "utf8")) {
    crc ^= char << 8;
    for (let i = 0; i < 8; i++)
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}
export function tlv(payload: string): Map<string, string> {
  const result = new Map<string, string>();
  for (let i = 0; i < payload.length;) {
    if (i + 4 > payload.length) throw new Error("Incomplete QR TLV");
    const id = payload.slice(i, i + 2),
      length = Number(payload.slice(i + 2, i + 4));
    if (!Number.isInteger(length) || i + 4 + length > payload.length)
      throw new Error("Invalid QR TLV length");
    result.set(id, payload.slice(i + 4, i + 4 + length));
    i += 4 + length;
  }
  return result;
}
export function parseQr(payload: string): QrPaymentSpec {
  const fields = tlv(payload);
  const crc = fields.get("63");
  const marker = payload.lastIndexOf("6304");
  if (
    !crc ||
    marker !== payload.length - 8 ||
    crc16(payload.slice(0, -4)) !== crc.toUpperCase()
  )
    throw new Error("QR CRC mismatch");
  const currencyCode = fields.get("53");
  const currency =
    currencyCode === "704"
      ? "VND"
      : currencyCode === "764"
        ? "THB"
        : currencyCode === "392"
          ? "JPY"
          : null;
  if (!currency) throw new Error("Unsupported QR currency");
  const merchant = [...fields.entries()].find(
    ([id, value]) =>
      Number(id) >= 26 &&
      Number(id) <= 51 &&
      (value.includes("A000000727") || value.includes("A000000677")),
  );
  const rail = merchant?.[1].includes("A000000727")
    ? "vietqr"
    : merchant?.[1].includes("A000000677")
      ? "promptpay"
      : "other";
  const amountLocal = Number(fields.get("54"));
  if (!Number.isFinite(amountLocal) || amountLocal <= 0)
    throw new Error("QR amount required");
  const payeeName = fields.get("59")?.trim() || "Unknown payee";
  return {
    rail,
    payeeName,
    payeeAccountHash: sha256(merchant?.[1] ?? payload),
    amountLocal,
    currency,
    rawQr: payload,
  };
}
export function sampleQr(rail: "vietqr" | "promptpay"): string {
  const id = rail === "vietqr" ? "A000000727" : "A000000677";
  const amount = rail === "vietqr" ? "150000" : "220";
  const currency = rail === "vietqr" ? "704" : "764";
  const merchant = `0010${id}0108TEST0001`;
  const raw = `00020101021126${String(merchant.length).padStart(2, "0")}${merchant}5303${currency}54${String(amount.length).padStart(2, "0")}${amount}5910TEST MERCH6006DANANG6304`;
  return raw + crc16(raw);
}
