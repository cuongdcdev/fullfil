"use client";

import { RequireAccount } from "@/components/v3/auth";
import { WalletScreen } from "@/components/v3/wallet-screen";

export default function WalletPage() {
  return (
    <RequireAccount>
      <WalletScreen />
    </RequireAccount>
  );
}
