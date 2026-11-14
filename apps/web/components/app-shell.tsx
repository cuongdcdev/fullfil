"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Briefcase,
  CircleUserRound,
  EllipsisVertical,
  House,
  Moon,
  Sun,
  Users,
  ListChecks,
  PiggyBank,
  Receipt,
  ShoppingBag,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { ModeProvider, ModeSwitch, useMode } from "./mode";
import { AuthProvider, useAuth } from "./v3/auth";
import { IntentsKeyHost } from "./v3/intents-key-host";
import { LogoMark } from "@/components/logo-mark";
import { AccountCard, Avatar, formatUsdShort } from "@/components/account-card";
import { UsdcIcon } from "@/components/ui/usdc-icon";
import { shortAccount, usdcBalance } from "@/lib/v3-client";

const moreSections: { title: string; links: { href: string; label: string }[] }[] = [
  { title: "Demo", links: [{ href: "/demo", label: "Guided demo" }] },
  { title: "Judge tools", links: [{ href: "/status", label: "System status" }, { href: "/court", label: "AI Court (preview)" }] },
];

function MoreLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="grid gap-3 py-1">
      {moreSections.map((sec) => (
        <div key={sec.title}>
          <p className="px-3 pb-1 text-xs font-bold text-muted">{sec.title}</p>
          {sec.links.map((l) => (
            <Link key={l.href} href={l.href} onClick={onNavigate} className="block rounded-lg px-3 py-2 text-sm font-semibold text-ink/90 transition-colors hover:bg-soft">
              {l.label}
            </Link>
          ))}
        </div>
      ))}
    </div>
  );
}

function SidebarMore() {
  return (
    <section aria-labelledby="sidebar-more-label">
      <p id="sidebar-more-label" className="px-3 pb-1 text-xs font-bold uppercase tracking-wide text-muted">More</p>
      <div className="rounded-xl bg-soft/60 p-1"><MoreLinks /></div>
    </section>
  );
}

function ThemeToggle() {
  const { theme, toggleTheme } = useMode();
  const dark = theme === "dark";
  return (
    <button
      type="button"
      aria-label={dark ? "Switch to light look" : "Switch to dark look"}
      title={dark ? "Light look" : "Dark look"}
      onClick={(event) => toggleTheme(event.currentTarget)}
      className="relative grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-soft hover:text-ink"
    >
      <Sun size={18} aria-hidden className={`absolute transition-all duration-500 [transition-timing-function:var(--ease-out)] ${dark ? "rotate-0 scale-100 opacity-100" : "rotate-90 scale-50 opacity-0"}`} />
      <Moon size={18} aria-hidden className={`absolute transition-all duration-500 [transition-timing-function:var(--ease-out)] ${dark ? "-rotate-90 scale-50 opacity-0" : "rotate-0 scale-100 opacity-100"}`} />
    </button>
  );
}

function MobileHeader() {
  const { status, session, me } = useAuth();
  const id = session?.account_id;
  return (
    <header data-shell-nav className="sticky top-0 z-40 border-b border-line bg-panel/90 backdrop-blur-md lg:hidden">
      <div className="flex h-14 items-center gap-1.5 pr-2.5">
        <Link href="/" aria-label="Fulfil home" className="shrink-0 self-stretch"><LogoMark className="h-14 w-14 rounded-none text-lg" /></Link>
        <ModeSwitch compact className="ml-auto" />
        <span className="flex shrink-0 items-center">
          {status === "in" && id ? (
            <Link href="/account" className="flex shrink-0 items-center gap-1.5 rounded-full bg-soft py-0.5 pl-0.5 pr-2.5" aria-label={`Your profile, ${id}`} title={id}>
              <Avatar id={id} size={28} />
              <span className="hidden max-w-[9rem] truncate text-xs font-bold sm:inline">{shortAccount(id)}</span>
              <span className="flex shrink-0 items-center gap-1 border-l border-line pl-1.5 text-xs font-extrabold leading-none tabular-nums">
                <UsdcIcon size={14} />
                {me ? formatUsdShort(usdcBalance(me)) : "…"}
              </span>
            </Link>
          ) : status === "out" ? (
            <Link href="/login" className="inline-flex min-h-9 items-center whitespace-nowrap rounded-full bg-brand px-3 text-xs font-bold text-brand-fg">Connect</Link>
          ) : null}
        </span>
        <ThemeToggle />
      </div>
    </header>
  );
}

