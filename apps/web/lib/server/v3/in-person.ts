import { randomBytes } from "node:crypto";
import { canonicalJson, inPersonSpec, plainText, specHash } from "@fulfil/core";
import { get, put } from "../db";
import type { Session } from "./auth";
import { escrowBackend, MockEscrow } from "./escrow";
import { escrowContract, mode } from "./config";
import { buildPayload, intentFromInput } from "./intents";
import { view } from "./rpc";
import { callRelayer } from "./service";

const MAX_VALUE = BigInt(20_000_000);
const HOUR_MS = 60 * 60 * 1_000;
const SAFETY_MARGIN_NS = BigInt(60_000) * BigInt(1_000_000);

function privateText(value: unknown, label: string, maxBytes: number): string {
  return plainText(value, label, maxBytes);
}

export async function prepareInPerson(session: Session, input: Record<string, unknown>) {
  const specObject = inPersonSpec({
    area: input.area as string,
    delivery_hash: input.delivery_hash as string,
    item_desc: input.item_desc as string,
    price: input.price as string,
  });
  const address = privateText(input.meetup_address, "exact place", 240);
  const contact = privateText(input.meetup_contact, "contact", 120);
  const hours = input.deadline_hours === undefined ? 24 : Number(input.deadline_hours);
  if (!Number.isInteger(hours) || hours < 1 || hours > 24) throw new Error("Invalid deadline");
  const price = BigInt(specObject.price);
  const fivePercent = (price * BigInt(5) + BigInt(99)) / BigInt(100);
  const minReward = fivePercent > BigInt(50_000) ? fivePercent : BigInt(50_000);
  let reward = minReward;
  if (input.reward_usdc !== undefined && input.reward_usdc !== null && input.reward_usdc !== "") {
    const text = String(input.reward_usdc);
    if (!/^\d+(?:\.\d{1,6})?$/.test(text)) throw new Error("Reward must be a number like 2.50");
    const [whole, fraction = ""] = text.split(".");
    reward = BigInt(whole) * BigInt(1_000_000) + BigInt(fraction.padEnd(6, "0"));
    if (reward < minReward) throw new Error("Reward is too small for this item price");
    if (reward > BigInt(100_000_000)) throw new Error("The biggest reward is $100.");
  }
  const total = price + reward;
  if (total > MAX_VALUE) throw new Error("Item price plus reward can be at most $20.");
  const id = `FUL-${randomBytes(4).toString("hex").toUpperCase()}`;
  const spec = canonicalJson(specObject);
  const deadlineMs = Date.now() + hours * HOUR_MS;
  const order = {
    id,
    kind: "in_person",
    spec_hash: specHash(spec),
    pay_amount: price.toString(),
    reward: reward.toString(),
    deadline_ns: (BigInt(deadlineMs) * BigInt(1_000_000)).toString(),
  };
  const retentionExpires = new Date(deadlineMs + 24 * HOUR_MS).toISOString();
  const expires_at = new Date(Date.now() + 5 * 60_000).toISOString();
  const quote = {
    item_price: price.toString(),
    merchant_price: price.toString(),
    transfer_fee: "0",
    buffer: "0",
    reward: reward.toString(),
    platform_fee: "0",
    total: total.toString(),
    quoted_by: null,
    expires_at,
    explain: {
      merchant_price: "The local buys the item with their own money and gets this back after delivery.",
      transfer_fee: "No transfer fee for this kind of order.",
      buffer: "No price buffer for this kind of order.",
      reward: "The local receives this for bringing the item to you.",
    },
  };
  put(`v3:spec:${id}`, "v3:spec", {
    order_id: id, kind: "in_person", spec, spec_hash: order.spec_hash,
    beneficiary: "", buyer_email: "", buyer: session.account_id, quoted_by: null,
    quote, expires_at: retentionExpires,
  });
  put(`v3:meetup:${id}`, "v3:meetup", { address, contact, expires_at: retentionExpires });
  put(`v3:spec_summary:${id}`, "v3:spec_summary", {
    order_id: id, created_at: new Date().toISOString(), brand: specObject.item_desc,
    denomination: specObject.price, product_value: "", currency: "USDC",
    masked_beneficiary: specObject.area,
  });
  put(`v3:prepared:${id}`, "v3:prepared", { account_id: session.account_id, order, expires_at });
  return {
    order_id: id,
    order,
    quote,
    payload: await buildPayload(session, [intentFromInput({ kind: "fund", order, spec })]),
  };
}

