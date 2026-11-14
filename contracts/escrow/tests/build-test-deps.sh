#!/usr/bin/env bash
# Builds the wasm artifacts used by tests/sandbox.rs:
#   tests/res/defuse.wasm          near/intents defuse (= intents.near code), built locally
#   tests/res/fungible-token.wasm  NEP-141 mock USDC (near/intents releases/, near-sdk FT example)
#   tests/res/escrow-w10-9052688c.wasm  exact live W10 fixture (already prepared; not rebuilt here)
#   target/near/fulfil_escrow/fulfil_escrow.wasm
#   target/near/mock_outlayer/mock_outlayer.wasm   (TEST ONLY stub)
#
# Needs cargo-near >= 0.22 (older cargo-near refuses Rust >= 1.87, which defuse requires).
#   CARGO_NEAR=/path/to/cargo-near  DEFUSE_TOOLCHAIN=1.96.0  INTENTS_DIR=/tmp/intents  ./build-test-deps.sh
set -euo pipefail

HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=$(cd "$HERE/../../.." && pwd)
CARGO_NEAR=${CARGO_NEAR:-cargo-near}
# near/intents main as verified on 2026-11-07 (defuse 0.4.5)
INTENTS_REV=32cd1f9788a347908164fbcc56525dc6542f158f
INTENTS_DIR=${INTENTS_DIR:-${TMPDIR:-/tmp}/fulfil-near-intents}

mkdir -p "$HERE/res"
if [ ! -d "$INTENTS_DIR/.git" ]; then
  git init -q "$INTENTS_DIR"
  git -C "$INTENTS_DIR" remote add origin https://github.com/near/intents.git
fi
git -C "$INTENTS_DIR" fetch -q --depth 1 origin "$INTENTS_REV"
git -C "$INTENTS_DIR" checkout -q FETCH_HEAD

(cd "$INTENTS_DIR/contracts/defuse" &&
  RUSTUP_TOOLCHAIN="${DEFUSE_TOOLCHAIN:-stable}" "$CARGO_NEAR" near build non-reproducible-wasm \
    --locked --features=contract --no-abi)
cp "$INTENTS_DIR/target/near/defuse/defuse.wasm" "$HERE/res/defuse.wasm"
cp "$INTENTS_DIR/releases/fungible-token.wasm" "$HERE/res/fungible-token.wasm"

(cd "$ROOT/contracts/escrow" && "$CARGO_NEAR" near build non-reproducible-wasm --profile contract --no-embed-abi)

# v2 escrow = the exact code currently deployed at nearfullfil.near.
OLD_SHA=d57db193aae677cdbf0b8d0f3ad0892f9a8811f3e4a56f5a8f007a9c9f92ae59
OLD="$HERE/res/escrow-c0740f2.wasm"
if ! echo "$OLD_SHA  $OLD" | sha256sum -c --status - 2>/dev/null; then
  OLD_SRC=$(mktemp -d)
  git -C "$ROOT" archive c0740f2 | tar -x -C "$OLD_SRC"
  (cd "$OLD_SRC/contracts/escrow" && "$CARGO_NEAR" near build non-reproducible-wasm --profile contract --no-embed-abi)
  cp "$OLD_SRC/target/near/fulfil_escrow/fulfil_escrow.wasm" "$OLD"
  rm -rf "$OLD_SRC"
  echo "$OLD_SHA  $OLD" | sha256sum -c -
fi
(cd "$ROOT/contracts/test-stubs/mock-outlayer" && "$CARGO_NEAR" near build non-reproducible-wasm --profile contract --no-embed-abi)

ls -l "$HERE/res" "$ROOT/target/near/fulfil_escrow/fulfil_escrow.wasm" "$ROOT/target/near/mock_outlayer/mock_outlayer.wasm"
