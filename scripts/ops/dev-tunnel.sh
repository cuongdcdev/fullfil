#!/usr/bin/env bash
# UI testing on the public domain: Next.js on :3104 (live mode, .env) + the
# fulfil-mvp cloudflared tunnel (fulfil.junstudio.xyz -> 127.0.0.1:3104).
#   pnpm dev:tunnel            # stops whatever Next server holds :3104, starts dev + tunnel
#   pnpm prod:tunnel           # builds production, starts prod + tunnel
# Ctrl+C stops the server and any tunnel this script started.
set -euo pipefail
cd "$(dirname "$0")/../.."
MODE="${MODE:-dev}"
case "$MODE" in
  dev|prod) ;;
  *) echo "unsupported MODE: $MODE (expected dev or prod)" >&2; exit 1 ;;
esac
PORT=3104
DOMAIN=fulfil.junstudio.xyz
TUNNEL_CONFIG="${TUNNEL_CONFIG:-$HOME/.cloudflared/fulfil-mvp.yml}"

[ -f .env ] || { echo "missing .env in $(pwd)" >&2; exit 1; }
command -v cloudflared >/dev/null || { echo "cloudflared not installed" >&2; exit 1; }
[ -f "$TUNNEL_CONFIG" ] || { echo "tunnel config not found: $TUNNEL_CONFIG" >&2; exit 1; }

# Free the port if another Next server (e.g. the prod build) is on it.
pids=$(ss -ltnpH "sport = :$PORT" 2>/dev/null | grep -o 'pid=[0-9]*' | cut -d= -f2 | sort -u || true)
for pid in $pids; do
  cmd=$(ps -o args= -p "$pid" 2>/dev/null || true)
  case "$cmd" in
    *next*) echo "stopping Next server on :$PORT (pid $pid)"; kill "$pid" ;;
    *) echo "port $PORT is used by a non-Next process (pid $pid: $cmd); stop it first" >&2; exit 1 ;;
  esac
done
for _ in $(seq 1 20); do ss -ltnH "sport = :$PORT" | grep -q . || break; sleep 0.5; done

# Reuse a running fulfil-mvp tunnel, otherwise start one and stop it on exit.
TUNNEL_PID=""
if pgrep -f "cloudflared --config $TUNNEL_CONFIG tunnel run" >/dev/null; then
  echo "tunnel already running"
else
  LOG="${TMPDIR:-/tmp}/fulfil-$MODE-tunnel.log"
  cloudflared --config "$TUNNEL_CONFIG" tunnel run fulfil-mvp >>"$LOG" 2>&1 &
  TUNNEL_PID=$!
  echo "tunnel started (pid $TUNNEL_PID, log $LOG)"
fi
cleanup() { [ -n "$TUNNEL_PID" ] && kill "$TUNNEL_PID" 2>/dev/null || true; }
trap cleanup EXIT INT TERM

echo "$MODE server -> http://127.0.0.1:$PORT  public -> https://$DOMAIN"
PORT="$PORT" MODE="$MODE" bash scripts/ops/run-live.sh
