"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, ArrowUpRight, BadgeCheck, Bot, Coins, Globe, LayoutGrid, MapPin, QrCode, Sparkles, Star, UserRound, type LucideIcon } from "lucide-react";
import { StatusPill } from "@/components/ui/kit";
import { GROUP_LABELS, KIND_GROUPS, TYPE_LABELS, formatVolume, type DirectoryEntry, type FulfillerType, type KindGroup } from "@/lib/fulfillers-directory";

const groupIcons: Record<KindGroup, LucideIcon> = { nearby: MapPin, online: Globe, token: Coins, qr: QrCode };
const typeIcons: Record<FulfillerType, LucideIcon> = { human: UserRound, shopper_bot: Bot, ai_agent: Sparkles };
const groupCta: Record<KindGroup, { href: string; text: string }> = {
  nearby: { href: "/earn", text: "Be the first helper here" },
  online: { href: "/docs#shopper-bot", text: "Run a shopper bot" },
  token: { href: "/docs#agents", text: "Plug in your AI agent" },
  qr: { href: "/earn", text: "Be the first helper here" },
};
const nearblocks = (account: string) => `https://nearblocks.io/address/${account}`;

const filters: { id: "all" | KindGroup; label: string; icon: LucideIcon }[] = [
  { id: "all", label: "All", icon: LayoutGrid },
  { id: "nearby", label: "Nearby", icon: MapPin },
  { id: "online", label: "Online", icon: Globe },
  { id: "token", label: "Token", icon: Coins },
  { id: "qr", label: "Local QR", icon: QrCode },
];

function Stars({ rating, count }: { rating: number | null; count: number }) {
  if (rating === null) return <span className="whitespace-nowrap text-muted">No ratings</span>;
  return (
    <span className="inline-flex items-center gap-1 font-bold tabular-nums">
      <Star size={14} aria-hidden className="fill-[#e4a11b] text-[#e4a11b]" /> {rating.toFixed(1)}
      <span className="font-normal text-muted">({count})</span>
    </span>
  );
}

function FulfillerCard({ entry }: { entry: DirectoryEntry }) {
  const Icon = typeIcons[entry.type];
  const profile = entry.profile;
  const groups = [...new Set(entry.kinds.map((kind) => KIND_GROUPS[kind]).filter(Boolean))];
  return (
    <article className="grid content-start gap-4 rounded-2xl border border-line bg-panel p-5">
      <header className="flex items-start gap-3.5">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[var(--lime-tint)] text-lime-deep"><Icon size={24} aria-hidden /></span>
        <div className="grid min-w-0 gap-1.5">
          <div className="grid min-w-0 gap-0.5">
            <h3 className="truncate text-lg font-extrabold leading-tight tracking-tight">{entry.name?.trim() || entry.account}</h3>
            {entry.name?.trim() && (
              <a href={nearblocks(entry.account)} target="_blank" rel="noopener noreferrer" title={entry.account} className="truncate font-mono text-xs text-muted hover:text-ink hover:underline">
                {entry.account}
              </a>
            )}
          </div>
          <p className="flex flex-wrap items-center gap-1.5">
            <StatusPill tone="neutral">{TYPE_LABELS[entry.type]}</StatusPill>
            {entry.official && <StatusPill tone="good">Official</StatusPill>}
            {profile?.approved && <StatusPill tone="good">Approved</StatusPill>}
          </p>
        </div>
      </header>
      <p className="text-sm leading-relaxed text-muted">{entry.description}</p>
      <ul className="flex flex-wrap gap-1.5" aria-label="Orders they complete">
        {groups.map((group) => {
          const GroupIcon = groupIcons[group];
          return (
            <li key={group} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-2.5 py-1 text-xs font-semibold">
              <GroupIcon size={14} aria-hidden /> {GROUP_LABELS[group]}
            </li>
          );
        })}
      </ul>
      {profile ? (
        <dl className="grid grid-cols-3 divide-x divide-line border-y border-line text-sm">
          <div className="grid gap-0.5 py-3 pr-3"><dd className="flex min-h-7 items-center text-xl font-extrabold tabular-nums">{profile.jobsDone}</dd><dt className="text-xs text-muted">{profile.jobsDone === 1 ? "job done" : "jobs done"}</dt></div>
          <div className="grid gap-0.5 px-3 py-3"><dd className="flex min-h-7 items-center"><Stars rating={profile.rating} count={profile.starCount} /></dd><dt className="text-xs text-muted">Rating</dt></div>
          <div className="grid gap-0.5 py-3 pl-3"><dd className="flex min-h-7 items-center text-xl font-extrabold tabular-nums">{formatVolume(profile.volume)}</dd><dt className="text-xs text-muted">USDC volume</dt></div>
        </dl>
      ) : (
        <p className="border-y border-line py-3 text-sm text-muted">Stats are not available right now.</p>
      )}
      <footer className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[13px]">
        <a href={nearblocks(entry.account)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-bold text-lime-deep underline underline-offset-4">
          <BadgeCheck size={15} aria-hidden /> Verified on-chain <ArrowUpRight size={13} aria-hidden />
        </a>
        <span className="flex items-center gap-2 text-muted">
          {profile && profile.disputesWon > 0 && <span>{profile.disputesWon} dispute{profile.disputesWon === 1 ? "" : "s"} won</span>}
          {entry.listed && !entry.official && <span>Self-listed</span>}
        </span>
      </footer>
    </article>
  );
}


export function FulfillerGrid({ entries, loading }: { entries: DirectoryEntry[]; loading: boolean }) {
  const [filter, setFilter] = useState<"all" | KindGroup>("all");
  const shown = filter === "all" ? entries : entries.filter((entry) => entry.kinds.some((kind) => KIND_GROUPS[kind] === filter));
  const cta = filter === "all" ? null : groupCta[filter];
  return (
    <section aria-label="Fulfillers" className="grid gap-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by kind of order">
        {filters.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)}
            className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors ${filter === id ? "border-brand bg-brand text-brand-fg" : "border-line bg-panel text-ink hover:border-muted"}`}>
            <Icon size={16} aria-hidden /> {label}
          </button>
        ))}
      </div>
      {shown.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{shown.map((entry) => <FulfillerCard key={entry.account} entry={entry} />)}</div>
      ) : loading ? (
        <div aria-busy="true" className="skeleton" style={{ height: 120, borderRadius: 16 }} />
      ) : (
        <div className="grid justify-items-start gap-2 rounded-2xl border border-dashed border-line px-5 py-6">
          <p className="font-bold">Nobody is listed here yet.</p>
          <p className="max-w-[52ch] text-sm text-muted">
            Any registered helper can take {filter === "all" ? "orders" : `${GROUP_LABELS[filter as KindGroup].toLowerCase()} orders`}. There is room for you.
          </p>
          {cta && <Link href={cta.href} className="inline-flex items-center gap-1.5 text-sm font-bold text-lime-deep underline underline-offset-4">{cta.text} <ArrowRight size={15} aria-hidden /></Link>}
        </div>
      )}
    </section>
  );
}
