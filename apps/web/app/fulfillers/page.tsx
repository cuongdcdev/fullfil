import type { Metadata } from "next";
import { FulfillersDirectory } from "@/components/fulfillers/directory";
import { AutoRefresh } from "@/components/ui/auto-refresh";
import { getDirectory } from "@/lib/server/fulfillers-directory";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Meet the fulfillers · Fulfil" };

export default async function FulfillersPage({ searchParams }: { searchParams: Promise<{ live?: string }> }) {
  const { live: force } = await searchParams;
  // `?live=off` simulates a failed mainnet read (development only).
  const { entries, live, loading, updatedAt } = getDirectory(process.env.NODE_ENV !== "production" && force === "off");
  return (
    <>
      <FulfillersDirectory entries={entries} live={live} loading={loading} updatedAt={updatedAt} />
      <AutoRefresh active={loading} />
    </>
  );
}
