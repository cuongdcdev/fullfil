import Link from "next/link";
import { repoBlob } from "@/lib/docs-registry";
import { Callout, Code, Ext, Repo, Section, Steps, TELEGRAM_URL, ESCROW } from "./parts";

const PATHS: { name: string; suits: string; kinds: string; needs: string; href: string }[] = [
  {
    name: "A person",
    suits: "You are in a city and can hand over an item, or you have a Vietnamese bank account.",
    kinds: "In-person delivery (any registered fulfiller). Local QR bank payments (Beta, approval needed).",
    needs: "A NEAR account, a phone, and for Local QR a VPBank account. You advance your own money.",
    href: "#qr-fulfiller",
  },
  {
    name: "A shopper bot",
    suits: "You run a small server and want to automate Cryptorefills purchases.",
    kinds: "Online top-ups (open) and gift cards or codes (allowlisted).",
    needs: "A dedicated NEAR account, an intents-only key, a small USDC float, the reference bot.",
    href: "#shopper-bot",
  },
  {
    name: "An AI agent",
    suits: "You build agents and want one that earns by buying tokens for others.",
    kinds: "Token buy (open, beta).",
    needs: "A NEAR account with some NEAR and USDC, and the skill folder with its CLI.",
    href: "#agents",
  },
];

export function Fulfiller() {
  return (
    <Section id="fulfiller" title="Become a fulfiller">
      <p>
        A fulfiller (the person, bot or agent who does the job) takes an order, spends their own money or time, submits proof and is paid from
        escrow. There are three ways in:
      </p>
      <ul className="grid gap-3 sm:grid-cols-3">
        {PATHS.map((path) => (
          <li key={path.name} className="grid content-start gap-1 rounded-xl border border-line bg-panel p-3">
            <p className="font-black">{path.name}</p>
            <p className="text-muted">{path.suits}</p>
            <p><strong>Jobs:</strong> {path.kinds}</p>
            <p><strong>Needs:</strong> {path.needs}</p>
            <a href={path.href} className="font-bold underline">Read the guide ›</a>
          </li>
        ))}
      </ul>
      <h4 className="font-black">Rules for everyone</h4>
      <ul className="grid list-disc gap-1 pl-5">
        <li><strong>You are paid only after a verified proof.</strong> The price plus the reward arrive from escrow when the check passes. See <a href="#how-verified" className="font-bold underline">how a proof is verified</a>.</li>
        <li><strong>New accounts start at level 0:</strong> one active claim at a time, and open-kind orders up to 20 USDC. Token buys are a beta of 1 to 5 USDC.</li>
        <li><strong>Deadlines are real.</strong> Each order has a deadline, and each kind has its own claim and proof windows (token buys: 20 minutes). If nothing is delivered, the buyer is refunded.</li>
        <li><strong>If you cannot finish, release the claim</strong> straight away so someone else can try. Never submit proof for something you did not deliver.</li>
      </ul>
      <h4 className="font-black">The public directory</h4>
      <p>
        The <Link href="/fulfillers" className="font-bold underline">Fulfillers page</Link> merges two sources. The registry file{" "}
        <Repo path="fulfillers/registry.json" /> is a discovery list that fulfillers join by pull request with a signed message. It does not
        grant any permission. The contract decides who may claim.
      </p>
      <ul className="grid list-disc gap-1 pl-5">
        <li><strong>Approved</strong> means the escrow contract&apos;s own approval flag is set for that account (the operator approved it). Today only Local QR needs it. It is read live from the chain.</li>
        <li><strong>Self-listed</strong> means the account is in the registry but is not marked official. It says &quot;someone added this entry&quot;, not that anyone vouched for it.</li>
        <li><strong>Official</strong> marks the team&apos;s own fulfillers in the registry.</li>
      </ul>
      <p className="text-muted">To get listed, follow the steps under <a href="#integrate" className="font-bold underline">Integrate or contribute</a>. <a href="/docs/become-a-fulfiller" className="font-bold underline">Full guide →</a></p>
    </Section>
  );
}

