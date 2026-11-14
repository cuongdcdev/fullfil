"use client";

import { UsdcIcon } from "@/components/ui/usdc-icon";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import QRCode from "qrcode";
import { Check } from "lucide-react";
import {
  COINS,
  coinName,
  coinsFromTokens,
  roughUsd,
  safeCoins,
  searchCoins,
  addressOk,
  dollarCoins,
  decimalFromUnits,
  formatUsd,
  topupPhase,
  unitsFromDecimal,
  usdcBalance,
  v3,
  type Coin,
  type TopupQuote,
  type WithdrawQuote,
} from "@/lib/v3-client";
import { signAndSubmit } from "@/lib/wallet/actions";
import { IntentsBalanceNote } from "@/components/account-card";
import { BottomSheet, Button, Card } from "@/components/ui/kit";
import { Column, ErrorBox, Loading, Spinner } from "@/components/requester/common";
import { CopyButton } from "@/components/earn/common";
import { useAuth } from "./auth";
import { SignNote, useAction, usePolling } from "./common";

type View = "home" | "add" | "withdraw";

function WalletInner() {
  const { me, refreshMe } = useAuth();
  const params = useSearchParams();
  const [view, setView] = useState<View>(params.get("add") ? "add" : "home");
  const [details, setDetails] = useState(false);
  const [mock, setMock] = useState(false);
  const [coins, setCoins] = useState<Coin[]>(COINS);

  useEffect(() => {
    void refreshMe();
    v3.topupTokens()
      .then((t) => {
        setMock(!!t.mock);
        const list = t.mock ? [] : coinsFromTokens(t.tokens ?? []);
        if (list.length) setCoins(list);
      })
      .catch(() => undefined);
  }, [refreshMe]);

  const balance = usdcBalance(me ?? undefined);

  return (
    <Column>
      <h1 className="h1-title">Wallet</h1>
      <Card className="grid gap-1">
        <p className="text-sm text-muted">Your balance</p>
        <p className="flex items-center gap-3 text-4xl font-black" aria-live="polite">
          <UsdcIcon size={36} />
          <span>{me ? formatUsd(balance) : "…"}</span>
        </p>
        {mock && <p className="text-sm font-bold text-warn">Demo money, not real</p>}
        <IntentsBalanceNote className="text-sm" />
        <button type="button" className="min-h-11 w-max text-sm text-muted underline" onClick={() => setDetails(true)}>
          Details ›
        </button>
      </Card>

      {view === "home" && (
        <>
          {me && BigInt(balance || "0") === BigInt(0) && (
            <p className="rounded-lg border-2 border-brand p-3 text-sm">
              Your balance is $0.00. Add money from 200+ tokens on 38 chains using <strong>NEAR Intents</strong> (a cross-chain swap network).
            </p>
          )}
          <Button full className="min-h-14 text-lg" onClick={() => setView("add")}>
            Add money
          </Button>
          <Button full variant="secondary" onClick={() => setView("withdraw")}>
            Withdraw
          </Button>
        </>
      )}
      {view === "add" && <AddMoney mock={mock} allCoins={coins} onClose={() => setView("home")} onDone={() => void refreshMe()} />}
      {view === "withdraw" && (
        <Withdraw balance={balance} onClose={() => setView("home")} onDone={() => void refreshMe()} />
      )}

      <BottomSheet open={details} onClose={() => setDetails(false)} title="Balance details">
        <dl className="grid gap-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Dollar balance (USDC)</dt>
            <dd className="font-bold">{decimalFromUnits(balance)}</dd>
          </div>
          <div className="grid gap-1">
            <dt className="text-muted">Account</dt>
            <dd className="break-all font-mono text-xs">{me?.account}</dd>
          </div>
          <p className="text-muted">
            Your balance lives on NEAR Intents (intents.near), not in your regular NEAR wallet, so tokens you hold
            there don&apos;t show here. You can add money from many coins and networks; we turn it into dollars for
            you. Manage your NEAR Intents balance at{" "}
            <a href="https://near.com" target="_blank" rel="noreferrer" className="font-bold underline">near.com ↗</a>
          </p>
        </dl>
      </BottomSheet>
    </Column>
  );
}

