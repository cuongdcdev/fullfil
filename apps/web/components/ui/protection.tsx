"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ShieldCheck, Wallet } from "lucide-react";
import { Card } from "@/components/ui/kit";
import { useAuth } from "@/components/v3/auth";
import { formatUsd, usdcBalance } from "@/lib/v3-client";

/** Reusable "How you're protected" explainer. Technical terms stay, with a plain gloss at first use. */
export function HowProtected({ id, className = "" }: { id?: string; className?: string }) {
  const step = "grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand text-sm font-bold text-brand-fg";
  return (
    <Card as="section" className={`grid gap-4 p-5 sm:p-6 ${className}`}>
      <h2 id={id} className="flex scroll-mt-4 items-center gap-2 text-lg font-extrabold tracking-tight">
        <ShieldCheck size={20} aria-hidden className="text-lime-deep" /> How you&apos;re protected
      </h2>
      <ol className="grid gap-4 text-sm leading-relaxed md:grid-cols-3 md:gap-6">
        <li className="flex gap-3">
          <span className={step}>1</span>
          <span>You pay into <strong>NEAR escrow</strong> (your money is locked until the job is proven).</span>
        </li>
        <li className="flex gap-3">
          <span className={step}>2</span>
          <span>A <strong>fulfiller</strong> (a local helper) or an AI agent does the job and submits proof.</span>
        </li>
        <li className="flex gap-3">
          <span className={step}>3</span>
          <span>
            The <strong>OutLayer</strong> verifier checks the proof inside a <strong>TEE</strong> (a secure enclave nobody can tamper
            with). Only then does escrow pay the fulfiller. If it is not done by the deadline, you get a refund.
          </span>
        </li>
      </ol>
    </Card>
  );
}

/** Shown above submit buttons while signed out. */
export function WalletNextNote() {
  const { status } = useAuth();
  if (status !== "out") return null;
  return <p className="-mt-2 text-center text-sm text-muted">You&apos;ll connect a wallet next (free).</p>;
}

/** Prominent top-up prompt when the signed-in balance is $0. */
export function AddMoneyCta({ className = "" }: { className?: string }) {
  const { status, me } = useAuth();
  if (status !== "in" || !me) return null;
  const balance = usdcBalance(me);
  if (BigInt(balance || "0") > BigInt(0)) return null;
  return (
    <Card className={`grid gap-2 border-brand bg-[var(--lime-tint)] ${className}`}>
      <div className="flex items-center gap-2 font-extrabold">
        <Wallet size={20} aria-hidden /> Your balance is {formatUsd(balance)}
      </div>
      <p className="text-sm">
        Top up from 200+ tokens on 38 chains using <strong>NEAR Intents</strong> (a cross-chain swap network). We convert it to USDC for you.
      </p>
      <Link href="/wallet" className="button lime w-max">
        Add money
      </Link>
    </Card>
  );
}

/** Persist form state across the /login?next= round trip. */
export function useDraft<T extends object>(key: string, value: T, restore: (saved: Partial<T>) => void) {
  const k = `fulfil-draft:${key}`;
  const restored = useRef(false);
  const restoreRef = useRef(restore);
  restoreRef.current = restore;
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(k);
      if (raw) restoreRef.current(JSON.parse(raw) as Partial<T>);
    } catch {
      /* ignore */
    }
    restored.current = true;
    setReady(true);
  }, [k]);
  const json = JSON.stringify(value);
  useEffect(() => {
    if (!ready) return;
    try {
      sessionStorage.setItem(k, json);
    } catch {
      /* ignore */
    }
  }, [k, json, ready]);
}

export function clearDraft(key: string) {
  try {
    sessionStorage.removeItem(`fulfil-draft:${key}`);
  } catch {
    /* ignore */
  }
}
