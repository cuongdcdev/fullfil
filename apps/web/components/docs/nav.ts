import { DOCS, DOC_GROUPS, REPO_URL, repoTree } from "@/lib/docs-registry";
import type { TocGroup, TocItem } from "./toc";

/** Guides + Reference page lists from the registry. Under the current page, its own headings are nested. */
export function docsNavGroups({ current, headings = [] }: { current?: string; headings?: { id: string; label: string; level: 2 | 3 }[] }): TocGroup[] {
  const groups = DOC_GROUPS.map((group) => ({
    title: group,
    items: DOCS.filter((d) => d.group === group).flatMap((d): TocItem[] => {
      const page: TocItem = { href: `/docs/${d.slug}`, label: d.title, current: d.slug === current };
      return d.slug === current ? [page, ...headings.map((h) => ({ id: h.id, label: h.label, level: h.level }))] : [page];
    }),
  }));
  const source: TocGroup = {
    title: "Source code",
    items: [
      { href: REPO_URL, label: "Repository", external: true },
      { href: repoTree("skills/fulfil-token-buy"), label: "Agent skill", external: true },
      { href: repoTree("contracts/escrow"), label: "Escrow contract", external: true },
      { href: repoTree("workers"), label: "Verifiers (workers/)", external: true },
    ],
  };
  return [...groups, source];
}
