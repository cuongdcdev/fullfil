import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { FulfilApiClient, IntentSigner } from "./api";
import { CryptorefillsClient } from "./cryptorefills";
import { OneClickClient } from "./oneclick";
import { ShopperEscrowRpc, type EscrowOrder, type ShopperKindConfig } from "./rpc";
import { StateStore, type OrderState } from "./state";
import { PROOF_MARGIN_MS, submitProofStep, type BotClients } from "./loop";
import { FileJournal } from "./journal";
import { WebhookAlerter } from "./alerts";
import { describeCycleError, StageError } from "./diagnostics";
import { ShopperLockHeldError, StateLock } from "./lock";

const refundStatuses = new Set(["INCOMPLETE_DEPOSIT", "REFUNDED", "FAILED"]);
const oneClickStatuses = new Set([
  "PENDING_DEPOSIT", "PROCESSING", "SUCCESS", "INCOMPLETE_DEPOSIT",
  "REFUNDED", "FAILED", "KNOWN_DEPOSIT_TX",
]);
const deliveryStatuses = new Set(["Done", "Failed", "Expired", "Cancelled", "Canceled"]);
const safeId = /^[A-Za-z0-9_.:-]{1,160}$/;

export type RecoveryAction = "submit proof now" | "wait for 1Click refund" |
  "release claim" | "manual review" | `lost: amount ${string} USDC`;

export type RecoveryInputs = {
  state: OrderState;
  escrow: EscrowOrder | null;
  deliveryStatus: string | null;
  oneClickStatus: string | null;
  balance: bigint | null;
  accountId: string;
  nowMs: number;
  kind?: ShopperKindConfig;
};

function decimalUsdc(units: string): string | null {
  if (!/^\d{1,40}$/.test(units)) return null;
  const whole = BigInt(units) / 1_000_000n;
  const fraction = (BigInt(units) % 1_000_000n).toString().padStart(6, "0");
  return `${whole}.${fraction}`;
}

export function canSubmitProof(input: RecoveryInputs): boolean {
  const { escrow, kind } = input;
  if (!escrow || !kind || escrow.fulfiller !== input.accountId ||
    !["claimed", "sent", "proof_rejected"].includes(escrow.status) ||
    !/^\d+$/.test(escrow.deadline_ns) ||
    !/^\d+$/.test(kind.proof_timeout_ns)) return false;
  const nowNs = BigInt(input.nowMs) * 1_000_000n;
  if (nowNs + BigInt(PROOF_MARGIN_MS) * 1_000_000n >= BigInt(escrow.deadline_ns)) return false;
  if (escrow.sent_at !== null) {
    if (!/^\d+$/.test(escrow.sent_at) ||
      nowNs >= BigInt(escrow.sent_at) + BigInt(kind.proof_timeout_ns)) return false;
  }
  return true;
}

export function recommendAction(input: RecoveryInputs): RecoveryAction {
  const { state, deliveryStatus, oneClickStatus, balance } = input;
  if (deliveryStatus === "Done" && canSubmitProof(input) &&
    state.spec && state.cr_order_id && state.cr_order_token) return "submit proof now";
  const before = state.balance_before_payment;
  const balanceDropped = before !== undefined && /^\d+$/.test(before) &&
    balance !== null && balance < BigInt(before);
  const paymentPossible = Boolean(state.tx_hash || state.balance_after_payment || balanceDropped);
  if (paymentPossible && oneClickStatus && refundStatuses.has(oneClickStatus)) {
    return "wait for 1Click refund";
  }
  const claimOwned = input.escrow?.fulfiller === input.accountId &&
    ["claimed", "sent", "proof_rejected"].includes(input.escrow.status);
  if (!paymentPossible && claimOwned && !state.deposit_address) return "release claim";
  if (paymentPossible && oneClickStatus === "SUCCESS" &&
    deliveryStatus && ["Failed", "Expired", "Cancelled", "Canceled"].includes(deliveryStatus)) {
    const amount = state.amount_in && decimalUsdc(state.amount_in);
    if (amount) return `lost: amount ${amount} USDC`;
  }
  return "manual review";
}

export function formatRecoveryLine(
  orderId: string, input: RecoveryInputs, action: RecoveryAction,
): string {
  const id = safeId.test(orderId) ? orderId : "unknown";
  const escrow = input.escrow && safeId.test(input.escrow.status) ? input.escrow.status : "unknown";
  const delivery = input.deliveryStatus && deliveryStatuses.has(input.deliveryStatus)
    ? input.deliveryStatus : "unknown";
  const swap = input.oneClickStatus && oneClickStatuses.has(input.oneClickStatus)
    ? input.oneClickStatus : "unknown";
  const balanceAmount = input.balance === null ? null : decimalUsdc(input.balance.toString());
  const balance = balanceAmount === null ? "unknown" : `${balanceAmount} USDC`;
  return `order=${id} escrow=${escrow} cryptorefills=${delivery} ` +
    `oneclick=${swap} balance=${balance} action=${action}`;
}

