# Fulfil escrow (W11 step A)

The escrow holds NEP-245 balances inside `intents.near`. Buyers fund orders with
a signed `transfer` intent. Fulfillers act through `auth_call`. Digital kinds
use an OutLayer worker. The `in_person` kind checks a delivery code on-chain
and pays the claimer without a worker.

The live W10 predecessor for this step is commit `e64c5f5`.

## Calling table

| Entry | Caller | JSON arguments or `msg` |
|---|---|---|
| `mt_on_transfer` | `intents.near` | `{"op":"fund","order":{"id":"FUL-0001","kind":"bank_transfer","spec_hash":"<lowercase sha256 hex>","pay_amount":"2000000","reward":"100000","deadline_ns":"<nanoseconds>","quoted_by":"bot.near"}}`; omit `quoted_by` when absent. The transfer amount must equal pay amount plus reward. `{"op":"bond"}` deposits a bond. |
| `mt_on_transfer` (`in_person`) | `intents.near` | `{"op":"fund","order":{"id":"FUL-0002","kind":"in_person","spec_hash":"<lowercase sha256 hex>","pay_amount":"1000000","reward":"50000","deadline_ns":"<nanoseconds>"},"spec":"<canonical JSON string>"}`. `spec` is a top-level field, absent for other kinds. |
| `on_auth` | `intents.near` | `{"op":"register_fulfiller"}` (optional `bank_bin` and `account_last4`), `{"op":"claim","order_id":"FUL-0001"}`, `{"op":"release_claim","order_id":"FUL-0001"}`, `{"op":"sent","order_id":"FUL-0001"}`, `{"op":"submit_proof","order_id":"FUL-0001","proof_sha256":"<hex64>","spec":"<canonical JSON string>"}`, plus `cancel`, `dispute`, `rate`, and `withdraw_bond`. |
| `on_auth` (`in_person`) | `intents.near` | `{"op":"confirm_delivery","order_id":"FUL-0002","secret_hex":"<64 lowercase hex characters>"}`. A bad code commits one attempt and returns normally; read the order after signing. |
| `confirm_delivery` | Current claimer (direct call) | `{"order_id":"FUL-0002","secret_hex":"<64 lowercase hex characters>"}`; returns `true` after payout or `false` for a bad code. |
| `submit_proof` | configured relayer | `{"order_id":"FUL-0001","proof_sha256":"<hex64>","spec":"<canonical JSON string>"}`. |
| `set_kind` / `remove_kind` | owner, 1 yocto | `{"kind":"cryptorefills_topup","config":{...}}` / `{"kind":"cryptorefills_topup"}`. A kind with stored orders cannot be removed. |
| `update_config` | owner, 1 yocto | `{"config":{...}}`; updates the global fields while preserving the existing kind map. Use `set_kind` or `remove_kind` to change kinds. |
| `get_kinds` | view | `{}`; returns a JSON object keyed by kind. |
| `list_orders` | view | `{"status":"funded","kind":"cryptorefills_topup","from":0,"limit":50}`; every filter is optional. |
| `migrate` | owner, after deploying W9 code | `{}`; converts up to 20 old orders. No deposit. |
| `migrate_batch` | owner, 1 yocto | `{"limit":20}`; repeat while the result (remaining orders) is positive. |

`KindConfig` uses these JSON fields: `enabled`, `verifier_source` (JSON object
encoded as a string, as before), `secrets_ref` (`null` or
`{"profile":"default","account_id":"nearfullfil.near"}`), `access`,
`needs_sent`, `claim_timeout_ns`, `proof_timeout_ns`, `max_deadline_ns`,
`quote_exclusive_ns`, `open_max_active_claims`, and `open_max_order_value`.
The final three default to 2 minutes, 1, and 20,000,000 base units respectively.
`access` is `"open"`, `"approved"`, `{"allowlist":["bot.near"]}`, or
`{"min_bond":"20000000"}`. A level-0 fulfiller is one whose existing stats
do not meet level 1: fewer than five completed jobs, or any lost dispute.
For open kinds, the configured active-claim and order-value limits apply to
level 0. Bank transfer stays `approved` after migration. Disabling a kind blocks
new funding while existing orders can still be claimed and completed. A new
kind with `needs_sent: true` requires an explicit `sent` call before proof;
`needs_sent: false` enters verification directly without an `order_sent` event.
Bank transfer retains its historical implicit-sent proof path.

### In-person kind and W9 upgrade

`in_person` is seeded by `new` and by the c0740f2 migration. After a code-only
upgrade from live W9 state, the owner registers it with the existing `set_kind`
entry (1 yocto) using this exact JSON. **Do not call `migrate` on W9 state.**

```json
{"kind":"in_person","config":{"enabled":true,"verifier_source":"{}","secrets_ref":null,"access":"open","needs_sent":false,"claim_timeout_ns":"86400000000000","proof_timeout_ns":"86400000000000","max_deadline_ns":"86400000000000","quote_exclusive_ns":"120000000000","open_max_active_claims":1,"open_max_order_value":"20000000"}}
```

