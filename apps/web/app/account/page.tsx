"use client";

import Link from "next/link";
import { useMode } from "@/components/mode";
import { Button, Card } from "@/components/ui/kit";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/v3/auth";
import { AccountCard } from "@/components/account-card";
import { walletKind } from "@/lib/wallet";
import { ProfileEditor } from "@/components/v3/profile-editor";

const dev = [
  { href: "/demo", label: "Guided demo" },
  { href: "/court", label: "Court" },
  { href: "/status", label: "Status" },
];

export default function AccountPage() {
  const { mode, setMode, themePref, setTheme } = useMode();
  const { status, session, logout } = useAuth();
  const router = useRouter();
  const kind = status === "in" ? walletKind() : null;
  return (
    <div className="page grid gap-4">
      <h1 className="h1-title">Account</h1>
      <Card className="grid gap-3">
        {status === "in" && session ? (
          <>
            <AccountCard className="!border-0 !bg-transparent !p-0" />
            {kind === "demo" && <p className="text-sm font-bold text-warn">Demo wallet, not real money</p>}
            <Button
              full
              variant="secondary"
              onClick={async () => {
                await logout();
                router.push("/login");
              }}
            >
              Log out
            </Button>
          </>
        ) : (
          <>
            <p className="font-bold">{status === "loading" ? "Loading…" : "You are not logged in"}</p>
            {status === "out" && <Button full href="/login">Log in</Button>}
          </>
        )}
      </Card>
      {status === "in" && <ProfileEditor />}
      <Card className="grid gap-3">
        <p className="font-bold">
          You are in {mode === "earn" ? "Earn" : "Order"} mode
        </p>
        <Button variant="secondary" onClick={() => setMode(mode === "earn" ? "requester" : "earn")} full>
          {mode === "earn" ? "Switch to Order mode" : "Switch to Earn mode"}
        </Button>
      </Card>
      <Card className="grid gap-3">
        <span className="font-bold" id="look-label">Look</span>
        <div role="radiogroup" aria-labelledby="look-label" className="grid grid-cols-3 gap-1 rounded-full border border-line bg-soft p-1">
          {([["system", "System"], ["light", "Light"], ["dark", "Dark"]] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={themePref === value}
              onClick={() => setTheme(value)}
              className={`min-h-10 rounded-full text-sm font-semibold transition-colors ${themePref === value ? "bg-brand text-brand-fg shadow-card" : "text-muted hover:text-ink"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-sm text-muted">System follows your device and switches by itself.</p>
      </Card>
      <Card as="section" className="grid gap-2">
        <h2 className="font-bold">Developer & judges</h2>
        <ul className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {dev.map((d) => (
            <li key={d.href}>
              <Link href={d.href} className="block rounded-lg border border-line px-3 py-3 text-sm font-bold">
                {d.label} ›
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
