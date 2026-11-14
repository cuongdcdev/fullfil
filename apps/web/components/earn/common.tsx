"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/kit";
import { errorMessage } from "@/lib/api";

export const LOCALS = [
  { id: "minh.fulfil.testnet", name: "Minh", level: 0 },
  { id: "linh.fulfil.testnet", name: "Linh", level: 2 },
  { id: "bao.fulfil.testnet", name: "Bao", level: 3 },
];
const KEY = "fulfil-earn-me";

function resolve(raw: string | null | undefined) {
  if (!raw) return undefined;
  const v = raw.trim().toLowerCase();
  return LOCALS.find((l) => l.id === v || l.name.toLowerCase() === v)?.id ?? (v.includes(".") ? v : undefined);
}

/** Who am I: ?as= wins, then localStorage, then Linh. */
export function useMe() {
  const [me, setMeState] = useState(LOCALS[1].id);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let found: string | undefined;
    try {
      found = resolve(new URLSearchParams(window.location.search).get("as"));
    } catch {
      /* ignore */
    }
    if (!found) {
      try {
        found = resolve(localStorage.getItem(KEY));
      } catch {
        /* ignore */
      }
    }
    if (found) setMeState(found);
    setReady(true);
  }, []);
  const setMe = useCallback((id: string) => {
    setMeState(id);
    try {
      localStorage.setItem(KEY, id);
    } catch {
      /* ignore */
    }
  }, []);
  return { me, setMe, ready };
}

export function MePicker({ me, setMe }: { me: string; setMe: (id: string) => void }) {
  const known = LOCALS.some((l) => l.id === me);
  return (
    <label className="flex items-center gap-2 text-sm text-muted">
      You are:
      <select
        value={me}
        onChange={(e) => setMe(e.target.value)}
        className="rounded-lg border border-line bg-panel px-2 py-1.5 font-bold text-ink"
      >
        {!known && <option value={me}>{me}</option>}
        {LOCALS.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Screen({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-[480px] px-4 pb-10 pt-5">{children}</div>;
}

/** Poll an async function. Keeps the last good data when a refresh fails. */
export function usePoll<T>(fn: () => Promise<T>, deps: unknown[], ms = 2000, enabled = true) {
  const [data, setData] = useState<T | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const reload = useCallback(async () => {
    try {
      setData(await fnRef.current());
      setError(undefined);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (!enabled) return;
    setLoading(true);
    setData(undefined);
    const refresh = () => {
      if (document.visibilityState === "visible") void reload();
    };
    refresh();
    const t = setInterval(refresh, ms);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", refresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, ms, enabled, reload]);
  return { data, error, loading, reload };
}

export function Loading({ text = "Loading…" }: { text?: string }) {
  return (
    <p className="flex items-center gap-3 py-8 text-lg text-muted" role="status">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-ink" aria-hidden />
      {text}
    </p>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="grid gap-3 rounded-2xl border border-danger bg-red-50 p-4 text-red-900 dark:bg-red-900/30 dark:text-red-100" role="alert">
      <p className="font-bold">{message}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function BigButton(props: Parameters<typeof Button>[0]) {
  const { className, ...rest } = props;
  return <Button full className={`min-h-14 !text-lg ${className ?? ""}`} {...rest} />;
}

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          /* clipboard blocked: still show feedback */
        }
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
      className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg border border-line bg-panel px-3 text-sm font-bold"
    >
      {done ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
      {done ? "Copied" : label}
    </button>
  );
}

export const STAGE_LABEL: Record<string, string> = {
  finding_local: "Open",
  claimed: "Pay the shop",
  transfer_sent: "Show proof",
  verifying: "Checking",
  proof_verified: "Waiting for customer",
  proof_limited: "Waiting for customer",
  awaiting_confirmation: "Waiting for customer",
  done: "Paid",
  under_review: "Being reviewed",
  refunded: "Refunded",
  cancelled: "Cancelled",
  expired: "Expired",
};
