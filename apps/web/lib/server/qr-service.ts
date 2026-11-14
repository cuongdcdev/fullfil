import { randomBytes } from "node:crypto";
import {
  getFxQuote,
  lotusBankNotice,
  mockIntentsFunding,
  PAY_WITH,
  verifyDkimSignature,
  type BankNoticeVariant,
  type PayWith,
} from "@fulfil/adapters";
import {
  assertQuoteAffordable,
  buildQrOrderDetail,
  cents,
  DEFAULT_REWARD_USD,
  evaluateBankProof,
  parseVietQr,
  priceQr,
  QR_POLICY,
  qrTerminal,
  qrTransition,
  requiredBond,
  samplePhoQr,
  sha256,
  transferCodeFrom,
  transition,
  type Check,
  type EvidenceFact,
  type Fulfiller,
  type OrderDetail,
  type Quote,
  type QrEvent,
  type QrProofRecord,
  type QrStage,
} from "@fulfil/core";
import {
  atomic,
  fulfillerById,
  fulfillers,
  get,
  key,
  nowIso,
  orderById,
  orders,
  put,
  saveFulfiller,
  saveOrder,
  transaction,
  transferCents,
} from "./db";
import {
  act,
  effectiveNow,
  id,
  mockMode,
  requireMockChain,
  settleBondSlash,
  unlockFulfiller,
} from "./service";

export class HttpError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
  ) {
    super(message);
  }
}
const conflict = (m: string) => new HttpError(m, 409, "CONFLICT");
const forbidden = (m: string) => new HttpError(m, 403, "FORBIDDEN");
const notFound = (m: string) => new HttpError(m, 404, "NOT_FOUND");
const DEFAULT_REQUESTER = "agent-alpha.testnet";

/* ------------------------------------------------------------- helpers */
function qrOrder(orderId: string): OrderDetail {
  const order = orderById(orderId);
  if (!order?.qr) throw notFound("Order not found");
  return order;
}
function isOff(value: string | undefined) {
  return ["0", "false", "off", "no"].includes((value ?? "").trim().toLowerCase());
}
export function autoLocalEnabled(): boolean {
  return mockMode() && !isOff(process.env.DEMO_AUTO_LOCAL ?? "1");
}
const autoLocalSeconds = () => Number(process.env.DEMO_AUTO_LOCAL_SECONDS || 8);
const AUTO_LOCALS = [
  "linh.fulfil.testnet",
  "bao.fulfil.testnet",
  "minh.fulfil.testnet",
];
function step(order: OrderDetail, event: QrEvent, at: Date, label: string) {
  const qr = order.qr!;
  try {
    qr.stage = qrTransition(qr.stage, event);
  } catch (error) {
    throw conflict((error as Error).message);
  }
  qr.timeline.push({ stage: qr.stage, at: at.toISOString(), label });
}
function setState(order: OrderDetail, action: string, at: Date, detail?: string) {
  const t = transition(order, action, at, detail);
  order.state = t.state;
  order.history = t.history;
}
const plusMin = (d: Date, m: number) => new Date(d.getTime() + m * 60_000);
const openExposure = (accountId: string, exceptId: string) =>
  orders()
    .filter(
      (o) =>
        o.id !== exceptId &&
        o.quoteId &&
        !["Released", "Refunded", "Cancelled", "Expired"].includes(o.state) &&
        o.fulfiller?.accountId === accountId,
    )
    .reduce((sum, o) => sum + (o.escrowUsd || 0), 0);

function refundEscrow(order: OrderDetail, label: string) {
  transferCents(`escrow:${order.id}`, order.buyer, cents(order.escrowUsd!));
  transaction(order, label, order.escrowUsd);
}
/** Keep the QR stage consistent when the legacy dispute/settle pipeline moved the order. */
function syncStage(order: OrderDetail, at: Date): boolean {
  const qr = order.qr!;
  const to =
    order.state === "Released" && !["done"].includes(qr.stage)
      ? "done"
      : order.state === "Refunded" &&
          ["under_review", "awaiting_confirmation"].includes(qr.stage)
        ? "refunded"
        : undefined;
  if (!to || qrTerminal(qr.stage)) return false;
  qr.stage = to;
  qr.timeline.push({
    stage: to,
    at: at.toISOString(),
    label: to === "done" ? "Review decided: local paid" : "Review decided: refunded",
  });
  return true;
}

