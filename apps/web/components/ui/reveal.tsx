"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

/**
 * Fade-up on first scroll into view. Progressive enhancement: content is visible in the server HTML
 * (no JS, reduced motion, or already above the fold = never hidden). Only elements below the fold are
 * hidden after hydration, then revealed once. State lives in a DOM attribute, so there is no hydration mismatch.
 */
export function Reveal({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight) return;
    el.dataset.reveal = "hidden";
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        el.dataset.reveal = "shown";
        io.disconnect();
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`reveal ${className}`} style={delay ? ({ "--reveal-delay": `${delay}ms` } as CSSProperties) : undefined}>
      {children}
    </div>
  );
}
