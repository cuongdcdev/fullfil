#!/usr/bin/env bash
# Run the official shopper bot (shopper.nearfullfil.near) with the repo .env loaded.
set -euo pipefail
cd "$(dirname "$0")/../.."
set -a; . ./.env; set +a
# pnpm --filter runs inside apps/shopper, so pin state to the repo data/ dir.
export SHOPPER_STATE_FILE="${SHOPPER_STATE_FILE:-$PWD/data/shopper-state.json}"
export FULFIL_API_URL="${FULFIL_API_URL:-https://fulfil.junstudio.xyz}"
exec pnpm --filter @fulfil/shopper start
