import Link from "next/link";
import { notFound } from "next/navigation";
import { DocsToc } from "@/components/docs/toc";
import { docsNavGroups } from "@/components/docs/nav";
import { DOCS, docBySlug } from "@/lib/docs-registry";
import { renderRepoMarkdown } from "@/lib/md-doc";

// Pre-rendered at build time: the markdown is read once, nothing is read at runtime.
export const dynamicParams = false;
export const generateStaticParams = () => DOCS.map((d) => ({ slug: d.slug }));

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const doc = docBySlug((await params).slug);
  return { title: doc ? `${doc.title} | Docs` : "Docs", description: doc?.description };
}

export default async function DocPage({ params }: { params: Promise<{ slug: string }> }) {
  const doc = docBySlug((await params).slug);
  if (!doc) notFound();
  const { html, headings } = renderRepoMarkdown(doc);
  return (
    <div className="page grid gap-6">
      <Link href="/docs" className="inline-flex w-fit items-center gap-1 text-sm font-bold text-muted hover:text-ink">
        ← Docs
      </Link>
      <div className="grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-12">
        <DocsToc groups={docsNavGroups({ current: doc.slug, headings })} />
        <article className="md-doc min-w-0 max-w-[75ch]" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>
  );
}
