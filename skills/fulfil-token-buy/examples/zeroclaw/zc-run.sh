#!/usr/bin/env bash
# One-shot ZeroClaw run for the Fulfil fulfiller agent.
#   zc-run.sh "<prompt>"
# Reads LLM_API_URL (base URL without /v1), LLM_API_KEY and LLM_MODEL from
# $FULFIL_AGENT_HOME/llm.env (chmod 600). Secrets travel only through the environment.
set -euo pipefail
AGENT_HOME="${FULFIL_AGENT_HOME:-$HOME/fulfil-agent}"
[ -s "$HOME/.nvm/nvm.sh" ] && source "$HOME/.nvm/nvm.sh" >/dev/null 2>&1 || true
set -a; source "$AGENT_HOME/llm.env"; set +a
export ZEROCLAW_providers__models__custom__llm__uri="${LLM_API_URL%/}/v1"
export ZEROCLAW_providers__models__custom__llm__api_key="$LLM_API_KEY"
export ZEROCLAW_providers__models__custom__llm__model="$LLM_MODEL"
unset LLM_API_KEY
: "${NEAR_ACCOUNT_ID:?set NEAR_ACCOUNT_ID}"
export NEAR_ACCOUNT_ID
exec "${ZEROCLAW_BIN:-$HOME/.local/bin/zeroclaw}" ${ZC_VERBOSE:+-v} agent -a fulfiller -m "$1"
