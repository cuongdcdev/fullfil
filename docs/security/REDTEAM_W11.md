# W11 re-check and new findings — token-verifier, in_person, escrow state edges

Scope: current HEAD (`35c750b`), files `contracts/escrow/src/{lib,types,verify}.rs`, `workers/{token,email,cryptorefills}-verifier/src/*`, `apps/web/lib/server/v3/{token-buy,in-person,intents}.ts` where the on-chain/spec boundary needs it. The line numbers in the W9 review point at commit `5fabc8c` and are stale against this HEAD; every row below was re-opened and re-cited at current lines. The guard is judged against the attack named in the row, not against adjacent new attacks (those are in New findings).

## Re-check

| id | verdict | note |
|---|---|---|
| R-01 | CONFIRMED | `mt_on_transfer`/`on_auth` both require intents as predecessor (`lib.rs:1011,1057,1782-1787`). No third-party path. |
| R-02 | CONFIRMED | exact `value == amount` at `lib.rs:2036-2041`; intents rolls back the receiver call on panic. |
| R-03 | CONFIRMED | token allowlist `lib.rs:2018-2024`, bond token `lib.rs:1029`; in_person/token_buy also forced to bond token `2022-2026`. |
| R-04 | CONFIRMED | exactly one token id and `previous_owner == sender` `lib.rs:1013-1020`. |
| R-09 | CONFIRMED | escrow recomputes `sha256(spec)` at `lib.rs:2428-2431`; workers recompute at `token-verifier/src/lib.rs:222-224`, `cryptorefills-verifier/src/lib.rs:197-199`, `email-verifier/src/lib.rs:82-84`. |
| R-10 | CONFIRMED | cancel requires `Funded` only, `lib.rs:2528-2531`; Verifying/Verified/Paid excluded. |
| R-11 | CONFIRMED | cancel/expire set terminal state and `drop_order` before `send` (`lib.rs:2527-2538,1182-1200,1821-1833`); second call is `order not found`. |
| R-15 | CONFIRMED | approved access check `lib.rs:2255-2258` at claim and at quote-pin. |
| R-16 | CONFIRMED | allowlist check `lib.rs:2260-2262`. |
| R-22 | CONFIRMED | `total_proof_attempts` is order-wide and survives release (`lib.rs:2413-2417,2456-2457,2291`); 6 attempts max. |
| R-23 | CONFIRMED | release states are Claimed/Sent/ProofRejected only (`lib.rs:2276-2282`); Verifying and Paid excluded. |
| R-28 | CONFIRMED | fetched bytes re-hashed at `token-verifier/src/lib.rs:611-613`, `cryptorefills-verifier/src/lib.rs:588-590`, `email-verifier/src/lib.rs:213-215`. The email CLI `--skip-sha` is debug-only; the production path passes `false` (`email-verifier/src/main.rs:211-214`). |
| R-30 | CONFIRMED | age check `cryptorefills-verifier/src/lib.rs:544-550`; global nullifier `lib.rs:1126-1133`. |
| R-31 | CONFIRMED | brand/country/delivery/denomination/product equality and salted beneficiary `cryptorefills-verifier/src/lib.rs:500-543`. |
| R-32 | CONFIRMED | exact `Done` and exactly one `Succeeded` delivery `cryptorefills-verifier/src/lib.rs:485-498`. |
| R-33 | CONFIRMED | namespaces are disjoint: `near_ft:` (`token-verifier:79`), `cryptorefills:` (`cryptorefills-verifier:72`), `bank_transfer:` (`email-verifier:268-274`), `in_person:` (`lib.rs:2360`); echo checks at `verify.rs:74-100` and `lib.rs:1126-1133`. |
| R-37 | CONFIRMED | `on_verify_result`, `on_sent`, `on_sweep_balance` are `#[private]` (`lib.rs:1095,1157,1539`); predecessor must be the escrow itself. |
| R-38 | CONFIRMED | callback requires current `Verifying` + attempt + verify_seq + fulfiller + proof hash (`lib.rs:1104-1119`); otherwise logs and returns. |
| R-39 | CONFIRMED | `check_output` rejects `ok=false`, missing/mismatched echoes, bad nullifier and completion before `claimed_at - skew` (`verify.rs:74-100`). |
| R-41 | CONFIRMED | fixed output fields only (`cryptorefills-verifier/src/lib.rs:65-82`); test asserts token/PIN/code/voucher URLs absent. |
| R-44 | CONFIRMED | delimited order-id token match (`email-verifier/src/lib.rs:287-363`). Digit/`-`/`_` extension of a matched id is rejected. (An invisible-character variant is a separate low issue; see Speculative.) |
| R-45 | CONFIRMED | amount and merchant checks `email-verifier/src/lib.rs:247-252`. A zero `spec.amount` is a separate spec-sanity gap, N-07. |
| R-46 | CONFIRMED | DKIM domain allowlist and `From`-domain check `email-verifier/src/dkim.rs:297-324`; age and repeated tx code `email-verifier/src/lib.rs:254-255,268-274`. DNS-key substitution is N-06. |
| R-48 | CONFIRMED | state and `owed` bookkeeping happen before the transfer (`lib.rs:1157-1174,1934-1956`); retry removes `owed` before sending (`1336-1343`); no double send observed. |
| R-49 | CONFIRMED | sweep is owner+1 yocto and is capped by `balance - liabilities` (`lib.rs:1524-1558,1803-1813`); every `send` has a matching liability. |
| R-50 | CONFIRMED | owner/arbiter checks at `lib.rs:1408-1411,1503-1510,1580-1596,1794-1801`; owner methods also assert 1 yocto. |
| R-52 | CONFIRMED | migrate marker, owner check and `assert_migrated` gate (`lib.rs:858-868,938-947,966-968`); `convert_orders` key construction matches near-sdk `IterableMap` (`prefix+b"m"` then `sha256(prefix+b"m"+borsh(id))`). |

