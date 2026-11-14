"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button, Card, Notice, OrderHeader, StatusPill, Stepper } from "@/components/ui/kit";
import { Column, ErrorBox } from "@/components/requester/common";
import { OrderSummaryRow } from "@/components/v3/order-detail";
import { useAuth } from "@/components/v3/auth";
import { HowProtected, WalletNextNote, AddMoneyCta, clearDraft, useDraft } from "@/components/ui/protection";
import { BackgroundNotice, isBackgroundWait, WalletActionLabel, useAction } from "@/components/v3/common";
import { signAndSubmit } from "@/lib/wallet/actions";
import { orderTitle, timelineFor } from "@/lib/order-view";
import { POPULAR_TOKENS, isStableSymbol } from "@/lib/popular-tokens";
import {
  formatCompactUsd, formatPriceUsd, formatTokenAmount, formatUsd, friendlyError,
  tokenBuyInfo, unitsFromDecimal, v3,
  type TokenAccountCheck, type TokenItem, type TokenPrepareResult, type V3Order,
} from "@/lib/v3-client";

const inputCls = "min-h-12 rounded-[10px] border border-line bg-panel px-3.5 transition-colors hover:border-muted focus:border-[var(--ring)] focus:outline-none focus:ring-2 focus:ring-[color:var(--lime)]";
const SLIPPAGE = [1, 3, 5, 10];
const DRAFT = "token";
const NEAR_ID = /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/;

export function TokenIcon({ token, size = 40 }: { token?: Pick<TokenItem, "icon" | "symbol">; size?: number }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="grid shrink-0 place-items-center overflow-hidden rounded-full bg-soft font-black"
      style={{ width: size, height: size }} aria-hidden>
      {token?.icon && !failed
        ? <img src={token.icon} alt="" className="h-full w-full object-cover" onError={() => setFailed(true)} />
        : (token?.symbol ?? "?").slice(0, 2).toUpperCase()}
    </span>
  );
}

function TokenRow({ token, onPick }: { token: TokenItem; onPick: () => void }) {
  return (
    <button type="button" onClick={onPick}
      className="flex min-h-14 w-full items-center gap-3 rounded-lg border border-line bg-panel p-2 text-left hover:border-brand">
      <TokenIcon token={token} />
      <span className="min-w-0 flex-1">
        <strong className="block truncate">{token.symbol}</strong>
        <span className="block truncate text-xs text-muted">{token.name}</span>
      </span>
      <span className="shrink-0 text-right text-sm">
        <strong className="block">{formatPriceUsd(token.price_usd)}</strong>
        <span className="text-xs text-muted">Liq. {formatCompactUsd(token.liquidity_usd)}</span>
      </span>
    </button>
  );
}

