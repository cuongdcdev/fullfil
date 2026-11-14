"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DeliveryQr } from "@/components/shop/delivery-qr";
import { Button, Card, Notice, OrderHeader, StatusPill, Stepper } from "@/components/ui/kit";
import { Column, ErrorBox, Loading } from "@/components/requester/common";
import { OrderSummaryRow } from "@/components/v3/order-detail";
import { BackgroundNotice, isBackgroundWait, useAction, usePolling } from "@/components/v3/common";
import { LoginPrompt, useAuth } from "@/components/v3/auth";
import { ContactCard } from "@/components/v3/contact-card";
import { TokenBuyOrder } from "@/components/shop/token-buy";
import { claimedAtMs, formatUsd, orderTotal, v3, type V3Order } from "@/lib/v3-client";
import { orderTitle, timelineFor } from "@/lib/order-view";

function InPersonOrder({ order, reload }: { order: V3Order; reload: () => void }) {
  const { session } = useAuth();
  const { busy, error, run } = useAction();
  const [secret, setSecret] = useState("");
  const [backup, setBackup] = useState("");
  const [received, setReceived] = useState(false);
  const [now, setNow] = useState(Date.now());
  const buyer = session?.account_id === order.buyer;
  const phase = timelineFor(order.kind, order.status);
  const pastDeadline = BigInt(now) * BigInt(1_000_000) >= BigInt(order.deadline_ns);
  const claimedAt = claimedAtMs(order);
  // in_person claim window equals the order deadline window (24h), so the deadline bounds the reveal.
  const claimExpired = claimedAt === undefined ||
    BigInt(now + 60_000) * BigInt(1_000_000) >= BigInt(order.deadline_ns);
  const refundable = buyer && pastDeadline && ["funded", "claimed"].includes(order.status);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!buyer) return;
    try {
      const stored = localStorage.getItem(`in-person-secret:${order.id}`) || "";
      setSecret(/^[a-f0-9]{64}$/.test(stored) ? stored : "");
    } catch {
      setSecret("");
    }
  }, [buyer, order.id]);
  return (
    <Column>
      <Link href="/shop" className="back-link">Shop</Link>
      <OrderHeader id={order.id} title={orderTitle(order)} status={phase.title} tone={phase.tone} />
      {order.status === "claimed" && buyer && !pastDeadline && claimExpired && (
        <p>Your local&apos;s time to deliver ran out. Wait for them to accept again before showing your code.</p>
      )}
      {order.status === "claimed" && buyer && !pastDeadline && !claimExpired && !received && (
        <>
          <Card className="grid gap-1">
            <h2 className="text-lg font-black">Your delivery code</h2>
            <p>You need this code to receive your item. When your helper hands it over, they scan this QR to complete the order. Only show it after you have the item.</p>
          </Card>
          <Button full className="min-h-14 text-lg" onClick={() => setReceived(true)}>I received it</Button>
        </>
      )}
      {order.status === "claimed" && buyer && !pastDeadline && !claimExpired && received && (
        <Card className="grid justify-items-center gap-3 text-center">
          {secret ? <>
            <h2 className="text-2xl font-black">Show this to your helper</h2>
            <p className="text-sm text-muted">Let them scan it now. Show it only to the helper who gave you the item.</p>
            <DeliveryQr secret={secret} orderId={order.id} />
          </> : <div className="grid gap-3 text-left">
            <p>Your saved code is missing in this browser. Paste your backup below. Without the code the order cannot be confirmed, and your money is returned after the deadline.</p>
            <label className="grid gap-1 font-bold">Backup code
              <input className="min-h-12 rounded-lg border border-line bg-panel px-3 font-mono text-sm" value={backup} onChange={(event) => setBackup(event.target.value)} autoComplete="off" />
            </label>
            <Button disabled={!/^[a-f0-9]{64}$/.test(backup.trim())} onClick={() => setSecret(backup.trim())}>Show delivery QR</Button>
          </div>}
        </Card>
      )}
      {["paid", "closed"].includes(order.status) && (
        <Notice>Delivery confirmed. Your helper has been paid.</Notice>
      )}
      <Card>
        <dl className="grid gap-3 text-sm">
          <OrderSummaryRow label="Item" value={order.spec_summary?.brand || "Your item"} />
          <OrderSummaryRow label="Area" value={order.spec_summary?.masked_beneficiary || "Not shared"} />
          <OrderSummaryRow label="Item price" value={formatUsd(order.pay_amount)} />
          <OrderSummaryRow label="Reward" value={formatUsd(order.reward)} />
          <OrderSummaryRow label="Total" value={formatUsd(orderTotal(order))} total />
          {order.fulfiller && <OrderSummaryRow label="Helper" value={order.fulfiller} />}
        </dl>
      </Card>
      <Card><Stepper steps={phase.steps} current={phase.step} /></Card>
      {order.status === "funded" && !pastDeadline && <p className="text-sm text-muted">We will update this page when someone accepts.</p>}
      {!pastDeadline && ["funded", "sent", "verifying", "verified"].includes(order.status) && (
        <BackgroundNotice>{order.status === "funded" ? "We keep looking for a helper." : "We are checking the handover."}</BackgroundNotice>
      )}
      {refundable && (
        <>
          <p>The deadline has passed. You can get your money back now.</p>
          <Button full className="min-h-14 text-lg" disabled={busy} onClick={() => void run(async () => {
            await v3.inPersonExpire(order.id);
            reload();
          })}>{busy ? "Returning your money…" : "Get refund"}</Button>
        </>
      )}
      {error && <ErrorBox message={error} />}
      {order.status === "expired" && <Notice tone="warn">The deadline passed. Your money was returned.</Notice>}
    </Column>
  );
}

