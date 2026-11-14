"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Coins, Globe, MapPin, SearchX, type LucideIcon } from "lucide-react";
import { Card, EmptyState } from "@/components/ui/kit";
import { friendlyError, v3, type ShopCatalog, type ShopListing, type ShopCountry } from "@/lib/v3-client";
import { rankBrands } from "@/lib/shop-search";

const shopTiles: { label: string; hint: string; icon: LucideIcon; href: string }[] = [
  { label: "Buy anything nearby", hint: "A local buys it and hands it to you; you confirm with a QR receipt.", icon: MapPin, href: "/shop/in-person" },
  { label: "Buy online", hint: "Gift cards, phone top-ups, eSIMs: delivered in minutes.", icon: Globe, href: "#online" },
  { label: "Buy any token", hint: "An AI agent buys any NEAR token for you; OutLayer verifies the transfer.", icon: Coins, href: "/shop/token" },
];

export function BrandLogo({ brand }: { brand: { brand_name: string; logo_url: string } }) {
  const [failed, setFailed] = useState(false);
  const initials = brand.brand_name
    .split(/\s+/)
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <span
      className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-soft text-base font-black sm:h-12 sm:w-12"
      aria-hidden
    >
      {brand.logo_url && !failed && !/^https?:\/\/[^/]*\.invalid(\/|$)/i.test(brand.logo_url) ? (
        <img
          src={brand.logo_url}
          alt=""
          className="h-full w-full object-contain"
          onError={() => setFailed(true)}
        />
      ) : initials}
    </span>
  );
}

function BrandCard({ brand, country }: { brand: ShopListing; country: string }) {
  return (
    <Link href={`/shop/${country}/${encodeURIComponent(brand.slug)}`} className="group block min-w-0 rounded-2xl">
      <Card className="flex h-full items-center gap-2 p-3 transition-[box-shadow,border-color] duration-200 group-hover:border-brand group-hover:shadow-card sm:gap-3 sm:p-4">
        <BrandLogo brand={brand} />
        <span className="min-w-0 flex-1">
          <strong className="block truncate text-sm font-bold sm:text-base" title={brand.brand_name}>{brand.brand_name}</strong>
          {brand.price_range && <span className="block truncate text-xs text-muted">{brand.price_range}</span>}
        </span>
      </Card>
    </Link>
  );
}

/** "VN" -> flag emoji from regional indicator symbols. */
export function flagEmoji(code: string): string {
  return /^[A-Za-z]{2}$/.test(code)
    ? String.fromCodePoint(...[...code.toUpperCase()].map((char) => 0x1f1e6 + char.charCodeAt(0) - 65))
    : "🌐";
}

