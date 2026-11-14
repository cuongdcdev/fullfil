import type { CryptorefillsClient } from "./cryptorefills";
import { requiredString } from "./cryptorefills";
import type { OneClickClient } from "./oneclick";
import { usdcUnits } from "./quote";
import { StateStore, type OrderState } from "./state";
import { canonicalJson, deliveryMatchesKind, normalizeBeneficiary, sha256Hex,
  specHash } from "@fulfil/core";
import { ORIGIN_USDC } from "./oneclick";
import type { EscrowOrder, ShopperEscrowRpc } from "./rpc";
import { atStage, cycleErrorCode, describeCycleError, isTimeoutError, StageError } from "./diagnostics";
import type { Journal, JournalInput } from "./journal";
import type { Alerter } from "./alerts";
import { alertInput, safeAlertValue } from "./alerts";
import type { CycleStage } from "./diagnostics";
import { validateResponseMatches } from "./validate";
export type BotApi = {
  request<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T>;
  signAndSubmit(input: Record<string, unknown>): Promise<{ tx_hash?: string }>;
  submitBuilt(built: { payload_to_sign: { message: string; nonce: string; recipient: string } },
    expected: Record<string, unknown>): Promise<{ tx_hash?: string }>;
};
export type BotClients = {
  api: BotApi;
  escrow: Pick<ShopperEscrowRpc, "getOrder" | "getClaimTimeoutNs">;
  cryptorefills: Pick<CryptorefillsClient, "validateOrder" | "createOrder" | "getOrderStatus">;
  oneClick: Pick<OneClickClient, "quote" | "submit" | "status">;
  store: Pick<StateStore, "get" | "entries" | "set">;
  journal: Journal;
  alerter: Alerter;
  accountId: string;
  maxUsdc: bigint;
  reserveUsdc: bigint;
  minTimeLeftMs: number;
  clock?: () => number;
  sleep?: (ms: number) => Promise<void>;
  log?: (message: string) => void;
  readBalance: () => Promise<bigint>;
};

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const timeoutMs = 20 * 60_000;
const NS_PER_MS = 1_000_000n;
const PRE_PURCHASE_MIN_MS = 600_000;
const PRE_PURCHASE_CLAIM_MIN_MS = 480_000;
export const PROOF_MARGIN_MS = 60_000;
class LostClaimError extends Error {}
class KindMismatchError extends Error {}

function timeLeftNs(order: EscrowOrder, now: () => number): bigint {
  return BigInt(order.deadline_ns) - BigInt(now()) * NS_PER_MS;
}

function lessThanMs(order: EscrowOrder, now: () => number, milliseconds: number): boolean {
  return timeLeftNs(order, now) < BigInt(milliseconds) * NS_PER_MS;
}

function writeJournal(clients: BotClients, input: JournalInput): void {
  try {
    clients.journal.record(input);
  } catch (error) {
    throw new StageError("journal", error);
  }
}

export function recordState(
  clients: BotClients,
  id: string,
  state: OrderState,
  stage: CycleStage,
  errorCode?: string,
): void {
  const previous = clients.store.get(id);
  const transitioned = previous?.phase !== state.phase;
  // The snapshot may contain the only copy of an upstream token or payment hash.
  clients.store.set(id, state);
  try {
    if (transitioned) {
      writeJournal(clients, {
        order_id: id,
        from_phase: previous?.phase ?? null,
        to_phase: state.phase,
        stage,
        state,
        error_code: errorCode,
      });
    }
  } finally {
    if (transitioned && (state.phase === "uncertain" || state.phase === "failed")) {
      try {
        clients.alerter.alert(alertInput(id, state.phase, stage, errorCode ?? "unknown"));
      } catch {
        // An alert sink must never interrupt recovery or the shopper loop.
      }
    }
  }
}

function recordStep(clients: BotClients, id: string, state: OrderState, stage: CycleStage): void {
  writeJournal(clients, { order_id: id, from_phase: state.phase, to_phase: null, stage, state });
}

function alertUncertain(
  order: { id: string }, clients: BotClients, state: OrderState,
  stage: CycleStage, code: string,
): void {
  recordState(clients, order.id, { ...state, phase: "uncertain" }, stage, code);
}

