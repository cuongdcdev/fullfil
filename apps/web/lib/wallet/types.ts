import type { BuiltPayload, Challenge, SignedIntent, Standard } from "../v3-client";

export type WalletKind = "near" | "evm" | "demo";

/** One signed-in wallet. It can prove who you are and approve payloads. */
export interface Signer {
  kind: WalletKind;
  standard: Standard;
  /** Sign the login challenge. Returns the body for POST /auth/verify. */
  signLogin(challenge: Challenge): Promise<Record<string, unknown>>;
  /** Sign a payload returned by the backend. Returns the body for POST /intents/submit. */
  signIntent(built: BuiltPayload): Promise<SignedIntent>;
}

export class WalletError extends Error {
  constructor(
    message: string,
    public userCancelled = false,
    public needsConnect = false,
  ) {
    super(message);
    this.name = "WalletError";
  }
}
