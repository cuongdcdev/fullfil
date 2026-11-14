import type { ReactNode } from "react";
import { Notice, StatusPill, Stepper } from "@/components/ui/kit";
import { VietQrMark } from "@/components/ui/vietqr-mark";
import { Btn, Busy, Chips, FakeQr, Field, H, Idle, JobCard, Log, Rows, Sub } from "./parts";

export type Escrow = { state: "none" | "locked" | "paid" | "refunded"; amount?: string };
export type Step = {
  title: string;
  caption: string;
  safe: string;
  actor: "buyer" | "other";
  escrow: Escrow;
  buyer: ReactNode;
  other: ReactNode;
  verifier?: { title: string; checks: string[] };
};
export type Story = {
  id: "nearby" | "online" | "token" | "qr";
  tab: string;
  otherName: string;
  otherTitle: string;
  cta: { label: string; href: string };
  refund: string;
  steps: Step[];
};

const IN_PERSON = ["Paid", "Helper accepted", "Handed over (QR receipt)", "Verified", "Done"];
const SHOP = ["Paid", "Purchased", "Verified", "Delivered"];
const TOKEN = ["Paid", "Agent bought token", "OutLayer verified", "Done"];
const BANK = ["Paid", "Local found", "Shop paid", "Done"];
const Wait = ({ children }: { children: ReactNode }) => <Busy>{children}</Busy>;

