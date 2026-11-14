import type { Metadata } from "next";
import { GuidedDemo } from "@/components/guided-demo/guided-demo";

export const metadata: Metadata = { title: "Guided demo · Fulfil" };

export default function DemoPage() {
  return (
    <div className="page grid gap-6">
      <header className="grid max-w-3xl gap-2">
        <h1 className="h1-title">Guided demo</h1>
        <p className="text-lg leading-relaxed text-muted">
          See how each kind of order works, from both sides. Pick a story and step through it. Nothing here is real: no wallet, no money.
        </p>
      </header>
      <GuidedDemo />
    </div>
  );
}
