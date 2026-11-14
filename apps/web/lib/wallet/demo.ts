import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { evmSigner } from "./evm";
import type { Signer } from "./types";

const KEY = "fulfil-demo-key";

/**
 * Demo wallet: a throwaway key made in this browser, for mock mode only.
 * It never holds real money. It lets judges try the whole app without installing a wallet.
 */
export function demoSigner(): Signer {
  let key: `0x${string}` | null = null;
  try {
    key = localStorage.getItem(KEY) as `0x${string}` | null;
  } catch {
    /* storage unavailable */
  }
  if (!key) {
    key = generatePrivateKey();
    try {
      localStorage.setItem(KEY, key);
    } catch {
      /* private mode: the key lives only for this page */
    }
  }
  const account = privateKeyToAccount(key);
  return evmSigner("demo", account.address, (message) => account.signMessage({ message }));
}

export function forgetDemoKey() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