/* ------------------------------------------------------------------ nearby */
const nearby: Story = {
  id: "nearby",
  tab: "Buy anything nearby",
  otherName: "Local helper",
  otherTitle: "A local helper (fulfiller)",
  cta: { label: "Buy something nearby", href: "/shop/in-person" },
  refund: "Nobody accepted, or the item never arrived? At the deadline escrow sends your money back.",
  steps: [
    {
      title: "Describe what you want",
      caption: "You say what you want, the most you will pay, where you are and where to meet. You also pick a deadline of up to 24 hours.",
      safe: "Your exact meeting place stays private. Only the helper who accepts will see it.",
      actor: "buyer",
      escrow: { state: "none" },
      buyer: (<>
        <H>In-person delivery</H>
        <Field label="What should they bring?" value="Iced coffee" />
        <Field label="Item price ($)" value="2.50" />
        <Field label="Area people can see" value="My Khe, Da Nang" />
        <Chips items={["12 hours", "24 hours"]} active="24 hours" />
        <Btn pulse>See total</Btn>
      </>),
      other: <Idle title="No jobs yet">Helpers see new orders here as soon as they are paid.</Idle>,
    },
    {
      title: "Pay into escrow",
      caption: "You pay once, in USDC. The money goes into NEAR escrow (a safe contract), not to any person.",
      safe: "Funds are locked before anyone moves. Nobody can touch them until the job is proven.",
      actor: "buyer",
      escrow: { state: "locked", amount: "$2.63" },
      buyer: (<>
        <H>Your order</H>
        <Rows rows={[["Item price", "$2.50"], ["Reward", "$0.13"], ["Total", "$2.63", true]]} />
        <Notice tone="warn">Paid into escrow. Finding a helper…</Notice>
        <Stepper steps={IN_PERSON} current={1} />
      </>),
      other: <Idle title="No jobs yet">Helpers see new orders here as soon as they are paid.</Idle>,
    },
    {
      title: "A local helper accepts",
      caption: "A verified local helper sees the job, accepts it and buys the coffee with their own money.",
      safe: "The helper fronts the cost, so you never pay a stranger up front.",
      actor: "other",
      escrow: { state: "locked", amount: "$2.63" },
      buyer: (<>
        <StatusPill tone="warn">Meet your helper</StatusPill>
        <H>Iced coffee</H>
        <Rows rows={[["Item", "Iced coffee"], ["Helper", "linh.near"], ["Total", "$2.63", true]]} />
        <Stepper steps={IN_PERSON} current={2} />
      </>),
      other: (<>
        <JobCard tag="Deliver nearby" title="Iced coffee" area="Area: My Khe, Da Nang" earn="$0.13"
          pay="You pay first: $2.50 (for the item). You get back $2.63 USDC with the reward."
          steps="Buy item → Hand over & scan buyer's QR → Get paid" action={<Btn pulse>Accept</Btn>} />
      </>),
    },
    {
      title: "The helper brings it to you",
      caption: "Now they only need to meet you. The helper sees the exact place and how to reach you.",
      safe: "The helper is not paid yet. Payment waits for your confirmation.",
      actor: "other",
      escrow: { state: "locked", amount: "$2.63" },
      buyer: (<>
        <H>Your delivery code</H>
        <p>You need this code to receive your item. Only show it after you have the item.</p>
        <Btn>I received it</Btn>
        <Stepper steps={IN_PERSON} current={2} />
      </>),
      other: (<>
        <H>Bring the item to the buyer</H>
        <Notice tone="warn">Hand over the item and scan the buyer&apos;s code before the order deadline.</Notice>
        <Rows rows={[["Item", "Iced coffee"], ["Meet at", "Highlands Coffee, 25 Vo Nguyen Giap"], ["Contact", "Telegram @mai"]]} />
      </>),
    },
    {
      title: "You confirm with a QR receipt",
      caption: "When you have your coffee, tap “I received it”. A QR code appears and the helper scans it.",
      safe: "No QR, no pay. The code only exists after you accept the goods.",
      actor: "buyer",
      escrow: { state: "locked", amount: "$2.63" },
      buyer: (<>
        <H>Show this to your helper</H>
        <Sub>Let them scan it now. Show it only to the helper who gave you the item.</Sub>
        <div className="grid justify-items-center py-1"><FakeQr size={168} /></div>
      </>),
      other: (<>
        <H>Active delivery</H>
        <Btn tone="outline">Scan buyer&apos;s QR</Btn>
        <Busy>Scanning…</Busy>
        <Sub>You get paid automatically after the check.</Sub>
      </>),
    },
    {
      title: "Escrow pays the helper",
      caption: "The escrow contract checks that the secret in the QR matches the fingerprint you stored when you ordered. If it matches, it pays the helper.",
      safe: "The contract itself does the check, so nobody can mark their own homework.",
      actor: "other",
      escrow: { state: "paid", amount: "$2.63" },
      buyer: (<>
        <StatusPill tone="good">Handed over and paid</StatusPill>
        <Notice>Delivery confirmed. Your helper has been paid.</Notice>
        <Stepper steps={IN_PERSON} current={5} />
      </>),
      other: (<>
        <H>You earned $2.63</H>
        <Rows rows={[["Item you bought", "$2.50"], ["Reward", "$0.13"], ["Total", "$2.63", true]]} />
        <Notice>Paid to your balance.</Notice>
      </>),
      verifier: { title: "NEAR escrow contract", checks: ["QR secret matches the stored hash", "Code used only once"] },
    },
    {
      title: "If nobody delivers",
      caption: "Say no helper accepts, or the item never arrives. When the deadline passes, you tap “Get refund”.",
      safe: "Silence never punishes you. The money simply goes back to you.",
      actor: "buyer",
      escrow: { state: "refunded", amount: "$2.63" },
      buyer: (<>
        <StatusPill tone="bad">Order expired</StatusPill>
        <H>Iced coffee</H>
        <Notice tone="warn">The deadline passed. Your money was returned.</Notice>
        <Stepper steps={IN_PERSON} current={0} />
      </>),
      other: <Idle title="Job expired">The helper was not paid because nothing was confirmed.</Idle>,
    },
  ],
};