The root, config, kind config, and order Borsh layouts remain unchanged.
Funding carries the canonical spec string
`{"area":"...","delivery_hash":"<hex64>","item_desc":"...","price":"1000000","v":1}`.
The contract parses five required fields, requires a lowercase delivery hash,
checks decimal `price == pay_amount`, checks total value from 1 to 20 USDC,
and recomputes `spec_hash` over the supplied bytes. The shared core builder
and backend enforce sorted-key canonical JSON and text bounds. The contract
accepts other valid JSON key orders with a matching `spec_hash`; the stored
delivery hash remains bound to that funded spec. It is stored under a raw key
derived from the order id and removed when the order is pruned.

Only the current claimer may confirm, while the order is `Claimed` and before
both claim timeout and deadline. The 24-hour kind timeout makes the order
deadline the effective end of claiming and confirmation, including for shorter
orders. The code must be **exactly 64 lowercase hex
characters** (32 bytes). Wrong, short, and uppercase codes each consume one
of the order-wide six attempts and leave the order `Claimed`, so deadline
expiry can refund the buyer. The nullifier is
`sha256("in_person:" + order_id)` and is permanent after success.
`submit_proof` cannot be used for this kind.

### Token buy kind and W10 upgrade

`token_buy` is seeded by `new` and by the legacy c0740f2 migration. On the
live W10 state, kinds already live in persisted config, so a code-only upgrade
does **not** call `migrate`; the owner registers the new kind through the
existing 1-yocto `set_kind` entry after deploying code. Use this exact JSON:

```json
{"kind":"token_buy","config":{"enabled":true,"verifier_source":"{\"Project\":{\"project_id\":\"nearfullfil.near/token-verifier\",\"version_key\":null}}","secrets_ref":{"profile":"default","account_id":"nearfullfil.near"},"access":"open","needs_sent":false,"claim_timeout_ns":"1200000000000","proof_timeout_ns":"1200000000000","max_deadline_ns":"86400000000000","quote_exclusive_ns":"120000000000","open_max_active_claims":1,"open_max_order_value":"5250000"}}
```

If `token_buy` is already registered, deploying code alone does not change its
stored cap. The owner must call `set_kind` with the config above to activate
the beta cap on that state.

The spec is canonical JSON
`{"amount_out":"<positive u128 token base units>","receiver":"<NEAR account>","token_contract":"<NEP-141 account>","v":1}`.
The buyer funds at least 1 USDC of `pay_amount` with the configured bond token
(USDC on mainnet); the reward is additional. The beta cap is 5.25 USDC order
value (`pay_amount + reward`), allowing a 5 USDC spend plus a 0.25 USDC reward.
It is enforced at funding and claim for all claimers, regardless of level.
The owner can raise it with `set_kind` without a code upgrade.
The kind is open, permits only one active claim per fulfiller while a token-buy
claim is held, and requires no bond even if global bond settings are nonzero.
The active token-buy claim marker uses a raw storage key and is cleared on
release, timeout, or settlement without changing any Borsh layout.
The claim and proof timeouts are 20 minutes each, capped by the order
deadline. The backend's default order deadline is one hour; the contract caps
it at 24 hours. Configure the OutLayer project
`nearfullfil.near/token-verifier` with a `PROOF_BLOB_TOKEN` secret whose access
whitelist contains both `nearfullfil.near` and the relayer account. OutLayer
checks the transaction signer for secret access.

After the fulfiller sends a plain NEP-141 `ft_transfer` in a separate NEAR
transaction, it submits the proof blob hash and exact spec through the
ordinary `submit_proof` path. OutLayer `token-verifier` checks agreement among
all answered RPCs, including an anchor, the current fulfiller, the token
contract, net delivered amount, absence of a transfer-call path, and the
inclusion block time. `on_verify_result` uses
the existing nullifier and payout logic. The stored Borsh layouts do not
change, and the supplied W10 wasm upgrade test checks in-flight orders.

Worker input is exactly
`{"order_id","kind","spec","spec_hash","proof_sha256","claimed_at_ns","fulfiller","buyer","blob_url"}`.
The worker returns
`{"ok":true,"order_id":"...","proof_sha256":"<hex64>","spec_hash":"<hex64>","nullifier":"<hex64>","completed_at_ns":"<nanoseconds>"}`;
`reason` is optional. `blob_url` is the configured proof blob base URL plus
the proof hash. `claim_released` uses the same `fulfil`/`1.0.0` NEP-297 event
envelope as the other events.

Each order exposes `verify_seq` and `total_proof_attempts`. Every accepted
`submit_proof` increments both. The private callback is
`on_verify_result(order_id, attempt, verify_seq, expected_fulfiller,
expected_proof_sha256)`. It checks all five values against the current
`Verifying` order before reading the OutLayer result. A late callback logs
`stale verify result ignored` and returns without changing the current claim,
attempt count, nullifiers or payout. A release or new claim does not reset
`verify_seq` or the order-wide proof budget.

