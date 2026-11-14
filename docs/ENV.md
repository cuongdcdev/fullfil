# Environment

Copy `.env.example` to `.env` in the MVP root when configuring integrations. No variable is required for the local demo. Empty strings use the defaults below. Never commit `.env`, upload it with a proof bundle, or expose secrets through `NEXT_PUBLIC_` variables.

| Variable                      | Purpose and default                                                                                               |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                | SQLite location, default `file:./data/dev.db`.                                                                    |
| `DEMO_TIME_SCALE`             | Seconds per simulated hour, default `10`. Mock demo clock controls remain separate from real integration policy.  |
| `NEAR_NETWORK`                | `testnet` by default.                                                                                             |
| `NEAR_RPC_URL`                | v3 NEAR RPC, default `https://rpc.mainnet.fastnear.com`; also overrides legacy network RPC.                       |
| `NEAR_FULFIL_CONTRACT`        | Deployed Fulfil contract account.                                                                                 |
| `NEAR_COURT_CONTRACT`         | Deployed Court contract account.                                                                                  |
| `NEAR_SERVICE_ACCOUNT_ID`     | Backend transaction signer.                                                                                       |
| `NEAR_SERVICE_PRIVATE_KEY`    | Backend private key; server only.                                                                                 |
| `AGENT_BUYER_ACCOUNT_ID`      | Buyer's NEAR account for a configured real MCP agent.                                                             |
| `AGENT_BUYER_PRIVATE_KEY`     | Buyer function-call access key; server only. Restrict receiver and method names.                                  |
| `ALLOW_MAINNET_WRITES`        | Default false; only the exact string `true` permits an explicitly configured mainnet write.                       |
| `INTENTS_1CLICK_BASE_URL`     | Default `https://1click.chaindefuser.com`; setting a URL alone is not evidence of escrow funding.                 |
| `INTENTS_1CLICK_JWT`          | Optional partner JWT; server only.                                                                                |
| `INTENTS_VERIFIER_CONTRACT`   | Default `intents.near`. Actual asset/network mapping must be checked before live use.                             |
| `NEAR_AI_API_KEY`             | Enables configured NEAR AI inference adapters; server only.                                                       |
| `NEAR_AI_BASE_URL`            | Default `https://cloud-api.near.ai/v1`.                                                                           |
| `NEAR_AI_TEXT_MODEL`          | Canonical confidential model identifier; defaults are documented on `/status`.                                    |
| `NEAR_AI_VISION_MODEL`        | Canonical confidential image-input model identifier. Never substitute a non-TEE provider for private evidence.    |
| `COURT_JUROR_MODELS`          | Comma-separated confidential NEAR AI model identifiers. Default uses the text model with distinct juror contexts. |
| `SAGE_VIA`                    | `near-ai` by default; direct `levanto` fallback is reserved and not implemented.                                  |
| `SAGE_API_KEY`                | Reserved for direct Levanto; server only.                                                                         |
| `SAGE_BASE_URL`               | Default `https://private.sage.levanto.ai`.                                                                        |
| `SAGE_CONFIDENCE_THRESHOLD`   | Default `0.9`; injection or missing required proof still prevents automatic Sage settlement.                      |
| `OUTLAYER_API_URL`            | Default `https://api.outlayer.ai`.                                                                                |
| `FULFIL_MODE`                 | v3 backend mode: `mock` or `live`; defaults to mock when `OUTLAYER_API_KEY` is unset.                             |
| `SESSION_SECRET`              | HMAC secret for v3 wallet session cookies; required in live mode. Mock uses a random process secret if unset.     |
| `ESCROW_CONTRACT`             | v3 escrow account, default `nearfullfil.near`.                                                                    |
| `INTENTS_CONTRACT`            | v3 verifier account, default `intents.near`.                                                                      |
| `OUTLAYER_API_KEY`            | Bearer key for the OutLayer Agent Custody relayer; server only.                                                   |
| `OUTLAYER_WALLET_ID`          | Optional relayer wallet ID sent as `X-Wallet-Id` to OutLayer.                                                     |
| `ONECLICK_API_KEY`            | Optional 1Click partner Bearer token for v3 quotes; server only.                                                  |
| `PROOF_BLOB_TOKEN`            | Bearer token allowing the OutLayer worker to fetch uploaded `.eml` bytes; server only.                            |
| `ARBITER_ADMIN_TOKEN`         | Bearer token protecting v3 dispute resolution; server only.                                                       |
| `ARBITER_ENABLED`             | Set to `1` to submit v3 dispute verdicts in live mode; otherwise dry run.                                         |
| `PUBLIC_BASE_URL`             | Public app origin for wallet login recipient and worker blob URL; default `http://localhost:3000`.                |
| `OUTLAYER_PROJECT`            | Deployed verifier project in `owner/project` format.                                                              |
| `OUTLAYER_PAYMENT_KEY`        | OutLayer payment credential; server only.                                                                         |
| `AGENT_MARKET_BASE_URL`       | Optional provider marketplace endpoint; does not register an agent.                                               |
| `AGENT_MARKET_TOKEN`          | Optional marketplace credential; server only.                                                                     |
| `AGENT_MARKET_WEBHOOK_SECRET` | Optional webhook HMAC secret; server only.                                                                        |

`/status` is the runtime source for each adapter's selected mode and missing configuration. Mode selection does not establish that an external service has passed a live integration test. Real integration errors must remain visible; they must never be converted into a successful mock result.

Additional local tooling variables:

| Variable                 | Default and purpose                                              |
| ------------------------ | ---------------------------------------------------------------- |
| `FULFIL_API_URL`         | MCP and terminal demo API base; `http://localhost:3000/api`.     |
| `FULFIL_MCP_URL`         | Terminal demo MCP endpoint; `http://localhost:3001/mcp`.         |
| `MCP_PORT`               | Streamable HTTP MCP port; `3001`.                                |
| `MCP_TRANSPORT`          | `stdio` for a spawned client process; otherwise HTTP.            |
| `NEAR_WORKER_ACCOUNT_ID` | Account registered by deploy script; service account by default. |

## Configuring NEAR AI

Set `NEAR_AI_API_KEY` and restart the development server. Other adapters can remain mock. A model response and a verified TEE proof are separate outcomes: the application must display incomplete verification and refuse proof-dependent payouts when required checks fail.

The live catalog contains providers with different confidentiality guarantees. Use confidential model-serving TEEs, not gateway-only privacy. See [integration verification notes](INTEGRATIONS.md).

This build deliberately limits inference to Flash and Sage under the owner's testing budget. Other model IDs are rejected before private data is sent. Direct Levanto fallback is not wired; `SAGE_VIA=levanto` is reserved for follow-up integration.

## Agent signing scope

A function-call key is restricted to one receiver contract and an explicit method allowlist. It cannot transfer arbitrary assets, delete the account, or call other contracts. An attacker with that key can still abuse the methods and allowance it permits. Funding methods requiring an attached deposit cannot be called by a restricted function-call key; prefund through an owner-controlled path and expose limited buyer operations against an existing balance.
