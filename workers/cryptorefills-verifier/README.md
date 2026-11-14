# Cryptorefills verifier

This OutLayer WASI P2 worker verifies a Cryptorefills order before an escrow payout. It reads one JSON job from stdin, writes one JSON line to stdout, and flushes. Verification failures exit 0; malformed jobs or CLI arguments exit nonzero. Tests inject an HTTP trait and never call the network.

## Job and result

Input: `{"order_id","kind","spec","spec_hash","proof_sha256","claimed_at_ns","blob_url"}`. Kinds are `cryptorefills_topup` and `cryptorefills_code`. `spec` is a canonical JSON string with `beneficiary_hash`, `brand_name`, `country`, `delivery_type`, `denomination`, `product_value`, `salt`, and `v:1`. Exactly one of `denomination` and `product_value` is nonempty. `salt` is 32 lowercase hex characters. `beneficiary_hash = sha256_hex(salt + ":" + normalized beneficiary)`. A phone is E.164: `+`, then 8–15 ASCII digits, with the first digit nonzero; surrounding ASCII whitespace is trimmed. An email is trimmed and lowercased, then validated. `spec_hash` is lowercase hex SHA-256 of the exact UTF-8 spec bytes. `claimed_at_ns` accepts a decimal string or unsigned integer.

Output fields, in order: `{"ok":bool,"reason"?:string,"order_id","proof_sha256","spec_hash","nullifier","completed_at_ns"}`. The three identifiers echo the input verbatim. Failure uses `nullifier:""` and `completed_at_ns:"0"`. Success requires the API result's top-level string `order_id` to equal the blob `cr_order_id` byte-for-byte, then uses `sha256_hex("cryptorefills:" + API order_id)` for the nullifier and the order's `created_at` as nanoseconds for completion time.

The blob is JSON containing string `cr_order_id` and `cr_order_token`. The worker checks its SHA-256, then calls `getOrderStatus` on the Cryptorefills MCP endpoint. Plain JSON-RPC and SSE responses are supported, including `structuredContent.result` and `content[0].text`; when several SSE events occur, it uses the JSON-RPC response with `id:1`. Duplicate JSON keys are rejected at every object depth in both the blob and MCP payloads. Order state must be `Done`, with exactly one `Succeeded` delivery. The deliverable's brand, country, delivery type, denomination or decimal product value, and beneficiary hash must match the spec. Cryptorefills must echo the shopper's E.164 `beneficiary_account`; formatted or otherwise non-E.164 upstream phone values fail closed. `created_at` accepts RFC3339 with `Z` or offset, offset-free ISO-8601 as UTC, or numeric epoch seconds/milliseconds/microseconds/nanoseconds. It may predate the claim by at most 10 minutes or exceed the verification time by at most 5 minutes. Verification time comes from the worker's own WASI P2 wall clock inside the OutLayer TEE; unavailable time fails closed.

Fixed reasons: `kind_mismatch`, `spec_hash_mismatch`, `spec_invalid`, `clock_unavailable`, `blob_url_not_allowed`, `blob_token_missing`, `blob_fetch_fail`, `sha256_mismatch`, `blob_invalid`, `mcp_fetch_fail`, `mcp_invalid`, `mcp_error`, `order_id_mismatch`, `order_not_done`, `delivery_count`, `delivery_not_succeeded`, `brand_mismatch`, `country_mismatch`, `delivery_type_mismatch`, `denomination_mismatch`, `product_value_mismatch`, `beneficiary_mismatch`, `created_at_invalid`, `order_too_old`, and `created_at_in_future`. PINs, security codes, voucher/redeem URLs, order tokens, and bearer tokens never appear in result or errors.

## Environment, build, and live CLI

`PROOF_BLOB_TOKEN` supplies the blob bearer token at runtime. The exact URL must be the compiled `https://fulfil.junstudio.xyz/api/proof-blob/` prefix plus the lowercase proof hash. A nonempty `PROOF_BLOB_PREFIX` overrides the prefix and must be HTTPS with a trailing slash.

```bash
cargo test -p cryptorefills-verifier
cargo build -p cryptorefills-verifier --target wasm32-wasip2 --profile contract
cargo run -p cryptorefills-verifier --release -- --live --input input.json --blob-file blob.json
printf '%s' '+84901234567' | cargo run -p cryptorefills-verifier --release -- hash-beneficiary 0123456789abcdef0123456789abcdef
```

`hash-beneficiary` defaults to `by_phone`; pass `by_email` after the salt for an email. Invalid values return a nonzero exit status.

The native default reads a job from stdin, fetches its blob, and calls MCP. `--input` reads the job from a file. `--blob-file` reads local proof bytes while still checking SHA-256 and requires `--live`; it bypasses the blob URL/token check. Native runs without `--blob-file` also call MCP, as required by the default mode. Blob responses are capped at 64 KiB and MCP responses at 1 MiB; excess bytes, redirects, non-2xx responses, and transport errors fail closed. Native requests disable redirects and use a 20-second overall timeout. WASI requests set `wasi:http` connect, first-byte, and between-bytes limits (5 s, 10 s, and 5 s), with a 20-second elapsed deadline while reading. Automated tests inject HTTP responses and never run the CLI against the real API. Contract-profile WASM size: **463,893 bytes**.
