"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ErrorBox, Loading } from "@/components/requester/common";
import { Button, Card } from "@/components/ui/kit";
import { useAuth } from "@/components/v3/auth";
import { HowProtected, WalletNextNote } from "@/components/ui/protection";
import { SignNote, useAction } from "@/components/v3/common";
import {
  dialPrefix,
  formatCountdown,
  formatUsd,
  formatFaceValue,
  formatShopDenomination,
  friendlyError,
  normalizePhone,
  phonePlaceholder,
  shopQuoteLines,
  validEmail,
  v3,
  type ShopBrand,
  type ShopBrandDetail,
  type ShopQuoteResult,
  type ShopEstimate,
} from "@/lib/v3-client";
import { signAndSubmit } from "@/lib/wallet/actions";
import { BrandLogo } from "./catalog";

function variantLabel(item: ShopBrand, all: ShopBrand[]): string {
  const name = (item.category || "Other").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  const duplicate = all.filter((other) => other.category === item.category).length > 1;
  return duplicate ? `${name} (${item.delivery_type === "by_phone" ? "phone" : "email"})` : name;
}

export function ProductScreen({ country, brandName }: { country: string; brandName: string }) {
  const router = useRouter();
  const { status } = useAuth();
  const [detail, setDetail] = useState<ShopBrandDetail | null>(null);
  const [variantIndex, setVariantIndex] = useState(0);
  const [loadError, setLoadError] = useState("");
  const [retry, setRetry] = useState(0);
  const [denomination, setDenomination] = useState("");
  const [customAmount, setCustomAmount] = useState("");
  const [beneficiary, setBeneficiary] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [quote, setQuote] = useState<ShopQuoteResult | null>(null);
  const [estimate, setEstimate] = useState<ShopEstimate | null>(null);
  const [estimateStatus, setEstimateStatus] = useState<"loading" | "ready" | "error">("loading");
  const [now, setNow] = useState(Date.now());
  const { busy, error, run } = useAction();

  // Products load per brand: one upstream call when the brand is opened.
  useEffect(() => {
    let active = true;
    setDetail(null);
    setVariantIndex(0);
    v3.shopBrand(country, brandName)
      .then((found) => {
        if (!active) return;
        if (!found.variants.length) {
          setLoadError("No products are available for this brand right now.");
          return;
        }
        setDetail(found);
      })
      .catch((cause) => {
        if (active) setLoadError(friendlyError(cause));
      });
    return () => {
      active = false;
    };
  }, [country, brandName, retry]);

  const brand: ShopBrand | null = detail?.variants[variantIndex] ?? null;

  useEffect(() => {
    if (!brand) return;
    let active = true;
    setDenomination(brand.products[0]?.denomination ?? "");
    setCustomAmount("");
    setEstimate(null);
    setEstimateStatus("loading");
    void v3.shopEstimate(country, detail?.slug || brandName)
      .then((value) => {
        if (active) {
          setEstimate(value);
          setEstimateStatus("ready");
        }
      })
      .catch(() => { if (active) setEstimateStatus("error"); });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail, variantIndex]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const product = brand?.products.find((item) => item.denomination === denomination) ?? brand?.products[0];
  const range = product?.product_value_range;
  const amountNumber = Number(customAmount);
  const amountValid = !range || (
    Number.isFinite(amountNumber)
    && amountNumber >= Number(range.min)
    && amountNumber <= Number(range.max)
  );
  const normalized = brand?.delivery_type === "by_phone"
    ? normalizePhone(beneficiary, country)
    : beneficiary.trim().toLowerCase();
  const beneficiaryValid = brand?.delivery_type === "by_phone" ? !!normalized : validEmail(beneficiary);
  const expired = !!quote && Date.parse(quote.quote.expires_at) <= now;
  const selectedValue = range
    ? formatFaceValue(customAmount, range.currency)
    : product
      ? formatFaceValue(product.face_value.amount, product.face_value.currency)
      : "";
  const productUrl = `/shop/${country}/${encodeURIComponent(detail?.slug || brandName)}`;
  const loginUrl = `/login?${new URLSearchParams({ next: productUrl })}`;
  const preview = estimate?.products.find((item) => item.denomination === denomination)?.total;

  const requestQuote = async () => {
    if (!brand) return;
    const selectedBrand = brand;
    if (status !== "in") {
      router.push(loginUrl);
      return;
    }
    await run(async () => {
      const result = await v3.shopQuote({
        country,
        brand_name: selectedBrand.brand_name,
        ...(selectedBrand.slug ? { brand_slug: selectedBrand.slug } : {}),
        ...(range ? { product_value: customAmount } : { denomination }),
        beneficiary: normalized!,
        buyer_email: buyerEmail.trim().toLowerCase(),
      });
      setQuote(result);
    });
  };

  const pay = async () => {
    if (status !== "in") {
      router.push(loginUrl);
      return;
    }
    if (!quote || expired) {
      await requestQuote();
      return;
    }
    await run(async () => {
      if (!quote.fixture) await signAndSubmit(quote.payload);
      router.push(`/shop/orders/${encodeURIComponent(quote.order_id)}`);
    });
  };

  if (loadError) {
    return (
      <div className="page">
        <ErrorBox
          message={loadError}
          onRetry={() => {
            setLoadError("");
            setRetry((value) => value + 1);
          }}
        />
      </div>
    );
  }
  if (!brand) {
    return (
      <div className="page">
        <Loading text="Loading products from Cryptorefills…" />
      </div>
    );
  }

  return (
    <div className="page grid max-w-2xl gap-5">
      <Link href="/shop" className="back-link">Shop</Link>

      <header className="flex items-center gap-3">
        <BrandLogo brand={brand} />
        <div>
          <p className="text-sm text-muted">Step {quote ? "2" : "1"} of 2</p>
          <h1 className="h1-title">{brand.brand_name}</h1>
          <p className="text-muted">Choose a value and where to send it.</p>
        </div>
      </header>

      {!quote ? (
        <>
          {detail && detail.variants.length > 1 && (
            <div className="flex flex-wrap gap-2" aria-label="Product type">
              {detail.variants.map((item, index) => (
                <button
                  key={`${item.category}:${item.kind}:${item.delivery_type}`}
                  aria-pressed={variantIndex === index}
                  onClick={() => setVariantIndex(index)}
                  className={`min-h-11 rounded-full border px-4 text-sm font-semibold ${
                    variantIndex === index ? "border-brand bg-brand text-brand-fg" : "border-line bg-panel"
                  }`}
                >
                  {variantLabel(item, detail.variants)}
                </button>
              ))}
            </div>
          )}
          <Card className="grid gap-3">
            <h2 className="text-lg font-bold">Choose a value</h2>
            {range ? (
              <label className="grid gap-1 text-sm">
                Amount ({range.currency}, {range.min}–{range.max})
                <input
                  type="number"
                  min={range.min}
                  max={range.max}
                  value={customAmount}
                  onChange={(event) => setCustomAmount(event.target.value)}
                  className="min-h-12 rounded-[10px] border border-line bg-panel px-3.5 transition-colors hover:border-muted focus:border-[var(--ring)] focus:outline-none focus:ring-2 focus:ring-[color:var(--lime)]"
                />
              </label>
            ) : (
              <div className="flex flex-wrap gap-2">
                {brand.products.map((item) => (
                  <button
                    key={item.denomination}
                    aria-pressed={denomination === item.denomination}
                    onClick={() => setDenomination(item.denomination)}
                    className={`min-h-12 rounded-lg border px-3 font-bold ${
                      denomination === item.denomination
                        ? "border-brand bg-brand text-brand-fg"
                        : "border-line"
                    }`}
                  >
                    <span className="block">{item.label || formatShopDenomination(item.denomination)}</span>
                    <small className="block font-normal" aria-live="polite">
                      {estimateStatus === "loading" ? "Estimating…" : estimateStatus === "error"
                        ? "Price shown at checkout" : estimate?.products.find((price) => price.denomination === item.denomination)
                          ? `about ${formatUsd(estimate.products.find((price) => price.denomination === item.denomination)?.total)} USDC`
                          : "Price shown at checkout"}
                    </small>
                  </button>
                ))}
              </div>
            )}
          </Card>

          <p className="text-sm text-muted" aria-live="polite">
            {estimateStatus === "loading" ? "Estimating price…" : preview
              ? `Estimated total: about ${formatUsd(preview)} USDC. Final price comes next.`
              : "Price shown at checkout"}
          </p>

          <Card className="grid gap-3">
            <label className="grid gap-1 text-sm font-bold">
              {brand.delivery_type === "by_phone" ? `Phone number (${dialPrefix(country)})` : "Delivery email"}
              <input
                type={brand.delivery_type === "by_email" ? "email" : "tel"}
                value={beneficiary}
                onChange={(event) => setBeneficiary(event.target.value)}
                placeholder={brand.delivery_type === "by_phone" ? phonePlaceholder(country) : "name@example.com"}
                className="min-h-12 rounded-[10px] border border-line bg-panel px-3.5 transition-colors hover:border-muted focus:border-[var(--ring)] focus:outline-none focus:ring-2 focus:ring-[color:var(--lime)]"
              />
            </label>
            {beneficiary && !beneficiaryValid && (
              <p className="text-sm text-danger">
                Enter a valid {brand.delivery_type === "by_phone" ? "phone number" : "email"}.
              </p>
            )}
            <label className="grid gap-1 text-sm font-bold">
              Your email for the receipt
              <input
                type="email"
                value={buyerEmail}
                onChange={(event) => setBuyerEmail(event.target.value)}
                placeholder="you@example.com"
                className="min-h-12 rounded-[10px] border border-line bg-panel px-3.5 transition-colors hover:border-muted focus:border-[var(--ring)] focus:outline-none focus:ring-2 focus:ring-[color:var(--lime)]"
              />
            </label>
            {buyerEmail && !validEmail(buyerEmail) && (
              <p className="text-sm text-danger">Enter a valid email.</p>
            )}
          </Card>

          <HowProtected />
          <WalletNextNote />
          <Button
            full
            className="min-h-14 text-lg"
            disabled={busy || !amountValid || !beneficiaryValid || !validEmail(buyerEmail) || status === "loading"}
            onClick={requestQuote}
          >
            {busy ? "Getting price…" : "Get price"}
          </Button>
        </>
      ) : (
        <>
          <Card className="grid gap-1 text-sm">
            <h2 className="font-bold">Your top-up</h2>
            <p>{selectedValue}</p>
            <p>{brand.delivery_type === "by_phone" ? "Phone" : "Delivery email"}: {normalized}</p>
            <p>Receipt: {buyerEmail.trim().toLowerCase()}</p>
          </Card>

          <Card className="grid gap-3">
            <div>
              <h2 className="text-xl font-black">Your price</h2>
              <p className="text-sm text-muted">Good for {formatCountdown(quote.quote.expires_at, now)}</p>
            </div>
            <dl className="grid gap-3">
              {shopQuoteLines(quote.quote).map((line) => (
                <div
                  key={line.label}
                  className={`border-t border-line pt-2 ${line.label === "Total" ? "text-lg font-black" : "text-sm"}`}
                >
                  <div className="flex justify-between gap-3">
                    <dt>
                      {line.label}
                      <span className="block text-xs font-normal text-muted">{line.recipient}</span>
                    </dt>
                    <dd className="text-right font-bold">{line.amount}</dd>
                  </div>
                  <p className="mt-1 text-xs font-normal text-muted">{line.explain}</p>
                </div>
              ))}
            </dl>
            <details className="text-sm">
              <summary className="cursor-pointer font-bold">Why more than face value?</summary>
              <p className="mt-1 text-muted">
                The total includes the shop&apos;s price, a small network transfer cost, a cushion if the shop price
                moves before your order is placed, and a reward for whoever completes it. Fulfil takes no fee.
              </p>
            </details>
          </Card>

          {expired && <p className="text-sm text-danger">This price has expired.</p>}
          <Button full className="min-h-14 text-lg" disabled={busy} onClick={pay}>
            {busy ? "One moment…" : expired ? "Get a new price" : `Pay ${formatUsd(quote.quote.total)}`}
          </Button>
          {!quote.fixture && <SignNote />}
          <button className="min-h-11 text-sm font-bold underline" onClick={() => setQuote(null)}>
            Change details
          </button>
        </>
      )}

      {error && <ErrorBox message={error} />}
    </div>
  );
}
