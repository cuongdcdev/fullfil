import { HowProtected } from "@/components/ui/protection";
import { AiCourt, Integrate, OpenInfra, Verifier, Verify } from "@/components/docs/builder-sections";
import { Agents, Fulfiller, QrFulfiller, ShopperBot } from "@/components/docs/fulfiller-sections";
import { GroupHeading } from "@/components/docs/parts";
import { docsNavGroups } from "@/components/docs/nav";
import { DocsToc } from "@/components/docs/toc";
import { BuyerFaq, EnableIntents, HowItWorks, HowVerified } from "@/components/docs/user-sections";

export const metadata = { title: "Docs" };

const GROUPS = [
  {
    title: "For users",
    items: [
      { id: "how-it-works", label: "How an order works" },
      { id: "how-verified", label: "How a proof is verified" },
      { id: "how-protected", label: "How you're protected" },
      { id: "buyer-faq", label: "Buyer FAQ" },
      { id: "enable-intents", label: "Enable NEAR Intents" },
    ],
  },
  {
    title: "For fulfillers",
    items: [
      { id: "fulfiller", label: "Become a fulfiller" },
      { id: "qr-fulfiller", label: "Local QR fulfiller (Beta)" },
      { id: "shopper-bot", label: "Run a shopper bot" },
      { id: "agents", label: "Plug in your AI agent" },
    ],
  },
  {
    title: "For builders and judges",
    items: [
      { id: "open-infra", label: "Open infrastructure" },
      { id: "verify", label: "Verify it yourself" },
      { id: "verifier", label: "Build a verifier" },
      { id: "ai-court", label: "AI Court (preview)" },
      { id: "integrate", label: "Integrate or contribute" },
    ],
  },
];

export default function DocsPage() {
  return (
    <div className="page grid gap-8">
      <header className="grid max-w-[75ch] gap-2">
        <h1 className="page-title">Docs</h1>
        <p className="text-muted">
          Fulfil lets anyone pay for real-world things with crypto. A fulfiller does the job, a verifier checks the proof, and an escrow on NEAR
          pays out only when it is proven.
        </p>
      </header>
      <div className="grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-12">
        <DocsToc groups={[...GROUPS, ...docsNavGroups({})]} />
        <div className="grid min-w-0 max-w-[75ch] content-start gap-8">
      <GroupHeading>For users</GroupHeading>
      <HowItWorks />
      <HowVerified />
      <HowProtected id="how-protected" />
      <BuyerFaq />
      <EnableIntents />
      <GroupHeading>For fulfillers</GroupHeading>
      <Fulfiller />
      <QrFulfiller />
      <ShopperBot />
      <Agents />
      <GroupHeading>For builders and judges</GroupHeading>
      <OpenInfra />
      <Verify />
      <Verifier />
      <AiCourt />
      <Integrate />
        </div>
      </div>
    </div>
  );
}