export function ShopOrderScreen({ id }: { id: string }) {
  const { status: authStatus } = useAuth();
  const { data, error, reload } = usePolling(
    () => v3.order(id),
    3000,
    (result) => timelineFor(result.order.kind, result.order.status).terminal,
  );
  // Polling pauses on 401 while logged out; fetch again once the user logs in.
  useEffect(() => {
    if (authStatus === "in") reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authStatus]);

  // Order detail is public; only ask for login if the logged-out fetch actually failed.
  if (authStatus === "out" && !data && error) return <LoginPrompt text="Log in to see this order" />;
  if (!data) {
    return (
      <Column>
        {error ? <ErrorBox message={error} onRetry={reload} /> : <Loading text="Loading your order…" />}
      </Column>
    );
  }

  const { order } = data;
  const contact = (
    <Column><ContactCard order={order} /></Column>
  );
  if (order.kind === "in_person") return <><InPersonOrder order={order} reload={reload} />{contact}</>;
  if (order.kind === "token_buy") return <><TokenBuyOrder order={order} reload={reload} />{contact}</>;
  const phase = timelineFor(order.kind, order.status);

  return (
    <>
    <Column>
      <OrderHeader id={order.id} title={orderTitle(order)} status={phase.title} tone={phase.tone} />

      <Card>
        <dl className="grid gap-3 text-sm">
          <OrderSummaryRow label="Product" value={orderTitle(order)} />
          {order.spec_summary?.masked_beneficiary && (
            <OrderSummaryRow label="Sent to" value={order.spec_summary.masked_beneficiary} />
          )}
          <OrderSummaryRow label="Price" value={formatUsd(order.pay_amount)} />
          <OrderSummaryRow label="Reward" value={formatUsd(order.reward)} />
          <OrderSummaryRow label="Total" value={formatUsd(orderTotal(order))} total />
          {order.fulfiller && <OrderSummaryRow label="Helper" value={order.fulfiller} />}
        </dl>
      </Card>
      <Card><Stepper steps={phase.steps} current={phase.step} /></Card>
      {isBackgroundWait(order.status) && (
        <BackgroundNotice>A helper buys your top-up and sends it. We check it before they are paid.</BackgroundNotice>
      )}

      {order.fulfiller_listed === false && (
        <Card className="grid gap-2">
          <StatusPill tone="warn">Unlisted fulfiller</StatusPill>
          <p className="text-sm text-muted">This helper is not in our public directory yet.</p>
        </Card>
      )}

      {error && <p className="text-sm text-danger">Connection problem. Trying again…</p>}
      <Link href="/shop" className="back-link">Back to Shop</Link>
    </Column>
    {contact}
    </>
  );
}
