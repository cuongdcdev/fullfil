# NEAR token verifier

This OutLayer WASI P2 worker verifies delivery of a NEP-141 token for the
`token_buy` escrow kind. It reads one JSON job from stdin and writes one compact
JSON result line to stdout. Ordinary verification failures return `ok:false`
and exit 0; malformed job input exits nonzero.

## Input and output

The escrow supplies `order_id`, `kind`, the canonical JSON `spec`, `spec_hash`,
`proof_sha256`, `claimed_at_ns`, `blob_url`, `fulfiller`, and `buyer`. The spec
contains `amount_out` (positive u128 base units), `receiver`, `token_contract`,
and `v:1`. The proof blob is JSON `{ "order_id": "...", "tx_hash": "..." }`.
Its bytes must hash to `proof_sha256`, and its order ID must match the job.

The result is
`{"ok":true,"order_id":"...","proof_sha256":"...","spec_hash":"...","nullifier":"...","completed_at_ns":"..."}`
on success, or the same identifiers with `ok:false`, a short fixed `reason`,
empty `nullifier`, and `completed_at_ns:"0"` on failure. This matches the
escrow's `verify::check_output` path and stays well below the on-chain result
limit for normal order IDs.

## Verification

The worker checks the exact spec hash and proof hash, requires a 32-byte
base58 transaction hash, and asks every configured RPC for `EXPERIMENTAL_tx_status` with
`sender_account_id = fulfiller` and `wait_until = FINAL`. It fetches the
transaction's inclusion block by `transaction_outcome.block_hash` from the same
RPC. Every successfully parsed answer must agree on the transaction hash,
signer, final status, inclusion block hash and timestamp, token-contract
receipt statuses and logs, transaction methods, and any supplied receipt
actions. At least two distinct HTTPS hosts must answer, including an anchor
host. URL case, path, trailing slash, and port do not create extra votes.
Transport and JSON-RPC errors are skipped; any disagreement among successful
answers fails closed. An `UNKNOWN_TRANSACTION` JSON-RPC error is also skipped:
an indexing lag can cause it while another node has the final transaction.
This permits a response when one node reports unknown, provided an anchor and
another independent host agree. It cannot establish that the reporting node
has indexed the transaction.

The signer and final status must match the job and show success. A failed
receipt executed by `token_contract` rejects the whole proof, even if another
receipt shows enough transfer. This is a deliberate fail-closed rule stricter
than idea 15's instruction to count only successful receipts. Only successful
receipt outcomes executed by `token_contract` can contribute token transfers.
The worker parses `EVENT_JSON:` logs with `standard: "nep141"`. It adds checked
u128 `ft_transfer` amounts from `fulfiller` to `receiver`, subtracts any
`ft_burn` amount owned by `receiver`, and requires net delivery to meet
`amount_out`. Burns exceeding transfers saturate net delivery to zero and
therefore fail the amount check. A reverse transfer from `receiver` to
`fulfiller` rejects the proof. `ft_mint`, other NEP-141 events, and other
standards are ignored. Unparseable event text cannot be identified as a
recognized event and is ignored. Bad data for a recognized NEP-141
`ft_transfer` or `ft_burn` rejects the proof; data for ignored events is not
validated. Other executors' logs are ignored. A transaction action
named `ft_transfer_call` rejects the proof. When the RPC includes top-level
receipt actions, `ft_on_transfer` or `ft_resolve_transfer` executed by the
token contract or receiver also rejects it. If the receipt action array is
absent, the worker relies on the transaction action check. The inclusion block
timestamp must be at or after `claimed_at_ns`. Claim and proof windows are
20 minutes each, capped by the order deadline. The reuse nullifier is lowercase hex
`sha256("near_ft:" + tx_hash)`.

The RPC agreement rule is not a cryptographic light-client proof.
The escrow currently caps token-buy order value at 5.25 USDC during its beta;
this limits the escrow payout, while the worker still validates the full u128
`amount_out` in the token's base units without assuming an exchange rate.
The verifier should receive independently operated RPC endpoints before
high-value production use. Synthetic recorded-style RPC fixtures cover a
storage deposit plus transfer and a `ft_transfer_call` refund. Each red-team
test checks its exact rejection reason, including forged logs, status failures,
timing, overflow, and RPC disagreement.

## Environment and build

`PROOF_BLOB_TOKEN` is a runtime bearer token for the blob endpoint. By
default, `blob_url` must exactly equal
`https://fulfil.junstudio.xyz/api/proof-blob/` plus the proof SHA-256.
`PROOF_BLOB_PREFIX` can override that HTTPS prefix (with a trailing slash).
`NEAR_RPC_URLS` can override the comma-separated RPC list. `NEAR_RPC_ANCHORS`
can override the comma-separated anchor hosts. Default anchors are FastNear
and the archival NEAR RPC. Defaults for queried RPCs, in order:

1. `https://free.rpc.fastnear.com`
2. `https://rpc.intea.rs`
3. `https://rpc.shitzuapes.xyz`
4. `https://archival-rpc.mainnet.near.org`

The blob response is capped at 64 KiB and each RPC response at 1 MiB. Native
and WASI requests disable redirects and use timeouts. The worker sends an
ordinary browser User-Agent for all HTTP requests. Tests use injected HTTP
responses and make no live network calls.

```bash
cargo test -p token-verifier
cargo build --release --target wasm32-wasip2 -p token-verifier
```