const devPaths = ["/court", "/orders"];

function DevBar() {
  const { persona, setPersona } = useMode();
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-soft px-4 py-2 text-xs">
      <Link href="/account" className="font-bold underline">
        ‹ Account
      </Link>
      <label className="flex items-center gap-2">
        <span className="text-muted">Developer: view as</span>
        <select
          value={persona}
          onChange={(e) => setPersona(e.target.value)}
          className="rounded border border-line bg-panel px-2 py-1"
        >
          <option value="buyer">Buyer agent</option>
          <option value="linh.fulfil.testnet">Linh (fulfiller)</option>
          <option value="minh.fulfil.testnet">Minh (fulfiller)</option>
          <option value="juror">Court juror</option>
        </select>
      </label>
    </div>
  );
}

type Tab = { href: string; label: string; icon: LucideIcon };
const requesterTabs: Tab[] = [
  { href: "/", label: "Home", icon: House },
  { href: "/activity", label: "Activity", icon: Receipt },
  { href: "/shop", label: "Shop", icon: ShoppingBag },
  { href: "/fulfillers", label: "Fulfillers", icon: Users },
  { href: "/wallet", label: "Wallet", icon: Wallet },
  { href: "/account", label: "Account", icon: CircleUserRound },
  { href: "/docs", label: "Docs", icon: BookOpen },
];
const earnTabs: Tab[] = [
  { href: "/earn", label: "Jobs", icon: Briefcase },
  { href: "/earn/active", label: "Active", icon: ListChecks },
  { href: "/earn/earnings", label: "Earnings", icon: PiggyBank },
  { href: "/fulfillers", label: "Fulfillers", icon: Users },
  { href: "/account", label: "Account", icon: CircleUserRound },
  { href: "/docs", label: "Docs", icon: BookOpen },
];

const moreItems = [
  { href: "/account", label: "Account", icon: CircleUserRound },
  { href: "/docs", label: "Docs", icon: BookOpen },
];
const moreHrefs = [...moreItems.map((i) => i.href), ...moreSections.flatMap((s) => s.links.map((l) => l.href))];

