/* eslint-disable @next/next/no-img-element */
/** The VietQR wordmark on a white chip (navy is hard to read on dark). The 500x500 file has wide padding,
 *  so a wide chip with object-fit cover crops it visually; the original file is untouched. */
export function VietQrMark({ width = 88, className = "" }: { width?: number; className?: string }) {
  const height = Math.round(width * 0.42);
  return (
    <span
      role="img"
      aria-label="VietQR"
      className={`relative inline-block shrink-0 overflow-hidden rounded-xl border border-black/10 bg-white ${className}`}
      style={{ width, height }}
    >
      <img src="/brand/vietqr-logo.webp" alt="" width={width} height={width} draggable={false}
        className="absolute inset-0 h-full w-full scale-[0.94] object-cover" />
    </span>
  );
}
