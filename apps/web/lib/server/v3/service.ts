import { createHash, randomBytes } from "node:crypto";
import { sql } from "drizzle-orm";
import { db, get, put } from "../db";
import { courtVotes, getFxQuote, MOCK_VND_PER_USD } from "@fulfil/adapters";
import { bankNameFromBin, buildVietQr, bankTransferSpec, canonicalJson, majority, merchantHash, parseVietQr, specHash } from "@fulfil/core";
import { IntentsKeyMissingError, isMissingKeyRpcError, type Session } from "./auth";
import { buildPayload, intentFromInput, type Intent } from "./intents";
import {
  browserUserAgent,
  escrowContract,
  intentsContract,
  mode,
  oneClickUrl,
  outlayerUrl,
  USDC_TOKEN,
} from "./config";
import { escrowBackend, MockEscrow, type V3Order } from "./escrow";
import { invalidateRpcCache, view } from "./rpc";
import { allowRelayerSubmission } from "./rate-limit";
import {
  maskBeneficiary,
  pruneStoredSpecsIfDue,
  storedSpec,
  storedSpecSummary,
  type SpecSummary,
} from "./shop";
import registry from "../../../../../fulfillers/registry.json";
import { tokenOrderFields } from "./token-buy";
import COIN_ICONS from "./coin-icons.json";

type PreparedOrder = {
  account_id: string;
  order: { id: string; kind: string; spec_hash: string; pay_amount: string; reward: string; deadline_ns: string; quoted_by?: string };
  expires_at?: string;
};

export function assertPreparedFunding(session: Session, intents: Intent[]): void {
  for (const intent of intents) {
    if (intent.intent !== "transfer" || intent.receiver_id !== escrowContract()) continue;
    let message: { op?: string; order?: Record<string, unknown>; spec?: string };
    try {
      message = JSON.parse(String(intent.msg));
    } catch {
      continue;
    }
    if (message.op !== "fund") continue;
    const id = message.order?.id;
    const prepared = typeof id === "string"
      ? get<PreparedOrder>(`v3:prepared:${id}`) : undefined;
    const fields = Object.keys(prepared?.order ?? {});
    if (!prepared || prepared.account_id !== session.account_id ||
      (prepared.expires_at && Date.parse(prepared.expires_at) <= Date.now()) ||
      !message.order || fields.some((field) => message.order?.[field] !==
        (prepared.order as Record<string, unknown>)[field]) ||
      Object.keys(message.order).length !== fields.length ||
      (["in_person", "token_buy"].includes(String(message.order.kind)) &&
        message.spec !== storedSpec(String(id))?.spec)) {
      throw new Error("Funding order does not match prepared order");
    }
  }
}

export function recordDisputeStatement(session: Session, input: Record<string, unknown>): void {
  if (input.kind !== "auth_call" || input.op !== "dispute") return;
  if (typeof input.statement !== "string" || !input.statement.trim() || input.statement.length > 2_000) return;
  const id = String(input.order_id || "");
  put(`v3:statement:${id}:${session.account_id}`, "v3:statement", input.statement.trim());
}

function verifiedMerchant(order: V3Order): Merchant | null {
  if (order.kind !== "bank_transfer") return null;
  const merchant = get<Merchant>(`v3:merchant:${order.id}`);
  const prepared = get<PreparedOrder>(`v3:prepared:${order.id}`);
  if (!merchant) return null;
  let expectedHash: string;
  try {
    expectedHash = specHash(bankTransferSpec(merchant.amount_vnd, merchantHash(merchant.account)));
  } catch {
    return null;
  }
  const legacyPrepared = prepared?.order as PreparedOrder["order"] & {
    amount_vnd?: number;
    merchant_hash?: string;
  } | undefined;
  const legacyMatches = !legacyPrepared?.kind &&
    legacyPrepared?.amount_vnd === order.amount_vnd &&
    legacyPrepared?.merchant_hash === order.merchant_hash;
  if (!merchant || !prepared || prepared.account_id !== order.buyer ||
    merchant.id !== order.id ||
    expectedHash !== order.spec_hash ||
    (!legacyMatches && prepared.order.spec_hash !== order.spec_hash) ||
    prepared.order.pay_amount !== order.pay_amount ||
    prepared.order.reward !== order.reward ||
    prepared.order.deadline_ns !== order.deadline_ns) return null;
  return merchant;
}

