import type { Metadata } from "next";
import { Figtree } from "next/font/google";
import "./globals.css";

const figtree = Figtree({ subsets: ["latin", "latin-ext"], variable: "--font-sans", display: "swap" });
import { AppShell } from "@/components/app-shell";

export const metadata: Metadata = {
  title: "Fulfil — Your Intents in real world, powered by NEAR Intents",
  description:
    "Bonded local fulfillers for AI agents, with verifiable evidence, checked by code and a TEE, and a human arbiter for rare disputes.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={figtree.variable}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('fulfil-theme');document.documentElement.setAttribute('data-theme',t==='dark'||t==='light'?t:(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'))}catch(e){}try{if(new URLSearchParams(location.search).get('embed')==='1'){sessionStorage.setItem('fulfil-embed','1')}if(sessionStorage.getItem('fulfil-embed')==='1'&&window.self!==window.top)document.documentElement.setAttribute('data-embed','1')}catch(e){}",
          }}
        />
      </head>
      <body>
        <a href="#main" className="skip-link">Skip to content</a>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
