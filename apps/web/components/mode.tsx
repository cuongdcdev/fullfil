"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { flushSync } from "react-dom";

export type Mode = "requester" | "earn";
export type Theme = "light" | "dark";
/** What the person chose. "system" follows the browser. */
export type ThemePref = "system" | "light" | "dark";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
}

type Ctx = {
  mode: Mode;
  setMode: (mode: Mode) => void;
  /** The look in use right now (system already resolved). */
  theme: Theme;
  themePref: ThemePref;
  setTheme: (pref: ThemePref) => void;
  /** Flip light/dark with a circular reveal from `origin` (the clicked button). */
  toggleTheme: (origin?: HTMLElement | null) => void;
  persona: string;
  setPersona: (persona: string) => void;
};
const ModeContext = createContext<Ctx | null>(null);

export function ModeProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [mode, setModeState] = useState<Mode>("requester");
  const [themePref, setPref] = useState<ThemePref>("system");
  const [systemDark, setSystemDark] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const theme: Theme = themePref === "system" ? (systemDark ? "dark" : "light") : themePref;
  const [persona, setPersonaState] = useState("buyer");
  useEffect(() => {
    if (read("fulfil-mode") === "earn") setModeState("earn");
    const stored = read("fulfil-theme");
    setPref(stored === "dark" || stored === "light" ? stored : "system");
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemDark(query.matches);
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    query.addEventListener("change", onChange);
    setPersonaState(read("fulfil-persona") || "buyer");
    setHydrated(true);
    return () => query.removeEventListener("change", onChange);
  }, []);
  useEffect(() => {
    // The inline script in <head> already set the right look before paint; only take over after state is loaded.
    if (hydrated) document.documentElement.dataset.theme = theme;
  }, [theme, hydrated]);
  const setMode = useCallback(
    (next: Mode) => {
      setModeState(next);
      write("fulfil-mode", next);
      router.push(next === "earn" ? "/earn" : "/");
    },
    [router],
  );
  const setTheme = useCallback((next: ThemePref) => {
    setPref(next);
    try {
      if (next === "system") localStorage.removeItem("fulfil-theme");
      else localStorage.setItem("fulfil-theme", next);
    } catch {
      /* storage unavailable */
    }
  }, []);
  const toggleTheme = useCallback(
    (origin?: HTMLElement | null) => {
      const next: Theme = theme === "dark" ? "light" : "dark";
      const apply = () => {
        flushSync(() => setTheme(next));
        document.documentElement.dataset.theme = next;
      };
      const doc = document as Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void> } };
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!doc.startViewTransition || reduced) return apply();
      const box = origin?.getBoundingClientRect();
      const x = box ? box.left + box.width / 2 : window.innerWidth / 2;
      const y = box ? box.top + box.height / 2 : 0;
      const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
      const transition = doc.startViewTransition(apply);
      void transition.ready.then(() => {
        document.documentElement.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
          { duration: 550, easing: "cubic-bezier(0.22, 1, 0.36, 1)", pseudoElement: "::view-transition-new(root)" },
        );
      });
    },
    [theme, setTheme],
  );
  const setPersona = useCallback((next: string) => {
    setPersonaState(next);
    write("fulfil-persona", next);
    window.dispatchEvent(new CustomEvent("fulfil-persona", { detail: next }));
  }, []);
  return (
    <ModeContext.Provider
      value={{ mode, setMode, theme, themePref, setTheme, toggleTheme, persona, setPersona }}
    >
      {children}
    </ModeContext.Provider>
  );
}

export function useMode() {
  const ctx = useContext(ModeContext);
  if (!ctx) throw new Error("useMode outside ModeProvider");
  return ctx;
}

/** Buyer / Fulfiller switch (segmented control). */
export function ModeSwitch({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  const { mode: stored, setMode } = useMode();
  const mode: Mode = usePathname().startsWith("/earn") ? "earn" : stored;
  const opts: { id: Mode; label: string }[] = [
    { id: "requester", label: "Buyer" },
    { id: "earn", label: "Fulfiller" },
  ];
  return (
    <div role="group" aria-label="Mode" className={`inline-flex rounded-full border border-line bg-soft ${compact ? "p-0.5" : "p-1"} ${className}`}>
      {opts.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={mode === o.id}
          onClick={() => mode !== o.id && setMode(o.id)}
          className={`${compact ? "min-h-7 px-2.5 text-xs" : "min-h-9 px-3 text-sm sm:px-4"} flex-1 rounded-full font-semibold transition-colors ${mode === o.id ? "bg-brand text-brand-fg shadow-card" : "text-muted hover:text-ink"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
