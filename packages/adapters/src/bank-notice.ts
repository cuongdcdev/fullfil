import { createHash, randomBytes } from "node:crypto";
import { signFixtureEmail } from "./dkim";

export const LOTUS_BANK_DOMAIN = "alerts.lotusbank.example";
export type BankNoticeVariant =
  | "valid"
  | "wrong_amount"
  | "tampered"
  | "missing_note"
  | "wrong_domain"
  | "wrong_recipient";
export type BankNoticeInput = {
  amountVnd: number;
  transferCode: string;
  /** Recipient account as shown by the sender's bank, e.g. "xxxxxx4321". */
  recipientMasked: string;
  at?: Date;
  ref?: string;
};
const vnd = (n: number) => n.toLocaleString("en-US");
function vnClock(at: Date) {
  const l = new Date(at.getTime() + 7 * 3600_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return {
    text: `${p(l.getUTCHours())}:${p(l.getUTCMinutes())} ${p(l.getUTCDate())}/${p(l.getUTCMonth() + 1)}/${l.getUTCFullYear()}`,
    compact: `${l.getUTCFullYear()}${p(l.getUTCMonth() + 1)}${p(l.getUTCDate())}${p(l.getUTCHours())}${p(l.getUTCMinutes())}`,
  };
}
/** Fictional Lotus Bank transfer notification signed with the bundled Lotus test key (mock/test only). */
export function lotusBankNotice(
  variant: BankNoticeVariant,
  input: BankNoticeInput,
): Buffer {
  const at = input.at ?? new Date();
  const clock = vnClock(at);
  const ref =
    input.ref ?? `LTB${clock.compact}${randomBytes(3).toString("hex").toUpperCase()}`;
  const signedAmount = variant === "tampered" ? Math.max(1000, Math.round(input.amountVnd / 10)) : variant === "wrong_amount" ? input.amountVnd + 10_000 : input.amountVnd;
  const recipient =
    variant === "wrong_recipient" ? "xxxxxx9999" : input.recipientMasked;
  const note = variant === "missing_note" ? "pho" : `${input.transferCode} pho`;
  const body = [
    "Lotus Bank - Thong bao giao dich",
    `Tai khoan 0123xxxx89 -${vnd(signedAmount)} VND luc ${clock.text}.`,
    `Nguoi nhan: PHO BAY SAO DEMO - STK ${recipient}`,
    `ND: ${note}. So du 1,250,000 VND.`,
    `Ma giao dich: ${ref}`,
    "",
  ].join("\r\n");
  const domain = variant === "wrong_domain" ? "tickets.fulfil-demo.test" : LOTUS_BANK_DOMAIN;
  const eml = signFixtureEmail({
    privateKeyFile:
      variant === "wrong_domain" ? "dkim-test-private.pem" : "dkim-lotusbank-private.pem",
    domain,
    selector: variant === "wrong_domain" ? "test" : "lotus1",
    headers: [
      `From: Lotus Bank Alerts <noreply@${domain}>`,
      "To: customer@example.test",
      "Subject: Thong bao giao dich",
      `Date: ${at.toUTCString().replace("GMT", "+0000")}`,
    ],
    body,
  });
  if (variant !== "tampered") return eml;
  // Attack: edit the amount after signing so the email "shows" the full price.
  return Buffer.from(
    eml.toString("utf8").replace(`-${vnd(signedAmount)} VND`, `-${vnd(input.amountVnd)} VND`),
  );
}
export const slipHash = (bytes: Buffer) =>
  createHash("sha256").update(bytes).digest("hex");
