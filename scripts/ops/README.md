# Mainnet ops helper (PM only)

`nearops.cjs` signs with keys from `~/.near-credentials/mainnet/<account>.json` (never printed). It needs `near-api-js@5`; install it in a scratch dir (`npm i near-api-js@5`) and run it from there. Subagents must not run it: mainnet writes are PM-only.
