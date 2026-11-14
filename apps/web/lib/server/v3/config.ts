export const USDC_TOKEN =
  "nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1";

export function mode(): "mock" | "live" {
  const value = process.env.FULFIL_MODE;
  if (value === "mock" || value === "live") return value;
  return process.env.OUTLAYER_API_KEY ? "live" : "mock";
}

export const escrowContract = () =>
  process.env.ESCROW_CONTRACT || "nearfullfil.near";
export const intentsContract = () =>
  process.env.INTENTS_CONTRACT || "intents.near";
export const rpcUrl = () =>
  process.env.NEAR_RPC_URL || "https://rpc.mainnet.fastnear.com";

/** Fallback RPCs used when the primary one is rate limited or down. */
const FALLBACK_RPC_URLS = [
  "https://rpc.mainnet.fastnear.com",
  "https://rpc.shitzuapes.xyz",
  "https://rpc.intea.rs",
  "https://near.drpc.org",
];

/** NEAR_RPC_URL may be a comma list; public fallbacks follow it, deduped. */
export const rpcUrls = () => [
  ...new Set([
    ...(process.env.NEAR_RPC_URL || "").split(",").map((u) => u.trim()).filter(Boolean),
    ...FALLBACK_RPC_URLS,
  ]),
];
export const oneClickUrl = () =>
  process.env.INTENTS_1CLICK_BASE_URL || "https://1click.chaindefuser.com";
export const outlayerUrl = () =>
  process.env.OUTLAYER_API_URL || "https://api.outlayer.ai";
export const browserUserAgent =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
