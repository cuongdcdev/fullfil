"use client";

import Link from "next/link";
import { ArrowRight, Gavel, ShieldAlert } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api, errorMessage, type OrderDetail } from "@/lib/api";
import { CaseFile } from "@/components/order-view";
import { ErrorBox, Loading, ModeBadge, StateBadge } from "@/components/ui";

export default function CourtPage() {
  const [cases, setCases] = useState<OrderDetail[]>([]);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    try {
      const next = await api.cases();
      setCases(next);
      setSelected((current) => current || next[0]?.id || "");
      setError("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
    const timer = setInterval(load, 3000);
    return () => clearInterval(timer);
  }, [load]);
  const active = cases.find((item) => item.id === selected);
  return (
    <div className="page">
      <div className="eyebrow">
        Juror workspace{" "}
        <span className="badge amber" style={{ marginLeft: 8, verticalAlign: "middle" }}>
          Sample case
        </span>
      </div>
      <h1 className="page-title">The Court reads the record.</h1>
      <div className="card soft" role="note" style={{ margin: "4px 0 14px", padding: "14px 16px" }}>
        <span className="badge amber">Research preview · demo data</span>
        <p style={{ margin: "8px 0 0", fontSize: 14 }}>
          In production, AI jurors only draft a recommendation; a human arbiter signs the decision on-chain.
        </p>
      </div>
      <p className="lead">
        Locked criteria and evidence enter three layers. Jurors give cited
        reasons; the rule engine executes the outcome. The case below is a
        sample for illustration, not a real dispute.
      </p>
      {error && <ErrorBox message={error} retry={load} />}
      {loading ? (
        <Loading label="Loading case files" />
      ) : (
        <div
          className="grid court-layout"
          style={{
            marginTop: 25,
            alignItems: "start",
          }}
        >
          <aside className="card">
            <div className="card-header">
              <h2 className="section-title">Case queue</h2>
              <Gavel size={20} />
            </div>
            {cases.length ? (
              <div className="stack">
                {cases.map((order) => (
                  <button
                    key={order.id}
                    className={`card ${selected === order.id ? "accent" : ""}`}
                    style={{ textAlign: "left", padding: 13 }}
                    onClick={() => setSelected(order.id)}
                  >
                    <div className="row">
                      <strong className="small">{order.id}</strong>
                      <StateBadge state={order.state} />
                    </div>
                    <p className="small" style={{ marginBottom: 0 }}>
                      {order.dispute?.reason.slice(0, 100)}
                      {(order.dispute?.reason.length || 0) > 100 ? "…" : ""}
                    </p>
                  </button>
                ))}
              </div>
            ) : (
              <p className="muted small">
                No cases yet. Try the example to see how a buyer complaint is reviewed.
              </p>
            )}
          </aside>
          <div>
            {active ? (
              <>
                <CaseFile
                  order={active}
                  onUpdate={(updated) =>
                    setCases((current) =>
                      current.map((item) =>
                        item.id === updated.id ? updated : item,
                      ),
                    )
                  }
                />
                <Link
                  href={`/orders/${active.id}`}
                  className="button outline"
                  style={{ marginTop: 15 }}
                >
                  View full order <ArrowRight size={14} />
                </Link>
              </>
            ) : (
              <div className="card soft">
                <ShieldAlert size={26} />
                <h2 className="section-title" style={{ marginTop: 15 }}>
                  No case selected
                </h2>
                <p className="muted">
                  Run the demo attack sequence to open a case.
                </p>
                <Link href="/demo" className="button lime">
                  Open demo <ArrowRight size={14} />
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
