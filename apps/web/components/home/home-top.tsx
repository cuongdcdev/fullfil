"use client";

import Link from "next/link";
import { ArrowRight, MapPin, Globe, Coins, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/kit";
import { VietQrMark } from "@/components/ui/vietqr-mark";
import { Reveal } from "@/components/ui/reveal";
import { AddMoneyCta } from "@/components/ui/protection";

const coins = [
  { name: "ZEC", icon: "/coins/zcash.png" },
  { name: "NEAR", icon: "/coins/near.jpg" },
  { name: "BTC", icon: "/coins/bitcoin.png" },
  { name: "SHITZU", icon: "/coins/shitzu.jpg" },
  { name: "BLACKDRAGON", icon: "/coins/black-dragon.png" },
  { name: "PEPE", icon: "/coins/pepe.jpg" },
];

/* eslint-disable-next-line @next/next/no-img-element */
const TokenChip = ({ name, icon, i }: { name: string; icon?: string; i: number }) => (
  <span style={{ "--i": i } as React.CSSProperties} className="token-chip mx-0.5 inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-line bg-panel py-0.5 pl-1 pr-2 align-baseline text-[13px] font-bold text-ink">
    {icon ? <img src={icon} alt="" width={16} height={16} className="h-4 w-4 rounded-full" /> : null}
    {name}
  </span>
);

type Tile = { label: string; hint: string; doer: string; icon: LucideIcon; href: string };
const tiles: Tile[] = [
  { label: "Buy anything nearby", hint: "A local buys it and hands it to you; you confirm with a QR receipt.", doer: "Done by a local helper", icon: MapPin, href: "/shop/in-person" },
  { label: "Buy online", hint: "Gift cards, phone top-ups, eSIMs — delivered in minutes.", doer: "Done by a shopper bot", icon: Globe, href: "/shop" },
  { label: "Buy any token", hint: "An AI agent buys any NEAR token for you; OutLayer verifies the transfer.", doer: "Done by an AI agent", icon: Coins, href: "/shop/token" },
];

export function HomeTop() {
  return (
    <>
      <section className="relative isolate grid max-w-3xl gap-4 pt-2">
        <div aria-hidden className="pointer-events-none absolute -top-16 left-0 -z-10 h-64 w-64 rounded-full bg-[var(--lime)] opacity-25 blur-3xl dark:opacity-[0.12] md:h-80 md:w-80" />
        <Link
          href="/docs/become-a-fulfiller"
          className="group inline-flex w-max max-w-full items-center gap-2 rounded-full border border-line bg-panel py-1.5 pl-2.5 pr-3 text-[13px] font-bold transition-[border-color,box-shadow] duration-200 hover:border-brand hover:shadow-[0_6px_18px_-8px_var(--lime)]"
        >
          <span className="relative flex h-2 w-2" aria-hidden>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--lime)] opacity-70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-lime-deep" />
          </span>
          <span>
            <span className="sm:hidden">Open infra</span>
            <span className="hidden sm:inline">Open infrastructure</span> · Become a fulfiller &amp; earn
          </span>
          <ArrowRight size={14} aria-hidden className="shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none" />
        </Link>
        <h1 className="text-4xl font-extrabold leading-[1.05] tracking-[-0.035em] md:text-6xl">
          <span className="hero-rise inline-block">Spend crypto in</span>{" "}
          <span className="hero-rise hero-rise-2 inline-block">
            the <span className="hero-accent">real world</span>.
          </span>
        </h1>
        <p className="max-w-[62ch] text-lg leading-relaxed text-muted">
          Pay in USDC. A verified local helper (<strong className="text-ink">fulfiller</strong>) or an AI agent does the real-world part.{" "}
          <strong className="text-ink">Fullfil (an escrow contract on NEAR)</strong> holds your money safely, only pays out after <strong className="text-ink">OutLayer</strong> (an independent
          verifier running in a secure enclave) checks the proof.
        </p>
        <p className="max-w-[62ch] text-lg leading-relaxed text-muted">
          Pay with 200+ tokens across 37 chains — your favourite coins like{" "}
          {coins.map(({ name, icon }, i) => (
            <span key={name}>
              <TokenChip name={name} icon={icon} i={i} />{" "}
            </span>
          ))}
          — powered by <strong className="text-ink">NEAR Intents</strong>.{" "}
          <a href="#how-it-works" className="whitespace-nowrap text-sm font-bold text-lime-deep underline underline-offset-4">How it&apos;s verified</a>
        </p>
        <p className="text-sm text-muted">
          Live on NEAR mainnet · Open source — anyone can add a verifier for a new kind of job.{" "}
          <Link href="/docs/verifier" className="font-bold text-lime-deep underline underline-offset-4">Build a verifier ›</Link>
        </p>
      </section>

      <AddMoneyCta />

      <section className="grid gap-4 md:grid-cols-3" aria-label="What do you need?">
        {tiles.map(({ label, hint, doer, icon: Icon, href }, i) => (
          <Reveal key={label} delay={i * 90} className="h-full">
          <Link href={href} className="group block h-full rounded-2xl">
            <Card className="relative grid h-full content-start gap-3 p-6 transition-[transform,box-shadow,border-color] duration-300 [transition-timing-function:var(--ease-out)] group-hover:-translate-y-1 group-hover:border-brand group-hover:shadow-[0_14px_34px_-14px_var(--lime)]">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand text-brand-fg">
                <Icon size={28} aria-hidden />
              </span>
              <span className="mt-2 text-xl font-extrabold tracking-tight">{label}</span>
              <span className="text-[15px] leading-relaxed text-muted">{hint}</span>
              <span className="mt-2 flex items-center justify-between border-t border-line pt-4 text-sm font-semibold">
                <span className="text-muted">{doer}</span>
                <ArrowRight size={18} aria-hidden className="transition-transform duration-300 group-hover:translate-x-1" />
              </span>
            </Card>
          </Link>
          </Reveal>
        ))}
      </section>

      <Reveal>
      <section className="grid gap-3" aria-labelledby="local-payments">
        <h2 id="local-payments" className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
          Local payments <span className="badge lime">Beta</span>
        </h2>
        <Link href="/pay" className="group block rounded-2xl sm:max-w-lg">
          <Card className="flex items-center gap-4 transition-[box-shadow,border-color] duration-300 group-hover:border-brand group-hover:shadow-lift">
            <VietQrMark width={96} />
            <span className="min-w-0 flex-1">
              <strong className="block text-lg font-extrabold">Pay a QR</strong>
              <span className="text-sm text-muted">VietQR is Vietnam's national QR standard. Every bank supports it, so it works at shops all over Vietnam. Scan one and a local pays it for you.</span>
            </span>
            <ArrowRight size={18} aria-hidden className="shrink-0 text-muted transition-transform duration-300 group-hover:translate-x-1" />
          </Card>
        </Link>
        <p className="text-sm text-muted">
          Built on an open verifier model — add your country&apos;s QR payment method.{" "}
          <Link href="/docs#verifier" className="font-bold text-lime-deep underline underline-offset-4">Build a verifier ›</Link>
        </p>
      </section>
      </Reveal>
    </>
  );
}
