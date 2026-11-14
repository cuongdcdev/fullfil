/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight, ArrowUpRight, Bot, Check, Coins, Gavel, Globe, Handshake, Lock, MapPin, Network, ShieldCheck, Smartphone, Undo2, UserRound, Wrench, Wallet, Cpu,
  type LucideIcon,
} from "lucide-react";
import { Reveal } from "@/components/ui/reveal";
import { StatusPill } from "@/components/ui/kit";
import { VietQrMark } from "@/components/ui/vietqr-mark";
import { orderDetailHref } from "@/lib/activity";
import { ProofTabs } from "@/components/home/proof-tabs";
import { HowProtected } from "@/components/ui/protection";
import { attacks, earlierRuns } from "@/lib/mainnet-evidence";
import {
  KIND_TITLES, NEARBLOCKS_ACCOUNT_URL, NEARBLOCKS_TXNS_URL, bestTx, formatDuration, nearblocksTx, relativeTime,
  shortAccountName, usdcFromUnits, type ChainOrder, type LiveSnapshot,
} from "@/lib/mainnet-live";

const external = { target: "_blank", rel: "noopener noreferrer" } as const;
const kindIcons: Record<string, LucideIcon> = {
  cryptorefills_topup: Smartphone, cryptorefills_code: Globe, in_person: MapPin, token_buy: Coins,
};

export function KindIcon({ kind }: { kind: string }) {
  const Icon = kindIcons[kind] ?? Coins;
  return (
    <span className="flex w-14 shrink-0 items-center">
      {kind === "bank_transfer" ? (
        <VietQrMark width={56} />
      ) : (
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--lime-tint)] text-lime-deep">
          <Icon size={20} aria-hidden />
        </span>
      )}
    </span>
  );
}

