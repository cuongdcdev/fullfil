import { cents, sha256, transition, usd } from "./logic";
import { crc16, tlv } from "./qr";
import type { Check, OrderDetail, QrPaymentSpec } from "./types";

/* ---------------------------------------------------------------- stages */
export const QR_STAGES = [
  "awaiting_funding",
  "finding_local",
  "claimed",
  "transfer_sent",
  "verifying",
  "proof_verified",
  "proof_limited",
  "awaiting_confirmation",
  "done",
  "under_review",
  "refunded",
  "cancelled",
  "expired",
] as const;
export type QrStage = (typeof QR_STAGES)[number];
export type QrEvent =
  | "fund"
  | "cancel"
  | "expire"
  | "claim"
  | "sent"
  | "release_claim"
  | "refund_noshow"
  | "submit"
  | "reject_proof"
  | "accept"
  | "accept_limited"
  | "request_confirmation"
  | "confirm"
  | "deny"
  | "timeout"
  | "resolve_refund";
const stageTransitions: Record<QrStage, Partial<Record<QrEvent, QrStage>>> = {
  awaiting_funding: {
    fund: "finding_local",
    cancel: "cancelled",
    expire: "expired",
  },
  finding_local: { claim: "claimed", cancel: "cancelled", expire: "expired" },
  claimed: {
    sent: "transfer_sent",
    release_claim: "finding_local",
    refund_noshow: "refunded",
  },
  // A timeout after the local says "sent" is NEVER a refund: it is a review.
  transfer_sent: { submit: "verifying", timeout: "under_review" },
  verifying: {
    accept: "proof_verified",
    accept_limited: "proof_limited",
    reject_proof: "transfer_sent",
  },
  proof_verified: { request_confirmation: "awaiting_confirmation" },
  proof_limited: { request_confirmation: "awaiting_confirmation" },
  awaiting_confirmation: {
    confirm: "done",
    deny: "under_review",
    timeout: "under_review",
  },
  under_review: { confirm: "done", resolve_refund: "refunded" },
  done: {},
  refunded: {},
  cancelled: {},
  expired: {},
};
export function qrTransition(stage: QrStage, event: QrEvent): QrStage {
  const next = stageTransitions[stage]?.[event];
  if (!next) throw new Error(`Cannot ${event} from ${stage}`);
  return next;
}
export const qrTerminal = (stage: QrStage) =>
  Object.keys(stageTransitions[stage]).length === 0;

/* ---------------------------------------------------------------- policy */
export const QR_POLICY = {
  /** Minutes a requester's job stays in the pool. */
  poolWindowMin: Number(process.env.QR_POOL_WINDOW_MIN || 60),
  /** Minutes a local has after claiming to say "sent". */
  claimWindowMin: Number(process.env.QR_CLAIM_WINDOW_MIN || 15),
  /** Minutes after "sent" before missing proof goes to review. */
  proofWindowMin: Number(process.env.QR_PROOF_WINDOW_MIN || 30),
  /** Minutes the requester has to confirm before the order goes to review. */
  confirmWindowMin: Number(process.env.QR_CONFIRM_WINDOW_MIN || 60 * 24),
  /** Share of the locked bond taken when a claimed job is never sent. */
  noShowPenaltyBps: 1000,
  /** After this many no-shows the order is refunded instead of re-pooled. */
  maxNoShows: 2,
  maxProofAttempts: 3,
  maxVnd: 20_000_000,
  minVnd: 1_000,
  maxRewardUsd: 100,
};

/* ---------------------------------------------------------------- pricing */
export const DEFAULT_REWARD_USD = 3;
export function priceQr(vnd: number, vndPerUsd: number, rewardUsd: number) {
  if (!Number.isInteger(vnd) || vnd < QR_POLICY.minVnd || vnd > QR_POLICY.maxVnd)
    throw new Error("Invalid VND amount");
  if (!Number.isFinite(vndPerUsd) || vndPerUsd <= 0)
    throw new Error("Invalid FX rate");
  if (rewardUsd < 0 || rewardUsd > QR_POLICY.maxRewardUsd)
    throw new Error("Invalid reward");
  // Round the converted principal UP so the local is never short.
  const principalCents = Math.max(1, Math.ceil((vnd * 100) / vndPerUsd - 1e-9));
  const rewardCents = cents(rewardUsd);
  return {
    principalUsd: usd(principalCents),
    rewardUsd: usd(rewardCents),
    totalUsd: usd(principalCents + rewardCents),
  };
}
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function transferCodeFrom(bytes: Uint8Array): string {
  let suffix = "";
  for (let i = 0; i < 4; i++) suffix += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return `FUL-${suffix}`;
}

