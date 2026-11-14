import { usdcUnits } from "./quote";

export function shopperLimits(maxOrder?: string, reserve?: string, minTimeLeft?: string): {
  maxUsdc: bigint;
  reserveUsdc: bigint;
  minTimeLeftMs: number;
} {
  const maxUsdc = usdcUnits(maxOrder ?? "5");
  const reserveUsdc = usdcUnits(reserve ?? "0");
  const timeInput = minTimeLeft ?? "900000";
  const minTimeLeftMs = Number(timeInput);
  if (maxUsdc <= 0n) throw new Error("Invalid shopper order limit");
  if (!/^\d+$/.test(timeInput) || !Number.isSafeInteger(minTimeLeftMs) ||
    minTimeLeftMs <= 0) {
    throw new Error("Invalid shopper minimum time left");
  }
  return { maxUsdc, reserveUsdc, minTimeLeftMs };
}
