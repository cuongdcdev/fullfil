# Build a verifier (add a bank or a new proof type)

Audience: developers who want Fulfil to support another bank, another country, or a new kind of job. The in-app summary is at `/docs#verifier` (the old `#custom-bank` link still lands there).

Short version: a **kind** is escrow rules plus one **OutLayer verifier project**. The escrow never judges a proof itself. It hands the proof to the verifier running in an OutLayer TEE and pays only if the verifier says `ok`.

## 1. Architecture

```text
fulfiller --submit_proof(order_id, proof_sha256, spec)--> escrow (nearfullfil.near)
escrow: checks sha256(spec) == order.spec_hash, order state, attempt limits
escrow --request_execution(source = verifier_source,
                           resource_limits = verifier_resource_limits,
                           input_data = <worker input JSON>,
                           secrets_ref = KindConfig.secrets_ref)--> OutLayer
OutLayer runs the WASI worker in a TEE: stdin = input JSON, stdout = one JSON line
escrow.on_verify_result(order_id, attempt, verify_seq, result):
   ok + three echoes + completed_at_ns + max_email_skew_ns >= claimed_at
   + unused 64-hex nullifier  -->  pay fulfiller (mt_transfer on intents.near), record nullifier
   otherwise                  -->  proof_rejected (3 attempts, then under_review / arbiter)
```

`verifier_source` is a per-kind string holding the OutLayer `source` JSON, for example `{"Project":{"project_id":"nearfullfil.near/email-verifier","version_key":null}}`. Maintainers point a kind at a project with `set_kind` (1 yocto, maintainer-only). No contract upgrade is needed to add a kind. Other `KindConfig` fields (access, timeouts, `needs_sent`, claim limits) are in the [escrow contract README](../contracts/escrow/README.md).

### Worker input (from the contract)

```json
{"order_id":"FUL-1234","kind":"bank_transfer","spec":"<canonical JSON string>","spec_hash":"<hex64>","proof_sha256":"<hex64>","claimed_at_ns":"<decimal ns>","fulfiller":"fulfiller.near","buyer":"buyer.near","blob_url":"<proof_blob_base_url><proof_sha256>"}
```

`spec` is a canonical JSON string and `spec_hash` is the SHA-256 of its exact bytes. For `bank_transfer` it holds `amount`, `bank`, `country`, `currency`, `merchant_hash` and `v:1`. The raw proof (for banks, the `.eml`) never goes on chain: the worker downloads it from `blob_url` with a bearer token kept in OutLayer secrets (`PROOF_BLOB_TOKEN`), then checks that its SHA-256 equals `proof_sha256`.

### Worker output (to the contract)

```json
{"ok":true,"order_id":"FUL-1234","proof_sha256":"<hex64>","spec_hash":"<hex64>","nullifier":"<hex64>","completed_at_ns":"<decimal ns>"}
```

A failure returns the same three identifiers, `ok:false`, a short fixed `reason`, `nullifier:""` and `completed_at_ns:"0"`. The three identifiers must be echoed exactly. Do not return personal data (names, full account numbers) in any field: the output is written on chain. Reference implementations: [../workers/email-verifier](../workers/email-verifier), [../workers/cryptorefills-verifier](../workers/cryptorefills-verifier), [../workers/token-verifier](../workers/token-verifier). Each README lists its reason codes.

## 2. What a bank email verifier must check

`workers/email-verifier` runs these checks in order (`verify()` in `src/lib.rs`):

| Check | Why | Where |
|---|---|---|
| Kind, `spec_hash`, spec shape and version | The job really is the order the buyer funded | `valid_spec` |
| Blob URL on the allowed prefix, token present, SHA-256 equals `proof_sha256` | The fulfiller cannot swap the file after submitting its hash | `blob_url_allowed`, `verify` |
| **DKIM** `rsa-sha256` signature, matching signed `From`, no `l=` tag, no duplicate sensitive headers | Proves the bank's mail server produced the message | `dkim::verify` |
| **Sender domain** is one of the bank profile's `dkim_domains` | A valid DKIM signature from some other domain proves nothing | `BankProfile`, `Config.banks` |
| Key source: DNS-over-HTTPS (dns.google, Cloudflare) with a **pinned key** fallback | Survives DoH failures; pins are reviewed in the PR | `doh_records`, `Config.pinned_keys` |
| Parsed **status** is success (if the bank prints one) | A failed or pending transfer must not pay | `parser::parse` |
| **Amount** >= `spec.amount` | Under-payment is rejected | `verify` |
| **Beneficiary**: SHA-256 of the normalized credit account equals `spec.merchant_hash` | The money went to the shop's account in the QR | `merchant_hash`, `normalize_account` |
| **Order code in the note** | Binds the transfer to this order | `note_contains_order_id` |
| **Time skew**: email time + `max_email_skew_ns` (10 min) >= claim time | An old receipt cannot be reused for a new order | `MAX_EMAIL_SKEW_NS` |
| **Nullifier** = SHA-256 of `bank_transfer:` + transaction code | The contract rejects a nullifier it has seen, so one receipt pays once | `Output` |