CONFIRMED (no note): R-01, R-02, R-03, R-04, R-09, R-10, R-11, R-15, R-16, R-22, R-23, R-28, R-30, R-31, R-32, R-33, R-37, R-38, R-39, R-41, R-44, R-45, R-46, R-48, R-49, R-50, R-52.
Other DEFENDED/FIXED rows re-checked, same verdict, no note: R-12, R-14, R-17, R-21, R-24, R-34, R-35, R-42, R-43, R-47, R-51, R-55.
ACCEPTED-RISK / MITIGATED rows re-read and unchanged (still accepted): R-18, R-19, R-20, R-25, R-26, R-27, R-36, R-40, R-53, R-54, R-56.

Re-checked 39 DEFENDED/FIXED rows (the 27 critical/high ones individually above) plus the 11 accepted/mitigated; no guard was absent or inverted. Two rows needed a note (R-44 invisible-character boundary, R-45 zero-amount spec); those are new findings rather than a failure of the row's own attack. The prior review's "live zero-bond dispute recovery = 0 USDC" still holds (`lib.rs:1437-1446`).

## New findings

### N-01 Free indefinite fund freeze with `sent` + `timeout` on a kind that does not need `sent` — HIGH
attacker: any registered fulfiller on an open kind (`token_buy`, `cryptorefills_topup`; `cryptorefills_code` for the allowlisted shopper).
path:
1. Buyer funds a `token_buy` order (open access, no bond, 20-min claim/proof windows, up to 24-h deadline).
2. Fulfiller signs `auth_call` `{"op":"claim","order_id":"FUL-..."}` -> `Claimed`.
3. Fulfiller signs `auth_call` `{"op":"sent","order_id":"FUL-..."}`. `op_sent` does **not** check `kind.needs_sent`; `token_buy` and `cryptorefills_*` have `needs_sent=false`, yet the op is accepted.
4. Anyone (the fulfiller) calls `timeout({"order_id":"FUL-..."})` after `sent_at + proof_timeout_ns` (20 min for token_buy). The `Sent` branch calls `under_review`.
5. From `UnderReview` there is no permissionless exit: `expire` requires `Funded|Claimed`, `cancel` requires `Funded`, `timeout` falls into `_ => "nothing to time out"`, `prune` requires `Closed|Resolved`. Only the arbiter's `resolve_dispute` moves it.
location: `contracts/escrow/src/lib.rs:2312-2329` (`op_sent`, no `needs_sent` gate), `1245-1253` (`Sent -> UnderReview`), `1996-2003` (`under_review`), `1182-1188` (`expire` gate), `2528-2531` (`cancel` gate), `1266` (`timeout` panic arm).
impact: the buyer's full escrow value is frozen until the arbiter acts: 5.25 USDC max for `token_buy`; for `cryptorefills_topup` the funding path has **no value cap** (`lib.rs:2042-2044` caps only token_buy), so a level-1/2 claimant can freeze an arbitrarily large order; the buyer's `open_as_buyer` slot is also held. Cost to the attacker is gas only: `token_buy` claims lock 0 (`lib.rs:2207-2222` exempts token_buy from min_bond/bond lock) and the live `bond_per_job_bps=0`. A Sybil fleet turns this into an arbitration DoS.
fix: in `op_sent` require `self.kind(&o.kind).needs_sent` (or an explicit per-kind allow flag); and add a hard permissionless refund: let `expire` accept `Sent | ProofRejected | UnderReview` once `now >= deadline_ns + grace` (or make the `Sent` timeout refund the buyer instead of `under_review`).

