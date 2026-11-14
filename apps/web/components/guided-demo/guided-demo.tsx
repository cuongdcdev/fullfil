"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, Coins, Globe, Lock, MapPin, Pause, Play, ShieldCheck, Undo2, Check, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/kit";
import { VietQrMark } from "@/components/ui/vietqr-mark";
import { Phone } from "./parts";
import { stories, type Escrow } from "./stories";

const icons: Record<string, LucideIcon | null> = { nearby: MapPin, online: Globe, token: Coins, qr: null };

function EscrowPill({ escrow }: { escrow: Escrow }) {
  const view = {
    none: { icon: Lock, label: "Escrow is empty", sub: "No money has moved yet", tone: "border-line bg-panel text-muted" },
    locked: { icon: Lock, label: `${escrow.amount} locked`, sub: "Held in NEAR escrow", tone: "border-brand bg-[var(--lime-tint)] text-ink" },
    paid: { icon: Check, label: `${escrow.amount} paid out`, sub: "Released after proof", tone: "border-[var(--ok-line)] bg-[var(--ok-tint)] text-[var(--good)]" },
    refunded: { icon: Undo2, label: `${escrow.amount} refunded`, sub: "Back to the buyer", tone: "border-[var(--warn-line)] bg-[var(--warn)] text-[var(--warn-fg)]" },
  }[escrow.state];
  const Icon = view.icon;
  return (
    <div className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 transition-colors duration-500 lg:flex-col lg:px-3 lg:py-4 lg:text-center ${view.tone}`} role="status" aria-live="polite">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-paper"><Icon size={20} aria-hidden /></span>
      <span className="grid gap-0.5 leading-tight">
        <span className="text-[11px] font-bold opacity-80">NEAR escrow</span>
        <span className="text-base font-extrabold tabular-nums">{view.label}</span>
        <span className="text-xs opacity-80">{view.sub}</span>
      </span>
    </div>
  );
}

export function GuidedDemo() {
  const [tab, setTab] = useState(0);
  const [step, setStep] = useState(0);
  const [auto, setAuto] = useState(false);
  const [side, setSide] = useState<"buyer" | "other">("buyer");
  const story = stories[tab];
  const current = story.steps[step];
  const last = step === story.steps.length - 1;
  const panel = useRef<HTMLDivElement>(null);

  // Follow the action on small screens, where only one phone shows at a time.
  useEffect(() => setSide(current.actor), [current]);

  useEffect(() => {
    if (!auto) return;
    if (last) {
      setAuto(false);
      return;
    }
    const timer = window.setTimeout(() => setStep((value) => value + 1), 3000);
    return () => window.clearTimeout(timer);
  }, [auto, step, last]);

  const go = (next: number) => setStep(Math.max(0, Math.min(story.steps.length - 1, next)));
  const choose = (index: number) => {
    setTab(index);
    setStep(0);
    setAuto(false);
  };
  const onKey = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowRight") { setAuto(false); go(step + 1); }
    if (event.key === "ArrowLeft") { setAuto(false); go(step - 1); }
  };
  const buyerActive = current.actor === "buyer";

  return (
    <div className="grid gap-6" onKeyDown={onKey}>
      <div role="tablist" aria-label="Use cases" className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
        {stories.map((item, index) => {
          const Icon = icons[item.id];
          const on = index === tab;
          return (
            <button key={item.id} type="button" role="tab" aria-selected={on} onClick={() => choose(index)}
              className={`flex min-h-12 shrink-0 items-center gap-2.5 rounded-full border px-4 text-sm font-bold transition-colors ${on ? "border-brand bg-brand text-brand-fg" : "border-line bg-panel hover:border-muted"}`}>
              {Icon ? <Icon size={18} aria-hidden /> : <VietQrMark width={44} />}
              {item.tab}
            </button>
          );
        })}
      </div>

      <div className="grid gap-3 sm:hidden" role="group" aria-label="Which screen">
        <div className="grid grid-cols-2 gap-1 rounded-full border border-line bg-soft p-1">
          {([["buyer", "You (the buyer)"], ["other", story.otherName]] as const).map(([key, label]) => (
            <button key={key} type="button" aria-pressed={side === key} onClick={() => setSide(key)}
              className={`min-h-10 rounded-full text-sm font-semibold transition-colors ${side === key ? "bg-brand text-brand-fg shadow-card" : "text-muted"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div ref={panel} className="grid items-start gap-5 lg:grid-cols-[minmax(0,350px)_190px_minmax(0,350px)] lg:justify-center">
        <div className={side === "buyer" ? "" : "hidden sm:block"}>
          <Phone who="You · the buyer" active={buyerActive} stepKey={`${story.id}-${step}-b`}>{current.buyer}</Phone>
        </div>
        <div className="order-first grid gap-3 sm:order-none lg:sticky lg:top-6 lg:self-center">
          <EscrowPill escrow={current.escrow} />
          {current.verifier && (
            <div className="demo-screen grid gap-2 rounded-2xl border border-brand bg-panel p-3.5 text-left shadow-card" key={`${story.id}-${step}-v`}>
              <p className="flex items-center gap-1.5 text-xs font-extrabold"><ShieldCheck size={15} className="text-lime-deep" aria-hidden /> {current.verifier.title}</p>
              <ul className="grid gap-1.5 text-xs">
                {current.verifier.checks.map((check) => (
                  <li key={check} className="flex items-start gap-1.5"><Check size={13} strokeWidth={3} className="mt-px shrink-0 text-lime-deep" aria-hidden />{check}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className={side === "other" ? "" : "hidden sm:block"}>
          <Phone who={story.otherName} active={!buyerActive} stepKey={`${story.id}-${step}-o`}>{current.other}</Phone>
        </div>
      </div>

      <section aria-live="polite" className="mx-auto grid w-full max-w-3xl gap-4 rounded-3xl border border-line bg-panel p-5 shadow-card sm:p-6">
        <div className="flex items-center gap-3" role="group" aria-label={`Step ${step + 1} of ${story.steps.length}`}>
          <ol className="flex flex-1 items-center gap-1.5">
            {story.steps.map((item, index) => (
              <li key={item.title} className="flex-1">
                <button type="button" aria-label={`Step ${index + 1}: ${item.title}`} aria-current={index === step ? "step" : undefined}
                  onClick={() => { setAuto(false); go(index); }}
                  className="group grid h-6 w-full items-center">
                  <span className={`h-1.5 rounded-full transition-colors duration-300 ${index <= step ? "bg-brand" : "bg-line group-hover:bg-muted"}`} />
                </button>
              </li>
            ))}
          </ol>
          <span className="text-xs font-bold tabular-nums text-muted">{step + 1} / {story.steps.length}</span>
        </div>
        <div key={`${story.id}-${step}-c`} className="demo-screen grid gap-2">
          <h2 className="text-xl font-extrabold tracking-tight sm:text-2xl">{current.title}</h2>
          <p className="max-w-[62ch] text-[15px] leading-relaxed">{current.caption}</p>
          <p className="flex items-start gap-2 text-sm leading-relaxed text-muted">
            <ShieldCheck size={17} className="mt-0.5 shrink-0 text-lime-deep" aria-hidden />
            <span><strong className="text-ink">Why it&apos;s safe: </strong>{current.safe}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" disabled={step === 0} onClick={() => { setAuto(false); go(step - 1); }}>
            <ChevronLeft size={18} aria-hidden /> Back
          </Button>
          {last ? (
            <Button href={story.cta.href} className="min-h-12 flex-1 sm:flex-none">
              {story.cta.label} <ArrowRight size={18} aria-hidden />
            </Button>
          ) : (
            <Button onClick={() => { setAuto(false); go(step + 1); }}>
              Next <ChevronRight size={18} aria-hidden />
            </Button>
          )}
          <Button variant="ghost" className="ml-auto" aria-pressed={auto} onClick={() => { if (last) go(0); setAuto(!auto || last); }}>
            {auto ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />} {auto ? "Pause" : "Auto-play"}
          </Button>
        </div>
        <p className="border-t border-line pt-3 text-sm text-muted"><strong className="text-ink">If something goes wrong: </strong>{story.refund}</p>
      </section>
    </div>
  );
}
