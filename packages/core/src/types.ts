import type { QrExt } from "./qrbounty";
export type Kind = "errand" | "qr_payment";
export type OrderState =
  | "Draft"
  | "Quoting"
  | "Accepted"
  | "Funded"
  | "Purchased"
  | "Delivered"
  | "Released"
  | "Disputed"
  | "Resolved"
  | "Rejected"
  | "Refunded"
  | "Cancelled"
  | "Expired";
export type Check = { id: string; pass: boolean; detail: string };
export type ErrandSpec = {
  category: "e_ticket";
  item: string;
  date: string;
  qty: number;
  names: string[];
  maxCostUsd: number;
  cancellable: boolean;
  allowedSenderDomains: string[];
  evidenceClasses: ("dkim_email" | "ticket_pdf")[];
};
export type QrPaymentSpec = {
  rail: "vietqr" | "promptpay" | "other";
  payeeName: string;
  payeeAccountHash: string;
  amountLocal: number;
  currency: "VND" | "THB" | "JPY";
  rawQr: string;
};
export type Spec = ErrandSpec | QrPaymentSpec;
export type Rubric = {
  version: 1;
  deterministicChecks: {
    id: string;
    field: string;
    op: "eq" | "includes" | "lte" | "date_eq" | "domain_in" | "unused";
    value: unknown;
  }[];
  aiChecks: { id: string; question: string; evidence: string[] }[];
  windows: {
    purchaseDeadline: string;
    autoAcceptHours: number;
    releaseGate: "immediate" | "after_event" | "after_challenge";
  };
  disputeStakePct: number;
};
export type Counters = {
  completed: number;
  clean: number;
  disputesLost: number;
  disputesWon: number;
  appealsWon: number;
  volumeUsd: number;
};
export type Fulfiller = {
  accountId: string;
  displayName: string;
  city: string;
  kinds: Kind[];
  bondUsd: number;
  lockedUsd: number;
  counters: Counters;
  tier: 0 | 1 | 2 | 3;
  cooldownUntil?: string;
  rating?: number;
  ratingCount?: number;
};
export type Quote = {
  id: string;
  orderId: string;
  fulfiller: string;
  costUsd: number;
  feeUsd: number;
  totalUsd: number;
  etaMinutes: number;
  validUntil: string;
  bondLockUsd: number;
  signature: string;
  tier: 0 | 1 | 2 | 3;
  displayName: string;
};
export type EvidenceFact = {
  orderId: string;
  dkimValid: boolean;
  dkimDomain: string;
  orderRef: string;
  nullifier: string;
  extracted: { date: string; qty: number; names: string[]; item: string };
  checks: Check[];
  attestation: {
    provider: "outlayer" | "near-ai" | "sage" | "mock";
    model?: string;
    inputHash: string;
    outputHash: string;
    quote?: string;
    signature?: string;
    verifiedAt?: string;
  };
};
export type JurorVote = {
  verdict: "fulfiller" | "buyer" | "split";
  splitPct?: number;
  reasons: string[];
  citedRubricIds: string[];
  injectionDetected: boolean;
  model?: string;
  bundleId?: string;
};
export type Dispute = {
  orderId: string;
  reason: string;
  buyerStakeUsd: number;
  injectionFlag: boolean;
  layer0?: { checks: Check[]; outcome?: "fulfiller" | "buyer" };
  sage?: {
    answer: string | null;
    probability: number;
    model: string;
    bundleId?: string;
  };
  court?: { votes: JurorVote[]; panelSize: number };
  outcome?: "fulfiller" | "buyer" | "split";
  splitPct?: number;
  appealCount: number;
  executionRule?: string;
};
export type AttestationBundle = {
  id: string;
  provider: "near-ai" | "sage" | "mock";
  model: string;
  nonce: string;
  request: unknown;
  response: unknown;
  signature?: unknown;
  attestationReport?: unknown;
  createdAt: string;
  mock: boolean;
  hash: string;
};
export type HistoryEvent = {
  id?: string;
  type: string;
  from?: OrderState;
  to?: OrderState;
  at: string;
  detail?: string;
};
export type OrderDetail = {
  id: string;
  kind: Kind;
  buyer: string;
  spec: Spec;
  rubric: Rubric;
  specHash: string;
  rubricHash: string;
  state: OrderState;
  quoteId?: string;
  escrowUsd?: number;
  createdAt: string;
  history: HistoryEvent[];
  quotes: Quote[];
  fulfiller?: Fulfiller;
  evidence?: EvidenceFact;
  dispute?: Dispute;
  bundles: AttestationBundle[];
  transactions: {
    id: string;
    kind: string;
    amountUsd?: number;
    mock: boolean;
    createdAt: string;
  }[];
  checks?: Check[];
  mock: boolean;
  releaseAt?: string;
  /** Present on orders created by the QR bounty flow. */
  qr?: QrExt;
};