function shopperKind(kind: string): boolean {
  return kind === "cryptorefills_topup" || kind === "cryptorefills_code";
}

async function verifiedDelivery(order: EscrowOrder, clients: BotClients, state: OrderState) {
  if (!state.spec || !state.beneficiary) throw new Error("Missing order spec");
  const spec = JSON.parse(state.spec) as Record<string, unknown>;
  const normalizedBeneficiary = normalizeBeneficiary(state.beneficiary,
    spec.delivery_type as "by_phone" | "by_email");
  const request = delivery(state, normalizedBeneficiary);
  const specKeys = [
    "beneficiary_hash",
    "brand_name",
    "country",
    "delivery_type",
    "denomination",
    "product_value",
    "salt",
    "v",
  ];
  const chainOrder = await atStage("order", () => clients.escrow.getOrder(order.id));
  if (!chainOrder || !shopperKind(chainOrder.kind) ||
    chainOrder.fulfiller !== clients.accountId ||
    !["claimed", "sent", "proof_rejected"].includes(chainOrder.status)) {
    throw new LostClaimError("Shopper no longer owns the claim");
  }
  if (
    canonicalJson(spec) !== state.spec || specHash(state.spec) !== chainOrder.spec_hash ||
    Object.keys(spec).sort().join(",") !== specKeys.join(",") ||
    spec.v !== 1 || typeof spec.salt !== "string" || !/^[a-f0-9]{32}$/.test(spec.salt) ||
    !["by_phone", "by_email"].includes(String(spec.delivery_type)) ||
    typeof spec.brand_name !== "string" || !spec.brand_name ||
    typeof spec.country !== "string" || !/^[A-Z]{2}$/.test(spec.country) ||
    typeof spec.denomination !== "string" || typeof spec.product_value !== "string" ||
    (!!spec.denomination === !!spec.product_value) ||
    (spec.product_value && !/^\d+(?:\.\d+)?$/.test(spec.product_value)) ||
    sha256Hex(`${spec.salt}:${request.beneficiary_account}`) !== spec.beneficiary_hash
  ) {
    throw new Error("Order spec mismatch");
  }
  if (request.brand_name !== spec.brand_name || request.country_code !== spec.country ||
    request.beneficiary_account !== normalizedBeneficiary ||
    request.denomination !== (spec.denomination || "range") ||
    (spec.product_value && request.product_value !== spec.product_value)) {
    throw new Error("Order delivery mismatch");
  }
  return request;
}
function delivery(state: OrderState, beneficiary: string): Record<string, unknown> {
  if (!state.spec || !state.beneficiary) throw new Error("Missing order spec");
  const spec = JSON.parse(state.spec) as Record<string, string>;
  return {
    brand_name: spec.brand_name,
    country_code: spec.country,
    beneficiary_account: beneficiary,
    ...(spec.denomination
      ? { denomination: spec.denomination }
      : { denomination: "range", product_value: spec.product_value }),
  };
}

async function release(order: EscrowOrder, clients: BotClients, state: OrderState): Promise<void> {
  if (state.phase === "released") return;
  const finalPhase = state.delivery_failed ? "failed" : "released";
  const errorCode = state.delivery_failed ? "delivery_failed" : undefined;
  const chainOrder = await atStage("release", () => clients.escrow.getOrder(order.id));
  if (chainOrder?.status === "funded" && chainOrder.fulfiller === null) {
    recordState(clients, order.id, { ...state, phase: finalPhase }, "release", errorCode);
    return;
  }
  if (!chainOrder || !shopperKind(chainOrder.kind) ||
    chainOrder.fulfiller !== clients.accountId ||
    !["claimed", "sent", "proof_rejected"].includes(chainOrder.status)) {
    recordState(clients, order.id, { ...state, phase: "uncertain" }, "release", "claim_lost");
    return;
  }
  const releasing = { ...state, phase: "releasing" as const };
  recordState(clients, order.id, releasing, "release");
  recordStep(clients, order.id, releasing, "release");
  await atStage("release", () => clients.api.signAndSubmit({
    kind: "auth_call", op: "release_claim", order_id: order.id,
  }));
  recordState(clients, order.id, { ...releasing, phase: finalPhase }, "release", errorCode);
}

