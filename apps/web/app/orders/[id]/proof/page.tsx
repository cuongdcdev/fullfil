"use client";

import { use } from "react";
import { Column } from "@/components/requester/common";
import { ProofView } from "@/components/requester/proof";

export default function ProofPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Column>
      <ProofView id={id} />
    </Column>
  );
}
