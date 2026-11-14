/** Reward (tip) helpers shared by pickers and servers. No Node or browser APIs. */
export const MAX_REWARD_USD = 100;
export const REWARD_PRESETS = [1, 2, 3, 5];

/** Parses "2.5" or "2,50" into whole cents-precision dollars, or a friendly error. */
export function parseRewardInput(input: string, minUsd = 0): { usd: number } | { error: string } {
  const text = input.trim().replace(",", ".");
  if (!text) return { error: "Type an amount." };
  if (!/^\d*\.?\d*$/.test(text) || text === ".") return { error: "Use numbers only, like 2.50." };
  if (/\.\d{3,}/.test(text)) return { error: "Use at most 2 numbers after the dot." };
  const usd = Math.round(Number(text) * 100) / 100;
  if (usd < minUsd) return { error: `The smallest reward is $${minUsd.toFixed(2)}.` };
  if (usd > MAX_REWARD_USD) return { error: `The biggest reward is $${MAX_REWARD_USD}.` };
  return { usd };
}

/** "2.5" -> "2.50" decimal string for APIs that take USDC decimals. */
export const rewardDecimal = (usd: number) => usd.toFixed(2);

/** Collapses whitespace/newlines to single spaces and trims. */
export const cleanText = (value: string) => value.replace(/[\s\x00-\x1f\x7f]+/g, " ").trim();

/** Friendly message when text is empty or too long (limit counted in UTF-8 bytes, like the chain). */
export function textProblem(value: string, label: string, maxBytes: number): string | null {
  const text = cleanText(value);
  if (!text) return `${label} is required.`;
  if (new TextEncoder().encode(text).length > maxBytes) {
    const accents = [...text].length <= maxBytes ? " (accented letters count extra)" : "";
    return `${label} is too long, keep it under ${maxBytes} characters${accents}.`;
  }
  return null;
}
