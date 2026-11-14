"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, errorMessage, type OrderDetail } from "@/lib/api";
import { OrderView } from "@/components/order-view";
import { ErrorBox, Loading } from "@/components/ui";

export default function OrderPage() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      setOrder(await api.order(id));
      setError("");
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [id]);
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") void load();
    };
    refresh();
    const timer = setInterval(refresh, 10_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [load]);
  return (
    <div className="page">
      <div className="eyebrow">Order workspace</div>
      <h1 className="page-title">Every step, accounted for.</h1>
      <p className="lead">
        A shared view of the locked request, money, evidence, and decisions.
      </p>
      {error && <ErrorBox message={error} retry={load} />}
      {order ? (
        <OrderView order={order} onUpdate={setOrder} />
      ) : (
        !error && <Loading label="Loading order" />
      )}
    </div>
  );
}