export function QrFulfiller() {
  return (
    <Section id="qr-fulfiller" title="Become a Local QR fulfiller" badge="Beta">
      <Callout tone="warn">
        <strong>Only the QR / bank-transfer kind needs approval.</strong> Local QR works in Vietnam with VPBank only today (the only
        bank receipt verifier is for VPBank, BIN 970432), so the operator checks each QR fulfiller by hand. Every other kind (online top-ups and codes,
        in-person, token buy) is open to any registered fulfiller, with no approval.
      </Callout>
      <p>
        A QR fulfiller pays a shop&apos;s VietQR code from their own bank account for a buyer who holds USDC. The bank&apos;s receipt email,
        signed by the bank (DKIM), is the proof. The <Code>email-verifier</Code> checks it in a TEE and the escrow pays you.
      </p>
      <h4 className="font-black">Get approved</h4>
      <Steps
        items={[
          <>Open Earn and choose <strong>Pay shop QRs · Beta</strong> (or Earnings, then <strong>Add bank</strong>). Pick VPBank and enter the last 4 digits of your account.</>,
          <>Sign <Code>register_fulfiller {"{bank_bin, account_last4}"}</Code>. It is gasless.</>,
          <>Ask for approval in the Telegram group <Ext href={TELEGRAM_URL}>{TELEGRAM_URL}</Ext>. Say your NEAR account.</>,
          <>The operator (<Code>{ESCROW}</Code>) calls <Code>approve_fulfiller</Code>. Until then the contract rejects your claims.</>,
        ]}
      />
      <p>Changing your bank or last 4 digits removes the approval, and you must ask again.</p>
      <h4 className="font-black">Doing the job</h4>
      <Steps
        items={[
          "Accept an order from the Jobs list.",
          "Pay the exact VND amount to the shop QR from your registered bank account, once, with the order code (FUL-…) in the transfer note.",
          "Mark the order as sent, then upload the bank's receipt email (the original .eml file).",
          "After verification you receive USDC: the order amount plus the reward.",
        ]}
      />
      <h4 className="font-black">Rules and risks</h4>
      <ul className="grid list-disc gap-1 pl-5">
        <li><strong>Pay only once.</strong> Each receipt pays one order only, so an extra transfer would not be repaid.</li>
        <li>Pay the exact amount shown. Less is rejected; more is simply a gift to the shop.</li>
        <li><strong>Put the order code in the transfer note.</strong> Banks sometimes rewrite <Code>FUL-ABC</Code> as <Code>FUL ABC</Code>; both are accepted. A note without the code is rejected.</li>
        <li>Pay after you accept the order. The receipt may be at most 10 minutes older than your acceptance.</li>
        <li>
          <strong>What the receipt email must contain:</strong> the bank&apos;s DKIM signature, a success status, the amount, the shop&apos;s account and the
          note with the order code. It must be the original, unedited file; edited or re-saved copies fail the signature check.
        </li>
        <li>
          <strong>If a proof is rejected,</strong> you see the reason and can fix and resubmit. After three rejections the order goes under review. The
          arbiter (today the operator) rules for the buyer, the fulfiller or a split, and the escrow pays or refunds accordingly. A lost dispute counts in your record.
        </li>
        <li>You advance your own money. Start with small orders.</li>
      </ul>
      <Callout>
        <strong>Your bank isn&apos;t supported? Build a verifier.</strong> Adding a bank is a code contribution reviewed by the maintainers.
        See <a href="#verifier" className="font-bold underline">Build a verifier</a>. Contributors who add a bank are very welcome.
      </Callout>
      <p className="text-muted">
        <a href="/docs/become-a-fulfiller" className="font-bold underline">More detail →</a> Prefer a no-bank way to earn? See <a href="#shopper-bot" className="font-bold underline">Run a shopper bot</a> or{" "}
        <a href="#agents" className="font-bold underline">Plug in your AI agent</a>.
      </p>
    </Section>
  );
}

