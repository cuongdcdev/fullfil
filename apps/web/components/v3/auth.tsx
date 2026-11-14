"use client";

import Link from "next/link";
import { LogoMark } from "@/components/logo-mark";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  createContext,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { v3, V3Error, friendlyError, type Me, type SessionInfo } from "@/lib/v3-client";
import { loginWith, logout as walletLogout, WalletError, type WalletKind } from "@/lib/wallet";
import { Button, Card } from "@/components/ui/kit";
import { BALANCE_CHANGED_EVENT } from "@/lib/wallet/actions";
import { safeNextPath } from "@/lib/safe-next";
import { Column, ErrorBox, Loading } from "@/components/requester/common";

type Ctx = {
  status: "loading" | "in" | "out";
  session: SessionInfo | null;
  me: Me | null;
  refreshMe: () => Promise<Me | null>;
  login: (kind: WalletKind) => Promise<void>;
  logout: () => Promise<void>;
  /** True when the server runs in mock mode (dev-login works). */
  demoAvailable: boolean;
  /** Mock mode only: sign in as a seeded demo account (see scripts/demo/seed-demo.ts). */
  loginAs: (accountId: string) => Promise<void>;
};
const AuthContext = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Ctx["status"]>("loading");
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [demoAvailable, setDemoAvailable] = useState(false);

  const refreshMe = useCallback(async () => {
    try {
      const next = await v3.me();
      setMe(next);
      return next;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    v3.session()
      .then((s) => {
        if (cancelled) return;
        if (!s.authenticated) {
          setSession(null);
          setStatus("out");
          return;
        }
        setSession(s);
        setStatus("in");
        void refreshMe();
      })
      .catch(() => !cancelled && setStatus("out"));
    // Demo login only works in mock mode. A deliberately bad id answers 400 there and 403 elsewhere.
    if (process.env.NODE_ENV === "development") {
      v3.devLogin("!", "erc191")
        .then(() => undefined)
        .catch((e) => !cancelled && setDemoAvailable(e instanceof V3Error && e.status === 400));
    }
    return () => {
      cancelled = true;
    };
  }, [refreshMe]);

  // Refresh the balance after any signed action, and once more when the relayer has settled.
  useEffect(() => {
    let later: number | undefined;
    const onChange = () => {
      void refreshMe();
      window.clearTimeout(later);
      later = window.setTimeout(() => void refreshMe(), 2500);
    };
    window.addEventListener(BALANCE_CHANGED_EVENT, onChange);
    return () => {
      window.removeEventListener(BALANCE_CHANGED_EVENT, onChange);
      window.clearTimeout(later);
    };
  }, [refreshMe]);

  const login = useCallback(
    async (kind: WalletKind) => {
      const s = await loginWith(kind);
      setSession(s);
      setStatus("in");
      await refreshMe();
    },
    [refreshMe],
  );
  const loginAs = useCallback(
    async (accountId: string) => {
      const s = await v3.devLogin(accountId, "nep413");
      setSession(s);
      setStatus("in");
      await refreshMe();
    },
    [refreshMe],
  );
  const logout = useCallback(async () => {
    await walletLogout();
    setSession(null);
    setMe(null);
    setStatus("out");
  }, []);

  const value = useMemo(
    () => ({ status, session, me, refreshMe, login, loginAs, logout, demoAvailable }),
    [status, session, me, refreshMe, login, loginAs, logout, demoAvailable],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}

/** Friendly card for signed-out visitors; the login button returns them here. */
/** Chain logo inside a login button; decorative, the label names the chain. */
function ChainIcon({ src }: { src: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" aria-hidden width={28} height={28} className="h-7 w-7 shrink-0 rounded-full" />;
}

export function LoginPrompt({ text = "Log in to see this" }: { text?: string }) {
  const pathname = usePathname();
  return (
    <Column>
      <Card className="grid justify-items-center gap-3 p-8 text-center">
        <LogoMark className="mb-1 h-14 w-14 rounded-2xl text-3xl" />
        <h1 className="text-2xl font-extrabold tracking-tight">{text}</h1>
        <p className="max-w-[34ch] text-muted">Your wallet is your account. No password needed.</p>
        <Button full className="mt-2" href={`/login?${new URLSearchParams({ next: pathname })}`}>Log in</Button>
      </Card>
    </Column>
  );
}

/** Shows the page only for a logged-in person; otherwise offers a login button. */
export function RequireAccount({ children, text }: { children: ReactNode; text?: string }) {
  const { status } = useAuth();
  const pathname = usePathname();
  if (status === "out") {
    return <LoginPrompt text={text ?? (pathname.startsWith("/pay/") ? "Log in to see this order" : "Log in to continue")} />;
  }
  if (status !== "in")
    return (
      <Column>
        <Loading text="Loading…" />
      </Column>
    );
  return <>{children}</>;
}

/* ------------------------------------------------------------ login screen */

function LoginInner() {
  const { login, loginAs, status, demoAvailable } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");
  const target = safeNextPath(next);
  const [busy, setBusy] = useState<WalletKind | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "in") router.replace(target);
  }, [status, router, target]);

  const goAs = async (accountId: string) => {
    setBusy("demo");
    setError("");
    try {
      await loginAs(accountId);
      router.replace(target);
    } catch (e) {
      setError(friendlyError(e));
      setBusy(null);
    }
  };

  const go = async (kind: WalletKind) => {
    setBusy(kind);
    setError("");
    try {
      await login(kind);
      router.replace(target);
    } catch (e) {
      if (!(e instanceof WalletError && e.userCancelled)) setError(friendlyError(e));
      setBusy(null);
    }
  };

  return (
    <Column>
      <div className="grid gap-2 pt-2">
        <Link href="/" aria-label="Fulfil home" className="mb-3 flex w-fit items-center gap-3 text-2xl font-extrabold tracking-tight">
          <LogoMark className="h-12 w-12 rounded-2xl text-2xl" />
          fulfil
        </Link>
        <h1 className="h1-title">Log in</h1>
        <p className="text-lg text-muted">Use your crypto wallet to log in. No password needed.</p>
      </div>
      <div className="grid gap-3">
        <Button full className="min-h-14 text-lg" disabled={!!busy} onClick={() => go("near")}>
          <ChainIcon src="/coins/near.jpg" />
          {busy === "near" ? "Check your wallet…" : "NEAR wallet"}
        </Button>
        <Button full variant="secondary" className="min-h-14 text-lg" disabled={!!busy} onClick={() => go("evm")}>
          <ChainIcon src="/coins/ethereum.png" />
          {busy === "evm" ? "Check your wallet…" : "Ethereum wallet (MetaMask…)"}
        </Button>
        <Button full variant="secondary" className="min-h-14 text-lg" disabled aria-disabled="true">
          <ChainIcon src="/coins/solana.png" />
          Solana · Soon
        </Button>
      </div>
      {error && <ErrorBox message={error} />}
      {demoAvailable && (
        <div className="grid gap-3 rounded-2xl border border-dashed border-line p-4">
          <div>
            <p className="font-bold">Demo accounts</p>
            <p className="text-sm text-muted">Demo mode only. Sample data and play money, not real.</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              ["mai.demo.near", "Mai", "Buyer"],
              ["tom.demo.near", "Tom", "Buyer"],
              ["linh.demo.near", "Linh", "Fulfiller"],
              ["minh.demo.near", "Minh", "Fulfiller"],
              ["dao.demo.near", "Dao", "New fulfiller"],
            ].map(([id, name, role]) => (
              <Button key={id} variant="secondary" className="h-auto flex-col items-start gap-0 py-2.5" disabled={!!busy} onClick={() => goAs(id)}>
                <span>{name}</span>
                <span className="text-xs font-semibold text-muted">{role}</span>
              </Button>
            ))}
          </div>
          <button type="button" className="min-h-11 text-sm font-bold underline" disabled={!!busy} onClick={() => go("demo")}>
            {busy === "demo" ? "One moment…" : "Or use a fresh demo wallet"}
          </button>
        </div>
      )}
      <Link href="/#how-it-works" className="inline-flex min-h-11 items-center justify-center text-center text-sm text-muted underline">
        How does this work? ›
      </Link>
    </Column>
  );
}

export function LoginScreen() {
  return (
    <Suspense fallback={<Loading />}>
      <LoginInner />
    </Suspense>
  );
}

export function LoggedOutCard({ text = "Log in to see this." }: { text?: string }) {
  return (
    <Card className="grid gap-3 text-center">
      <p className="text-lg font-bold">{text}</p>
      <Button href="/login">Log in</Button>
    </Card>
  );
}