Each claim allows at most 3 proof submissions, and each order allows at most 6
in total. Every accepted submission consumes one of the 6, even when OutLayer
fails or its callback later becomes stale. A rejected precondition does not
consume an attempt or schedule an OutLayer call. At 6, `submit_proof` fails
with `proof budget used` before paying a verification fee. The fulfiller may
release a `ProofRejected` claim so the buyer can cancel or later expire the
funded order; otherwise the existing timeout and arbiter paths handle review
and refund. The budget starts at zero when a c0740f2 order is migrated.

## Build and tests

From `contracts/escrow`:

```bash
cargo near build non-reproducible-wasm --profile contract --no-embed-abi
```

| Artifact | Bytes | SHA-256 |
|---|---:|---|
| c0740f2 predecessor (`tests/res/escrow-c0740f2.wasm`) | 333763 | `d57db193aae677cdbf0b8d0f3ad0892f9a8811f3e4a56f5a8f007a9c9f92ae59` |
| W9 predecessor (`tests/res/escrow-w9-ca2fff3c.wasm`) | 360875 | `ca2fff3c36b58b188b8aef8507d556fdd150ac2167286b6f5f184992d75368dd` |
| Live W10 in-person release (`tests/res/escrow-w10-9052688c.wasm`) | 370151 | `9052688c96451e8077e4098d7f61f2c9d15a197b55f4e7f7523e6741cc785d23` |
| Token-buy step A (`target/near/fulfil_escrow/fulfil_escrow.wasm`) | 371215 | `6d6b891b7c40cbf44e778dac05bc82753f86c0e3124bf4d7fc22e418c852e2b2` |

The release must stay below the 380000-byte cap. The predecessor build
matches the earlier v2 hash exactly. Rebuild after any source change and update
the size and hash here before deploying.

```bash
cargo test -p fulfil-escrow --lib  # 199 passed
export NEAR_SANDBOX_BIN_PATH=/tmp/claude-0/w1/sandbox-bin/near-sandbox-wrapper
cargo test -p fulfil-escrow --test sandbox -- --ignored --test-threads=1  # 8 tests; requires sandbox sockets
```

The ignored sandbox tests use the already prepared `tests/res/defuse.wasm`,
`fungible-token.wasm`, and live W10 escrow wasm; they also need the W9 escrow
and mock OutLayer wasm built
with the command above. The full `tests/build-test-deps.sh` rebuilds all test
dependencies and fetches `near/intents`, so use it only when those artifacts
need refreshing. The new upgrade test deploys the exact c0740f2 wasm, creates
a paid and rated order, a bond and a nullifier, deploys W9, calls `migrate`,
checks old state, then pays out a `cryptorefills_topup` order. The older
v1-to-v2 code-only upgrade test was removed because W9 changes the root state
layout and requires `migrate`; rating-weight preservation is covered by the
c0740f2-to-W9 test.

## Historical c0740f2-to-W9 upgrade procedure (PM only)

The following commands record the earlier W9 migration, **not** the W10-to-W11
upgrade. For W10-to-W11, deploy code, do not call `new` or `migrate`, then use
the `token_buy` `set_kind` call above. These commands are an operator procedure,
**not** run by tests or agents. Build and check the exact local artifact first.

```bash
cd contracts/escrow
cargo near build non-reproducible-wasm --profile contract --no-embed-abi
sha256sum ../../target/near/fulfil_escrow/fulfil_escrow.wasm
wc -c ../../target/near/fulfil_escrow/fulfil_escrow.wasm
near contract deploy nearfullfil.near use-file ../../target/near/fulfil_escrow/fulfil_escrow.wasm without-init-call network-config mainnet sign-with-keychain send
near contract call-function as-transaction nearfullfil.near migrate json-args '{}' prepaid-gas '300.0 Tgas' attached-deposit '0 NEAR' sign-as nearfullfil.near network-config mainnet sign-with-keychain send
near contract call-function as-read-only nearfullfil.near get_counts json-args '{}' network-config mainnet now
near contract call-function as-read-only nearfullfil.near get_kinds json-args '{}' network-config mainnet now
near contract call-function as-read-only nearfullfil.near get_order json-args '{"id":"FUL-892B4EF7"}' network-config mainnet now
```

If there were more than 20 stored orders at upgrade time, call
`migrate_batch` until it returns `0`. Ordinary order actions are held while
conversion is incomplete. A second `migrate` call fails with `already migrated`.
The first `migrate` call copies every stored order id into `migration_pending`
before converting its first batch. That is acceptable for the current mainnet
state (about 1–2 orders); this migration is not designed for a large order
book even though subsequent order rewriting is batched.

```bash
near contract call-function as-transaction nearfullfil.near migrate_batch json-args '{"limit":20}' prepaid-gas '300.0 Tgas' attached-deposit '1 yoctoNEAR' sign-as nearfullfil.near network-config mainnet sign-with-keychain send
```
