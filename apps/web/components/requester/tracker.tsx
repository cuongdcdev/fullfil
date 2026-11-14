"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorMessage, usd, vnd, type DisputeReason, type QrOrderView } from "@/lib/api";
import { BottomSheet, Button, Card, Stepper } from "@/components/ui/kit";
import { ErrorBox, Loading, Spinner, TERMINAL } from "./common";

const STEPS = ["Paid", "Local found", "Shop paid", "You confirmed"];
const REASONS: { id: DisputeReason; label: string }[] = [
  { id: "not_received", label: "The shop did not get the money" },
  { id: "wrong_amount", label: "The amount was wrong" },
  { id: "wrong_recipient", label: "It went to the wrong shop" },
  { id: "other", label: "Something else" },
];

function currentStep(o: QrOrderView) {
  switch (o.stage) {
    case "awaiting_funding": return 0;
    case "finding_local": return 1;
    case "claimed":
    case "transfer_sent": return 2;
    case "done": return 4;
    default: return 3;
  }
}

function Stars({ value, onChange }: { value: number; onChange?: (n: number) => void }) {
  return (
    <div className="flex gap-1" role={onChange ? "group" : undefined} aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(value === n ? 0 : n)}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          className={`h-11 w-11 text-3xl ${n <= value ? "text-amber-500" : "text-line"}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export function useQrOrder(id: string) {
  const [order, setOrder] = useState<QrOrderView | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(() => {
    return api.qrOrder(id).then((o) => { setOrder(o); setError(""); return o; }).catch((e) => { setError(errorMessage(e)); return null; });
  }, [id]);
  useEffect(() => { void load(); }, [load]);
  const active = !!order && !TERMINAL.includes(order.stage);
  useEffect(() => {
    if (!active) return;
    const refresh = () => {
      if (document.visibilityState === "visible") void load();
    };
    const t = setInterval(refresh, 10_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [active, load]);
  return { order, setOrder, error, load };
}

export function Tracker({ id }: { id: string }) {
  const { order, setOrder, error, load } = useQrOrder(id);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [rating, setRating] = useState(0);
  const [sheet, setSheet] = useState(false);
  const [reason, setReason] = useState<DisputeReason>("not_received");
  const [text, setText] = useState("");
  const settling = useRef(false);

  // A decided dispute still needs /settle to move the money.
  useEffect(() => {
    if (!order?.dispute?.outcome || order.dispute.settled || settling.current) return;
    settling.current = true;
    api.qrSettle(order.id).then(setOrder).catch(() => undefined).finally(() => { settling.current = false; });
  }, [order, setOrder]);

  const run = async (fn: () => Promise<QrOrderView>) => {
    setBusy(true);
    setActionError("");
    try {
      setOrder(await fn());
    } catch (e) {
      setActionError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (error && !order) return <ErrorBox message={error} onRetry={load} />;
  if (!order) return <Loading />;

  const o = order;
  const local = o.local;
  const proofLink = <Link href={`/orders/${o.id}/proof`} className="text-sm font-bold underline">How do we know? ›</Link>;
  const dispute = o.dispute;

  let body;
  if (dispute && dispute.outcome) {
    const money = dispute.outcome === "buyer";
    body = (
      <Card className="grid gap-2 py-8 text-center">
        <p className={`text-5xl ${money ? "text-good" : "text-good"}`}>✓</p>
        <p className="text-2xl font-black">
          {money ? "You got your money back" : dispute.outcome === "fulfiller" ? "The local was right — payment completed" : "We shared the money fairly"}
        </p>
        {!dispute.settled && <p className="text-sm text-muted">Finishing up…</p>}
      </Card>
    );
  } else if (dispute || o.stage === "under_review") {
    body = (
      <Card className="grid justify-items-center gap-3 py-8 text-center">
        <Spinner />
        <p className="text-2xl font-black">We&apos;re checking</p>
        <p className="text-muted">Your money is safe. This usually takes a minute.</p>
      </Card>
    );
  } else if (o.stage === "done") {
    body = (
      <Card className="grid gap-3 text-center">
        <p className="text-6xl text-good">✓</p>
        <p className="text-2xl font-black">Done! The shop got paid.</p>
        <dl className="grid gap-1 text-left text-sm">
          <Row k="Shop" v={o.merchant.name} />
          <Row k="Amount" v={vnd(o.vndAmount)} />
          <Row k="Tip" v={usd(o.rewardUsd)} />
          <Row k="Total" v={usd(o.totalUsd)} bold />
          {local && <Row k="Paid by" v={local.name} />}
          <Row k="Time" v={new Date(o.timeline.at(-1)?.at ?? o.createdAt).toLocaleString()} />
        </dl>
        {o.ratingGiven ? (
          <div className="grid justify-items-center"><p className="text-sm text-muted">Your rating</p><Stars value={o.ratingGiven} /></div>
        ) : null}
      </Card>
    );
  } else if (o.stage === "refunded" || o.stage === "cancelled" || o.stage === "expired") {
    const msg = {
      refunded: ["Your money is back", "The payment did not go through, so we returned your money."],
      cancelled: ["Cancelled", "You cancelled this. Nothing was charged."],
      expired: ["No local was found in time", "Nothing was charged. You can try again."],
    }[o.stage];
    body = (
      <Card className="grid gap-2 py-8 text-center">
        <p className="text-2xl font-black">{msg[0]}</p>
        <p className="text-muted">{msg[1]}</p>
        <Button href="/pay" className="mt-2">Pay another QR</Button>
      </Card>
    );
  } else if (o.stage === "awaiting_confirmation" || ["verifying", "proof_verified", "proof_limited"].includes(o.stage)) {
    const ready = o.stage === "awaiting_confirmation";
    body = (
      <Card className="grid gap-4 text-center">
        {ready ? (
          <>
            <p className="text-2xl font-black">Did the shop get {vnd(o.vndAmount)}?</p>
            <p className={`text-sm font-bold ${o.proof?.limited ? "text-warn" : "text-good"}`}>
              {o.proof?.limited ? "Photo proof only" : "Checked ✓"}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Button className="min-h-14 text-lg" disabled={busy} onClick={() => run(() => api.qrConfirm(o.id, { received: true, rating: rating || undefined }))}>Yes</Button>
              <Button variant="danger" className="min-h-14 text-lg" disabled={busy} onClick={() => setSheet(true)}>No</Button>
            </div>
            <div className="grid justify-items-center gap-1">
              <p className="text-sm text-muted">Rate {local?.name ?? "the local"} (optional)</p>
              <Stars value={rating} onChange={setRating} />
            </div>
          </>
        ) : (
          <div className="grid justify-items-center gap-3"><Spinner /><p className="text-xl font-bold">Checking the proof…</p></div>
        )}
        {proofLink}
      </Card>
    );
  } else if (o.stage === "claimed" || o.stage === "transfer_sent") {
    body = (
      <Card className="grid gap-2 text-center">
        <p className="text-2xl font-black">{local?.name ?? "A local"}</p>
        {local && <p className="text-muted">★ {local.rating.toFixed(1)} · {local.completed} jobs</p>}
        <p className="text-lg">{local?.name ?? "The local"} is paying the shop now</p>
        <div className="flex justify-center"><Spinner small /></div>
      </Card>
    );
  } else if (o.stage === "awaiting_funding") {
    body = (
      <Card className="grid gap-3 text-center">
        <p className="text-2xl font-black">Not paid yet</p>
        <Button disabled={busy} onClick={() => run(() => api.qrFund(o.id, {}))}>Pay {usd(o.totalUsd)}</Button>
      </Card>
    );
  } else {
    body = (
      <Card className="grid justify-items-center gap-3 py-8 text-center">
        <Spinner />
        <p className="text-2xl font-black">Finding a local to pay for you…</p>
        <p className="text-sm text-muted">Usually takes 2 minutes.</p>
        <button className="text-sm underline" disabled={busy} onClick={() => run(() => api.qrCancel(o.id))}>Cancel</button>
      </Card>
    );
  }

  return (
    <>
      <div>
        <p className="text-sm text-muted">Paying</p>
        <h1 className="h1-title">{o.merchant.name}</h1>
        <p className="text-3xl font-black">{vnd(o.vndAmount)}</p>
      </div>
      {body}
      {actionError && <ErrorBox message={actionError} />}
      {error && <p className="text-sm text-danger">Connection problem. Retrying…</p>}
      <Card><Stepper steps={STEPS} current={currentStep(o)} /></Card>
      <BottomSheet open={sheet} onClose={() => setSheet(false)} title="What went wrong?">
        <div className="grid gap-3">
          {REASONS.map((r) => (
            <label key={r.id} className="flex min-h-11 items-center gap-3 rounded-lg border border-line p-3">
              <input type="radio" name="reason" checked={reason === r.id} onChange={() => setReason(r.id)} />
              {r.label}
            </label>
          ))}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Tell us more (optional)"
            aria-label="More details"
            className="min-h-20 rounded-lg border border-line bg-panel p-3"
          />
          <Button
            variant="danger"
            full
            disabled={busy}
            onClick={async () => {
              await run(() => api.qrDispute(o.id, { reason, text }));
              setSheet(false);
            }}
          >
            Get help
          </Button>
        </div>
      </BottomSheet>
    </>
  );
}

function Row({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 ${bold ? "border-t border-line pt-1 font-black" : ""}`}>
      <dt className="text-muted">{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}