async function releaseKindMismatch(
  order: EscrowOrder, clients: BotClients, state: OrderState,
): Promise<void> {
  writeJournal(clients, {
    order_id: order.id, from_phase: state.phase, to_phase: null,
    stage: "validate", state, error_code: "kind_mismatch",
  });
  (clients.log ?? console.error)(
    `Shopper order refused order=${safeAlertValue(order.id)} stage=validate code=kind_mismatch`);
  await release(order, clients, state);
}

type PrePurchaseRefusalCode =
  "deadline_near" | "claim_timeout_near" | "claim_timeout_unknown";

async function releaseRefused(
  order: EscrowOrder, clients: BotClients, state: OrderState,
  stage: "create" | "pay", code: PrePurchaseRefusalCode,
): Promise<void> {
  writeJournal(clients, {
    order_id: order.id, from_phase: state.phase, to_phase: null,
    stage, state, error_code: code,
  });
  (clients.log ?? console.error)(
    `Shopper order refused order=${safeAlertValue(order.id)} stage=${stage} code=${code}`);
  await release(order, clients, state);
}

async function prePurchaseRefusal(
  order: EscrowOrder, clients: BotClients, now: () => number,
): Promise<PrePurchaseRefusalCode | null> {
  if (lessThanMs(order, now, PRE_PURCHASE_MIN_MS)) return "deadline_near";
  if (order.claimed_at === undefined || order.claimed_at === null) {
    return "claim_timeout_unknown";
  }
  let timeoutNs: string | null;
  try {
    timeoutNs = await clients.escrow.getClaimTimeoutNs(order.kind);
  } catch {
    return "claim_timeout_unknown";
  }
  if (timeoutNs === null || !/^\d+$/.test(timeoutNs)) return "claim_timeout_unknown";
  if (lessThanMs(order, now, PRE_PURCHASE_MIN_MS)) return "deadline_near";
  const claimTimeLeftNs = BigInt(order.claimed_at) + BigInt(timeoutNs) -
    BigInt(now()) * NS_PER_MS;
  return claimTimeLeftNs < BigInt(PRE_PURCHASE_CLAIM_MIN_MS) * NS_PER_MS
    ? "claim_timeout_near" : null;
}

const sentOrLaterStatuses = new Set([
  "sent", "verifying", "proof_rejected", "verified", "under_review",
  "paid", "closed", "disputed", "resolved",
]);

function logSent(clients: BotClients, line: string): void {
  try {
    (clients.log ?? console.error)(line);
  } catch {
    // A diagnostic sink must not interrupt the paid order's proof flow.
  }
}

function logSentSkip(clients: BotClients, orderId: string, code: string): void {
  logSent(clients,
    `Shopper order sent-mark skipped order=${safeAlertValue(orderId)} stage=sent code=${code}`);
}

function alertSentSkip(
  order: EscrowOrder, clients: BotClients, state: OrderState, code: string,
): OrderState {
  logSentSkip(clients, order.id, code);
  if (state.sent_blocked_alerted_at !== undefined) return state;
  const updated = { ...state, sent_blocked_alerted_at: (clients.clock ?? Date.now)() };
  recordState(clients, order.id, updated, "sent");
  try {
    clients.alerter.alert(alertInput(order.id, "uncertain", "sent", code));
  } catch {
    // An alert sink must never interrupt the paid order's proof flow.
  }
  return updated;
}

