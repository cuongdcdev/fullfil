"use client";

import { Column } from "@/components/requester/common";
import { RequireAccount } from "@/components/v3/auth";
import { PayFlowV3 } from "@/components/v3/pay-flow";

export default function PayPage() {
  return (
    <RequireAccount>
      <Column>
        <PayFlowV3 />
      </Column>
    </RequireAccount>
  );
}