**Known limitation and a good first contribution: the payer account is not checked today.** (The maintainers accepted this for now.) Details: `register_fulfiller` stores the fulfiller's `bank_bin` and `account_last4`, and the operator uses them when approving the account. The current `email-verifier` does **not** compare the receipt's debit account with those fields. The parser can read the debit account (`debit account` / `tai khoan trich no` labels), so a new profile or a later hardening could expose its last 4 digits and compare them. If you add that, never return the full account in the output.

**Real lesson: the note gets rewritten.** VPBank and Napas turned `FUL-2A6D0AEE` into `FUL 2A6D0AEE`. The first deployed matcher required the dash and rejected a genuine payment. `note_contains_order_id` now folds case, ignores whitespace and optional `-`/`_`, and still requires the ID to be delimited by non-ID characters (so `FUL 2A6D0AEE1` or `XFUL 2A6D0AEE` do not match). Reuse it and add the separator forms your bank produces to its tests.

## 3. New bank = a new profile inside `email-verifier`

Read the code, not the README: a bank is not a new worker. `Config.banks` is a list of `BankProfile { id, dkim_domains }`, and `BankProfile::parse` in `src/dkim.rs` dispatches on `id` (currently only `"vpbank"` to `parser::parse`). The kind `bank_transfer` has exactly one `verifier_source`, so every supported bank lives in the same project and the same binary.

### Add bank X: step by step

1. **New profile.** In `Config::default()` (`lib.rs`) add `BankProfile { id: "bankx", dkim_domains: vec!["alerts.bankx.example"] }`.
2. **Pin the DKIM key.** Add `(domain, selector)` (lower case) to `pinned_keys` as the fallback. Say in the PR how and when you fetched it.
3. **Parser arm.** Write `parse` for the bank's receipt layout (new function or module beside `parser.rs`), and add `"bankx" => ...` to `BankProfile::parse` in `dkim.rs`. It must return `Parsed`.
4. **Loosen `valid_spec`.** Replace `spec.bank != "vpbank"` with a check that `spec.bank` is one of the configured bank ids, and check country and currency per bank.
5. **Fixtures.** Follow the `signed_email()` pattern in the `lib.rs` tests: build a receipt in the bank's layout and sign it with the throwaway test key; `config()` pins that test key for the test domain. Cover the cases in section 4.
6. **Tests.** `cargo test -p email-verifier` must pass, including the output-has-no-PII test.
7. **Pull request** (section 6). Include a redacted real receipt for parser tests only.
8. **Maintainers review, build and deploy**, pinned by WASM hash, and check the FastFS URL returns 200 (section 6).
9. **Go live.** The maintainers call `set_kind` if the kind config changes, and adds the bank (name, BIN) to `BANKS` in `apps/web/lib/v3-client.ts` so fulfillers can pick it. Approve the first fulfillers for that bank.

For reference, the pieces in order: profile (`Config::default`), key pin (`pinned_keys`), parser arm (`BankProfile::parse`), spec check (`valid_spec`), fixtures (`signed_email`), `BANKS` (`v3-client.ts`).

A separate worker only makes sense for a different proof type that is not a DKIM-signed email (a different kind, like `token_buy`, which checks an on-chain transaction).

### The live VPBank source, file by file

Everything below is in `workers/email-verifier/src/` (Rust, WASI preview 2). Function names are stable landmarks; line numbers drift.

