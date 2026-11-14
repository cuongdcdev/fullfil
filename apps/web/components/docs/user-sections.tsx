import Link from "next/link";
import { Code, Section, ESCROW } from "./parts";

const FLOW = [
  ["1. Create", "You describe the job and pick a price."],
  ["2. Escrow", "Your USDC is held by the escrow contract (via NEAR Intents)."],
  ["3. Claim", "A fulfiller accepts the order."],
  ["4. Do the job", "They pay, buy or hand over, then submit proof."],
  ["5. Verify", "An OutLayer verifier checks the proof inside a TEE."],
  ["6. Settle", "Valid proof: escrow pays the fulfiller. No delivery: refund to you."],
] as const;

const GLOSSARY: [string, string][] = [
  ["Fulfiller", "A person, bot or AI agent that takes an order, does the job and gets paid from escrow."],
  ["Escrow", `A smart contract (${ESCROW}) that holds the buyer's USDC until proof is verified or the deadline passes.`],
  ["Kind", "A type of job (QR bank payment, in-person purchase, online top-up or code, memecoin buy). Each kind has its own rules and its own verifier."],
  ["OutLayer", "A network that runs verifier programs inside a TEE (a secure enclave nobody can tamper with) and returns the result to the contract."],
  ["NEAR Intents", "NEAR's cross-chain settlement layer. Fulfil uses it to fund orders, hold the escrowed USDC and pay out."],
  ["Operator", `The team account (${ESCROW}) that owns the contract: it enables kinds, approves QR fulfillers and acts as dispute arbiter today.`],
  ["Approval", "A one-time operator OK for an account. Only the QR bank-transfer kind needs it."],
  ["Reward", "The extra USDC the buyer adds on top of the item price. The fulfiller gets price + reward."],
  ["AI Court", "The AI-assisted dispute path. It is the only place Fulfil uses NEAR AI models."],
];