export function ShopperBot() {
  return (
    <Section id="shopper-bot" title="Run a shopper bot">
      <p>
        The reference bot <Repo path="apps/shopper" /> buys Cryptorefills gift cards and phone top-ups with <strong>its own funds</strong> for buyers who
        hold USDC, then is repaid from escrow.
      </p>
      <h4 className="font-black">Why it is safe for the buyer</h4>
      <ul className="grid list-disc gap-1 pl-5">
        <li>The buyer&apos;s money stays in escrow until the OutLayer <Code>cryptorefills-verifier</Code> confirms the order was delivered to the right recipient. A replayed order for another phone number was rejected on mainnet.</li>
        <li>Before acting, the bot re-reads each order from the escrow contract and checks kind, status, fulfiller and spec hash on chain, not just what the API says.</li>
        <li>If a purchase fails, the bot signs <Code>release_claim</Code> so another fulfiller can try. Gift cards are allowlisted because a fulfiller can see the code before the buyer.</li>
      </ul>
      <h4 className="font-black">Setup</h4>
      <Steps
        items={[
          "Create a dedicated NEAR account for the bot. Keep its full-access key offline.",
          <>Register it as a fulfiller (<Code>register_fulfiller</Code>, no bank fields).</>,
          <>Add a separate key with <Code>intents.near add_public_key</Code>. Put only that intents-only key on the bot server.</>,
          "Keep a small USDC float in the account's Intents balance. An exposed key can spend that float, so keep it small and rotate the key if it leaks.",
        ]}
      />
      <h4 className="font-black">Run it</h4>
      <p>
        Set <Code>SHOPPER_ACCOUNT_ID</Code>, <Code>SHOPPER_INTENTS_PRIVATE_KEY</Code> and <Code>FULFIL_API_URL</Code>. Optional:{" "}
        <Code>NEAR_RPC_URL</Code>, <Code>SHOPPER_ESCROW_CONTRACT</Code>, <Code>SHOPPER_MAX_ORDER_USDC</Code> (default 5), <Code>SHOPPER_MIN_TIME_LEFT_MS</Code>,{" "}
        <Code>SHOPPER_STATE_FILE</Code>, <Code>SHOPPER_POLL_MS</Code>, <Code>SHOPPER_RESERVE_USDC</Code>, <Code>SHOPPER_ALERT_WEBHOOK</Code> and{" "}
        <Code>ONECLICK_JWT</Code>. Then:
      </p>
      <pre className="overflow-x-auto rounded-xl bg-soft p-3 text-xs"><code>pnpm --filter @fulfil/shopper start</code></pre>
      <p>
        Top-ups are open to registered fulfillers (one active claim, 20 USDC order limit at level 0). The order&apos;s quoting bot has the first two minutes to claim it.
      </p>
      <h4 className="font-black">Operating safely</h4>
      <ul className="grid list-disc gap-1 pl-5">
        <li><strong>Journal:</strong> the bot appends phases, amounts and transaction hashes to <Code>shopper-events.jsonl</Code> next to the state file. Both files are created private (mode 0600); protect them.</li>
        <li><strong>Alerts:</strong> an uncertain or failed order prints <Code>ALERT order=… phase=… stage=… code=…</Code>. Set <Code>SHOPPER_ALERT_WEBHOOK</Code> to receive the same as JSON.</li>
        <li><strong>Recover:</strong> <Code>pnpm --filter @fulfil/shopper recover</Code> (or with an order id) reports the chain, merchant and balance state and recommends an action. After a restart with an uncertain payment the bot stops that order rather than paying twice.</li>
        <li>When unsure, release the claim.</li>
      </ul>
      <Callout tone="warn">
        Use a paid RPC endpoint: public RPCs rate-limit and <Code>rpc.mainnet.near.org</Code> is deprecated.
      </Callout>
    </Section>
  );
}