export type Merchant = {
  id: string;
  bin: string;
  bank: string;
  account: string;
  name: string;
  amount_vnd: number;
};
type Topup = {
  depositAddress: string;
  account: string;
  amount: string;
  credited: boolean;
};
const hash = (bytes: Buffer | string) =>
  createHash("sha256").update(bytes).digest("hex");

function decimalUnits(value: unknown): bigint {
  const input = String(value ?? "");
  if (!/^\d+(?:\.\d{1,6})?$/.test(input))
    throw new Error("Invalid USDC amount");
  const [whole, fraction = ""] = input.split(".");
  return BigInt(whole) * BigInt(1_000_000) + BigInt(fraction.padEnd(6, "0"));
}

async function v3FxQuote() {
  if (mode() !== "mock") return getFxQuote();
  const configured = process.env.FULFIL_MOCK_VND_PER_USD;
  const vndPerUsd = configured === undefined
    ? MOCK_VND_PER_USD
    : Number(configured);
  if (!Number.isSafeInteger(vndPerUsd) || vndPerUsd <= 0) {
    throw new Error("Invalid mock FX rate");
  }
  return { vndPerUsd, source: "mock" as const, at: new Date().toISOString() };
}

export async function fxEstimate(input: string | null) {
  if (!input || !/^\d+$/.test(input)) {
    throw new Error("Invalid VND amount");
  }
  const amountVnd = Number(input);
  if (!Number.isSafeInteger(amountVnd) || amountVnd < 1_000 || amountVnd > 20_000_000) {
    throw new Error("Invalid VND amount");
  }
  const fx = await v3FxQuote();
  const rate = BigInt(fx.vndPerUsd);
  const numerator = BigInt(amountVnd) * BigInt(1_000_000);
  const payAmount = (numerator + rate - BigInt(1)) / rate;
  return {
    amount_vnd: amountVnd,
    estimated_usd: Math.round((amountVnd / fx.vndPerUsd) * 100) / 100,
    pay_amount: payAmount.toString(),
    vnd_per_usd: fx.vndPerUsd,
    source: fx.source,
    at: fx.at,
  };
}

export async function prepareOrder(
  session: Session,
  input: Record<string, unknown>,
) {
  const qr = parseVietQr(String(input.qr_payload || ""));
  const amountVnd = Number(input.amount_vnd ?? qr.amountVnd);
  if (
    !Number.isSafeInteger(amountVnd) ||
    amountVnd < 1_000 ||
    amountVnd > 20_000_000
  )
    throw new Error("Invalid VND amount");
  const fx = await v3FxQuote();
  const numerator = BigInt(amountVnd) * BigInt(1_000_000);
  const rate = BigInt(fx.vndPerUsd);
  const payAmount = (numerator + rate - BigInt(1)) / rate;
  const reward = decimalUnits(input.reward_usdc);
  if (reward > BigInt(100_000_000)) throw new Error("The biggest reward is $100.");
  const id = `FUL-${randomBytes(4).toString("hex").toUpperCase()}`;
  const bankSpec = bankTransferSpec(amountVnd, merchantHash(qr.accountNumber));
  const order = {
    id,
    kind: "bank_transfer",
    spec_hash: specHash(bankSpec),
    pay_amount: payAmount.toString(),
    reward: reward.toString(),
    deadline_ns: (
      BigInt(Date.now() + 60 * 60_000) * BigInt(1_000_000)
    ).toString(),
  };
  const merchant: Merchant = {
    id,
    bin: qr.bankBin,
    bank: qr.bank,
    account: qr.accountNumber,
    name: qr.name,
    amount_vnd: amountVnd,
  };
  put(`v3:merchant:${id}`, "v3:merchant", merchant);
  put(`v3:spec:${id}`, "v3:spec", {
    order_id: id, kind: "bank_transfer", spec: canonicalJson(bankSpec),
    spec_hash: order.spec_hash, beneficiary: qr.accountNumber, buyer_email: "", buyer: session.account_id,
    quoted_by: null, quote: {}, expires_at: new Date(Date.now() + 48 * 60 * 60_000).toISOString(),
  });
  put(`v3:spec_summary:${id}`, "v3:spec_summary", {
    brand: "VPBank",
    denomination: String(amountVnd),
    product_value: "",
    currency: bankSpec.currency,
    masked_beneficiary: maskBeneficiary(qr.accountNumber),
  } satisfies SpecSummary);
  put(`v3:prepared:${id}`, "v3:prepared", {
    account_id: session.account_id,
    order,
  } satisfies PreparedOrder);
  return {
    order,
    merchant: { ...merchant, account: qr.accountMasked },
    fx,
    payload: await buildPayload(session, [
      intentFromInput({ kind: "fund", order }),
    ]),
  };
}

