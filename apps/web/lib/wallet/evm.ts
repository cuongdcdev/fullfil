import { toHex } from "viem";
import type { BuiltPayload, Challenge, SignedIntent } from "../v3-client";
import { WalletError, type Signer } from "./types";

type Eip1193 = { request(args: { method: string; params?: unknown[] }): Promise<unknown> };

export function injectedEthereum(): Eip1193 | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { ethereum?: Eip1193 }).ethereum;
}

function describe(e: unknown): WalletError {
  const err = e as { code?: number; message?: string };
  if (err?.code === 4001) return new WalletError("You cancelled in your wallet.", true);
  return new WalletError(err?.message || "Your wallet could not do that.");
}

/** Ask MetaMask (or any injected wallet) for an account. Returns the lower-case address. */
export async function connectInjected(): Promise<string> {
  const eth = injectedEthereum();
  if (!eth) throw new WalletError("No Ethereum wallet found. Install MetaMask, or use the demo login.");
  try {
    const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
    if (!accounts?.[0]) throw new WalletError("No account was shared.");
    return accounts[0].toLowerCase();
  } catch (e) {
    throw e instanceof WalletError ? e : describe(e);
  }
}

/** Build a signer from any function that does ERC-191 personal_sign over a text message. */
export function evmSigner(
  kind: "evm" | "demo",
  address: string,
  sign: (message: string) => Promise<string>,
): Signer {
  const addr = address.toLowerCase();
  return {
    kind,
    standard: "erc191",
    async signLogin(challenge: Challenge) {
      const signature = await sign(challenge.message);
      return { standard: "erc191", address: addr, signature, message: challenge.message };
    },
    async signIntent(built: BuiltPayload): Promise<SignedIntent> {
      if (typeof built.payload_to_sign !== "string") throw new WalletError("Wrong signing format.");
      const signature = await sign(built.payload_to_sign);
      return { standard: "erc191", payload: built.payload_to_sign, signature };
    },
  };
}

export function injectedSigner(address: string): Signer {
  return evmSigner("evm", address, async (message) => {
    const eth = injectedEthereum();
    if (!eth) throw new WalletError("Your Ethereum wallet is not available.");
    try {
      return (await eth.request({ method: "personal_sign", params: [toHex(message), address] })) as string;
    } catch (e) {
      throw describe(e);
    }
  });
}
