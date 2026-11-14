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
export type OrderKind = "errand" | "qr_payment";
export type Check = { id: string; pass: boolean; detail: string };
export type Rubric = {
  version: 1;
  deterministicChecks: {
    id: string;
    field: string;
    op: string;
    value: unknown;
  }[];
  aiChecks: { id: string; question: string; evidence: string[] }[];
  windows: {
    purchaseDeadline: string;
    autoAcceptHours: number;
    releaseGate: string;
  };
  disputeStakePct: number;
};
export type Spec = Record<string, unknown>;
export type Quote = {
  id: string;
  orderId: string;
  fulfiller: string;
  displayName: string;
  tier: number;
  costUsd: number;
  feeUsd: number;
  totalUsd: number;
  etaMinutes: number;
  bondUsd?: number;
  bondLockUsd?: number;
  validUntil?: string;
  signature?: string;
};
export type Fulfiller = {
  accountId: string;
  displayName: string;
  city: string;
  kinds: OrderKind[];
  bondUsd: number;
  lockedUsd: number;
  tier: number;
  counters: {
    completed: number;
    clean: number;
    disputesLost: number;
    disputesWon: number;
    appealsWon?: number;
    volumeUsd: number;
  };
};
export type AttestationBundle = {
  id: string;
  provider?: string;
  model?: string;
  mock?: boolean;
  hash?: string;
  checks?: Check[];
  [key: string]: unknown;
};
export type Dispute = {
  reason: string;
  buyerStakeUsd: number;
  injectionFlag: boolean;
  layer0?: Record<string, unknown>;
  sage?: Record<string, unknown>;
  court?: {
    votes?: {
      verdict: string;
      reasons?: string[];
      citedRubricIds?: string[];
      injectionDetected?: boolean;
      model?: string;
    }[];
    [key: string]: unknown;
  };
  outcome?: "fulfiller" | "buyer" | "split";
  executionRule?: string;
};
export type OrderDetail = {
  id: string;
  kind: OrderKind;
  buyer: string;
  state: OrderState;
  request?: string;
  spec: Spec;
  rubric: Rubric;
  specHash: string;
  rubricHash: string;
  quoteId?: string;
  escrowUsd?: number;
  createdAt: string;
  updatedAt?: string;
  history: {
    id?: string;
    type: string;
    from?: string;
    to?: string;
    at: string;
    detail?: string;
  }[];
  quotes: Quote[];
  fulfiller?: Fulfiller;
  evidence?: Record<string, unknown>;
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
};

/* ---------------------------------------------------------- QR bounty flow */
export type QrStage =
  | "awaiting_funding"
  | "finding_local"
  | "claimed"
  | "transfer_sent"
  | "verifying"
  | "proof_verified"
  | "proof_limited"
  | "awaiting_confirmation"
  | "done"
  | "under_review"
  | "refunded"
  | "cancelled"
  | "expired";
export type PayWith = "USDC" | "NEAR" | "ZEC" | "BTC";
export type QrMerchant = { name: string; bank: string; accountMasked: string };
export type QrProofView = {
  method: "bank_email" | "slip";
  accepted: boolean;
  checks: Check[];
  limited: boolean;
  attestation: {
    provider: "mock";
    inputHash: string;
    outputHash: string;
    verifiedAt: string;
    note: string;
  };
  bankRef?: string;
  submittedAt: string;
};
export type QrLocalProfile = {
  accountId: string;
  name: string;
  city: string;
  rating: number;
  completed: number;
  level: 0 | 1 | 2 | 3;
  bondLockedUsd: number;
};
export type QrOrderView = {
  id: string;
  stage: QrStage;
  requester: string;
  merchant: QrMerchant;
  vndAmount: number;
  fxRate: number;
  fxSource: string;
  principalUsd: number;
  rewardUsd: number;
  totalUsd: number;
  transferNote: string;
  payWith: string;
  funding?: { payWith: string; payAmount: number; intentId: string; mock: true; at: string };
  local?: QrLocalProfile;
  timeline: { stage: QrStage; at: string; label: string }[];
  proof?: QrProofView;
  proofAttempts: number;
  deadlines: {
    expiresAt: string;
    claimDeadline?: string;
    proofDeadline?: string;
    confirmDeadline?: string;
  };
  noShows: { fulfiller: string; at: string; penaltyUsd: number }[];
  ratingGiven?: number;
  dispute?: {
    reason: string;
    outcome?: "fulfiller" | "buyer" | "split";
    settled: boolean;
    canAppeal: boolean;
    stakeUsd: number;
  };
  escrowUsd?: number;
  createdAt: string;
  mock: boolean;
  /** `proof` is the full proof/dispute detail page. */
  links: { proof: string; api: string };
};
export type QrPreview = {
  merchant: QrMerchant;
  vndAmount: number | null;
  amountEditable: boolean;
  fxRate: number;
  fxSource: string;
  principalUsd?: number;
  rewardUsd?: number;
  totalUsd?: number;
  payWithOptions: PayWith[];
  defaultRewardUsd: number;
  note: string;
};
export type DisputeReason =
  | "not_received"
  | "wrong_amount"
  | "wrong_recipient"
  | "other";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      cache: "no-store",
      ...init,
      headers: {
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError(
      "Could not reach the Fulfil API. Check that the dev server is running.",
      0,
    );
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = body as { error?: string; code?: string } | null;
    throw new ApiError(
      error?.error || `Request failed (${response.status})`,
      response.status,
      error?.code,
    );
  }
  return body as T;
}

