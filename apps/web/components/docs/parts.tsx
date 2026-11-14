import type { ReactNode } from "react";
import { repoBlob, repoTree } from "@/lib/docs-registry";

export const TELEGRAM_URL = "https://t.me/nearcatalogchat";
export const ESCROW = "nearfullfil.near";
export const tx = (hash: string) => `https://nearblocks.io/txns/${hash}`;

export function GroupHeading({ children }: { children: ReactNode }) {
  return <h2 className="mt-4 scroll-mt-20 border-b border-line pb-2 text-2xl font-black tracking-tight">{children}</h2>;
}

/** One docs section. The id is the anchor other pages link to. */
export function Section({ id, title, badge, children }: { id: string; title: string; badge?: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="grid scroll-mt-20 gap-3 text-sm leading-relaxed">
      <h3 id={`${id}-title`} className="text-xl font-black">
        {title}
        {badge && <span className="ml-2 rounded-full bg-soft px-2 py-0.5 align-middle text-xs font-bold">{badge}</span>}
      </h3>
      {children}
    </section>
  );
}

export function Code({ children }: { children: ReactNode }) {
  return <code className="rounded bg-soft px-1 py-0.5 text-[0.85em]">{children}</code>;
}

export function Ext({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="font-bold underline">
      {children}
    </a>
  );
}

/** Link to a file or folder in the public GitHub repository. */
export function Repo({ path }: { path: string }) {
  const href = /\.[a-z0-9]+$/i.test(path) ? repoBlob(path) : repoTree(path);
  return (
    <Ext href={href}>
      <Code>{path}</Code>
    </Ext>
  );
}

export function Callout({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warn" }) {
  const cls = tone === "warn" ? "border-amber-500 bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200" : "border-brand bg-panel";
  return <div className={`rounded-xl border-2 p-3 ${cls}`}>{children}</div>;
}

export function Steps({ items }: { items: ReactNode[] }) {
  return (
    <ol className="grid gap-2">
      {items.map((item, index) => (
        <li key={index} className="flex gap-3">
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand text-xs font-bold text-brand-fg">{index + 1}</span>
          <span>{item}</span>
        </li>
      ))}
    </ol>
  );
}
