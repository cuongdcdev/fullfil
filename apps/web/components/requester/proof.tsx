"use client";

import Link from "next/link";
import { usd, vnd } from "@/lib/api";
import { Card, StatusPill } from "@/components/ui/kit";
import { ErrorBox, Loading } from "./common";
import { useQrOrder } from "./tracker";

export function ProofView({ id }: { id: string }) {
  const { order: o, error, load } = useQrOrder(id);
  if (error && !o) return <ErrorBox message={error} onRetry={load} />;
  if (!o) return <Loading />;
  const p = o.proof;
  return (
    <>
      <div>
        <Link href={`/pay/${o.id}`} className="back-link">Back to your payment</Link>
        <h1 className="h1-title">How do we know?</h1>
        <p className="text-sm text-muted">{o.merchant.name} · {vnd(o.vndAmount)} · {usd(o.totalUsd)} escrowed ({o.payWith}) · stage <code>{o.stage}</code></p>
      </div>
      <Card className="grid gap-2">
        <h2 className="font-bold">Proof</h2>
        {!p ? (
          <p className="text-sm text-muted">No proof has been submitted yet. The local sends it after paying the shop.</p>
        ) : (
          <>
            <p className="text-sm">
              Method: <b>{p.method === "bank_email" ? "Bank transfer email (DKIM-verified)" : "Slip photo (limited proof)"}</b>{" "}
              <StatusPill tone={p.accepted ? "good" : "bad"}>{p.accepted ? "accepted" : "rejected"}</StatusPill>
            </p>
            {p.bankRef && <p className="text-sm">Bank reference: <code>{p.bankRef}</code></p>}
            <ul className="grid gap-1">
              {p.checks.map((c) => (
                <li key={c.id} className="text-sm">
                  <span className={c.pass ? "font-bold text-good" : "font-bold text-danger"}>{c.pass ? "✓" : "✗"}</span>{" "}
                  <code>{c.id}</code> — {c.detail}
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
      {p && (
        <Card className="grid gap-1 text-sm">
          <h2 className="font-bold">Attestation</h2>
          <p>Provider: {p.attestation.provider} (mock)</p>
          <p className="break-all">Input hash: <code>{p.attestation.inputHash}</code></p>
          <p className="break-all">Output hash: <code>{p.attestation.outputHash}</code></p>
          <p>Verified at: {new Date(p.attestation.verifiedAt).toLocaleString()}</p>
          <p className="text-muted">{p.attestation.note}</p>
        </Card>
      )}
      {o.dispute && (
        <Card className="grid gap-1 text-sm">
          <h2 className="font-bold">Dispute</h2>
          <p>Reason: {o.dispute.reason}</p>
          <p>Outcome: {o.dispute.outcome ?? "pending"} · settled: {String(o.dispute.settled)}</p>
        </Card>
      )}
      <Card className="grid gap-2">
        <h2 className="font-bold">Timeline</h2>
        <ol className="grid gap-1 text-sm">
          {o.timeline.map((t, i) => (
            <li key={i}>{new Date(t.at).toLocaleTimeString()} · <code>{t.stage}</code> · {t.label}</li>
          ))}
        </ol>
      </Card>
      <Link href={`/orders/${o.id}`} className="text-sm font-bold underline">Open developer order page ›</Link>
    </>
  );
}