/* ------------------------------------------------------------- timeouts */
function applyNoShow(order: OrderDetail, now: Date) {
  const qr = order.qr!;
  const quote = order.quotes.find((q) => q.id === order.quoteId)!;
  const accountId = quote.fulfiller;
  const penaltyCents = Math.max(
    1,
    Math.ceil((cents(quote.bondLockUsd) * QR_POLICY.noShowPenaltyBps) / 10_000),
  );
  unlockFulfiller(order, false);
  const f = fulfillerById(accountId)!;
  const taken = Math.min(penaltyCents, cents(f.bondUsd));
  settleBondSlash(order, f, taken, "slash_noshow");
  qr.noShows.push({ fulfiller: accountId, at: now.toISOString(), penaltyUsd: taken / 100 });
  qr.excluded.push(accountId);
  order.quoteId = undefined;
  order.fulfiller = undefined;
  order.quotes = [];
  qr.claimedAt = qr.claimDeadline = undefined;
  if (qr.noShows.length >= QR_POLICY.maxNoShows || now >= new Date(qr.expiresAt)) {
    refundEscrow(order, "refund");
    setState(order, "qr_refund", now, "Local never sent the transfer");
    step(order, "refund_noshow", now, "Local did not send in time: refunded");
  } else {
    step(order, "release_claim", now, "Local did not send in time: back to the pool");
  }
}
/** Lazily apply time-driven transitions. Never refunds after the local said "sent". */
function tickOrder(order: OrderDetail, now: Date): boolean {
  const qr = order.qr!;
  let changed = syncStage(order, now);
  for (let i = 0; i < 8; i++) {
    const before = qr.stage + qr.timeline.length;
    if (
      qr.autoLocal &&
      autoLocalEnabled() &&
      ["finding_local", "claimed", "transfer_sent"].includes(qr.stage) &&
      now < new Date(qr.expiresAt)
    ) {
      const due =
        new Date(qr.autoLocal.startAt).getTime() +
        (qr.autoLocal.step + 1) * autoLocalSeconds() * 1000;
      if (now.getTime() >= due) {
        qr.autoLocal.step++;
        runAutoLocalStep(order, now);
      }
    }
    if (qr.stage === "awaiting_funding" && now >= new Date(qr.expiresAt)) {
      setState(order, "qr_expire", now);
      step(order, "expire", now, "Expired before payment");
    } else if (qr.stage === "finding_local" && now >= new Date(qr.expiresAt)) {
      refundEscrow(order, "refund");
      setState(order, "qr_expire", now, "No local claimed in time");
      step(order, "expire", now, "No local found: refunded");
    } else if (qr.stage === "claimed" && qr.claimDeadline && now >= new Date(qr.claimDeadline)) {
      applyNoShow(order, now);
    } else if (qr.stage === "transfer_sent" && qr.proofDeadline && now >= new Date(qr.proofDeadline)) {
      moveToReview(order, "timeout", now, "No proof in time: under review (no automatic refund)");
    } else if (qr.stage === "awaiting_confirmation" && qr.confirmDeadline && now >= new Date(qr.confirmDeadline)) {
      moveToReview(order, "timeout", now, "No confirmation in time: under review");
    }
    if (before === qr.stage + qr.timeline.length) break;
    changed = true;
  }
  return changed;
}
function moveToReview(order: OrderDetail, event: QrEvent, at: Date, label: string) {
  step(order, event, at, label);
  if (order.state === "Funded" || order.state === "Purchased") {
    setState(order, "to_review", at, label);
  }
}
/** Load an order, apply due timeouts and persist. */
function load(orderId: string): OrderDetail {
  return atomic(() => {
    const order = qrOrder(orderId);
    if (tickOrder(order, effectiveNow(order))) saveOrder(order);
    return order;
  });
}
export function tickAll(): void {
  for (const o of orders()) if (o.qr) load(o.id);
}

