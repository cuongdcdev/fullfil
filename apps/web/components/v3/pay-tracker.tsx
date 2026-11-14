"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { VietQrMark } from "@/components/ui/vietqr-mark";
import { vnd } from "@/lib/api";
import {
  formatUsd,
  orderTotal,
  ratingDone,
  shortAccount,
  v3,
} from "@/lib/v3-client";
import { detailPathFor, isBankTransfer, timelineFor } from "@/lib/order-view";
import { authCall } from "@/lib/wallet/actions";
import { nearWalletConnected, reconnectNear } from "@/lib/wallet/near";
import { WalletError } from "@/lib/wallet/types";
import { BottomSheet, Button, Card, Stepper } from "@/components/ui/kit";
import { ErrorBox, Loading, Spinner } from "@/components/requester/common";
import { OrderSummaryRow } from "./order-detail";
import { useAuth } from "./auth";
import { BackgroundNotice, isBackgroundWait, SignNote, Stars, useAction, usePolling } from "./common";
import { ContactCard } from "./contact-card";

const REASONS = [
  { id: "not_received", label: "The shop did not get the money" },
  { id: "wrong_amount", label: "The amount was wrong" },
  { id: "wrong_recipient", label: "It went to the wrong shop" },
  { id: "other", label: "Something else" },
];

