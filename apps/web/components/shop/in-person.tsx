"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DeliveryQr } from "@/components/shop/delivery-qr";
import { Button, Card } from "@/components/ui/kit";
import { ErrorBox } from "@/components/requester/common";
import { useAuth } from "@/components/v3/auth";
import { HowProtected, WalletNextNote, clearDraft, useDraft } from "@/components/ui/protection";
import { WalletActionLabel, useAction } from "@/components/v3/common";
import { RewardPicker } from "@/components/ui/reward-picker";
import { cleanText, rewardDecimal, textProblem } from "@/lib/reward";
import { signAndSubmit } from "@/lib/wallet/actions";
import { formatUsd, unitsFromDecimal, v3, type InPersonPrepareResult } from "@/lib/v3-client";

const key = (id: string) => `in-person-secret:${id}`;
const DRAFT = "in-person";
const EXAMPLES = [
  { label: "Concert / movie ticket", item: "2 tickets for tonight's movie, any seat together", price: "12.00", note: "Cinema box office" },
  { label: "A coffee", item: "Large oat-milk latte from the cafe on the corner", price: "4.50", note: "Cafe" },
  { label: "Pharmacy item", item: "Ibuprofen 200 mg, 24 tablets", price: "6.00", note: "Pharmacy" },
  { label: "Local SIM card", item: "Prepaid tourist SIM card with data", price: "10.00", note: "Phone shop" },
  { label: "Street food", item: "Two portions of the local street-food special", price: "5.00", note: "Street stall" },
];

