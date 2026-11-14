"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { MonitorSmartphone } from "lucide-react";
import { BottomSheet } from "@/components/ui/kit";
import { friendlyError, V3Error } from "@/lib/v3-client";
import { WalletError } from "@/lib/wallet";
import { serverWalletPhase, subscribeWalletPhase, walletPhase } from "@/lib/wallet/progress";

function useWalletPhase() {
  return useSyncExternalStore(subscribeWalletPhase, walletPhase, serverWalletPhase);
}

export function WalletActionLabel() {
  const phase = useWalletPhase();
  if (phase === "confirming") return <>Confirming your transaction…</>;
  if (phase === "signing") return <>Waiting for your wallet…</>;
  return <>Processing…</>;
}

/** The one plain line shown before every wallet approval. */
export function SignNote({ className = "" }: { className?: string }) {
  const phase = useWalletPhase();
  return (
    <p className={`text-center text-sm text-muted ${className}`}>
      {phase === "confirming"
        ? "Your approval was sent. Waiting for confirmation."
        : "Your wallet will ask you to approve. It's free."}
    </p>
  );
}

/** Technical detail lives here, never on the main screen. */
export function HowItWorks({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <BottomSheet open={open} onClose={onClose} title="How does this work?">
      <div className="grid gap-3 text-sm">
        <p>
          You log in and approve each step with your crypto wallet. Approving is free: we pay the network fee for
          you.
        </p>
        <p>
          Your money sits in a shared balance on NEAR Intents. When you pay, it is held in a safe contract, not by us.
          It is only released to the local after the bank proof is checked.
        </p>
        <p className="text-muted">
          Technical: sign-in uses a one-time message (NEP-413 for NEAR, ERC-191 for Ethereum). Each action is a signed
          intent that our relayer sends to intents.near.
        </p>
      </div>
    </BottomSheet>
  );
}

/** Run an async action with busy + error state. Cancelling in the wallet is not an error. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    setBusy(true);
    setError("");
    try {
      return await fn();
    } catch (e) {
      if (alive.current && !(e instanceof WalletError && e.userCancelled)) setError(friendlyError(e));
      else if (alive.current)
        setError(
          e instanceof WalletError && !/^You cancelled/.test(e.message)
            ? e.message
            : "You cancelled in your wallet. Nothing happened.",
        );
      return undefined;
    } finally {
      if (alive.current) setBusy(false);
    }
  }, []);
  return { busy, error, setError, run };
}

/** Poll a function until it says stop. Keeps the last good value on errors. */
const NOT_FOUND_GRACE_MS = 45_000;
const TRANSIENT_ERROR_GRACE_MS = 10_000;

export function usePolling<T>(fn: () => Promise<T>, ms: number, stop?: (v: T) => boolean) {
  const [data, setData] = useState<T | undefined>();
  const [error, setError] = useState("");
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const stopRef = useRef(stop);
  stopRef.current = stop;
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let cancelled = false;
    let running = false;
    let stopped = false;
    let halted = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let errorTimer: ReturnType<typeof setTimeout> | undefined;
    const clearErrorTimer = () => {
      if (errorTimer) clearTimeout(errorTimer);
      errorTimer = undefined;
    };
    // A just-created order can 404 for a few seconds until the chain/indexer catches up
    // (e.g. right after paying). Until the first success, retry 404s quietly for a while.
    const startedAt = Date.now();
    let seen = false;
    const once = async () => {
      if (cancelled || running || stopped || document.visibilityState !== "visible") return;
      running = true;
      let finished = false;
      let clientError = false;
      try {
        const v = await fnRef.current();
        if (cancelled) return;
        setData(v);
        clearErrorTimer();
        setError("");
        seen = true;
        finished = !!stopRef.current?.(v);
      } catch (e) {
        if (cancelled) return;
        const freshNotFound =
          !seen && e instanceof V3Error && e.status === 404 && Date.now() - startedAt < NOT_FOUND_GRACE_MS;
        if (freshNotFound) {
          clearErrorTimer();
          setError("");
          running = false;
          if (!cancelled) timer = setTimeout(once, Math.min(ms, 2_000));
          return;
        }
        const transient = e instanceof TypeError ||
          (e instanceof V3Error && e.code !== "not_configured" &&
            (e.status >= 500 || e.status === 408 || e.status === 429));
        if (transient) {
          // A single failed read does not mean the action or order failed. Keep the
          // last snapshot (or loading state), but surface an outage if it persists.
          if (!errorTimer) {
            errorTimer = setTimeout(() => {
              if (!cancelled) setError("Updates are taking longer than usual. We are still checking automatically.");
            }, TRANSIENT_ERROR_GRACE_MS);
          }
        } else {
          clearErrorTimer();
          setError(friendlyError(e));
        }
        // 4xx (401 logged out, 403, 404) will not fix itself by retrying: wait for reload()
        // or the tab becoming visible again instead of hammering the API.
        if (e instanceof V3Error && e.status >= 400 && e.status < 500 && e.status !== 408 && e.status !== 429)
          finished = clientError = true;
      }
      running = false;
      if (finished) stopped = true;
      if (clientError) halted = true;
      if (!cancelled && !finished) timer = setTimeout(once, ms);
    };
    const onVisible = () => {
      if (document.visibilityState !== "visible" || (stopped && !halted)) return;
      if (timer) clearTimeout(timer);
      stopped = false;
      halted = false;
      void once();
    };
    document.addEventListener("visibilitychange", onVisible);
    void once();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      clearErrorTimer();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [ms, tick]);
  return { data, error, reload: () => setTick((n) => n + 1) };
}

export function Stars({ value, onChange, disabled }: { value: number; onChange?: (n: number) => void; disabled?: boolean }) {
  return (
    <div className="flex gap-1" role={onChange ? "group" : "img"} aria-label={onChange ? "Rating" : `${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange || disabled}
          onClick={() => onChange?.(n)}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          className={`h-11 w-11 text-3xl ${n <= value ? "text-amber-500" : "text-line"}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

/** Statuses where the work continues server-side or on-chain and the buyer has nothing to do. */
const BACKGROUND_STATUSES = ["funded", "claimed", "sent", "verifying", "proof_rejected", "verified"];

export function isBackgroundWait(status: string): boolean {
  return BACKGROUND_STATUSES.includes(status);
}

/** Calm note for waiting screens. Render only when the buyer has no action to take. */
export function BackgroundNotice({ children }: { children?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-line bg-soft p-4 text-sm">
      <MonitorSmartphone size={20} aria-hidden className="mt-0.5 shrink-0 text-brand" />
      <div className="grid gap-1">
        <p className="font-bold">This runs in the background.</p>
        <p className="text-muted">
          You can do something else or close this tab. Find it anytime in{" "}
          <Link href="/activity" className="font-bold underline">Activity</Link>.
        </p>
        {children && <p className="text-muted">{children}</p>}
      </div>
    </div>
  );
}
