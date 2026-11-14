import { v3, V3Error, type AuthCallBody, type BuiltPayload, type SubmitResult } from "../v3-client";
import { currentSigner } from "./index";
import { askEnableIntentsKey } from "./intents-key";
import { WalletError, type Signer } from "./types";
import { beginWalletProgress, type WalletPhase } from "./progress";

export const BALANCE_CHANGED_EVENT = "fulfil:balance-changed";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const isKeyMissing = (e: unknown): e is V3Error => e instanceof V3Error && e.code === "intents_key_missing";

/**
 * The server says intents.near does not know this wallet key. Ask the person to enable it
 * (one wallet approval), then sign the same payload again and resubmit.
 */
async function enableKeyAndRetry(
  signer: Signer,
  built: BuiltPayload,
  missing: V3Error,
  progress: (phase: WalletPhase) => void,
): Promise<SubmitResult> {
  if (signer.kind !== "near" || !missing.publicKey) throw missing;
  progress("signing");
  if (!(await askEnableIntentsKey(missing.publicKey)))
    throw new WalletError("OK, nothing was sent. You need to enable NEAR Intents once to continue.", true);
  // The payload is only valid for a few minutes. If it ran out, the key is enabled
  // already, so one more press of the same button builds a fresh one.
  if (Date.parse(built.deadline) - Date.now() < 20_000)
    throw new WalletError("NEAR Intents is enabled for your wallet. Press the button once more to finish.", true);
  const signed = await signer.signIntent(built);
  progress("confirming");
  // The registry can lag a moment behind the confirmation.
  for (let attempt = 0; ; attempt++) {
    try {
      return await v3.submit(signed);
    } catch (e) {
      if (!isKeyMissing(e) || attempt >= 3) throw e;
      await sleep(2_000);
    }
  }
}

/** Ask the wallet to approve a payload, then send it. This is the only place that signs. */
export async function signAndSubmit(built: BuiltPayload): Promise<SubmitResult> {
  const progress = beginWalletProgress();
  try {
    const signer = currentSigner();
    const signed = await signer.signIntent(built);
    progress.update("confirming");
    let result: SubmitResult;
    try {
      result = await v3.submit(signed);
    } catch (e) {
      if (!isKeyMissing(e)) throw e;
      result = await enableKeyAndRetry(signer, built, e, progress.update);
    }
    // Tell the shell (sidebar balance) that money may have moved.
    if (typeof window !== "undefined") window.dispatchEvent(new Event(BALANCE_CHANGED_EVENT));
    return result;
  } finally {
    progress.finish();
  }
}

/** claim, sent, submit_proof, rate, register_fulfiller... */
export async function authCall(body: AuthCallBody): Promise<SubmitResult> {
  return signAndSubmit(await v3.buildAuthCall(body));
}
