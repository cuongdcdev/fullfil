"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { api, vnd } from "@/lib/api";
import {
  estimatePayUnits,
  formatUsd,
  orderTotal,
  unitsFromDecimal,
  usdcBalance,
  v3,
  type PrepareResult,
} from "@/lib/v3-client";
import { readShopQr } from "@/lib/qr-lite";
import { signAndSubmit } from "@/lib/wallet/actions";
import { Button, Card } from "@/components/ui/kit";
import { RewardPicker } from "@/components/ui/reward-picker";
import { rewardDecimal } from "@/lib/reward";
import { ErrorBox, StepLabel } from "@/components/requester/common";
import { ScanStep } from "@/components/requester/scan";
import { useAuth } from "./auth";
import { HowItWorks, SignNote, WalletActionLabel, useAction } from "./common";

const FALLBACK_RATE = 25_400;

export function PayFlowV3() {
  const router = useRouter();
  const { me, refreshMe } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [payload, setPayload] = useState("");
  const [amount, setAmount] = useState("");
  const [reward, setReward] = useState<number | null>(3);
  const [rate, setRate] = useState(FALLBACK_RATE);
  const [readError, setReadError] = useState("");
  const [prepared, setPrepared] = useState<PrepareResult | null>(null);
  const [help, setHelp] = useState(false);
  const { busy, error, run } = useAction();

  useEffect(() => {
    void refreshMe();
  }, [refreshMe]);

  const shop = useMemo(() => {
    if (!payload) return null;
    try {
      return readShopQr(payload);
    } catch {
      return null;
    }
  }, [payload]);

  const onPayload = (p: string) => {
    try {
      const s = readShopQr(p);
      setReadError("");
      setPayload(p);
      setPrepared(null);
      setStep(2);
      // The exchange rate is only for the "about $" line. The server decides the real price.
      api
        .qrPreview({ qrPayload: p, amountVnd: s.amountVnd, rewardUsd: 3 })
        .then((pv) => pv.fxRate > 0 && setRate(pv.fxRate))
        .catch(() => undefined);
    } catch (e) {
      setReadError(e instanceof Error ? e.message : "We could not read this QR.");
    }
  };

  if (step === 1)
    return (
      <>
        <ScanStep onPayload={onPayload} />
        {readError && <ErrorBox message={readError} />}
      </>
    );
  if (!shop) {
    return (
      <>
        <ErrorBox message="We could not read this QR." />
        <Button onClick={() => setStep(1)}>Scan again</Button>
      </>
    );
  }

  const editable = shop.amountVnd === undefined;
  const amountVnd = editable ? Number(amount.replace(/\D/g, "")) || undefined : shop.amountVnd;
  const payUnits = amountVnd ? estimatePayUnits(amountVnd, rate) : "0";
  const rewardUnits = unitsFromDecimal(String(reward ?? 0)) ?? "0";
  const estimateTotal = BigInt(payUnits) + BigInt(rewardUnits);
  const shownTotal = prepared ? BigInt(orderTotal({ pay_amount: prepared.order.pay_amount, reward: prepared.order.reward })) : estimateTotal;
  const balance = BigInt(usdcBalance(me ?? undefined));
  const tooLow = me !== null && balance < shownTotal;

  if (step === 2) {
    return (
      <>
        <StepLabel step={2} hint="Check the shop and the amount." />
        <Card className="grid gap-1 py-8 text-center">
          <p className="text-sm text-muted">You are paying</p>
          <p className="break-words text-3xl font-black">{shop.name}</p>
          <p className="text-sm text-muted">Bank account {shop.accountMasked}</p>
          {editable ? (
            <label className="mt-3 grid gap-1">
              <span className="text-sm text-muted">How much does the shop ask for? (₫)</span>
              <input
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="50000"
                className="w-full rounded-lg border border-line bg-panel p-3 text-center text-3xl font-black"
              />
            </label>
          ) : (
            <p className="mt-2 text-5xl font-black">{vnd(shop.amountVnd)}</p>
          )}
          {!!amountVnd && <p className="text-sm text-muted">about {formatUsd(payUnits)}</p>}
        </Card>
        <Button full className="min-h-14 text-lg" disabled={!amountVnd || amountVnd < 1000} onClick={() => setStep(3)}>
          Next
        </Button>
        <Button variant="ghost" onClick={() => setStep(1)}>
          Scan a different QR
        </Button>
      </>
    );
  }

  const pay = () =>
    run(async () => {
      let prep = prepared;
      if (!prep) {
        prep = await v3.prepareOrder({
          qr_payload: payload,
          amount_vnd: editable ? amountVnd : undefined,
          reward_usdc: rewardDecimal(reward ?? 0),
        });
        const exact = BigInt(orderTotal({ pay_amount: prep.order.pay_amount, reward: prep.order.reward }));
        // The final price can differ a little from the estimate. If so, show it and let them press again.
        if (exact - estimateTotal > BigInt(10_000) || estimateTotal - exact > BigInt(10_000)) {
          setPrepared(prep);
          return;
        }
      }
      await signAndSubmit(prep.payload);
      router.push(`/pay/${prep.order.id}`);
    });

  return (
    <>
      <StepLabel step={3} hint="A local will pay the shop for you. Usually takes 2 minutes." />
      <h1 className="h1-title">Add a reward for the local who pays for you</h1>
      <RewardPicker value={reward} onChange={setReward} disabled={busy || !!prepared} />
      <Card className="grid gap-1 text-sm">
        <div className="flex justify-between gap-3">
          <span className="min-w-0 truncate">
            {shop.name} ({vnd(amountVnd)})
          </span>
          <span>{formatUsd(prepared ? prepared.order.pay_amount : payUnits)}</span>
        </div>
        <div className="flex justify-between">
          <span>Reward</span>
          <span>{formatUsd(rewardUnits)}</span>
        </div>
        <div className="flex justify-between border-t border-line pt-2 text-lg font-black">
          <span>Total</span>
          <span>{formatUsd(shownTotal)}</span>
        </div>
      </Card>
      {prepared && <p className="text-center text-sm text-muted">The price moved a little. This is the final price.</p>}
      {tooLow && (
        <p className="rounded-xl bg-[var(--warn)] p-3 text-center font-bold text-[var(--warn-fg)] border border-[var(--warn-line)]">
          You have {formatUsd(balance)}. You need {formatUsd(shownTotal)}.
        </p>
      )}
      {error && <ErrorBox message={error} />}
      {tooLow ? (
        <Button full href="/wallet?add=1" className="min-h-14 text-lg">
          Add money
        </Button>
      ) : (
        <>
          <Button full className="min-h-14 text-lg" onClick={pay} disabled={busy || !amountVnd || me === null || reward === null}>
            {busy ? <WalletActionLabel /> : `Pay ${formatUsd(shownTotal)}`}
          </Button>
          <SignNote />
        </>
      )}
      <Button variant="ghost" disabled={busy} onClick={() => { setPrepared(null); setStep(2); }}>
        Back
      </Button>
      <button type="button" className="min-h-11 text-center text-sm text-muted underline" onClick={() => setHelp(true)}>
        How does this work? ›
      </button>
      <HowItWorks open={help} onClose={() => setHelp(false)} />
    </>
  );
}
