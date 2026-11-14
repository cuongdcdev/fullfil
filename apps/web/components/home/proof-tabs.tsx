"use client";

import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";

type Tab = { id: string; label: string; panel: ReactNode };

/** Two tabs with the WAI-ARIA pattern: roving tabindex, arrow keys, Home and End. */
export function ProofTabs({ tabs }: { tabs: Tab[] }) {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const select = (index: number) => {
    const next = (index + tabs.length) % tabs.length;
    setActive(next);
    refs.current[next]?.focus();
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "ArrowRight") { event.preventDefault(); select(active + 1); }
    else if (event.key === "ArrowLeft") { event.preventDefault(); select(active - 1); }
    else if (event.key === "Home") { event.preventDefault(); select(0); }
    else if (event.key === "End") { event.preventDefault(); select(tabs.length - 1); }
  };
  return (
    <div className="grid gap-4">
      <div role="tablist" aria-label="Proof on mainnet" onKeyDown={onKeyDown}
        className="flex w-full gap-1 rounded-full border border-line bg-soft p-1 sm:w-max">
        {tabs.map((tab, index) => (
          <button key={tab.id} ref={(node) => { refs.current[index] = node; }} type="button" role="tab" id={`proof-tab-${tab.id}`}
            aria-selected={active === index} aria-controls={`proof-panel-${tab.id}`} tabIndex={active === index ? 0 : -1}
            onClick={() => setActive(index)}
            className={`min-h-10 flex-1 whitespace-nowrap rounded-full px-4 text-sm font-semibold transition-colors sm:flex-none sm:px-5 ${active === index ? "bg-brand text-brand-fg shadow-card" : "text-muted hover:text-ink"}`}>
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab, index) => (
        <div key={tab.id} role="tabpanel" id={`proof-panel-${tab.id}`} aria-labelledby={`proof-tab-${tab.id}`} hidden={active !== index} tabIndex={0}
          className={active === index ? "demo-screen grid gap-4 outline-offset-4" : "hidden"}>
          {tab.panel}
        </div>
      ))}
    </div>
  );
}
