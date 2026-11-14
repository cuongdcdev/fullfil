/** Synthetic VPBank-like notification emails (fake names/accounts, fake signature). */

export function qpEncode(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let out = "";
  let line = "";
  const push = (t: string) => {
    if (line.length + t.length > 75) {
      out += line + "=\r\n";
      line = "";
    }
    line += t;
  };
  for (const b of bytes) {
    if (b === 10) {
      out += line + "\r\n";
      line = "";
    } else if (b === 13) continue;
    else if ((b >= 33 && b <= 126 && b !== 61) || b === 32) push(String.fromCharCode(b));
    else push("=" + b.toString(16).toUpperCase().padStart(2, "0"));
  }
  return out + line;
}

export type FixtureOpts = {
  code?: string;
  amount?: string;
  account?: string;
  subject?: string;
  dkim?: string | null;
  date?: string;
  base64?: boolean;
};

export function vpbankEml(o: FixtureOpts = {}): string {
  const {
    code = "FUL-8K2Q",
    amount = "10,000 VND",
    account = "0123456789",
    subject = "VPBank thong bao giao dich",
    date = "Sat, 07 Nov 2026 10:15:00 +0700",
  } = o;
  const dkim =
    o.dkim === undefined
      ? "v=1; a=rsa-sha256; c=relaxed/relaxed; d=vpb.com.vn; s=sel1; h=from:to:subject:date; bh=ZmFrZWZha2U=; b=ZmFrZXNpZw=="
      : o.dkim;
  const html = `<html><body><table>
<tr><td>Mã giao dịch</td><td>FT26311ABCDE</td></tr>
<tr><td>Tài khoản ghi có</td><td>${account}</td></tr>
<tr><td>Số tiền ghi có</td><td><b>${amount}</b></td></tr>
<tr><td>Tên người hưởng</td><td>NGUYEN VAN TEST</td></tr>
<tr><td>Nội dung chuyển tiền</td><td>${code} thanh toan</td></tr>
</table></body></html>`;
  const enc = o.base64
    ? { cte: "base64", body: btoa(String.fromCharCode(...new TextEncoder().encode(html))).replace(/(.{76})/g, "$1\r\n") }
    : { cte: "quoted-printable", body: qpEncode(html) };
  return [
    ...(dkim ? [`DKIM-Signature: ${dkim}`] : []),
    "Received: from mail.example.test by mx.example.test; " + date,
    "From: VPBank <no-reply@vpb.com.vn>",
    "To: tester@example.test",
    `Subject: ${subject}`,
    `Date: ${date}`,
    "MIME-Version: 1.0",
    'Content-Type: multipart/alternative; boundary="BOUND123"',
    "",
    "--BOUND123",
    "Content-Type: text/html; charset=UTF-8",
    `Content-Transfer-Encoding: ${enc.cte}`,
    "",
    enc.body,
    "--BOUND123--",
    "",
  ].join("\r\n");
}
