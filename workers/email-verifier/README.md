# Email verifier

This OutLayer WASI P2 worker verifies an original VPBank `.eml` for a `bank_transfer` order. It reads one JSON job from stdin, writes one JSON line to stdout, and flushes. Verification failures exit 0; malformed jobs and CLI arguments exit nonzero.

## Job and result

Input fields: `order_id`, `kind`, `spec`, `spec_hash`, `proof_sha256`, `claimed_at_ns`, `blob_url`. `spec` is a canonical JSON **string** with `amount`, `bank`, `country`, `currency`, `merchant_hash`, and `v:1`. `claimed_at_ns` accepts a decimal string or unsigned integer. `spec_hash` is lowercase hex SHA-256 of the exact UTF-8 spec bytes.

Synthetic example (proof hash is a placeholder):

```json
{"order_id":"FUL-ORDER123","kind":"bank_transfer","spec":"{\"amount\":\"10000\",\"bank\":\"vpbank\",\"country\":\"VN\",\"currency\":\"VND\",\"merchant_hash\":\"50ebbc094dfa0bcccdd67d4c216eeab9fed26448b1c698c9ecfba7a7bda1d345\",\"v\":1}","spec_hash":"fc26d8026fcbee38d953920583826bfe854c61ed27eb14c3352f3e90f1a6ea2d","proof_sha256":"0000000000000000000000000000000000000000000000000000000000000000","claimed_at_ns":"0","blob_url":"https://fulfil.junstudio.xyz/api/proof-blob/0000000000000000000000000000000000000000000000000000000000000000"}
```

Output fields, in order: `{"ok":bool,"reason"?:string,"order_id","proof_sha256","spec_hash","nullifier","completed_at_ns"}`. The three identifiers echo the input verbatim. Failure returns `nullifier:""` and `completed_at_ns:"0"`. Success returns `nullifier = sha256_hex("bank_transfer:" + trimmed, uppercased transaction code)` and the email timestamp in nanoseconds as `completed_at_ns`. The worker never returns the raw account, beneficiary name, transaction code, or email body.

Checks run in order: kind, spec hash, spec shape/version, blob URL/token/fetch and SHA-256, DKIM, bank parser, amount, merchant hash, order ID in the note, then email time. The note check folds case and tolerates whitespace inside the ID for bank line wrapping, then requires the ID to be delimited on both sides by non-ID characters; letters, digits, `-`, and `_` extend an ID. The email may predate the claim by at most 600,000,000,000 ns (10 minutes). Reasons include `kind_mismatch`, `spec_hash_mismatch`, `spec_invalid`, `blob_url_not_allowed`, `blob_token_missing`, `blob_fetch_fail`, `sha256_mismatch`, `dkim_fail`, `domain_not_allowed`, `l_tag_rejected`, `duplicate_header:FIELD`, `parse_fail:FIELD`, `parse_ambiguous:FIELD`, `status_not_success`, `amount_too_low`, `merchant_mismatch`, `note_missing_order_id`, and `email_too_old`.

## Blob and DKIM behavior

Without `--eml-file`, the worker fetches `blob_url` with `Authorization: Bearer $PROOF_BLOB_TOKEN`. The token is read via `std::env::var` at runtime. The URL must equal an HTTPS allowed prefix followed by the proof hash. `ALLOWED_BLOB_PREFIXES` contains `https://fulfil.junstudio.xyz/api/proof-blob/`; a nonempty `PROOF_BLOB_PREFIX` replaces it and must start with `https://` and end with `/`. `--eml-file` skips URL and token checks, but still checks SHA-256.

DKIM accepts a valid `rsa-sha256` signature from a configured VPBank domain with a matching signed From address. It checks body and signature hashes, rejects `l=`, handles simple and relaxed canonicalization, and uses DNS-over-HTTPS with a pinned-key fallback. `--offline` uses pins only; `--pin DOMAIN:SELECTOR:BASE64SPKI` adds a local pin. The parser reads labelled credit fields from HTML or plain text, rejects duplicate sensitive headers and conflicting MIME alternatives, and requires a successful status if one is present. Bank account normalization is trim, uppercase, then removal of whitespace, dots, and dashes before SHA-256. Merchant-hash comparison is case-insensitive.

## Build and local diagnostics

```bash
cargo build -p email-verifier --target wasm32-wasip2 --profile contract
cargo test -p email-verifier
cargo run -p email-verifier --release -- --job-file /tmp/job.json --eml-file /tmp/synthetic.eml
printf '%s' 'synthetic-account' | cargo run -p email-verifier --release -- hash-account
```

`--skip-sha` is for local diagnostics only. Contract-profile WASM size: **685,266 bytes**.