function MoreSheet({ pathname, className }: { pathname: string; className: string }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const active = moreHrefs.some((h) => isActive(pathname, h));
  const [barH, setBarH] = useState(64);
  const close = () => setOpen(false);
  const toggle = () => {
    if (!open) setBarH(btnRef.current?.closest("nav")?.getBoundingClientRect().height ?? 64);
    setOpen(!open);
  };

  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    sheetRef.current?.querySelector<HTMLElement>("a")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); btnRef.current?.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="more-sheet"
        onClick={toggle}
        className={className}
      >
        <span className={active || open ? "rounded-full bg-brand px-5 py-1 text-brand-fg" : "px-5 py-1"}>
          <EllipsisVertical size={20} strokeWidth={active || open ? 2.25 : 1.75} aria-hidden />
        </span>
        More
      </button>
      {open && createPortal(
        <div className="lg:hidden">
          <div className="fixed inset-x-0 top-0 z-40 bg-black/40" style={{ bottom: barH }} aria-hidden onClick={close} />
          <div
            id="more-sheet"
            ref={sheetRef}
            role="dialog"
            aria-label="More"
            style={{ bottom: barH }}
            className="fixed inset-x-0 z-40 max-h-[70vh] overflow-y-auto rounded-t-2xl border-t border-line bg-panel p-3 shadow-xl"
          >
            <div className="mb-1 flex items-center justify-between px-3">
              <p className="text-sm font-extrabold">More</p>
              <button type="button" aria-label="Close menu" onClick={close} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-soft hover:text-ink">
                <X size={18} aria-hidden />
              </button>
            </div>
            <div className="grid gap-3">
              <div>
                {moreItems.map((it) => {
                  const Icon = it.icon;
                  const on = isActive(pathname, it.href);
                  return (
                    <Link key={it.href} href={it.href} onClick={close} aria-current={on ? "page" : undefined} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${on ? "bg-brand text-brand-fg" : "text-ink/90 hover:bg-soft"}`}>
                      <Icon size={18} aria-hidden /> {it.label}
                    </Link>
                  );
                })}
              </div>
              <MoreLinks onNavigate={close} />
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/earn") return pathname === "/earn";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { mode } = useMode();
  const effective = pathname.startsWith("/earn") ? "earn" : mode;
  const tabs = effective === "earn" ? earnTabs : requesterTabs;
  const activeHref = tabs.find((t) => isActive(pathname, t.href))?.href;
  const link = (tab: Tab, layout: "bottom" | "rail") => {
    const active = tab.href === activeHref;
    const Icon = tab.icon;
    return (
      <Link
        key={tab.href}
        href={tab.href}
        aria-current={active ? "page" : undefined}
        className={
          layout === "bottom"
            ? `flex flex-1 flex-col items-center gap-0.5 pb-2 pt-2.5 text-[11px] font-semibold ${active ? "text-ink" : "text-muted"}`
            : `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${active ? "bg-brand text-brand-fg" : "text-muted hover:bg-soft hover:text-ink"}`
        }
      >
        <span
          className={
            layout === "bottom" && active
              ? "rounded-full bg-brand px-5 py-1 text-brand-fg"
              : "px-5 py-1 lg:p-0"
          }
        >
          <Icon size={20} strokeWidth={active ? 2.25 : 1.75} aria-hidden />
        </span>
        {tab.label}
      </Link>
    );
  };
  return (
    <div className="shell-root min-h-screen lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <aside data-shell-nav className="sticky top-0 hidden h-screen flex-col gap-4 overflow-hidden border-r border-line bg-panel p-4 lg:flex">
        <div className="flex items-center justify-between pr-1 pt-1">
          <Link href="/" className="flex items-center gap-2.5 px-2 text-xl font-extrabold tracking-tight" aria-label="Fulfil home">
            <LogoMark />
            fulfil
          </Link>
          <ThemeToggle />
        </div>
        <ModeSwitch className="w-full" />
        <div className="grid min-h-0 flex-1 content-start gap-3 overflow-y-auto">
          <nav aria-label="Main" className="grid gap-0.5">
            {tabs.map((t) => link(t, "rail"))}
          </nav>
          <SidebarMore />
        </div>
        <div className="shrink-0 border-t border-line pt-4"><AccountCard /></div>
      </aside>
      <MobileHeader />
      <main id="main" tabIndex={-1} className="min-w-0 outline-none pb-20 lg:pb-0 shell-main">
        {devPaths.some((p) => pathname === p || pathname.startsWith(`${p}/`)) && <DevBar />}
        {children}
      </main>
      <nav
        data-shell-nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-50 flex border-t border-line bg-panel/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
      >
        {tabs.filter((t) => !moreItems.some((m) => m.href === t.href)).map((t) => link(t, "bottom"))}
        <MoreSheet pathname={pathname} className={`flex flex-1 flex-col items-center gap-0.5 pb-2 pt-2.5 text-[11px] font-semibold ${moreHrefs.some((h) => isActive(pathname, h)) ? "text-ink" : "text-muted"}`} />
      </nav>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ModeProvider>
      <AuthProvider>
        <Shell>{children}</Shell>
        <IntentsKeyHost />
      </AuthProvider>
    </ModeProvider>
  );
}
