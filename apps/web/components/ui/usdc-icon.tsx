/* eslint-disable @next/next/no-img-element */
export function UsdcIcon({ size = 20, className = "" }: { size?: number; className?: string }) {
  return <img src="/coins/usd-coin.png" alt="USDC" width={size} height={size} className={`inline-block shrink-0 rounded-full ${className}`} />;
}
