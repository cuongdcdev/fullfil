import fs from "node:fs";
import path from "node:path";
import { Marked, type Tokens } from "marked";
import { DOCS, repoBlob, repoTree, type DocEntry } from "./docs-registry";

export type MdHeading = { id: string; label: string; level: 2 | 3 };

/** Find a repo file whether the process cwd is apps/web (dev, build, start) or the repo root. */
function readRepoFile(rel: string) {
  const candidates = [path.join(process.cwd(), "..", "..", rel), path.join(process.cwd(), rel)];
  for (const file of candidates) {
    if (fs.existsSync(file)) return fs.readFileSync(file, "utf8");
  }
  throw new Error(`Doc not found: ${rel} (cwd ${process.cwd()})`);
}

/** Drop YAML frontmatter and HTML comments (PM notes) outside code fences. */
function clean(md: string, frontmatter?: boolean) {
  if (frontmatter) md = md.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "");
  return md
    .split(/(^```[\s\S]*?^```[^\n]*$)/m)
    .map((part, i) => (i % 2 ? part : part.replace(/<!--[\s\S]*?-->/g, "")))
    .join("");
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[`*_]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Render a trusted repo markdown file to HTML plus an h2/h3 outline. Raw HTML is escaped; relative (repo) links become plain code. */
export function renderRepoMarkdown(entry: DocEntry) {
  const md = clean(readRepoFile(entry.path), entry.frontmatter);
  const baseDir = path.posix.dirname(entry.path);
  const headings: MdHeading[] = [];
  const seen = new Map<string, number>();
  const marked = new Marked({ gfm: true });
  marked.use({
    renderer: {
      html({ text }: Tokens.HTML | Tokens.Tag) {
        return esc(text);
      },
      heading(this: any, { tokens, depth, text }: Tokens.Heading) {
        const base = slugify(text) || "section";
        const n = seen.get(base) ?? 0;
        seen.set(base, n + 1);
        const id = n ? `${base}-${n}` : base;
        if (depth === 2 || depth === 3) headings.push({ id, label: text.replace(/[`*_]/g, ""), level: depth });
        return `<h${depth} id="${id}">${this.parser.parseInline(tokens)}</h${depth}>\n`;
      },
      link(this: any, { href, title, tokens }: Tokens.Link) {
        const inner = this.parser.parseInline(tokens);
        // The public site's own docs open in-app, so one absolute link works on GitHub and here.
        const own = href.match(/^https:\/\/fulfil\.junstudio\.xyz(\/docs(?:[/#?].*)?)$/i);
        if (own) return `<a href="${esc(own[1])}">${inner}</a>`;
        if (/^(https?:\/\/|mailto:)/i.test(href)) {
          return `<a href="${esc(href)}"${title ? ` title="${esc(title)}"` : ""} target="_blank" rel="noopener noreferrer">${inner}</a>`;
        }
        if (href.startsWith("#")) return `<a href="${esc(href)}">${inner}</a>`;
        // In-app absolute path (e.g. /docs#verify).
        if (href.startsWith("/")) return `<a href="${esc(href)}">${inner}</a>`;
        // Relative link: published doc -> /docs route; repo file or folder -> GitHub; internal planning or outside the repo -> plain text.
        const [file, hash] = href.split("#");
        const target = file ? path.posix.normalize(path.posix.join(baseDir, file)) : "";
        const isCode = tokens.length === 1 && tokens[0].type === "codespan";
        const plain = () => (isCode ? inner : `${inner} (<code>${esc(target || href)}</code>)`);
        if (!target || target.startsWith("..") || /^docs\/(pm|brainstorm)(\/|$)|^docs\/(PITCH_UI|UX_SPEC|VALIDATION|BUILD_PLAN)\.md$/i.test(target) || /^private(\/|$)/i.test(target)) return plain();
        const doc = DOCS.find((d) => d.path.toLowerCase() === target.toLowerCase());
        if (doc) return `<a href="/docs/${doc.slug}${hash ? `#${esc(hash)}` : ""}">${inner}</a>`;
        const base = path.posix.basename(target);
        const abs = [path.join(process.cwd(), "..", "..", target), path.join(process.cwd(), target)].find((f) => fs.existsSync(f));
        let url: string;
        if (/^(README|SKILL)\.md$/i.test(base) && target !== "README.md") url = repoTree(path.posix.dirname(target));
        else if (abs && fs.statSync(abs).isDirectory()) url = repoTree(target.replace(/\/$/, ""));
        else url = repoBlob(target);
        return `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${inner}</a>`;
      },
    },
  });
  const html = marked.parse(md, { async: false }) as string;
  return { html, headings };
}
