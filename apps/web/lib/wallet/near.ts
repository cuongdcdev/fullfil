import type { BuiltPayload, Challenge, SignedIntent } from "../v3-client";
import { base64ToBytes } from "../v3-client";
import { WalletError, type Signer } from "./types";
import nearWallets from "./near-wallets.json";

type Connector = import("@hot-labs/near-connect").NearConnector;
type NearConnectorOptions = NonNullable<ConstructorParameters<typeof import("@hot-labs/near-connect").NearConnector>[0]>;
let connector: Promise<Connector> | undefined;

/**
 * NEAR wallets offered in the selector: HOT, Meteor, Intear. The manifest is stored locally
 * (near-wallets.json, copied from hot-dao/near-selector) instead of fetched from GitHub at runtime,
 * so new upstream wallets never appear. Each wallet's executor script is still loaded from its URL.
 */
const ALLOWED_NEAR_WALLETS = new Set(nearWallets.wallets.map((w) => w.id));

/** One connector per page. Loaded on demand so it never runs on the server. */
export function nearConnector(): Promise<Connector> {
  connector ??= import("@hot-labs/near-connect").then(({ NearConnector }) => {
    class AllowlistedConnector extends NearConnector {
      // Browser-extension wallets inject themselves outside the manifest; keep the popup to the allowlist.
      override get availableWallets() {
        return super.availableWallets.filter((w) => ALLOWED_NEAR_WALLETS.has(w.manifest.id));
      }
    }
    return new AllowlistedConnector({
      network: "mainnet",
      features: { signMessage: true },
      manifest: nearWallets as unknown as NearConnectorOptions["manifest"],
    });
  });
  return connector;
}

/** signer_id inside the NEP-413 intent message, if it parses. */
function signerIdOf(message: string): string | undefined {
  try {
    const id = (JSON.parse(message) as { signer_id?: unknown }).signer_id;
    return typeof id === "string" ? id : undefined;
  } catch {
    return undefined;
  }
}

const withPrefix = (k: string) => (k.startsWith("ed25519:") ? k : `ed25519:${k}`);

export function describe(e: unknown): WalletError {
  if (e instanceof WalletError) return e;
  const message = (e as { message?: string })?.message || "";
  if (/no accounts|no wallet selected|not signed in|not connected/i.test(message)) {
    return new WalletError("Connect your wallet to continue.", false, true);
  }
  if (/reject|cancel|denied|closed/i.test(message)) return new WalletError("You cancelled in your wallet.", true);
  if (/timeout|timed out/i.test(message)) return new WalletError("Your wallet took too long. Try again.");
  return new WalletError("Your wallet could not do that. Try again.");
}

export async function nearWalletConnected(accountId: string): Promise<boolean> {
  try {
    const { accounts } = await (await nearConnector()).getConnectedWallet();
    return accounts.some((account) => account.accountId === accountId);
  } catch {
    return false;
  }
}

export async function reconnectNear(accountId: string): Promise<void> {
  try {
    const wallet = await (await nearConnector()).connect();
    if (!(await wallet.getAccounts()).some((account) => account.accountId === accountId)) {
      throw new WalletError("Connect the wallet you used to log in.", false, true);
    }
  } catch (e) {
    throw describe(e);
  }
}

/** Open the wallet picker, then sign the login challenge. Returns a signer and the /auth/verify body. */
export async function connectNear(challenge: Challenge): Promise<{ signer: Signer; body: Record<string, unknown> }> {
  try {
    const c = await nearConnector();
    const wallet = await c.connect();
    const accounts = await wallet.getAccounts();
    const accountId = accounts[0]?.accountId;
    if (!accountId) throw new WalletError("No account was shared.");
    const signed = await wallet.signMessage({
      message: challenge.message,
      recipient: challenge.recipient,
      nonce: base64ToBytes(challenge.nonce),
    });
    const body = {
      standard: "nep413",
      account_id: signed.accountId || accountId,
      public_key: withPrefix(signed.publicKey),
      signature: signed.signature,
      message: challenge.message,
      nonce: challenge.nonce,
      recipient: challenge.recipient,
    };
    return { signer: nearSigner(), body };
  } catch (e) {
    throw e instanceof WalletError ? e : describe(e);
  }
}

export function nearSigner(): Signer {
  return {
    kind: "near",
    standard: "nep413",
    async signLogin(challenge) {
      return (await connectNear(challenge)).body;
    },
    async signIntent(built: BuiltPayload): Promise<SignedIntent> {
      if (typeof built.payload_to_sign === "string") throw new WalletError("Wrong signing format.");
      const p = built.payload_to_sign;
      try {
        const c = await nearConnector();
        const wallet = (await c.getConnectedWallet()).wallet;
        const signed = await wallet.signMessage({
          message: p.message,
          recipient: p.recipient,
          nonce: base64ToBytes(p.nonce),
        });
        // Multi-account wallets (HOT) sign with whichever account is active in the wallet,
        // not the one logged in here. That key is not ours, so enabling it for NEAR Intents
        // can never help: say so instead of asking to enable it.
        const expected = signerIdOf(p.message);
        if (signed.accountId && expected && signed.accountId.toLowerCase() !== expected.toLowerCase())
          throw new WalletError(
            `Your wallet signed as ${signed.accountId}, but you are logged in as ${expected}. Switch to ${expected} in your wallet and try again, or log out and log in with ${signed.accountId}.`,
          );
        return {
          standard: "nep413",
          payload: p,
          public_key: withPrefix(signed.publicKey),
          signature: signed.signature,
        };
      } catch (e) {
        throw describe(e);
      }
    },
  };
}

/** intents.near registry: add the key your wallet signs with. 1 yoctoNEAR + gas, paid by the user. */
export async function enableIntentsKey(publicKey: string): Promise<void> {
  try {
    const wallet = (await (await nearConnector()).getConnectedWallet()).wallet;
    await wallet.signAndSendTransaction({
      receiverId: "intents.near",
      actions: [
        {
          type: "FunctionCall",
          params: {
            methodName: "add_public_key",
            args: { public_key: withPrefix(publicKey) },
            gas: "30000000000000",
            deposit: "1",
          },
        },
      ],
    });
  } catch (e) {
    console.warn("[fulfil] add_public_key failed", e);
    throw describe(e);
  }
}

export async function disconnectNear() {
  try {
    const c = await nearConnector();
    await c.disconnect();
  } catch {
    /* already disconnected */
  }
}
