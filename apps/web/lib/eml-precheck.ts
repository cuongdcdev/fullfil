/**
 * Client-side pre-check of a bank notification email (.eml).
 * Pure TS, no network. It only catches honest mistakes early; the server
 * still verifies the bank's signature for real.
 */

export type PrecheckOrder = {
  /** Transfer note, e.g. "FUL-8K2Q". */
  code: string;
  amountVnd: number;
  accountLast4?: string;
  /** Epoch milliseconds when the fulfiller took the job. */
  claimedAt?: number;
};
export type PrecheckCheck = {
  id: "real_email" | "size" | "bank_stamp" | "not_forward" | "code" | "amount" | "account" | "date";
  ok: boolean | "warn";
  label: string;
  fix?: string;
};
export type PrecheckResult = { checks: PrecheckCheck[]; bank?: string; ready: boolean };

/** Signing domains we accept -> bank display name. */
export const BANK_DOMAINS: Record<string, string> = { "vpb.com.vn": "VPBank" };
export const MAX_EML_BYTES = 64 * 1024;

type Headers = Map<string, string[]>;
type Part = { headers: Headers; body: string };

const decodeBytes = (b: Uint8Array, charset = "utf-8"): string => {
  try {
    return new TextDecoder(charset.toLowerCase()).decode(b);
  } catch {
    return new TextDecoder("latin1").decode(b);
  }
};
const latin1Bytes = (s: string): Uint8Array => {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
};
const utf8Bytes = (s: string) => new TextEncoder().encode(s);

function splitHeadBody(raw: string): { head: string; body: string } {
  const m = /\r?\n\r?\n/.exec(raw);
  return m ? { head: raw.slice(0, m.index), body: raw.slice(m.index + m[0].length) } : { head: raw, body: "" };
}
function parseHeaders(head: string): Headers {
  const map: Headers = new Map();
  const unfolded = head.replace(/\r?\n[ \t]+/g, " ");
  for (const line of unfolded.split(/\r?\n/)) {
    const i = line.indexOf(":");
    if (i <= 0 || !/^[\x21-\x39\x3b-\x7e]+$/.test(line.slice(0, i))) continue;
    const k = line.slice(0, i).toLowerCase();
    map.set(k, [...(map.get(k) ?? []), line.slice(i + 1).trim()]);
  }
  return map;
}
const h1 = (h: Headers, k: string) => h.get(k)?.[0] ?? "";

