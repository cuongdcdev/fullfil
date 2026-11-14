import { createHash, createPublicKey, createSign } from "node:crypto";
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import QRCode from "qrcode";
import { lotusBankNotice } from "../packages/adapters/src/bank-notice";
import { samplePhoQr } from "../packages/core/src/qrbounty";
function crc16(input: string): string {
  let crc = 0xffff;
  for (const char of Buffer.from(input, "utf8")) {
    crc ^= char << 8;
    for (let i = 0; i < 8; i++)
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}
function sampleQr(rail: "vietqr" | "promptpay"): string {
  const id = rail === "vietqr" ? "A000000727" : "A000000677";
  const amount = rail === "vietqr" ? "150000" : "220";
  const currency = rail === "vietqr" ? "704" : "764";
  const merchant = `0010${id}0108TEST0001`;
  const raw = `00020101021126${String(merchant.length).padStart(2, "0")}${merchant}5303${currency}54${String(amount.length).padStart(2, "0")}${amount}5910TEST MERCH6006DANANG6304`;
  return raw + crc16(raw);
}

const root = resolve(process.cwd(), "fixtures");
mkdirSync(root, { recursive: true });
const privateKey = readFileSync(resolve(root, "dkim-test-private.pem"), "utf8");
const publicKey = createPublicKey(privateKey)
  .export({ type: "spki", format: "pem" })
  .toString();
const dns = `v=DKIM1; k=rsa; p=${publicKey.replace(/-----[^-]+-----|\s/g, "")}`;
writeFileSync(resolve(root, "dkim-public.txt"), dns + "\n");
const body =
  "Order ID: BOOK-DEMO-001\r\nDate: 2026-11-07\r\nQuantity: 2\r\nNames: Alice Nguyen, Bob Tran\r\nItem: Cham Islands ferry, Hoi An to Cu Lao Cham\r\n";
const headers = [
  "From: Fulfil Demo Tickets <tickets@tickets.fulfil-demo.test>",
  "To: agent-alpha.testnet",
  "Subject: Ferry ticket confirmation",
  "Date: Thu, 29 Oct 2026 10:00:00 +0000",
];
const bh = createHash("sha256").update(body).digest("base64");
const dkimBase = `v=1; a=rsa-sha256; c=simple/simple; d=tickets.fulfil-demo.test; s=test; h=from:to:subject:date; bh=${bh}; b=`;
const signingInput = headers.join("\r\n") + `\r\nDKIM-Signature: ${dkimBase}`;
const signature = createSign("RSA-SHA256")
  .update(signingInput)
  .sign(privateKey, "base64");
const eml = `DKIM-Signature: ${dkimBase}${signature}\r\n${headers.join("\r\n")}\r\n\r\n${body}`;
writeFileSync(resolve(root, "sample.eml"), eml);
function pdf(text: string): string {
  const stream = `BT /F1 12 Tf 50 750 Td (${text.replace(/[()\\]/g, "\\$&")}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];
  let result = "%PDF-1.4\n";
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(result));
    result += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xref = Buffer.byteLength(result);
  result += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1))
    result += `${String(offset).padStart(10, "0")} 00000 n \n`;
  result += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return result;
}
writeFileSync(
  resolve(root, "ticket.pdf"),
  pdf("DEMO ferry ticket 2026-11-07 Alice Nguyen Bob Tran"),
);
writeFileSync(
  resolve(root, "mismatch.pdf"),
  pdf("DEMO ferry ticket 2026-11-08 Alice Nguyen Bob Tran"),
);
for (const rail of ["vietqr", "promptpay"] as const) {
  const payload = sampleQr(rail);
  const svg = await QRCode.toString(payload, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 4,
    width: 512,
    color: { dark: "#111827", light: "#ffffff" },
  });
  writeFileSync(resolve(root, `${rail}.svg`), svg);
}

// Fictional Lotus Bank (alerts.lotusbank.example) transfer notifications, signed with a NEW test key.
const lotusPrivate = readFileSync(resolve(root, "dkim-lotusbank-private.pem"), "utf8");
const lotusPublic = createPublicKey(lotusPrivate)
  .export({ type: "spki", format: "pem" })
  .toString();
writeFileSync(
  resolve(root, "dkim-lotusbank-public.txt"),
  `v=DKIM1; k=rsa; p=${lotusPublic.replace(/-----[^-]+-----|\s/g, "")}\n`,
);
const notice = {
  amountVnd: 50_000,
  transferCode: "FUL-8K2Q",
  recipientMasked: "xxxxxx4321",
  at: new Date("2026-11-06T05:31:00.000Z"), // 12:31 06/11/2026 Vietnam time
  ref: "LTB202611061231A1B2C3",
};
writeFileSync(resolve(root, "lotus-notice-valid.eml"), lotusBankNotice("valid", notice));
writeFileSync(resolve(root, "lotus-notice-wrong-amount.eml"), lotusBankNotice("wrong_amount", notice));
writeFileSync(resolve(root, "lotus-notice-tampered.eml"), lotusBankNotice("tampered", notice));
writeFileSync(
  resolve(root, "vietqr-pho.svg"),
  await QRCode.toString(samplePhoQr(50_000), {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 2,
    width: 512,
    color: { dark: "#111827", light: "#ffffff" },
  }),
);
