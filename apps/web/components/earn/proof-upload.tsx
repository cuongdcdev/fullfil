"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { precheckEml, MAX_EML_BYTES, type PrecheckOrder, type PrecheckResult } from "@/lib/eml-precheck";
import { BigButton } from "./common";

const ICON = { true: "✓", warn: "⚠", false: "✗" } as const;
const TONE = {
  true: "text-good dark:text-green-300",
  warn: "text-amber-700 dark:text-amber-300",
  false: "text-danger",
} as const;

/** One screen, one job: pick the bank's email file, see it checked, send it. */
export function ProofUpload({
  order,
  busy,
  onSend,
  onSample,
  children,
}: {
  order: PrecheckOrder;
  busy?: boolean;
  /** Called with the picked file when the user presses "Send proof". */
  onSend: (file: File) => void;
  /** Mock mode only. */
  onSample?: () => void;
  /** Extra low-key options (photo, demo menu). */
  children?: ReactNode;
}) {
  const [file, setFile] = useState<File | undefined>();
  const [result, setResult] = useState<PrecheckResult | undefined>();
  const [reveal, setReveal] = useState(0);
  const [reading, setReading] = useState(false);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!result) return;
    setReveal(0);
    const t = setInterval(() => setReveal((n) => (n >= result.checks.length ? n : n + 1)), 250);
    return () => clearInterval(t);
  }, [result]);

  const pick = async (f: File | undefined) => {
    if (!f) return;
    setFile(f);
    setResult(undefined);
    setReading(true);
    try {
      const buf = await f.slice(0, MAX_EML_BYTES + 1).arrayBuffer();
      setResult(precheckEml(new Uint8Array(buf), order));
    } finally {
      setReading(false);
    }
  };

  const done = !!result && reveal >= result.checks.length;
  const ready = done && result.ready;
  const hasFail = done && !result.ready;

  return (
    <div className="grid gap-4">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          void pick(e.dataTransfer.files?.[0]);
        }}
        className={`flex min-h-36 w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed px-4 py-6 text-center focus-within:ring-4 focus-within:ring-brand/40 ${
          drag ? "border-brand bg-brand/10" : "border-brand"
        }`}
      >
        <span className="text-4xl" aria-hidden>
          {file ? "📧" : "⬆️"}
        </span>
        <span className="text-xl font-black">{file ? "Choose a different file" : "Choose email file"}</span>
        <span className="break-all text-sm text-muted">{file ? file.name : "or drop it here (.eml)"}</span>
        <input
          ref={inputRef}
          type="file"
          accept=".eml,message/rfc822"
          className="sr-only"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            void pick(f);
          }}
        />
      </label>

      <div aria-live="polite" aria-atomic="false">
        {reading && <p className="text-muted">Looking at your file…</p>}
        {result && (
          <ul className="grid gap-3" aria-label="Email checks">
            {result.checks.slice(0, reveal).map((c) => (
              <li key={c.id} className="grid gap-0.5">
                <p className={`text-lg font-bold ${TONE[String(c.ok) as keyof typeof TONE]}`}>
                  <span aria-hidden>{ICON[String(c.ok) as keyof typeof ICON]} </span>
                  <span className="sr-only">{c.ok === true ? "Good: " : c.ok === "warn" ? "Check: " : "Problem: "}</span>
                  {c.label}
                </p>
                {c.ok !== true && c.fix && <p className="pl-6 text-base text-ink">{c.fix}</p>}
              </li>
            ))}
            {!done && (
              <li className="flex items-center gap-2 text-muted" role="status">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-ink" aria-hidden />
                Checking…
              </li>
            )}
          </ul>
        )}
        {ready && <p className="mt-3 rounded-xl bg-green-100 p-3 font-bold text-green-900 dark:bg-green-900/40 dark:text-green-100">Looks good. Press the button to send it.</p>}
        {hasFail && <p className="mt-3 rounded-xl bg-red-100 p-3 font-bold text-red-900 dark:bg-red-900/40 dark:text-red-100">Fix the red items, then choose the file again.</p>}
      </div>

      <BigButton disabled={!ready || busy} onClick={() => file && onSend(file)}>
        {busy ? "Sending…" : "Send proof"}
      </BigButton>

      <details className="rounded-xl border border-line bg-panel p-3">
        <summary className="min-h-10 cursor-pointer py-2 font-bold">How do I get the email file?</summary>
        <div className="grid gap-3 pb-2 text-base">
          <p className="font-bold">On a computer (Gmail)</p>
          <ol className="list-decimal space-y-1 pl-6">
            <li>Open the email your bank sent about this transfer.</li>
            <li>Click the three dots ⋮ at the top right of the email.</li>
            <li>Click &quot;Download message&quot;.</li>
            <li>Come back here and choose the file you just downloaded.</li>
          </ol>
          <p className="font-bold">On a phone</p>
          <p>
            The Gmail app can&apos;t download the file. Open gmail.com in your phone&apos;s browser and choose
            &quot;Desktop site&quot; in the browser menu, or use a computer.
          </p>
          <p className="rounded-lg bg-[var(--warn)] p-2 font-bold text-[var(--warn-fg)] border border-[var(--warn-line)]">
            Don&apos;t press Forward and don&apos;t copy-paste.
          </p>
        </div>
      </details>

      <p className="rounded-xl bg-panel p-3 text-center text-sm text-muted">
        Coming soon: just forward the email, no file needed.
      </p>

      <details className="text-sm text-muted">
        <summary className="min-h-10 cursor-pointer py-2 underline">Why do we check it here? ›</summary>
        <p className="pb-2">
          Your bank signs every email it sends. Our server checks that stamp again, so nobody can fake or edit
          the email. This page only helps you catch mistakes before you send.
        </p>
      </details>

      {onSample && (
        <button
          type="button"
          disabled={busy}
          onClick={onSample}
          className="min-h-12 text-center text-sm font-bold underline"
        >
          Use sample bank email (demo)
        </button>
      )}
      {children}
    </div>
  );
}