/* ---------------------------------------------------------------- views */
export type QrOrderView = ReturnType<typeof orderView>;
function localProfile(order: OrderDetail) {
  const f = order.fulfiller ? (fulfillerById(order.fulfiller.accountId) ?? order.fulfiller) : undefined;
  if (!f) return undefined;
  const quote = order.quotes.find((q) => q.id === order.quoteId);
  return {
    accountId: f.accountId,
    name: f.displayName,
    city: f.city,
    rating: f.rating ?? 4.5,
    completed: f.counters.completed,
    level: f.tier,
    bondLockedUsd: quote?.bondLockUsd ?? 0,
  };
}
export function orderView(order: OrderDetail) {
  const qr = order.qr!;
  const proof = qr.proof ?? qr.attempts[qr.attempts.length - 1];
  const dispute = order.dispute;
  return {
    id: order.id,
    stage: qr.stage,
    requester: order.buyer,
    merchant: { name: qr.merchant.name, bank: qr.merchant.bank, accountMasked: qr.merchant.accountMasked },
    vndAmount: qr.vndAmount,
    fxRate: qr.fxRate,
    fxSource: qr.fxSource,
    principalUsd: qr.principalUsd,
    rewardUsd: qr.rewardUsd,
    totalUsd: qr.totalUsd,
    transferNote: qr.transferCode,
    payWith: qr.payWith,
    funding: qr.funding,
    local: localProfile(order),
    timeline: qr.timeline,
    proof: proof
      ? {
          method: proof.method,
          accepted: proof.accepted,
          checks: proof.checks,
          limited: proof.limited,
          attestation: proof.attestation,
          bankRef: proof.bankRef,
          submittedAt: proof.submittedAt,
        }
      : undefined,
    proofAttempts: qr.attempts.length,
    deadlines: {
      expiresAt: qr.expiresAt,
      claimDeadline: qr.claimDeadline,
      proofDeadline: qr.proofDeadline,
      confirmDeadline: qr.confirmDeadline,
    },
    noShows: qr.noShows,
    ratingGiven: qr.ratingGiven,
    dispute: dispute
      ? {
          reason: dispute.reason,
          outcome: dispute.outcome,
          settled: ["Released", "Refunded"].includes(order.state),
          canAppeal: order.state === "Resolved" && !dispute.appealCount,
          stakeUsd: dispute.buyerStakeUsd,
        }
      : undefined,
    escrowUsd: order.escrowUsd,
    createdAt: order.createdAt,
    mock: order.mock,
    links: { proof: `/orders/${order.id}/proof`, api: `/api/orders/${order.id}` },
  };
}
export function getQrOrder(orderId: string) {
  return orderView(load(orderId));
}
export function listQrOrders(requester?: string) {
  tickAll();
  return orders()
    .filter((o) => o.qr && (!requester || o.buyer === requester))
    .map(orderView);
}