/* ------------------------------------------------------------------ online */
const online: Story = {
  id: "online",
  tab: "Buy online",
  otherName: "Shopper bot",
  otherTitle: "A shopper bot (an automated buyer)",
  cta: { label: "Browse the shop", href: "/shop" },
  refund: "Bot did not deliver before the deadline? Escrow returns your money.",
  steps: [
    {
      title: "Pick something to buy",
      caption: "Choose a gift card, phone top-up or eSIM from the Cryptorefills catalogue, in your country.",
      safe: "You are only browsing. No money moves yet.",
      actor: "buyer",
      escrow: { state: "none" },
      buyer: (<>
        <H>What would you like to buy?</H>
        <Chips items={["All", "eSIM", "Games", "Mobile top-up", "Streaming"]} active="Mobile top-up" />
        <div className="grid gap-2">
          {["Viettel Mobile Credits", "Mobifone Credits", "Vinaphone Credits"].map((b, i) => (
            <div key={b} className={`flex items-center gap-3 rounded-2xl border bg-panel p-3 ${i === 0 ? "border-brand shadow-card" : "border-line"}`}>
              <span className="h-8 w-8 rounded-lg bg-soft" aria-hidden /><strong>{b}</strong>
            </div>
          ))}
        </div>
      </>),
      other: <Idle title="Shopper bot is waiting">It buys from Cryptorefills as soon as an order is paid.</Idle>,
    },
    {
      title: "See the price, then pay",
      caption: "You enter where it goes (here a phone number) and see the full price before paying: product, reward and total.",
      safe: "The price is quoted up front. The bot cannot charge you more.",
      actor: "buyer",
      escrow: { state: "locked", amount: "$0.97" },
      buyer: (<>
        <H>Viettel Mobile Credits</H>
        <Field label="Phone number" value="+84 912 345 678" />
        <Rows rows={[["Product", "20,000 VND top-up"], ["Price", "$0.92"], ["Reward", "$0.05"], ["Total", "$0.97", true]]} />
        <Notice tone="warn">Paid into escrow. Finding someone to complete your order…</Notice>
      </>),
      other: <Idle title="Shopper bot is waiting">It buys from Cryptorefills as soon as an order is paid.</Idle>,
    },
    {
      title: "The shopper bot claims the order",
      caption: "The order shows up for the shopper bot. It claims it and gets ready to buy with its own money.",
      safe: "The bot spends its own funds first. You are not exposed.",
      actor: "other",
      escrow: { state: "locked", amount: "$0.97" },
      buyer: (<>
        <StatusPill tone="warn">Your order is being prepared</StatusPill>
        <H>Viettel Mobile Credits 20,000 VND</H>
        <Stepper steps={SHOP} current={1} />
      </>),
      other: (<>
        <Sub>Online order</Sub>
        <H>Viettel Mobile Credits 20,000 VND top-up</H>
        <Rows rows={[["Reward paid to the agent", "$0.05"], ["Sent to", "+8••••78"]]} />
        <Busy>Claimed. Buying from Cryptorefills…</Busy>
      </>),
    },
    {
      title: "The bot buys it from Cryptorefills",
      caption: "The bot pays Cryptorefills from its own balance. Cryptorefills sends the top-up (or the code) straight to you.",
      safe: "The delivery goes to your phone number, not through the bot.",
      actor: "other",
      escrow: { state: "locked", amount: "$0.97" },
      buyer: (<>
        <StatusPill tone="good">Purchased</StatusPill>
        <H>On its way to you</H>
        <Sub>Cryptorefills delivers it to +84 912 345 678.</Sub>
        <Stepper steps={SHOP} current={2} />
      </>),
      other: (<>
        <H>Buying</H>
        <Log items={[
          { text: "Pay Cryptorefills (NEAR Intents)", done: true },
          { text: "Order placed with Cryptorefills", done: true },
          { text: "Submit proof of purchase", done: false },
        ]} />
      </>),
    },
    {
      title: "OutLayer checks the delivery",
      caption: "An independent verifier (OutLayer, running in a secure enclave) asks Cryptorefills whether the order really was delivered to your details.",
      safe: "Neither you nor the bot decides. A tamper-proof check does.",
      actor: "other",
      escrow: { state: "locked", amount: "$0.97" },
      buyer: (<>
        <StatusPill tone="good">Delivery verified</StatusPill>
        <H>Checking delivery…</H>
        <Stepper steps={SHOP} current={3} />
      </>),
      other: (<>
        <H>Proof submitted</H>
        <Wait>Waiting for the verifier…</Wait>
      </>),
      verifier: { title: "OutLayer verifier (TEE)", checks: ["Order exists at Cryptorefills", "Delivered to your phone number", "Right product and amount"] },
    },
    {
      title: "Escrow pays the bot",
      caption: "The check passed, so escrow releases the money to the shopper bot. Your top-up is already on your phone.",
      safe: "Pay only after proof. One proof can only be used once.",
      actor: "other",
      escrow: { state: "paid", amount: "$0.97" },
      buyer: (<>
        <StatusPill tone="good">Delivered and complete</StatusPill>
        <H>Viettel Mobile Credits 20,000 VND</H>
        <Notice>Delivered. Your top-up is on its way to your phone.</Notice>
        <Stepper steps={SHOP} current={4} />
      </>),
      other: (<>
        <H>You earned $0.97</H>
        <Rows rows={[["Price paid to the shop", "$0.92"], ["Reward", "$0.05"], ["Total", "$0.97", true]]} />
        <Notice>Paid to the bot&apos;s balance.</Notice>
      </>),
    },
    {
      title: "If it can't be delivered",
      caption: "If the bot fails or the proof is rejected, nobody is paid. After the deadline escrow returns your money.",
      safe: "A missing answer goes to review, never to an automatic loss.",
      actor: "buyer",
      escrow: { state: "refunded", amount: "$0.97" },
      buyer: (<>
        <StatusPill tone="bad">Order expired</StatusPill>
        <H>Viettel Mobile Credits 20,000 VND</H>
        <Notice tone="warn">The deadline passed. Your money was returned.</Notice>
        <Stepper steps={SHOP} current={0} />
      </>),
      other: <Idle title="Order expired">No proof arrived in time, so no payout.</Idle>,
    },
  ],
};

