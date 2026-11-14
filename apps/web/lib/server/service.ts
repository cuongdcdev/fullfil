import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  adapterStatus,
  checkTicketImage,
  courtVotes,
  detectInjection,
  generateSpec,
  sageDecision,
  configured,
  signedSampleEmail,
  verifyDkimEmail,
} from "@fulfil/adapters";
import { verifyBundle } from "@fulfil/attest";
import {
  assertQuoteAffordable,
  cents,
  disputeStake,
  evaluateRubric,
  injectionDetected,
  lint,
  majority,
  parseQr,
  releaseGateOpen,
  requiredBond,
  sampleQr,
  sha256,
  tier,
  transition,
  type AttestationBundle,
  type Dispute,
  type EvidenceFact,
  type Fulfiller,
  type OrderDetail,
  type Quote,
  type Rubric,
  type Spec,
} from "@fulfil/core";
import {
  accountCents,
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

const fixtureRoot = resolve(
  process.cwd(),
  process.cwd().endsWith("/apps/web") ? "../../fixtures" : "fixtures",
);
const demoScale = Number(process.env.DEMO_TIME_SCALE || 10);
export const mockMode = () =>
  !configured("NEAR_FULFIL_CONTRACT") ||
  !configured("NEAR_SERVICE_ACCOUNT_ID") ||
  !configured("NEAR_SERVICE_PRIVATE_KEY");
export function requireMockChain(): void {
  if (!mockMode())
    throw new Error(
      "Real chain writes are unavailable until deployment and verified contract binding",
    );
}
export const id = (prefix: string) => `${prefix}-${randomUUID().slice(0, 8)}`;
function requireOrder(orderId: string): OrderDetail {
  const order = orderById(orderId);
  if (!order) throw new Error("Order not found");
  return order;
}
export function effectiveNow(order: OrderDetail): Date {
  return new Date(
    Date.now() +
      (get<{ offsetMs: number }>(key("clock", order.id))?.offsetMs || 0),
  );
}
export function updated(order: OrderDetail): OrderDetail {
  saveOrder(order);
  return order;
}
export function lockBuyerStake(order: OrderDetail, amountUsd: number): void {
  transferCents(order.buyer, `stake:${order.id}`, cents(amountUsd));
  transaction(order, "stake_lock", amountUsd);
}
export function settleBondSlash(
  order: OrderDetail,
  fulfiller: Fulfiller,
  amountCents: number,
  reason: string,
): void {
  const slash = Math.min(amountCents, cents(fulfiller.bondUsd));
  const pool = Math.floor(slash / 2);
  const treasury = slash - pool;
  transferCents(`bond:${fulfiller.accountId}`, "court.pool", pool);
  transferCents(`bond:${fulfiller.accountId}`, "treasury", treasury);
  fulfiller.bondUsd = (cents(fulfiller.bondUsd) - slash) / 100;
  saveFulfiller(fulfiller);
  transaction(order, reason, slash / 100);
  transaction(order, "slash_juror_pool", pool / 100);
  transaction(order, "slash_treasury", treasury / 100);
}
export function unlockFulfiller(order: OrderDetail, completed: boolean): void {
  const quote = order.quotes.find(
    (candidate) => candidate.id === order.quoteId,
  );
  if (!quote) return;
  const fulfiller = fulfillerById(quote.fulfiller);
  if (!fulfiller) throw new Error("Selected fulfiller not found");
  if (cents(fulfiller.lockedUsd) < cents(quote.bondLockUsd))
    throw new Error("Bond lock ledger mismatch");
  fulfiller.lockedUsd =
    (cents(fulfiller.lockedUsd) - cents(quote.bondLockUsd)) / 100;
  if (completed) {
    fulfiller.counters.completed++;
    fulfiller.counters.clean++;
    fulfiller.counters.volumeUsd += order.escrowUsd || 0;
  }
  fulfiller.tier = tier(fulfiller.counters);
  saveFulfiller(fulfiller);
}
async function attachBundle(order: OrderDetail, input: unknown): Promise<void> {
  if (!input) return;
  const bundle = input as AttestationBundle;
  const result = await verifyBundle(bundle);
  order.bundles.push(bundle);
  put(key("bundle", bundle.id), "bundle", bundle);
  order.checks = [...(order.checks || []), ...result.checks];
  if (!order.mock && !result.verified)
    throw new Error("Real funds require verified model proof");
}
export async function preview(input: {
  request: string;
  maxCostUsd?: number;
  names?: string[];
  date?: string;
}) {
  const result = await generateSpec(input.request, input);
  return {
    spec: result.spec,
    rubric: result.rubric,
    lint: lint(result.spec, result.rubric),
  };
}
export async function createOrder(input: {
  request?: string;
  spec?: Spec;
  rubric?: Rubric;
  kind?: "errand" | "qr_payment";
  qrPayload?: string;
  maxCostUsd?: number;
  names?: string[];
  date?: string;
}): Promise<OrderDetail> {
  requireMockChain();
  let spec = input.spec,
    rubric = input.rubric;
  let generatedBundle: unknown;
  if (input.kind === "qr_payment" || input.qrPayload) {
    spec = parseQr(
      input.qrPayload || (spec && "rawQr" in spec ? spec.rawQr : ""),
    );
    rubric = {
      version: 1,
      deterministicChecks: [
        { id: "qr_crc", field: "qr_crc", op: "eq", value: true },
        { id: "buyer_confirm", field: "buyer_confirm", op: "eq", value: true },
      ],
      aiChecks: [],
      windows: {
        purchaseDeadline: new Date(Date.now() + 86400000).toISOString(),
        autoAcceptHours: 24,
        releaseGate: "after_challenge",
      },
      disputeStakePct: 10,
    };
  } else if (!spec || !rubric) {
    const generated = await generateSpec(
      input.request || "Get ferry tickets",
      input,
    );
    spec = generated.spec;
    rubric = generated.rubric;
    generatedBundle = generated.bundle;
  }
  const checked = lint(spec, rubric);
  if (!checked.valid) throw new Error(checked.errors.join("; "));
  const createdAt = nowIso(),
    orderId = id("ord");
  let order: OrderDetail = {
    id: orderId,
    kind: "rawQr" in spec ? "qr_payment" : "errand",
    buyer: "agent-alpha.testnet",
    spec,
    rubric,
    specHash: sha256(spec),
    rubricHash: sha256(rubric),
    state: "Draft",
    createdAt,
    history: [],
    quotes: [],
    bundles: [],
    transactions: [],
    mock: mockMode(),
  };
  order = transition(
    order,
    "lock",
    new Date(createdAt),
    "Spec and rubric locked",
  );
  transaction(order, "anchor_spec");
  transaction(order, "anchor_rubric");
  await attachBundle(order, generatedBundle);
  if (mockMode()) {
    const candidates = fulfillers().filter((f) => f.kinds.includes(order.kind));
    for (const [i, f] of candidates.entries()) {
      const costUsd = order.kind === "qr_payment" ? 8 + i : 25 + i * 3;
      const feeUsd = 3 + i;
      const totalUsd = costUsd + feeUsd;
      const quote: Quote = {
        id: id("quote"),
        orderId,
        fulfiller: f.accountId,
        displayName: f.displayName,
        tier: f.tier,
        costUsd,
        feeUsd,
        totalUsd,
        etaMinutes: 20 + i * 10,
        validUntil: new Date(Date.now() + 3600000).toISOString(),
        bondLockUsd: requiredBond(totalUsd, f.tier),
        signature: `mock-signature-${sha256(orderId + f.accountId).slice(0, 16)}`,
      };
      order.quotes.push(quote);
    }
  }
  return updated(order);
}
export function addQuote(
  orderId: string,
  input: {
    fulfiller: string;
    costUsd: number;
    feeUsd: number;
    etaMinutes: number;
  },
): Quote {
  requireMockChain();
  return atomic(() => {
    const order = requireOrder(orderId),
      f = fulfillerById(input.fulfiller);
    if (order.state !== "Quoting" || !f)
      throw new Error("Order not open or fulfiller unknown");
    const totalUsd = (cents(input.costUsd) + cents(input.feeUsd)) / 100;
    if ("maxCostUsd" in order.spec && totalUsd > order.spec.maxCostUsd)
      throw new Error("Quote exceeds buyer maximum");
    if (!Number.isInteger(input.etaMinutes) || input.etaMinutes < 1)
      throw new Error("Invalid ETA");
    const quote: Quote = {
      id: id("quote"),
      orderId,
      fulfiller: f.accountId,
      displayName: f.displayName,
      tier: f.tier,
      costUsd: input.costUsd,
      feeUsd: input.feeUsd,
      totalUsd,
      etaMinutes: input.etaMinutes,
      validUntil: new Date(Date.now() + 3600000).toISOString(),
      bondLockUsd: requiredBond(totalUsd, f.tier),
      signature: `mock-signature-${sha256(orderId + f.accountId).slice(0, 16)}`,
    };
    order.quotes.push(quote);
    saveOrder(order);
    return quote;
  });
}
export function changeBond(
  id: string,
  input: { action: "topup" | "withdraw"; amountUsd: number },
): Fulfiller {
  requireMockChain();
  return atomic(() => {
    const f = fulfillerById(id);
    if (!f) throw new Error("Fulfiller not found");
    const amount = cents(input.amountUsd);
    if (!amount) throw new Error("Amount required");
    if (input.action === "withdraw") {
      if (f.cooldownUntil && new Date(f.cooldownUntil) > new Date())
        throw new Error("Bond withdrawal cooldown");
      if (cents(f.bondUsd - f.lockedUsd) < amount)
        throw new Error("Bond locked");
      transferCents(`bond:${f.accountId}`, f.accountId, amount);
      f.bondUsd = (cents(f.bondUsd) - amount) / 100;
      f.cooldownUntil = new Date(Date.now() + 86400000).toISOString();
    } else {
      transferCents(f.accountId, `bond:${f.accountId}`, amount);
      f.bondUsd = (cents(f.bondUsd) + amount) / 100;
    }
    saveFulfiller(f);
    return f;
  });
}
function settleFunds(order: OrderDetail): void {
  const dispute = order.dispute;
  if (!dispute?.outcome || order.state !== "Resolved")
    throw new Error("No resolved outcome");
  if (
    dispute.outcome === "split" &&
    (!Number.isInteger(dispute.splitPct) ||
      dispute.splitPct! < 0 ||
      dispute.splitPct! > 100)
  )
    throw new Error("Invalid split percentage");
  const quote = order.quotes.find((q) => q.id === order.quoteId)!;
  const f = fulfillerById(quote.fulfiller)!;
  let payoutCents =
    dispute.outcome === "fulfiller"
      ? cents(order.escrowUsd!)
      : dispute.outcome === "buyer"
        ? 0
        : Math.floor((cents(order.escrowUsd!) * (dispute.splitPct || 0)) / 100);
  const refundCents = cents(order.escrowUsd!) - payoutCents;
  if (payoutCents) {
    order = transition(order, "settle_release", effectiveNow(order));
    transferCents(`escrow:${order.id}`, f.accountId, payoutCents);
    transaction(order, "release", payoutCents / 100);
    f.counters.completed++;
    f.counters.volumeUsd += payoutCents / 100;
    if (dispute.outcome === "fulfiller") {
      f.counters.clean++;
      f.counters.disputesWon++;
      if (dispute.appealCount) f.counters.appealsWon++;
    }
  } else order = transition(order, "settle_refund", effectiveNow(order));
  if (refundCents) {
    transferCents(`escrow:${order.id}`, order.buyer, refundCents);
    transaction(order, "refund", refundCents / 100);
    if (dispute.outcome === "buyer") f.counters.disputesLost++;
  }
  if (dispute.outcome === "buyer") {
    // Escrow fully covers the refund, so the bond penalty has no buyer shortfall to repay.
    settleBondSlash(order, f, cents(quote.bondLockUsd), "slash_bond");
  }
  if (dispute.outcome === "fulfiller") {
    transferCents(
      `stake:${order.id}`,
      "court.pool",
      cents(dispute.buyerStakeUsd),
    );
    transaction(order, "stake_slash", dispute.buyerStakeUsd);
  } else {
    transferCents(
      `stake:${order.id}`,
      order.buyer,
      cents(dispute.buyerStakeUsd),
    );
    transaction(order, "stake_return", dispute.buyerStakeUsd);
  }
  f.lockedUsd = Math.max(0, f.lockedUsd - quote.bondLockUsd);
  f.tier = tier(f.counters);
  saveFulfiller(f);
  dispute.executionRule =
    dispute.outcome === "split"
      ? `Court split ${dispute.splitPct}% to fulfiller`
      : `Court ${dispute.outcome} outcome`;
  saveOrder(order);
}
const lockHost = globalThis as typeof globalThis & {
  __fulfilActionLocks?: Map<string, Promise<void>>;
};
const activeActions = (lockHost.__fulfilActionLocks ??= new Map<
  string,
  Promise<void>
>());
export async function act(
  orderId: string,
  input: Parameters<typeof actUnlocked>[1],
): Promise<OrderDetail> {
  const previous = activeActions.get(orderId) || Promise.resolve();
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const current = previous.then(() => pending);
  activeActions.set(orderId, current);
  await previous;
  try {
    return await actUnlocked(orderId, input);
  } finally {
    release();
    if (activeActions.get(orderId) === current) activeActions.delete(orderId);
  }
}
async function actUnlocked(
  orderId: string,
  input: {
    action: string;
    quoteId?: string;
    reason?: string;
    sample?: "valid" | "mismatch";
    emlBase64?: string;
    pdfBase64?: string;
    slipBase64?: string;
    hours?: number;
  },
): Promise<OrderDetail> {
  requireMockChain();
  let order = requireOrder(orderId);
  const now = effectiveNow(order);
  switch (input.action) {
    case "accept_quote":
      return atomic(() => {
        order = requireOrder(orderId);
        const quote = order.quotes.find((q) => q.id === input.quoteId);
        if (!quote) throw new Error("Quote not found");
        const f = fulfillerById(quote.fulfiller)!;
        const exposure = orders()
          .filter(
            (o) =>
              o.id !== orderId &&
              o.quoteId &&
              !["Released", "Refunded", "Cancelled"].includes(o.state) &&
              o.quotes.find((q) => q.id === o.quoteId)?.fulfiller ===
                f.accountId,
          )
          .reduce(
            (sum, o) =>
              sum +
              (o.escrowUsd ||
                o.quotes.find((q) => q.id === o.quoteId)?.totalUsd ||
                0),
            0,
          );
        assertQuoteAffordable(quote, f, exposure, now);
        order = transition(order, "accept_quote", now);
        order.quoteId = quote.id;
        order.fulfiller = f;
        f.lockedUsd += quote.bondLockUsd;
        saveFulfiller(f);
        return updated(order);
      });
    case "fund":
      return atomic(() => {
        order = requireOrder(orderId);
        if (order.state !== "Accepted") throw new Error("Order not accepted");
        const q = order.quotes.find((q) => q.id === order.quoteId)!;
        transferCents(order.buyer, `escrow:${order.id}`, cents(q.totalUsd));
        order = transition(order, "fund", now);
        order.escrowUsd = q.totalUsd;
        transaction(order, "escrow", q.totalUsd);
        return updated(order);
      });
    case "submit_evidence": {
      if (order.state !== "Funded") throw new Error("Order not funded");
      order = transition(order, "submit_evidence", now);
      if (order.kind === "qr_payment") {
        if (!input.slipBase64 && !input.sample)
          throw new Error("Payment slip required");
        order.checks = [
          {
            id: "bank_proof",
            pass: false,
            detail: "Slip received; bank payment is not independently verified",
          },
        ];
        order = transition(
          order,
          "verify_ok",
          now,
          "Buyer confirmation required for unverified QR slip",
        );
      } else {
        if (!input.sample && (!input.emlBase64 || !input.pdfBase64))
          throw new Error("Email and PDF required");
        if (input.sample && !mockMode())
          throw new Error("Sample evidence is mock-only");
        const spec = order.spec as Extract<Spec, { category: "e_ticket" }>;
        const eml = input.sample
          ? signedSampleEmail(spec, orderId)
          : Buffer.from(input.emlBase64!, "base64");
        const verified = verifyDkimEmail(eml, spec.allowedSenderDomains);
        const field = (name: string) =>
          verified.body
            .match(new RegExp(`^${name}: (.*)$`, "m"))?.[1]
            ?.trim() || "";
        const orderRef = field("Order ID");
        const pdf = input.sample
          ? readFileSync(
              resolve(
                fixtureRoot,
                input.sample === "mismatch" ? "mismatch.pdf" : "ticket.pdf",
              ),
            )
          : Buffer.from(input.pdfBase64!, "base64");
        const pdfText = pdf.toString("latin1");
        const localPdfMatches =
          pdfText.includes(spec.date) &&
          spec.names.every((name) => pdfText.includes(name));
        const vision = await checkTicketImage(pdf, spec);
        await attachBundle(order, vision.bundle);
        const pdfMatches =
          (configured("NEAR_AI_API_KEY") ? true : localPdfMatches) &&
          vision.matches;
        const fact: EvidenceFact = {
          orderId,
          dkimValid: verified.valid,
          dkimDomain: verified.domain,
          orderRef,
          nullifier: sha256(`${verified.domain}:${orderRef}`),
          extracted: {
            date: field("Date"),
            qty: Number(field("Quantity")),
            names: field("Names").split(/,\s*/).filter(Boolean),
            item: field("Item"),
          },
          checks: [],
          attestation: {
            provider: "mock",
            inputHash: sha256(eml.toString("base64") + pdf.toString("base64")),
            outputHash: "",
          },
        };
        const used = new Set(
          orders()
            .filter((o) => o.id !== orderId)
            .map((o) => o.evidence?.nullifier)
            .filter((x): x is string => !!x),
        );
        fact.checks = evaluateRubric(order.rubric, fact, spec, used);
        fact.checks.push({
          id: "pdf_match",
          pass: pdfMatches,
          detail: pdfMatches
            ? "Ticket PDF text matches spec"
            : "Ticket PDF text mismatch",
        });
        fact.attestation.outputHash = sha256(fact.extracted);
        order.evidence = fact;
        order.checks = [...(order.checks || []), ...fact.checks];
        order = transition(
          order,
          fact.checks.every((c) => c.pass) ? "verify_ok" : "verify_fail",
          now,
        );
        if (order.state === "Rejected") {
          order = transition(order, "refund", now);
          transferCents(
            `escrow:${order.id}`,
            order.buyer,
            cents(order.escrowUsd!),
          );
          transaction(order, "refund", order.escrowUsd);
          const q = order.quotes.find((q) => q.id === order.quoteId)!;
          const f = fulfillerById(q.fulfiller)!;
          f.lockedUsd -= q.bondLockUsd;
          settleBondSlash(order, f, cents(q.bondLockUsd), "slash_bond");
          f.counters.disputesLost++;
          f.tier = tier(f.counters);
          saveFulfiller(f);
        }
      }
      return updated(order);
    }
    case "confirm": {
      if (
        !releaseGateOpen(order, now, demoScale) &&
        order.kind !== "qr_payment"
      )
        throw new Error("Release gate is not open");
      if (order.kind === "qr_payment" && order.state !== "Delivered")
        throw new Error("QR payment not delivered");
      order = transition(order, "confirm", now, undefined, demoScale);
      const quote = order.quotes.find(
        (candidate) => candidate.id === order.quoteId,
      )!;
      transferCents(
        `escrow:${order.id}`,
        quote.fulfiller,
        cents(order.escrowUsd!),
      );
      transaction(order, "release", order.escrowUsd);
      unlockFulfiller(order, true);
      return updated(order);
    }
    case "dispute": {
      if (order.state !== "Delivered")
        throw new Error("Only delivered orders can be disputed");
      const reason = input.reason?.trim();
      if (!reason) throw new Error("Dispute reason required");
      order = transition(order, "dispute", now);
      const stake = disputeStake(
        order.escrowUsd!,
        order.rubric.disputeStakePct,
      );
      const injection = await detectInjection(reason);
      await attachBundle(order, injection.bundle);
      const dispute: Dispute = {
        orderId,
        reason,
        buyerStakeUsd: stake,
        injectionFlag: injection.flagged,
        appealCount: 0,
        layer0: { checks: order.evidence?.checks || [] },
      };
      order.dispute = dispute;
      if (order.evidence?.checks.some((c) => !c.pass)) {
        dispute.layer0!.outcome = "buyer";
        dispute.outcome = "buyer";
        order = transition(order, "verdict", now);
        lockBuyerStake(order, stake);
        return updated(order);
      }
      const sage = await sageDecision(
        { rubric: order.rubric, evidence: order.evidence },
        reason,
      );
      await attachBundle(order, sage.bundle);
      dispute.sage = {
        answer: sage.answer,
        probability: sage.probability,
        model: sage.model,
        bundleId: (sage.bundle as AttestationBundle | undefined)?.id,
      };
      const threshold = Number(process.env.SAGE_CONFIDENCE_THRESHOLD || 0.9);
      if (
        !dispute.injectionFlag &&
        sage.answer &&
        sage.probability >= threshold &&
        sage.model === "mock-sage"
      )
        dispute.outcome =
          sage.answer === "pay_fulfiller" ? "fulfiller" : "buyer";
      else {
        const result = await courtVotes(
          { rubric: order.rubric, evidence: order.evidence, complaint: reason },
          3,
        );
        for (const bundle of result.bundles) await attachBundle(order, bundle);
        dispute.court = { votes: result.votes, panelSize: 3 };
        dispute.outcome = majority(result.votes).outcome;
      }
      order = transition(order, "verdict", now);
      lockBuyerStake(order, stake);
      return updated(order);
    }
    case "settle":
      return atomic(() => {
        settleFunds(requireOrder(orderId));
        return requireOrder(orderId);
      });
    case "appeal": {
      if (
        order.state !== "Resolved" ||
        !order.dispute ||
        order.dispute.appealCount
      )
        throw new Error("Appeal unavailable");
      order = transition(order, "appeal", now);
      const dispute = order.dispute!;
      dispute.appealCount = 1;
      dispute.buyerStakeUsd += disputeStake(
        order.escrowUsd!,
        order.rubric.disputeStakePct,
        true,
      );
      const appealStake = disputeStake(
        order.escrowUsd!,
        order.rubric.disputeStakePct,
        true,
      );
      const result = await courtVotes(
        {
          rubric: order.rubric,
          evidence: order.evidence,
          complaint: dispute.reason,
          appeal: true,
        },
        5,
      );
      for (const bundle of result.bundles) await attachBundle(order, bundle);
      dispute.court = { votes: result.votes, panelSize: 5 };
      const verdict = majority(result.votes);
      dispute.outcome = verdict.outcome;
      dispute.splitPct = verdict.splitPct;
      order = transition(order, "verdict", now);
      lockBuyerStake(order, appealStake);
      return updated(order);
    }
    case "advance_demo_time":
      if (!mockMode()) throw new Error("Demo clock is mock-only");
      if (
        !Number.isFinite(input.hours) ||
        input.hours! <= 0 ||
        input.hours! > 168
      )
        throw new Error("Invalid demo hours");
      put(key("clock", order.id), "clock", {
        offsetMs:
          (get<{ offsetMs: number }>(key("clock", order.id))?.offsetMs || 0) +
          input.hours! * demoScale * 1000,
      });
      return order;
    case "timeout":
      if (
        order.state === "Delivered" &&
        !releaseGateOpen(order, now, demoScale)
      )
        throw new Error("Release gate closed");
      if (
        order.state === "Funded" &&
        now < new Date(order.rubric.windows.purchaseDeadline)
      )
        throw new Error("Purchase deadline not reached");
      order = transition(order, "timeout", now, undefined, demoScale);
      if (order.state === "Released") {
        const quote = order.quotes.find(
          (candidate) => candidate.id === order.quoteId,
        )!;
        transferCents(
          `escrow:${order.id}`,
          quote.fulfiller,
          cents(order.escrowUsd!),
        );
        transaction(order, "release", order.escrowUsd);
        unlockFulfiller(order, true);
      } else if (order.state === "Refunded") {
        transferCents(
          `escrow:${order.id}`,
          order.buyer,
          cents(order.escrowUsd!),
        );
        transaction(order, "refund", order.escrowUsd);
        const quote = order.quotes.find(
          (candidate) => candidate.id === order.quoteId,
        )!;
        unlockFulfiller(order, false);
        const fulfiller = fulfillerById(quote.fulfiller)!;
        const slashCents = Math.min(
          cents(fulfiller.bondUsd),
          Math.ceil(cents(quote.bondLockUsd) / 10),
        );
        settleBondSlash(order, fulfiller, slashCents, "slash_sla");
        fulfiller.counters.disputesLost++;
        fulfiller.tier = tier(fulfiller.counters);
        saveFulfiller(fulfiller);
      }
      return updated(order);
    case "cancel":
      order = transition(order, "cancel", now);
      unlockFulfiller(order, false);
      return updated(order);
    default:
      throw new Error("Unknown action");
  }
}
export function status() {
  return {
    adapters: adapterStatus(),
    network: process.env.NEAR_NETWORK || "testnet",
    contracts: {
      fulfil: process.env.NEAR_FULFIL_CONTRACT || undefined,
      court: process.env.NEAR_COURT_CONTRACT || undefined,
    },
    models: [
      process.env.NEAR_AI_TEXT_MODEL || "z-ai/glm-5.3-flash",
      process.env.NEAR_AI_VISION_MODEL || "z-ai/glm-5.3-flash",
    ],
    demoTimeScale: demoScale,
  };
}
export { orders, orderById, fulfillers, parseQr, sampleQr };