| What | Where | Notes for a new bank |
|---|---|---|
| Bank profile type | `struct BankProfile { id, dkim_domains }` in `dkim.rs` | One entry per bank. `id` is the string the order spec carries as `spec.bank`. |
| Profile dispatch | `BankProfile::parse` in `dkim.rs`: `match self.id { "vpbank" => parser::parse(..), _ => Err("bank") }` | Add your arm here, calling your own parser. |
| Default config | `impl Default for Config` in `lib.rs`: `banks: vec![BankProfile { id: "vpbank", dkim_domains: vec!["vpb.com.vn"] }]` and `pinned_keys` | Add your `BankProfile` and your pinned DKIM key here. |
| Spec check | `valid_spec` in `lib.rs` | **Hard-codes `spec.bank != "vpbank"`, `country != "VN"` and `currency != "VND"`.** A new bank must loosen this to a lookup in the configured banks (and per-bank country and currency), or every job for your bank fails with `spec_invalid`. |
| DKIM | `dkim::verify` and `verify_one` in `dkim.rs` | `rsa-sha256`, signed `From` must match, rejects an `l=` tag and duplicate sensitive headers. Returns the signing domain, which `verify()` maps to a `BankProfile`. |
| Key lookup and pinning | `doh_records` (DNS-over-HTTPS) then `Config.pinned_keys` in `dkim.rs` | DoH first; the pinned key (keyed by lower-case domain and selector) is the fallback and the way to survive a DoH outage. The VPBank pin is `vpb.com.vn` / selector `rfp7letnk4`. State in your PR how and when you fetched yours. |
| Receipt parser | `parser::parse` in `parser.rs` | Returns `Parsed` (status, transaction code, credit account, amount, note, timestamp). Handles label variants in English and Vietnamese, quoted-printable and base64 parts, and conflicting or duplicate fields. |
| Amount, beneficiary | `verify` in `lib.rs`; `merchant_hash`, `normalize_account` | Amount must be at least `spec.amount`. SHA-256 of the normalized credit account must equal `spec.merchant_hash`. |
| Order code in the note | `note_contains_order_id` in `lib.rs` | Tolerates `FUL-X`, `FUL X` and `FULX`. |
| Time skew | `MAX_EMAIL_SKEW_NS` (10 minutes) in `lib.rs` | Rejects `email_too_old` when email time plus skew is before the claim time. |
| Nullifier | `verify` in `lib.rs` | `sha256("bank_transfer:" + UPPERCASED transaction code)`. |

Deployed today: OutLayer project `nearfullfil.near/email-verifier`. The currently live build is the separator-tolerant order-id matcher deployed on 2026-11-10, WASM sha256 `b1e8f4f0...d9c9` (685,943 bytes; the hash is abbreviated here). The build before it was `dc16e5ae...abb`. Check the deployed project version for the current hash before relying on this.

Build command and target: `cargo build -p email-verifier --target wasm32-wasip2 --profile contract` (output `target/wasm32-wasip2/contract/email-verifier.wasm`). Tests: `cargo test -p email-verifier`.

## 4. Fixtures and tests

### The synthetic "Lotus Bank" demo receipt

`fixtures/lotus-notice-valid.eml` is a fictional bank notice signed with a test key (`fixtures/dkim-lotusbank-private.pem`; public record in `fixtures/dkim-lotusbank-public.txt`, selector `lotus1`, domain `alerts.lotusbank.example`). Content (the signature line is shortened here):

```text
DKIM-Signature: v=1; a=rsa-sha256; c=simple/simple; d=alerts.lotusbank.example; s=lotus1; h=from:to:subject:date; bh=y8lXJtpKSQdaBwTMoHtEw7ueMfKnqBdY25epyeRVhdQ=; b=...
From: Lotus Bank Alerts <noreply@alerts.lotusbank.example>
To: customer@example.test
Subject: Thong bao giao dich
Date: Fri, 06 Nov 2026 05:31:00 +0000

Lotus Bank - Thong bao giao dich
Tai khoan 0123xxxx89 -50,000 VND luc 12:31 06/11/2026.
Nguoi nhan: PHO BAY SAO DEMO - STK xxxxxx4321
ND: FUL-8K2Q pho. So du 1,250,000 VND.
Ma giao dich: LTB202611061231A1B2C3
```

Negative cases from the same generator:

