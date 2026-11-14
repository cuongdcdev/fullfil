# Mainnet attack tests and security incidents

Real attacks run against the live escrow `nearfullfil.near` on NEAR mainnet with real USDC. Every tx hash can be checked on <https://nearblocks.io>. The misuse matrix behind these tests is [RED_TEAM_REVIEW.md](RED_TEAM_REVIEW.md).

## Live attacks on mainnet (2026-11-08, escrow ca2fff3c, procedure in [RED_TEAM_REVIEW.md](RED_TEAM_REVIEW.md) §3)
Buyer kent-user1.near, rogue fulfiller fullfiller1.near (level 0), official bot shopper.nearfullfil.near (bot paused during tests). Synthetic beneficiary +84901234567 / synthetic@example.test; no purchase made. Kent intents USDC before and after all tests: **11.335577** (every order fully refunded; cost = relayer gas + ≤0.01 NEAR OutLayer for 2 rejected proofs).

| # | Attack | Order | Evidence tx | Result |
|---|---|---|---|---|
| S1 | Rogue fulfiller claims inside quoter's 2-min exclusive window | FUL-36CB02EA | 9niicRqMR4Ryknog2trs7uB8jF95kFyrvuibmysVuVaQ | **rejected `quote exclusive`** |
| S4 | Buyer cancels while order claimed | FUL-36CB02EA | 38cLhfTX7qPepVKiWaZL7xhaa7bkVMyd81zUpyKzjyeX | **rejected `not cancellable`**; after bot release_claim (GyrsgjtgB…) cancel refunded exactly 0.969397 (7n13s6iuq…); second cancel `order not found` |
| S3 | Fulfiller submits proof with tampered spec, signed raw to intents.near `execute_intents` (bypassing backend/relayer) | FUL-36CB02EA | 3cQeEbDi54RQKP5RaTWZLLH6wqukCJpbttSrTNWGbcKK | **rejected `spec hash mismatch`** (backend path also refuses non-issued payloads: 409) |
| S2 | Rogue fulfiller claims gift-card (allowlist kind) order after exclusive window | FUL-AA1FF0B3 | H4Vvg9pzGUeKouDTGfdr52JfK3xNu46AAyxxvqdKcc9r | **rejected `fulfiller not allowed`**; buyer cancel refunded (CxeMzzhC…) |
| S6 | Fulfiller replays a real, delivered Cryptorefills order (FUL-9F6386AD's) as proof for another phone | FUL-934C73FD | ArafP2GqutSSxnus29yv711eim4mLjre5JoG2TXpLSnV | **TEE worker `beneficiary_mismatch`**, status proof_rejected, no payout; release + cancel refunded |
| S7 | Level-0 fulfiller holds 2 open claims | FUL-909A54F7 / FUL-E1DE0E57 | claim A 9NSvTH9M…, claim B rejected | **rejected `claim limit`** |
| S8 | Released order left funded; `expire` before / after deadline | FUL-909A54F7 | early: `deadline not reached`; after: Gw8N2NEk7bN446NZAzX3Z3jKVYDWPqbA3C4eWxs45cxA | **permissionless refund after deadline**; repeat `order not found` |

S5 (old order replay → `order_too_old`) skipped: needs a maintainer's real phone as beneficiary.
Also verified offline: new strict cryptorefills-verifier (W9.8) still returns ok:true + same nullifier for the real paid order FUL-9F6386AD.

## Security review before deploy (2026-11-07)
Findings marked "fix before test": 1 (merchant identified by account only → gate fulfillers by maintainer approval for now), 2 (backend must bind fund intent to prepared order), 3 (arbiter = owner nearfullfil.near, not the relayer key), 8 (payout failure handling), 9 (proof allowed from Claimed), 11 (worker echoes order_id + proof_sha256), 12 (note normalisation). All were fixed before the first mainnet order.

## Incident 2026-11-10: email-verifier WASM missing on FastFS
| Finding | Evidence | Result |
|---|---|---|
| QR proof for FUL-2A6D0AEE (VPBank → MoMo PSP account, 10,000 VND) rejected twice with "bad worker output" | tx 4iujxM5KGvq3jmbaqvYPVmqWCD3sjkkAiJPkycpnUSJy, OutLayer log `wasm_url could not be fetched` | OutLayer returned null |
| Root cause: W9.8b (2026-11-08) deployed email-verifier dc16e5ae…abb but only one FastFS upload happened that day (6X5fAqre…, which was cryptorefills dacb9020…). The email WASM was never uploaded; the deploy referenced it by hash only | nearblocks `__fastdata_fastfs` history + archival RPC args | URL returned 404 |
| The maintainers re-uploaded the identical local build (target/wasm32-wasip2/contract/email-verifier.wasm, sha256 dc16e5ae…) | tx DAmkauJNdH1PHtF8McPhELUNVSg9ZucnMHxx2t8KSXnf | URL 200, 685,266 B |
| Rule: after every `outlayer deploy`, curl the version's FastFS URL and expect 200 before marking done; /status now checks verifier code availability | – | – |
| Manual arbiter resolve: FUL-2A6D0AEE was under_review after 3 rejections (2× missing WASM, 1× `note_missing_order_id` because VPBank/Napas rewrote the note as `FUL 2A6D0AEE`). Arbiter is `nearfullfil.near`; `resolve_dispute(verdict=fulfiller, note_hash=b109750b…5b60)` | tx 4CJPtWdBQowWyYU8wxmzekNJZWW7VbftsSrSLd6RwQyq | ok, 0.493701 USDC → fullfiller1.near |
| Deploy email-verifier with separator-tolerant order id match (`FUL 2A6D0AEE`, `FUL2A6D0AEE`); uploaded and deployed after the URL check returned 200 | sha256 b1e8f4f0…d9c9, 685,943 B | deployed |
