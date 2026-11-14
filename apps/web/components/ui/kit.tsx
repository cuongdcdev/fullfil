"use client";

import Link from "next/link";
import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Check, Inbox, X } from "lucide-react";

const cx = (...parts: (string | false | undefined)[]) =>
  parts.filter(Boolean).join(" ");

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  full?: boolean;
  href?: string;
};
export function Button({
  variant = "primary",
  full,
  href,
  className,
  children,
  ...rest
}: ButtonProps) {
  const styles = cx(
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] border px-4 py-2 text-sm font-bold transition-[transform,box-shadow,background-color,border-color] duration-200 active:scale-[0.985] disabled:pointer-events-none disabled:opacity-50",
    variant === "primary" && "border-brand bg-brand text-brand-fg hover:shadow-lift",
    variant === "secondary" && "border-line bg-panel text-ink hover:border-muted",
    variant === "ghost" && "border-transparent bg-transparent text-ink hover:bg-soft",
    variant === "danger" && "border-danger bg-danger text-white hover:shadow-lift",
    full && "w-full",
    className,
  );
  if (href) {
    return (
      <Link href={href} className={styles}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" className={styles} {...rest}>
      {children}
    </button>
  );
}

export function Card({
  children,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article";
}) {
  return (
    <Tag className={cx("min-w-0 rounded-2xl border border-line bg-panel p-5", className)}>
      {children}
    </Tag>
  );
}

/** Bottom sheet on mobile, centered dialog on >=768px. */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    ref.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="relative max-h-[85vh] w-full overflow-auto rounded-t-3xl border border-line bg-panel p-5 shadow-lift md:max-w-md md:rounded-2xl"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="grid h-10 w-10 place-items-center rounded-lg text-muted hover:bg-soft hover:text-ink">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const pillTone: Record<string, string> = {
  good: "bg-[var(--ok-tint)] text-[var(--good)]",
  bad: "bg-[var(--red-tint)] text-[var(--red-fg)]",
  warn: "bg-[var(--warn)] text-[var(--warn-fg)]",
  neutral: "bg-soft text-ink",
};
export function orderStateTone(state: string) {
  if (["Released", "Delivered", "Resolved"].includes(state)) return "good";
  if (["Rejected", "Refunded", "Disputed", "Cancelled", "Expired"].includes(state))
    return "bad";
  if (["Quoting", "Draft"].includes(state)) return "neutral";
  return "warn";
}
export function StatusPill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "good" | "bad" | "warn" | "neutral";
}) {
  return (
    <span
      className={cx(
        "inline-flex w-max items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold before:h-1.5 before:w-1.5 before:rounded-full before:bg-current before:opacity-70 before:content-['']",
        pillTone[tone],
      )}
    >
      {children}
    </span>
  );
}

export function OrderHeader({
  id,
  title,
  status,
  tone = "neutral",
  label = "Order",
}: {
  id: string;
  title: string;
  status: string;
  tone?: "good" | "bad" | "warn" | "neutral";
  label?: string;
}) {
  return (
    <header className="grid gap-2">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted">
        <StatusPill tone={tone}>{status}</StatusPill>
        <span>
          {label} <span className="mono">{id}</span>
        </span>
      </p>
      <h1 className="h1-title break-words">{title}</h1>
    </header>
  );
}

/** Calm confirmation line with a drawn check. */
export function Notice({ children, tone = "good" }: { children: ReactNode; tone?: "good" | "warn" | "bad" }) {
  const palette = {
    good: "border-[var(--ok-line)] bg-[var(--ok-tint)] text-[var(--good)]",
    warn: "border-[var(--warn-line)] bg-[var(--warn)] text-[var(--warn-fg)]",
    bad: "border-[var(--red-line)] bg-[var(--red-tint)] text-[var(--red-fg)]",
  }[tone];
  return (
    <p className={cx("flex items-start gap-2.5 rounded-2xl border p-4 text-sm font-semibold", palette)}>
      {tone === "good" ? <Check size={18} strokeWidth={3} aria-hidden className="mt-0.5 shrink-0" /> : null}
      <span>{children}</span>
    </p>
  );
}

export function Stepper({
  steps,
  current,
}: {
  steps: string[];
  current: number;
}) {
  return (
    <ol className="grid" aria-live="polite">
      {steps.map((label, i) => (
        <li
          key={label}
          aria-current={i === current ? "step" : undefined}
          className={cx(
            "relative flex items-center gap-3 pb-5 text-sm last:pb-0",
            i < steps.length - 1 &&
              cx(
                "before:absolute before:left-3 before:top-7 before:h-[calc(100%-1.75rem)] before:w-0.5 before:-translate-x-1/2 before:rounded before:content-['']",
                i < current ? "before:bg-brand" : "before:bg-line",
              ),
            i > current && "text-muted",
            i === current && "font-bold",
          )}
        >
          <span
            className={cx(
              "relative grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 text-xs font-bold transition-colors",
              i < current && "border-brand bg-brand text-brand-fg",
              i === current && "border-brand bg-[var(--lime-tint)] text-ink",
              i > current && "border-line bg-panel",
            )}
          >
            {i < current ? <Check size={13} strokeWidth={3} aria-hidden /> : i + 1}
          </span>
          {label}
        </li>
      ))}
    </ol>
  );
}

export function EmptyState({
  title,
  hint,
  action,
  icon: Icon = Inbox,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
  icon?: typeof Inbox;
}) {
  return (
    <div className="grid justify-items-center gap-2 rounded-2xl border border-dashed border-line bg-panel/50 px-6 py-10 text-center">
      <span className="mb-1 grid h-12 w-12 place-items-center rounded-2xl bg-[var(--lime-tint)] text-lime-deep">
        <Icon size={22} aria-hidden />
      </span>
      <p className="text-lg font-bold">{title}</p>
      {hint && <p className="max-w-[40ch] text-sm text-muted">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