function orderSummary(order: V3Order, merchant: Merchant | null): SpecSummary {
  const stored = storedSpec(order.id);
  let spec: Record<string, string> | null = null;
  if (stored) {
    try {
      const parsed = JSON.parse(stored.spec);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        spec = parsed as Record<string, string>;
      }
    } catch {
      // A malformed retained record must not make an order list unavailable.
    }
  }
  const retained = storedSpecSummary(order.id);
  const faceValue = stored?.quote?.face_value;
  const quoteCurrency = faceValue && typeof faceValue === "object" &&
    "currency" in faceValue && typeof faceValue.currency === "string"
    ? faceValue.currency : "";
  const denomination = retained?.denomination ?? spec?.denomination ?? spec?.amount ??
    String(merchant?.amount_vnd ?? order.amount_vnd ?? "");
  return {
    brand: retained?.brand ?? spec?.brand_name ??
      (order.kind === "bank_transfer" ? "VPBank" : "Unknown"),
    denomination,
    product_value: retained?.product_value ?? spec?.product_value ?? "",
    currency: retained?.currency ?? (order.kind === "bank_transfer"
      ? spec?.currency ?? "VND"
      : quoteCurrency || denomination.match(/\b[A-Z]{3}$/)?.[0] || ""),
    masked_beneficiary: retained?.masked_beneficiary ?? (stored?.beneficiary
      ? maskBeneficiary(stored.beneficiary)
      : merchant ? maskBeneficiary(merchant.account) : "••••"),
  };
}

function payQrFor(merchant: Merchant, orderId: string): string | null {
  try {
    return buildVietQr({ bin: merchant.bin, account: merchant.account, amountVnd: merchant.amount_vnd, note: orderId });
  } catch {
    return null;
  }
}

export async function orderDetail(id: string, viewer: string) {
  const order = await escrowBackend().order(id);
  if (!order) return null;
  const merchant = verifiedMerchant(order);
  const canSee = viewer === order.buyer || viewer === order.fulfiller;
  const listed = !!order.fulfiller && registry.some((entry) => entry.account_id === order.fulfiller);
  const tokenFields = order.kind === "token_buy" ? await tokenOrderFields(id, order.proof_sha256) : {};
  return {
    order: {
      ...order,
      ...tokenFields,
      code: order.id,
      amount_vnd: merchant?.amount_vnd ?? order.amount_vnd ?? 0,
      merchant_mismatch: order.kind === "bank_transfer" && !merchant,
      spec_summary: orderSummary(order, merchant),
      fulfiller_listed: listed,
    },
    merchant: merchant && {
      ...merchant,
      bank: bankNameFromBin(merchant.bin),
      account: canSee ? merchant.account : `•••• ${merchant.account.slice(-4)}`,
      // Ready-to-scan VietQR with amount and note filled in. Same visibility as the full account number.
      pay_qr: canSee ? payQrFor(merchant, order.id) : null,
    },
  };
}

export function orderListItem(order: V3Order) {
  const merchant = verifiedMerchant(order);
  return {
    ...order,
    code: order.id,
    spec_summary: orderSummary(order, merchant),
    amount_vnd: merchant?.amount_vnd ?? order.amount_vnd ?? 0,
    merchant_name: merchant?.name ?? null,
    /** Bank name only (never the account number) so fulfillers see where they pay. */
    merchant_bank: merchant ? bankNameFromBin(merchant.bin) : null,
    merchant_mismatch: order.kind === "bank_transfer" && !merchant,
    fulfiller_listed: !!order.fulfiller && registry.some((entry) => entry.account_id === order.fulfiller),
  };
}

