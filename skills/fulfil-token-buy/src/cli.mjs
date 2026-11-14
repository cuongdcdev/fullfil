import { homedir } from "node:os";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { FulfilApi } from "./api.mjs";
import { Commands } from "./commands.mjs";
import { AgentError, decimal, fail } from "./common.mjs";
import { IntearRouter } from "./intear.mjs";
import { loadSigner } from "./keys.mjs";
import { NearRpc, parseRpcUrls } from "./rpc.mjs";

const USAGE = "node fulfil-agent.mjs <setup|orders|quote|claim|buy|deliver|prove|status|release|run|balances|withdraw> [args] [--amount <base units>|--all] [--dry-run] [--json]";

export function parseArgs(argv) {
  let amount;
  const normalized = [];
  for (let index = 0; index < argv.length; index++) {
    if (argv[index] === "--amount") {
      amount = argv[++index];
      if (!amount) fail("usage", "--amount requires a base-unit integer");
    } else if (argv[index].startsWith("--amount=")) {
      amount = argv[index].slice(9);
    } else {
      normalized.push(argv[index]);
    }
  }
  const flags = new Set(normalized.filter((arg) => arg.startsWith("--")));
  if ([...flags].some((flag) => !["--dry-run", "--json", "--help", "--all"].includes(flag))) fail("usage", USAGE);
  const args = normalized.filter((arg) => !arg.startsWith("--"));
  return { command: args[0] || "help", params: args.slice(1), amount, all: flags.has("--all"),
    dryRun: flags.has("--dry-run"), help: flags.has("--help") };
}

export async function main(argv = process.argv.slice(2), env = process.env, deps = {}) {
  const { command, params, amount, all, dryRun, help } = parseArgs(argv);
  if (help || command === "help") return { ok: true, usage: USAGE, node: ">=20", commands: ["setup", "orders", "quote", "claim", "buy", "deliver", "prove", "status", "release", "run", "balances", "withdraw"] };
  if (!env.NEAR_ACCOUNT_ID) fail("missing_account", "NEAR_ACCOUNT_ID is required");
  const expectedArgs = { setup: 0, orders: 0, quote: 1, claim: 1, buy: 1, deliver: 1, prove: 2, status: 1, release: 1, run: 0, balances: 0, withdraw: 0 };
  if (!(command in expectedArgs) || params.length !== expectedArgs[command] ||
      (amount !== undefined && !["deliver", "withdraw"].includes(command)) ||
      (all && command !== "withdraw") || (all && amount !== undefined)) fail("usage", USAGE);
  if (dryRun && !["setup", "run", "orders", "quote", "status", "balances", "withdraw"].includes(command)) fail("usage", "--dry-run is supported for setup, run, withdraw and read-only commands");
  const minProfit = decimal(env.FULFIL_MIN_PROFIT_USDC || "0", "FULFIL_MIN_PROFIT_USDC").toString();
  const margin = Number(env.FULFIL_DEADLINE_MARGIN_SECONDS || "120");
  if (!Number.isSafeInteger(margin) || margin < 0) fail("invalid_config", "Invalid deadline margin");
  // Read-only commands may need an off-chain NEP-413 login to access order data.
  const signer = await (deps.loadSigner || loadSigner)(env.NEAR_ACCOUNT_ID, env, deps.home || homedir());
  const api = deps.api || new FulfilApi({ baseUrl: env.FULFIL_API || "https://fulfil.junstudio.xyz",
    accountId: env.NEAR_ACCOUNT_ID, signer, fetchImpl: deps.fetchImpl || fetch,
    escrowContract: env.FULFIL_ESCROW_CONTRACT || "nearfullfil.near" });
  if (api.loadCookie) await api.loadCookie();
  const rpc = deps.rpc || new NearRpc({ urls: parseRpcUrls(env.NEAR_RPC_URLS), fetchImpl: deps.fetchImpl || fetch });
  const router = deps.router || new IntearRouter({ fetchImpl: deps.fetchImpl || fetch,
    slippage: env.FULFIL_SLIPPAGE || "0.03" });
  const commands = deps.commands || new Commands({ accountId: env.NEAR_ACCOUNT_ID, signer, api, rpc, router,
    escrowContract: env.FULFIL_ESCROW_CONTRACT || "nearfullfil.near", minProfit,
    deadlineMarginSeconds: margin });
  const operations = {
    setup: () => commands.setup(dryRun),
    orders: () => commands.orders(), quote: () => commands.quote(params[0]),
    claim: () => commands.claim(params[0]), buy: () => commands.buy(params[0]),
    deliver: () => commands.deliver(params[0], amount),
    prove: () => commands.prove(params[0], params[1]),
    status: () => commands.status(params[0]), release: () => commands.release(params[0]),
    run: () => commands.run(dryRun),
    balances: () => commands.balances(),
    withdraw: () => commands.withdrawToWallet(amount ?? null, dryRun),
  };
  return { ok: true, ...(await operations[command]()) };
}

export async function runCli(argv = process.argv.slice(2), env = process.env,
  write = (line) => process.stdout.write(line), deps = {}) {
  const stdoutWrite = process.stdout.write;
  const stderrWrite = process.stderr.write;
  process.stdout.write = () => true;
  process.stderr.write = () => true;
  let result;
  let exitCode = 0;
  try {
    result = await main(argv, env, deps);
  } catch (error) {
    const code = error instanceof AgentError ? error.code : "unexpected_error";
    const message = error instanceof AgentError ? error.message : "Unexpected failure; check configuration and connectivity";
    const http_status = error instanceof AgentError ? error.http_status : undefined;
    result = { ok: false, error: { code, message, ...(http_status ? { http_status } : {}) } };
    exitCode = 1;
  } finally {
    process.stdout.write = stdoutWrite;
    process.stderr.write = stderrWrite;
  }
  write(`${JSON.stringify(result)}\n`);
  return exitCode;
}

let isMain = false;
try {
  isMain = Boolean(process.argv[1]) && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]);
} catch {
  // An imported module or a missing argv path is not the CLI entry point.
}
if (isMain) {
  runCli().then((code) => { process.exitCode = code; });
}