function TokenPicker({ token, onChange }: { token: TokenItem | null; onChange: (t: TokenItem | null) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TokenItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [paste, setPaste] = useState(false);
  const [contract, setContract] = useState("");
  const [looking, setLooking] = useState(false);
  const [popular, setPopular] = useState<TokenItem[]>([]);

  useEffect(() => {
    let active = true;
    Promise.all(POPULAR_TOKENS.map(async (entry) => {
      for (const id of entry.ids) {
        try {
          const item = await v3.tokenInfo(id);
          if (Number(item.price_usd) > 0 && !item.warning && !isStableSymbol(item.symbol)) return item;
        } catch { /* try the next id */ }
      }
      return null;
    })).then((items) => { if (active) setPopular(items.filter((item): item is TokenItem => item !== null)); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const text = query.trim();
    if (text.length < 2) { setResults([]); setSearching(false); return; }
    let active = true;
    setSearching(true);
    const timer = window.setTimeout(() => {
      v3.tokenSearch(text)
        .then((items) => { if (active) { setResults(items); setError(""); } })
        .catch((cause) => { if (active) setError(friendlyError(cause)); })
        .finally(() => { if (active) setSearching(false); });
    }, 300);
    return () => { active = false; window.clearTimeout(timer); };
  }, [query]);

  const lookup = async () => {
    setLooking(true);
    setError("");
    try {
      onChange(await v3.tokenInfo(contract.trim().toLowerCase()));
    } catch (cause) {
      setError(cause instanceof Error && /404|not_found|unpriced/i.test(`${cause.message}`)
        ? "This token has no price yet, so it cannot be ordered." : friendlyError(cause));
    } finally {
      setLooking(false);
    }
  };

  if (token) {
    return (
      <div className="grid gap-2">
        <div className="flex items-center gap-3 rounded-lg border-2 border-brand p-2">
          <TokenIcon token={token} />
          <span className="min-w-0 flex-1">
            <strong className="block truncate">{token.symbol} <span className="font-normal text-muted">{token.name}</span></strong>
            <span className="block truncate text-xs text-muted">{token.account_id}</span>
          </span>
          <strong className="shrink-0 text-sm">{formatPriceUsd(token.price_usd)}</strong>
          <button type="button" className="min-h-11 px-2 text-sm font-bold underline" onClick={() => onChange(null)}>Change</button>
        </div>
        {token.warning && (
          <p role="alert" className="rounded-lg border-2 border-danger bg-soft p-3 font-bold text-danger">
            Warning: {token.warning}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      <input className={inputCls} value={query} onChange={(event) => setQuery(event.target.value)}
        placeholder="Search by name or symbol" aria-label="Search tokens" autoComplete="off" />
      {searching && <p className="text-sm text-muted">Searching…</p>}
      {!searching && query.trim().length >= 2 && !results.length && !error && (
        <p className="text-sm text-muted">No tokens found. Try another name, or paste the contract address.</p>
      )}
      {results.length > 0 && (
        <div className="grid max-h-80 gap-2 overflow-y-auto">
          {results.map((item) => <TokenRow key={item.account_id} token={item} onPick={() => onChange(item)} />)}
        </div>
      )}
      {!query.trim() && popular.length > 0 && (
        <div className="grid gap-2">
          <span className="text-sm font-bold">Popular tokens</span>
          <div className="flex flex-wrap gap-2">
            {popular.map((item) => (
              <button key={item.account_id} type="button" onClick={() => onChange(item)}
                className="flex min-h-11 items-center gap-2 rounded-full border border-line bg-panel py-1 pl-1 pr-3 text-sm font-bold hover:border-brand">
                <TokenIcon token={item} size={28} />
                {item.symbol}
              </button>
            ))}
          </div>
        </div>
      )}
      <button type="button" className="min-h-11 text-left text-sm font-bold underline" onClick={() => setPaste(!paste)}>
        Paste contract address instead
      </button>
      {paste && (
        <div className="flex gap-2">
          <input className={`${inputCls} min-w-0 flex-1`} value={contract} onChange={(event) => setContract(event.target.value)}
            placeholder="token.near" aria-label="Token contract address" autoCapitalize="none" autoCorrect="off" />
          <Button disabled={!contract.trim() || looking} onClick={() => void lookup()}>{looking ? "…" : "Find"}</Button>
        </div>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}

export function TokenBuyScreen() {
  const router = useRouter();
  const { status, session } = useAuth();
  const [token, setToken] = useState<TokenItem | null>(null);
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState(3);
  const [custom, setCustom] = useState("");
  const [receiver, setReceiver] = useState("");
  const touched = useRef(false);
  const [check, setCheck] = useState<TokenAccountCheck | null>(null);
  const [checkError, setCheckError] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [prepared, setPrepared] = useState<TokenPrepareResult | null>(null);
  const { busy, error, run } = useAction();

  useEffect(() => {
    if (!touched.current && session?.standard === "nep413" && session.account_id) {
      setReceiver(session.account_id);
    }
  }, [session]);

  useDraft(DRAFT, { token, amount, slippage, custom, receiver: touched.current ? receiver : "" }, (d) => {
    if (d.token) setToken(d.token);
    if (d.amount) setAmount(d.amount);
    if (d.slippage) setSlippage(d.slippage);
    if (d.custom) setCustom(d.custom);
    if (d.receiver) { touched.current = true; setReceiver(d.receiver); }
  });
  const spendUnits = unitsFromDecimal(amount);
  const spendNum = Number(amount);
  const amountOk = !!spendUnits && spendNum >= 1 && spendNum <= 5;
  const customNum = Number(custom);
  const customOk = custom === "" || (customNum > 0 && customNum <= 10);
  const bps = Math.round((custom !== "" ? customNum : slippage) * 100);
  const receiverId = receiver.trim().toLowerCase();
  const receiverOk = receiverId.length >= 2 && receiverId.length <= 64 && NEAR_ID.test(receiverId);
  const missing = !!check && !check.exists;

  useEffect(() => {
    setCheck(null);
    setConfirmed(false);
    setCheckError("");
    if (!receiverOk) return;
    let active = true;
    const timer = window.setTimeout(() => {
      v3.accountCheck(receiverId)
        .then((r) => { if (active) setCheck(r); })
        .catch((cause) => { if (active) setCheckError(friendlyError(cause)); });
    }, 500);
    return () => { active = false; window.clearTimeout(timer); };
  }, [receiverId, receiverOk]);

  const canQuote = !!token && amountOk && customOk && receiverOk && (!missing || confirmed) && !!check;

  const prepare = () => run(async () => {
    if (status !== "in") {
      router.push("/login?next=%2Fshop%2Ftoken");
      return;
    }
    if (!token || !spendUnits) return;
    clearDraft(DRAFT);
    setPrepared(await v3.tokenPrepare({
      token_contract: token.account_id, spend_usdc: spendUnits, slippage_bps: bps, receiver: receiverId,
      ...(missing && confirmed ? { receiver_confirmed: true } : {}),
    }));
  });

  const pay = () => run(async () => {
    if (!prepared) return;
    await signAndSubmit(prepared.payload);
    router.push(`/shop/orders/${encodeURIComponent(prepared.order_id)}`);
  });

  return (
    <div className="page grid max-w-2xl gap-5">
      <Link href="/shop" className="back-link">Shop</Link>
      <header>
        <p className="text-sm text-muted">{prepared ? "Step 2 of 2" : "Step 1 of 2"}</p>
        <h1 className="h1-title">Buy any token</h1>
        <p className="text-sm font-bold">Tokens on NEAR</p>
        <p className="text-muted">Spend USDC. An AI agent buys the token and sends it to your wallet; <strong>OutLayer</strong> (an independent verifier in a secure enclave) checks the transfer before the agent is paid.</p>
      </header>
      {!prepared && <AddMoneyCta />}
      {!prepared && <HowProtected />}

      {!prepared ? (
        <>
          <Card className="grid gap-3">
            <h2 className="font-bold">Token</h2>
            <TokenPicker token={token} onChange={setToken} />
          </Card>

          <Card className="grid gap-4">
            <label className="grid gap-1 font-bold">USDC to spend
              <input className={inputCls} inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="2.00" />
              <span className="text-sm font-normal text-muted">Min 1 USDC, max 5 USDC.</span>
            </label>
            {amount !== "" && !amountOk && <p className="text-sm text-danger">Enter an amount from 1 to 5 USDC.</p>}
            <p className="rounded-lg bg-soft p-3 text-sm">Beta: max 5 USDC per order while we test with our agent.</p>
            <p className="text-sm text-muted">
              Token prices move. The final amount depends on market timing (slippage), but you are guaranteed the minimum shown in your quote.
            </p>
            <div className="grid gap-2">
              <span className="font-bold">
                Slippage <span className="font-normal text-muted" title="How far the price may move against you before the agent buys. Higher = more likely to succeed, lower = a tighter minimum.">(?)</span>
              </span>
              <p className="text-xs text-muted">Slippage = the most the token price can move while the agent buys. Your quote shows the guaranteed minimum you receive.</p>
              <div className="flex flex-wrap gap-2">
                {SLIPPAGE.map((value) => (
                  <button key={value} type="button" aria-pressed={custom === "" && slippage === value}
                    onClick={() => { setSlippage(value); setCustom(""); }}
                    className={`min-h-11 rounded-full border px-4 text-sm font-bold ${
                      custom === "" && slippage === value ? "border-brand bg-brand text-brand-fg" : "border-line bg-panel"}`}>
                    {value}%
                  </button>
                ))}
                <input className="min-h-11 w-28 rounded-full border border-line bg-panel px-3 text-sm" inputMode="decimal"
                  value={custom} onChange={(event) => setCustom(event.target.value)} placeholder="Custom %" aria-label="Custom slippage percent" />
              </div>
              {!customOk && <p className="text-sm text-danger">Custom slippage must be above 0 and at most 10%.</p>}
            </div>
          </Card>

          <Card className="grid gap-2">
            <label className="grid gap-1 font-bold">Receiver NEAR account
              <input className={inputCls} value={receiver} autoCapitalize="none" autoCorrect="off" spellCheck={false}
                onChange={(event) => { touched.current = true; setReceiver(event.target.value); }}
                placeholder="you.near" />
            </label>
            {receiver && !receiverOk && <p className="text-sm text-danger">That does not look like a NEAR account.</p>}
            {check?.exists && <p className="text-sm text-good">✓ Account found{check.implicit ? " (implicit account)" : ""}.</p>}
            {checkError && <p className="text-sm text-danger">{checkError}</p>}
            {missing && (
              <div role="alert" className="grid gap-2 rounded-lg border-2 border-danger p-3">
                <p className="font-bold">This wallet does not exist on NEAR. Do you really want the tokens sent here?</p>
                <label className="flex min-h-11 items-center gap-2">
                  <input type="checkbox" className="h-5 w-5" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
                  Yes, send the tokens to this account anyway
                </label>
              </div>
            )}
          </Card>

          <WalletNextNote />
          <Button full className="min-h-14 text-lg" disabled={busy || !canQuote} onClick={prepare}>
            {busy ? "One moment…" : "Get quote"}
          </Button>
          {token?.warning && <p className="text-sm text-danger">This token carries a warning. Only continue if you trust it.</p>}
        </>
      ) : token && (
        <>
          <Card className="grid gap-2">
            <div className="flex items-center gap-3">
              <TokenIcon token={token} />
              <h2 className="text-xl font-black">{token.symbol}</h2>
            </div>
            <p className="flex justify-between gap-3"><span>Estimated tokens</span>
              <strong>~{formatTokenAmount(prepared.quote.estimated_out, token.decimals)} {token.symbol}</strong></p>
            <p className="flex justify-between gap-3"><span>Guaranteed minimum ({prepared.quote.slippage_bps / 100}% slippage)</span>
              <strong>{formatTokenAmount(prepared.quote.amount_out, token.decimals)} {token.symbol}</strong></p>
            <p className="flex justify-between gap-3"><span>Price</span><strong>{formatPriceUsd(prepared.quote.price_usd)}</strong></p>
            <p className="flex justify-between gap-3"><span>Route</span><strong>{prepared.quote.route_dex}</strong></p>
            <p className="flex justify-between gap-3"><span>Sent to</span><strong className="break-all text-right">{prepared.spec.receiver}</strong></p>
            <p className="flex justify-between gap-3"><span>Spent on tokens</span><strong>{formatUsd(prepared.quote.spend)}</strong></p>
            <p className="flex justify-between gap-3"><span>Agent reward</span><strong>{formatUsd(prepared.quote.reward)}</strong></p>
            <p className="flex justify-between border-t border-line pt-2 text-lg font-black"><span>Total</span><span>{formatUsd(prepared.quote.total)}</span></p>
            <p className="text-sm text-muted">
              Quote expires at {new Date(prepared.quote.expires_at).toLocaleTimeString()}. The agent delivers at least the minimum;
              delivery is verified by NEAR OutLayer before the agent is paid. If nobody delivers in time, you get your money back.
            </p>
          </Card>
          <Button full className="min-h-14 text-lg" disabled={busy} onClick={pay}>
            {busy ? <WalletActionLabel /> : `Pay ${formatUsd(prepared.quote.total)}`}
          </Button>
          <button className="min-h-11 text-sm font-bold underline" disabled={busy} onClick={() => setPrepared(null)}>Edit order</button>
        </>
      )}
      {error && <ErrorBox message={error} />}
    </div>
  );
}

export function TokenBuyOrder({ order, reload }: { order: V3Order; reload: () => void }) {
  const { session } = useAuth();
  const refund = useAction();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const refundable = session?.account_id === order.buyer &&
    BigInt(now) * BigInt(1_000_000) >= BigInt(order.deadline_ns) &&
    ["funded", "claimed"].includes(order.status);
  const info = tokenBuyInfo(order);
  const [fetched, setFetched] = useState<TokenItem | null>(null);
  const contract = info.spec?.token_contract;
  useEffect(() => {
    if (info.token || !contract) return;
    v3.tokenInfo(contract).then(setFetched).catch(() => undefined);
  }, [info.token, contract]);
  const token = info.token ?? fetched ?? undefined;
  const phase = timelineFor(order.kind, order.status);
  const decimals = token?.decimals;
  const symbol = token?.symbol ?? contract ?? "tokens";
  const paid = ["paid", "closed"].includes(order.status);
  const total = (BigInt(order.pay_amount) + BigInt(order.reward)).toString();
  return (
    <Column>
      <Link href="/shop" className="back-link">Shop</Link>
      <OrderHeader id={order.id} title={orderTitle(order)} status={phase.title} tone={phase.tone} />
      <Card className="grid gap-3">
        <div className="flex items-center gap-3">
          <TokenIcon token={token} />
          <strong className="text-xl">{symbol}</strong>
        </div>
        <dl className="grid gap-3 text-sm">
          {info.spec && (
            <OrderSummaryRow label="Minimum amount" value={
              `${decimals === undefined ? info.spec.amount_out : formatTokenAmount(info.spec.amount_out, decimals)} ${symbol}`
            } />
          )}
          {info.spec && <OrderSummaryRow label="Receiver" value={info.spec.receiver} />}
          <OrderSummaryRow label="Spent on tokens" value={formatUsd(order.pay_amount)} />
          <OrderSummaryRow label="Reward" value={formatUsd(order.reward)} />
          <OrderSummaryRow label="Total paid" value={formatUsd(total)} total />
          {order.fulfiller && <OrderSummaryRow label="Helper" value={order.fulfiller} />}
        </dl>
      </Card>
      <Card><Stepper steps={phase.steps} current={phase.step} /></Card>
      {isBackgroundWait(order.status) && !refundable && (
        <BackgroundNotice>The AI agent buys your token and sends it to your wallet.</BackgroundNotice>
      )}
      <p className="flex flex-wrap items-center gap-2 text-sm">
        <StatusPill tone="good">Delivery checked</StatusPill>
        <span className="text-muted">The token transfer is checked before the agent is paid.</span>
      </p>
      {paid && (info.txHash
        ? <a className="font-bold underline" target="_blank" rel="noreferrer" href={`https://nearblocks.io/txns/${info.txHash}`}>View delivery transaction on NearBlocks ›</a>
        : <Notice>Tokens delivered.</Notice>)}
      {refundable && (
        <>
          <p>The deadline has passed and no agent delivered. You can get your money back now.</p>
          <Button full className="min-h-14 text-lg" disabled={refund.busy} onClick={() => void refund.run(async () => {
            await v3.tokenExpire(order.id);
            reload();
          })}>{refund.busy ? "Returning your money…" : "Get refund"}</Button>
        </>
      )}
      {refund.error && <ErrorBox message={refund.error} />}
      {order.status === "expired" && <Notice tone="warn">The deadline passed. Your money was returned.</Notice>}
      {order.status === "proof_rejected" && <p className="text-sm text-muted">The last delivery proof was rejected. The agent can try again until the deadline.</p>}
    </Column>
  );
}
