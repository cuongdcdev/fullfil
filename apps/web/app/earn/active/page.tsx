"use client";

import { RequireAccount } from "@/components/v3/auth";
import { ActiveScreenV3 } from "@/components/v3/earn";

export default function Page() {
  return (
    <RequireAccount>
      <ActiveScreenV3 />
    </RequireAccount>
  );
}