function param(value: string, name: string): string | undefined {
  const m = new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|([^;\\s]+))`, "i").exec(value);
  return m ? (m[1] ?? m[2]) : undefined;
}

function decodeQP(s: string): Uint8Array {
  const t = s.replace(/=\r?\n/g, "");
  const out: number[] = [];
  for (let i = 0; i < t.length; i++) {
    if (t[i] === "=" && /^[0-9A-Fa-f]{2}$/.test(t.slice(i + 1, i + 3))) {
      out.push(parseInt(t.slice(i + 1, i + 3), 16));
      i += 2;
    } else out.push(t.charCodeAt(i) & 0xff);
  }
  return Uint8Array.from(out);
}
function decodeB64(s: string): Uint8Array {
  try {
    return latin1Bytes(atob(s.replace(/[^A-Za-z0-9+/]/g, "").replace(/(^.*$)/, (m) => m + "=".repeat((4 - (m.length % 4)) % 4))));
  } catch {
    return new Uint8Array();
  }
}

/** Decode RFC 2047 words like =?utf-8?B?...?= in header values. */
function decodeWords(v: string): string {
  return v.replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (_, cs: string, enc: string, txt: string) =>
    decodeBytes(enc.toLowerCase() === "b" ? decodeB64(txt) : decodeQP(txt.replace(/_/g, " ")), cs),
  );
}

function partText(p: Part): string {
  const ct = h1(p.headers, "content-type");
  const cte = h1(p.headers, "content-transfer-encoding").toLowerCase();
  const charset = param(ct, "charset") ?? "utf-8";
  if (cte === "base64") return decodeBytes(decodeB64(p.body), charset);
  if (cte === "quoted-printable") return decodeBytes(decodeQP(p.body), charset);
  return p.body; // 7bit/8bit: already decoded text
}

function htmlToText(html: string): string {
  const named: Record<string, string> = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
  return html
    .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n: string) => named[n.toLowerCase()] ?? m)
    .replace(/[ \t ]+/g, " ");
}

function collectText(p: Part, depth = 0): string[] {
  const ctRaw = h1(p.headers, "content-type");
  const ct = ctRaw.toLowerCase();
  if (ct.startsWith("multipart/") && depth < 6) {
    const boundary = param(ctRaw, "boundary");
    if (!boundary) return [];
    const esc = boundary.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const chunks = p.body.split(new RegExp(`^--${esc}(?:--)?[ \\t]*$`, "m")).slice(1);
    return chunks.flatMap((c) => {
      const { head, body } = splitHeadBody(c.replace(/^\r?\n/, ""));
      return collectText({ headers: parseHeaders(head), body }, depth + 1);
    });
  }
  if (ct.startsWith("text/html")) return [htmlToText(partText(p))];
  if (ct === "" || ct.startsWith("text/plain")) return [partText(p)];
  return [];
}

/** All VND amounts in text, e.g. "10,000 VND", "10.000 ₫". */
function vndAmounts(text: string): number[] {
  const out: number[] = [];
  const re = /(\d{1,3}(?:[.,]\d{3})+|\d+)\s*(?:VND|VNĐ|₫|đ)(?![a-zà-ỹ])/gi;
  for (const m of text.matchAll(re)) out.push(Number(m[1].replace(/[.,]/g, "")));
  return out;
}

/** Text right after a label like "Số tiền ghi có", skipping ":" and spaces. */
function after(text: string, label: string, len = 60): string | undefined {
  const i = text.toLowerCase().indexOf(label.toLowerCase());
  return i < 0 ? undefined : text.slice(i + label.length, i + label.length + len).replace(/^[\s:]+/, "");
}

type Sig = { d: string; hasL: boolean };
function parseSigs(h: Headers): Sig[] {
  return (h.get("dkim-signature") ?? []).map((v) => {
    const tags = v.split(";").map((t) => t.trim());
    const tag = (n: string) => tags.find((t) => t.toLowerCase().startsWith(n + "="));
    return { d: (tag("d")?.slice(2) ?? "").trim().toLowerCase(), hasL: !!tag("l") };
  });
}
const bankOf = (d: string) => Object.keys(BANK_DOMAINS).find((b) => d === b || d.endsWith("." + b));

export function precheckEml(input: Uint8Array | string, order: PrecheckOrder): PrecheckResult {
  const bytes = typeof input === "string" ? utf8Bytes(input) : input;
  const raw = decodeBytes(bytes);
  const checks: PrecheckCheck[] = [];
  const add = (c: PrecheckCheck) => checks.push(c);

  // 1. real email file
  const { head, body } = splitHeadBody(raw);
  const headers = parseHeaders(head);
  const lineCount = raw.split(/\r?\n/).length;
  const looksReal = headers.size >= 3 && headers.has("from") && lineCount >= 8 && body.length > 0;
  add(
    looksReal
      ? { id: "real_email", ok: true, label: "This is the original email file" }
      : {
          id: "real_email",
          ok: false,
          label: "This doesn't look like the original email file",
          fix: "Download the original file, don't copy-paste.",
        },
  );
  // 2. size
  add(
    bytes.length <= MAX_EML_BYTES
      ? { id: "size", ok: true, label: "File size is fine" }
      : {
          id: "size",
          ok: false,
          label: "The file is too big",
          fix: "Pick the email file itself (under 64 KB), not a folder or backup.",
        },
  );
  if (!looksReal) return { checks, ready: false };

  // 3. bank security stamp
  const sigs = parseSigs(headers);
  const bankSig = sigs.find((s) => bankOf(s.d) && !s.hasL);
  const bankSigWithL = sigs.find((s) => bankOf(s.d) && s.hasL);
  const bankKey = bankSig ? bankOf(bankSig.d) : undefined;
  const bank = bankKey ? BANK_DOMAINS[bankKey] : undefined;
  if (bankSig) add({ id: "bank_stamp", ok: true, label: `${bank}'s security stamp found` });
  else if (bankSigWithL)
    add({
      id: "bank_stamp",
      ok: false,
      label: "The bank's security stamp is incomplete",
      fix: "Open the original email from your bank and download it again.",
    });
  else
    add({
      id: "bank_stamp",
      ok: false,
      label: "No bank security stamp found",
      fix: "Use the email your bank sent you, not one from another sender.",
    });

  // 4. not a manual forward
  const subject = decodeWords(h1(headers, "subject"));
  const fwdSubject = /^\s*(fwd?|tr)\s*:/i.test(subject);
  const gmailOnly = !bankSig && sigs.some((s) => s.d === "gmail.com");
  add(
    fwdSubject || gmailOnly
      ? { id: "not_forward", ok: false, label: "This looks like a forwarded email", fix: "Don't press Forward. Use Download message." }
      : { id: "not_forward", ok: true, label: "Not forwarded" },
  );

  const text = collectText({ headers, body }).join("\n");

  // 5. order code
  const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const codeOk = norm(order.code).length > 0 && norm(text).includes(norm(order.code));
  add(
    codeOk
      ? { id: "code", ok: true, label: `Transfer note ${order.code} found` }
      : {
          id: "code",
          ok: false,
          label: `Transfer note ${order.code} not found`,
          fix: `Your transfer must have ${order.code} in the message. Check you picked the right email.`,
        },
  );

  // 6. amount
  const creditArea = after(text, "Số tiền ghi có", 80);
  const labelled = creditArea ? vndAmounts(creditArea)[0] : undefined;
  const amounts = labelled !== undefined ? [labelled] : vndAmounts(text);
  add(
    amounts.includes(order.amountVnd)
      ? { id: "amount", ok: true, label: "Amount matches" }
      : { id: "amount", ok: false, label: "Amount doesn't match", fix: "The email must show exactly the amount you were asked to send." },
  );

  // 7. account (warn only)
  if (order.accountLast4) {
    // Accounts can be alphanumeric (e-wallet virtual accounts like MoMo "PSP…"); spaced digit groups allowed.
    const acc = after(text, "Tài khoản ghi có", 40)
      ?.match(/^[A-Za-z0-9*.-]+(?: [0-9Xx*.-]+)*/)?.[0].replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    add(
      acc && acc.endsWith(order.accountLast4)
        ? { id: "account", ok: true, label: "Sent to the right account" }
        : {
            id: "account",
            ok: "warn",
            label: acc ? "Account number looks different" : "Couldn't read the account number",
            fix: `Check the shop's account ends in ${order.accountLast4}.`,
          },
    );
  }

  // 8. date
  if (order.claimedAt !== undefined) {
    const t = Date.parse(h1(headers, "date"));
    const claimed = order.claimedAt < 1e12 ? order.claimedAt * 1000 : order.claimedAt;
    add(
      !Number.isNaN(t) && t >= claimed - 10 * 60_000
        ? { id: "date", ok: true, label: "Sent after you took the job" }
        : { id: "date", ok: false, label: "This email is from before you took the job", fix: "Pick the email for the transfer you just made." },
    );
  }

  return { checks, bank, ready: checks.every((c) => c.ok !== false) };
}