async function markSent(
  order: EscrowOrder, clients: BotClients, state: OrderState,
): Promise<OrderState> {
  const now = clients.clock ?? Date.now;
  let current = state;
  try {
    const chainOrder = await atStage("sent", () => clients.escrow.getOrder(order.id));
    if (chainOrder?.fulfiller === clients.accountId &&
      sentOrLaterStatuses.has(chainOrder.status)) {
      current = { ...current, sent_marked_at: now() };
      recordState(clients, order.id, current, "sent");
      recordStep(clients, order.id, current, "sent");
      return current;
    }
    if (!chainOrder || chainOrder.fulfiller !== clients.accountId ||
      chainOrder.status !== "claimed" || timeLeftNs(chainOrder, now) <= 0n) {
      const code = !chainOrder ? "order_missing" :
        chainOrder.fulfiller !== clients.accountId ? "claim_lost" :
        chainOrder.status !== "claimed" ? "not_claimed" : "deadline_passed";
      current = alertSentSkip(order, clients, current, code);
      return current;
    }
    if (chainOrder.claimed_at !== undefined && chainOrder.claimed_at !== null) {
      let claimTimeoutNs: string | null = null;
      try {
        claimTimeoutNs = await clients.escrow.getClaimTimeoutNs(chainOrder.kind);
      } catch {
        // A missing kind view must not prevent an otherwise valid sent attempt.
      }
      if (claimTimeoutNs !== null &&
        BigInt(now()) * NS_PER_MS >= BigInt(chainOrder.claimed_at) + BigInt(claimTimeoutNs)) {
        current = alertSentSkip(order, clients, current, "claim_timeout");
        return current;
      }
      if (timeLeftNs(chainOrder, now) <= 0n) {
        current = alertSentSkip(order, clients, current, "deadline_passed");
        return current;
      }
    }
    await atStage("sent", () => clients.api.signAndSubmit({
      kind: "auth_call", op: "sent", order_id: order.id,
    }));
    current = { ...current, sent_marked_at: now() };
    recordState(clients, order.id, current, "sent");
    recordStep(clients, order.id, current, "sent");
  } catch (error) {
    let cause = error;
    while (cause instanceof StageError) cause = cause.cause;
    const diagnostic = describeCycleError(new StageError("sent", cause));
    logSent(clients,
      `Shopper order sent-mark failed order=${safeAlertValue(order.id)} ` +
      diagnostic.replace(/^Shopper cycle failed /, ""));
  }
  return current;
}

async function hasCurrentClaim(
  order: EscrowOrder,
  clients: BotClients,
  state: OrderState,
  observed?: EscrowOrder | null,
): Promise<boolean> {
  const chainOrder = observed === undefined
    ? await atStage("order", () => clients.escrow.getOrder(order.id)) : observed;
  const claimableStates = ["claimed", "sent", "proof_rejected"];
  if (chainOrder && shopperKind(chainOrder.kind) &&
    chainOrder.fulfiller === clients.accountId && claimableStates.includes(chainOrder.status)) {
    return true;
  }
  recordState(clients, order.id, { ...state, phase: "uncertain" }, "order", "claim_lost");
  return false;
}

