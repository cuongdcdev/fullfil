/** Fulfil brand mark: lime tile with "f". Size, radius and font size come from className. */
export function LogoMark({ className = "h-8 w-8 rounded-[10px] text-lg" }: { className?: string }) {
  return (
    <span className={`grid shrink-0 place-items-center bg-brand text-brand-fg ${className}`} aria-hidden>
      <span className="font-black leading-none">f</span>
    </span>
  );
}
