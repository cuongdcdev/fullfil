"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, BottomSheet } from "@/components/ui/kit";
import { registerIntentsKeyAsker } from "@/lib/wallet/intents-key";
import { enableIntentsKey } from "@/lib/wallet/near";
import { WalletError } from "@/lib/wallet";

/**
 * One-time setup step. Shown when NEAR Intents (the settlement layer Fulfil uses)
 * does not know the key your wallet signs with. Mounted once in the app shell.
 */
export function IntentsKeyHost() {
  const [publicKey, setPublicKey] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const settle = useRef<((ok: boolean) => void) | undefined>(undefined);

  useEffect(
    () =>
      registerIntentsKeyAsker(
        (key) =>
          new Promise<boolean>((resolve) => {
            settle.current?.(false);
            settle.current = resolve;
            setNote("");
            setPublicKey(key);
          }),
      ),
    [],
  );

  const close = useCallback((ok: boolean) => {
    settle.current?.(ok);
    settle.current = undefined;
    setPublicKey(undefined);
    setBusy(false);
  }, []);

  const enable = async () => {
    if (!publicKey) return;
    setBusy(true);
    setNote("");
    try {
      await enableIntentsKey(publicKey);
      close(true);
    } catch (e) {
      setBusy(false);
      setNote(
        e instanceof WalletError && e.userCancelled
          ? "No problem. Nothing was changed. Press the button when you are ready."
          : e instanceof WalletError
            ? e.message
            : "Your wallet could not do that. Try again.",
      );
    }
  };

  return (
    <BottomSheet open={!!publicKey} onClose={() => close(false)} title="One-time setup: enable NEAR Intents">
      <div className="grid gap-4 text-sm">
        <p>
          Your wallet key isn&apos;t set up for NEAR Intents (the settlement layer Fulfil uses) yet. Approve one small
          transaction (1 yoctoNEAR + gas, under 0.001 NEAR), then we&apos;ll ask you to sign again.{" "}
          <Link href="/docs#enable-intents" className="font-bold underline" target="_blank" rel="noopener noreferrer">
            Learn more
          </Link>
        </p>
        {note && (
          <p role="status" className="rounded-lg bg-soft p-3 text-muted">
            {note}
          </p>
        )}
        <Button full onClick={enable} disabled={busy}>
          {busy ? "Waiting for your wallet..." : "Enable and try again"}
        </Button>
        <Button full variant="ghost" onClick={() => close(false)} disabled={busy}>
          Not now
        </Button>
      </div>
    </BottomSheet>
  );
}