export function HowItWorks() {
  return (
    <Section id="how-it-works" title="How an order works">
      <ol className="grid gap-2 sm:grid-cols-3" aria-label="Order steps">
        {FLOW.map(([title, text]) => (
          <li key={title} className="rounded-xl border border-line bg-panel p-3">
            <p className="font-black">{title}</p>
            <p className="text-muted">{text}</p>
          </li>
        ))}
      </ol>
      <p className="text-muted">
        See the picture on the <Link href="/#how-it-works" className="font-bold underline">Home page diagram</Link>, and{" "}
        <a href="#how-verified" className="font-bold underline">how a proof is verified</a> below.
      </p>
      <p>
        If nobody delivers before the deadline, the buyer is refunded. If a proof is rejected, the fulfiller can try again; after repeated
        rejections the order goes to review by the arbiter.
      </p>
      <h4 className="font-black">Glossary</h4>
      <dl className="grid gap-2 sm:grid-cols-2">
        {GLOSSARY.map(([term, text]) => (
          <div key={term} className="rounded-xl bg-soft p-3">
            <dt className="font-black">{term}</dt>
            <dd className="text-muted">{text}</dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}

export function BuyerFaq() {
  return (
    <Section id="buyer-faq" title="Buyer FAQ">
      <div className="grid gap-3">
        <div>
          <h4 className="font-black">What is the delivery code QR?</h4>
          <p>
            For in-person orders. Only a hash of your secret code is on chain. When your helper hands over the item, tap &quot;I received
            it&quot; and show the QR; the helper scans it and the escrow pays them. Show it only after you have the item. The code lives in
            your browser, so keep the backup code it offers.
          </p>
        </div>
        <div>
          <h4 className="font-black">What if I never get my order?</h4>
          <p>
            Without a valid proof or code, the money stays in escrow. After the deadline, anyone can trigger the refund and the full amount
            returns to you (this is permissionless, for orders that are funded or accepted but not yet in verification). You can also cancel an order
            nobody has accepted yet. Once a fulfiller has accepted, you cannot cancel; wait for the deadline.
          </p>
        </div>
        <div>
          <h4 className="font-black">Can I rate my helper?</h4>
          <p>
            Yes. After an order is paid, each side can give 1 to 5 stars once, within the rating window. Ratings count in proportion to the
            order value, and very small orders may count for nothing (an anti-farming rule).
          </p>
        </div>
        <div>
          <h4 className="font-black">Who can see my contacts?</h4>
          <p>
            Only the buyer and the fulfiller of that order, and only after it is accepted. Contacts are hidden again 7 days after the order
            closes. Nobody else sees them. You choose what to share on your <Link href="/account#profile" className="font-bold underline">account page</Link>.
          </p>
        </div>
      </div>
    </Section>
  );
}

export function HowVerified() {
  return (
    <Section id="how-verified" title="How a proof is verified">
      <p>
        The escrow never takes anyone&apos;s word for it. Money is released only when a check passes, and who does the check depends on the
        kind of job. The overview is on the <Link href="/#how-it-works" className="font-bold underline">Home diagram</Link>.
      </p>
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[34rem] border-collapse text-left">
          <thead className="bg-soft">
            <tr><th className="p-2">Kind</th><th className="p-2">Who checks</th><th className="p-2">What is checked</th></tr>
          </thead>
          <tbody>
            {[
              ["In person", "The escrow contract itself", "The hash of the buyer's secret code is stored in the order. The scanned code must hash to the same value. A wrong code counts as a failed attempt."],
              ["Local QR (bank transfer)", "OutLayer TEE worker: email-verifier", "The bank's signed receipt email: DKIM signature, amount, shop account, order code in the note, time."],
              ["Online top-up or code", "OutLayer TEE worker: cryptorefills-verifier", "The Cryptorefills order the bot bought is delivered and matches the order's beneficiary (for example the phone number)."],
              ["Token buy", "OutLayer TEE worker: token-verifier", "The token transfer on the NEAR chain, read through several RPC nodes: right token, right receiver, at least the ordered amount."],
            ].map(([kind, who, what]) => (
              <tr key={kind} className="border-t border-line align-top">
                <td className="p-2 font-bold">{kind}</td>
                <td className="p-2">{who}</td>
                <td className="p-2 text-muted">{what}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h4 className="font-black">What is a TEE?</h4>
      <p>
        A TEE (trusted execution environment) is a sealed area of a processor. OutLayer runs each verifier program inside one, so the
        operator of the machine cannot change the program or its result while it runs, and the result comes back to the escrow contract
        in a form the contract accepts. You still trust the processor maker&apos;s hardware, which is why every verifier is open code that anyone can read.
      </p>
      <h4 className="font-black">Four safety rules</h4>
      <ul className="grid list-disc gap-1 pl-5">
        <li><strong>One proof pays once.</strong> Each verified proof yields a nullifier (a fingerprint of that receipt, order or transfer). The contract rejects a fingerprint it has seen, so a receipt cannot be reused for another order.</li>
        <li><strong>Fail closed.</strong> If a check fails or cannot be completed, nobody is paid. The token verifier, for instance, pays only when at least two RPC nodes agree.</li>
        <li><strong>Silence never punishes.</strong> If a fulfiller goes quiet after marking a job as sent, the order goes to review, not to an automatic refund or loss. Three rejected proofs also go to review by the arbiter.</li>
        <li><strong>The proof file stays private.</strong> Only its hash is on chain.</li>
      </ul>
      <p className="text-muted">
        Real mainnet examples, including rejected cheating attempts, are listed under <a href="#verify" className="font-bold underline">Verify it yourself</a>.
      </p>
    </Section>
  );
}

export function EnableIntents() {
  return (
    <Section id="enable-intents" title="Enable NEAR Intents (one-time setup)">
      <p>
        Fulfil moves money with signed <strong>intents</strong>. NEAR Intents accepts a signature for a named account (like{" "}
        <Code>alice.near</Code>) only if the signing key is registered on <Code>intents.near</Code>. A fresh wallet key is not, so the
        first time you pay or sign, the app shows &quot;One-time setup: enable NEAR Intents&quot;.
      </p>
      <p>
        It asks your wallet to call <Code>add_public_key</Code> on <Code>intents.near</Code> for that key. The cost is 1 yoctoNEAR plus gas
        (under 0.001 NEAR), once per key. A different wallet or a new key needs the step again.
      </p>
      <h4 className="font-black">What the key can and cannot do</h4>
      <ul className="grid list-disc gap-1 pl-5">
        <li>It can sign intents for <strong>that one account</strong>, such as paying from your own Intents balance.</li>
        <li>It cannot move buyer escrow funds: those sit in the escrow contract and leave only by its rules (verified proof, refund or arbiter ruling).</li>
        <li>It is not a full-access key, so it cannot change your wallet or move your other NEAR assets.</li>
      </ul>
      <h4 className="font-black">If something goes wrong</h4>
      <ul className="grid list-disc gap-1 pl-5">
        <li><strong>Transaction rejected or closed:</strong> nothing changed. Press the button again and approve it in the wallet. Make sure the wallet is signed in as the same account you use in Fulfil.</li>
        <li><strong>Empty NEAR balance:</strong> the step pays a tiny network fee in NEAR. Add a small amount of NEAR (a fraction of 1 NEAR is plenty) and try again.</li>
        <li>If you press &quot;Not now&quot; nothing changes, and the dialog returns when you next need to sign.</li>
      </ul>
    </Section>
  );
}