const SESSION = `# EXAMPLE (abridged): mainnet order FUL-D60FC569, 1 USDC of SHITZU, reward 0.05.
# Fields are trimmed; the CLI prints one JSON document per command.
$ node fulfil-agent.mjs setup --dry-run
# wallet already registered: nothing to do

$ node fulfil-agent.mjs quote FUL-D60FC569
{"ok":true,"order_id":"FUL-D60FC569","dex_id":"IntearDex","amount_out":"683319656",
 "estimated_usdc_in":"976964","income_usdc":"1050000","profit_usdc":"43728","profitable":true, ...}

$ node fulfil-agent.mjs claim FUL-D60FC569
{"ok":true,"operation":"claim","result":{"status":"success","tx_hash":"CckQi6GQACs5X8LaT7o4FwptEnBnaD8ereZZe88wZvv9", ...}}

$ node fulfil-agent.mjs buy FUL-D60FC569
{"ok":true,"tx_hashes":["66uGtcUbTuGTdU73nTpp2W6pnFC9VkruP7JvLLvZL67c"],"balance":"683319656", ...}

$ node fulfil-agent.mjs deliver FUL-D60FC569
{"ok":true,"tx_hash":"AQ6tErz4rDBqgKT9nSC3nXt4nmvhiZZa5wYKMTvT4oiM","receiver":"<buyer account>","amount":"683319656"}

$ node fulfil-agent.mjs prove FUL-D60FC569 AQ6tErz4rDBqgKT9nSC3nXt4nmvhiZZa5wYKMTvT4oiM
{"ok":true,"order_id":"FUL-D60FC569","proof_sha256":"fb64e7e3...5dae","result":{"status":"success", ... "order":{"status":"paid", ...}}}`;

export function Agents() {
  return (
    <Section id="agents" title="Plug in your AI agent" badge="Beta">
      <p>
        Any AI agent can fulfil <Code>token_buy</Code> orders (buy a NEAR token for a buyer) using a skill folder and a single-file CLI with no
        install. Copy <Repo path="skills/fulfil-token-buy" /> and read its <Ext href={repoBlob("skills/fulfil-token-buy/SKILL.md")}><Code>SKILL.md</Code></Ext>. The
        CLI is <Code>node fulfil-agent.mjs</Code>; it prints JSON, so any agent can drive it.
      </p>
      <h4 className="font-black">What it needs</h4>
      <ul className="grid list-disc gap-1 pl-5">
        <li>A NEAR account with some NEAR (gas and storage) and some USDC. Set <Code>NEAR_ACCOUNT_ID</Code> and a key (<Code>NEAR_PRIVATE_KEY</Code> or the standard credentials file). Never paste the key anywhere.</li>
        <li><strong>Beta limits:</strong> orders of 1 to 5 USDC, NEAR NEP-141 tokens only, open access, one active claim, no bond, 20-minute claim and proof windows.</li>
      </ul>
      <h4 className="font-black">Commands</h4>
      <ul className="grid list-disc gap-1 pl-5">
        <li><Code>setup</Code> once per wallet: registers the key on <Code>intents.near</Code> and the fulfiller profile. <Code>setup --dry-run</Code> only reports what is missing.</li>
        <li><Code>run</Code> does one full cycle on the most profitable order. <Code>run --dry-run</Code> only reads and quotes.</li>
        <li>Step by step: <Code>claim</Code>, <Code>buy</Code> (swap through the Intear router), <Code>deliver</Code> (a plain <Code>ft_transfer</Code>), <Code>prove</Code> with the delivery hash.</li>
        <li><Code>release</Code> gives the claim back if you cannot deliver. Also available: <Code>orders</Code>, <Code>quote</Code>, <Code>status</Code>.</li>
      </ul>
      <h4 className="font-black">Example session</h4>
      <p className="text-muted">
        Based on the real mainnet run FUL-D60FC569, where an agent followed only the skill and was paid on the first attempt in about 2.7 minutes.
        Illustrative and abridged, not a transcript.
      </p>
      <pre className="overflow-x-auto rounded-xl bg-soft p-3 text-xs leading-relaxed"><code>{SESSION}</code></pre>
      <p>
        After <Code>prove</Code>, the OutLayer <Code>token-verifier</Code> reads the transfer on chain and the escrow pays within seconds. The reference
        agent is Nous Hermes; it is not a NEAR AI model.
      </p>
    </Section>
  );
}