/** POST /wallet/v1/call: {receiver_id, method_name, args, gas, deposit}.
 * https://skills.outlayer.ai/agent-custody/references/wallet-ops.md
 */
export async function callRelayer(
  receiverId: string,
  methodName: string,
  args: unknown,
  gas = "300000000000000",
  deposit = "0",
  apiKey = process.env.OUTLAYER_API_KEY,
) {
  const key = apiKey;
  if (!key) throw new Error("OUTLAYER_API_KEY is required");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${key}`,
    "User-Agent": browserUserAgent,
  };
  const base = outlayerUrl().replace(/\/$/, "");
  const response = await fetch(`${base}/wallet/v1/call`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      receiver_id: receiverId,
      method_name: methodName,
      args,
      gas,
      deposit,
    }),
  });
  let result = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(`OutLayer call HTTP ${response.status}: ${JSON.stringify(result)}`);
  }
  const requestId = String(result.request_id || "");
  for (let attempt = 0; result.status === "processing" && attempt < 12; attempt++) {
    if (!requestId) {
      throw new Error("OutLayer processing response has no request_id");
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const poll = await fetch(`${base}/wallet/v1/requests/${encodeURIComponent(requestId)}`, {
      headers: { Authorization: `Bearer ${key}`, "User-Agent": browserUserAgent },
    });
    result = (await poll.json()) as Record<string, unknown>;
    if (!poll.ok) {
      throw new Error(`OutLayer request HTTP ${poll.status}: ${JSON.stringify(result)}`);
    }
  }
  if (result.status !== "success") {
    throw new Error(`OutLayer call ${String(result.status)}: ${JSON.stringify(result)}`);
  }
  invalidateRpcCache();
  return result;
}

export async function submitIntents(
  session: Session,
  signed: Record<string, unknown>,
  intents: Intent[],
) {
  assertPreparedFunding(session, intents);
  await assertProofIntent(session, intents);
  const messages = intents.flatMap((intent) => {
    if (typeof intent.msg !== "string") return [];
    try {
      return [JSON.parse(intent.msg) as { op?: string; order_id?: string; order?: { id?: string } }];
    } catch {
      return [];
    }
  });
  const recordDisputes = () => {
    for (const message of messages) {
      if (message.op === "dispute" && message.order_id) {
        put(`v3:disputed_at:${message.order_id}`, "v3:disputed_at", new Date().toISOString());
      }
    }
  };
  if (mode() === "mock") {
    const order = await new MockEscrow().apply(session.account_id, intents);
    recordDisputes();
    return {
      status: "success",
      tx_hash: `mock-${hash(JSON.stringify(signed)).slice(0, 24)}`,
      order,
    };
  }
  let simulation: Record<string, unknown> | null;
  try {
    simulation = await view<Record<string, unknown> | null>(
      intentsContract(), "simulate_intents", { signed: [signed] },
    );
  } catch (e) {
    // intents.near panics when the signer key is not in its registry.
    if (e instanceof Error && isMissingKeyRpcError(e.message)) {
      // Nothing was executed (simulate is a view call): give the nonce back so
      // the client can sign the same payload again after enabling the key.
      const nonce = (signed.payload as { nonce?: string } | undefined)?.nonce;
      if (typeof nonce === "string")
        db.run(sql`
          UPDATE records SET value = json_set(value, '$.used', 0)
          WHERE key = ${`v3:intent:${nonce}`} AND kind = 'v3:intent'
        `);
      throw new IntentsKeyMissingError(String(signed.public_key || ""));
    }
    throw e;
  }
  const executed = simulation?.intents_executed;
  const simulated = !!simulation && (simulation.success === true ||
    simulation.status === "success" ||
    (Array.isArray(executed) ? executed.length > 0 : !!executed));
  if (!simulated || simulation?.error || simulation?.success === false ||
    (Array.isArray(simulation?.intents_errored) && simulation.intents_errored.length > 0) ||
    ["failed", "failure", "error"].includes(String(simulation?.status || "").toLowerCase())) {
    throw new Error("Intent simulation failed");
  }
  if (!allowRelayerSubmission(session.account_id)) throw new Error("RATE_LIMITED");
  for (const message of messages) {
    if (message.op === "cancel" && message.order_id) {
      await escrowBackend().order(message.order_id);
    }
  }
  const result = await callRelayer(intentsContract(), "execute_intents", {
    signed: [signed],
  });
  recordDisputes();
  for (const message of messages) {
    if (message.op === "fund" && message.order?.id) {
      const prepared = get<PreparedOrder>(`v3:prepared:${message.order.id}`);
      if (prepared) {
        put(`v3:submitted:${message.order.id}`, "v3:submitted", {
          ...prepared,
          submitted_at_ns: String(BigInt(Date.now()) * BigInt(1_000_000)),
        });
      }
    }
    if (message.op === "cancel" && message.order_id) {
      put(`v3:cancel_submitted:${message.order_id}`, "v3:cancel_submitted", true);
    }
  }
  const fundedOrChanged = intents.some((intent) =>
    intent.intent === "auth_call" ||
    (intent.intent === "transfer" && intent.receiver_id === escrowContract()),
  );
  if (!fundedOrChanged) return result;
  const ids = messages.map((message) => message.order_id || message.order?.id)
    .filter((id): id is string => !!id);
  return { ...result, order: ids.length ? await escrowBackend().order(ids[ids.length - 1]) : null };
}

/** Inbound forwarding service path; the custody wallet must be the escrow's configured relayer. */
export async function submitRelayerProof(orderId: string, proofSha256: string) {
  const stored = storedSpec(orderId);
  if (!stored) throw new Error("Order spec not found");
  if (mode() === "mock") {
    return new MockEscrow().relayerSubmitProof(orderId, proofSha256, stored.spec);
  }
  return callRelayer(
    escrowContract(),
    "submit_proof",
    { order_id: orderId, proof_sha256: proofSha256, spec: stored.spec },
    "300000000000000",
    "0",
  );
}

function oneClickHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": browserUserAgent,
  };
  if (process.env.ONECLICK_API_KEY)
    headers.Authorization = `Bearer ${process.env.ONECLICK_API_KEY}`;
  return headers;
}

async function oneClick(
  path: string,
  body?: unknown,
): Promise<Record<string, unknown>> {
  const response = await fetch(
    `${oneClickUrl().replace(/\/$/, "")}/v0/${path}`,
    {
      method: body ? "POST" : "GET",
      headers: oneClickHeaders(),
      ...(body ? { body: JSON.stringify(body) } : {}),
    },
  );
  const result = (await response.json()) as Record<string, unknown>;
  if (!response.ok)
    throw new OneClickError(response.status, result);
  return result;
}

export class OneClickError extends Error {
  constructor(
    readonly status: number,
    readonly body: Record<string, unknown>,
  ) {
    super(`1Click HTTP ${status}: ${JSON.stringify(body)}`);
  }
}

/** Turns a refused 1Click quote into words a person can act on. Other errors pass through. */
export function quoteError(error: unknown, coin?: { symbol: string; decimals: number }): Error {
  if (!(error instanceof OneClickError) || error.status !== 400) return error as Error;
  const raw = String(error.body?.message ?? "");
  const name = coin?.symbol ?? "this coin";
  const min = /try at least (\d+)/i.exec(raw)?.[1];
  if (min) {
    const amount = coin ? unitsToDecimal(min, coin.decimals) : undefined;
    return new Error(
      amount
        ? `This amount is too small. Please use at least ${amount} ${name}.`
        : "This amount is too small. Please use a bigger amount.",
    );
  }
  if (/liquidity|not available|no route|pair/i.test(raw))
    return new Error(
      `We can't swap this amount of ${name} right now. Try a bigger amount (about $10 or more), or pick another coin, like USDC, USDT or NEAR on NEAR.`,
    );
  return new Error(`The swap service said: ${raw || "no answer"}. Please try another coin or amount.`);
}

