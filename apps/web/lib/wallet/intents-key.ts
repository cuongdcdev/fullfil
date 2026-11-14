/**
 * Bridge between signAndSubmit() (no UI) and <IntentsKeyHost/> (the dialog).
 * When intents.near does not know the wallet key, signAndSubmit asks here.
 */
type Asker = (publicKey: string) => Promise<boolean>;
let asker: Asker | undefined;

export function registerIntentsKeyAsker(next: Asker | undefined) {
  asker = next;
  return () => {
    if (asker === next) asker = undefined;
  };
}

/** Resolves true once the key is enabled, false if the person declined. */
export async function askEnableIntentsKey(publicKey: string): Promise<boolean> {
  return asker ? asker(publicKey) : false;
}