export function TrackerV3({ id }: { id: string }) {
  const router = useRouter();
  const { session, refreshMe } = useAuth();
  const viewer = session?.account_id ?? "";
  const { data, error: pollError, reload } = usePolling(
    () => v3.order(id),
    2000,
    (d) => timelineFor(d.order.kind, d.order.status).terminal,
  );
  const { busy, error, run } = useAction();
  const [stars, setStars] = useState(0);
  const [sheet, setSheet] = useState(false);
  const [reason, setReason] = useState(REASONS[0].id);
  const [nearReady, setNearReady] = useState(false);

  useEffect(() => {
    if (data && !isBankTransfer(data.order.kind)) router.replace(detailPathFor(data.order));
  }, [data, router]);

  if (!data) return pollError ? <ErrorBox message={pollError} onRetry={reload} /> : <Loading />;
  const { order, merchant } = data;
  if (!isBankTransfer(order.kind)) return <Loading text="Opening your order…" />;
  const phase = timelineFor(order.kind, order.status);
  const isBuyer = order.buyer === viewer;
  const nearRating = session?.standard === "nep413";

  const act = (fn: () => Promise<unknown>) =>
    run(async () => {
      try {
        await fn();
      } catch (cause) {
        if (cause instanceof WalletError && cause.needsConnect) setNearReady(false);
        throw cause;
      }
      reload();
      void refreshMe();
    });

  let body;
  if (order.status === "cancelled" || order.status === "expired") {
    body = (
      <Card className="grid gap-2 py-8 text-center">
        <p className="text-2xl font-black">{order.status === "expired" ? "Expired" : "Cancelled"}</p>
        <p className="text-muted">Your money is back in your wallet.</p>
        <Button href="/pay" className="mt-2">
          Pay another QR
        </Button>
      </Card>
    );
  } else if (order.status === "resolved") {
    body = (
      <Card className="grid gap-2 py-8 text-center">
        <p className="text-2xl font-black">Review resolved</p>
        <p className="text-muted">Your order has been settled.</p>
      </Card>
    );
  } else if (order.status === "disputed" || order.status === "under_review") {
    body = (
      <Card className="grid justify-items-center gap-3 py-8 text-center">
        <Spinner />
        <p className="text-2xl font-black">We&apos;re checking</p>
        <p className="text-muted">Your money is safe. This usually takes a minute.</p>
      </Card>
    );
  } else if (phase.done) {
    body = (
      <Card className="grid gap-3 text-center">
        <p className="text-6xl text-good" aria-hidden>
          ✓
        </p>
        <p className="text-2xl font-black">{phase.title}</p>
        <dl className="grid gap-3 text-left text-sm">
          <OrderSummaryRow label="Shop" value={merchant?.name ?? "Shop"} />
          <OrderSummaryRow label="Amount" value={vnd(order.amount_vnd)} />
          <OrderSummaryRow label="Reward" value={formatUsd(order.reward)} />
          <OrderSummaryRow label="Total" value={formatUsd(orderTotal(order))} total />
          {order.fulfiller && <OrderSummaryRow label="Local" value={shortAccount(order.fulfiller)} />}
        </dl>
        {isBuyer &&
          (ratingDone(order, viewer) ? (
            <div className="grid justify-items-center">
              <p className="text-sm text-muted">Your rating</p>
              <Stars value={order.buyer_rating ?? 0} />
            </div>
          ) : nearRating && !nearReady ? (
            <button type="button" className="min-h-11 text-sm font-bold underline" disabled={busy}
              onClick={() => void run(async () => {
                if (!(await nearWalletConnected(viewer))) await reconnectNear(viewer);
                setNearReady(true);
              })}>
              Connect wallet to rate
            </button>
          ) : (
            <div className="grid justify-items-center gap-2">
              <p className="text-sm text-muted">How was the local? Tap a star.</p>
              <Stars
                value={stars}
                disabled={busy}
                onChange={(n) => {
                  setStars(n);
                  void act(() => authCall({ op: "rate", order_id: order.id, stars: n }));
                }}
              />
              {busy && <SignNote />}
            </div>
          ))}
      </Card>
    );
  } else if (["claimed", "sent", "verifying", "proof_rejected", "verified"].includes(order.status)) {
    body = (
      <Card className="grid justify-items-center gap-2 py-6 text-center">
        <p className="text-2xl font-black">{phase.title}</p>
        {order.fulfiller && <p className="text-muted">Local: {shortAccount(order.fulfiller)}</p>}
        <Spinner small />
      </Card>
    );
  } else {
    body = (
      <Card className="grid justify-items-center gap-3 py-8 text-center">
        <Spinner />
        <p className="text-2xl font-black">{phase.title}</p>
        <p className="text-sm text-muted">Usually takes 2 minutes.</p>
        {isBuyer && (
          <>
            <button
              type="button"
              className="min-h-11 text-sm underline"
              disabled={busy}
              onClick={() => act(() => authCall({ op: "cancel", order_id: order.id }))}
            >
              Cancel and get my money back
            </button>
            <SignNote />
          </>
        )}
      </Card>
    );
  }

  return (
    <>
      <header className="grid gap-1.5">
        <VietQrMark width={80} className="mb-1" />
        <p className="text-sm text-muted">Paying</p>
        <h1 className="h1-title break-words">{merchant?.name ?? "Shop"}</h1>
        <p className="text-2xl font-bold leading-tight tabular-nums">{vnd(order.amount_vnd)}</p>
      </header>
      {body}
      {isBackgroundWait(order.status) && (
        <BackgroundNotice>A local pays the shop for you. Your payment is held safely until it is done.</BackgroundNotice>
      )}
      <ContactCard order={order} />
      {error && <ErrorBox message={error} />}
      {pollError && <p className="text-sm text-danger">Connection problem. Retrying…</p>}
      <Card>
        <Stepper steps={phase.steps} current={phase.step} />
      </Card>
      {isBuyer && order.status === "paid" && (
        <button type="button" className="justify-self-center min-h-11 text-sm text-muted underline" onClick={() => setSheet(true)}>
          Something wrong? Get help
        </button>
      )}
      <BottomSheet open={sheet} onClose={() => setSheet(false)} title="What went wrong?">
        <div className="grid gap-3">
          {REASONS.map((r) => (
            <label key={r.id} className="flex min-h-11 items-center gap-3 rounded-lg border border-line p-3">
              <input type="radio" name="reason" checked={reason === r.id} onChange={() => setReason(r.id)} />
              {r.label}
            </label>
          ))}
          <Button
            variant="danger"
            full
            disabled={busy}
            onClick={async () => {
              await act(() => authCall({ op: "dispute", order_id: order.id, reason_code: reason }));
              setSheet(false);
            }}
          >
            Get help
          </Button>
          <SignNote />
        </div>
      </BottomSheet>
    </>
  );
}
