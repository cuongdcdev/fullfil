"use client";

import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  FileCheck2,
  Gavel,
  LockKeyhole,
  ReceiptText,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import {
  api,
  errorMessage,
  type OrderDetail,
  type Quote,
  usd,
} from "@/lib/api";
import {
  CheckList,
  ErrorBox,
  Hash,
  JsonDetails,
  ModeBadge,
  StateBadge,
} from "@/components/ui";

const orderStates = [
  "Quoting",
  "Accepted",
  "Funded",
  "Purchased",
  "Delivered",
  "Released",
];

const EVIDENCE_NAMES: Record<string, string> = {
  dkim: "bank email signature (DKIM)",
  amount: "payment amount",
  recipient: "recipient account",
  timestamp: "payment time",
  deadline: "delivery deadline",
};
function evidenceName(id: string): string {
  return EVIDENCE_NAMES[id.toLowerCase()] ?? id.replaceAll("_", " ").replaceAll("-", " ");
}

export function OrderView({
  order,
  onUpdate,
  compact = false,
}: {
  order: OrderDetail;
  onUpdate?: (order: OrderDetail) => void;
  compact?: boolean;
}) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [reason, setReason] = useState(
    "The delivery does not match the locked acceptance rubric.",
  );
  const [showDispute, setShowDispute] = useState(false);
  const [verify, setVerify] = useState<
    Record<
      string,
      {
        verified: boolean;
        mock: boolean;
        checks: { id: string; pass: boolean; detail: string }[];
      }
    >
  >({});
  const run = async (action: string, extra: Record<string, unknown> = {}) => {
    setBusy(action);
    setError("");
    try {
      onUpdate?.(await api.action(order.id, { action, ...extra }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy("");
    }
  };
  const current = orderStates.indexOf(order.state);
  const selected = order.quotes?.find((quote) => quote.id === order.quoteId);
  const sortedQuotes = [...(order.quotes || [])].sort(
    (a, b) => a.totalUsd - b.totalUsd,
  );
  return (
    <div className="stack" style={{ gap: 18 }}>
      {error && <ErrorBox message={error} />}
      <div className="grid grid-3">
        <div className="card">
          <div className="card-header">
            <span className="card-label">Order state</span>
            <StateBadge state={order.state} />
          </div>
          <div className="stat" style={{ fontSize: 31 }}>
            {order.state}
          </div>
          <div className="muted small">
            {order.kind === "qr_payment"
              ? "Local QR payment"
              : "Physical world errand"}{" "}
            · {order.id}
          </div>
        </div>
        <div className="card dark">
          <div className="card-header">
            <span className="card-label" style={{ color: "#a4b7a5" }}>
              Escrow locked
            </span>
            <LockKeyhole size={19} color="#c9ef6b" />
          </div>
          <div className="stat">{usd(order.escrowUsd)}</div>
          <div className="small" style={{ color: "#a9baa9" }}>
            USDC {order.mock ? "· simulated balance" : "· on-chain"}
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <span className="card-label">Release rule</span>
            <Clock3 size={18} />
          </div>
          <strong style={{ fontSize: 18 }}>
            {String(order.rubric?.windows?.releaseGate || "Pending").replaceAll(
              "_",
              " ",
            )}
          </strong>
          <div className="small muted" style={{ marginTop: 8 }}>
            {order.releaseAt
              ? `Opens ${new Date(order.releaseAt).toLocaleString()}`
              : `Auto accept: ${order.rubric?.windows?.autoAcceptHours ?? "—"}h`}
          </div>
        </div>
      </div>
      <div className="card">
        <div className="card-header">
          <h2 className="section-title">The locked agreement</h2>
          <ModeBadge mock={order.mock} />
        </div>
        <div className="grid grid-2">
          <div>
            <div className="card-label">Structured spec</div>
            <div style={{ margin: "13px 0" }}>
              <strong>
                {String(
                  order.spec?.item ||
                    order.spec?.payeeName ||
                    "Order specification",
                )}
              </strong>
            </div>
            <div className="small muted">
              {order.kind === "errand"
                ? `${order.spec?.qty || "—"} ticket(s) · ${order.spec?.date || "Date pending"} · ${((order.spec?.names as string[]) || []).join(", ")}`
                : `${order.spec?.currency || ""} ${order.spec?.amountLocal || ""} · ${order.spec?.rail || "QR"}`}
            </div>
            <div className="row" style={{ marginTop: 16 }}>
              <span className="card-label">Spec hash</span>
              <Hash value={order.specHash} />
            </div>
            <JsonDetails title="View complete spec" value={order.spec} />
          </div>
          <div>
            <div className="card-label">Acceptance rubric</div>
            <p className="small">
              {order.rubric?.deterministicChecks?.length || 0} deterministic
              checks · {order.rubric?.aiChecks?.length || 0} TEE AI checks
            </p>
            <div className="row" style={{ marginTop: 16 }}>
              <span className="card-label">Rubric hash</span>
              <Hash value={order.rubricHash} />
            </div>
            <JsonDetails title="View complete rubric" value={order.rubric} />
          </div>
        </div>
      </div>
      {!compact && (
        <div className="card">
          <div className="card-header">
            <h2 className="section-title">Progress</h2>
            <span className="small muted">An event trail, not a promise</span>
          </div>
          <div className="flow-line">
            {orderStates.map((state, index) => (
              <div className="flow-line" key={state}>
                <span className={`badge ${index <= current ? "lime" : ""}`}>
                  {state}
                </span>
                {index < orderStates.length - 1 && (
                  <ArrowRight size={13} className="muted" />
                )}
              </div>
            ))}
          </div>
          <details style={{ marginTop: 20 }}>
            <summary
              className="small"
              style={{ cursor: "pointer", fontWeight: 800 }}
            >
              Full event history ({order.history?.length || 0})
            </summary>
            <div className="timeline" style={{ marginTop: 16 }}>
              {(order.history || []).map((event, index) => (
                <div className="timeline-item done" key={event.id || index}>
                  <span className="timeline-dot">✓</span>
                  <div>
                    <strong className="small">{event.type}</strong>
                    <div className="muted small">
                      {new Date(event.at).toLocaleString()} ·{" "}
                      {event.detail ||
                        `${event.from || "—"} → ${event.to || "—"}`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </details>
        </div>
      )}
      <div className="grid grid-2">
        <div className="card">
          <div className="card-header">
            <h2 className="section-title">Fulfiller quotes</h2>
            <span className="badge">{sortedQuotes.length} offers</span>
          </div>
          {sortedQuotes.length ? (
            <div className="stack">
              {sortedQuotes.map((quote: Quote) => (
                <div
                  key={quote.id}
                  style={{ borderTop: "1px solid var(--line)", paddingTop: 13 }}
                >
                  <div className="row">
                    <div>
                      <strong>{quote.displayName || quote.fulfiller}</strong>
                      <div className="muted small">
                        Tier {quote.tier} · {quote.etaMinutes} min ·{" "}
                        {usd(quote.bondUsd ?? quote.bondLockUsd)} bond
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <strong>{usd(quote.totalUsd)}</strong>
                      <div className="muted small">USDC</div>
                    </div>
                  </div>
                  {order.state === "Quoting" && onUpdate && (
                    <button
                      className="button outline"
                      style={{ marginTop: 10 }}
                      disabled={!!busy}
                      onClick={() => run("accept_quote", { quoteId: quote.id })}
                    >
                      Accept quote <ArrowRight size={13} />
                    </button>
                  )}
                  {selected?.id === quote.id && (
                    <span className="badge lime" style={{ marginTop: 9 }}>
                      Selected
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="muted small">
              Quotes will appear here once fulfillers respond.
            </p>
          )}
          {order.state === "Accepted" && onUpdate && (
            <button
              className="button lime full"
              style={{ marginTop: 17 }}
              disabled={!!busy}
              onClick={() => run("fund", { method: "intents_balance" })}
            >
              {busy === "fund" ? "Funding…" : "Fund escrow"}{" "}
              <Wallet size={15} />
            </button>
          )}
        </div>
        <div className="card">
          <div className="card-header">
            <h2 className="section-title">Evidence & checks</h2>
            <FileCheck2 size={19} />
          </div>
          <CheckList
            checks={
              order.checks ||
              (order.evidence?.checks as {
                id: string;
                pass: boolean;
                detail: string;
              }[])
            }
          />
          {order.evidence && (
            <JsonDetails title="Evidence facts" value={order.evidence} />
          )}
          {order.state === "Delivered" && onUpdate && (
            <div className="stack" style={{ marginTop: 20 }}>
              {order.mock && order.kind !== "qr_payment" && (
                <button
                  className="button outline full"
                  disabled={!!busy}
                  onClick={() =>
                    run("advance_demo_time", {
                      hours:
                        order.fulfiller?.tier === 2
                          ? 6
                          : order.fulfiller?.tier === 1
                            ? 24
                            : 168,
                    })
                  }
                >
                  Advance mock clock for release gate <Clock3 size={15} />
                </button>
              )}
              <button
                className="button lime full"
                disabled={!!busy}
                onClick={() => run("confirm")}
              >
                Confirm & release <CheckCircle2 size={15} />
              </button>
              <button
                className="button outline full"
                onClick={() => setShowDispute(!showDispute)}
              >
                Open dispute <Gavel size={15} />
              </button>
              {showDispute && (
                <div>
                  <textarea
                    className="textarea"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    aria-label="Dispute reason"
                  />
                  <button
                    className="button danger"
                    disabled={!!busy || !reason.trim()}
                    onClick={() => run("dispute", { reason })}
                  >
                    Submit dispute
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="card">
        <div className="card-header">
          <div>
            <div className="eyebrow">Proof trail</div>
            <h2 className="section-title" style={{ marginTop: 6 }}>
              TEE attestations
            </h2>
          </div>
          <ModeBadge mock={order.mock} />
        </div>
        <p className="small muted">
          A recovered signature alone does not establish a hardware root of
          trust. Each required check is shown separately.
        </p>
        {order.bundles?.length ? (
          <div className="stack">
            {order.bundles.map((bundle) => (
              <div
                key={bundle.id}
                style={{ borderTop: "1px solid var(--line)", paddingTop: 13 }}
              >
                <div className="row">
                  <div>
                    <strong>
                      {bundle.model || bundle.provider || "Inference bundle"}
                    </strong>
                    <div className="small muted">{bundle.id}</div>
                  </div>
                  <span
                    className={`badge ${(bundle.mock ?? order.mock) ? "amber" : ""}`}
                  >
                    {(bundle.mock ?? order.mock)
                      ? "MOCK · not verified"
                      : "Verification available"}
                  </span>
                </div>
                {bundle.hash && <Hash value={bundle.hash} />}
                {verify[bundle.id] && (
                  <CheckList checks={verify[bundle.id].checks} />
                )}
                <div className="button-row" style={{ marginTop: 9 }}>
                  <button
                    className="button outline"
                    onClick={async () => {
                      try {
                        const result = await api.verifyBundle(bundle.id);
                        setVerify((current) => ({
                          ...current,
                          [bundle.id]: result,
                        }));
                      } catch (err) {
                        setError(errorMessage(err));
                      }
                    }}
                  >
                    <ShieldCheck size={14} /> Verify yourself
                  </button>
                  <JsonDetails title="Bundle details" value={bundle} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted small">
            No inference bundle has been stored for this order yet.
          </p>
        )}
      </div>
      {order.dispute && <CaseFile order={order} onUpdate={onUpdate} />}
      {!!order.transactions?.length && (
        <div className="card">
          <div className="card-header">
            <h2 className="section-title">Ledger</h2>
            <ReceiptText size={18} />
          </div>
          <div className="stack">
            {order.transactions.map((tx) => (
              <div
                key={tx.id}
                className="row small"
                style={{ borderTop: "1px solid var(--line)", paddingTop: 10 }}
              >
                <span>
                  <strong>{tx.kind}</strong>
                  <span className="muted">
                    {" "}
                    · {new Date(tx.createdAt).toLocaleString()}
                  </span>
                </span>
                <span>
                  {tx.amountUsd !== undefined && (
                    <strong>{usd(tx.amountUsd)} &nbsp;</strong>
                  )}
                  <ModeBadge mock={tx.mock} />
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      <Link
        href={`/orders/${order.id}`}
        className="button ghost"
        style={{ justifySelf: "start" }}
      >
        Open full order <ArrowRight size={14} />
      </Link>
    </div>
  );
}

export function CaseFile({
  order,
  onUpdate,
}: {
  order: OrderDetail;
  onUpdate?: (order: OrderDetail) => void;
}) {
  const dispute = order.dispute;
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (!dispute) return null;
  const action = async (name: "settle" | "appeal") => {
    setBusy(true);
    setError("");
    try {
      onUpdate?.(await api.action(order.id, { action: name }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="card" style={{ borderColor: "#b9925b" }}>
      <div className="card-header">
        <div>
          <div className="eyebrow">Case file · {order.id}</div>
          <h2 className="section-title" style={{ marginTop: 5 }}>
            The Court
          </h2>
        </div>
        <ModeBadge mock={order.mock} />
      </div>
      <div className="card soft">
        <div className="card-label">Buyer complaint · untrusted input</div>
        <p
          className="mono small"
          style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
        >
          {dispute.reason}
        </p>
        <span className={`badge ${dispute.injectionFlag ? "red" : ""}`}>
          Injection {dispute.injectionFlag ? "detected" : "not detected"}
        </span>
        <span className="small muted" style={{ marginLeft: 9 }}>
          Stake: {usd(dispute.buyerStakeUsd)}
        </span>
      </div>
      <div className="grid grid-3" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="card-label">01 · Deterministic</div>
          <p className="small">
            Rubric checks run against stored evidence facts.
          </p>
          <JsonDetails
            title="Layer 0 result"
            value={dispute.layer0 || "Pending"}
          />
        </div>
        <div className="card">
          <div className="card-label">02 · Sage gate</div>
          <p className="small">
            Low confidence or injection sends the case to jurors.
          </p>
          <JsonDetails title="Sage result" value={dispute.sage || "Pending"} />
        </div>
        <div className="card">
          <div className="card-label">03 · TEE jurors</div>
          <p className="small">Votes cite locked rubric checks.</p>
          <JsonDetails
            title="Court result"
            value={dispute.court || "Pending"}
          />
        </div>
      </div>
      {dispute.court?.votes?.length ? (
        <div className="grid grid-3" style={{ marginTop: 16 }}>
          {dispute.court.votes.map((vote, index) => (
            <div className="card" key={index} style={{ padding: 20 }}>
              <div
                style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8, marginBottom: 6 }}
              >
                <span className="card-label" style={{ whiteSpace: "nowrap" }}>
                  Juror {index + 1}
                </span>
                <span
                  className={`badge ${String(vote.model || "").startsWith("mock") ? "amber" : "lime"}`}
                  style={{ maxWidth: "100%", overflowWrap: "anywhere" }}
                >
                  {vote.model || "Model unavailable"}
                </span>
              </div>
              <h3 style={{ fontSize: 18 }}>{vote.verdict}</h3>
              <p className="small">{vote.reasons?.join(" ")}</p>
              <div className="small muted">
                Evidence used: {vote.citedRubricIds?.length ? vote.citedRubricIds.map(evidenceName).join(", ") : "none cited"}
              </div>
            </div>
          ))}
        </div>
      ) : null}
      <div className="row" style={{ marginTop: 18, flexWrap: "wrap" }}>
        <div>
          <div className="card-label">Adjudicated outcome</div>
          <strong style={{ fontSize: 21 }}>
            {dispute.outcome || "Awaiting decision"}
          </strong>
          {dispute.executionRule && (
            <div className="small muted">
              Execution rule: {dispute.executionRule}
            </div>
          )}
        </div>
        {order.state === "Resolved" && onUpdate && (
          <div className="button-row">
            <button
              className="button outline"
              disabled={busy}
              onClick={() => action("appeal")}
            >
              Appeal once
            </button>
            <button
              className="button lime"
              disabled={busy}
              onClick={() => action("settle")}
            >
              Settle by rule
            </button>
          </div>
        )}
      </div>
      {error && <ErrorBox message={error} />}
    </div>
  );
}
