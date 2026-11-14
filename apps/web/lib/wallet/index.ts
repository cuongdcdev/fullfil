import { v3, type SessionInfo } from "../v3-client";
import { demoSigner, forgetDemoKey } from "./demo";
import { connectInjected, injectedSigner } from "./evm";
import { connectNear, disconnectNear, nearSigner } from "./near";
import { WalletError, type Signer, type WalletKind } from "./types";

export * from "./types";
const KIND = "fulfil-wallet-kind";
const ADDRESS = "fulfil-wallet-address";

const read = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string | null) => {
  try {
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {
    /* ignore */
  }
};

let current: Signer | undefined;

/** The signer for the wallet used at login, rebuilt after a page reload. */
export function currentSigner(): Signer {
  if (current) return current;
  const kind = read(KIND) as WalletKind | null;
  if (kind === "demo") return (current = demoSigner());
  if (kind === "evm") {
    const address = read(ADDRESS);
    if (address) return (current = injectedSigner(address));
  }
  if (kind === "near") return (current = nearSigner());
  throw new WalletError("Please log in again.");
}

/** Log in with a wallet: ask it to sign the challenge, then send it to the server. */
export async function loginWith(kind: WalletKind): Promise<SessionInfo> {
  let signer: Signer;
  let body: Record<string, unknown>;
  if (kind === "demo") {
    // Demo wallet: the server's dev-login makes the session; the local key signs everything after.
    signer = demoSigner();
    const challenge = await v3.challenge();
    const address = (await signer.signLogin(challenge)).address as string;
    const session = await v3.devLogin(address, "erc191");
    current = signer;
    write(KIND, "demo");
    return session;
  }
  const challenge = await v3.challenge();
  if (kind === "near") {
    ({ signer, body } = await connectNear(challenge));
  } else {
    const address = await connectInjected();
    signer = injectedSigner(address);
    body = await signer.signLogin(challenge);
    write(ADDRESS, address);
  }
  const session = await v3.verify(body);
  current = signer;
  write(KIND, kind);
  return session;
}

export async function logout() {
  const kind = read(KIND);
  current = undefined;
  write(KIND, null);
  write(ADDRESS, null);
  if (kind === "near") await disconnectNear();
  if (kind === "demo") forgetDemoKey();
  await v3.logout().catch(() => undefined);
}

export const walletKind = () => read(KIND) as WalletKind | null;
