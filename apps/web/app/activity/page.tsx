"use client";

import Link from "next/link";
import { useState } from "react";
import { Coins, Globe, LayoutGrid, MapPin, QrCode, type LucideIcon } from "lucide-react";
import { activityDate, activityHref, activityKind, activityStatus, activityTimestamp, activityTitle, type ActivityKind, type ActivityRole } from "@/lib/activity";
import { formatUsd, orderTotal, v3 } from "@/lib/v3-client";
import { VietQrMark } from "@/components/ui/vietqr-mark";
import { Button, Card, EmptyState, StatusPill } from "@/components/ui/kit";
import { Column, ErrorBox, Loading } from "@/components/requester/common";
import { RequireAccount, useAuth } from "@/components/v3/auth";
import { usePolling } from "@/components/v3/common";
import { useMode } from "@/components/mode";

const filters: { label: string; kind?: ActivityKind; icon: LucideIcon }[] = [
  { label: "All", icon: LayoutGrid },
  { label: "Nearby", kind: "nearby", icon: MapPin },
  { label: "Online", kind: "online", icon: Globe },
  { label: "Token", kind: "memecoin", icon: Coins },
  { label: "Local QR", kind: "local_qr", icon: QrCode },
];
const icons: Record<ActivityKind, LucideIcon> = {
  nearby: MapPin,
  online: Globe,
  memecoin: Coins,
  local_qr: QrCode,
};

function ActivityInner() {
  const { session } = useAuth();
  const { mode } = useMode();
  const [role, setRole] = useState<ActivityRole>("buying");
  const [filter, setFilter] = useState<ActivityKind | undefined>();
  const account = session?.account_id ?? "";
  const { data, error, reload } = usePolling(() => v3.orders({ account, limit: 100 }), 10_000);
  const all = data?.orders ?? [];
  const earning = all.filter((order) => order.fulfiller === account);
  const showEarning = earning.length > 0 || mode === "earn";
  const selectedRole = showEarning ? role : "buying";
  const orders = (selectedRole === "earning" ? earning : all.filter((order) => order.buyer === account))
    .filter((order) => !filter || activityKind(order) === filter)
    .sort((a, b) => (activityTimestamp(b) ?? 0) - (activityTimestamp(a) ?? 0));
  const now = Date.now();

  return (
    <Column>
      <h1 className="h1-title">Activity</h1>
      {showEarning && (
        <div className="flex gap-2" role="tablist" aria-label="Order role">
          {(["buying", "earning"] as const).map((tab) => (
            <button key={tab} type="button" role="tab" aria-selected={selectedRole === tab}
              onClick={() => setRole(tab)}
              className={`min-h-11 rounded-full px-5 text-sm font-bold transition-colors ${selectedRole === tab ? "bg-brand text-brand-fg" : "bg-soft text-ink hover:bg-line"}`}>
              {tab === "buying" ? "Buying" : "Earning"}
            </button>
          ))}
        </div>
      )}
      <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Filter orders">
        {filters.map(({ label, kind, icon: Icon }) => (
          <button key={label} type="button" aria-pressed={filter === kind} onClick={() => setFilter(kind)}
            className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-sm font-semibold transition-colors ${filter === kind ? "border-brand bg-brand text-brand-fg" : "border-line bg-panel text-ink hover:border-muted"}`}>
            <Icon size={16} aria-hidden /> {label}
          </button>
        ))}
      </div>
      {error && !data ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : !data ? (
        <Loading />
      ) : orders.length === 0 ? selectedRole === "earning" ? (
        <EmptyState title="No earning orders yet" hint="Find a job and it will appear here."
          action={<Button href="/earn">Find jobs</Button>} />
      ) : filter ? (
        <EmptyState title="No orders here yet" hint="Try another filter or view all orders."
          action={<Button variant="secondary" onClick={() => setFilter(undefined)}>View all</Button>} />
      ) : (
        <EmptyState title="No orders yet" hint="Choose what you want to buy."
          action={<div className="flex flex-wrap justify-center gap-2">
            <Button href="/shop/in-person">Buy anything nearby</Button>
            <Button href="/shop" variant="secondary">Buy online</Button>
            <Button href="/shop/token" variant="secondary">Buy any token</Button>
          </div>} />
      ) : (
        <ul className="grid gap-3">
          {orders.map((order) => {
            const kind = activityKind(order);
            const Icon = icons[kind];
            const date = activityDate(order, now);
            const status = activityStatus(order, selectedRole);
            return (
              <li key={order.id}>
                <Link href={activityHref(order, selectedRole)} className="block rounded-2xl focus-visible:outline-2 focus-visible:outline-brand">
                  <Card className="flex items-center gap-3 p-4 transition-[box-shadow,border-color] duration-200 hover:border-muted hover:shadow-card">
                    {kind === "local_qr" ? <VietQrMark width={64} /> : <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--lime-tint)] text-lime-deep"><Icon size={22} aria-hidden="true" /></span>}
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 break-words font-bold leading-snug">{activityTitle(order)}</span>
                      {date && <span className="block text-sm text-muted" title={date.absolute}>{date.relative}</span>}
                      {kind === "local_qr" && order.amount_vnd > 0 &&
                        <span className="block text-sm text-muted">{new Intl.NumberFormat("vi-VN").format(order.amount_vnd)} ₫</span>}
                    </span>
                    <span className="flex max-w-[45%] min-w-0 flex-col items-end gap-1 text-right [&>span]:max-w-full [&>span]:text-right">
                      <strong className="tabular-nums">{formatUsd(orderTotal(order))}</strong>
                      <StatusPill tone={status.tone}>{status.label}</StatusPill>
                    </span>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Column>
  );
}

export default function ActivityPage() {
  return <RequireAccount><ActivityInner /></RequireAccount>;
}
