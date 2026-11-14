import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { StatusPill } from "@/components/ui/kit";
import { ExtLink, KindIcon } from "@/components/home/judges";
import { orderDetailHref } from "@/lib/activity";
import { TYPE_LABELS, type DirectoryEntry } from "@/lib/fulfillers-directory";
import {
  KIND_TITLES, NEARBLOCKS_ACCOUNT_URL, bestTx, formatDuration, nearblocksTx, relativeTime, shortAccountName, usdcFromUnits,
  type ChainOrder, type LiveSnapshot,
} from "@/lib/mainnet-live";

const DONE = new Set(["paid", "closed", "resolved"]);

function Row({ order, live, directory, now }: { order: ChainOrder; live: LiveSnapshot; directory: Map<string, DirectoryEntry>; now: number }) {
  const open = order.status === "funded";
  const who = order.fulfiller ? directory.get(order.fulfiller) : undefined;
  const tx = bestTx(live.txs[order.id]);
  const took = order.claimedAt !== null && order.paidAt !== null && order.status !== "resolved" ? order.paidAt - order.claimedAt : null;
  const when = open ? order.createdAt : order.paidAt ?? order.createdAt;
  return (
    <li className="relative grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 p-4 transition-colors hover:bg-soft/60 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
      <KindIcon kind={order.kind} />
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          {/* Stretched link: the whole row opens the order; the NearBlocks link sits above it. */}
          <Link href={orderDetailHref(order)} className="font-bold after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-brand">
            {KIND_TITLES[order.kind] ?? "Order"}
          </Link>
          {order.status === "resolved" && <StatusPill tone="neutral">Resolved by arbiter</StatusPill>}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted">
          {open ? (
            <span>Waiting for a fulfiller</span>
          ) : (
            <>
              <span title={order.fulfiller ?? ""}>Done by {order.fulfiller ? shortAccountName(order.fulfiller) : "unknown"}</span>
              {who && <StatusPill tone="neutral">{TYPE_LABELS[who.type]}</StatusPill>}
            </>
          )}
          {took !== null && <span>· took {formatDuration(took)}</span>}
        </p>
      </div>
      <div className="col-span-2 flex items-center justify-between gap-4 sm:col-span-1 sm:grid sm:justify-items-end sm:gap-0.5">
        <span className="grid sm:justify-items-end">
          <span className="font-extrabold tabular-nums text-good">+{usdcFromUnits(order.reward)} <span className="text-xs font-semibold text-muted">reward</span></span>
          <span className="text-xs tabular-nums text-muted">{usdcFromUnits(order.payAmount + order.reward)} order</span>
        </span>
        <span className="flex items-center gap-2 text-[13px] text-muted">
          {relativeTime(when, now)}
          <ExtLink href={tx ? nearblocksTx(tx.hash) : NEARBLOCKS_ACCOUNT_URL} className="relative z-10 text-[13px]">{tx ? "Transaction" : "Contract"}</ExtLink>
        </span>
      </div>
    </li>
  );
}

function List({ title, orders, empty, live, directory, now }: {
  title: string; orders: ChainOrder[]; empty: string; live: LiveSnapshot; directory: Map<string, DirectoryEntry>; now: number;
}) {
  return (
    <section className="grid gap-3" aria-label={title}>
      <h3 className="text-lg font-extrabold tracking-tight">{title}</h3>
      {orders.length ? (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-panel">
          {orders.map((order) => <Row key={order.id} order={order} live={live} directory={directory} now={now} />)}
        </ul>
      ) : (
        <p className="rounded-2xl border border-dashed border-line px-5 py-6 text-sm text-muted">{empty}</p>
      )}
    </section>
  );
}

/** Read-only jobs across the whole network from NEAR mainnet. Never mixes in mock data. */
export function NetworkJobs({ live, directory, loading = false }: { live: LiveSnapshot | null; directory: DirectoryEntry[]; loading?: boolean }) {
  const now = Date.now();
  const header = (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
      <div className="grid gap-1">
        <h2 className="text-2xl font-extrabold tracking-tight md:text-3xl">Jobs on the network</h2>
        <p className="text-[15px] text-muted">What fulfillers across all of Fulfil are doing, straight from the escrow contract.</p>
      </div>
      <p className="inline-flex items-center gap-2 text-[13px] font-semibold text-muted">
        <span className="h-2 w-2 rounded-full bg-lime-deep" aria-hidden /> NEAR mainnet · read-only
      </p>
    </header>
  );
  if (!live && loading) {
    return (
      <section className="grid gap-4 border-t border-line pt-10">
        {header}
        <div aria-busy="true" aria-label="Loading network jobs" className="grid gap-3">
          <div className="skeleton" style={{ height: 24, width: 220, borderRadius: 8 }} />
          <div className="skeleton" style={{ height: 200, borderRadius: 16 }} />
        </div>
      </section>
    );
  }
  if (!live) {
    return (
      <section className="grid gap-4 border-t border-line pt-10">
        {header}
        <p className="rounded-2xl border border-line bg-panel px-4 py-3 text-sm text-muted">
          Live numbers from NEAR mainnet are not available right now. <ExtLink href={NEARBLOCKS_ACCOUNT_URL}>See the escrow on NearBlocks</ExtLink>
        </p>
      </section>
    );
  }
  const map = new Map(directory.map((entry) => [entry.account, entry]));
  const openOrders = live.orders.filter((order) => order.status === "funded");
  const done = live.orders.filter((order) => DONE.has(order.status)).sort((a, b) => (b.paidAt ?? 0) - (a.paidAt ?? 0)).slice(0, 6);
  return (
    <section className="grid gap-5 border-t border-line pt-10">
      {header}
      <p className="text-sm font-semibold">
        {live.stats.paid} jobs paid · {usdcFromUnits(live.stats.usdcSettled)} paid out to fulfillers{live.fetchedAt ? <span className="font-normal text-muted"> · updated {relativeTime(live.fetchedAt, now)}</span> : null}
      </p>
      <List title="Open now" orders={openOrders} empty="No open jobs right now. New ones appear here." live={live} directory={map} now={now} />
      <List title="Recently completed" orders={done} empty="Nothing completed yet." live={live} directory={map} now={now} />
      <p className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
        <ExtLink href="https://nearblocks.io/address/nearfullfil.near?tab=txns">All escrow transactions on NearBlocks</ExtLink>
        <Link href="/fulfillers" className="inline-flex items-center gap-1 font-bold underline underline-offset-4">Meet the fulfillers <ArrowRight size={14} aria-hidden /></Link>
      </p>
    </section>
  );
}
