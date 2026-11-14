"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/kit";
import { useAuth } from "@/components/v3/auth";
import { v3, type OrderContact, type V3Order } from "@/lib/v3-client";

/** Never shows an error: parties get a muted hint, everyone else gets nothing. */
export function ContactCard({ order }: { order: Pick<V3Order, "id" | "buyer" | "fulfiller"> }) {
  const { session } = useAuth();
  const orderId = order.id;
  const claimed = !!order.fulfiller;
  const account = session?.account_id;
  const isBuyer = !!account && account === order.buyer;
  const isFulfiller = !!account && account === order.fulfiller;
  const party = isBuyer || isFulfiller;
  const [contact, setContact] = useState<{ orderId: string; value: OrderContact } | null>(null);
  useEffect(() => {
    if (!claimed || !party) return;
    let active = true;
    const refresh = () => {
      v3.orderContact(orderId).then((value) => {
        if (active) setContact({ orderId, value });
      }).catch(() => {
        if (active) setContact(null);
      });
    };
    refresh();
    const whenVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const timer = window.setInterval(whenVisible, 15_000);
    document.addEventListener("visibilitychange", whenVisible);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", whenVisible);
    };
  }, [orderId, claimed, party]);
  if (!party) return null;
  const value = contact?.orderId === orderId ? contact.value : null;
  if (!claimed) {
    return <p className="text-sm text-muted">{isBuyer ? "Contacts appear here once a helper accepts your order." : "Contacts appear here once you accept."}</p>;
  }
  if (!value || !Object.values(value.contacts).some(Boolean)) {
    return (
      <p className="text-sm text-muted">
        {isBuyer ? "Your helper has not shared contacts yet." : "The buyer has not shared contacts yet."}{" "}
        <Link href="/account" className="font-bold underline">Add your own contacts</Link> so they can reach you.
      </p>
    );
  }
  return (
    <Card as="section" className="grid gap-2">
      <h2 className="font-bold">Contact {value.display_name || "the other person"}</h2>
      {value.contacts.x && <a className="font-bold underline" href={`https://x.com/${value.contacts.x}`} target="_blank" rel="noopener noreferrer">X @{value.contacts.x}</a>}
      {value.contacts.telegram && <a className="font-bold underline" href={`https://t.me/${value.contacts.telegram}`} target="_blank" rel="noopener noreferrer">Telegram @{value.contacts.telegram}</a>}
      {value.contacts.email && <a className="font-bold underline" href={`mailto:${value.contacts.email}`}>Email {value.contacts.email}</a>}
    </Card>
  );
}
