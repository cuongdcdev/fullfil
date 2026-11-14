import Link from "next/link";
import { attacks, earlierRuns } from "@/lib/mainnet-evidence";
import { Callout, Code, Ext, Repo, Section, Steps, TELEGRAM_URL, ESCROW, tx } from "./parts";

const KIND_LABELS: Record<string, string> = {
  bank_transfer: "QR bank transfer",
  cryptorefills_topup: "Online top-up (Cryptorefills)",
  in_person: "Offline, in person",
  token_buy: "Memecoin buy (token_buy)",
};

/**
 * Transaction hashes live in lib/mainnet-evidence.ts (single source, also used on Home). The hashes below are
 * ONLY ones that file does not hold: extra legs (fund, confirm) kept from the internal run log.
 */
const EXTRA_TXS: Record<string, [string, string][]> = {
  "FUL-892B4EF7": [["fund", "A3ono5Jj6CEkqwQTvquK8eF9sPzxcLsqXXc73kYfo4Yw"]],
  "FUL-EF73668E": [
    ["fund", "AXvkfVpAp1vJgtcpB4iWR1fKNUmt1X34WfcwTTyqRpgC"],
    ["confirm", "w6BLi8BXnDUe7iZ8zHX7CKCe9DZifFooepEtSbnrXLE"],
  ],
  "FUL-E549842C": [["fund", "2ZgYXK9a6KMnZtgZQ6Mv27JkBUhYpY8m35zMLHFJKVs4"]],
};

type Row = { kind: string; order: string; what: string; txs: [string, string][] };

const VERIFIED: Row[] = [
  ...earlierRuns.map((run) => ({
    kind: KIND_LABELS[run.kind] ?? run.kind,
    order: run.id,
    what: `${run.title}. ${run.detail}`,
    txs: [...(EXTRA_TXS[run.id] ?? []), ...(run.hash ? [[run.hashLabel ?? "tx", run.hash] as [string, string]] : [])],
  })),
  {
    // Not in mainnet-evidence.ts: the human-arbiter case.
    kind: "QR bank transfer (dispute)",
    order: "FUL-2A6D0AEE",
    what: "Same route, 10,000 VND. The bank rewrote the order code in the note, which the first verifier rejected; the human arbiter paid the fulfiller and the verifier was fixed.",
    txs: [["arbiter ruling", "4CJPtWdBQowWyYU8wxmzekNJZWW7VbftsSrSLd6RwQyq"]],
  },
];

export function OpenInfra() {
  return (
    <Section id="open-infra" title="Open infrastructure: how it works and why it matters">
      <p>
        Fulfil is not one app with a fixed list of jobs. It is an <strong>escrow plus pluggable verifiers</strong>. A kind is the escrow rules
        plus its own OutLayer verifier project (<Code>verifier_source</Code>). The maintainers register a kind with one <Code>set_kind</Code> call; the
        escrow code is generic about the verifier, so a new verifier-backed kind needs no contract upgrade. The built-in in-person kind needs no verifier project at all.
      </p>
      <ul className="grid list-disc gap-1 pl-5">
        <li>
          <strong>Access modes per kind:</strong> <Code>open</Code> (any registered fulfiller), <Code>approved</Code> (operator list),{" "}
          <Code>allowlist</Code> (named accounts) and <Code>min_bond</Code> (fulfiller must hold a bond).
        </li>
        <li>
          <strong>Anyone can fulfil:</strong> a person, a bot or an AI agent. A fulfiller is just a NEAR account that registered on the escrow.
        </li>
        <li>
          <strong>Public registry:</strong> fulfillers list themselves in <Repo path="fulfillers/registry.json" /> with a signed proof, so users and agents can discover them.
        </li>
        <li>
          <strong>Open verifiers:</strong> anyone can propose a bank or a new proof type by pull request; maintainers review and deploy it (see below).
        </li>
      </ul>
      <h4 className="font-black">NEAR technology used</h4>
      <ul className="grid list-disc gap-2 pl-5">
        <li>
          <strong>NEAR Intents.</strong> Buyers fund an order with a signed intent that transfers NEP-245 USDC into the escrow. The escrow holds
          it on <Code>intents.near</Code> and pays out with <Code>mt_transfer</Code>. Actions like register, claim and submit proof go through{" "}
          <Code>auth_call</Code> intents relayed by the backend, so users and fulfillers pay no gas. The wallet&apos;s add-money flow uses the 1Click
          API to swap and deposit into Intents. A NEAR to USDC deposit and a 1Click payout to Cryptorefills have both run on mainnet; the wider
          any-chain token picker is built but its real-deposit test is still pending.
        </li>
        <li>
          <strong>OutLayer.</strong> Verifiers are WASM programs that OutLayer runs in a TEE. The escrow calls them from <Code>submit_proof</Code>{" "}
          and pays only on their signed-off result. The proof file never goes on chain, only its hash.
        </li>
        <li>
          <strong>Named accounts and scoped keys.</strong> Fulfillers are NEAR accounts. An AI agent can sign with a key that is registered
          only on <Code>intents.near</Code>, so it can act on its USDC float but has no full-access key on the server.
        </li>
        <li>
          <strong>NEAR AI.</strong> Used only in the AI Court dispute path, not in the three payment flows.
        </li>
      </ul>
      <h4 className="font-black">Impact</h4>
      <ul className="grid list-disc gap-1 pl-5">
        <li>A person with crypto, and no local bank account, can get a Vietnamese shop QR paid or a phone topped up. A local helper advances the money and is repaid only after proof.</li>
        <li>A helper in the same city can buy a physical item for a stranger without either side trusting the other: the money moves when the buyer shows the delivery code.</li>
        <li>An AI agent can buy a token or a gift card for a user and get paid by escrow, with settlement checked by code, not by trusting the agent.</li>
        <li>Local fulfillers earn a reward; bots and agents earn the spread on online jobs.</li>
      </ul>
    </Section>
  );
}

