/** Single source for the markdown pages published under /docs/<slug>. Paths are relative to the MVP repo root. */
export type DocEntry = {
  slug: string;
  path: string;
  title: string;
  group: "Guides" | "Reference";
  description: string;
  /** Strip a leading YAML frontmatter block. */
  frontmatter?: boolean;
};

export const DOCS: DocEntry[] = [
  { slug: "verifier", path: "docs/BUILD_A_VERIFIER.md", title: "Build a verifier", group: "Guides", description: "Add a bank, country or proof type." },
  { slug: "become-a-fulfiller", path: "docs/BECOME_A_FULFILLER.md", title: "Become a fulfiller", group: "Guides", description: "Get listed and start earning." },
  { slug: "demo", path: "docs/DEMO.md", title: "Demo walkthrough", group: "Guides", description: "Run the demo end to end." },
  { slug: "overview", path: "README.md", title: "Project overview", group: "Reference", description: "What Fulfil is and how it is laid out." },
  { slug: "architecture", path: "docs/ARCHITECTURE.md", title: "Architecture", group: "Reference", description: "Components and data flow." },
  { slug: "integrations", path: "docs/INTEGRATIONS.md", title: "Integrations", group: "Reference", description: "External services and notes." },
  { slug: "environment", path: "docs/ENV.md", title: "Environment variables", group: "Reference", description: "Configuration reference." },
];

export const REPO_URL = "https://github.com/cuongdcdev/fullfil";
export const repoBlob = (p: string) => `${REPO_URL}/blob/master/${p}`;
export const repoTree = (p: string) => `${REPO_URL}/tree/master/${p}`;

export const DOC_GROUPS = ["Guides", "Reference"] as const;
export const docBySlug = (slug: string) => DOCS.find((d) => d.slug === slug);
