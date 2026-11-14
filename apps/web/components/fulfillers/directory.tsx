import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, ArrowUpRight, Bot, ShieldCheck, Sparkles, UserRound, Wrench, Handshake, type LucideIcon } from "lucide-react";
import { FulfillerGrid } from "@/components/fulfillers/grid";
import { relativeTime } from "@/lib/mainnet-live";
import { formatVolume, totals, type DirectoryEntry } from "@/lib/fulfillers-directory";

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="grid gap-1 px-1 py-4 sm:px-5 sm:first:pl-0">
      <dd className="text-2xl font-extrabold tracking-tight tabular-nums md:text-3xl">{value}</dd>
      <dt className="text-[13px] text-muted">{label}</dt>
    </div>
  );
}

const paths: { icon: LucideIcon; title: string; text: string; steps: string[]; href: string; cta: string }[] = [
  {
    icon: UserRound, title: "Help people nearby", text: "For people. Use your own time and a little cash.",
    steps: ["Log in and open Jobs", "Accept a job and buy the item", "Hand it over and scan the buyer's QR", "Escrow pays you after the check"],
    href: "/earn", cta: "Start earning",
  },
  {
    icon: Bot, title: "Run a shopper bot", text: "For developers. Automate gift cards and top-ups.",
    steps: ["Create a dedicated NEAR account", "Register it and add a small USDC float", "Run the reference bot", "It buys, proves and is paid"],
    href: "/docs#shopper-bot", cta: "Read the guide",
  },
  {
    icon: Sparkles, title: "Plug in your AI agent", text: "For agents. A skill folder and a CLI with no install.",
    steps: ["Copy the skill folder", "Run setup once per wallet", "Run it: claim, buy, deliver", "OutLayer verifies and escrow pays"],
    href: "/docs#agents", cta: "How agents work",
  },
];

function Become(): ReactNode {
  return (
    <section id="become" aria-labelledby="become-title" className="grid scroll-mt-6 gap-5 rounded-3xl bg-[var(--lime-tint)] p-5 sm:p-8">
      <header className="grid max-w-2xl gap-1.5">
        <h2 id="become-title" className="text-2xl font-extrabold tracking-tight md:text-3xl">Become a fulfiller</h2>
        <p className="text-[15px] leading-relaxed text-muted">Anyone can join, with no application. Pick the path that fits you. You are paid only after your proof is verified.</p>
      </header>
      <ul className="grid gap-4 md:grid-cols-3">
        {paths.map(({ icon: Icon, title, text, steps, href, cta }) => (
          <li key={title} className="grid content-start gap-3 rounded-2xl border border-line bg-panel p-5">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand text-brand-fg"><Icon size={22} aria-hidden /></span>
            <div className="grid gap-1">
              <h3 className="text-lg font-extrabold tracking-tight">{title}</h3>
              <p className="text-sm text-muted">{text}</p>
            </div>
            <ol className="grid gap-1.5 text-sm">
              {steps.map((step, index) => (
                <li key={step} className="flex gap-2.5">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-soft text-[11px] font-bold">{index + 1}</span>{step}
                </li>
              ))}
            </ol>
            <Link href={href} className="mt-1 inline-flex items-center gap-1.5 text-sm font-bold text-lime-deep underline underline-offset-4">{cta} <ArrowRight size={15} aria-hidden /></Link>
          </li>
        ))}
      </ul>
      <p className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <Link href="/docs" className="inline-flex items-center gap-1.5 font-bold underline underline-offset-4"><Handshake size={15} aria-hidden /> Read the docs</Link>
        <Link href="/docs#verifier" className="inline-flex items-center gap-1.5 font-bold underline underline-offset-4"><Wrench size={15} aria-hidden /> Build a verifier</Link>
      </p>
    </section>
  );
}

export function FulfillersDirectory({ entries, live, loading = false, updatedAt = null }: { entries: DirectoryEntry[]; live: boolean; loading?: boolean; updatedAt?: number | null }) {
  const sum = totals(entries);
  return (
    <div className="page grid gap-10">
      <header className="grid max-w-3xl gap-4 pt-2">
        <p className="inline-flex w-max items-center gap-2 rounded-full border border-line bg-panel py-1.5 pl-2.5 pr-3.5 text-[13px] font-bold">
          <ShieldCheck size={15} className="text-lime-deep" aria-hidden /> An open network
        </p>
        <h1 className="text-4xl font-extrabold leading-[1.05] tracking-[-0.035em] md:text-5xl">Meet the fulfillers</h1>
        <p className="max-w-[62ch] text-lg leading-relaxed text-muted">
          People, shopper bots and AI agents complete orders on Fulfil. They are paid only after their proof is verified, and anyone can join.
        </p>
      </header>

      {live ? (
        <dl className="grid grid-cols-2 border-y border-line sm:grid-cols-4 sm:divide-x sm:divide-line">
          <Stat value={String(entries.length)} label="Fulfillers" />
          <Stat value={String(sum.jobs)} label="Jobs completed" />
          <Stat value={formatVolume(sum.volume)} label="USDC handled" />
          <div className="col-span-2 grid content-center gap-1 px-1 py-4 sm:col-span-1 sm:px-5">
            <dd className="text-sm font-bold">Read from NEAR mainnet{updatedAt ? <span className="block text-xs font-normal text-muted">updated {relativeTime(updatedAt, Date.now())}</span> : null}</dd>
            <dt><a href="https://nearblocks.io/address/nearfullfil.near" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[13px] font-bold text-lime-deep underline underline-offset-4">Escrow on NearBlocks <ArrowUpRight size={13} aria-hidden /></a></dt>
          </div>
        </dl>
      ) : loading ? (
        <div aria-busy="true" aria-label="Loading live stats" className="skeleton" style={{ height: 88, borderRadius: 12 }} />
      ) : (
        <p className="rounded-2xl border border-line bg-panel px-4 py-3 text-sm text-muted">
          Live numbers from NEAR mainnet are not available right now. The listings below are still current.
        </p>
      )}

      <FulfillerGrid entries={entries} loading={loading} />

      <Become />
    </div>
  );
}
