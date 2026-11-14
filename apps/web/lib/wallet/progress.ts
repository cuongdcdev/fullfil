export type WalletPhase = "idle" | "signing" | "confirming";

let phase: WalletPhase = "idle";
let currentAction = 0;
const listeners = new Set<() => void>();

export const walletPhase = () => phase;
export const serverWalletPhase = (): WalletPhase => "idle";

export function subscribeWalletPhase(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Presentation only: never submits, retries, or changes the result of an action. */
export function beginWalletProgress() {
  const action = ++currentAction;
  const update = (next: WalletPhase) => {
    if (action !== currentAction) return;
    phase = next;
    for (const listener of listeners) listener();
  };
  update("signing");
  return { update, finish: () => update("idle") };
}