/* ---------------------------------------------------------------- VietQR */
export const BANK_BINS: Record<string, string> = {
  "999701": "Lotus Bank",
  "999702": "Jasmine Bank",
  "999704": "Orchid Bank",
  // Real Napas/VietQR BINs (display names only; live Local QR payouts support VPBank only).
  "970432": "VPBank",
  "971025": "MoMo (e-wallet)",
  "971011": "VNPT Money",
  "971005": "Viettel Money",
};
export const bankNameFromBin = (bin: string) =>
  BANK_BINS[bin] ?? (bin ? `Bank ${bin}` : "Unknown bank");
export const UNKNOWN_MERCHANT = "Unknown merchant";
/** Fictional bank notification domains accepted as proof sources. */
export const BANK_NOTIFY_DOMAINS = ["alerts.lotusbank.example"];
export type ParsedVietQr = {
  name: string;
  city: string;
  bank: string;
  bankBin: string;
  accountNumber: string;
  accountMasked: string;
  accountHash: string;
  amountVnd?: number;
  rawQr: string;
};
export const maskAccount = (account: string) => `•••• ${account.slice(-4)}`;
export function parseVietQr(payload: string): ParsedVietQr {
  const fields = tlv(payload);
  const crc = fields.get("63");
  if (
    !crc ||
    payload.lastIndexOf("6304") !== payload.length - 8 ||
    crc16(payload.slice(0, -4)) !== crc.toUpperCase()
  )
    throw new Error("QR CRC mismatch");
  if (fields.get("53") !== "704") throw new Error("Only VND VietQR is supported");
  const merchant = [...fields.entries()].find(
    ([id, value]) =>
      Number(id) >= 26 && Number(id) <= 51 && value.includes("A000000727"),
  );
  if (!merchant) throw new Error("Not a VietQR payload");
  const inner = tlv(merchant[1]);
  const beneficiary = inner.get("01") ?? "";
  let bankBin = "";
  let accountNumber = beneficiary;
  try {
    const nested = tlv(beneficiary);
    if (/^\d{6}$/.test(nested.get("00") ?? "") && nested.get("01")) {
      bankBin = nested.get("00")!;
      accountNumber = nested.get("01")!;
    }
  } catch {
    /* flat account field */
  }
  if (!accountNumber) throw new Error("QR has no beneficiary account");
  const amountRaw = fields.get("54");
  let amountVnd: number | undefined;
  if (amountRaw !== undefined) {
    amountVnd = Number(amountRaw);
    if (!Number.isInteger(amountVnd) || amountVnd <= 0)
      throw new Error("Invalid QR amount");
  }
  return {
    name: fields.get("59")?.trim() || UNKNOWN_MERCHANT,
    city: fields.get("60")?.trim() || "",
    bank: bankNameFromBin(bankBin),
    bankBin,
    accountNumber,
    accountMasked: maskAccount(accountNumber),
    accountHash: sha256(`vietqr:${bankBin}:${accountNumber}`),
    amountVnd,
    rawQr: payload,
  };
}
const t = (id: string, value: string) =>
  `${id}${String(value.length).padStart(2, "0")}${value}`;
/**
 * Build a dynamic VietQR (Napas 247 to account) with amount and note prefilled,
 * so a payer can scan it with any Vietnamese bank app.
 */
export function buildVietQr(p: {
  bin: string;
  account: string;
  amountVnd: number;
  note: string;
}): string {
  if (!/^\d{6}$/.test(p.bin)) throw new Error("Invalid bank BIN");
  if (!p.account || p.account.length > 19 || !/^[A-Za-z0-9]+$/.test(p.account))
    throw new Error("Invalid account number");
  if (!Number.isInteger(p.amountVnd) || p.amountVnd <= 0)
    throw new Error("Invalid VND amount");
  if (!/^[\x20-\x7e]{1,25}$/.test(p.note)) throw new Error("Invalid transfer note");
  const raw =
    t("00", "01") +
    t("01", "12") +
    t(
      "38",
      t("00", "A000000727") +
        t("01", t("00", p.bin) + t("01", p.account)) +
        t("02", "QRIBFTTA"),
    ) +
    t("53", "704") +
    t("54", String(p.amountVnd)) +
    t("58", "VN") +
    t("62", t("08", p.note)) +
    "6304";
  return raw + crc16(raw);
}
/** Fictional merchant used by the "Use sample QR" button. */
export const SAMPLE_PHO = {
  name: "PHO BAY SAO DEMO",
  city: "DANANG",
  bankBin: "999704",
  account: "0987654321",
  amountVnd: 50_000,
};
export function samplePhoQr(amountVnd: number | null = SAMPLE_PHO.amountVnd) {
  const account = t(
    "01",
    t("00", SAMPLE_PHO.bankBin) + t("01", SAMPLE_PHO.account),
  );
  const raw =
    "000201" +
    t("01", amountVnd ? "12" : "11") +
    t("38", t("00", "A000000727") + account + t("02", "QRIBFTTA")) +
    t("53", "704") +
    (amountVnd ? t("54", String(amountVnd)) : "") +
    t("58", "VN") +
    t("59", SAMPLE_PHO.name) +
    t("60", SAMPLE_PHO.city) +
    "6304";
  return raw + crc16(raw);
}

