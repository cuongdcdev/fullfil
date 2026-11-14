"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, CircleDashed, CircleX, RotateCcw } from "lucide-react";
import { Card, StatusPill } from "@/components/ui/kit";
import { friendlyError, v3, type PublicStatus } from "@/lib/v3-client";

const kindName: Record<string, string> = {
  bank_transfer: "Local QR payments (bank transfer)",
  cryptorefills_topup: "Phone top-ups",
  cryptorefills_code: "Gift cards and eSIMs",
  in_person: "Buy anything nearby",
  token_buy: "Memecoin purchases",
};
const accessName = { open: "Open to any helper", approved: "Approved helpers only", allowlist: "Named helpers only" };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 border-b border-line py-3 last:border-0">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 break-all text-right font-bold">{children}</dd>
    </div>
  );
}

function ServiceState({ state }: { state: "reachable" | "unreachable" | "not_checked" }) {
  if (state === "reachable")
    return <span className="inline-flex items-center gap-1 text-sm font-bold"><CheckCircle2 size={16} aria-hidden /> Reachable</span>;
  if (state === "unreachable")
    return <span className="inline-flex items-center gap-1 text-sm font-bold text-danger"><CircleX size={16} aria-hidden /> Not reachable</span>;
  return <span className="inline-flex items-center gap-1 text-sm text-muted"><CircleDashed size={16} aria-hidden /> Not checked in demo mode</span>;
}

export default function StatusPage() {
  const [status, setStatus] = useState<PublicStatus | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      setStatus(await v3.status());
      setError("");
    } catch (cause) {
      setError(friendlyError(cause));
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="page grid max-w-3xl gap-5">
      <header>
        <p className="text-sm text-muted">System status</p>
        <h1 className="text-3xl font-black">What this app is connected to</h1>
        <p className="mt-1 text-muted">
          Read live from the server. Nothing secret is shown: only whether a service is set up.
        </p>
      </header>

      {error ? (
        <Card>
          <p className="text-danger">{error}</p>
        </Card>
      ) : !status ? (
        <div className="h-48 animate-pulse rounded-2xl bg-soft" />
      ) : (
        <>
          <Card className="grid gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-black">Network</h2>
              <StatusPill tone={status.mode === "live" ? "good" : "warn"}>
                {status.mode === "live" ? "Live" : "Demo data (not real money)"}
              </StatusPill>
              {status.paused && <StatusPill tone="bad">Paused</StatusPill>}
            </div>
            <dl>
              <Row label="Network">NEAR {status.network}</Row>
              <Row label="Escrow contract (holds the money)">{status.escrow_contract}</Row>
              <Row label="NEAR Intents contract">{status.intents_contract}</Row>
              <Row label="Relayer (pays network fees)">
                {status.relayer.account ?? "Unknown"} · {status.relayer.configured ? "configured" : "not configured"}
              </Row>
            </dl>
          </Card>

          <Card className="grid gap-1">
            <h2 className="text-xl font-black">What you can buy</h2>
            <p className="text-sm text-muted">
              For each type, a <strong>fulfiller</strong> does the real-world part and an <strong>OutLayer</strong> worker
              (an independent verifier in a secure enclave) checks the proof before anyone is paid.
            </p>
            <ul className="mt-2 grid gap-2">
              {status.kinds.map((k) => (
                <li key={k.kind} className="rounded-lg bg-soft p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong>{kindName[k.kind] ?? k.kind.replaceAll("_", " ")}</strong>
                    <StatusPill tone={k.enabled ? "good" : "neutral"}>{k.enabled ? "Enabled" : "Off"}</StatusPill>
                  </div>
                  <p className="text-sm text-muted">{accessName[k.access]}</p>
                  <p className="break-all text-sm">
                    Verifier worker: {k.verifier ? <span className="font-bold">{k.verifier}</span> : <span className="text-muted">{k.kind === "in_person" ? "checked on chain (QR receipt code)" : "none"}</span>}
                  </p>
                  {k.verifier_code?.available === true ? (
                    <p className="text-sm text-muted">Code online (version {k.verifier_code.version}): the verifier&apos;s program can be downloaded.</p>
                  ) : k.verifier_code?.available === false ? (
                    <p className="text-sm font-bold text-red-700" role="alert">
                      Verifier code missing{k.verifier_code.version ? ` (version ${k.verifier_code.version})` : ""} — proofs will fail.
                      The worker has no program to run, so payments for this type will be rejected until it is re-uploaded.
                    </p>
                  ) : k.verifier_code ? (
                    <p className="text-sm text-muted">Code check unavailable right now (could not reach the code host).</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </Card>

          <Card className="grid gap-1">
            <h2 className="text-xl font-black">Services</h2>
            <ul>
              {status.services.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-line py-3 last:border-0">
                  <span>{s.name}</span>
                  <ServiceState state={s.state} />
                </li>
              ))}
            </ul>
          </Card>

          <div className="flex flex-wrap items-center gap-4 text-sm text-muted">
            <button type="button" className="inline-flex min-h-11 items-center gap-1 font-bold text-ink underline" onClick={() => void load()}>
              <RotateCcw size={14} aria-hidden /> Refresh
            </button>
            <span>Checked {new Date(status.checked_at).toLocaleTimeString()}</span>
          </div>
        </>
      )}
    </div>
  );
}