/* ------------------------------------------------------------- requester */
export async function previewQr(input: {
  qrPayload: string;
  amountVnd?: number;
  rewardUsd?: number;
}) {
  const qr = parseQrSafe(input.qrPayload);
  const vnd = qr.amountVnd ?? input.amountVnd;
  const fx = await getFxQuote();
  const reward = input.rewardUsd ?? DEFAULT_REWARD_USD;
  return {
    merchant: { name: qr.name, bank: qr.bank, accountMasked: qr.accountMasked },
    vndAmount: vnd ?? null,
    amountEditable: qr.amountVnd === undefined,
    fxRate: fx.vndPerUsd,
    fxSource: fx.source,
    ...(vnd ? priceQr(vnd, fx.vndPerUsd, reward) : {}),
    payWithOptions: [...PAY_WITH],
    defaultRewardUsd: DEFAULT_REWARD_USD,
    note: "A QR shows where money goes, not proof of payment.",
  };
}
function parseQrSafe(payload: string) {
  try {
    return parseVietQr(String(payload ?? ""));
  } catch (error) {
    throw new Error(`Invalid QR: ${(error as Error).message}`);
  }
}
export async function createQrOrder(input: {
  qrPayload: string;
  amountVnd?: number;
  rewardUsd?: number;
  payWith?: string;
  requester?: string;
  /** false = the demo auto-local bot must never touch this order (add-only). */
  autoLocal?: boolean;
}) {
  requireMockChain();
  const qr = parseQrSafe(input.qrPayload);
  if (qr.amountVnd !== undefined && input.amountVnd !== undefined && input.amountVnd !== qr.amountVnd)
    throw new Error("Amount mismatch: the QR already fixes the amount");
  const vnd = qr.amountVnd ?? input.amountVnd;
  if (!vnd) throw new Error("Amount required: this QR has no amount");
  const payWith = (input.payWith ?? "USDC").toUpperCase();
  if (!PAY_WITH.includes(payWith as PayWith)) throw new Error("Invalid payWith token");
  const fx = await getFxQuote();
  return atomic(() => {
    const taken = new Set(orders().map((o) => o.qr?.transferCode));
    let code = transferCodeFrom(randomBytes(4));
    while (taken.has(code)) code = transferCodeFrom(randomBytes(4));
    const order = buildQrOrderDetail({
      id: id("qr"),
      buyer: input.requester || DEFAULT_REQUESTER,
      now: new Date(),
      qr,
      vnd,
      fx: { rate: fx.vndPerUsd, source: fx.source },
      rewardUsd: input.rewardUsd ?? DEFAULT_REWARD_USD,
      payWith,
      transferCode: code,
      mock: mockMode(),
    });
    saveOrder(order);
    if (input.autoLocal === false) put(key("noautolocal", order.id), "noautolocal", { off: true });
    return orderView(order);
  });
}
export function fundQrOrder(orderId: string, input: { payWith?: string } = {}) {
  requireMockChain();
  return atomic(() => {
    const order = load(orderId);
    const qr = order.qr!;
    if (qr.stage !== "awaiting_funding") throw conflict(`Cannot fund from ${qr.stage}`);
    const now = effectiveNow(order);
    const payWith = (input.payWith ?? qr.payWith).toUpperCase() as PayWith;
    const intent = mockIntentsFunding(payWith, qr.totalUsd, order.id);
    transferCents(order.buyer, `escrow:${order.id}`, cents(qr.totalUsd));
    setState(order, "qr_fund", now, "Funded via mock NEAR Intents");
    order.escrowUsd = qr.totalUsd;
    transaction(order, "escrow", qr.totalUsd);
    qr.payWith = payWith;
    qr.funding = {
      payWith,
      payAmount: intent.payAmount,
      intentId: intent.intentId,
      mock: true,
      at: now.toISOString(),
    };
    step(order, "fund", now, "Paid into escrow");
    if (autoLocalEnabled() && !get(key("noautolocal", order.id))) qr.autoLocal = { startAt: now.toISOString(), step: 0 };
    saveOrder(order);
    return orderView(order);
  });
}
export function cancelQrOrder(orderId: string) {
  return atomic(() => {
    const order = load(orderId);
    const qr = order.qr!;
    const now = effectiveNow(order);
    if (!["awaiting_funding", "finding_local"].includes(qr.stage))
      throw conflict(`Cannot cancel from ${qr.stage}: a local already took this job`);
    if (qr.stage === "finding_local") {
      refundEscrow(order, "refund");
      setState(order, "qr_cancel", now, "Cancelled before claim");
    } else {
      setState(order, "cancel", now, "Cancelled before payment");
    }
    step(order, "cancel", now, "Cancelled (free)");
    saveOrder(order);
    return orderView(order);
  });
}
export function confirmQrOrder(orderId: string, input: { received: boolean; rating?: number }) {
  if (typeof input.received !== "boolean") throw new Error("received (boolean) required");
  return atomic(() => {
    const order = load(orderId);
    const qr = order.qr!;
    const now = effectiveNow(order);
    if (!input.received) {
      if (qr.stage === "under_review") return orderView(order);
      step(order, "deny", now, "Requester reported the merchant has not received it");
      saveOrder(order);
      return orderView(order);
    }
    if (!["awaiting_confirmation", "under_review"].includes(qr.stage))
      throw conflict(`Cannot confirm from ${qr.stage}`);
    if (order.dispute) throw conflict("A dispute is in progress; wait for the decision");
    if (order.state !== "Delivered") throw conflict("Order is not ready to release");
    step(order, "confirm", now, "Requester confirmed the merchant received it");
    setState(order, "confirm", now);
    const quote = order.quotes.find((q) => q.id === order.quoteId)!;
    transferCents(`escrow:${order.id}`, quote.fulfiller, cents(order.escrowUsd!));
    transaction(order, "release", order.escrowUsd);
    unlockFulfiller(order, true);
    if (input.rating !== undefined) {
      if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5)
        throw new Error("Invalid rating");
      const f = fulfillerById(quote.fulfiller)!;
      const n = f.ratingCount ?? 0;
      f.rating = Math.round((((f.rating ?? 4.5) * n + input.rating) / (n + 1)) * 100) / 100;
      f.ratingCount = n + 1;
      saveFulfiller(f);
      qr.ratingGiven = input.rating;
    }
    saveOrder(order);
    return orderView(order);
  });
}
const DISPUTE_REASONS = ["not_received", "wrong_amount", "wrong_recipient", "other"];
export async function disputeQrOrder(
  orderId: string,
  input: { reason: string; text?: string },
) {
  const reason = String(input.reason ?? "");
  if (!DISPUTE_REASONS.includes(reason)) throw new Error("Invalid dispute reason");
  // Complaint text is untrusted data: bounded, control characters stripped, then
  // passed unchanged to the injection detector and court as quoted evidence.
  // eslint-disable-next-line no-control-regex
  const text = String(input.text ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").slice(0, 2000).trim();
  const order = load(orderId);
  const qr = order.qr!;
  if (!["awaiting_confirmation", "under_review"].includes(qr.stage))
    throw conflict(`Cannot dispute from ${qr.stage}`);
  if (order.dispute) throw conflict("Already disputed");
  if (order.state !== "Delivered") throw conflict("Nothing to dispute yet");
  if (qr.stage === "awaiting_confirmation") confirmQrOrder(orderId, { received: false });
  await act(orderId, { action: "dispute", reason: `[${reason}] ${text}`.trim() });
  return getQrOrder(orderId);
}
export async function settleQrOrder(orderId: string) {
  await act(orderId, { action: "settle" });
  return getQrOrder(orderId);
}

/* ---------------------------------------------------------------- locals */
export function jobView(order: OrderDetail, fulfillerId?: string) {
  const qr = order.qr!;
  const f = fulfillerId ? fulfillerById(fulfillerId) : undefined;
  const mine = !!f && order.fulfiller?.accountId === f.accountId;
  const bondLockUsd = f ? requiredBond(qr.totalUsd, f.tier) : requiredBond(qr.totalUsd, 0);
  let canClaim = qr.stage === "finding_local";
  let reason: string | undefined;
  if (canClaim && f) {
    if (qr.excluded.includes(f.accountId)) (canClaim = false), (reason = "You missed this job earlier");
    else if (cents(f.bondUsd - f.lockedUsd) < cents(bondLockUsd)) (canClaim = false), (reason = "Your deposit is too small for this job");
    else if (cents(openExposure(f.accountId, order.id) + qr.totalUsd) > cents(f.bondUsd * [1, 2, 4, 10][f.tier]))
      (canClaim = false), (reason = "You have too many open jobs");
  }
  const parsed = mine ? parseVietQr((order.spec as { rawQr: string }).rawQr) : undefined;
  return {
    id: order.id,
    stage: qr.stage,
    merchant: { name: qr.merchant.name, bank: qr.merchant.bank, accountMasked: qr.merchant.accountMasked },
    vndAmount: qr.vndAmount,
    principalUsd: qr.principalUsd,
    rewardUsd: qr.rewardUsd,
    payoutUsd: qr.totalUsd,
    bondLockUsd,
    canClaim,
    reason,
    postedAt: qr.timeline.find((t) => t.stage === "finding_local")?.at ?? order.createdAt,
    expiresAt: qr.expiresAt,
    claimDeadline: qr.claimDeadline,
    proofDeadline: qr.proofDeadline,
    claimedByYou: mine,
    // Pay-to details and the transfer note are revealed only to the claiming local.
    payTo: parsed
      ? {
          name: parsed.name,
          bank: parsed.bank,
          accountNumber: parsed.accountNumber,
          vndAmount: qr.vndAmount,
          transferNote: qr.transferCode,
        }
      : undefined,
    proof: mine && (qr.proof ?? qr.attempts.at(-1))
      ? { ...(qr.proof ?? qr.attempts.at(-1))! }
      : undefined,
    timeline: mine ? qr.timeline : undefined,
    links: { order: `/api/qr/orders/${order.id}` },
  };
}
export function listJobs(input: { fulfiller?: string; scope?: string }) {
  tickAll();
  const all = orders().filter((o) => o.qr);
  if (input.scope === "mine") {
    if (!input.fulfiller) throw new Error("fulfiller required");
    return all
      .filter((o) => o.fulfiller?.accountId === input.fulfiller)
      .map((o) => jobView(o, input.fulfiller));
  }
  return all
    .filter((o) => o.qr!.stage === "finding_local")
    .filter((o) => !input.fulfiller || !o.qr!.excluded.includes(input.fulfiller))
    .sort((a, b) => b.qr!.totalUsd - a.qr!.totalUsd)
    .map((o) => jobView(o, input.fulfiller));
}
export function getJob(jobId: string, fulfillerId?: string) {
  return jobView(load(jobId), fulfillerId);
}
export function earnings(fulfillerId: string) {
  tickAll();
  const f = fulfillerById(fulfillerId);
  if (!f) throw notFound("Fulfiller not found");
  const mine = orders().filter((o) => o.qr && o.fulfiller?.accountId === f.accountId);
  const paid = (since: number) =>
    mine
      .filter((o) => o.qr!.stage === "done")
      .filter((o) => new Date(o.qr!.timeline.at(-1)!.at).getTime() >= since)
      .reduce((s, o) => s + cents(o.qr!.totalUsd), 0) / 100;
  const dayMs = 86_400_000;
  const nextLevel = [5, 25, 100][f.tier] as number | undefined;
  return {
    accountId: f.accountId,
    name: f.displayName,
    level: f.tier,
    rating: f.rating ?? 4.5,
    completed: f.counters.completed,
    bondUsd: f.bondUsd,
    bondLockedUsd: f.lockedUsd,
    bondFreeUsd: (cents(f.bondUsd) - cents(f.lockedUsd)) / 100,
    todayUsd: paid(Date.now() - dayMs),
    weekUsd: paid(Date.now() - 7 * dayMs),
    jobsToNextLevel: nextLevel ? Math.max(0, nextLevel - f.counters.completed) : 0,
    activeJobs: mine.filter((o) => !qrTerminal(o.qr!.stage)).map((o) => o.id),
  };
}
export function claimJob(jobId: string, fulfillerId: string) {
  requireMockChain();
  return atomic(() => jobView(doClaim(load(jobId), fulfillerId), fulfillerId));
}
function doClaim(order: OrderDetail, fulfillerId: string): OrderDetail {
  {
    const qr = order.qr!;
    const now = effectiveNow(order);
    const f = fulfillerById(fulfillerId);
    if (!f) throw notFound("Fulfiller not found");
    if (qr.stage !== "finding_local")
      throw conflict(qr.stage === "claimed" ? "Job already claimed" : `Cannot claim from ${qr.stage}`);
    if (!f.kinds.includes("qr_payment")) throw forbidden("This local does not take QR jobs");
    if (qr.excluded.includes(f.accountId)) throw forbidden("You missed this job earlier");
    if (f.accountId === order.buyer) throw forbidden("You cannot claim your own job");
    const quote: Quote = {
      id: id("quote"),
      orderId: order.id,
      fulfiller: f.accountId,
      displayName: f.displayName,
      tier: f.tier,
      costUsd: qr.principalUsd,
      feeUsd: qr.rewardUsd,
      totalUsd: qr.totalUsd,
      etaMinutes: 5,
      validUntil: new Date(now.getTime() + 3600_000).toISOString(),
      bondLockUsd: requiredBond(qr.totalUsd, f.tier),
      signature: `mock-signature-${sha256(order.id + f.accountId).slice(0, 16)}`,
    };
    assertQuoteAffordable(quote, f, openExposure(f.accountId, order.id), now);
    f.lockedUsd = (cents(f.lockedUsd) + cents(quote.bondLockUsd)) / 100;
    saveFulfiller(f);
    order.quotes = [quote];
    order.quoteId = quote.id;
    order.fulfiller = f;
    qr.claimedAt = now.toISOString();
    qr.claimDeadline = plusMin(now, QR_POLICY.claimWindowMin).toISOString();
    step(order, "claim", now, `${f.displayName} accepted the job`);
    saveOrder(order);
    return order;
  }
}
function ownJob(order: OrderDetail, fulfillerId: string) {
  if (order.fulfiller?.accountId !== fulfillerId)
    throw forbidden("This job is not yours");
}
export function markSent(jobId: string, fulfillerId: string) {
  return atomic(() => jobView(doSent(load(jobId), fulfillerId), fulfillerId));
}
function doSent(order: OrderDetail, fulfillerId: string): OrderDetail {
  {
    const qr = order.qr!;
    const now = effectiveNow(order);
    if (qr.stage !== "claimed") {
      if (order.fulfiller?.accountId !== fulfillerId && qr.stage !== "finding_local")
        throw forbidden("This job is not yours");
      throw conflict(`Cannot mark sent from ${qr.stage}`);
    }
    ownJob(order, fulfillerId);
    qr.sentAt = now.toISOString();
    qr.proofDeadline = plusMin(now, QR_POLICY.proofWindowMin).toISOString();
    step(order, "sent", now, `${order.fulfiller!.displayName} says the transfer was sent`);
    saveOrder(order);
    return order;
  }
}
const MAX_BYTES = 6 * 1024 * 1024;
function decode(b64: unknown, what: string): Buffer {
  if (typeof b64 !== "string" || !b64) throw new Error(`${what} required`);
  const bytes = Buffer.from(b64, "base64");
  if (!bytes.length || bytes.length > MAX_BYTES) throw new Error(`Invalid ${what} size`);
  return bytes;
}
export type ProofInput = {
  fulfiller: string;
  emlBase64?: string;
  useSample?: "valid" | "wrong_amount" | "tampered" | BankNoticeVariant;
  slipImageBase64?: string;
};
export function submitProof(jobId: string, input: ProofInput) {
  return atomic(() => doProof(load(jobId), input));
}
function doProof(order: OrderDetail, input: ProofInput) {
  {
    const qr = order.qr!;
    const now = effectiveNow(order);
    if (qr.stage !== "transfer_sent") {
      if (order.fulfiller?.accountId !== input.fulfiller && !["finding_local"].includes(qr.stage))
        throw forbidden("This job is not yours");
      throw conflict(`Cannot submit proof from ${qr.stage}`);
    }
    ownJob(order, input.fulfiller);
    const parsed = parseVietQr((order.spec as { rawQr: string }).rawQr);
    let record: QrProofRecord;
    let evidence: EvidenceFact | undefined;
    const used = new Set(
      orders()
        .filter((o) => o.id !== order.id)
        .flatMap((o) => [o.qr?.proof?.nullifier, o.evidence?.nullifier])
        .filter((x): x is string => !!x),
    );
    if (input.emlBase64 || input.useSample) {
      let eml: Buffer;
      if (input.useSample) {
        if (!mockMode()) throw new Error("Sample evidence is mock-only");
        const masked = "x".repeat(parsed.accountNumber.length - 4) + parsed.accountNumber.slice(-4);
        eml = lotusBankNotice(input.useSample, {
          amountVnd: qr.vndAmount,
          transferCode: qr.transferCode,
          recipientMasked: masked,
          at: now,
        });
      } else eml = decode(input.emlBase64, "emlBase64");
      const dkim = verifyDkimSignature(eml);
      const result = evaluateBankProof({
        dkim,
        expected: {
          amountVnd: qr.vndAmount,
          accountNumber: parsed.accountNumber,
          transferCode: qr.transferCode,
          claimedAt: new Date(qr.claimedAt!),
        },
        usedNullifiers: used,
        now,
      });
      record = {
        method: "bank_email",
        accepted: result.pass,
        limited: false,
        checks: result.checks,
        submittedAt: now.toISOString(),
        bankRef: result.bankRef,
        nullifier: result.pass ? result.nullifier : undefined,
        attestation: {
          provider: "mock",
          inputHash: sha256(eml.toString("base64")),
          outputHash: sha256(result.checks),
          verifiedAt: now.toISOString(),
          note: "Mock secure verifier (not a TEE). DKIM checked against bundled test keys.",
        },
      };
      if (result.pass)
        evidence = {
          orderId: order.id,
          dkimValid: dkim.valid,
          dkimDomain: dkim.domain,
          orderRef: result.bankRef ?? "",
          nullifier: result.nullifier!,
          extracted: {
            date: (result.extracted.at ?? now.toISOString()).slice(0, 10),
            qty: 1,
            names: [],
            item: "QR bank transfer",
          },
          checks: result.checks,
          attestation: {
            provider: "mock",
            inputHash: record.attestation.inputHash,
            outputHash: record.attestation.outputHash,
          },
        };
    } else if (input.slipImageBase64) {
      const slip = decode(input.slipImageBase64, "slipImageBase64");
      const nullifier = sha256(slip);
      const reused = used.has(nullifier);
      const checks: Check[] = [
        { id: "slip_received", pass: true, detail: "Slip image received" },
        { id: "not_reused", pass: !reused, detail: reused ? "This slip image was already used" : "Slip image not used before" },
        { id: "bank_email", pass: false, detail: "No bank email: limited proof only. A slip image is not proof of payment." },
      ];
      record = {
        method: "slip",
        accepted: !reused,
        limited: true,
        checks,
        submittedAt: now.toISOString(),
        nullifier: reused ? undefined : nullifier,
        attestation: {
          provider: "mock",
          inputHash: nullifier,
          outputHash: sha256(checks),
          verifiedAt: now.toISOString(),
          note: "Slip is unverified. Requester confirmation is required.",
        },
      };
    } else throw new Error("Proof required: emlBase64, useSample or slipImageBase64");
    qr.attempts.push(record);
    step(order, "submit", now, "Proof received");
    if (!record.accepted) {
      step(order, "reject_proof", now, "Proof failed some checks");
      if (qr.attempts.length >= QR_POLICY.maxProofAttempts)
        moveToReview(order, "timeout", now, "Too many failed proofs: under review (no automatic refund)");
    } else {
      qr.proof = record;
      setState(order, "submit_evidence", now);
      setState(order, "verify_ok", now, record.limited ? "Limited proof (slip)" : "Bank email verified");
      if (evidence) {
        order.evidence = evidence;
        order.checks = [...(order.checks || []), ...evidence.checks];
      }
      step(order, record.limited ? "accept_limited" : "accept", now, record.limited ? "Limited proof accepted" : "Bank email verified");
      step(order, "request_confirmation", now, "Waiting for requester confirmation");
      qr.confirmDeadline = plusMin(now, QR_POLICY.confirmWindowMin).toISOString();
    }
    saveOrder(order);
    return {
      accepted: record.accepted,
      limited: record.limited,
      method: record.method,
      checks: record.checks,
      attestation: record.attestation,
      stage: qr.stage,
      job: jobView(order, input.fulfiller),
    };
  }
}

/* ------------------------------------------------------------------ demo */
function runAutoLocalStep(order: OrderDetail, now: Date) {
  const qr = order.qr!;
  void now;
  if (qr.stage === "finding_local") {
    for (const accountId of AUTO_LOCALS) {
      try {
        doClaim(order, accountId);
        return;
      } catch {
        /* try the next seeded local */
      }
    }
    qr.autoLocal = undefined;
  } else if (qr.stage === "claimed") doSent(order, order.fulfiller!.accountId);
  else if (qr.stage === "transfer_sent")
    doProof(order, { fulfiller: order.fulfiller!.accountId, useSample: "valid" });
}
export type DemoStepInput = {
  orderId: string;
  action?: "next" | "advance";
  actor?: "local" | "requester";
  minutes?: number;
  variant?: ProofInput["useSample"];
  received?: boolean;
  fulfiller?: string;
};
/** Deterministic stepper for /demo and tests. Mock mode only. */
export function demoStep(input: DemoStepInput) {
  if (!mockMode()) throw new Error("Demo stepping is mock-only");
  const base = qrOrder(input.orderId);
  if (input.action === "advance") {
    const minutes = Number(input.minutes);
    if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 7 * 24 * 60)
      throw new Error("Invalid minutes");
    put(key("clock", base.id), "clock", {
      offsetMs: (get<{ offsetMs: number }>(key("clock", base.id))?.offsetMs || 0) + minutes * 60_000,
    });
    return { performed: `advanced clock ${minutes} min`, order: getQrOrder(base.id) };
  }
  const order = load(base.id);
  const stage = order.qr!.stage;
  const local = input.fulfiller ?? order.fulfiller?.accountId ?? AUTO_LOCALS[0];
  let performed: string;
  if (stage === "awaiting_funding" && input.actor !== "local") {
    fundQrOrder(order.id);
    performed = "requester funded";
  } else if (stage === "finding_local") {
    let ok = false;
    for (const accountId of input.fulfiller ? [input.fulfiller] : AUTO_LOCALS) {
      try {
        claimJob(order.id, accountId);
        ok = true;
        break;
      } catch (error) {
        if (input.fulfiller) throw error;
      }
    }
    if (!ok) throw conflict("No seeded local can take this job");
    performed = "local claimed";
  } else if (stage === "claimed") {
    markSent(order.id, local);
    performed = "local marked sent";
  } else if (stage === "transfer_sent") {
    const r = submitProof(order.id, { fulfiller: local, useSample: input.variant ?? "valid" });
    performed = r.accepted ? "local submitted proof (accepted)" : "local submitted proof (rejected)";
  } else if (stage === "awaiting_confirmation" || stage === "under_review") {
    confirmQrOrder(order.id, { received: input.received !== false, rating: 5 });
    performed = input.received === false ? "requester reported a problem" : "requester confirmed";
  } else throw conflict(`Nothing to do from ${stage}`);
  return { performed, order: getQrOrder(order.id) };
}
export { samplePhoQr, fulfillers, nowIso };
export type { QrStage, Fulfiller };
