import type { ReactNode } from "react";

export function OrderSummaryRow({
  label,
  value,
  total = false,
}: {
  label: string;
  value: ReactNode;
  total?: boolean;
}) {
  return (
    <div className={`flex items-start justify-between gap-4 ${total ? "mt-1 border-t border-line pt-4 text-base font-extrabold" : ""}`}>
      <dt className={total ? "" : "text-muted"}>{label}</dt>
      <dd className={`min-w-0 break-words text-right ${total ? "" : "font-semibold"} tabular-nums`}>{value}</dd>
    </div>
  );
}