export function WalletScreen() {
  return (
    <Suspense fallback={<Loading />}>
      <WalletInner />
    </Suspense>
  );
}

/* ------------------------------------------------------------- add money */

function AddMoney({
  mock,
  allCoins,
  onClose,
  onDone,
}: {
  mock: boolean;
  allCoins: Coin[];
  onClose: () => void;
  onDone: () => void;
}) {
  const coins = mock ? dollarCoins() : allCoins;
  const [search, setSearch] = useState("");
  const [picking, setPicking] = useState(false);
  const [coinId, setCoinId] = useState(coins[0].id);
  const [amount, setAmount] = useState("10");
  const [quote, setQuote] = useState<TopupQuote | null>(null);
  const { busy, error, run } = useAction();
  const coin = coins.find((c) => c.id === coinId) ?? coins[0];
  const shown = searchCoins(coins, search).slice(0, 40);
  const pick = (id: string) => {
    setCoinId(id);
    setPicking(false);
    setSearch("");
  };
  const usd = roughUsd(coin, amount);

  const units = unitsFromDecimal(amount, coin.decimals);
  const valid = !!units && BigInt(units) > BigInt(0);

  if (quote)
    return <Deposit quote={quote} coin={coin} amount={amount} onClose={onClose} onDone={onDone} mock={!!quote.mock} />;

  return (
    <Card className="grid gap-4">
      <h2 className="text-xl font-black">Add money</h2>
      <div className="grid gap-1">
        <span className="text-sm text-muted">Which coin do you have?</span>
        <div className="flex min-h-12 items-center justify-between gap-3 rounded-lg border border-line bg-soft p-3">
          <span className="flex items-center gap-2 text-base font-bold">
            <CoinIcon coin={coin} />
            {coinName(coin)}
          </span>
          <button
            type="button"
            className="min-h-11 text-sm font-bold underline"
            aria-expanded={picking}
            onClick={() => {
              setPicking(!picking);
              setSearch("");
            }}
          >
            {picking ? "Close" : "Change"}
          </button>
        </div>
        {picking && (
          <div className="grid gap-2 rounded-lg border border-line p-2">
            {coins.length > 8 && (
              <input
                type="search"
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search ${coins.length} coins, e.g. USDC, ZEC, NEAR, SOL...`}
                aria-label="Search coins"
                className="min-h-12 rounded-lg border border-line bg-panel p-3 text-base"
              />
            )}
            <ul className="grid max-h-72 gap-1 overflow-y-auto" aria-label="Coins">
              {shown.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => pick(c.id)}
                    aria-pressed={c.id === coin.id}
                    className={`flex min-h-11 w-full items-center gap-2 rounded-lg p-2 text-left text-base ${
                      c.id === coin.id ? "bg-soft font-bold" : "hover:bg-soft"
                    }`}
                  >
                    <CoinIcon coin={c} />
                    <span>
                      {c.label} <span className="text-muted">on {c.network}</span>
                    </span>
                  </button>
                </li>
              ))}
              {shown.length === 0 && <li className="p-2 text-sm text-muted">No coin matches “{search}”.</li>}
            </ul>
          </div>
        )}
      </div>
      <label className="grid gap-1">
        <span className="text-sm text-muted">How much ({coin.label})?</span>
        <input
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="min-h-12 w-full rounded-lg border border-line bg-panel p-3 text-2xl font-black"
        />
        {usd !== undefined && !mock && (
          <span className="text-sm text-muted">
            About {formatUsdNumber(usd)}. We turn it into dollars (USDC); the exact amount shows next.
          </span>
        )}
        {!mock && coin.network !== "NEAR" && (
          <span className="text-sm text-muted">From {coin.network}, add about $10 or more. Small amounts often can&apos;t be swapped.</span>
        )}
      </label>
      {error && <ErrorBox message={error} />}
      {error && !mock && safeCoins(coins).some((c) => c.id !== coin.id) && (
        <div className="grid gap-2">
          <p className="text-sm text-muted">These always work, even for small amounts:</p>
          <div className="flex flex-wrap gap-2">
            {safeCoins(coins)
              .filter((c) => c.id !== coin.id)
              .map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => pick(c.id)}
                  className="flex min-h-11 items-center gap-2 rounded-full border border-line bg-panel px-3 text-sm font-bold"
                >
                  <CoinIcon coin={c} />
                  {coinName(c)}
                </button>
              ))}
          </div>
        </div>
      )}
      <Button
        full
        className="min-h-14 text-lg"
        disabled={!valid || busy}
        onClick={() =>
          run(async () => setQuote(await v3.topupQuote({ originAsset: coin.assetId, amount: units! })))
        }
      >
        {busy ? "One moment…" : "Continue"}
      </Button>
      <Button variant="ghost" onClick={onClose}>
        Back
      </Button>
    </Card>
  );
}

function Deposit({
  quote,
  coin,
  amount,
  mock,
  onClose,
  onDone,
}: {
  quote: TopupQuote;
  coin: Coin;
  amount: string;
  mock: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const address = quote.quote.depositAddress;
  const [qr, setQr] = useState("");
  // The demo credits the money on the first check, so wait a few seconds to let people see the waiting screen.
  const [armed, setArmed] = useState(!mock);
  useEffect(() => {
    if (!mock) return;
    const t = setTimeout(() => setArmed(true), 4000);
    return () => clearTimeout(t);
  }, [mock]);
  useEffect(() => {
    QRCode.toDataURL(address, { margin: 1, width: 220 }).then(setQr).catch(() => setQr(""));
  }, [address]);

  const { data } = usePolling(
    async () => (armed ? v3.topupStatus(address, quote.quote.depositMemo) : { status: "PENDING_DEPOSIT" }),
    3000,
    (s) => ["done", "failed"].includes(topupPhase(s.status)),
  );
  const phase = topupPhase(data?.status);
  useEffect(() => {
    if (phase === "done") onDone();
  }, [phase, onDone]);

  if (phase === "done")
    return (
      <Card className="grid gap-3 text-center">
        <p className="text-6xl text-good" aria-hidden>
          ✓
        </p>
        <p className="text-2xl font-black">Your money arrived</p>
        <Button full onClick={onClose}>
          Done
        </Button>
      </Card>
    );
  if (phase === "failed")
    return (
      <Card className="grid gap-3 border-danger text-center">
        <p className="text-2xl font-black text-danger">The deposit did not work</p>
        <p className="text-muted">If you sent money, it goes back to you.</p>
        <Button full onClick={onClose}>
          Get help
        </Button>
      </Card>
    );

  return (
    <Card className="grid gap-4">
      <h2 className="text-xl font-black">
        Send {amount} {coin.label} on {coin.network}
      </h2>
      <p className="text-sm text-muted">Send exactly this amount to the deposit address below.</p>
      {quote.quote.amountOutFormatted && !mock && (
        <p className="text-lg font-bold">You get about ${quote.quote.amountOutFormatted} USDC</p>
      )}
      {qr && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={qr} alt="QR code of the deposit address" width={220} height={220} className="mx-auto rounded-lg bg-white p-2" />
      )}
      <div className="grid gap-2">
        <p className="break-all rounded-lg border border-line bg-soft p-3 font-mono text-sm">{address}</p>
        <CopyButton text={address} label="Copy address" />
      </div>
      {quote.quote.depositMemo && (
        <div className="grid gap-2">
          <p className="text-sm font-bold text-danger">Also add this memo, or the money is lost:</p>
          <p className="break-all rounded-lg border border-line bg-soft p-3 font-mono text-sm">{quote.quote.depositMemo}</p>
          <CopyButton text={quote.quote.depositMemo} label="Copy memo" />
        </div>
      )}
      <p className="flex items-center justify-center gap-3 text-lg font-bold" role="status" aria-live="polite">
        <Spinner small /> Waiting for your money…
      </p>
      <Button variant="ghost" onClick={onClose}>
        I&apos;ll do this later
      </Button>
    </Card>
  );
}

/* -------------------------------------------------------------- withdraw */

const WITHDRAW_COINS = COINS.filter((c) => c.label === "USDC");

type WithdrawReview = {
  payload: WithdrawQuote["payload"];
  network: string;
  dest: string;
  sendUnits: string;
  getUnits: string;
  deadlineMs: number;
  at: number;
};

/** What the user will get. NEAR is exact; other chains use the quote (never more than they send). */
function buildReview(q: WithdrawQuote, sendUnits: string, near: boolean, network: string, dest: string): WithdrawReview {
  const inner = q.quote?.quote;
  let get = sendUnits;
  if (!near && inner) {
    // amountOutFormatted is already in dollars; amountOut is in the destination coin's own decimals.
    const formatted = inner.amountOutFormatted?.replace(/^(\d+\.\d{6})\d+$/, "$1");
    const fromQuote = (formatted ? unitsFromDecimal(formatted) : undefined) ?? inner.amountOut;
    if (fromQuote && /^\d+$/.test(fromQuote) && BigInt(fromQuote) <= BigInt(sendUnits)) get = fromQuote;
  }
  const at = Date.now();
  const d = inner?.deadline ? Date.parse(inner.deadline) : NaN;
  return { payload: q.payload, network, dest, sendUnits, getUnits: get, deadlineMs: Number.isFinite(d) ? d : at + 9 * 60_000, at };
}

/** Old if past its deadline (with a 30s margin) or more than 9 minutes old. */
function quoteStale(r: WithdrawReview, now = Date.now()) {
  return now > r.deadlineMs - 30_000 || now - r.at > 9 * 60_000;
}

function Withdraw({ balance, onClose, onDone }: { balance: string; onClose: () => void; onDone: () => void }) {
  const [coinId, setCoinId] = useState("usdc-near");
  const [amount, setAmount] = useState("");
  const [dest, setDest] = useState("");
  const [done, setDone] = useState(false);
  const [review, setReview] = useState<WithdrawReview | null>(null);
  const [refreshed, setRefreshed] = useState(false);
  const { busy, error, run } = useAction();
  const coin = WITHDRAW_COINS.find((c) => c.id === coinId) ?? WITHDRAW_COINS.find((c) => c.id === "usdc-near")!;
  const units = unitsFromDecimal(amount);
  const enough = !!units && BigInt(units) > BigInt(0) && BigInt(units) <= BigInt(balance);
  const near = coin.network === "NEAR";
  const destOk = addressOk(coin.network, dest);
  const destBad = dest.trim().length > 0 && !destOk;

  if (done)
    return (
      <Card className="grid gap-3 text-center">
        <p className="text-6xl text-good" aria-hidden>
          <Check className="mx-auto" size={56} />
        </p>
        <p className="text-2xl font-black">Sent</p>
        <p className="text-muted">Your money is on its way. It can take a few minutes.</p>
        <Button full onClick={onClose}>
          Done
        </Button>
      </Card>
    );

  async function getQuote(): Promise<WithdrawReview> {
    const q = await v3.withdrawQuote(
      near
        ? { amount: units, receiver_id: dest.trim() }
        : { amount: units, destinationAsset: coin.assetId, recipient: dest.trim() },
    );
    return buildReview(q, units!, near, coin.network, dest.trim());
  }

  if (review) {
    const feeUnits = BigInt(review.sendUnits) - BigInt(review.getUnits);
    const hasFee = feeUnits > BigInt(0);
    const bigFee = hasFee && feeUnits * BigInt(5) > BigInt(review.sendUnits);
    return (
      <Card className="grid gap-4">
        <h2 className="text-xl font-black">Check before you send</h2>
        <div className="grid gap-1">
          <span className="text-sm text-muted">Going to {review.network}</span>
          <p className="break-all rounded-lg border border-line bg-soft p-3 font-mono text-sm">{review.dest}</p>
        </div>
        <div className="grid gap-1" aria-live="polite">
          {refreshed && <p className="text-sm text-muted">The price was out of date, so we got a new one. Please check it.</p>}
          <p>You send {formatUsd(review.sendUnits)}</p>
          <p className="text-lg font-bold">
            {near ? "They get" : "They get about"} {formatUsd(review.getUnits)} USDC
          </p>
          {hasFee && <p className="text-muted">Fee about {formatUsd(feeUnits.toString())}</p>}
        </div>
        {bigFee && (
          <p className="text-sm text-muted">
            The fee takes a big part of this. Small withdrawals lose a lot to fees, so a bigger amount is better.
          </p>
        )}
        {error && <ErrorBox message={error} />}
        <Button
          full
          className="min-h-14 text-lg"
          disabled={busy}
          onClick={() =>
            run(async () => {
              if (quoteStale(review)) {
                setReview(await getQuote());
                setRefreshed(true);
                return;
              }
              await signAndSubmit(review.payload);
              onDone();
              setDone(true);
            })
          }
        >
          {busy ? "Waiting for your wallet…" : "Withdraw"}
        </Button>
        <SignNote />
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() => {
            setReview(null);
            setRefreshed(false);
          }}
        >
          Change
        </Button>
      </Card>
    );
  }

  return (
    <Card className="grid gap-4">
      <h2 className="text-xl font-black">Withdraw</h2>
      <div className="grid gap-1" role="radiogroup" aria-label="Where to?">
        <span className="text-sm text-muted">Where to?</span>
        <div className="grid grid-cols-2 gap-2">
          {WITHDRAW_COINS.map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={c.id === coin.id}
              onClick={() => setCoinId(c.id)}
              className={`flex min-h-12 items-center gap-2 rounded-lg border p-3 text-left text-base ${
                c.id === coin.id ? "border-ink bg-soft font-bold" : "border-line bg-panel"
              }`}
            >
              <CoinIcon coin={c} />
              {coinName(c)}
            </button>
          ))}
        </div>
      </div>
      <label className="grid gap-1">
        <span className="text-sm text-muted">Their address on {coin.network}</span>
        <input
          value={dest}
          onChange={(e) => setDest(e.target.value)}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder={near ? "name.near" : coin.network === "Solana" ? "Solana address" : "0x…"}
          aria-invalid={destBad}
          className="min-h-12 w-full rounded-lg border border-line bg-panel p-3 font-mono text-sm"
        />
        {destBad && <span className="text-sm text-danger">This doesn&apos;t look like a {coin.network} address.</span>}
      </label>
      <label className="grid gap-1">
        <span className="text-sm text-muted">How many dollars? (you have {formatUsd(balance)})</span>
        <input
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="5"
          className="min-h-12 w-full rounded-lg border border-line bg-panel p-3 text-2xl font-black"
        />
      </label>
      {error && <ErrorBox message={error} />}
      <Button
        full
        className="min-h-14 text-lg"
        disabled={!enough || !destOk || busy}
        onClick={() =>
          run(async () => {
            setRefreshed(false);
            setReview(await getQuote());
          })
        }
      >
        {busy ? "Getting the price…" : "Continue"}
      </Button>
      <Button variant="ghost" onClick={onClose} disabled={busy}>
        Back
      </Button>
    </Card>
  );
}

function formatUsdNumber(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: n < 1 ? 4 : 2 });
}

/** Coin logo, or its first letter when there is no logo or it fails to load. */
function CoinIcon({ coin }: { coin: Coin }) {
  const [broken, setBroken] = useState(false);
  if (coin.icon && !broken)
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={coin.icon}
        alt=""
        width={24}
        height={24}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
        className="h-6 w-6 shrink-0 rounded-full bg-white"
      />
    );
  return (
    <span aria-hidden className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-line text-xs font-black">
      {coin.label.charAt(0).toUpperCase()}
    </span>
  );
}