export type RecoveryDeps = {
  store: Pick<StateStore, "get" | "entries">;
  escrow: Pick<ShopperEscrowRpc, "getOrder" | "getKinds">;
  cryptorefills: Pick<CryptorefillsClient, "getOrderStatus">;
  oneClick: Pick<OneClickClient, "status">;
  readBalance: () => Promise<bigint>;
  accountId: string;
  clock?: () => number;
  submitProof?: (order: EscrowOrder, state: OrderState) => Promise<boolean>;
};

export async function recoverOrders(
  deps: RecoveryDeps, orderId?: string, submitProof = false,
): Promise<string[]> {
  if (orderId && !safeId.test(orderId)) throw new Error("Invalid order ID");
  const candidates = deps.store.entries().filter(([id, state]) =>
    (!orderId || id === orderId) && ["uncertain", "failed"].includes(state.phase));
  if (candidates.length === 0) return ["No uncertain or failed orders found"];
  const kinds = await deps.escrow.getKinds().catch(() => ({} as Record<string, ShopperKindConfig>));
  const balance = await deps.readBalance().catch(() => null);
  const lines: string[] = [];
  for (const [id, state] of candidates) {
    const escrow = await deps.escrow.getOrder(id).catch(() => null);
    const delivery = state.cr_order_id && state.cr_order_token
      ? await deps.cryptorefills.getOrderStatus(state.cr_order_id, state.cr_order_token)
        .then((result) => typeof result.order_state === "string" ? result.order_state : null)
        .catch(() => null)
      : null;
    const swap = state.deposit_address && safeId.test(state.deposit_address)
      ? await deps.oneClick.status(state.deposit_address).catch(() => null)
      : null;
    const input: RecoveryInputs = {
      state, escrow, deliveryStatus: delivery, oneClickStatus: swap, balance,
      accountId: deps.accountId, nowMs: (deps.clock ?? Date.now)(),
      kind: escrow ? kinds[escrow.kind] : undefined,
    };
    const action = recommendAction(input);
    lines.push(formatRecoveryLine(id, input, action));
    if (!submitProof) continue;
    if (action !== "submit proof now" || !deps.submitProof || !escrow) {
      lines.push(`order=${safeId.test(id) ? id : "unknown"} refused: proof not claimable or deadline passed`);
      continue;
    }
    const submitted = await deps.submitProof(escrow, state);
    lines.push(`order=${safeId.test(id) ? id : "unknown"} ` +
      (submitted ? "proof submitted" : "proof not submitted; check shopper state"));
  }
  return lines;
}

export function readSnapshot(path: string): Pick<StateStore, "get" | "entries"> {
  const value = JSON.parse(readFileSync(path, "utf8")) as unknown;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid shopper state file");
  }
  const states = value as Record<string, OrderState>;
  return {
    get: (id) => states[id],
    entries: () => Object.entries(states),
  };
}

export function openRecoveryState(path: string, submitProof: boolean): {
  store: Pick<StateStore, "get" | "entries">;
  lock?: StateLock;
} {
  if (!submitProof) return { store: readSnapshot(path) };
  const lock = StateLock.acquire(path);
  try {
    return { store: new StateStore(path, lock), lock };
  } catch (error) {
    lock.release();
    throw error;
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const submitProof = args.includes("--submit-proof");
  const ids = args.filter((arg) => arg !== "--submit-proof");
  if (ids.length > 1 || args.some((arg) => arg.startsWith("--") && arg !== "--submit-proof")) {
    throw new Error("Usage: recover [order_id] [--submit-proof]");
  }
  const accountId = process.env.SHOPPER_ACCOUNT_ID;
  const privateKey = process.env.SHOPPER_INTENTS_PRIVATE_KEY;
  const baseUrl = process.env.FULFIL_API_URL;
  if (!accountId || !privateKey || !baseUrl) throw new Error("Missing shopper configuration");
  const api = new FulfilApiClient(baseUrl, accountId, new IntentSigner(privateKey));
  const statePath = process.env.SHOPPER_STATE_FILE || "./data/shopper-state.json";
  const { store, lock } = openRecoveryState(statePath, submitProof);
  try {
    await api.login();
    const escrow = new ShopperEscrowRpc();
    const cryptorefills = new CryptorefillsClient();
    const oneClick = new OneClickClient();
    const journal = submitProof ? new FileJournal(statePath) : undefined;
    const alerter = new WebhookAlerter(process.env.SHOPPER_ALERT_WEBHOOK);
    const clients = submitProof ? {
      api, escrow, cryptorefills, oneClick, store: store as StateStore,
      journal: journal!, alerter, accountId, maxUsdc: 0n, reserveUsdc: 0n,
      minTimeLeftMs: 900_000,
      readBalance: () => api.readIntentsBalance(),
    } satisfies BotClients : undefined;
    const lines = await recoverOrders({
      store, escrow, cryptorefills, oneClick, accountId,
      readBalance: () => api.readIntentsBalance(),
      submitProof: clients ? (order, state) => submitProofStep(order, clients, state) : undefined,
    }, ids[0], submitProof);
    for (const line of lines) console.log(line);
  } finally {
    lock?.release();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error instanceof ShopperLockHeldError ? error.message :
      describeCycleError(new StageError("startup", error)));
    process.exitCode = 1;
  });
}