export function Verify() {
  return (
    <Section id="verify" title="Verify it yourself">
      <p>
        Escrow contract: <Ext href={`https://nearblocks.io/address/${ESCROW}`}>{ESCROW}</Ext>. OutLayer verifier projects under the same
        account: <Code>{ESCROW}/email-verifier</Code>, <Code>{ESCROW}/cryptorefills-verifier</Code> and <Code>{ESCROW}/token-verifier</Code>. Each kind&apos;s
        verifier is readable on chain with <Code>get_kinds</Code> (view call). Orders can be read with <Code>get_order</Code>.
      </p>
      <p className="text-muted">
        Real NEAR mainnet orders, one or more per kind. Transactions are signed by the app&apos;s relayer on the users&apos; behalf (which is
        why the signer is the same account on every row).
      </p>
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[40rem] border-collapse text-left">
          <thead className="bg-soft">
            <tr>
              <th className="p-2">Kind</th>
              <th className="p-2">Order</th>
              <th className="p-2">What happened</th>
              <th className="p-2">Transactions</th>
            </tr>
          </thead>
          <tbody>
            {VERIFIED.map((row) => (
              <tr key={row.order} className="border-t border-line align-top">
                <td className="p-2 font-bold">{row.kind}</td>
                <td className="p-2"><Code>{row.order}</Code></td>
                <td className="p-2 text-muted">{row.what}</td>
                <td className="p-2">
                  <ul className="grid gap-1">
                    {row.txs.map(([label, hash]) => (
                      <li key={hash}>
                        <Ext href={tx(hash)}>{label}</Ext> <span className="text-muted">{hash.slice(0, 8)}…</span>
                      </li>
                    ))}
                  </ul>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h4 className="font-black">Red team</h4>
      <p>
        Cheating attempts run live on mainnet against the deployed contract and verifiers. All were stopped.
      </p>
      <ul className="grid gap-1">
        {attacks.map((attack) => (
          <li key={attack.title} className="rounded-xl bg-soft p-2">
            <strong>{attack.title}.</strong> <span className="text-muted">{attack.plain}</span> <Code>{attack.result}</Code>
            {attack.hash && <> <Ext href={tx(attack.hash)}>tx {attack.hash.slice(0, 8)}…</Ext></>}
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function Verifier() {
  return (
    <Section id="verifier" title="Build a verifier (add a bank, country or payment method)">
      {/* Old links used this id. */}
      <span id="custom-bank" aria-hidden />
      <p>
        <strong>The idea:</strong> each bank, country or payment method is one OutLayer verifier worker (a small WASM program that runs in a TEE).
        The core, meaning the escrow contract and the app, stays the same. A kind is the escrow rules plus its verifier project.
      </p>
      <ul className="grid list-disc gap-1 pl-5">
        <li>
          <strong>Worker input:</strong> the order id, kind, the canonical <Code>spec</Code> and its hash, the proof&apos;s SHA-256, the claim time, the two
          accounts, and a <Code>blob_url</Code> to fetch the proof file (a bank email, for example).
        </li>
        <li>
          <strong>Worker output:</strong> one JSON line with <Code>ok</Code>, the three identifiers echoed back exactly (order, proof hash, spec hash), a{" "}
          <Code>nullifier</Code> and a completion time. On failure: <Code>ok:false</Code> and a short fixed reason. No names or full account numbers, because the output goes on chain.
        </li>
        <li>
          <strong>What the escrow checks:</strong> the echoes match, the nullifier is new, the proof time is not before the claim (minus the allowed skew). Only then does it pay.
        </li>
        <li>
          <strong>Enable it with no contract upgrade:</strong> the maintainers call <Code>set_kind</Code> to point a kind at the verifier project. The built-in in-person kind needs no worker.
        </li>
        <li>
          <strong>Add a bank:</strong> for DKIM-signed bank emails this is a new profile inside <Repo path="workers/email-verifier" />, not a new worker. VPBank is the live example.
        </li>
        <li>
          <strong>Test locally:</strong> <Code>cargo test -p email-verifier</Code>; fixtures are synthetic receipts signed with a test key. Never commit a real .eml. A local run takes a job file and an .eml file.
        </li>
        <li>
          <strong>Deploy:</strong> <Code>cargo build -p email-verifier --target wasm32-wasip2 --profile contract</Code>, then maintainers deploy it under <Code>{ESCROW}</Code>, pinned by hash.
        </li>
      </ul>
      <Callout tone="warn">
        <strong>Check the WASM is reachable.</strong> After every deploy, fetch the version&apos;s FastFS URL and expect HTTP 200. On 2026-11-10 a deploy referenced a
        WASM that was never uploaded, OutLayer answered <Code>wasm_url could not be fetched</Code>, and a genuine QR payment was rejected twice.
      </Callout>
      <p>
        Contributions are welcome, and the payer-account check is a known, good first contribution. Step-by-step guide with exact functions and the VPBank source:{" "}
        <a href="/docs/build-a-verifier" className="font-bold underline">Read the full guide →</a>. See also <a href="#integrate" className="font-bold underline">Integrate or contribute</a>.
      </p>
    </Section>
  );
}

export function AiCourt() {
  return (
    <Section id="ai-court" title="AI Court" badge="Research preview">
      <Callout>
        <strong>AI never moves money by itself.</strong> Three AI jurors (NEAR AI models) can draft a recommendation. A human arbiter reads it and signs
        the decision on chain.
      </Callout>
      <h4 className="font-black">What is real today</h4>
      <ul className="grid list-disc gap-1 pl-5">
        <li>Disputes in the current app (v3) are opened on chain, and the escrow holds the order until a ruling.</li>
        <li>
          The resolve endpoint builds the jurors&apos; evidence file and returns a <strong>dry-run</strong> recommendation: a proposed verdict plus the exact{" "}
          <Code>resolve_dispute</Code> call. With <Code>ARBITER_ENABLED</Code> unset it submits nothing. The endpoint itself requires the arbiter admin token.
        </li>
        <li>
          The one real mainnet dispute, <Code>FUL-2A6D0AEE</Code>, was resolved by the human arbiter <Code>{ESCROW}</Code> by a direct on-chain ruling. No AI decided it.
        </li>
        <li>NEAR AI is used only on this dispute path, not in the payment flows. A full multi-juror panel on a real dispute has not been run.</li>
      </ul>
      <h4 className="font-black">What /court is</h4>
      <p>
        <Link href="/court" className="font-bold underline">/court</Link> is a legacy demo with sample data. It shows the juror workspace, locked criteria and
        prompt-injection fixtures (complaint text treated as untrusted). It is not connected to real disputes.
      </p>
      <p className="text-muted">Background: <a href="/docs/integrations" className="font-bold underline">Integrations</a> (NEAR AI notes).</p>
    </Section>
  );
}

export function Integrate() {
  return (
    <Section id="integrate" title="Integrate your fulfiller or contribute">
      <h4 className="font-black">List your fulfiller in the public registry</h4>
      <Steps
        items={[
          <>Add your entry (account ID, name, kinds, operator, repository URL, description, <Code>official: false</Code>) to <Repo path="fulfillers/registry.json" /> in a pull request.</>,
          <>Run <Code>npx tsx scripts/registry-message.ts YOUR_ACCOUNT</Code>, sign that exact message with NEP-413 (recipient <Code>fulfil-registry</Code>, fresh 32-byte base64 nonce), and put the key, signature, message and nonce in <Code>proof</Code>.</>,
          <>Run <Code>npx tsx scripts/validate-registry.ts --strict</Code>. The maintainers also check on chain that the key belongs to the account. The registry is for discovery; the contract decides who may claim.</>,
        ]}
      />
      <h4 className="font-black">Contribute a bank or verifier</h4>
      <Steps
        items={[
          "Open a pull request that adds the bank profile or verifier under workers/, with redacted fixtures and tests.",
          "Maintainers review the code.",
          <>Maintainers build and deploy the OutLayer project under <Code>{ESCROW}</Code>, pinned by hash.</>,
          <>The maintainers call <Code>set_kind</Code> and adds the bank&apos;s BIN to the app&apos;s bank list.</>,
        ]}
      />
      <p>
        Contributors do not deploy their own project and ask us to point a kind at it: that would mean trusting unreviewed code with escrowed money. Questions and
        approvals: <Ext href={TELEGRAM_URL}>{TELEGRAM_URL}</Ext>. <a href="/docs/build-a-verifier" className="font-bold underline">Read the full verifier guide →</a>
      </p>
    </Section>
  );
}
