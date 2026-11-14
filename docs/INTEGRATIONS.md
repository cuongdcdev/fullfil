# Integrations

What Fulfil connects to, what each connection does, and what has been checked live. "Live" means exercised on NEAR mainnet with real USDC; the transaction hashes are listed under [Verify it yourself](https://fulfil.junstudio.xyz/docs#verify). Items with no live check say so.

## NEAR Intents and 1Click

- **Role.** `intents.near` holds the NEP-245 USDC balances. The escrow contract receives funding through `mt_on_transfer` and acts for users through `auth_call` / `on_auth`, so buyers and fulfillers sign NEP-413 intents and need no NEAR for gas. Payouts leave the escrow back into `intents.near` balances.
- **1Click** (`https://1click.chaindefuser.com`, `INTENTS_1CLICK_BASE_URL`): quotes for adding money from other tokens and chains, for withdrawing USDC (to Solana), and for the shopper bot paying Cryptorefills from an Intents balance.
- **Checked live.** A full order funded and paid through the escrow on mainnet for each kind. The shopper bot paid a real Cryptorefills order from an `intents.near` balance through a 1Click quote (about 30 s, surplus refunded). Add-money from any 1Click token is implemented; one small real deposit from a non-NEAR chain is still to be run.
- **Limits.** Memo-only chains (for example Stellar) are skipped. A configured URL alone is not evidence that an order was funded: the escrow state is the source of truth.

## NEAR OutLayer

- **TEE verifiers.** The projects `nearfullfil.near/email-verifier`, `cryptorefills-verifier` and `token-verifier` are WASI P2 workers. The escrow calls them with `request_execution` and receives the result in `on_verify_result`. Secrets (for example the proof-blob bearer token) reach a worker through `secrets_ref`.
- **Agent Custody wallet.** The relayer that submits transactions on behalf of users who sign intents. It needs a wallet policy that allows `call` to `intents.near`.
- **Checked live.** Each worker verified a real mainnet proof: a VPBank receipt email, a Cryptorefills top-up and a memecoin delivery (about 11.7 s for the memecoin run). Each verifier is reachable only if its WASM is uploaded: after every deploy, fetch the version's FastFS URL and expect HTTP 200.

## Cryptorefills

- **Role.** Gift cards, phone top-ups and eSIMs. The shopper bot creates the order and pays it; `cryptorefills-verifier` reads the order status.
- **Interface.** The MCP endpoint `https://api.cryptorefills.com/mcp/http` (no login or key). The x402 host was not usable from our IP, so Fulfil does not use it.
- **Checked live.** A 20,000 VND Viettel top-up was bought with funds held only in `intents.near`, and the verifier accepted it and rejected a wrong phone number. Cryptorefills enforces a network minimum of about 0.56 USDC per order.

## Intear router and token list

- **Role.** `token_buy`: the app searches NEP-141 tokens from the Intear token list, and the agent skill buys the token through the Intear router (`https://router.intear.tech`) with an exact-output quote.
- **Checked live.** Two mainnet `token_buy` orders were bought through the router (IntearDex), delivered and paid on the first attempt.

## NEAR RPC

Backend and verifiers use several RPC providers (default `https://rpc.mainnet.fastnear.com`, `NEAR_RPC_URL`). `token-verifier` requires every answering RPC to agree, including anchor RPCs, and fails closed otherwise.

## HOT near-connect

Wallet sign-in in the browser uses `@hot-labs/near-connect`. The app asks the wallet to sign a NEP-413 message for login and for each intent; the backend verifies that the key is registered on `intents.near`. Wallet support follows what the connector lists; not every wallet has been tried.

## NEAR AI Cloud

- **Role.** The three jurors of the AI Court, on the dispute path only. Jurors draft a recommendation; a human arbiter signs the decision on chain. On mainnet the endpoint runs as a dry run.
- **Interface.** `https://cloud-api.near.ai/v1`, with the model identifiers set in `NEAR_AI_TEXT_MODEL` and `COURT_JUROR_MODELS` (see [environment variables](ENV.md)). Use confidential model-serving TEEs, not gateway-only privacy: the [live model catalog](https://cloud-api.near.ai/v1/model/list) exposes `metadata.providerType`, `metadata.verifiable` and `metadata.attestationSupported`, and a model name alone does not prove confidentiality.
- **Verification evidence.** The [official OpenAPI](https://docs.near.ai/api-reference/openapi.json) documents `GET /v1/attestation/report` and `GET /v1/signature/{chat_id}`. Follow the [response signature policy](https://docs.near.ai/cloud/verification/cloud-api/response-signatures.md): retain exact request and response bytes and distinguish `provider_tee` from `gateway` signatures. A `200` signature response containing `error_code` is unavailable evidence, not a successful verification.
- **Checked live.** One juror call and a retained model bundle (signature, nonce and signer binding, Intel quote chain, event log and NVIDIA verdict) were checked on fictional fixtures. A full three-juror panel on a real dispute has not been run.

## Not integrated

Agent Market provider delivery is not wired; `/status` does not list it as operational.