/* ------------------------------------------------------------------- token */
const token: Story = {
  id: "token",
  tab: "Buy any token",
  otherName: "AI agent",
  otherTitle: "An AI agent",
  cta: { label: "Buy any token", href: "/shop/token" },
  refund: "Agent did not deliver the tokens before the deadline? Escrow returns your USDC.",
  steps: [
    {
      title: "Search for a token",
      caption: "Search any token on NEAR, or tap a popular one.",
      safe: "Tokens with warnings are flagged before you can continue.",
      actor: "buyer",
      escrow: { state: "none" },
      buyer: (<>
        <H>Buy any token</H>
        <Field label="Token" value="SHITZU" />
        <Sub>Popular tokens</Sub>
        <Chips items={["SHITZU", "BLACKDRAGON", "ZEC", "RHEA"]} active="SHITZU" />
        <Sub>Spend USDC. An AI agent buys the token and sends it to your wallet.</Sub>
      </>),
      other: <Idle title="AI agent is waiting">It acts as soon as an order is paid.</Idle>,
    },
    {
      title: "Choose how much to spend",
      caption: "Enter 1 to 5 USDC (the beta limit). Slippage is the most the price may move while the agent buys. You see a guaranteed minimum.",
      safe: "The agent must deliver at least the minimum, or it is not paid.",
      actor: "buyer",
      escrow: { state: "none" },
      buyer: (<>
        <Field label="USDC to spend" value="1.00" hint="Min 1 USDC, max 5 USDC." />
        <Chips items={["1%", "3%", "5%", "10%"]} active="3%" />
        <Field label="Receiver NEAR account" value="you.near" />
        <Rows rows={[["Spent on tokens", "$1.00"], ["Reward", "$0.05"], ["Guaranteed minimum", "664.48 SHITZU"], ["Total paid", "$1.05", true]]} />
      </>),
      other: <Idle title="AI agent is waiting">It acts as soon as an order is paid.</Idle>,
    },
    {
      title: "Pay into escrow",
      caption: "You sign once and your USDC moves into NEAR escrow. The order is now open for an agent.",
      safe: "Your USDC is locked. The agent cannot spend it.",
      actor: "buyer",
      escrow: { state: "locked", amount: "$1.05" },
      buyer: (<>
        <StatusPill tone="warn">Finding an agent…</StatusPill>
        <H>664.48 SHITZU</H>
        <Stepper steps={TOKEN} current={1} />
      </>),
      other: (<JobCard tag="Online order" title="≥ 664.48 SHITZU" earn="$0.05"
        pay="Reward paid to the agent. The agent buys with its own funds first." action={<Btn pulse>Claim order</Btn>} />),
    },
    {
      title: "The agent buys the token",
      caption: "The AI agent claims the order and swaps its own USDC for SHITZU, then sends the tokens to your account.",
      safe: "It uses its own money. You are never asked to trust it up front.",
      actor: "other",
      escrow: { state: "locked", amount: "$1.05" },
      buyer: (<>
        <StatusPill tone="warn">An agent is buying your tokens</StatusPill>
        <H>664.48 SHITZU</H>
        <Stepper steps={TOKEN} current={1} />
      </>),
      other: (<>
        <H>Buying SHITZU</H>
        <Log items={[
          { text: "Claimed the order", done: true },
          { text: "Swapped 1.00 USDC for SHITZU", done: true },
          { text: "Sent 685.03 SHITZU to you.near", done: true },
          { text: "Submit the transaction as proof", done: false },
        ]} />
      </>),
    },
    {
      title: "OutLayer reads the blockchain",
      caption: "The verifier looks the transaction up on several NEAR nodes. It checks the right token, the right receiver, enough tokens, and that the agent sent them.",
      safe: "If the nodes disagree, the check fails safely and nobody is paid.",
      actor: "other",
      escrow: { state: "locked", amount: "$1.05" },
      buyer: (<>
        <StatusPill tone="warn">Checking token delivery…</StatusPill>
        <H>664.48 SHITZU</H>
        <Stepper steps={TOKEN} current={2} />
      </>),
      other: (<>
        <H>Proof submitted</H>
        <Wait>Waiting for the verifier…</Wait>
      </>),
      verifier: { title: "OutLayer verifier (TEE)", checks: ["Transfer found on several nodes", "Token and receiver match your order", "Amount at or above the minimum", "Proof never used before"] },
    },
    {
      title: "Escrow pays the agent",
      caption: "Verified. Escrow pays the agent and your tokens are already in your wallet. Neither side paid network fees.",
      safe: "Pay only on proof. The whole check took seconds on mainnet.",
      actor: "other",
      escrow: { state: "paid", amount: "$1.05" },
      buyer: (<>
        <StatusPill tone="good">Tokens delivered</StatusPill>
        <H>685.03 SHITZU</H>
        <Notice>Tokens delivered.</Notice>
        <Rows rows={[["Receiver", "you.near"], ["Spent on tokens", "$1.00"], ["Total paid", "$1.05", true]]} />
      </>),
      other: (<>
        <H>You earned $1.05</H>
        <Rows rows={[["Spent on the token", "$1.00"], ["Reward", "$0.05"], ["Total", "$1.05", true]]} />
        <Notice>Paid to the agent&apos;s balance.</Notice>
      </>),
    },
    {
      title: "If the agent fails",
      caption: "If no agent delivers in time, you tap “Get refund” and your USDC comes back.",
      safe: "Fail closed: when in doubt nobody is paid and you keep your money.",
      actor: "buyer",
      escrow: { state: "refunded", amount: "$1.05" },
      buyer: (<>
        <StatusPill tone="bad">Order expired</StatusPill>
        <H>664.48 SHITZU</H>
        <Notice tone="warn">The deadline passed. Your money was returned.</Notice>
        <Stepper steps={TOKEN} current={0} />
      </>),
      other: <Idle title="Order expired">The agent could not prove delivery in time.</Idle>,
    },
  ],
};