function unitsToDecimal(units: string, decimals: number): string {
  const padded = units.padStart(decimals + 1, "0");
  const whole = padded.slice(0, padded.length - decimals);
  const frac = padded.slice(padded.length - decimals).replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole;
}

/** Symbol and decimals of a 1Click asset, from the cached token list (for error text only). */
async function tokenInfo(assetId: string) {
  try {
    const { tokens } = (await topupTokens()) as { tokens?: { assetId: string; symbol: string; decimals: number }[] };
    return tokens?.find((t) => t.assetId === assetId);
  } catch {
    return undefined;
  }
}

export async function topupQuote(
  session: Session,
  input: Record<string, unknown>,
) {
  const originAsset = String(input.originAsset || "");
  const amount = String(input.amount || "");
  if (
    !/^(nep141|nep245|1cs_v1):[^\s:][^\s]*$/.test(originAsset) ||
    !/^[1-9]\d*$/.test(amount)
  ) {
    throw new Error("Invalid asset or amount");
  }
  if (mode() === "mock") {
    const depositAddress = `mock-deposit-${hash(`${session.account_id}:${originAsset}:${amount}`).slice(0, 24)}`;
    put(`v3:topup:${depositAddress}`, "v3:topup", {
      depositAddress,
      account: session.account_id,
      amount,
      credited: false,
    } satisfies Topup);
    return {
      mock: true,
      quote: {
        depositAddress,
        amountIn: amount,
        amountOut: amount,
        deadline: new Date(Date.now() + 10 * 60_000).toISOString(),
      },
    };
  }
  try {
    return await oneClick("quote", {
      dry: false,
      swapType: "EXACT_INPUT",
      originAsset,
      destinationAsset: USDC_TOKEN,
      amount,
      depositType: "ORIGIN_CHAIN",
      depositMode: "SIMPLE",
      recipientType: "INTENTS",
      recipient: session.account_id,
      refundType: "INTENTS",
      refundTo: session.account_id,
      deadline: new Date(Date.now() + 10 * 60_000).toISOString(),
      slippageTolerance: Number(input.slippageTolerance ?? 100),
    });
  } catch (error) {
    throw quoteError(error, await tokenInfo(originAsset));
  }
}

