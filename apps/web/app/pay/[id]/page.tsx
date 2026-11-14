"use client";

import { use } from "react";
import { Column } from "@/components/requester/common";
import { TrackerV3 } from "@/components/v3/pay-tracker";

export default function PayTrackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Column>
      <TrackerV3 id={id} />
    </Column>
  );
}