export async function processOrder(candidate: { id: string }, clients: BotClients): Promise<void> {
  const now = clients.clock ?? Date.now;
  const sleep = clients.sleep ?? pause;
  const store = clients.store;
  let state = store.get(candidate.id);
  if (state && ["proof_submitted", "released", "failed", "uncertain"].includes(state.phase)) return;
  const order = await atStage("order", () => clients.escrow.getOrder(candidate.id));
  if (!order || !shopperKind(order.kind)) {
    if (state) recordState(clients, candidate.id, { ...state, phase: "uncertain" }, "order", "order_missing");
    return;
  }
  let sentAttempted = false;
  const markSentOnce = async (current: OrderState): Promise<OrderState> => {
    if (sentAttempted || current.sent_marked_at !== undefined ||
      current.swap_succeeded_at === undefined) return current;
    sentAttempted = true;
    return markSent(order, clients, current);
  };
  if (!state && (order.status !== "funded" || BigInt(order.pay_amount) > clients.maxUsdc ||
    lessThanMs(order, now, clients.minTimeLeftMs) ||
    (order.quoted_by && order.quoted_by !== clients.accountId &&
      now() < Number(BigInt(order.created_at) / 1_000_000n) + 2 * 60_000))) {
    return;
  }
  if (state?.phase === "releasing") {
    await release(order, clients, state);
    return;
  }
  if (state?.phase === "creating") {
    // The upstream response may have been lost. Never issue createOrder again.
    await release(order, clients, state);
    return;
  }
  if (state?.phase === "paying") {
    // A transfer may already have executed. Human reconciliation is required.
    recordState(clients, order.id, { ...state, phase: "uncertain" }, "pay", "payment_unknown");
    return;
  }
  if (!state) {
    state = { phase: "claiming", started_at: now() };
    recordState(clients, order.id, state, "claim");
    recordStep(clients, order.id, state, "claim");
    await atStage("claim", () => clients.api.signAndSubmit({
      kind: "auth_call", op: "claim", order_id: order.id,
    }));
    state = { ...state, phase: "claimed" };
    recordState(clients, order.id, state, "claim");
  } else if (state.phase === "claiming") {
    const chainOrder = await atStage("claim", () => clients.escrow.getOrder(order.id));
    if (chainOrder?.fulfiller !== clients.accountId || chainOrder.status !== "claimed" ||
      !shopperKind(chainOrder.kind)) {
      recordState(clients, order.id, { ...state, phase: "uncertain" }, "claim", "claim_lost");
      return;
    }
    state = { ...state, phase: "claimed" };
    recordState(clients, order.id, state, "claim");
  }
  if (state.phase === "claimed") {
    const spec = await atStage("spec", () => clients.api.request<{
      spec: string; beneficiary: string; buyer_email: string;
    }>("GET", `/jobs/${order.id}/spec`));
    state = { ...state, ...spec, phase: "spec_fetched" };
    recordState(clients, order.id, state, "spec");
  }
  if (state.phase === "spec_fetched") {
    let checked: Record<string, unknown>;
    let deliveryRequest: Record<string, unknown>;
    try {
      deliveryRequest = await verifiedDelivery(order, clients, state);
      const verifiedSpec = JSON.parse(state.spec!) as Record<string, unknown>;
      if (!deliveryMatchesKind(order.kind, String(verifiedSpec.delivery_type), verifiedSpec)) {
        throw new KindMismatchError();
      }
      checked = await atStage("validate", () => clients.cryptorefills.validateOrder(deliveryRequest));
      if (!validateResponseMatches(order.kind, verifiedSpec,
        deliveryRequest.beneficiary_account as string, checked)) {
        throw new KindMismatchError();
      }
      if (usdcUnits(requiredString(checked, "coin_amount")) > BigInt(order.pay_amount)) {
        await release(order, clients, state);
        return;
      }
    } catch (error) {
      if (error instanceof KindMismatchError) {
        await releaseKindMismatch(order, clients, state);
        return;
      }
      if (error instanceof LostClaimError) {
        recordState(clients, order.id, { ...state, phase: "uncertain" }, "validate", "claim_lost");
        return;
      }
      (clients.log ?? console.error)(
        `Shopper rejected order ${safeAlertValue(order.id)} before payment`);
      await release(order, clients, state);
      return;
    }
    state = { ...state, phase: "creating" };
    let created: Record<string, unknown>;
    try {
      recordState(clients, order.id, state, "create");
      recordStep(clients, order.id, state, "create");
      const beforeCreate = await atStage("order", () => clients.escrow.getOrder(order.id));
      if (!await hasCurrentClaim(order, clients, state, beforeCreate)) return;
      const createRefusal = await prePurchaseRefusal(beforeCreate!, clients, now);
      if (createRefusal) {
        await releaseRefused(order, clients, state, "create", createRefusal);
        return;
      }
      created = await atStage("create", () =>
        clients.cryptorefills.createOrder(state!.buyer_email!, deliveryRequest));
    } catch (error) {
      await release(order, clients, state);
      if (error instanceof StageError && error.stage === "journal") throw error;
      return;
    }
    state = {
      ...state,
      phase: "cr_created",
      cr_order_id: requiredString(created, "order_id"),
      cr_order_token: requiredString(created, "order_token"),
      wallet_address: requiredString(created, "wallet_address"),
      coin_amount: requiredString(created, "coin_amount"),
      cr_created_at: now(),
    };
    recordState(clients, order.id, state, "create");
  }
  if (state.phase === "cr_created") {
    const savedSpec = state.spec ? JSON.parse(state.spec) as Record<string, unknown> : {};
    if (!deliveryMatchesKind(order.kind, String(savedSpec.delivery_type), savedSpec)) {
      await releaseKindMismatch(order, clients, state);
      return;
    }
    // A Cryptorefills order is a pre-payment state. Do not fund a state from an
    // older shopper version because its upstream creation time is unknown.
    if (state.cr_created_at === undefined || now() >= state.cr_created_at + timeoutMs) {
      await release(order, clients, state);
      return;
    }
    if (!await hasCurrentClaim(order, clients, state)) return;
    const swap = await atStage("quote", () => clients.oneClick.quote({
      dry: false,
      amount: usdcUnits(state!.coin_amount!).toString(),
      recipient: state!.wallet_address!,
      refundTo: clients.accountId,
    }));
    if (BigInt(swap.amountIn) > BigInt(order.pay_amount)) {
      await release(order, clients, state);
      return;
    }
    const balanceBeforePayment = await atStage("balance", clients.readBalance);
    if (balanceBeforePayment < BigInt(swap.amountIn) + clients.reserveUsdc) {
      writeJournal(clients, {
        order_id: order.id, from_phase: state.phase, to_phase: null, stage: "balance",
        state: { ...state, amount_in: swap.amountIn,
          balance_before_payment: balanceBeforePayment.toString() },
        error_code: "reserve_floor",
      });
      await release(order, clients, state);
      return;
    }
    const beforePay = await atStage("order", () => clients.escrow.getOrder(order.id));
    if (!await hasCurrentClaim(order, clients, state, beforePay)) return;
    const payRefusal = await prePurchaseRefusal(beforePay!, clients, now);
    if (payRefusal) {
      await releaseRefused(order, clients, state, "pay", payRefusal);
      return;
    }
    state = { ...state, phase: "paying", deposit_address: swap.depositAddress,
      amount_in: swap.amountIn, balance_before_payment: balanceBeforePayment.toString() };
    recordState(clients, order.id, state, "pay");
    recordStep(clients, order.id, state, "pay");
    let paid: { tx_hash?: string };
    try {
      paid = await atStage("pay", () => clients.api.signAndSubmit({
        kind: "transfer", receiver_id: swap.depositAddress,
        token_id: ORIGIN_USDC,
        amount: swap.amountIn,
      }));
    } catch (error) {
      if (isTimeoutError(error)) {
        recordState(clients, order.id, { ...state, phase: "uncertain" }, "pay", "Timeout");
      }
      throw error;
    }
    if (!paid.tx_hash) {
      recordState(clients, order.id, { ...state, phase: "uncertain" }, "pay", "payment_unknown");
      return;
    }
    state = { ...state, phase: "paid_submitted", tx_hash: paid.tx_hash, paid_at: now() };
    recordState(clients, order.id, state, "pay");
  }
  if (state.phase === "paid_submitted") {
    const afterPay = await atStage("order", () => clients.escrow.getOrder(order.id));
    const proofTimeExpired = () => {
      if (!afterPay || timeLeftNs(afterPay, now) > BigInt(PROOF_MARGIN_MS) * NS_PER_MS) {
        return false;
      }
      alertUncertain(order, clients, state!, "proof", "deadline_passed");
      return true;
    };
    if (!state.paid_at) {
      state = { ...state, paid_at: now() };
      recordState(clients, order.id, state, "poll");
    }
    const balanceBeforePayment = state.balance_before_payment;
    const amountIn = state.amount_in;
    let balanceAfterPayment = state.balance_after_payment;
    const observeDebit = async () => {
      let currentBalance: bigint;
      try {
        currentBalance = await clients.readBalance();
      } catch {
        return;
      }
      if (balanceAfterPayment === undefined && balanceBeforePayment !== undefined &&
        amountIn !== undefined && BigInt(balanceBeforePayment) >= BigInt(amountIn) &&
        currentBalance <= BigInt(balanceBeforePayment) - BigInt(amountIn)) {
        balanceAfterPayment = currentBalance.toString();
        state = { ...state!, balance_after_payment: balanceAfterPayment };
        recordState(clients, order.id, state, "balance");
        writeJournal(clients, {
          order_id: order.id, from_phase: state.phase, to_phase: null, stage: "balance", state,
        });
      }
    };
    await observeDebit();
    const refundLanded = async () => {
      if (balanceAfterPayment === undefined || amountIn === undefined) return false;
      try {
        return (await clients.readBalance()) >= BigInt(balanceAfterPayment) + BigInt(amountIn);
      } catch {
        return false;
      }
    };
    const swapUntil = state.paid_at! + timeoutMs;
    let currentStatus: string;
    try {
      currentStatus = await clients.oneClick.status(state.deposit_address!);
    } catch (error) {
      if (now() >= swapUntil) {
        alertUncertain(order, clients, state, "poll", cycleErrorCode(error));
      } else {
        throw new StageError("poll", error);
      }
      return;
    }
    if (currentStatus === "REFUNDED" || currentStatus === "FAILED") {
      if (await refundLanded()) await release(order, clients, state);
      else if (now() >= swapUntil) alertUncertain(order, clients, state, "poll", "refund_unconfirmed");
      return;
    }
    const markSwapSuccess = async () => {
      if (state!.swap_succeeded_at === undefined) {
        state = { ...state!, swap_succeeded_at: now() };
        recordState(clients, order.id, state, "poll");
      }
      state = await markSentOnce(state!);
    };
    if (currentStatus === "SUCCESS") await markSwapSuccess();
    if (proofTimeExpired()) return;
    if (!await hasCurrentClaim(order, clients, state, afterPay)) return;
    if (currentStatus !== "SUCCESS") {
      recordStep(clients, order.id, state, "pay");
      // Deposit notification is idempotent. Keep the paid state so the next
      // cycle can notify again without repeating the transfer.
      await atStage("pay", () => clients.oneClick.submit(state!.tx_hash!, state!.deposit_address!));
    }
    let swapped = currentStatus === "SUCCESS";
    while (!swapped && now() < swapUntil) {
      await observeDebit();
      let status: string;
      try {
        status = await clients.oneClick.status(state.deposit_address!);
      } catch (error) {
        if (now() >= swapUntil) {
          alertUncertain(order, clients, state, "poll", cycleErrorCode(error));
        } else {
          throw new StageError("poll", error);
        }
        return;
      }
      if (status === "SUCCESS") {
        swapped = true;
        await markSwapSuccess();
        break;
      }
      if (status === "REFUNDED" || status === "FAILED") {
        if (await refundLanded()) await release(order, clients, state);
        else if (now() >= swapUntil) alertUncertain(order, clients, state, "poll", "refund_unconfirmed");
        return;
      }
      if (proofTimeExpired()) return;
      await sleep(10_000);
    }
    if (proofTimeExpired()) return;
    if (!swapped) {
      alertUncertain(order, clients, state, "poll", "swap_timeout");
      return;
    }
    if (!state.delivery_started_at) {
      state = { ...state, delivery_started_at: now() };
      recordState(clients, order.id, state, "delivery");
    }
    while (now() < state.delivery_started_at! + timeoutMs) {
      if (proofTimeExpired()) return;
      const result = await atStage("delivery", () =>
        clients.cryptorefills.getOrderStatus(state!.cr_order_id!, state!.cr_order_token!));
      const orderState = String(result.order_state ?? "");
      if (orderState === "Done") {
        state = { ...state, phase: "delivered" };
        recordState(clients, order.id, state, "delivery");
        break;
      }
      if (["Failed", "Expired", "Cancelled", "Canceled"].includes(orderState)) {
        state = { ...state, delivery_failed: true };
        recordState(clients, order.id, state, "delivery");
        await release(order, clients, state);
        return;
      }
      await sleep(15_000);
    }
    if (proofTimeExpired()) return;
    if (state.phase !== "delivered") {
      alertUncertain(order, clients, state, "delivery", "delivery_timeout");
      return;
    }
  }
  if (state.phase === "delivered") {
    state = await markSentOnce(state);
    if (!await hasCurrentClaim(order, clients, state)) return;
    await submitProofStep(order, clients, state);
  } else if (state.phase === "proof_uploaded") {
    state = await markSentOnce(state);
    await submitProofStep(order, clients, state);
  }
}