export async function topupStatus(
  session: Session,
  depositAddress: string,
  depositMemo?: string,
) {
  if (mode() === "mock") {
    const key = `v3:topup:${depositAddress}`;
    const quote = get<Topup>(key);
    if (!quote || quote.account !== session.account_id)
      throw new Error("Top-up quote not found");
    if (!quote.credited) {
      await new MockEscrow().credit(session.account_id, quote.amount);
      put(key, "v3:topup", { ...quote, credited: true });
    }
    return { status: "SUCCESS", depositAddress, mock: true };
  }
  const query = new URLSearchParams({ depositAddress });
  if (depositMemo) query.set("depositMemo", depositMemo);
  return oneClick(`status?${query}`);
}

let tokenCache: { at: number; value: Record<string, unknown> } | undefined;
export async function topupTokens() {
  if (mode() === "mock")
    return {
      tokens: [{ assetId: USDC_TOKEN, symbol: "USDC", decimals: 6 }],
      mock: true,
    };
  // The 1Click token list changes rarely; cache it for an hour so Add money opens fast.
  if (tokenCache && tokenCache.at + 60 * 60_000 > Date.now())
    return tokenCache.value;
  const raw = await oneClick("tokens");
  const tokens = topupTokenList(raw);
  const value = {
    tokens: tokens.map(({ coingeckoId, ...t }) => ({ ...t, icon: coingeckoId ? coinIcon(coingeckoId) : undefined })),
  };
  tokenCache = { at: Date.now(), value };
  return value;
}

/** Logos stored in public/coins by scripts/fetch-coin-icons.ts (1Click has no icons). */
const coinIcon = (coingeckoId: string): string | undefined =>
  Object.hasOwn(COIN_ICONS, coingeckoId) ? (COIN_ICONS as Record<string, string>)[coingeckoId] : undefined;

/** Chains whose deposits need a memo (depositMode MEMO). The deposit screen
 * shows a plain address only, so they are left out (owner, 2026-11-09). */
const MEMO_ONLY_CHAINS = new Set(["stellar"]);

/** Every 1Click token that can be deposited from its own chain with a plain
 * address. Each one is swapped to NEAR USDC, which is the only coin the escrow takes. */
