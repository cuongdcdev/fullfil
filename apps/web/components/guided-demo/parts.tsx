import type { ReactNode } from "react";
import { Check, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/kit";
import { OrderSummaryRow } from "@/components/v3/order-detail";

/** Small pieces that look like the real app, but do nothing. Pure presentation, no data, no API. */

export function Phone({
  who,
  active,
  stepKey,
  children,
}: {
  who: string;
  active: boolean;
  stepKey: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`mx-auto w-full max-w-[350px] overflow-hidden rounded-[28px] border bg-paper transition-[opacity,box-shadow,border-color] duration-500 [transition-timing-function:var(--ease-out)] ${
        active ? "border-brand shadow-lift" : "border-line opacity-90 shadow-card"
      }`}
    >
      <div className="flex items-center justify-between border-b border-line bg-panel px-4 py-2.5">
        <span className="flex items-center gap-2 text-sm font-extrabold tracking-tight">
          <span className="grid h-5 w-5 place-items-center rounded-md bg-brand text-[11px] font-black text-brand-fg" aria-hidden>f</span>
          fulfil
        </span>
        <span className="rounded-full bg-soft px-2.5 py-0.5 text-[11px] font-bold text-muted">{who}</span>
      </div>
      <div key={stepKey} className="demo-screen grid min-h-[360px] sm:min-h-[480px] content-start gap-3 p-4 text-[13px] leading-snug">
        {children}
      </div>
    </div>
  );
}

export const H = ({ children }: { children: ReactNode }) => (
  <h3 className="text-[19px] font-extrabold leading-tight tracking-tight">{children}</h3>
);
export const Sub = ({ children }: { children: ReactNode }) => <p className="text-xs text-muted">{children}</p>;

export function Field({ label, value, hint }: { label: string; value?: string; hint?: string }) {
  return (
    <div className="grid gap-1">
      <span className="text-[13px] font-bold">{label}</span>
      <span className={`rounded-[10px] border border-line bg-panel px-3 py-2.5 ${value ? "" : "text-muted"}`}>{value || " "}</span>
      {hint && <span className="text-[11px] text-muted">{hint}</span>}
    </div>
  );
}

export function Chips({ items, active }: { items: string[]; active?: string }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span key={item}
          className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${item === active ? "border-brand bg-brand text-brand-fg" : "border-line bg-panel"}`}>
          {item}
        </span>
      ))}
    </div>
  );
}

export function Rows({ rows }: { rows: [string, string, boolean?][] }) {
  return (
    <Card className="p-4">
      <dl className="grid gap-2.5 text-[13px]">
        {rows.map(([label, value, total]) => (
          <OrderSummaryRow key={label} label={label} value={value} total={total} />
        ))}
      </dl>
    </Card>
  );
}

export function Btn({ children, tone = "lime", pulse }: { children: ReactNode; tone?: "lime" | "outline"; pulse?: boolean }) {
  return (
    <span aria-hidden
      className={`button big full pointer-events-none select-none ${tone === "lime" ? "lime" : "outline"} ${pulse ? "demo-pulse" : ""}`}>
      {children}
    </span>
  );
}

export function Busy({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-soft px-3 py-3 text-[13px] font-semibold">
      <Loader2 size={16} className="shrink-0 animate-spin" aria-hidden /> {children}
    </div>
  );
}

export function Log({ items }: { items: { text: string; done: boolean }[] }) {
  return (
    <ul className="grid gap-2 rounded-xl border border-line bg-panel p-3.5">
      {items.map((item) => (
        <li key={item.text} className={`flex items-start gap-2.5 ${item.done ? "" : "text-muted"}`}>
          <span className={`mt-px grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full ${item.done ? "bg-brand text-brand-fg" : "border border-line"}`}>
            {item.done ? <Check size={11} strokeWidth={3.5} aria-hidden /> : null}
          </span>
          <span>{item.text}</span>
        </li>
      ))}
    </ul>
  );
}

export function Idle({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="grid justify-items-center gap-1.5 rounded-2xl border border-dashed border-line px-4 py-12 text-center">
      <p className="font-bold">{title}</p>
      {children && <p className="max-w-[28ch] text-xs text-muted">{children}</p>}
    </div>
  );
}

export function JobCard({ tag, title, area, earn, pay, steps, action }: {
  tag: string; title: string; area?: string; earn: string; pay?: string; steps?: string; action: ReactNode;
}) {
  return (
    <Card className="grid gap-2 p-4">
      <p className="text-xs font-bold text-muted">{tag}</p>
      <p className="text-base font-extrabold leading-snug tracking-tight">{title}</p>
      {area && <p className="text-xs text-muted">{area}</p>}
      <div>
        <p className="text-xs text-muted">You earn</p>
        <p className="text-3xl font-extrabold tracking-tight tabular-nums text-good">{earn}</p>
      </div>
      {pay && <p className="text-xs text-muted">{pay}</p>}
      {steps && <p className="text-[11px] text-muted">{steps}</p>}
      {action}
    </Card>
  );
}

/** A believable-looking QR (finder squares plus seeded noise). Not a real code. */
export function FakeQr({ size = 150 }: { size?: number }) {
  const n = 25;
  let seed = 42;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
  const cells: boolean[][] = Array.from({ length: n }, () => Array.from({ length: n }, () => rnd() > 0.52));
  const finder = (ox: number, oy: number) => {
    for (let y = -1; y <= 7; y++)
      for (let x = -1; x <= 7; x++) {
        const px = ox + x, py = oy + y;
        if (px < 0 || py < 0 || px >= n || py >= n) continue;
        const edge = x === 0 || x === 6 || y === 0 || y === 6;
        const core = x >= 2 && x <= 4 && y >= 2 && y <= 4;
        cells[py][px] = x >= 0 && x <= 6 && y >= 0 && y <= 6 && (edge || core);
      }
  };
  finder(0, 0); finder(n - 7, 0); finder(0, n - 7);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${n} ${n}`} role="img" aria-label="Example QR code" className="rounded-lg bg-white p-2" shapeRendering="crispEdges">
      {cells.flatMap((row, y) => row.map((on, x) => on ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="#14201d" /> : null))}
    </svg>
  );
}
