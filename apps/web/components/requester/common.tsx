"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Button, Card } from "@/components/ui/kit";
import { api, type QrOrderView, type QrStage } from "@/lib/api";

/** Same requester id the API seeds and defaults to. */
export const REQUESTER = "agent-alpha.testnet";
/** Demo only: there is no balance API yet. */
export const DEMO_BALANCE_USD = 100;
const MONEY_BACK_STAGES = ["refunded", "cancelled", "expired"];

/** Demo balance = start money minus what is held or spent. Used by Home and Wallet so they always agree. */
export function demoBalanceUsd(orders: QrOrderView[]) {
  const spent = orders
    .filter((o) => o.stage !== "awaiting_funding" && !MONEY_BACK_STAGES.includes(o.stage))
    .reduce((sum, o) => sum + o.totalUsd, 0);
  return Math.max(0, Math.round((DEMO_BALANCE_USD - spent) * 100) / 100);
}

export function useDemoBalance() {
  const [balance, setBalance] = useState<number | null>(null);
  useEffect(() => {
    api.qrOrders(REQUESTER).then((l) => setBalance(demoBalanceUsd(l))).catch(() => setBalance(DEMO_BALANCE_USD));
  }, []);
  return balance;
}

export function Column({ children }: { children: ReactNode }) {
  return <div className="page"><div className="mx-auto grid max-w-[520px] gap-5">{children}</div></div>;
}

export function Loading({ text = "Loading…" }: { text?: string }) {
  return (
    <div className="grid gap-3 py-2" role="status" aria-live="polite">
      <span className="sr-only">{text}</span>
      <div className="skeleton" style={{ height: 84, borderRadius: 16 }} />
      <div className="skeleton" style={{ height: 84, borderRadius: 16 }} />
      <div className="skeleton" style={{ height: 84, borderRadius: 16, opacity: 0.6 }} />
    </div>
  );
}

export function Spinner({ small }: { small?: boolean }) {
  const size = small ? "h-5 w-5 border-2" : "h-14 w-14 border-4";
  return <span className={`inline-block animate-spin rounded-full border-line border-t-brand ${size}`} role="status" aria-label="Loading" />;
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card className="grid gap-3 border-danger">
      <p className="font-bold text-danger">Something went wrong</p>
      <p className="text-sm text-muted">{message}</p>
      {onRetry && <Button onClick={onRetry}>Try again</Button>}
    </Card>
  );
}

export function StepLabel({ step, hint }: { step: number; hint: string }) {
  return (
    <div>
      <p className="text-sm font-bold text-muted">Step {step} of 3</p>
      <p className="text-sm text-muted">{hint}</p>
    </div>
  );
}

export const TERMINAL: QrStage[] = ["done", "refunded", "cancelled", "expired"];

/** Plain words for the activity list. */
export function plainStage(stage: QrStage, disputed?: boolean): { text: string; tone: "good" | "bad" | "warn" | "neutral" } {
  if (disputed && stage !== "refunded" && stage !== "done") return { text: "We're checking", tone: "warn" };
  switch (stage) {
    case "awaiting_funding": return { text: "Not paid yet", tone: "neutral" };
    case "finding_local": return { text: "Finding a local", tone: "warn" };
    case "claimed":
    case "transfer_sent":
    case "verifying":
    case "proof_verified":
    case "proof_limited": return { text: "Paying the shop", tone: "warn" };
    case "awaiting_confirmation": return { text: "Please confirm", tone: "warn" };
    case "done": return { text: "Done ✓", tone: "good" };
    case "under_review": return { text: "We're checking", tone: "warn" };
    case "refunded": return { text: "Money back", tone: "bad" };
    case "cancelled": return { text: "Cancelled", tone: "bad" };
    case "expired": return { text: "Expired", tone: "bad" };
  }
}