export function ShopCatalogScreen() {
  const [countries, setCountries] = useState<ShopCountry[]>([]);
  const [country, setCountry] = useState("US");
  const [localeHint, setLocaleHint] = useState("");
  const [catalog, setCatalog] = useState<ShopCatalog | null>(null);
  const [popular, setPopular] = useState<ShopListing[]>([]);
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    v3.shopCountries()
      .then((items) => {
        if (!active) return;
        setCountries(items);
        const region = navigator.language.split(/[-_]/)[1]?.toUpperCase();
        setLocaleHint(items.find((item) => item.code === region)?.name ?? "");
        let saved: string | null = null;
        try {
          saved = localStorage.getItem("shop-country");
        } catch {
          // Storage can be disabled; fall back to the browser region.
        }
        const pick = [saved, region, "US"].find((code) => code && items.some((item) => item.code === code));
        setCountry(pick ?? items[0]?.code ?? "US");
      })
      .catch((cause) => {
        if (active) setError(friendlyError(cause));
      });
    return () => {
      active = false;
    };
  }, [retry]);

  useEffect(() => {
    if (!countries.length) return;
    let active = true;
    setCatalog(null);
    setError("");
    Promise.all([v3.shopCatalog(country), v3.shopPopular(country)])
      .then(([data, picks]) => {
        if (!active) return;
        setCatalog(data);
        setPopular(picks);
      })
      .catch((cause) => {
        if (active) setError(friendlyError(cause));
      });
    return () => {
      active = false;
    };
  }, [country, countries, retry]);

  const categories = catalog?.categories ?? [];
  const brands = useMemo(() => rankBrands(catalog?.categories
    .filter((item) => category === "All" || item.category === category)
    .flatMap((item) => item.brands)
    .filter((brand, index, all) => all.findIndex((item) =>
      (category === "All" ? item.brand_name : item.slug) ===
      (category === "All" ? brand.brand_name : brand.slug)) === index) ?? [], search),
  [catalog, category, search]);

  return (
    <div className="page grid gap-5">
      <header>
        <h1 className="h1-title">What would you like to buy?</h1>
      </header>

      <section className="grid gap-3 md:grid-cols-3" aria-label="What do you need?">
        {shopTiles.map(({ label, hint, icon: Icon, href }) => (
          <Link key={label} href={href} className="group block rounded-2xl">
            <Card className="flex h-full items-start gap-4 p-5 transition-[transform,box-shadow,border-color] duration-300 [transition-timing-function:var(--ease-out)] group-hover:-translate-y-0.5 group-hover:border-brand group-hover:shadow-lift">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand text-brand-fg">
                <Icon size={24} aria-hidden />
              </span>
              <span className="grid gap-1">
                <span className="text-lg font-extrabold tracking-tight">{label}</span>
                <span className="text-sm text-muted">{hint}</span>
              </span>
            </Card>
          </Link>
        ))}
      </section>

      <hr className="border-line" />

      <section id="online" className="grid scroll-mt-4 gap-5" aria-labelledby="online-heading">
        <div>
          <h2 id="online-heading" className="section-title">Buy online</h2>
          <p className="text-muted">Gift cards, phone top-ups, and eSIMs — delivered in minutes.</p>
          <p className="mt-3 rounded-xl border border-line bg-soft p-3 text-sm">
            <strong>Hackathon limit: max 15 USDC per order.</strong>{" "}
            Our shopper agent has a limited budget during the hackathon.
          </p>
        </div>

      <label className="grid gap-1 text-sm font-bold">
        Country
        <select
          value={country}
          onChange={(event) => {
            setCountry(event.target.value);
            setCategory("All");
            try { localStorage.setItem("shop-country", event.target.value); } catch {}
          }}
          className="min-h-12 rounded-[10px] border border-line bg-panel px-3.5 transition-colors hover:border-muted focus:border-[var(--ring)] focus:outline-none focus:ring-2 focus:ring-[color:var(--lime)]"
        >
          {(countries.length ? countries : [{ code: "US", name: "United States", brand_count: 0 }]).map((item) => (
            <option key={item.code} value={item.code}>{flagEmoji(item.code)} {item.name}</option>
          ))}
        </select>
        {localeHint && <span className="text-xs font-normal text-muted">Your browser suggests {localeHint}.</span>}
      </label>

      <label className="grid gap-1 text-sm font-bold">
        Search products
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search brands"
          className="min-h-12 rounded-[10px] border border-line bg-panel px-3.5 transition-colors hover:border-muted focus:border-[var(--ring)] focus:outline-none focus:ring-2 focus:ring-[color:var(--lime)]"
        />
      </label>

      {error ? (
        <Card>
          <p className="text-danger">{error}</p>
          <button className="mt-2 min-h-11 font-bold underline" onClick={() => setRetry((value) => value + 1)}>
            Try again
          </button>
        </Card>
      ) : !catalog ? (
        <div className="grid grid-cols-2 gap-3" aria-label="Loading products">
          <p className="col-span-2 text-sm text-muted">Loading catalog from Cryptorefills…</p>
          {[1, 2, 3, 4].map((number) => (
            <div key={number} className="skeleton" style={{ height: 72, borderRadius: 16 }} />
          ))}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2" aria-label="Categories">
            {[{ category: "All", display_name: "All" }, ...categories].map((item) => (
              <button
                key={item.category}
                onClick={() => setCategory(item.category)}
                aria-pressed={category === item.category}
                className={`min-h-11 rounded-full border px-4 text-sm font-semibold transition-colors ${
                  category === item.category ? "border-brand bg-brand text-brand-fg" : "border-line bg-panel hover:border-muted"
                }`}
              >
                {item.display_name || item.category}
              </button>
            ))}
          </div>

          {!search && category === "All" && (
            <section>
              <h2 className="mb-3 text-xl font-extrabold tracking-tight">Popular</h2>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                {popular.map((brand) => <BrandCard key={brand.slug} brand={brand} country={country} />)}
              </div>
            </section>
          )}

          <section>
            <h2 className="mb-3 text-xl font-extrabold tracking-tight">{category === "All" ? "All brands" : "Brands"}</h2>
            {brands.length ? (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                {brands.map((brand) => <BrandCard key={brand.slug} brand={brand} country={country} />)}
              </div>
            ) : <EmptyState icon={SearchX} title="No products found" hint="Try a different word, or pick another category." />}
          </section>
        </>
      )}
      </section>

      <Link href="/fulfillers" className="text-sm font-bold underline">
        Meet the people and bots who complete orders ›
      </Link>
    </div>
  );
}
