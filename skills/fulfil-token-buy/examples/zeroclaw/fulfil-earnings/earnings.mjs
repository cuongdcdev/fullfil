#!/usr/bin/env node
// Read-only earnings report for a Fulfil fulfiller agent. No keys, no writes.
// Usage: node earnings.mjs [--account hermes-fulfiller.near] [--tz-offset 7]
const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : dflt; };
const ACCOUNT = opt("account", process.env.NEAR_ACCOUNT_ID || "hermes-fulfiller.near");
const TZ = Number(opt("tz-offset", "7"));
const ESCROW = process.env.FULFIL_ESCROW_CONTRACT || "nearfullfil.near";
const USDC = "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1";
const RPCS = (process.env.NEAR_RPC_URLS || "https://free.rpc.fastnear.com,https://rpc.intea.rs,https://rpc.shitzuapes.xyz,https://archival-rpc.mainnet.near.org").split(",");

async function rpc(params) {
  let last;
  for (const url of RPCS) {
    try {
      const r = await fetch(url.trim(), { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "query", params: { finality: "final", ...params } }),
        signal: AbortSignal.timeout(8000) });
      const j = await r.json();
      if (j.result && !j.result.error) return j.result;
      last = new Error(JSON.stringify(j.error || j.result?.error).slice(0, 200));
    } catch (e) { last = e; }
  }
  throw last;
}
const view = async (contract, method, a) => {
  const r = await rpc({ request_type: "call_function", account_id: contract, method_name: method,
    args_base64: Buffer.from(JSON.stringify(a)).toString("base64") });
  return JSON.parse(Buffer.from(r.result).toString());
};
const usd = (u) => (Number(BigInt(u)) / 1e6).toFixed(2);

const startOfToday = (() => {
  const now = Date.now() + TZ * 3600e3;
  return BigInt(Math.floor(now / 86400e3) * 86400e3 - TZ * 3600e3) * 1_000_000n;
})();

const paid = [];
for (let from = 0; ; from += 100) {
  const page = await view(ESCROW, "list_orders", { status: "paid", from, limit: 100, kind: "token_buy" });
  paid.push(...page.filter((o) => o.fulfiller === ACCOUNT));
  if (page.length < 100) break;
}
const today = paid.filter((o) => o.paid_at && BigInt(o.paid_at) >= startOfToday);
const sum = (list, f) => list.reduce((a, o) => a + BigInt(o[f] || 0), 0n);
const [profile, wallet, intents, acct] = await Promise.all([
  view(ESCROW, "get_profile", { account_id: ACCOUNT }),
  view(USDC, "ft_balance_of", { account_id: ACCOUNT }),
  view("intents.near", "mt_balance_of", { account_id: ACCOUNT, token_id: `nep141:${USDC}` }),
  rpc({ request_type: "view_account", account_id: ACCOUNT }),
]);
const last = paid.sort((a, b) => Number(BigInt(b.paid_at) - BigInt(a.paid_at)))[0];
console.log(JSON.stringify({
  ok: true,
  account: ACCOUNT,
  today: {
    orders_paid: today.length,
    received_usdc: usd(sum(today, "pay_amount") + sum(today, "reward")),
    reward_usdc: usd(sum(today, "reward")),
  },
  all_time_token_buy: {
    orders_paid: paid.length,
    received_usdc: usd(sum(paid, "pay_amount") + sum(paid, "reward")),
    reward_usdc: usd(sum(paid, "reward")),
  },
  jobs_done_all_kinds: profile.stats?.jobs_done ?? 0,
  balances: { usdc_wallet: usd(wallet), usdc_intents: usd(intents), near: (Number(BigInt(acct.amount) / 10n ** 20n) / 1e4).toFixed(3) },
  last_order: last ? { id: last.id, paid_at: new Date(Number(BigInt(last.paid_at) / 1_000_000n)).toISOString() } : null,
  note: "received = pay_amount + reward credited by the escrow; the agent spent roughly pay_amount buying the token, so profit ~ reward + slippage savings - gas",
}));
