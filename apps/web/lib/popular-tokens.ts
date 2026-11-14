/**
 * Curated shortcuts for the /shop/token picker. Intear's API has no usable "top tokens" ranking,
 * so each entry lists the NEAR token contract ids to try (first one that /token/info prices wins).
 * Every id here was checked against the live /token/info route. No stablecoins.
 */
export type PopularToken = { symbol: string; ids: string[] };

export const POPULAR_TOKENS: PopularToken[] = [
  { symbol: "SHITZU", ids: ["token.0xshitzu.near"] },
  { symbol: "BLACKDRAGON", ids: ["blackdragon.tkn.near", "blackdragon.near"] },
  { symbol: "ZEC", ids: ["zec.omft.near"] },
  { symbol: "RHEA", ids: ["token.rhealab.near"] },
  { symbol: "AURORA", ids: ["aaaaaa20d9e0e2461697782ef11675f668207961.factory.bridge.near"] }
  ];

const STABLE = /^(usd|eur)|usd[ct]?$|^dai$|^frax$/i;

export function isStableSymbol(symbol: string): boolean {
  return STABLE.test(symbol);
}