### N-02 Permanent per-order-id storage churn bypasses `max_orders` and drains the NEAR reserve — MEDIUM
attacker: any funded account.
path:
1. Buyer funds a minimum order through intents (`mt_on_transfer` with `{"op":"fund",...}`); `internal_fund` inserts the id into `used_ids`.
2. Buyer cancels (or lets it expire): the full USDC is refunded, `orders` is pruned, `used_ids.insert` is **never** removed (`drop_order` only removes `orders`, the in-person hash and index entries).
3. Repeat with fresh ids. `max_orders` is `orders.len()` (`lib.rs:2061`), which drops on cancel, so it does not bound `used_ids`. `stats` and `nullifiers` entries also persist.
location: `contracts/escrow/src/lib.rs:2108` (insert), `1821-1833` (`drop_order`, no removal), `1761-1773` (`assert_storage_reserve`), `2061` (`max_orders`).
impact: unbounded permanent storage growth paid by the escrow account. Once `account_balance - storage_usage*cost < storage_reserve`, `internal_fund`, `op_claim`, `op_register`, `op_rate`, `recount_rating`, `bond` and the owner setters all panic; cancellation/expiry/payout still work, so funds are refundable but the market (new orders and claims) is blocked. The attacker only pays gas, and the refund returns every USDC.
fix: charge a non-refundable storage fee or require a storage deposit for each new order id; alternatively use a per-buyer monotonically increasing nonce instead of a permanent set, or cap `used_ids` and allow id reuse after a long retention (which must then also clear the id's nullifier/hash).

### N-03 `in_person` claim can freeze the buyer for the full 24-hour deadline, with no bond — MEDIUM
attacker: any registered fulfiller.
path: buyer funds an in_person order (open access); fulfiller signs `{"op":"claim","order_id":"..."}`; does nothing. The buyer cannot `cancel` (only `Funded`), and `expire` requires `now >= deadline_ns`. `timeout` only unclaims at `claimed_at + claim_timeout_ns` and `in_person` sets that to 24 h, clamped to the deadline; with the default deadline (24 h) the claim simply holds until `expire`.
location: `contracts/escrow/src/lib.rs:130-145` (`in_person_kind_config`: `claim_timeout_ns=24h`), `2528-2531` (`cancel`), `1182-1184` (`expire`), `1207-1218` (`timeout`).
impact: up to 20 USDC + reward (`in_person` value cap) and the buyer's open-order slot are tied up for 24 h at zero cost; with Sybils all in-person orders can be held. R-19 covers open-order griefing at the 15/20-minute crypto windows; in_person is 24 h.
fix: use a short (e.g. 10-15 min) claim timeout for `in_person` (the handoff is in person), or let the buyer cancel after a short claim grace with the bond (if any) slashed; a nonzero `bond_per_job_bps` also prices the hold.

### N-04 `token-verifier` never binds `spec.receiver` to the on-chain buyer; a tampered quote sends tokens to a colluder — HIGH
attacker: malicious relayer/backend plus a fulfiller, or a fulfiller that controls the receiver account.
path:
1. Buyer requests a `token_buy` quote. The backend builds the spec from `receiver` (`apps/web/lib/server/v3/token-buy.ts:215-248`), returns it plus `payload_to_sign`, and the buyer signs exactly that payload (`apps/web/lib/server/v3/intents.ts:173-219`). Only `spec_hash` is committed on chain; the escrow does not store `receiver`.
2. The quote's `receiver` is set to the attacker's second account (the fulfiller's own account is rejected as a self-transfer, see below; a distinct account works).
3. The fulfiller claims, then sends the token to `spec.receiver` with a plain `ft_transfer` in tx T.
4. `token-verifier` checks only `old_owner_id == job.fulfiller && new_owner_id == spec.receiver` (`token-verifier/src/lib.rs:549-559`); it validates `job.buyer` but never compares it to `spec.receiver` (`218-236`). The tx is accepted, the escrow pays the fulfiller, and the receiver returns the tokens to the fulfiller in a second plain `ft_transfer` (tx T is already settled and only T is inspected; T+1 is not part of the proof).
location: `workers/token-verifier/src/lib.rs:218-236` (`parse_spec`: `job.buyer` validated but unused), `549-559` (receiver comparison), `contracts/escrow/src/lib.rs:2477` (`buyer` sent to the worker but ignored).
impact: the buyer loses the full order value (1-5.25 USDC per token_buy order) and receives nothing; the attacker recovers the delivered tokens in a second tx. `receiver != buyer` is possible by design (gifting), so this is not caught anywhere on chain.
fix: either require `spec.receiver == job.buyer` in the worker, or add a buyer-signed `receiver` field to the on-chain order (hash or plain) and make the worker compare against it; keep gifting by committing the gift receiver explicitly at funding. A second plain transfer back to the fulfiller in a later tx cannot be detected, so binding at funding is the only sound fix.
status: ACCEPTED-RISK (2026-11-12, maintainers keep gifting). The buyer-signed `fund` intent already carries the full token_buy `spec` in plain text, `receiver` included (`apps/web/lib/server/v3/intents.ts:50`, `token-buy.ts:270`), so the wallet shows the receiver in the message the buyer signs, and the shop shows it again as "Sent to" before signing (`components/shop/token-buy.tsx:331`). A separate on-chain `receiver` field would be filled from the same backend-built payload, so it would add no protection against a malicious backend. The only change that would close the path is `spec.receiver == job.buyer`, which removes gifting. Residual risk: a buyer who signs without reading the receiver in the wallet can lose the order value (capped at 5.25 USDC by the token_buy kind). The escrow does not require `spec` in the fund msg for token_buy (only for in_person, `contracts/escrow/src/lib.rs:2046-2050`); a raw intent may omit it, but the buyer still signs that intent.

### N-05 A single dissenting RPC (or an anchor outage) blocks every token_buy settlement — MEDIUM
attacker: the operator of any one URL in the worker's RPC list (`rpc.intea.rs`, `rpc.shitzuapes.xyz` are community endpoints), or a network attacker who can make both anchor endpoints unreachable.
path:
- Veto: for a valid proof, the malicious RPC returns the same `EXPERIMENTAL_tx_status` result and the real block (so `parse_outcome` succeeds) but mutates one `receipts_outcome.logs` entry or the receipt status. `agreed_outcome` sets `disagreed=true` on any parsed outcome that differs from the first (`token-verifier/src/lib.rs:468-482`) and returns `None` ("rpc_disagreement"), so the proof is rejected even though the other three RPCs agree. The existing test `honest_dissent_rejects_even_when_two_other_rpcs_match` pins this behaviour.
- Anchor outage: if both `free.rpc.fastnear.com` and `archival-rpc.mainnet.near.org` fail, `answered_hosts.len()` may be >=2 but `anchor_answered=false` (`478`), so every token proof fails (`agreeing_community_rpcs_rejected_when_all_anchors_down`).
location: `workers/token-verifier/src/lib.rs:423-483` (`agreed_outcome`), `430-434` (anchors from host names), `478` (veto/anchor gate).
impact: a valid delivered token transfer is never paid. After 3 rejected proofs the order goes to `UnderReview` (N-01: no permissionless exit and the arbiter decides), or the fulfiller releases and the buyer cancels, leaving the fulfiller unpaid after delivery. In collusion (buyer + RPC operator) the delivered tokens are kept and the buyer is refunded. No funds are stolen from the escrow, but delivered tokens are lost and token_buy liveness is fully controlled by the weakest RPC in the list.
fix: decide by supermajority (e.g. >=2/3 of distinct hosts, with at least one anchor agreeing) and ignore one outlier instead of treating any dissent as a veto; use multiple independent anchors; pin RPC operators or make the list operator-controlled rather than a set of public community endpoints. Document that the quorum is liveness-only when a single host can veto.

### N-06 Email DKIM accepts any key published in DNS even when a pinned key exists — HIGH (requires DNS/DoH compromise)
attacker: anyone able to publish/alter the TXT record for `*._domainkey.vpb.com.vn` (DNS takeover) or to answer the two public DoH endpoints; in practice a bank-domain DNS compromise.
path: `verify_one` first checks every DNS TXT key returned by `dns.google`/`cloudflare-dns.com` and returns `Ok(domain)` if any verifies; only if that fails does it try the pinned key (`email-verifier/src/dkim.rs:383-399`). The pinned key is therefore an additional accepted key, not a pin. A forged receipt signed with the attacker's RSA key and `d="vpb.com.vn"` is accepted, then the amount/merchant/note checks can be satisfied and the escrow pays.
location: `workers/email-verifier/src/dkim.rs:383-399`; `doh_records` at `231-283`.
impact: forged `bank_transfer` proofs; the escrow pays the order value (bank_transfer has no on-chain value cap; only approved fulfillers can claim, `lib.rs:2255-2258`). All bank orders can be drained if the attacker is approved (e.g. the official shopper, or an approved colluder).
fix: if a `pinned_keys` entry exists for `(domain, selector)`, accept only that key (fail closed on rotation) and require an owner-driven update; or fetch via DNSSEC-validated DoH and require the key to match the pin. Do not OR DNS keys with the pin.

### N-07 `bank_transfer` spec amount can be `"0"` (and cryptorefills `product_value` can be `"0"`), so any payment passes the value check — MEDIUM
attacker: malicious relayer/backend (the buyer signs the backend-built payload) or a buyer using a raw intent to defraud a fulfiller.
path: `email-verifier` `valid_spec` only requires `spec.amount.parse::<u128>()` to succeed (`email-verifier/src/lib.rs:86-98`); `"0"` parses. The comparison is `parsed.amount_vnd < amount` (`247-248`), so with `amount=0` any bank email to the merchant with the order-id note settles. The escrow's `pay_amount` is USDC and unrelated to the VND spec amount; `min_order_amount` only floors the USDC. `cryptorefills` similarly accepts `product_value="0"` (`cryptorefills-verifier/src/lib.rs:208-209`) and compares equality (`531`).
location: `workers/email-verifier/src/lib.rs:86-98,247-252`; `workers/cryptorefills-verifier/src/lib.rs:193-214,531`.
impact: a quote with a zero (or trivially small) product amount pays the fulfiller the full USDC order value for a worthless VND top-up/payment. Requires the buyer to sign the tampered quote, i.e. the same malicious-backend class as N-04, but the worker is the only validator and it accepts 0.
fix: require `amount > 0` (and a sane lower bound / max) in `valid_spec`, and require `decimal(product_value) > 0` in `parse_spec`; optionally bind the VND amount to the USDC value in the escrow by storing it on chain.

### N-08 Token worker reads stdin with no size limit; the escrow does not cap `spec` length — LOW
attacker: a buyer who funds a `token_buy` order whose `spec_hash` is the hash of a huge preimage, then any fulfiller/relayer who submits it.
path: `run()` does `io::stdin().read_to_string` unbounded (`token-verifier/src/main.rs:183-188`); `op_submit_proof` hashes `spec` with no length check (`lib.rs:2426-2431`) and sends it as `input_data` to OutLayer. A spec of several MB (NEAR receipt limit) is parsed and hashed in the worker.
location: `workers/token-verifier/src/main.rs:183-188`; `contracts/escrow/src/lib.rs:2391-2431`.
impact: worker memory/CPU DoS and wasted OutLayer executions (TEE cost) on an order whose proof can never be rejected cheaply; at best a slow rejection, at worst a worker kill (which the escrow turns into `ProofRejected`).
fix: cap the job JSON / `spec` to e.g. 64 KB in `run()` and in `op_submit_proof` (`spec.len() <= 1024` is consistent with the backend's 1000-char limit); reject with a fixed reason.

### N-09 Disabling a kind does not stop new claims/proofs on funded orders — LOW
attacker: fulfiller on a kind the owner just disabled.
path: `internal_fund` checks `kind.enabled` (`lib.rs:2016-2017`) but `op_claim` does not (`2167-2185`), and `op_submit_proof` does not (`2391-2402`). After `set_kind(enabled=false)` (e.g. to quarantine a broken verifier), a fulfiller can still claim an already-funded order and submit proofs to the old verifier source.
location: `contracts/escrow/src/lib.rs:2016-2017` vs `2167-2185`, `2391-2402`.
impact: the owner's emergency disable only stops new funding; live orders can still be claimed and settled by the possibly-broken verifier. No direct theft, but it defeats the emergency control the owner would reach for (and R-53 makes the owner the last line of defence).
fix: in `op_claim` and `op_submit_proof`, require `self.kind(&o.kind).enabled` (or a separate `allow_completion` flag) so disable also blocks new claims/proofs while `expire`/refunds still work.

### N-10 `quoted_by` may pin a registered account that cannot claim the order, buying a 2-minute block — LOW
attacker: buyer.
path: `internal_fund` checks only access eligibility for `quoted_by` (`lib.rs:2062-2065`); it does not check the kind's `open_max_order_value` against the quoter's level or the quoter's active-claim count. Pin a level-0 account as `quoted_by` on a high-value `cryptorefills_topup` order: the quoter passes `assert_kind_eligible` but fails `op_claim`'s level-0 value limit (`2195-2202`); other fulfillers are blocked by `quote exclusive` for `quote_exclusive_ns` (2 min, `2173-2177`).
location: `contracts/escrow/src/lib.rs:2062-2065,2173-2177,2195-2202`.
impact: a 2-minute claim delay per order for a registered-but-ineligible quoter; the buyer can cancel. R-12's fix checks registration/access but not level/value/claim capacity.
fix: at funding, apply the same `open_level_zero` value and active-claim checks to `quoted_by` that `op_claim` will apply, or drop the quote reservation when the quoter is not currently able to claim.

### N-11 `in_person` proof budget is order-wide, so any claimer can permanently disable confirmation — LOW
attacker: any registered fulfiller.
path: claim an in_person order, call `confirm_delivery` six times with wrong 64-hex codes (each increments `total_proof_attempts`; non-hex codes also count), then `release_claim`. `total_proof_attempts` is not reset by release (`op_release_claim` resets only `attempts`, `lib.rs:2291`), and `op_confirm_delivery` requires `< MAX_TOTAL_PROOF_ATTEMPTS` (`2347-2350`). A second, honest claimer can never confirm; the order can only be refunded at the deadline.
location: `contracts/escrow/src/lib.rs:2331-2373,2273-2306`.
impact: an in_person order cannot be completed (only refunded) after a 6-guess grief; the buyer must wait for the deadline or cancel (if released). No funds lost, but the buyer's intended purchase fails and the fulfiller's work is wasted.
fix: keep the total budget per *order* but reset it only on a new order/secret, or charge the budget to the claimant and make release restore the unused attempts; alternatively require a bond and slash it on exhausted attempts.

### N-12 `in_person` `delivery_hash` is taken from the quote request; a malicious quote can make the secret guessable — LOW
attacker: malicious backend/quote generator plus a fulfiller.
path: `prepareInPerson` accepts `delivery_hash` from the request body (`apps/web/lib/server/v3/in-person.ts:19-25`). The escrow only checks `sha256(secret) == delivery_hash` and `secret` is 32 bytes (`lib.rs:90-128,2356-2359`); it never checks entropy. A quote can set `delivery_hash = sha256(0x00..00)` (or any known 32-byte value), the buyer signs the spec, the fulfiller claims and calls `confirm_delivery` with the known constant without any handoff.
location: `apps/web/lib/server/v3/in-person.ts:19-25`; `contracts/escrow/src/lib.rs:90-128,2331-2388`.
impact: the buyer's in_person order is paid (up to 20 USDC + reward) with no delivery. Requires the buyer to sign the backend-built spec; the on-chain contract cannot tell a weak preimage from a strong one.
fix: generate the secret in the client/backend and only expose the hash (already done in the UI) but also reject a `delivery_hash` that matches a small dictionary or require the buyer to include a commitment to a fresh random value; at minimum, do not accept `delivery_hash` as an unvalidated API input. The contract-side mitigation would be to require the preimage to be a hash of a buyer-signed fresh nonce, which needs an on-chain field.

## Speculative

- `email-verifier` `note_contains_order_id` treats a zero-width/format character before a trailing digit as a non-continuation; `FUL-0001<ZWJ>0` matches order `FUL-0001`. Payer-controlled note, so cross-order value is doubtful; test `FUL-0001\u{200d}0` and extend `is_order_id_character` to `char::is_alphanumeric || format chars`.
- `token-verifier` accepts `timestamp_ns >= claimed_at_ns`, so a transfer in the same block, ordered just before the claim receipt, passes (`507`). The fulfiller still delivered, so no separate theft path found; if ordering matters, use `>` plus a block-height check.
- `token-verifier` only filters receipts by `executor_id == spec.token_contract` and never checks `transaction.receiver_id`; a wrapper contract that calls `ft_transfer` from the fulfiller's own balance is caught by the signer/old_owner checks in the cases I modelled. Only a malicious `spec.token_contract` (buyer-chosen) can emit fake events; needs a malicious buyer.
- `escrow` `op_submit_proof` uses `sha256(spec)` but the in_person spec is only validated at funding; an in_person spec with `item_desc`/`area` containing the secret would leak it in the on-chain fund `msg` (the spec is included for in_person/token_buy). The shipped UI does not do this.
- `escrow` `recount_rating` is permissionless and gated only by `assert_storage_reserve`; a storage-exhausted escrow rejects recounts, but no fund impact.
- `token-verifier` `main.rs` reads unbounded stdin (N-08); if OutLayer does not cap memory, a multi-MB spec can kill the worker; the escrow turns that into a rejection, so it is a cost/DoS only.
- `cryptorefills-verifier` `created_at_ns` accepts epoch seconds/millis/micros/ns by magnitude; a merchant order created 10 min before the claim is valid by design, and the nullifier blocks reuse. No separate replay found.

## Summary
re-checked: 50 (39 DEFENDED/FIXED, incl. all 27 critical/high; 11 ACCEPTED-RISK/MITIGATED) · confirmed: 39 · weak: 0 · wrong: 0 · new: 12 (crit 0 / high 3 / med 4 / low 5)

Notes on severity: N-04 (accepted risk, see its status line) and N-06 are high under the stated malicious-relayer/backend and DNS-compromise assumptions; both still require the buyer/owner to sign or approve something. N-01 is the most directly reachable new bug with only a registered account, a raw signed `auth_call`, and gas.
