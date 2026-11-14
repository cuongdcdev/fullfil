/** Tiny browser-side VietQR reader: shows the shop name and amount before we ask the server. */

export function crc16(input: string): string {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(input)) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function tlv(payload: string): Map<string, string> {
  const out = new Map<string, string>();
  for (let i = 0; i < payload.length; ) {
    if (i + 4 > payload.length) throw new Error("This QR is cut off.");
    const length = Number(payload.slice(i + 2, i + 4));
    if (!Number.isInteger(length) || i + 4 + length > payload.length) throw new Error("This QR is not valid.");
    out.set(payload.slice(i, i + 2), payload.slice(i + 4, i + 4 + length));
    i += 4 + length;
  }
  return out;
}

export type QrLite = { name: string; bankBin: string; accountMasked: string; amountVnd?: number };

export function readShopQr(payload: string): QrLite {
  const text = payload.trim();
  const fields = tlv(text);
  const crc = fields.get("63");
  if (!crc || text.lastIndexOf("6304") !== text.length - 8 || crc16(text.slice(0, -4)) !== crc.toUpperCase())
    throw new Error("This QR is damaged. Try another photo.");
  if (fields.get("53") !== "704") throw new Error("We only support Vietnamese bank QR codes.");
  const merchant = [...fields.entries()].find(
    ([id, v]) => Number(id) >= 26 && Number(id) <= 51 && v.includes("A000000727"),
  );
  if (!merchant) throw new Error("This is not a Vietnamese bank QR.");
  const beneficiary = tlv(merchant[1]).get("01") ?? "";
  let bankBin = "";
  let account = beneficiary;
  try {
    const nested = tlv(beneficiary);
    if (/^\d{6}$/.test(nested.get("00") ?? "") && nested.get("01")) {
      bankBin = nested.get("00")!;
      account = nested.get("01")!;
    }
  } catch {
    /* flat account */
  }
  if (!account) throw new Error("This QR has no account in it.");
  const raw = fields.get("54");
  const amountVnd = raw === undefined ? undefined : Number(raw);
  if (amountVnd !== undefined && (!Number.isInteger(amountVnd) || amountVnd <= 0))
    throw new Error("This QR has a wrong amount.");
  return { name: fields.get("59")?.trim() || "Shop", bankBin, accountMasked: `•••• ${account.slice(-4)}`, amountVnd };
}
