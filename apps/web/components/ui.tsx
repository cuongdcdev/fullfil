"use client";

import { Check, Copy, ExternalLink, Loader2, RotateCcw } from "lucide-react";
import { useState } from "react";
import { shortHash, type Check as CheckType } from "@/lib/api";

export function ModeBadge({ mock, label }: { mock?: boolean; label?: string }) {
  return (
    <span className={`badge ${mock ? "amber" : "lime"}`}>
      {mock ? "MOCK · not verified" : label || "REAL"}
    </span>
  );
}
export function StateBadge({ state }: { state: string }) {
  const color = ["Released", "Delivered"].includes(state)
    ? "lime"
    : ["Rejected", "Refunded", "Disputed"].includes(state)
      ? "red"
      : "";
  return <span className={`badge ${color}`}>{state}</span>;
}
export function ErrorBox({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <div className="error row">
      <span>{message}</span>
      {retry && (
        <button className="button outline" onClick={retry}>
          <RotateCcw size={13} /> Retry
        </button>
      )}
    </div>
  );
}
export function Loading({ label = "Loading" }: { label?: string }) {
  return (
    <div className="card row">
      <span className="muted">{label}…</span>
      <Loader2 className="animate-spin" size={18} />
    </div>
  );
}
export function Hash({
  value,
  network = "testnet",
  tx = false,
  mock = false,
}: {
  value?: string;
  network?: string;
  tx?: boolean;
  mock?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const explorer =
    !mock && tx && value
      ? `https://${network === "mainnet" ? "nearblocks.io" : "testnet.nearblocks.io"}/txns/${value}`
      : null;
  return (
    <span className="hash mono small" title={value}>
      <span
        style={{
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {shortHash(value)}
      </span>
      <button title="Copy full hash" onClick={copy} aria-label="Copy full hash">
        {copied ? <Check size={13} /> : <Copy size={13} />}
      </button>
      {explorer && (
        <a
          href={explorer}
          target="_blank"
          rel="noreferrer"
          title="Open in explorer"
        >
          <ExternalLink size={12} />
        </a>
      )}
    </span>
  );
}
export function CheckList({ checks }: { checks?: CheckType[] }) {
  if (!checks?.length)
    return (
      <p className="muted small">
        Checks will appear when evidence is submitted.
      </p>
    );
  return (
    <div className="stack">
      {checks.map((check, index) => (
        <div
          key={`${check.id}-${index}`}
          className="row small"
          style={{ alignItems: "flex-start" }}
        >
          <span>
            <strong style={{ color: check.pass ? "#5d8f31" : "var(--red)" }}>
              {check.pass ? "✓" : "×"}
            </strong>{" "}
            &nbsp;{check.id}
          </span>
          <span
            className="muted"
            style={{ textAlign: "right", maxWidth: "60%" }}
          >
            {check.detail}
          </span>
        </div>
      ))}
    </div>
  );
}
export function JsonDetails({
  title,
  value,
}: {
  title: string;
  value: unknown;
}) {
  return (
    <details>
      <summary className="small" style={{ cursor: "pointer", fontWeight: 800 }}>
        {title}
      </summary>
      <pre className="code">{JSON.stringify(value, null, 2)}</pre>
    </details>
  );
}
