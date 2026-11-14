#!/usr/bin/env bash
# Start the web app in v3 live mode on :${PORT:-3200} (served publicly through the fulfil-mvp tunnel).
# MODE=dev (default) uses `next dev`; MODE=prod builds into .next-prod and runs `next start`.
set -euo pipefail
cd "$(dirname "$0")/../.."
set -a; . ./.env; set +a
PORT="${PORT:-3200}"
cd apps/web
if [ "${MODE:-dev}" = "prod" ]; then
  export NEXT_DIST_DIR="${NEXT_DIST_DIR:-.next-prod}" NODE_ENV=production
  [ "${SKIP_BUILD:-0}" = "1" ] || npx next build
  exec npx next start -p "$PORT" --hostname "${HOST:-0.0.0.0}"
fi
exec npx next dev -p "$PORT" --hostname "${HOST:-0.0.0.0}"
