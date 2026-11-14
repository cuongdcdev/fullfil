"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { bankOptions, isLast4 } from "@/lib/earn-gate";
import { authCall } from "@/lib/wallet/actions";
import { Card } from "@/components/ui/kit";
import { ArrowRight, Bot, Coins, MapPin } from "lucide-react";
import { VietQrMark } from "@/components/ui/vietqr-mark";
import { ErrorBox } from "@/components/requester/common";
import { BigButton } from "@/components/earn/common";
import { useAuth } from "@/components/v3/auth";
import { HowItWorks, SignNote, WalletActionLabel, useAction } from "@/components/v3/common";

/** Bank + last 4 digits form with its explanation. Used in onboarding and "Add bank" on Earnings. */
export function BankForm({ cta, onDone, warnApproval }: { cta: string; onDone?: () => void; warnApproval?: boolean }) {
  const { refreshMe, demoAvailable } = useAuth();
  const banks = bankOptions(demoAvailable);
  const [bin, setBin] = useState(banks[0].bin);
  const [last4, setLast4] = useState("");
  const { busy, error, run } = useAction();
  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted">
        Your OutLayer verifier (an independent checker) matches the bank receipt email to this account, so nobody can claim
        someone else&apos;s transfer. Only the bank and the last 4 digits are stored on chain. Changing them later needs a new approval.
      </p>
      <p className="rounded-xl bg-[var(--warn)] p-3 text-sm font-bold text-[var(--warn-fg)] border border-[var(--warn-line)]">
        {warnApproval ? "Saving a bank removes any earlier approval. " : ""}
        This kind of job needs approval from the operator (the team running Fulfil) after you register.
      </p>
      <label className="grid gap-1">
        <span className="text-sm text-muted">Your bank</span>
        <select value={bin} onChange={(e) => setBin(e.target.value)} className="min-h-12 rounded-lg border border-line bg-panel p-3 text-base">
          {banks.map((b) => <option key={b.bin} value={b.bin}>{b.name}</option>)}
        </select>
      </label>
      <label className="grid gap-1">
        <span className="text-sm text-muted">Last 4 digits of your account number</span>
        <input
          inputMode="numeric"
          maxLength={4}
          value={last4}
          onChange={(e) => setLast4(e.target.value.replace(/\D/g, ""))}
          placeholder="1234"
          className="min-h-12 w-full rounded-lg border border-line bg-panel p-3 text-center text-2xl font-black tracking-widest"
        />
      </label>
      {error && <ErrorBox message={error} />}
      <BigButton
        disabled={!isLast4(last4) || busy}
        onClick={() => run(async () => {
          await authCall({ op: "register_fulfiller", bank_bin: bin, account_last4: last4 });
          await refreshMe();
          onDone?.();
        })}
      >
        {busy ? <WalletActionLabel /> : cta}
      </BigButton>
      <SignNote />
    </div>
  );
}

export function Onboarding() {
  const { refreshMe } = useAuth();
  const [help, setHelp] = useState(false);
  const [beta, setBeta] = useState(false);
  const { busy, error, run } = useAction();
  // Deep link: /earn#bank opens the Beta card.
  useEffect(() => { if (window.location.hash === "#bank") setBeta(true); }, []);
  return (
    <div className="page">
      <div className="mx-auto grid max-w-[1040px] gap-6">
        <header className="grid max-w-2xl gap-2">
          <h1 className="h1-title">Earn money</h1>
          <p className="text-lg leading-relaxed text-muted">Pick how you want to earn. You can add more later.</p>
        </header>

        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <li className="grid">
            <Card className="flex h-full flex-col gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand text-brand-fg"><MapPin size={24} aria-hidden /></span>
              <h2 className="text-xl font-extrabold tracking-tight">Deliver items nearby</h2>
              <p className="text-[15px] leading-relaxed text-muted">Buy the item, hand it over, scan the buyer&apos;s QR — you&apos;re paid automatically from escrow (a locked deposit held until the job is done).</p>
              {error && <ErrorBox message={error} />}
              <div className="mt-auto grid gap-2 pt-2">
                <BigButton
                  disabled={busy}
                  onClick={() => run(async () => {
                    await authCall({ op: "register_fulfiller" });
                    await refreshMe();
                  })}
                >
                  {busy ? <WalletActionLabel /> : "Start delivering"}
                </BigButton>
                <SignNote />
              </div>
            </Card>
          </li>

          <li className="grid">
            <Card className="flex h-full flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <VietQrMark width={72} />
                <span className="badge lime">Beta</span>
              </div>
              <h2 className="text-xl font-extrabold tracking-tight">Pay shop QRs</h2>
              <p className="text-[15px] leading-relaxed text-muted">Pay VietQR shop codes for buyers. Your payout bank must be VPBank for now.</p>
              <div className="mt-auto pt-2">
                <button type="button" aria-expanded={beta} aria-controls="qr-setup" onClick={() => setBeta(!beta)}
                  className="button big full outline">
                  {beta ? "Hide setup" : "Set up with VPBank"}
                </button>
              </div>
            </Card>
          </li>

          <li className="grid">
            <Card className="flex h-full flex-col gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--lime-tint)] text-lime-deep"><Coins size={24} aria-hidden /></span>
              <h2 className="text-xl font-extrabold tracking-tight">Buy tokens <span className="whitespace-nowrap">on-chain</span> (AI agent)</h2>
              <p className="text-[15px] leading-relaxed text-muted">Your AI agent buys any NEAR token for buyers. OutLayer verifies the transfer in a TEE (a secure enclave) and escrow pays you. Plug in with the skill folder and a zero-install CLI.</p>
              <div className="mt-auto pt-2">
                <Link href="/docs#agents" className="button big full outline">Plug in your agent <ArrowRight size={16} aria-hidden /></Link>
              </div>
            </Card>
          </li>

          <li className="grid">
            <Card className="flex h-full flex-col gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--lime-tint)] text-lime-deep"><Bot size={24} aria-hidden /></span>
              <h2 className="text-xl font-extrabold tracking-tight">Run a shopper bot</h2>
              <p className="text-[15px] leading-relaxed text-muted">Gift cards, phone top-ups and eSIMs are bought by bots with their own funds. Run your own bot to earn the reward on each order.</p>
              <div className="mt-auto pt-2">
                <Link href="/docs#shopper-bot" className="button big full outline">Read the guide <ArrowRight size={16} aria-hidden /></Link>
              </div>
            </Card>
          </li>
        </ul>

        {beta && (
          <Card className="grid max-w-2xl gap-3" as="section">
            <h2 id="qr-setup" className="text-xl font-extrabold tracking-tight">Register your bank for QR jobs</h2>
            <BankForm cta="Register with this bank" />
            <Link href="/docs#verifier" className="min-h-11 text-sm font-bold underline">
              Other bank? Add a custom verifier →
            </Link>
          </Card>
        )}

        <p className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted">
          <span>
            Tip: set your name and contacts on <Link href="/account#profile" className="font-bold underline">your account page</Link> so buyers can reach you.
          </span>
          <button type="button" className="min-h-11 underline" onClick={() => setHelp(true)}>
            How does this work? ›
          </button>
        </p>
        <HowItWorks open={help} onClose={() => setHelp(false)} />
      </div>
    </div>
  );
}