export async function submitProofStep(
  order: EscrowOrder, clients: BotClients, state: OrderState,
): Promise<boolean> {
  const now = clients.clock ?? Date.now;
  if (!state.spec || (!state.proof_sha256 && (!state.cr_order_id || !state.cr_order_token))) {
    throw new StageError("proof", new Error("Missing proof state"));
  }
  if (!state.proof_sha256) {
    const beforeUpload = await atStage("proof", () => clients.escrow.getOrder(order.id));
    if (beforeUpload && timeLeftNs(beforeUpload, now) <= BigInt(PROOF_MARGIN_MS) * NS_PER_MS) {
      alertUncertain(order, clients, state, "proof", "deadline_passed");
      return false;
    }
    if (!await hasCurrentClaim(order, clients, state, beforeUpload)) return false;
    const result = await atStage("proof", () => clients.api.request<{
      sha256: string;
      payload: { payload_to_sign: { message: string; nonce: string; recipient: string } };
    }>("POST", "/proofs", {
      order_id: order.id, cr_order_id: state.cr_order_id, cr_order_token: state.cr_order_token,
    }));
    const uploaded = { ...state, phase: "proof_uploaded" as const, proof_sha256: result.sha256 };
    recordState(clients, order.id, uploaded, "proof");
    recordStep(clients, order.id, uploaded, "proof");
    const beforeSubmit = await atStage("proof", () => clients.escrow.getOrder(order.id));
    if (beforeSubmit && timeLeftNs(beforeSubmit, now) <= BigInt(PROOF_MARGIN_MS) * NS_PER_MS) {
      alertUncertain(order, clients, uploaded, "proof", "deadline_passed");
      return false;
    }
    if (!await hasCurrentClaim(order, clients, uploaded, beforeSubmit)) return false;
    await atStage("proof", () => clients.api.submitBuilt(result.payload, {
      kind: "auth_call", op: "submit_proof", order_id: order.id,
      proof_sha256: result.sha256, spec: uploaded.spec,
    }));
    recordState(clients, order.id, { ...uploaded, phase: "proof_submitted" }, "proof");
    return true;
  }
  // A prior proof submission may have executed before the state file was updated.
  const chainOrder = await atStage("proof", () => clients.escrow.getOrder(order.id));
  if (chainOrder && shopperKind(chainOrder.kind) &&
    ["verifying", "paid", "verified"].includes(chainOrder.status)) {
    recordState(clients, order.id, { ...state, phase: "proof_submitted" }, "proof");
    return true;
  }
  if (!chainOrder || !shopperKind(chainOrder.kind) ||
    chainOrder.fulfiller !== clients.accountId ||
    !["claimed", "sent", "proof_rejected"].includes(chainOrder.status)) {
    recordState(clients, order.id, { ...state, phase: "uncertain" }, "proof", "claim_lost");
    return false;
  }
  if (timeLeftNs(chainOrder, now) <= BigInt(PROOF_MARGIN_MS) * NS_PER_MS) {
    alertUncertain(order, clients, state, "proof", "deadline_passed");
    return false;
  }
  recordStep(clients, order.id, state, "proof");
  const result = await atStage("proof", () => clients.api.signAndSubmit({
    kind: "auth_call", op: "submit_proof", order_id: order.id,
    proof_sha256: state.proof_sha256, spec: state.spec,
  }));
  if (result) recordState(clients, order.id, { ...state, phase: "proof_submitted" }, "proof");
  return Boolean(result);
}

export async function runOnce(clients: BotClients): Promise<void> {
  const now = clients.clock ?? Date.now;
  const result = await atStage("poll", () => clients.api.request<{
    orders: Array<{ id: string }>;
  }>("GET", "/orders?status=funded&limit=100"));
  const pending = clients.store.entries().filter(([, state]) =>
    !["proof_submitted", "released", "failed", "uncertain"].includes(state.phase));
  for (const [id] of pending) {
    await processOrder({ id }, clients);
  }
  for (const listed of result.orders) {
    if (clients.store.get(listed.id)) continue;
    const order = await atStage("order", () => clients.escrow.getOrder(listed.id));
    if (!order || order.status !== "funded" || !shopperKind(order.kind)) continue;
    if (BigInt(order.pay_amount) > clients.maxUsdc ||
      lessThanMs(order, now, clients.minTimeLeftMs)) continue;
    if (order.quoted_by && order.quoted_by !== clients.accountId &&
      now() < Number(BigInt(order.created_at) / 1_000_000n) + 2 * 60_000) continue;
    await processOrder(order, clients);
    break;
  }
}
