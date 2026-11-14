import { createHash } from "node:crypto";
import {
  Account, actions, baseEncode, base64Encode, encodeTransaction,
  JsonRpcProvider,
} from "near-api-js";
import { FungibleToken } from "near-api-js/tokens";
import { USDC } from "near-api-js/tokens/mainnet";
import { AgentError, decimal, fail, USER_AGENT, USDC_CONTRACT } from "./common.mjs";

export const DEFAULT_RPC_URLS = [
  "https://free.rpc.fastnear.com",
  "https://rpc.intea.rs",
  "https://rpc.shitzuapes.xyz",
  "https://archival-rpc.mainnet.near.org",
];

export function parseRpcUrls(value) {
  if (value === undefined || value === "") return [...DEFAULT_RPC_URLS];
  const urls = value.split(",").map((part) => part.trim());
  if (!urls.length || urls.some((part) => !part || !/^https?:\/\//.test(part))) {
    fail("invalid_config", "Invalid NEAR_RPC_URLS");
  }
  return urls;
}

function isTransientRpcError(error) {
  const details = JSON.stringify(error).toLowerCase();
  return /timeout|timed.out|internal|server.error|unavailable|too.many.requests|temporar|429|502|503|504/.test(details);
}

function rpcProblem(problem) {
  const message = typeof problem?.message === "string" ? problem.message : "JSON-RPC error";
  const error = new AgentError("rpc_error", `NEAR RPC: ${message}`);
  error.transient = isTransientRpcError(problem);
  error.unsupported = /method not found|unknown method/i.test(JSON.stringify(problem));
  return error;
}

// JsonRpcProvider's built-in HTTP has no timeout or injectable fetch. Override only
// its transport; its typed view and signed-transaction methods remain in use.
class TimedJsonRpcProvider extends JsonRpcProvider {
  constructor(url, fetchImpl, timeoutMs) {
    super({ url, headers: { "User-Agent": USER_AGENT } }, { retries: 0, wait: 0, backoff: 1 });
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
  }

  async sendJsonRpc(method, params) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      let response;
      try {
        response = await this.fetchImpl(this.connection.url, {
          method: "POST",
          signal: controller.signal,
          headers: { ...this.connection.headers, "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: "fulfil-agent", method, params }),
        });
      } catch {
        const error = new AgentError(controller.signal.aborted ? "rpc_timeout" : "rpc_network", "NEAR RPC request failed");
        error.transient = true;
        throw error;
      }
      if (!response.ok) {
        const error = new AgentError(`rpc_http_${response.status}`, `NEAR RPC HTTP ${response.status}`);
        error.transient = response.status === 429 || response.status === 408 || response.status >= 500;
        throw error;
      }
      let payload;
      try {
        payload = await response.json();
      } catch {
        const code = controller.signal.aborted ? "rpc_timeout" : "rpc_response";
        const error = new AgentError(code, "Invalid or timed-out NEAR RPC response");
        error.transient = true;
        throw error;
      }
      if (payload.error) throw rpcProblem(payload.error);
      if (payload.result === undefined) {
        const error = new AgentError("rpc_response", "NEAR RPC omitted result");
        error.transient = true;
        throw error;
      }
      return payload.result;
    } finally {
      clearTimeout(timeout);
    }
  }
}

export class NearRpc {
  constructor({ urls = DEFAULT_RPC_URLS, fetchImpl = fetch, timeoutMs = 12_000 } = {}) {
    this.urls = urls;
    this.providers = urls.map((url) => new TimedJsonRpcProvider(url, fetchImpl, timeoutMs));
    this.cursor = 0;
    this.tokens = new Map([[USDC_CONTRACT, USDC]]);
  }

  async withProvider(operation) {
    let lastError;
    for (let attempt = 0; attempt < this.providers.length; attempt++) {
      const index = (this.cursor + attempt) % this.providers.length;
      try {
        const result = await operation(this.providers[index]);
        this.cursor = index;
        return result;
      } catch (error) {
        if (!error?.transient) throw error;
        lastError = error;
      }
    }
    throw new AgentError("rpc_unavailable", `All NEAR RPC endpoints failed: ${lastError?.code || "network error"}`);
  }

  async call(method, params) {
    return this.withProvider((provider) => provider.sendJsonRpc(method, params));
  }

  async callFunction(params) {
    return this.withProvider((provider) => provider.callFunction({
      ...params, blockQuery: { finality: "final" },
    }));
  }

  async view(contract, method, args) {
    return this.callFunction({ contractId: contract, method, args });
  }

  async viewAccessKey(params) {
    return this.withProvider((provider) => provider.viewAccessKey({
      ...params, finalityQuery: { finality: "final" },
    }));
  }

  async viewBlock(query) {
    return this.withProvider((provider) => provider.viewBlock(query));
  }

  async viewAccount(accountId) {
    return this.call("query", { request_type: "view_account", finality: "final", account_id: accountId });
  }

  async sendTransactionUntil(signedTransaction, waitUntil) {
    return this.withProvider(async (provider) => {
      try {
        return await provider.sendTransactionUntil(signedTransaction, waitUntil);
      } catch (error) {
        if (!error?.unsupported) throw error;
        const bytes = encodeTransaction(signedTransaction);
        return provider.sendJsonRpc("broadcast_tx_commit", [base64Encode(bytes)]);
      }
    });
  }

  async token(contract) {
    const cached = this.tokens.get(contract);
    if (cached) return cached;
    const metadata = await this.view(contract, "ft_metadata", {});
    if (!metadata || !Number.isSafeInteger(metadata.decimals) ||
        metadata.decimals < 0 || metadata.decimals > 255) {
      fail("invalid_token", "Invalid NEP-141 token metadata");
    }
    const token = new FungibleToken(contract, metadata);
    this.tokens.set(contract, token);
    return token;
  }

  async tokenBalance(contract, accountId) {
    const token = await this.token(contract);
    return token.getBalance({ accountId, provider: this });
  }

  async sendActions({ accountId, signer, receiverId, actions: requestedActions }) {
    const key = await this.viewAccessKey({ accountId, publicKey: signer.publicKey });
    if (key.permission !== "FullAccess") {
      fail("restricted_key", "NEAR key requires FullAccess permission");
    }
    const nativeActions = requestedActions.map((action) => {
      if (action.type === "FunctionCall") {
        return actions.functionCall(
          action.methodName,
          Buffer.from(action.args),
          decimal(action.gas, "gas", (1n << 64n) - 1n),
          decimal(action.deposit, "deposit"),
        );
      }
      if (action.type === "Transfer") {
        return actions.transfer(decimal(action.deposit, "deposit"));
      }
      fail("unsupported_action", "Only FunctionCall and Transfer are supported");
    });
    const account = new Account(accountId, this, signer.keyPairSigner);
    const signed = await account.createSignedTransaction({ receiverId, actions: nativeActions });
    const hash = baseEncode(createHash("sha256").update(encodeTransaction(signed.transaction)).digest());
    const result = await this.sendTransactionUntil(signed, "FINAL");
    if (!result?.status || result.status.Failure ||
        !(result.status.SuccessValue !== undefined || result.status.SuccessReceiptId !== undefined)) {
      fail("transaction_failed", `NEAR transaction did not succeed: ${hash}`);
    }
    return { tx_hash: result.transaction?.hash || hash, result };
  }
}
