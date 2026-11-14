import { RequireAccount } from "@/components/v3/auth";
import { JobsScreenV3 } from "@/components/v3/earn";
import { NetworkJobs } from "@/components/earn/network-jobs";
import { AutoRefresh } from "@/components/ui/auto-refresh";
import { getDirectory } from "@/lib/server/fulfillers-directory";
import { getMainnetState } from "@/lib/server/mainnet-store";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ live?: string }> }) {
  const { live: force } = await searchParams;
  // `?live=off` simulates a failed mainnet read (development only).
  const off = process.env.NODE_ENV !== "production" && force === "off";
  const { snapshot, refreshing } = off ? { snapshot: null, refreshing: false } : getMainnetState();
  const { entries } = getDirectory(off);
  const loading = !snapshot && refreshing;
  return (
    <>
      <RequireAccount>
        <JobsScreenV3 />
      </RequireAccount>
      <div className="page">
        <div className="mx-auto max-w-[1040px]">
          <NetworkJobs live={snapshot} directory={entries} loading={loading} />
        </div>
      </div>
      <AutoRefresh active={loading} />
    </>
  );
}