export function InPersonCreateScreen() {
  const router = useRouter();
  const { status } = useAuth();
  const [item, setItem] = useState("");
  const [price, setPrice] = useState("");
  const [area, setArea] = useState("");
  const [address, setAddress] = useState("");
  const [contact, setContact] = useState("");
  const [hours, setHours] = useState(24);
  const [prepared, setPrepared] = useState<InPersonPrepareResult | null>(null);
  const [secret, setSecret] = useState("");
  const [backedUp, setBackedUp] = useState(false);
  const { busy, error, run } = useAction();
  const [reward, setReward] = useState<number | null | "default">("default");
  useDraft(DRAFT, { item, price, area, address, contact, hours }, (d) => {
    if (d.item) setItem(d.item);
    if (d.price) setPrice(d.price);
    if (d.area) setArea(d.area);
    if (d.address) setAddress(d.address);
    if (d.contact) setContact(d.contact);
    if (d.hours) setHours(d.hours);
  });
  const priceUnits = unitsFromDecimal(price);
  const priceNum = priceUnits ? BigInt(priceUnits) : BigInt(0);
  const fivePct = (priceNum * BigInt(5) + BigInt(99)) / BigInt(100);
  const minUnits = fivePct > BigInt(50_000) ? fivePct : BigInt(50_000);
  const minUsd = Math.ceil(Number(minUnits) / 10_000) / 100;
  const rewardUsd = reward === "default" ? minUsd : reward;
  const presets = [minUsd, ...[1, 2, 3, 5].filter((value) => value > minUsd)];
  const priceProblem = !price.trim() ? null
    : !priceUnits || priceNum < BigInt(1_000_000) || priceNum > BigInt(20_000_000) ? "Price must be between $1 and $20." : null;

  const prepare = () => run(async () => {
    if (status !== "in") {
      router.push("/login?next=%2Fshop%2Fin-person");
      return;
    }
    const problem = textProblem(item, "Item", 160) ?? textProblem(area, "Area", 80) ??
      textProblem(address, "Exact place", 240) ?? textProblem(contact, "Contact", 120) ?? priceProblem;
    if (problem) throw new Error(problem);
    if (!priceUnits) throw new Error("Enter a price in dollars.");
    if (rewardUsd === null || rewardUsd < minUsd) throw new Error(`The smallest reward is $${minUsd.toFixed(2)}.`);
    if (priceNum + BigInt(Math.round(rewardUsd * 100)) * BigInt(10_000) > BigInt(20_000_000)) {
      throw new Error("Item price plus reward can be at most $20.");
    }
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const code = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const delivery_hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
    const result = await v3.inPersonPrepare({
      area: cleanText(area), item_desc: cleanText(item), price: priceUnits, delivery_hash,
      meetup_address: cleanText(address), meetup_contact: cleanText(contact), deadline_hours: hours,
      reward_usdc: rewardDecimal(rewardUsd),
    });
    localStorage.setItem(key(result.order_id), code);
    clearDraft(DRAFT);
    setSecret(code);
    setPrepared(result);
  });

  const pay = () => run(async () => {
    if (!prepared || !backedUp) return;
    await signAndSubmit(prepared.payload);
    router.push(`/shop/orders/${encodeURIComponent(prepared.order_id)}`);
  });

  return (
    <div className="page grid max-w-2xl gap-5">
      <Link href="/shop" className="back-link">Shop</Link>
      <header>
        <p className="text-sm text-muted">{prepared ? "Step 2 of 2" : "Step 1 of 2"}</p>
        <h1 className="h1-title">In-person delivery</h1>
        <p className="text-muted">A local buys your item and brings it to you. A <strong>fulfiller</strong> (a local helper) takes the job, and you confirm receipt with a QR code.</p>
      </header>
      {!prepared ? (
        <>
          <HowProtected />
          <Card className="grid gap-4">
            <div className="grid gap-2">
              <span className="text-sm font-bold">Try an example</span>
              <div className="flex flex-wrap gap-2">
                {EXAMPLES.map((ex) => (
                  <button key={ex.label} type="button"
                    onClick={() => { setItem(ex.item); setPrice(ex.price); setReward("default"); }}
                    className="min-h-11 rounded-full border border-line bg-panel px-4 text-sm font-bold hover:border-brand">
                    {ex.label}
                  </button>
                ))}
              </div>
            </div>
            <label className="grid gap-1 font-bold">What should they bring?
              <span className="text-sm font-normal text-muted">Name, brand, size, store if you care.</span>
              <input className="min-h-12 rounded-[10px] border border-line bg-panel px-3.5 transition-colors hover:border-muted focus:border-[var(--ring)] focus:outline-none focus:ring-2 focus:ring-[color:var(--lime)]" value={item} onChange={(event) => setItem(event.target.value)} maxLength={160} placeholder="A book" />
            </label>
            <label className="grid gap-1 font-bold">Item price ($)
              <span className="text-sm font-normal text-muted">What it costs in the shop, $1 to $20.</span>
              <input className="min-h-12 rounded-[10px] border border-line bg-panel px-3.5 transition-colors hover:border-muted focus:border-[var(--ring)] focus:outline-none focus:ring-2 focus:ring-[color:var(--lime)]" value={price} onChange={(event) => setPrice(event.target.value)} maxLength={8} placeholder="1.00" inputMode="decimal" />
            </label>
            {priceProblem && <p role="alert" className="-mt-2 text-sm text-danger">{priceProblem}</p>}
            <label className="grid gap-1 font-bold">Area people can see
              <span className="text-sm font-normal text-muted">Neighborhood or city. Shown publicly so locals know if they are near.</span>
              <input className="min-h-12 rounded-[10px] border border-line bg-panel px-3.5 transition-colors hover:border-muted focus:border-[var(--ring)] focus:outline-none focus:ring-2 focus:ring-[color:var(--lime)]" value={area} onChange={(event) => setArea(event.target.value)} maxLength={80} placeholder="e.g. Downtown, Shibuya, Brooklyn, Old Town" />
            </label>
            <label className="grid gap-1 font-bold">Exact meeting place
              <span className="text-sm font-normal text-muted">Full address. Only the local who accepts will see it.</span>
              <input className="min-h-12 rounded-[10px] border border-line bg-panel px-3.5 transition-colors hover:border-muted focus:border-[var(--ring)] focus:outline-none focus:ring-2 focus:ring-[color:var(--lime)]" value={address} onChange={(event) => setAddress(event.target.value)} maxLength={240} placeholder="e.g. Main entrance of the central library" />
            </label>
            <label className="grid gap-1 font-bold">How can they find you?
              <span className="text-sm font-normal text-muted">Phone, Telegram, etc.</span>
              <input className="min-h-12 rounded-[10px] border border-line bg-panel px-3.5 transition-colors hover:border-muted focus:border-[var(--ring)] focus:outline-none focus:ring-2 focus:ring-[color:var(--lime)]" value={contact} onChange={(event) => setContact(event.target.value)} maxLength={120} placeholder="Telegram @name" />
            </label>
            <label className="grid gap-1 font-bold">Finish within
              <select className="min-h-12 rounded-[10px] border border-line bg-panel px-3.5 transition-colors hover:border-muted focus:border-[var(--ring)] focus:outline-none focus:ring-2 focus:ring-[color:var(--lime)]" value={hours} onChange={(event) => setHours(Number(event.target.value))}>
                {[1, 2, 4, 8, 24].map((value) => <option key={value} value={value}>{value} {value === 1 ? "hour" : "hours"}</option>)}
              </select>
            </label>
          </Card>
          <Card className="grid gap-2">
            <h2 className="text-lg font-bold">Thank-you reward for the local</h2>
            <p className="text-sm text-muted">The smallest reward is ${minUsd.toFixed(2)}. A bigger reward gets your order picked up faster.</p>
            <RewardPicker value={rewardUsd} onChange={setReward} presets={presets} minUsd={minUsd} disabled={busy} />
          </Card>
          <WalletNextNote />
          <Button full className="min-h-14 text-lg" disabled={busy || !cleanText(item) || !cleanText(area) || !cleanText(address) || !cleanText(contact) || !priceUnits || !!priceProblem || rewardUsd === null} onClick={prepare}>
            {busy ? "One moment…" : "See total"}
          </Button>
        </>
      ) : (
        <>
          <Card className="grid gap-2">
            <h2 className="text-xl font-black">Your total</h2>
            <p className="flex justify-between"><span>Item price, paid to the local</span><strong>{formatUsd(prepared.quote.item_price)}</strong></p>
            <p className="flex justify-between"><span>Thank-you reward</span><strong>{formatUsd(prepared.quote.reward)}</strong></p>
            <p className="flex justify-between border-t border-line pt-2 text-lg font-black"><span>Total</span><span>{formatUsd(prepared.quote.total)}</span></p>
            <p className="text-sm text-muted">The local buys the item first. They get paid after you show the delivery code.</p>
          </Card>
          <Card className="grid gap-3">
            <h2 className="text-xl font-black">Your delivery code</h2>
            <p>You need this code to receive your item. When your helper hands it over, they scan this QR to complete the order. This is your <strong>backup</strong>: save it before you pay and keep it until the order is done.</p>
            <p className="rounded-xl bg-[var(--warn)] p-3 text-sm font-bold text-[var(--warn-fg)] border border-[var(--warn-line)]">Only show it after you have the item.</p>
            <DeliveryQr secret={secret} orderId={prepared.order_id} onSaved={() => setBackedUp(true)} />
            {backedUp && <p role="status" className="text-good">Backup saved. Keep it private until you receive the item.</p>}
          </Card>
          <Button full className="min-h-14 text-lg" disabled={busy || !backedUp} onClick={pay}>
            {busy ? <WalletActionLabel /> : `Pay ${formatUsd(prepared.quote.total)}`}
          </Button>
        </>
      )}
      {error && <ErrorBox message={error} />}
    </div>
  );
}