export function topupTokenList(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((t: Record<string, unknown>) => {
    const assetId = String(t?.assetId ?? "");
    const blockchain = String(t?.blockchain ?? "");
    const decimals = Number(t?.decimals);
    if (!/^(nep141|nep245):\S+$/.test(assetId) || !blockchain || MEMO_ONLY_CHAINS.has(blockchain)) return [];
    if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) return [];
    const price = Number(t?.price);
    return [{
      assetId,
      symbol: String(t?.symbol ?? "?"),
      blockchain,
      decimals,
      price: Number.isFinite(price) && price > 0 ? price : undefined,
      coingeckoId: typeof t?.coingeckoId === "string" && t.coingeckoId ? t.coingeckoId : undefined,
    }];
  });
}

export async function withdrawQuote(
  session: Session,
  input: Record<string, unknown>,
) {
  const amount = String(input.amount || "");
  if (!/^[1-9]\d*$/.test(amount)) throw new Error("Invalid amount");
  if (!input.destinationAsset) {
    const receiverId = String(input.receiver_id || "");
    if (!receiverId) throw new Error("receiver_id is required");
    return {
      payload: await buildPayload(session, [
        intentFromInput({
          kind: "ft_withdraw",
          token: USDC_TOKEN.slice(7),
          receiver_id: receiverId,
          amount,
        }),
      ]),
    };
  }
  const destinationAsset = String(input.destinationAsset);
  const recipient = String(input.recipient || "");
  if (!recipient || !destinationAsset) throw new Error("Invalid destination");
  const quote =
    mode() === "mock"
      ? {
          mock: true,
          quote: {
            depositAddress: `mock-withdraw-${hash(`${session.account_id}:${recipient}:${amount}`).slice(0, 24)}`,
            amountIn: amount,
            amountOut: amount,
          },
        }
      : await oneClick("quote", {
          dry: false,
          swapType: "EXACT_INPUT",
          originAsset: USDC_TOKEN,
          destinationAsset,
          amount,
          depositType: "INTENTS",
          recipientType: "DESTINATION_CHAIN",
          recipient,
          refundType: "INTENTS",
          refundTo: session.account_id,
          deadline: new Date(Date.now() + 10 * 60_000).toISOString(),
          slippageTolerance: Number(input.slippageTolerance ?? 100),
        }).catch((error) => {
          throw quoteError(error, { symbol: "USDC", decimals: 6 });
        });
  const depositAddress = String(
    (quote.quote as Record<string, unknown>).depositAddress || "",
  );
  if (!depositAddress) throw new Error("1Click returned no deposit address");
  return {
    quote,
    payload: await buildPayload(session, [
      intentFromInput({
        kind: "transfer",
        receiver_id: depositAddress,
        token_id: USDC_TOKEN,
        amount,
      }),
    ]),
  };
}

export function proofBytes(sha256: string): Buffer | undefined {
  const data = get<{ base64: string }>(`v3:proof:${sha256}`);
  return data ? Buffer.from(data.base64, "base64") : undefined;
}

export function proofContentType(sha256: string): string {
  return get<{ content_type?: string }>(`v3:proof:${sha256}`)?.content_type || "message/rfc822";
}

export async function jobSpec(session: Session, id: string) {
  await pruneStoredSpecsIfDue();
  const stored = storedSpec(id);
  if (!stored) throw new Error("Order spec not found");
  const order = await escrowBackend().order(id);
  if (!order) throw new Error("Order not found");
  if (order.fulfiller !== session.account_id ||
    !["claimed", "sent", "verifying", "proof_rejected"].includes(order.status)) {
    throw new Error("FORBIDDEN_JOB_SPEC");
  }
  return { spec: stored.spec, beneficiary: stored.beneficiary, buyer_email: stored.buyer_email };
}

export async function assertProofIntent(session: Session, intents: Intent[]): Promise<void> {
  for (const intent of intents) {
    if (intent.intent !== "auth_call") continue;
    let message: Record<string, unknown>;
    try { message = JSON.parse(String(intent.msg)); } catch { continue; }
    if (message.op !== "submit_proof") continue;
    const stored = storedSpec(String(message.order_id));
    if (!stored || message.spec !== stored.spec) throw new Error("Proof spec does not match stored order");
    const order = await escrowBackend().order(String(message.order_id));
    if (!order || order.fulfiller !== session.account_id ||
      !["claimed", "sent", "proof_rejected"].includes(order.status)) throw new Error("FORBIDDEN_JOB_SPEC");
  }
}

