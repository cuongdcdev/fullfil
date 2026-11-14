# Autonomous fulfiller with ZeroClaw

This example runs the `fulfil-token-buy` skill as an unattended agent on a Linux
server. It has two parts:

- **`poller.mjs`** runs under pm2. Every 5 seconds it calls
  `node fulfil-agent.mjs orders`. That call is read-only and makes no LLM request.
  When it finds an order that is claimable, not your own and estimated to be
  profitable, it starts one agent run for the most profitable order.
- **[ZeroClaw](https://github.com/zeroclaw-labs/zeroclaw)** runs that agent. It
  makes a single non-interactive call (`zeroclaw agent -a fulfiller -m "..."`).
  The agent follows the skill end to end: setup check, quote, claim, buy,
  deliver, prove and status. It then reports the transaction hashes.

The shell tool is locked down. The agent can run `node` and nothing else. It
gets only `NEAR_ACCOUNT_ID`, `FULFIL_API` and `HOME` from the environment. File
access is limited to its workspace and the skill folder. No approval prompts
appear, so the run needs no human.

| File | Purpose |
| --- | --- |
| `poller.mjs`, `poller-lib.mjs` | Discovery loop, float maintenance, claim release, lock, timeout, re-trigger guard, JSON log. Zero dependencies, Node 20 or newer. |
| `zc-run.sh` | One-shot launcher. It loads `llm.env` and passes the endpoint and key to ZeroClaw through env overrides. |
| `config.toml.example` | ZeroClaw config template with placeholders and no secrets. |
| `AGENTS.md.example` | Operating rules placed in the agent workspace and injected into its prompt. |

## Setup

These steps assume the skill lives at `<SKILL_DIR>`. The state directory is `<AGENT_HOME>`, by default
`~/fulfil-agent`.

1. **Wallet and skill.** Put the fulfiller key in
   `~/.near-credentials/mainnet/<account>.json`. Then run
   `NEAR_ACCOUNT_ID=<account> node <SKILL_DIR>/fulfil-agent.mjs setup` once.
   `setup --dry-run` must report both steps as registered.
2. **Install ZeroClaw** from the prebuilt release binary. Download the tarball
   for your platform and `SHA256SUMS` from the
   [latest release](https://github.com/zeroclaw-labs/zeroclaw/releases). Verify
   the checksum, then run `install -m 755 zeroclaw ~/.local/bin/zeroclaw`. The
   `install.sh --prebuilt` script does the same thing. Flags such as
   `--cli-only` or `--apps` switch it to a source build.
3. **LLM credentials.** Create `<AGENT_HOME>/llm.env` with `chmod 600`.
   `LLM_API_URL` is the base URL; the launcher appends `/v1`.
   ```sh
   LLM_API_URL=https://your-openai-compatible-gateway.example
   LLM_API_KEY=...
   LLM_MODEL=vendor/model-id
   ```
   The model must support native tool calling.
4. **Config.** Copy `config.toml.example` to `~/.zeroclaw/config.toml`, replace
   `<SKILL_DIR>` and `<AGENT_HOME>`, then run `chmod 600`.
5. **Skill bundle.** Run
   `mkdir -p ~/.zeroclaw/shared/skills/fulfil && ln -sfn <SKILL_DIR> ~/.zeroclaw/shared/skills/fulfil/fulfil-token-buy`.
   The symlink means a redeploy of the skill takes effect without copying.
   `zeroclaw skills list` should show `fulfil-token-buy` under `[bundle: fulfil]`.
6. **Workspace rules.** Copy `AGENTS.md.example` to `<AGENT_HOME>/workspace/AGENTS.md`
   and replace `<SKILL_DIR>`.
7. **Smoke test.** Both commands are read-only.
   ```sh
   cp zc-run.sh poller.mjs poller-lib.mjs <AGENT_HOME>/
   NEAR_ACCOUNT_ID=<account> <AGENT_HOME>/zc-run.sh "Reply with exactly: pong"
   NEAR_ACCOUNT_ID=<account> <AGENT_HOME>/zc-run.sh "Using the fulfil-token-buy skill, run \`node fulfil-agent.mjs run --dry-run\` and report the JSON"
   ```
   Set `ZC_VERBOSE=1` to see each tool call.
8. **Poller.**
   ```sh
   NEAR_ACCOUNT_ID=<account> FULFIL_SKILL_DIR=<SKILL_DIR> FULFIL_AGENT_HOME=<AGENT_HOME> \
     pm2 start <AGENT_HOME>/poller.mjs --name fulfil-agent-poller --time --kill-timeout 15000
   pm2 save
   ```

## Poller behaviour

- When no orders are found, the poller logs nothing. Each poll that finds orders
  appends one JSON line to `<AGENT_HOME>/agent.log`. If the picture has not
  changed, it logs again at most once a minute. Each agent run logs
  `agent_start` and `agent_end`. The `agent_end` line carries the exit code,
  timeout flag, duration, the agent's final JSON report (with tx hashes), and the
  on-chain status read back after the run. The full output of each run goes to
  `<AGENT_HOME>/runs/`.
- Only one run happens at a time, guarded by `<AGENT_HOME>/agent.lock`. A lock
  left by a dead process is cleared automatically. Polling pauses while a run is
  in progress.
- A run that exceeds `RUN_TIMEOUT_MS` (15 minutes) has its whole process group
  killed.
- The same order id is not started again within `RETRIGGER_MS` (20 minutes),
  even across restarts. The guard is stored in `poller-state.json`.
- After two consecutive failed polls (HTTP 429, 5xx, RPC failures and so on),
  the poll interval backs off to `BACKOFF_MS` (30 seconds).
- `agent.log` rotates to `agent.log.1` at `LOG_MAX_BYTES` (5 MB).
- Every `FLOAT_CHECK_MS` (default 600000 ms) and before an agent run, the poller
  calls `balances`. When wallet USDC is below `FLOAT_MIN_USDC` (default 1500000
  base units) and intents USDC is positive, it calls `withdraw --all`. It logs
  `auto_withdraw` or `float_check_error`; failures do not stop polling.
- After an agent run, the poller checks `status`. It calls `release` after a
  timeout, failure or unsuccessful report only when our claim remains active
  and there is no delivery evidence. A delivery hash in `status`, a deliver CLI
  result or invocation in the captured run output, a report that suggests a
  transaction, or truncated output prevents release and logs
  `auto_release_skipped`. Failed status reads never trigger release. The API
  stores `delivery_tx_hash` only after `prove`, so a transfer can have happened
  while `status.delivery_tx_hash` is still null.
- No secrets are logged. The poller invokes the CLI for withdrawals and
  releases; the CLI performs signing and submission.

## Gotchas

- The CLI also works through a symlinked skill directory.
- The shell policy rejects `cd`, `&&`, `VAR=value cmd`, pipes and redirects.
  That is why the CLI is called by its absolute path and `NEAR_ACCOUNT_ID` is
  passed through the environment.
- If a run is killed after delivery, inspect its run log and the transfer on
  chain before any manual release. If the delivery happened, run
  `prove <id> <delivery_tx_hash>` to complete the order. The poller skips
  release when its captured output suggests a delivery, but a missing or
  incomplete run log cannot prove that no transfer happened.
