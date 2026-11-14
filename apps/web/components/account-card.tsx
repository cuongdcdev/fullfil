"use client";

import Link from "next/link";
import { Check, Copy, Plus } from "lucide-react";
import { useState } from "react";
import { useAuth } from "./v3/auth";
import { UsdcIcon } from "@/components/ui/usdc-icon";
import { formatUsd, shortAccount, usdcBalance } from "@/lib/v3-client";

export function CopyAccount({ id }: { id: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      aria-label="Copy account id"
      title="Copy account id"
      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-soft hover:text-ink"
      onClick={async (event) => {
        event.stopPropagation();
        try {
          await navigator.clipboard.writeText(id);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          /* clipboard unavailable */
        }
      }}
    >
      {done ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
    </button>
  );
}

export function Avatar({ id, size = 36 }: { id: string; size?: number }) {
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-full bg-brand font-extrabold uppercase text-brand-fg"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {id.replace(/^0x/, "").charAt(0) || "?"}
    </span>
  );
}

/** "$66.98", or "$1.2k" / "$3.4M" when large. */
export function formatUsdShort(units: string): string {
  const value = Number(units) / 1_000_000;
  if (!Number.isFinite(value)) return "$0.00";
  const trim = (n: number) => String(Math.round(n * 10) / 10).replace(/\.0$/, "");
  if (value >= 1_000_000) return `$${trim(value / 1_000_000)}M`;
  if (value >= 1_000) return `$${trim(value / 1_000)}k`;
  return formatUsd(units);
}

/** One compact two-row card: who you are and what you have. Shared by the sidebar and Account. */
export function AccountCard({ className = "" }: { className?: string }) {
  const { status, session, me } = useAuth();
  const id = session?.account_id;
  const shell = `rounded-2xl border border-line bg-paper p-3 ${className}`;
  if (status === "out") {
    return (
      <div className={`grid gap-2.5 ${shell}`}>
        <p className="text-[13px] leading-snug text-muted">Your wallet is your account. No password.</p>
        <Link href="/login" className="button lime w-full !min-h-10 !py-2">
          Connect wallet
        </Link>
      </div>
    );
  }
  if (status !== "in" || !id) {
    return <div className={`skeleton ${className}`} style={{ height: 78, borderRadius: 16 }} aria-hidden />;
  }
  return (
    <div className={`group grid gap-2 ${shell}`}>
      <div className="flex items-center gap-1">
        <Link href="/account" title={`${id} · your profile`} aria-label={`Your profile, ${id}`}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-lg py-0.5 transition-colors hover:text-lime-deep">
          <Avatar id={id} size={28} />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">{id}</span>
        </Link>
        <span className="opacity-100 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-focus-within:opacity-100 [@media(hover:hover)]:group-hover:opacity-100">
          <CopyAccount id={id} />
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Link href="/wallet" aria-label="Open wallet" className="flex min-w-0 flex-1 items-center gap-2 rounded-lg">
          <UsdcIcon size={18} />
          <span className="truncate text-sm">
            <strong className="font-extrabold tabular-nums">{me ? formatUsd(usdcBalance(me)) : "…"}</strong>{" "}
            <span className="text-muted">USDC</span>
          </span>
        </Link>
        <Link href="/wallet" aria-label="Add money" title="Add money"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-line bg-panel transition-colors hover:border-brand hover:bg-brand hover:text-brand-fg">
          <Plus size={16} aria-hidden />
        </Link>
      </div>
      <IntentsBalanceNote />
    </div>
  );
}

/** Our balance is the NEAR Intents (intents.near) balance, not the account's on-chain wallet tokens. Say so to avoid "where are my tokens?". */
export function IntentsBalanceNote({ className = "" }: { className?: string }) {
  return (
    <p className={`text-xs text-muted ${className}`}>
      This is your NEAR Intents balance. Tokens in your regular NEAR wallet don&apos;t show here. Manage NEAR Intents at{" "}
      <a href="https://near.com" target="_blank" rel="noreferrer" className="font-bold underline">near.com ↗</a>
    </p>
  );
}