function Section({ id, title, lead, children, aside }: { id?: string; title: string; lead?: ReactNode; children: ReactNode; aside?: ReactNode }) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-title` : undefined} className="grid scroll-mt-6 gap-5 border-t border-line pt-10">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="grid max-w-2xl gap-1.5">
          <h2 id={id ? `${id}-title` : undefined} className="text-2xl font-extrabold tracking-tight md:text-3xl">{title}</h2>
          {lead && <p className="text-[15px] leading-relaxed text-muted">{lead}</p>}
        </div>
        {aside}
      </header>
      {children}
    </section>
  );
}

export const ExtLink = ({ href, children, className = "" }: { href: string; children: ReactNode; className?: string }) => (
  <a href={href} {...external} className={`inline-flex items-center gap-1 font-bold text-lime-deep underline underline-offset-4 ${className}`}>
    {children} <ArrowUpRight size={14} aria-hidden />
  </a>
);

export function statusView(order: ChainOrder): { label: string; tone: "good" | "bad" | "warn" | "neutral" } {
  switch (order.status) {
    case "paid": case "closed": return { label: "Paid", tone: "good" };
    case "resolved": return { label: "Resolved by arbiter", tone: "neutral" };
    case "funded": return { label: "Waiting for a helper", tone: "warn" };
    case "cancelled": case "expired": return { label: "Refunded", tone: "bad" };
    case "disputed": return { label: "Disputed", tone: "bad" };
    default: return { label: "In progress", tone: "warn" };
  }
}

/* ------------------------------------------------------------ 1. live data */
function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="grid gap-1 px-1 py-4 sm:px-5 sm:first:pl-0">
      <dd className="text-2xl font-extrabold tracking-tight tabular-nums md:text-3xl">{value}</dd>
      <dt className="text-[13px] text-muted">{label}</dt>
    </div>
  );
}

function LiveSection({ live, now }: { live: LiveSnapshot; now: number }) {
  const { stats, orders, txs } = live;
  return (
    <Section id="live" title="Live on NEAR mainnet"
      lead={<>Read straight from the escrow contract <code className="rounded bg-soft px-1.5 py-0.5 text-[13px]">nearfullfil.near</code> on NEAR mainnet. Check any row on NearBlocks.</>}
      aside={
        <p className="flex items-center gap-2 text-[13px] font-semibold text-muted">
          <span className="relative flex h-2 w-2" aria-hidden>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--lime)] opacity-70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-lime-deep" />
          </span>
          NEAR mainnet{live.fetchedAt ? ` · updated ${relativeTime(live.fetchedAt, now)}` : ""}
        </p>
      }>
      <dl className="grid grid-cols-2 border-y border-line sm:grid-cols-5 sm:divide-x sm:divide-line">
        <Stat value={String(stats.ordersOnChain)} label="Orders on-chain" />
        <Stat value={String(stats.paid)} label="Paid out" />
        <Stat value={usdcFromUnits(stats.usdcSettled)} label="USDC settled" />
        <Stat value={String(stats.profiles)} label="Fulfiller profiles" />
        <Stat value={formatDuration(stats.medianClaimToPaidMs)} label="Median claim to paid" />
      </dl>
      <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-panel">
        {orders.slice(0, 7).map((order) => {
          const status = statusView(order);
          const tx = bestTx(txs[order.id]);
          const when = order.paidAt ?? order.claimedAt ?? order.createdAt;
          return (
            <li key={order.id} className="relative grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 p-4 transition-colors hover:bg-soft/60 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
              <KindIcon kind={order.kind} />
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  {/* Stretched link: the whole row opens the order; the NearBlocks link sits above it. */}
                  <Link href={orderDetailHref(order)} className="font-bold after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:rounded-2xl focus-visible:after:outline-2 focus-visible:after:outline-brand">
                    {KIND_TITLES[order.kind] ?? "Order"}
                  </Link>
                  <StatusPill tone={status.tone}>{status.label}</StatusPill>
                </p>
                <p className="mt-1 truncate text-[13px] text-muted" title={`${order.buyer} → ${order.fulfiller ?? "waiting"}`}>
                  <span className="mono">{order.id}</span> · {shortAccountName(order.buyer)} → {order.fulfiller ? shortAccountName(order.fulfiller) : "waiting for a helper"}
                </p>
              </div>
              <div className="col-span-2 flex items-center justify-between gap-4 sm:col-span-1 sm:grid sm:justify-items-end sm:gap-0.5">
                <span className="font-extrabold tabular-nums">{usdcFromUnits(order.payAmount + order.reward)}</span>
                <span className="flex items-center gap-2 text-[13px] text-muted">
                  {relativeTime(when, now)}
                  <ExtLink href={tx ? nearblocksTx(tx.hash) : NEARBLOCKS_ACCOUNT_URL} className="relative z-10 text-[13px]">{tx ? "Transaction" : "Contract"}</ExtLink>
                </span>
              </div>
            </li>
          );
        })}
      </ul>
      <p><ExtLink href={NEARBLOCKS_TXNS_URL}>All escrow transactions on NearBlocks</ExtLink></p>
    </Section>
  );
}

/* -------------------------------------------- 1b + 2. proof on mainnet (tabs) */
function RunsList() {
  return (
    <ol className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-panel">
      {earlierRuns.map((run) => (
        <li key={run.id} className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
          <KindIcon kind={run.kind} />
          <div className="min-w-0">
            <p className="font-bold leading-snug">{run.title}</p>
            <p className="mt-1 text-[13px] leading-relaxed text-muted">{run.detail}</p>
          </div>
          <div className="col-span-2 flex items-center justify-between gap-3 sm:col-span-1 sm:grid sm:justify-items-end sm:gap-0.5">
            <span className="mono text-xs text-muted">{run.id}</span>
            <ExtLink href={run.hash ? nearblocksTx(run.hash) : NEARBLOCKS_ACCOUNT_URL} className="text-[13px]">
              {run.hash ? run.hashLabel ?? "Transaction" : "Escrow contract"}
            </ExtLink>
          </div>
        </li>
      ))}
    </ol>
  );
}

function AttacksList() {
  return (
    <>
      <p className="text-sm leading-relaxed text-muted">
        We tried to cheat our own escrow with real transactions. Each attempt was stopped by the contract or the verifier, not by hand.
      </p>
      <ul className="grid gap-x-10 gap-y-6 md:grid-cols-2">
        {attacks.map((item) => (
          <li key={item.title} className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3">
            <span className="mt-0.5 grid h-7 w-7 place-items-center rounded-full bg-[var(--ok-tint)] text-[var(--good)]">
              {item.result.startsWith("refunded") ? <Undo2 size={15} aria-hidden /> : <ShieldCheck size={16} aria-hidden />}
            </span>
            <div className="grid gap-1.5">
              <p className="font-bold leading-snug">{item.title}</p>
              <p className="text-sm leading-relaxed text-muted">{item.plain}</p>
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <code className="rounded-md bg-soft px-2 py-0.5 text-xs font-semibold">{item.result}</code>
                {item.hash && <ExtLink href={nearblocksTx(item.hash)} className="text-[13px]">Transaction</ExtLink>}
              </p>
            </div>
          </li>
        ))}
      </ul>
      <p className="text-xs leading-relaxed text-muted">On NearBlocks the transaction itself lands; the escrow call inside it is what gets rejected.</p>
    </>
  );
}

function ProofSection({ fallback }: { fallback: boolean }) {
  return (
    <Section id={fallback ? "live" : "proof"} title="Proof on mainnet"
      lead={fallback
        ? "Live numbers are not available right now. These are real runs and real attacks you can check yourself on NearBlocks."
        : "Older runs from earlier contract versions, and the attacks we tried against the live escrow. Every link goes to NearBlocks."}>
      <ProofTabs tabs={[
        { id: "runs", label: `Earlier runs (${earlierRuns.length})`, panel: <RunsList /> },
        { id: "attacks", label: `Attacks we tried (${attacks.length})`, panel: <AttacksList /> },
      ]} />
      {fallback && <p><ExtLink href={NEARBLOCKS_TXNS_URL}>All escrow transactions on NearBlocks</ExtLink></p>}
    </Section>
  );
}

/* --------------------------------------------------------------- 3. why */
const usps: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Lock, title: "Money moves only on proof", text: "Your USDC sits in NEAR escrow until the job is proven. If nobody delivers by the deadline, you get a refund." },
  { icon: ShieldCheck, title: "Verified in a TEE", text: "OutLayer workers check the proof inside a secure enclave. Nobody checks by hand and nobody marks their own homework." },
  { icon: Wallet, title: "Pay with any coin, no gas", text: "200+ tokens through NEAR Intents. You sign a message (NEP-413) and the OutLayer gasless relayer covers the network fee." },
  { icon: Network, title: "An open network", text: "Humans, shopper bots and AI agents can all claim jobs. Anyone can add a verifier, a QR payment method or an agent." },
];
function Why() {
  return (
    <Section id="why" title="Why Fulfil">
      <ul className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
        {usps.map(({ icon: Icon, title, text }) => (
          <li key={title} className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand text-brand-fg"><Icon size={22} aria-hidden /></span>
            <div className="grid gap-1">
              <h3 className="text-lg font-extrabold tracking-tight">{title}</h3>
              <p className="text-[15px] leading-relaxed text-muted">{text}</p>
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/* ---------------------------------------------------------- 4. how it works */
const flow: { icon: LucideIcon; title: string; sub: string; tone?: "money" | "proof" }[] = [
  { icon: UserRound, title: "Buyer", sub: "Pays in USDC" },
  { icon: Lock, title: "NEAR escrow", sub: "USDC is locked", tone: "money" },
  { icon: Handshake, title: "Helper, bot or AI agent", sub: "Does the job with their own money" },
  { icon: Check, title: "Proof", sub: "Email, receipt or chain transfer" },
  { icon: Cpu, title: "OutLayer TEE verifier", sub: "Checks it in a secure enclave", tone: "proof" },
  { icon: Coins, title: "Payout", sub: "Escrow pays the doer", tone: "money" },
];
function HowItWorks() {
  return (
    <Section id="how-it-works" title="How it works">
      <ol className="grid gap-0 md:grid-cols-6 md:items-start">
        {flow.map(({ icon: Icon, title, sub, tone }, index) => (
          <li key={title} className="relative grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 pb-6 last:pb-0 md:grid-cols-1 md:justify-items-center md:gap-y-3 md:pb-0 md:pr-0 md:text-center">
            {index < flow.length - 1 && (
              <>
                <span aria-hidden className="absolute bottom-0 left-[23px] top-12 w-0.5 bg-line md:hidden" />
                <span aria-hidden className="absolute left-[calc(50%+34px)] right-[calc(-50%+34px)] top-6 hidden h-0.5 bg-line md:block" />
              </>
            )}
            <span className={`relative z-10 grid h-12 w-12 place-items-center rounded-2xl border-2 ${tone === "money" ? "border-brand bg-brand text-brand-fg" : tone === "proof" ? "border-lime-deep bg-[var(--lime-tint)] text-lime-deep" : "border-line bg-panel"}`}>
              <Icon size={22} aria-hidden />
            </span>
            <span className="grid gap-0.5 md:px-2">
              <strong className="text-[15px] leading-snug">{title}</strong>
              <span className="text-[13px] leading-snug text-muted">{sub}</span>
            </span>
          </li>
        ))}
      </ol>
      <p className="flex items-start gap-2.5 rounded-2xl bg-[var(--warn)] px-4 py-3 text-sm font-semibold text-[var(--warn-fg)]">
        <Undo2 size={18} className="mt-0.5 shrink-0" aria-hidden />
        Not done by the deadline? Escrow refunds the buyer. Anyone can trigger the refund.
      </p>
      <HowProtected className="!border-0 !bg-transparent !p-0 [&>h2]:hidden" />
      <p className="text-sm leading-relaxed text-muted">
        Disputes are rare by design: proofs are checked by code and a TEE, not by people. The few that remain go to a human arbiter.
      </p>
    </Section>
  );
}

/* ------------------------------------------------------------ 5. built with */
const stack: { name: string; role: string; logo: string }[] = [
  { name: "NEAR Protocol", role: "The escrow smart contract, written in Rust", logo: "/brand/near.png" },
  { name: "NEAR Intents + 1Click", role: "Funding, swaps and payouts across chains", logo: "/brand/near-intents-app.png" },
  { name: "NEAR OutLayer", role: "TEE verifiers and the gasless relayer", logo: "/brand/outlayer-badge.png" },
  { name: "HOT · near-connect", role: "Wallet login", logo: "/brand/hot.png" },
  { name: "Cryptorefills", role: "Gift cards and top-ups", logo: "/brand/cryptorefills.png" },
  { name: "Intear", role: "Token routing for swaps", logo: "/brand/intear.png" },
  { name: "Rhea Finance", role: "DEX liquidity behind token swaps", logo: "/brand/rhea.png" },
  { name: "NEAR AI", role: "AI Court research preview for disputes", logo: "/brand/near-ai.svg" },
  { name: "Shitzu", role: "For vibes. Our agent bought it on mainnet", logo: "/brand/shitzu.png" },
];
function BuiltWith() {
  return (
    <Section id="built-with" title="Built with">
      <ul className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
        {stack.map((item) => (
          <li key={item.name} className="flex items-center gap-3.5">
            <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-black/10 bg-white">
              <img src={item.logo} alt="" width={48} height={48} className="h-full w-full object-contain" />
            </span>
            <span className="grid gap-0.5">
              <strong className="leading-snug">{item.name}</strong>
              <span className="text-[13px] leading-snug text-muted">{item.role}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="flex items-start gap-3 rounded-2xl border border-line bg-panel p-4 text-sm leading-relaxed">
        <Gavel size={18} className="mt-0.5 shrink-0 text-lime-deep" aria-hidden />
        <span>
          <strong>NEAR AI: AI Court research preview.</strong> Three AI jurors draft a recommendation; a human arbiter decides.{" "}
          <Link href="/court" className="font-bold text-lime-deep underline underline-offset-4">Try the demo ›</Link>{" "}
          <Link href="/docs#ai-court" className="font-bold text-lime-deep underline underline-offset-4">How it works ›</Link>
        </span>
      </p>
    </Section>
  );
}

/* ------------------------------------------------------------ 7. builders */
const builders: { icon: LucideIcon; title: string; text: string; href: string; cta: string }[] = [
  { icon: Wrench, title: "Build a verifier", text: "Each bank or payment method is one OutLayer worker. Add yours without a contract upgrade.", href: "/docs#verifier", cta: "Read the docs" },
  { icon: Handshake, title: "Become a fulfiller", text: "Help people in your city, or run a shopper bot, and earn the reward on every job.", href: "/earn", cta: "Start earning" },
  { icon: Bot, title: "Plug in your AI agent", text: "A skill folder plus a zero-install CLI lets an agent claim, deliver and prove a token purchase.", href: "/docs#agents", cta: "How agents work" },
];
function Builders() {
  return (
    <Section id="builders" title="For builders" lead="Fulfil is a network, not a closed shop. Add a country, a bank or an agent.">
      <ul className="grid gap-4 md:grid-cols-3">
        {builders.map(({ icon: Icon, title, text, href, cta }) => (
          <li key={title}>
            <Link href={href} className="group grid h-full content-start gap-2 rounded-2xl border border-line bg-panel p-5 transition-[transform,box-shadow,border-color] duration-300 [transition-timing-function:var(--ease-out)] hover:-translate-y-0.5 hover:border-brand hover:shadow-lift">
              <Icon size={22} aria-hidden className="text-lime-deep" />
              <h3 className="text-lg font-extrabold tracking-tight">{title}</h3>
              <p className="text-sm leading-relaxed text-muted">{text}</p>
              <span className="mt-1 inline-flex items-center gap-1.5 text-sm font-bold">{cta} <ArrowRight size={15} aria-hidden className="transition-transform duration-300 group-hover:translate-x-1" /></span>
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function FinalCta() {
  return (
    <section className="grid justify-items-center gap-4 rounded-3xl bg-[var(--lime-tint)] px-6 py-10 text-center">
      <h2 className="max-w-[22ch] text-2xl font-extrabold tracking-tight md:text-3xl">See it in two minutes</h2>
      <p className="max-w-[48ch] text-[15px] text-muted">Step through all four use cases, from the buyer&apos;s side and the helper&apos;s side. No wallet needed.</p>
      <Link href="/demo" className="button lime big">Try the 2-minute guided demo <ArrowRight size={18} aria-hidden /></Link>
    </section>
  );
}

function LiveSkeleton() {
  return (
    <Section id="live" title="Live on NEAR mainnet" lead="Reading the escrow contract on NEAR mainnet. This fills in within a few seconds.">
      <div aria-busy="true" aria-label="Loading live numbers" className="grid gap-4">
        <div className="skeleton" style={{ height: 84, borderRadius: 12 }} />
        <div className="skeleton" style={{ height: 232, borderRadius: 16 }} />
      </div>
    </Section>
  );
}

export function Judges({ live, loading = false }: { live: LiveSnapshot | null; loading?: boolean }) {
  const now = Date.now();
  return (
    <div className="grid gap-12">
      <Reveal>{live ? <LiveSection live={live} now={now} /> : loading ? <LiveSkeleton /> : null}</Reveal>
      <Reveal><ProofSection fallback={!live && !loading} /></Reveal>
      <Reveal><Why /></Reveal>
      <Reveal><HowItWorks /></Reveal>
      <Reveal><BuiltWith /></Reveal>
      <Reveal><Builders /></Reveal>
      <Reveal><FinalCta /></Reveal>
    </div>
  );
}
