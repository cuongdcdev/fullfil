# Fulfil demo guide (for judges)

Fulfil lets you spend crypto in the real world. A fulfiller (a local helper, a bot or an AI agent) does the real-world part. A NEAR escrow holds your money and pays out only after a verifier checks the proof.

There are two ways to see it:

1. **The guided demo** at `/demo`: an animated walkthrough of each kind of order, from both sides. Nothing in it is real: no wallet, no money. Start here (about 2 minutes).
2. **The real thing on NEAR mainnet**, on the public site <https://fulfil.junstudio.xyz>: real USDC, real verifiers. See [Try the real flows](#try-the-real-flows).

## The guided demo (`/demo`)

Open `/demo` on the public site or locally. Pick a story with the tabs at the top. You see two phone screens (the buyer on the left, the other side on the right) and, between them, the **NEAR escrow** status (empty, locked, paid out or refunded) and, when it applies, the **verifier** panel with the checks it runs.

**How to walk through it**

- **Next / Back** step through the story, or click the progress bar to jump to a step. The arrow keys work too.
- **Auto-play** advances a step every 3 seconds.
- Each step has a title, a plain-language caption and a **Why it's safe** line.
- Under the steps, **If something goes wrong** says what happens when the job fails: the money goes back to the buyer.
- On a phone-sized screen only one phone shows at a time; the switch above it follows the action.
- On the last step the button becomes the story's call to action and opens the real app page.

### The four stories

| Story | Who does the job | What you see | Verified by | Call to action |
| --- | --- | --- | --- | --- |
| **Buy anything nearby** | A local helper | Describe an item, pay into escrow, the helper accepts and brings it, you show a QR receipt, escrow pays the helper. No accepting helper means a refund at the deadline. | The escrow contract itself: the QR secret must match the stored hash, and it works once | "Buy something nearby" opens `/shop/in-person` |
| **Buy online** | The shopper bot | Pick a Cryptorefills product (gift card, top-up, eSIM), see the price, pay, the bot claims and buys it, the verifier checks the delivery, escrow pays the bot. | An OutLayer TEE verifier: the order exists at Cryptorefills, is delivered to your phone number, right product and amount | "Browse the shop" opens `/shop` |
| **Buy a memecoin** | An AI agent | Search a NEAR token, choose the USDC to spend, pay, the agent buys the token with its own funds and sends it, the verifier reads the chain, escrow pays the agent. | An OutLayer TEE verifier: the transfer is found on several nodes, token and receiver match, amount is at or above the minimum, the proof was never used before | "Buy any token" opens `/shop/token` |
| **Pay a QR** (beta) | A local helper | Scan a shop's VietQR, add a reward, pay, the helper pays the shop from their bank, shows the bank's receipt email, the verifier checks it, escrow pays the helper. | An OutLayer TEE verifier: the bank's signature on the email is valid, amount, recipient and order code in the note all match | "Pay a QR" opens `/pay` |

Every story ends the same way: valid proof, the fulfiller is paid; no valid proof, the buyer is refunded.

## Try the real flows

Sign in with a NEAR wallet on <https://fulfil.junstudio.xyz> and add a few USDC (any of 200+ tokens works as a source). Then:

1. **Buy a memecoin** (`/shop/token`): the fastest one to watch. An AI agent runs the order; see [Plug in your AI agent](https://fulfil.junstudio.xyz/docs#agents) to run the agent yourself. Our test run, from claim to payout, took under three minutes.
2. **Buy anything nearby** (`/shop/in-person`): you need a second account to play the helper (`/earn`).
3. **Buy online** (`/shop`): a Cryptorefills top-up or gift card, bought by the shopper bot ([Run a shopper bot](https://fulfil.junstudio.xyz/docs#shopper-bot)).
4. **Pay a QR** (`/pay`): Vietnam only, VPBank only; the fulfiller must be approved ([Become a Local QR fulfiller](https://fulfil.junstudio.xyz/docs#qr-fulfiller)).

Already-completed mainnet orders, with transaction hashes you can open on NearBlocks, are listed under [Verify it yourself](https://fulfil.junstudio.xyz/docs#verify). `/status` shows which integrations are live.

## Run it locally (mock mode)

Mock mode uses fictional balances and fake transaction ids. No wallet, keys or network calls are needed.

```bash
pnpm install
pnpm --filter web dev            # http://localhost:3000, open /demo
```

To look at the app with believable data (orders in every state, fulfillers, an agent), seed a database and point the app at it:

```bash
FULFIL_MODE=mock pnpm exec tsx scripts/demo/seed-demo.ts /tmp/fulfil-demo.db
DATABASE_URL=file:/tmp/fulfil-demo.db FULFIL_MODE=mock pnpm --filter web dev
```

The seed script refuses to run outside mock mode and refuses to overwrite the main checkout's `data/` folder. It prints the seeded accounts: buyers `mai.demo.near` and `tom.demo.near`, fulfillers `linh.demo.near` and `minh.demo.near`, the token agent `hermes.demo.near` and a new fulfiller `dao.demo.near`. In mock mode the backend accepts a demo login for these accounts (`POST /api/v3/auth/dev-login` with `{"account_id":"mai.demo.near","standard":"nep413"}`); the login page has no button for it yet.

## What is real and what is mocked

| Part | `/demo` guided demo | Local mock mode | Public site (mainnet) |
| --- | --- | --- | --- |
| Screens and order flow | Scripted animation | Real app code | Real app code |
| Escrow and money | Illustrative | Simulated ledger, fictional USDC | Real contract `nearfullfil.near`, real USDC through NEAR Intents |
| Verifiers | Illustrative | Mocked and labelled | Real OutLayer TEE workers |
| AI Court | Not shown | Mocked unless a NEAR AI key is set | Dry run: jurors draft, a human arbiter signs |

Developer pages such as `/status` and `/court` show technical detail; `/court` is a preview with sample data and is not connected to real disputes.