- `fixtures/lotus-notice-tampered.eml`: the body amount was changed after signing, so the body hash no longer matches `bh=` and DKIM fails.
- `fixtures/lotus-notice-wrong-amount.eml`: validly signed, but for a different amount (60,000 instead of 50,000), so the amount check fails.

Important: the Lotus fixtures belong to the TypeScript reference layer used by the mock/demo mode (`packages/adapters/src/bank-notice.ts`, `scripts/generate-fixtures.ts`). Its plain-text layout is not the labelled layout the Rust `email-verifier` parses, and its domain is not in the Rust worker's bank list, so you cannot feed them to the production worker unchanged. Use them as the model for what a good fixture set contains: one valid, one tampered, one wrong amount, plus wrong domain, wrong recipient and missing note.

### Fixtures for your Rust bank profile

The Rust tests build their own emails: `signed_email()` in `workers/email-verifier/src/lib.rs` writes a message in the bank's layout and signs it with a throwaway RSA test key, and `config()` pins that test public key for the test domain. Follow the same pattern for your bank, and test at least: valid mail, tampered body, wrong amount, wrong beneficiary, missing or rewritten order code, old timestamp, wrong sender domain, `l=` tag, duplicate headers, and that the JSON output contains no names or account numbers.

### Making a redacted fixture from a real receipt

1. Start from a transfer you made yourself, between your own accounts, for a small amount.
2. Remove or replace: your name and the recipient's name, every email address, full account numbers (keep the shape, for example `0000123456789`), phone numbers, and any balance.
3. Keep the structure: labels, table layout, encoding (quoted-printable or base64), headers that affect parsing, the note format as the bank wrote it.
4. **Never commit a real `.eml`.** It contains personal data and a valid DKIM signature over it.
5. A redacted real email no longer passes DKIM because the signed content changed. Use the redacted file to test the parser (with signature checks skipped in a test, or with the test-key `signed_email()` re-signing the same layout), and pair it with a synthetic test-key-signed fixture for the end-to-end path.

## 5. Build, test, run locally

All three workers target WASI preview 2.

```bash
rustup target add wasm32-wasip2
cargo test -p email-verifier
cargo build -p email-verifier --target wasm32-wasip2 --profile contract
# local run on a synthetic job and email
cargo run -p email-verifier --release -- --job-file /tmp/job.json --eml-file /tmp/synthetic.eml
```

`--offline` uses pinned keys only, `--pin DOMAIN:SELECTOR:BASE64SPKI` adds a local pin, and `--eml-file` skips the blob fetch while still checking the SHA-256 (see the worker README). Deployed contract-profile size today is about 686 KB.

Resource limits: the escrow passes `verifier_resource_limits` (a JSON config string, `max_instructions`, `max_memory_mb`, `max_execution_seconds`) with every OutLayer call, and `request_execution` requires it. Measure your worker locally and keep it well inside the limits. A real VPBank verification ran in about 4 s inside OutLayer for about 0.0014 NEAR. Use a bounded number of network calls with timeouts, response size caps and no redirects, as the existing workers do.

## 6. Contribution workflow

1. **Open a pull request** at <https://github.com/cuongdcdev/fullfil/pulls> (the repository is <https://github.com/cuongdcdev/fullfil>). The PR adds the bank profile or verifier under `workers/`, with redacted fixtures and tests (section 4).
2. **Maintainers review** the code: parser strictness, DKIM and domain handling, pinned key provenance, the beneficiary and payer checks, the note rule, PII in output, resource use.
3. **Maintainers build and deploy** the OutLayer project under `nearfullfil.near`, pinned by WASM hash, and check that the version's FastFS URL returns 200 (a missing upload once caused rejected proofs, see E2E_LOG).
4. **The maintainers call `set_kind`** (or updates the deployed project version) and adds the bank's BIN to `BANKS` in `apps/web/lib/v3-client.ts`. Fulfillers for that bank can then be approved.

Contributors do **not** deploy their own project and ask the maintainers to point `verifier_source` at it. That would mean trusting code nobody reviewed, with escrowed money behind it.

Contact: <https://t.me/nearcatalogchat>.

## 7. Other countries

VietQR (Vietnam) is live. PromptPay (Thailand) QR codes are parsed (`packages/core/src/qr.ts`), but there is no tested proof flow for them yet: no Thai bank receipt verifier has been built or run. A new country needs its QR rail parsed, a bank receipt format, and a verifier profile as above.
