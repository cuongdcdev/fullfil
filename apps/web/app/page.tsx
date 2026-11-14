import Link from "next/link";
import { HomeTop } from "@/components/home/home-top";
import { Judges } from "@/components/home/judges";
import { AutoRefresh } from "@/components/ui/auto-refresh";
import { getMainnetState } from "@/lib/server/mainnet-store";

export const dynamic = "force-dynamic";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ live?: string }> }) {
  const { live: force } = await searchParams;
  // `?live=off` simulates a failed mainnet read (development only), to check the fallback state.
  const off = process.env.NODE_ENV !== "production" && force === "off";
  // Reads the stored snapshot instantly. Anything stale is refreshed in the background, never awaited here.
  const { snapshot, refreshing } = off ? { snapshot: null, refreshing: false } : getMainnetState();
  const loading = !snapshot && refreshing;
  return (
    <div className="page grid gap-12">
      <div className="grid gap-8">
        <HomeTop />
      </div>
      <Judges live={snapshot} loading={loading} />
      <footer className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 border-t border-line pt-6 text-sm">
        <Link href="/docs" className="min-h-11 inline-flex items-center font-bold text-lime-deep underline underline-offset-4">Docs</Link>
        <Link href="/fulfillers" className="min-h-11 inline-flex items-center font-bold text-lime-deep underline underline-offset-4">Fulfillers</Link>
      </footer>
      <AutoRefresh active={loading} />
    </div>
  );
}