const post = <T>(path: string, body: unknown) =>
  request<T>(path, { method: "POST", body: JSON.stringify(body) });
export const api = {
  order: (id: string) =>
    request<OrderDetail>(`/api/orders/${encodeURIComponent(id)}`),
  action: (id: string, body: Record<string, unknown>) =>
    post<OrderDetail>(`/api/orders/${encodeURIComponent(id)}/actions`, body),
  cases: () => request<OrderDetail[]>("/api/cases"),
  qrSamples: () =>
    request<{
      vietqr: { payload: string; imageUrl?: string };
      pho: { payload: string; imageUrl?: string; merchant?: string; amountVnd?: number };
      promptpay: { payload: string; imageUrl?: string };
    }>("/api/qr/samples"),
  verifyBundle: (id: string) =>
    post<{ verified: boolean; mock: boolean; checks: Check[] }>(
      `/api/bundles/${encodeURIComponent(id)}/verify`,
      {},
    ),
  /* QR bounty: requester side */
  qrPreview: (body: { qrPayload: string; amountVnd?: number; rewardUsd?: number }) =>
    post<QrPreview>("/api/qr/preview", body),
  qrOrders: (requester?: string) =>
    request<QrOrderView[]>(
      `/api/qr/orders${requester ? `?requester=${encodeURIComponent(requester)}` : ""}`,
    ),
  qrOrder: (id: string) =>
    request<QrOrderView>(`/api/qr/orders/${encodeURIComponent(id)}`),
  qrFund: (id: string, body: { payWith?: PayWith } = {}) =>
    post<QrOrderView>(`/api/qr/orders/${encodeURIComponent(id)}/fund`, body),
  qrCancel: (id: string) =>
    post<QrOrderView>(`/api/qr/orders/${encodeURIComponent(id)}/cancel`, {}),
  qrConfirm: (id: string, body: { received: boolean; rating?: number }) =>
    post<QrOrderView>(`/api/qr/orders/${encodeURIComponent(id)}/confirm`, body),
  qrDispute: (id: string, body: { reason: DisputeReason; text: string }) =>
    post<QrOrderView>(`/api/qr/orders/${encodeURIComponent(id)}/dispute`, body),
  qrSettle: (id: string) =>
    post<QrOrderView>(`/api/qr/orders/${encodeURIComponent(id)}/settle`, {}),
};

/** Vietnamese formatting: 50000 -> "50.000 ₫". */
export function vnd(value: number | undefined) {
  return `${new Intl.NumberFormat("vi-VN").format(value ?? 0)} ₫`;
}

export function usd(value: number | undefined) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value ?? 0);
}

export function shortHash(hash: string | undefined) {
  if (!hash) return "Pending";
  return hash.length > 26 ? `${hash.slice(0, 13)}…${hash.slice(-9)}` : hash;
}

export function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please retry.";
}

export async function fileBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.readAsDataURL(file);
  });
}