/* ---------------------------------------------------------- bank proof */
export type BankNotice = {
  amountVnd?: number;
  debit: boolean;
  at?: Date;
  recipient?: string;
  note?: string;
  ref?: string;
};
export function parseBankNotice(body: string): BankNotice {
  const head = body.match(
    /Tai khoan\s+\S+\s+([-+])?\s*([\d.,]+)\s*VND\s+luc\s+(\d{2}):(\d{2})\s+(\d{2})\/(\d{2})\/(\d{4})/i,
  );
  const notice: BankNotice = { debit: head?.[1] === "-" };
  if (head) {
    notice.amountVnd = Number(head[2].replace(/[.,]/g, ""));
    // Bank clock is Vietnam time (UTC+7).
    notice.at = new Date(
      `${head[7]}-${head[6]}-${head[5]}T${head[3]}:${head[4]}:00+07:00`,
    );
  }
  notice.recipient = body.match(/STK\s+([0-9xX*]+)/i)?.[1];
  notice.note = body.match(/ND:\s*(.*?)(?:\.\s*So du|\r?\n|$)/i)?.[1]?.trim();
  notice.ref = body.match(/Ma giao dich:\s*([A-Za-z0-9]+)/i)?.[1];
  return notice;
}
export function accountMatches(shown: string, full: string): boolean {
  if (!shown) return false;
  if (!/[xX*]/.test(shown))
    return shown === full || sha256(shown) === sha256(full);
  if (shown.length !== full.length) return false;
  return [...shown].every((c, i) => /[xX*]/.test(c) || c === full[i]);
}
export type BankProofResult = {
  checks: Check[];
  pass: boolean;
  bankRef?: string;
  nullifier?: string;
  extracted: { amountVnd?: number; at?: string; note?: string; recipient?: string };
};
export function evaluateBankProof(input: {
  dkim: { valid: boolean; domain: string; reason: string; body: string };
  allowedDomains?: string[];
  expected: {
    amountVnd: number;
    accountNumber: string;
    transferCode: string;
    claimedAt: Date;
  };
  usedNullifiers: Set<string>;
  now?: Date;
}): BankProofResult {
  const allowed = input.allowedDomains ?? BANK_NOTIFY_DOMAINS;
  const now = input.now ?? new Date();
  const checks: Check[] = [];
  const add = (id: string, pass: boolean, ok: string, bad: string) =>
    checks.push({ id, pass, detail: pass ? ok : bad });
  const sigOk = input.dkim.valid;
  const domainOk = !!input.dkim.domain && allowed.includes(input.dkim.domain);
  add("dkim_signature", sigOk, "Email signature is valid", input.dkim.reason || "Email signature is invalid");
  add("bank_domain", domainOk, `Sent by an approved bank domain (${input.dkim.domain})`, `Signing domain ${input.dkim.domain || "(none)"} is not an approved bank`);
  // Body text is only trusted once the signature and sending bank are verified.
  const trusted = sigOk && domainOk;
  const n = trusted ? parseBankNotice(input.dkim.body) : ({ debit: false } as BankNotice);
  const skipped = "Not checked: email is not authenticated";
  add("amount", trusted && n.debit && n.amountVnd === input.expected.amountVnd, `Amount matches ${input.expected.amountVnd} VND`, trusted ? `Amount ${n.amountVnd ?? "?"} does not match ${input.expected.amountVnd} VND` : skipped);
  add("recipient", trusted && !!n.recipient && accountMatches(n.recipient, input.expected.accountNumber), "Recipient account matches the QR", trusted ? "Recipient account does not match the QR" : skipped);
  add("transfer_note", trusted && (n.note ?? "").toUpperCase().includes(input.expected.transferCode.toUpperCase()), `Transfer note contains ${input.expected.transferCode}`, trusted ? `Transfer note is missing ${input.expected.transferCode}` : skipped);
  const floor = Math.floor(input.expected.claimedAt.getTime() / 60_000) * 60_000;
  add("after_claim", trusted && !!n.at && n.at.getTime() >= floor && n.at.getTime() <= now.getTime() + 10 * 60_000, "Transfer happened after the job was claimed", trusted ? "Transfer time is before the claim or in the future" : skipped);
  const nullifier = trusted && n.ref ? sha256(`${input.dkim.domain}:${n.ref}`) : undefined;
  add("not_reused", !!nullifier && !input.usedNullifiers.has(nullifier), "Bank reference not used before", trusted ? (n.ref ? "This bank transaction was already used for another order" : "Bank reference missing") : skipped);
  return {
    checks,
    pass: checks.every((c) => c.pass),
    bankRef: trusted ? n.ref : undefined,
    nullifier,
    extracted: {
      amountVnd: n.amountVnd,
      at: n.at?.toISOString(),
      note: n.note,
      recipient: n.recipient,
    },
  };
}