/* ---------------------------------------------------------------------- qr */
const qr: Story = {
  id: "qr",
  tab: "Pay a QR",
  otherName: "Local helper",
  otherTitle: "A local helper in Vietnam",
  cta: { label: "Pay a QR", href: "/pay" },
  refund: "Helper did not pay the shop, or the proof fails? You get your USDC back.",
  steps: [
    {
      title: "Scan the shop's VietQR",
      caption: "VietQR is the national QR standard, so this works at shops all over Vietnam. Point your camera at the code, or upload a photo of it. We read the shop and the amount.",
      safe: "This is a beta: Vietnam only and VPBank only for now.",
      actor: "buyer",
      escrow: { state: "none" },
      buyer: (<>
        <VietQrMark width={96} />
        <H>Scan the shop&apos;s QR</H>
        <div className="grid justify-items-center gap-2 rounded-2xl border border-line bg-panel py-5"><FakeQr size={140} /><Sub>PHO BAY SAO · 85.000 ₫</Sub></div>
      </>),
      other: <Idle title="No jobs yet">Local helpers see QR payments here.</Idle>,
    },
    {
      title: "Add a reward and pay",
      caption: "You pick a thank-you reward for the local who will pay the shop for you, then pay in USDC.",
      safe: "Your USDC goes into NEAR escrow, not to the helper.",
      actor: "buyer",
      escrow: { state: "locked", amount: "$3.85" },
      buyer: (<>
        <H>Add a reward for the local who pays for you</H>
        <Chips items={["$1", "$2", "$3", "$5"]} active="$3" />
        <Rows rows={[["Shop gets", "85.000 ₫"], ["In USDC", "$3.35"], ["Reward", "$0.50"], ["Total", "$3.85", true]]} />
        <Wait>Paid into escrow. Finding a local…</Wait>
      </>),
      other: <Idle title="No jobs yet">Local helpers see QR payments here.</Idle>,
    },
    {
      title: "A local helper accepts",
      caption: "A helper with a Vietnamese bank account sees the job and accepts. They will pay the shop in dong from their own bank.",
      safe: "They pay first, from their own money. You do not trust a stranger with yours.",
      actor: "other",
      escrow: { state: "locked", amount: "$3.85" },
      buyer: (<>
        <H>Local found</H>
        <Sub>Local: linh.near</Sub>
        <Stepper steps={BANK} current={1} />
      </>),
      other: (<JobCard tag="QR payment · Beta" title="PHO BAY SAO" earn="$0.50"
        pay="You pay 85.000 ₫ → Orchid Bank (from your own bank). Paid back $3.35 + reward = $3.85 USDC."
        steps="Pay shop → Upload bank email → Get paid" action={<Btn pulse>Accept</Btn>} />),
    },
    {
      title: "The helper pays the shop",
      caption: "The helper scans the same QR in their bank app and pays 85.000 ₫, putting your order code in the transfer message, then taps “I sent the money”.",
      safe: "The order code in the transfer note ties this bank payment to your order.",
      actor: "other",
      escrow: { state: "locked", amount: "$3.85" },
      buyer: (<>
        <H>Checking the proof…</H>
        <Sub>Local: linh.near</Sub>
        <Stepper steps={BANK} current={2} />
      </>),
      other: (<>
        <Sub>Step 1 of 3</Sub>
        <H>Pay the shop</H>
        <div className="grid justify-items-center"><FakeQr size={120} /></div>
        <Rows rows={[["Shop", "PHO BAY SAO"], ["Amount", "85.000 ₫"], ["Transfer note", "FUL-7C41A9"]]} />
        <Btn pulse>I sent the money</Btn>
      </>),
    },
    {
      title: "The helper shows proof",
      caption: "The helper forwards the email their bank sent about the transfer. Banks sign these emails, so they are hard to fake.",
      safe: "Only a real bank email, for this amount and this order, will pass.",
      actor: "other",
      escrow: { state: "locked", amount: "$3.85" },
      buyer: (<>
        <H>Checking the proof…</H>
        <Wait>This usually takes a minute.</Wait>
        <Stepper steps={BANK} current={2} />
      </>),
      other: (<>
        <Sub>Step 2 of 3</Sub>
        <H>Show us the proof</H>
        <Sub>Send us the email your bank sent you about this transfer.</Sub>
        <div className="grid gap-1 rounded-xl border border-dashed border-line bg-panel p-4 text-center"><strong>bank-email.eml</strong><span className="text-xs text-muted">Uploaded</span></div>
        <Btn pulse>Send proof</Btn>
      </>),
    },
    {
      title: "OutLayer checks the bank email",
      caption: "The verifier checks the bank's digital signature on the email, plus the amount, the recipient and your order code. All inside a secure enclave.",
      safe: "Each bank is one open verifier, so anyone can add their own bank later.",
      actor: "other",
      escrow: { state: "locked", amount: "$3.85" },
      buyer: (<>
        <H>Checking the proof…</H>
        <Stepper steps={BANK} current={2} />
      </>),
      other: (<>
        <H>Proof submitted</H>
        <Wait>Waiting for the verifier…</Wait>
      </>),
      verifier: { title: "OutLayer verifier (TEE)", checks: ["Bank's signature on the email is valid", "Amount is 85.000 ₫ or more", "Recipient is the shop", "Order code is in the note"] },
    },
    {
      title: "Escrow pays the helper",
      caption: "Verified. Escrow pays the helper back with the reward. The shop already has its money, and you can rate the local.",
      safe: "Paid on proof only. If it fails, you are refunded.",
      actor: "other",
      escrow: { state: "paid", amount: "$3.85" },
      buyer: (<>
        <StatusPill tone="good">Done</StatusPill>
        <H>PHO BAY SAO · 85.000 ₫</H>
        <Rows rows={[["Amount", "85.000 ₫"], ["Reward", "$0.50"], ["Total", "$3.85", true]]} />
        <Sub>How was the local? Tap a star.</Sub>
        <div className="flex justify-center gap-1 text-3xl text-[#e4a11b]" aria-hidden>★★★★★</div>
      </>),
      other: (<>
        <H>You earned $3.85</H>
        <Notice>Paid to your balance.</Notice>
        <Rows rows={[["Paid back", "$3.35"], ["Reward", "$0.50"], ["Total", "$3.85", true]]} />
      </>),
    },
  ],
};

export const stories: Story[] = [nearby, online, token, qr];