export async function saveProof(session: Session, id: string, bytes: Buffer, contentType = "message/rfc822") {
  if (bytes.length > 64 * 1024) throw new Error("PROOF_TOO_LARGE");
  if (!bytes.length) throw new Error("Empty proof");
  const order = await escrowBackend().order(id);
  if (
    !order ||
    order.fulfiller !== session.account_id ||
    !["claimed", "sent", "proof_rejected"].includes(order.status)
  )
    throw new Error("Proof not allowed");
  const stored = storedSpec(id);
  if (!stored || stored.spec_hash !== order.spec_hash) throw new Error("Order spec not found");
  if (contentType === "application/json" && !order.kind.startsWith("cryptorefills_") && order.kind !== "token_buy")
    throw new Error("JSON proof only allowed for Cryptorefills or token-buy orders");
  if (contentType !== "application/json" && order.kind !== "bank_transfer")
    throw new Error("Email proof only allowed for bank transfers");
  const sha256 = hash(bytes);
  put(`v3:proof:${sha256}`, "v3:proof", { base64: bytes.toString("base64"), content_type: contentType });
  return {
    sha256,
    size: bytes.length,
    blob_url: `${(process.env.PUBLIC_BASE_URL || "http://localhost:3000").replace(/\/$/, "")}/api/proof-blob/${sha256}`,
    payload: await buildPayload(session, [
      intentFromInput({
        kind: "auth_call",
        op: "submit_proof",
        order_id: id,
        proof_sha256: sha256,
      }),
    ]),
  };
}

export async function resolveDispute(id: string, reason = "") {
  const order = await escrowBackend().order(id);
  if (!order || !["disputed", "under_review"].includes(order.status))
    throw new Error("Disputed order not found");
  const evidence = {
    order_id: id,
    order,
    worker_result: get<Record<string, unknown>>(`v3:verify_result:${id}`) || null,
    proof: order.proof_sha256 ? {
      sha256: order.proof_sha256,
      stored: !!get<{ base64: string }>(`v3:proof:${order.proof_sha256}`),
    } : null,
    timestamps: {
      created_at: order.created_at,
      claimed_at: order.claimed_at,
      sent_at: order.sent_at,
      proof_submitted_at: order.verify_started_at,
      disputed_at: get<string>(`v3:disputed_at:${id}`) || null,
    },
    dispute: {
      reason_code: order.dispute_reason,
      disputed_by: order.disputed_by,
      buyer_statement: get<string>(`v3:statement:${id}:${order.buyer}`) || null,
      fulfiller_statement: order.fulfiller
        ? get<string>(`v3:statement:${id}:${order.fulfiller}`) || null : null,
      admin_context: reason,
    },
  };
  const panel = order.proof_sha256
    ? await courtVotes(
        evidence,
        3,
      )
    : null;
  const verdict = panel ? majority(panel.votes).outcome : "buyer";
  if (!verdict) throw new Error("Court produced no verdict");
  const reasoning = JSON.stringify({ evidence, votes: panel?.votes || [], verdict });
  const note_hash = hash(reasoning);
  const call = {
    receiver_id: escrowContract(),
    method_name: "resolve_dispute",
    args: { order_id: id, verdict, note_hash },
    gas: "100000000000000",
    deposit: "0",
  };
  if (process.env.ARBITER_ENABLED !== "1" || !process.env.ARBITER_OUTLAYER_API_KEY)
    return { dry_run: true, verdict, proposed_verdict: { verdict, note_hash }, note_hash, call };
  if (mode() === "mock") {
    const result = await new MockEscrow().resolve(id, verdict, note_hash);
    return { dry_run: false, verdict, proposed_verdict: { verdict, note_hash }, note_hash, call, result };
  }
  const result = await callRelayer(
    escrowContract(),
    "resolve_dispute",
    call.args,
    call.gas,
    call.deposit,
    process.env.ARBITER_OUTLAYER_API_KEY,
  );
  return { dry_run: false, verdict, proposed_verdict: { verdict, note_hash }, note_hash, call, result };
}