export async function inPersonMeetup(session: Session, id: string) {
  const order = await currentOrder(id);
  if (!order) throw new Error("Order not found");
  if (order.kind !== "in_person" || order.status !== "claimed" ||
    order.fulfiller !== session.account_id) throw new Error("FORBIDDEN_JOB_SPEC");
  const meetup = get<{ address: string; contact: string; expires_at?: string }>(`v3:meetup:${id}`);
  if (!meetup) throw new Error("Meetup not found");
  return { address: meetup.address, contact: meetup.contact };
}

export async function assertSentAllowed(id: string): Promise<void> {
  const order = await currentOrder(id);
  if (order?.kind === "in_person") throw new Error("Sent is not allowed for in-person orders");
}

export async function confirmInPerson(session: Session, id: string, secretHex: string) {
  const order = await currentOrder(id);
  if (!order) throw new Error("Order not found");
  if (order.kind !== "in_person" || order.status !== "claimed" ||
    order.fulfiller !== session.account_id) throw new Error("FORBIDDEN_JOB_SPEC");
  // The contract counts malformed codes against the claimer's six attempts.
  if (typeof secretHex !== "string" || secretHex.length > 1_000) throw new Error("Invalid delivery code");
  const claimedAt = order.claimed_at_ns ?? order.claimed_at;
  if (!claimedAt || !/^\d+$/.test(claimedAt)) {
    throw new Error("Claim time is unavailable; the code was not sent");
  }
  // Claim window comes from the live kind config (24h, = max deadline), never a local constant.
  const claimTimeout = mode() === "mock"
    ? BigInt(new MockEscrow().config.kinds.in_person.claim_timeout_ns)
    : BigInt((await view<{ kinds: Record<string, { claim_timeout_ns: string }> }>(
      escrowContract(), "get_config")).kinds.in_person.claim_timeout_ns);
  const claimEnd = BigInt(claimedAt) + claimTimeout;
  const orderEnd = BigInt(order.deadline_ns);
  const safeEnd = (claimEnd < orderEnd ? claimEnd : orderEnd) - SAFETY_MARGIN_NS;
  const now = Date.now();
  if (safeEnd <= BigInt(now + 30_000) * BigInt(1_000_000)) {
    throw new Error("Claim window is ending; the code was not sent");
  }
  const deadlineMs = Math.min(
    now + 5 * 60_000,
    Number(safeEnd / BigInt(1_000_000)),
  );
  return buildPayload(session, [intentFromInput({
    kind: "auth_call", op: "confirm_delivery", order_id: id, secret_hex: secretHex,
  })], { deadline: new Date(deadlineMs).toISOString() });
}

export async function expireBuyerOrder(session: Session, id: string, kind: "in_person" | "token_buy") {
  const order = await currentOrder(id);
  if (!order) throw new Error("Order not found");
  if (order.kind !== kind || order.buyer !== session.account_id) {
    throw new Error("FORBIDDEN_IN_PERSON");
  }
  if (order.status !== "funded" && order.status !== "claimed") {
    throw new Error("Order not refundable");
  }
  if (BigInt(order.deadline_ns) > BigInt(Date.now()) * BigInt(1_000_000)) {
    throw new Error("deadline not reached");
  }
  if (mode() === "mock") {
    return { status: "success", order: await new MockEscrow().expire(id) };
  }
  return callRelayer(escrowContract(), "expire", { order_id: id }, "80000000000000", "0");
}

export async function expireInPerson(session: Session, id: string) {
  return expireBuyerOrder(session, id, "in_person");
}

async function currentOrder(id: string) {
  // LiveEscrow.order() can return a retained final/observed order after the
  // chain has deleted it. Private meetup data must use the live chain view.
  if (mode() === "live") {
    return view<{
      kind: string;
      status: string;
      buyer: string;
      fulfiller: string | null;
      deadline_ns: string;
      claimed_at: string | null;
      claimed_at_ns?: string | null;
    } | null>(
      escrowContract(), "get_order", { id },
    );
  }
  return escrowBackend().order(id);
}
