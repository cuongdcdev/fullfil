/**
 * A made-up bank email for the demo button (mock mode only).
 * It passes our on-screen checks. The mock server does not check the bank's stamp.
 */
export function sampleBankEml(o: { code: string; amountVnd: number; accountLast4: string; now?: Date }): string {
  const now = o.now ?? new Date();
  const amount = o.amountVnd.toLocaleString("de-DE");
  return [
    "Return-Path: <noreply@vpb.com.vn>",
    "Received: from mail.vpb.com.vn by mx.example.test; " + now.toUTCString(),
    "DKIM-Signature: v=1; a=rsa-sha256; d=vpb.com.vn; s=demo; h=from:to:subject:date; bh=ZGVtbw==; b=ZGVtbw==",
    "From: VPBank Alerts <noreply@vpb.com.vn>",
    "To: local@example.test",
    "Subject: Thong bao bien dong so du",
    `Date: ${now.toUTCString()}`,
    `Message-ID: <demo-${o.code}@vpb.com.vn>`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    "Quy khach vua thuc hien giao dich chuyen tien.",
    `Số tiền ghi có: ${amount} VND`,
    `Tài khoản ghi có: XXXXXX${o.accountLast4}`,
    `Noi dung: ${o.code}`,
    "Day la email mau cho ban demo.",
    "",
  ].join("\r\n");
}
