"use client";

import { RequireAccount } from "@/components/v3/auth";
import { EarningsScreenV3 } from "@/components/v3/earn";

export default function Page() {
  return (
    <RequireAccount>
      <EarningsScreenV3 />
    </RequireAccount>
  );
}