/* ------------------------------------------------------------- order ext */
export type QrTimelineEntry = { stage: QrStage; at: string; label: string };
export type QrProofRecord = {
  method: "bank_email" | "slip";
  accepted: boolean;
  limited: boolean;
  checks: Check[];
  submittedAt: string;
  bankRef?: string;
  nullifier?: string;
  attestation: {
    provider: "mock";
    inputHash: string;
    outputHash: string;
    verifiedAt: string;
    note: string;
  };
};
export type QrExt = {
  stage: QrStage;
  merchant: { name: string; bank: string; accountMasked: string; accountHash: string };
  vndAmount: number;
  fxRate: number;
  fxSource: string;
  principalUsd: number;
  rewardUsd: number;
  totalUsd: number;
  transferCode: string;
  payWith: string;
  funding?: { payWith: string; payAmount: number; intentId: string; mock: true; at: string };
  expiresAt: string;
  claimedAt?: string;
  claimDeadline?: string;
  sentAt?: string;
  proofDeadline?: string;
  confirmDeadline?: string;
  excluded: string[];
  noShows: { fulfiller: string; at: string; penaltyUsd: number }[];
  attempts: QrProofRecord[];
  proof?: QrProofRecord;
  autoLocal?: { startAt: string; step: number };
  ratingGiven?: number;
  timeline: QrTimelineEntry[];
};

export function buildQrOrderDetail(a: {
  id: string;
  buyer: string;
  now: Date;
  qr: ParsedVietQr;
  vnd: number;
  fx: { rate: number; source: string };
  rewardUsd: number;
  payWith: string;
  transferCode: string;
  mock: boolean;
}): OrderDetail {
  const price = priceQr(a.vnd, a.fx.rate, a.rewardUsd);
  const at = a.now.toISOString();
  const expiresAt = new Date(a.now.getTime() + QR_POLICY.poolWindowMin * 60_000).toISOString();
  const spec: QrPaymentSpec = {
    rail: "vietqr",
    payeeName: a.qr.name,
    payeeAccountHash: a.qr.accountHash,
    amountLocal: a.vnd,
    currency: "VND",
    rawQr: a.qr.rawQr,
  };
  const rubric = {
    version: 1 as const,
    deterministicChecks: [
      { id: "dkim_signature", field: "dkimValid", op: "eq" as const, value: true },
      { id: "bank_domain", field: "dkimDomain", op: "domain_in" as const, value: BANK_NOTIFY_DOMAINS },
      { id: "amount", field: "amountVnd", op: "eq" as const, value: a.vnd },
      { id: "transfer_note", field: "transferNote", op: "includes" as const, value: a.transferCode },
      { id: "not_reused", field: "nullifier", op: "unused" as const, value: true },
    ],
    aiChecks: [
      {
        id: "merchant_received",
        question: "Did the merchant receive the stated VND amount?",
        evidence: ["bank_email"],
      },
    ],
    windows: {
      purchaseDeadline: expiresAt,
      autoAcceptHours: 24,
      releaseGate: "after_challenge" as const,
    },
    disputeStakePct: 10,
  };
  let order: OrderDetail = {
    id: a.id,
    kind: "qr_payment",
    buyer: a.buyer,
    spec,
    rubric,
    specHash: sha256(spec),
    rubricHash: sha256(rubric),
    state: "Draft",
    createdAt: at,
    history: [],
    quotes: [],
    bundles: [],
    transactions: [],
    mock: a.mock,
    qr: {
      stage: "awaiting_funding",
      merchant: {
        name: a.qr.name,
        bank: a.qr.bank,
        accountMasked: a.qr.accountMasked,
        accountHash: a.qr.accountHash,
      },
      vndAmount: a.vnd,
      fxRate: a.fx.rate,
      fxSource: a.fx.source,
      ...price,
      transferCode: a.transferCode,
      payWith: a.payWith,
      expiresAt,
      excluded: [],
      noShows: [],
      attempts: [],
      timeline: [{ stage: "awaiting_funding", at, label: "Order created" }],
    },
  };
  order = transition(order, "post_qr", a.now, "QR job created");
  return order;
}
