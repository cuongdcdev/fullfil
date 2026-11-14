"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import Link from "next/link";

/** An in-page anchor (id, scroll-spied) or a link to another docs page (href). */
export type TocItem = { id?: string; href?: string; current?: boolean; external?: boolean; label: string; level?: 2 | 3 };
export type TocGroup = { title?: string; items: TocItem[] };

/** Docs table of contents: sticky left rail on lg+, collapsible "On this page" below lg. Scroll-spy via IntersectionObserver. */
export function DocsToc({ groups }: { groups: TocGroup[] }) {
  const ids = groups.flatMap((g) => g.items.flatMap((i) => (i.id ? [i.id] : [])));
  const [active, setActive] = useState<string | undefined>(ids[0]);
  const [open, setOpen] = useState(false);
  const visible = useRef(new Set<string>());

  useEffect(() => {
    const els = ids.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => !!el);
    const pick = () => {
      const first = ids.find((id) => visible.current.has(id));
      if (first) setActive(first);
    };
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.current.add(e.target.id);
          else visible.current.delete(e.target.id);
        }
        pick();
      },
      { rootMargin: "-72px 0px -60% 0px" },
    );
    els.forEach((el) => io.observe(el));
    const fromHash = () => {
      const h = decodeURIComponent(window.location.hash.slice(1));
      if (ids.includes(h)) setActive(h);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => {
      io.disconnect();
      window.removeEventListener("hashchange", fromHash);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const links = (onPick?: () => void) =>
    groups.map((group) => (
      <div key={group.title ?? "toc"} className="grid content-start gap-1">
        {group.title && <p className="px-2 text-xs font-bold uppercase tracking-wide text-muted">{group.title}</p>}
        <ul className="grid gap-0.5">
          {group.items.map((item) => {
            const on = item.id ? item.id === active : !!item.current;
            const indent = item.level === 3 ? "pl-8 pr-2" : item.level === 2 ? "pl-5 pr-2" : "px-2";
            const cls = `block rounded-md border-l-2 py-1 ${indent} text-[13px] leading-snug no-underline transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--lime-deep)] ${
              on ? "border-[var(--lime-deep)] bg-soft font-semibold text-ink" : "border-transparent text-muted hover:bg-soft hover:text-ink"
            }`;
            return (
              <li key={item.id ?? item.href}>
                {item.external ? (
                  <a href={item.href} target="_blank" rel="noopener noreferrer" className={cls}>
                    {item.label} <span aria-hidden>↗</span>
                    <span className="sr-only"> (opens GitHub)</span>
                  </a>
                ) : item.href ? (
                  <Link href={item.href} onClick={() => onPick?.()} aria-current={item.current ? "page" : undefined} className={cls}>
                    {item.label}
                  </Link>
                ) : (
                  <a
                    href={`#${item.id}`}
                    onClick={() => {
                      setActive(item.id!);
                      onPick?.();
                    }}
                    aria-current={on ? "location" : undefined}
                    className={cls}
                  >
                    {item.label}
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    ));

  return (
    <div className="lg:sticky lg:top-6 lg:self-start">
      <details open={open} onToggle={(e) => setOpen(e.currentTarget.open)} className="rounded-xl border border-line bg-panel lg:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between rounded-xl px-4 py-3 text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--lime-deep)] [&::-webkit-details-marker]:hidden">
          On this page
          <ChevronDown size={16} aria-hidden className={`transition-transform ${open ? "rotate-180" : ""}`} />
        </summary>
        <nav aria-label="On this page" className="grid gap-4 border-t border-line p-3">
          {links(() => setOpen(false))}
        </nav>
      </details>
      <nav aria-label="On this page" className="hidden max-h-[calc(100vh-3rem)] gap-4 overflow-y-auto pr-2 lg:grid">
        {links()}
      </nav>
    </div>
  );
}
