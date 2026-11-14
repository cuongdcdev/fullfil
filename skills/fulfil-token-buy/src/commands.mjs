import { AgentError, decimal, fail, guardDeadline, parseSpec, STORAGE_DEPOSIT, USDC_CONTRACT } from "./common.mjs";
import { quoteProfit, parseInstructions } from "./intear.mjs";

const GAS_STORAGE = "30000000000000";
const GAS_TRANSFER = "30000000000000";
const INTENTS_CONTRACT = "intents.near";
const GAS_WITHDRAW = "50000000000000";

// Reserve 1% of worst-case route input, with a floor of 0.001 USDC.
export function requiredFloat(usdcIn) {
  const input = decimal(usdcIn, "route USDC input");
  const margin = (input + 99n) / 100n;
  return input + (margin > 1000n ? margin : 1000n);
}

function profileRegistered(value) {
  return value !== null && value?.profile !== null && value?.profile !== undefined;
}

export async function isStorageRegistered(rpc, contract, accountId) {
  let balance;
  try {
    balance = await rpc.view(contract, "storage_balance_of", { account_id: accountId });
  } catch (error) {
    fail("storage_check_failed", `Could not check storage registration for ${accountId} on ${contract}: ${error.message}`);
  }
  if (balance === null) return false;
  if (!balance || typeof balance.total !== "string" || !/^\d+$/.test(balance.total)) {
    fail("storage_check_failed", `Invalid storage balance for ${accountId} on ${contract}`);
  }
  return BigInt(balance.total) !== 0n;
}

export function buildDeliverActions(receiver, amount, storageDeposit = null, memo = "Fulfil token delivery") {
  if (typeof receiver !== "string" || !receiver) fail("invalid_receiver", "Invalid receiver");
  const units = decimal(amount, "delivery amount");
  if (units === 0n) fail("invalid_amount", "Delivery amount must be positive");
  const actions = [];
  if (storageDeposit !== null) {
    actions.push({
      type: "FunctionCall", methodName: "storage_deposit",
      args: Buffer.from(JSON.stringify({ account_id: receiver, registration_only: true })),
      gas: GAS_STORAGE, deposit: decimal(storageDeposit, "storage deposit").toString(),
    });
  }
  actions.push({
    type: "FunctionCall", methodName: "ft_transfer",
    args: Buffer.from(JSON.stringify({ receiver_id: receiver, amount: units.toString(), memo })),
    gas: GAS_TRANSFER, deposit: "1",
  });
  return actions;
}

export class Commands {
  constructor({ accountId, signer, api, rpc, router, escrowContract = "nearfullfil.near",
    minProfit = "0", deadlineMarginSeconds = 120, clock = Date.now,
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) }) {
    this.accountId = accountId;
    this.signer = signer;
    this.api = api;
    this.rpc = rpc;
    this.router = router;
    this.escrowContract = escrowContract;
    this.minProfit = minProfit;
    this.deadlineMarginSeconds = deadlineMarginSeconds;
    this.clock = clock;
    this.sleep = sleep;
  }

  async readOrderForPolling(id) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.getOrder(id, null, false);
      } catch (error) {
        if (error.code !== "order_mismatch" || attempt === 2) throw error;
        await this.sleep(3000);
      }
    }
  }

  async refreshSubmittedOrder(id, result, operation) {
    if (!result || result.status !== "success") return result;
    const original = result.order;
    let chain;
    for (let attempt = 0; attempt < 3; attempt++) {
      chain = undefined;
      try {
        chain = await this.rpc.view(this.escrowContract, "get_order", { id });
      } catch {
        // The intent succeeded; report an unavailable refresh without stale order data.
      }
      const advanced = operation === "claim"
        ? chain?.status === "claimed" && chain.fulfiller === this.accountId
        : chain && chain.status !== "claimed" && chain.status !== "proof_rejected";
      if (advanced) {
        if (operation === "prove" && original?.status === "paid" && chain.status !== "paid") {
          return result;
        }
        return { ...result, order: { ...original, ...chain } };
      }
      if (operation === "prove" && original?.status !== "claimed" &&
          original?.status !== "proof_rejected" && original?.status !== undefined) {
        return result;
      }
      if (attempt < 2) await this.sleep(3000);
    }
    // A repeated rejection leaves the chain at proof_rejected: report it rather than hide it.
    if (operation === "prove" && chain?.status === "proof_rejected") {
      return { ...result, order: { ...original, ...chain } };
    }
    const { order: _staleOrder, ...rest } = result;
    return { ...rest, order_refresh: "pending" };
  }

  async filterStorageActions(instruction) {
    const actions = [];
    for (const action of instruction.actions) {
      if (action.methodName !== "storage_deposit") {
        actions.push(action);
        continue;
      }
      let args;
      try {
        args = JSON.parse(action.args.toString("utf8"));
      } catch {
        fail("invalid_route", "Invalid storage_deposit arguments");
      }
      if (!args || typeof args !== "object" || Array.isArray(args) ||
          (args.account_id !== undefined && (typeof args.account_id !== "string" || !args.account_id))) {
        fail("invalid_route", "Invalid storage_deposit account_id");
      }
      const accountId = args.account_id ?? this.accountId;
      if (!await isStorageRegistered(this.rpc, instruction.receiverId, accountId)) actions.push(action);
    }
    return { ...instruction, actions };
  }

  async setupStatus() {
    const intentsKey = await this.rpc.view(INTENTS_CONTRACT, "has_public_key", {
      account_id: this.accountId, public_key: this.signer.publicKey,
    });
    if (typeof intentsKey !== "boolean") fail("invalid_setup", "Invalid intents.near key response");
    const profile = await this.rpc.view(this.escrowContract, "get_profile", { account_id: this.accountId });
    return { intentsKey, profileRegistered: profileRegistered(profile) };
  }

  async requireSetup() {
    const status = await this.setupStatus();
    const missing = [];
    if (!status.intentsKey) missing.push("intents.near public key");
    if (!status.profileRegistered) missing.push("fulfiller profile");
    if (missing.length) {
      fail("setup_required", `Missing ${missing.join(" and ")}; run node fulfil-agent.mjs setup`);
    }
  }

  async setup(dryRun = false) {
    const current = await this.setupStatus();
    const intents_key = { registered: current.intentsKey, action: current.intentsKey ? "none" : dryRun ? "would_add" : "added" };
    const fulfiller_profile = { registered: current.profileRegistered,
      action: current.profileRegistered ? "none" : dryRun ? "would_register" : "registered" };
    if (!dryRun && !current.intentsKey) {
      const sent = await this.rpc.sendActions({ accountId: this.accountId, signer: this.signer,
        receiverId: INTENTS_CONTRACT, actions: [{ type: "FunctionCall", methodName: "add_public_key",
          args: Buffer.from(JSON.stringify({ public_key: this.signer.publicKey })),
          gas: "30000000000000", deposit: "1" }] });
      intents_key.registered = true;
      intents_key.tx_hash = sent.tx_hash;
    }
    if (!dryRun && !current.profileRegistered) {
      const result = await this.api.authCall("register_fulfiller");
      fulfiller_profile.registered = true;
      if (result?.tx_hash) fulfiller_profile.tx_hash = result.tx_hash;
      if (result?.status) fulfiller_profile.status = result.status;
    }
    return { account_id: this.accountId, intents_key, fulfiller_profile };
  }

  async getOrder(id, listCandidate = null, requireSpec = true) {
    if (typeof id !== "string" || !/^[a-zA-Z0-9_-]+$/.test(id)) fail("invalid_order_id", "Invalid order ID");
    const chain = await this.rpc.view(this.escrowContract, "get_order", { id });
    if (!chain || chain.id !== id || chain.kind !== "token_buy") fail("order_missing", "Token-buy order not found on chain");
    const detail = await this.api.request("GET", `/orders/${id}`);
    const order = detail.order;
    if (!order || order.id !== id || order.kind !== chain.kind ||
        order.status !== chain.status || order.spec_hash !== chain.spec_hash ||
        order.fulfiller !== chain.fulfiller || order.deadline_ns !== chain.deadline_ns ||
        order.buyer !== chain.buyer || order.pay_amount !== chain.pay_amount ||
        order.reward !== chain.reward) fail("order_mismatch", "API order differs from chain order");
    let specValue = order.spec ?? listCandidate?.spec;
    if (requireSpec && specValue === undefined) {
      let from;
      for (let page = 0; page < 10 && specValue === undefined; page++) {
        const params = new URLSearchParams({ kind: "token_buy", status: chain.status, limit: "100" });
        if (from) params.set("from", from);
        const list = await this.api.request("GET", `/orders?${params}`);
        if (!Array.isArray(list.orders)) fail("invalid_orders", "API order list is invalid");
        specValue = list.orders.find((item) => item.id === id)?.spec;
        if (!list.next_from || list.next_from === from) break;
        from = list.next_from;
      }
    }
    const { spec, canonical } = requireSpec ? parseSpec(specValue, chain.spec_hash) : { spec: null, canonical: null };
    return { chain, order, spec, canonical };
  }

  async orders() {
    const list = await this.api.request("GET", "/orders?status=funded&kind=token_buy");
    if (!Array.isArray(list.orders)) fail("invalid_orders", "API order list is invalid");
    const orders = [];
    for (const candidate of list.orders) {
      try {
        const { chain, order, spec } = await this.getOrder(candidate.id, candidate);
        if (chain.status !== "funded") continue;
        const own_order = chain.buyer === this.accountId;
        let deadlineSafe = true;
        try {
          guardDeadline(chain, this.deadlineMarginSeconds, this.clock());
        } catch {
          deadlineSafe = false;
        }
        let estimate = null;
        if (!own_order) {
          try {
            const route = await this.router.quote(spec, this.accountId);
            estimate = { dex_id: route.dex_id, ...quoteProfit(chain, route, this.minProfit) };
          } catch (error) {
            estimate = { error: error.code || "quote_failed" };
          }
        }
        orders.push({ id: chain.id, buy_token: order.buy_token || candidate.buy_token || null,
          delivery_tx_hash: order.delivery_tx_hash || candidate.delivery_tx_hash || null, spec,
          pay_amount: chain.pay_amount, reward: chain.reward, deadline_ns: chain.deadline_ns,
          own_order, claimable: !own_order && deadlineSafe, estimate });
      } catch (error) {
        orders.push({ id: candidate.id, error: error.code || "order_unavailable" });
      }
    }
    return { orders, next_from: list.next_from || null };
  }

  async quote(id) {
    const { chain, spec } = await this.getOrder(id);
    if (chain.status !== "funded" && chain.status !== "claimed") fail("wrong_status", "Order is not available for a quote");
    const route = await this.router.quote(spec, this.accountId);
    return { order_id: id, token_contract: spec.token_contract, amount_out: spec.amount_out,
      dex_id: route.dex_id, ...quoteProfit(chain, route, this.minProfit), route };
  }

  async claim(id) {
    const { chain } = await this.getOrder(id, null, false);
    if (chain.buyer === this.accountId) fail("own_order", "Cannot claim your own order");
    if (chain.status !== "funded") fail("wrong_status", "Order is not funded on chain");
    guardDeadline(chain, this.deadlineMarginSeconds, this.clock());
    await this.requireSetup();
    const profile = await this.rpc.view(this.escrowContract, "get_profile", { account_id: this.accountId });
    if (Number(profile?.stats?.active_claims ?? 0) > 0) {
      fail("active_claim", "Release the existing claim before claiming another order");
    }
    const result = await this.refreshSubmittedOrder(id, await this.api.authCall("claim", id), "claim");
    return { order_id: id, operation: "claim", result };
  }

  async ownedClaim(id, allowedStatuses = ["claimed"]) {
    const details = await this.getOrder(id);
    if (details.chain.buyer === this.accountId) fail("own_order", "Cannot fulfil your own order");
    if (!allowedStatuses.includes(details.chain.status) || details.chain.fulfiller !== this.accountId) {
      fail("not_claimed", "Order is not claimed by this account");
    }
    guardDeadline(details.chain, this.deadlineMarginSeconds, this.clock());
    return details;
  }

  async tokenBalance(spec) {
    const balance = await this.rpc.tokenBalance(spec.token_contract, this.accountId);
    return decimal(balance, "token balance");
  }

  async usdcBalances() {
    const [wallet, intents] = await Promise.all([
      this.rpc.tokenBalance(USDC_CONTRACT, this.accountId),
      this.rpc.view(INTENTS_CONTRACT, "mt_balance_of", {
        account_id: this.accountId, token_id: `nep141:${USDC_CONTRACT}`,
      }),
    ]);
    return { wallet: decimal(wallet, "wallet USDC"), intents: decimal(intents, "intents USDC") };
  }

  async balances() {
    const [{ wallet, intents }, account] = await Promise.all([
      this.usdcBalances(), this.rpc.viewAccount(this.accountId),
    ]);
    return { wallet_usdc: wallet.toString(), intents_usdc: intents.toString(),
      near: decimal(account?.amount, "NEAR account amount").toString(), account_id: this.accountId };
  }

  async withdrawToWallet(amount = null, dryRun = false) {
    const { wallet, intents } = await this.usdcBalances();
    const units = amount === null ? intents : decimal(amount, "withdraw amount");
    if (units > intents) fail("insufficient_intents_balance", `Requested ${units} USDC base units; intents balance is ${intents}`);
    if (units === 0n) fail("nothing_to_withdraw", "Intents USDC balance is zero");
    const registered = await isStorageRegistered(this.rpc, USDC_CONTRACT, this.accountId);
    if (dryRun) {
      return { withdrawn: units.toString(), storage_registration_needed: !registered,
        wallet_usdc_before: wallet.toString(), wallet_usdc_after: null,
        intents_usdc_before: intents.toString(), intents_usdc_after: null };
    }
    let storage_tx_hash;
    if (!registered) {
      const sent = await this.rpc.sendActions({ accountId: this.accountId, signer: this.signer,
        receiverId: USDC_CONTRACT, actions: [{ type: "FunctionCall", methodName: "storage_deposit",
          args: Buffer.from(JSON.stringify({ account_id: this.accountId, registration_only: true })),
          gas: GAS_STORAGE, deposit: STORAGE_DEPOSIT }] });
      storage_tx_hash = sent.tx_hash;
    }
    const sent = await this.rpc.sendActions({ accountId: this.accountId, signer: this.signer,
      receiverId: INTENTS_CONTRACT, actions: [{ type: "FunctionCall", methodName: "ft_withdraw",
        args: Buffer.from(JSON.stringify({ token: USDC_CONTRACT, receiver_id: this.accountId, amount: units.toString() })),
        gas: GAS_WITHDRAW, deposit: "1" }] });
    const after = await this.usdcBalances();
    return { withdrawn: units.toString(), tx_hash: sent.tx_hash,
      ...(storage_tx_hash ? { storage_tx_hash } : {}),
      wallet_usdc_before: wallet.toString(), wallet_usdc_after: after.wallet.toString(),
      intents_usdc_before: intents.toString(), intents_usdc_after: after.intents.toString() };
  }

  async ensureFloat(usdcIn, dryRun = false) {
    const required = requiredFloat(usdcIn);
    const { wallet, intents } = await this.usdcBalances();
    const enough = wallet >= required;
    const canTopUp = wallet + intents >= required;
    const float = { wallet_usdc: wallet.toString(), intents_usdc: intents.toString(),
      required_usdc: required.toString(), sufficient: enough || canTopUp,
      needs_withdraw: !enough && canTopUp };
    if (dryRun) return { float };
    if (!canTopUp) fail("insufficient_float", `Wallet ${wallet}, intents ${intents}, required ${required} USDC base units`);
    return { float, ...(enough ? {} : { auto_withdraw: await this.withdrawToWallet() }) };
  }

  async buy(id) {
    const { chain, spec } = await this.ownedClaim(id);
    const route = await this.router.quote(spec, this.accountId);
    const profit = quoteProfit(chain, route, this.minProfit);
    if (!profit.profitable) {
      fail("unprofitable_route", "Fresh route is below minimum USDC profit");
    }
    const instructions = parseInstructions(route.execution_instructions);
    const txHashes = [];
    let sawFee = false;
    for (const instruction of instructions) {
      if (instruction.isFee) sawFee = true;
      if (sawFee && !instruction.isFee) fail("invalid_route", "Fee transactions must be last");
    }
    const checkedInstructions = [];
    for (const instruction of instructions) checkedInstructions.push(await this.filterStorageActions(instruction));
    const { auto_withdraw } = await this.ensureFloat(profit.usdc_in);
    for (const instruction of checkedInstructions.filter((item) => !item.isFee && item.actions.length)) {
      const sent = await this.rpc.sendActions({ accountId: this.accountId, signer: this.signer,
        receiverId: instruction.receiverId, actions: instruction.actions });
      txHashes.push(sent.tx_hash);
    }
    let outcome = null;
    try {
      outcome = await this.router.outcome(spec, this.accountId, txHashes, route.fee_amount || "0");
    } catch (error) {
      if (!["router_http", "network_error"].includes(error.code) && !(error instanceof TypeError)) throw error;
    }
    if (outcome) {
      const swapFailed = Boolean(outcome.error || outcome.charge_fee === false);
      if (!outcome.settled && !swapFailed) fail("swap_unsettled", "Swap outcome is not settled");
      if (outcome.charge_fee && !swapFailed) {
        for (const step of checkedInstructions.filter((item) => item.isFee && item.actions.length)) {
          const sent = await this.rpc.sendActions({ accountId: this.accountId, signer: this.signer,
            receiverId: step.receiverId, actions: step.actions });
          txHashes.push(sent.tx_hash);
        }
      }
      let recoveryFailed = false;
      const recoveryAttempted = Array.isArray(outcome.next_steps) && outcome.next_steps.length > 0;
      if (recoveryAttempted) {
        try {
          for (const instruction of parseInstructions(outcome.next_steps)) {
            const step = await this.filterStorageActions(instruction);
            if (!step.actions.length) continue;
            const sent = await this.rpc.sendActions({ accountId: this.accountId, signer: this.signer,
              receiverId: step.receiverId, actions: step.actions });
            txHashes.push(sent.tx_hash);
          }
        } catch (error) {
          if (!swapFailed) throw error;
          recoveryFailed = true;
        }
      }
      if (swapFailed) {
        fail("swap_failed", recoveryFailed
          ? "Intear reported a failed swap and a recovery step failed"
          : recoveryAttempted
            ? "Intear reported a failed swap; recovery steps were attempted"
            : "Intear reported a failed swap");
      }
    }
    const balance = await this.tokenBalance(spec);
    if (balance < BigInt(spec.amount_out)) fail("insufficient_tokens", "Token balance is below required delivery amount");
    return { order_id: id, tx_hashes: txHashes, balance: balance.toString(),
      ...(auto_withdraw ? { auto_withdraw } : {}),
      outcome: outcome ? { amount_in: outcome.amount_in, amount_out: outcome.amount_out, settled: outcome.settled } : null };
  }

  async deliver(id, amount) {
    const { spec } = await this.ownedClaim(id);
    const units = decimal(amount ?? spec.amount_out, "delivery amount");
    if (units < BigInt(spec.amount_out)) fail("insufficient_amount", "Delivery amount is below the order minimum");
    const balance = await this.tokenBalance(spec);
    if (balance < units) fail("insufficient_tokens", "Token balance is below delivery amount");
    const registered = await isStorageRegistered(this.rpc, spec.token_contract, spec.receiver);
    let deposit = null;
    if (!registered) {
      try {
        const bounds = await this.rpc.view(spec.token_contract, "storage_balance_bounds", {});
        deposit = decimal(bounds.min, "storage minimum").toString();
      } catch {
        deposit = STORAGE_DEPOSIT;
      }
    }
    const actions = buildDeliverActions(spec.receiver, units.toString(), deposit);
    const sent = await this.rpc.sendActions({ accountId: this.accountId, signer: this.signer,
      receiverId: spec.token_contract, actions });
    return { order_id: id, tx_hash: sent.tx_hash, receiver: spec.receiver, amount: units.toString(),
      storage_deposit: deposit || "0" };
  }

  async prove(id, txHash) {
    const { canonical } = await this.ownedClaim(id, ["claimed", "proof_rejected"]);
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,64}$/.test(txHash)) fail("invalid_tx_hash", "Invalid NEAR transaction hash");
    const uploaded = await this.api.request("POST", "/proofs", { order_id: id, tx_hash: txHash });
    if (!/^[a-f0-9]{64}$/.test(uploaded.sha256 || "")) fail("invalid_proof", "Proof upload did not return SHA-256");
    const submitted = await this.refreshSubmittedOrder(id,
      await this.api.authCall("submit_proof", id, { proof_sha256: uploaded.sha256, spec: canonical }), "prove");
    return { order_id: id, proof_sha256: uploaded.sha256, result: submitted };
  }

  async status(id) {
    const { chain, order } = await this.readOrderForPolling(id);
    return { order_id: id, status: chain.status, fulfiller: chain.fulfiller,
      deadline_ns: chain.deadline_ns, api_status: order.status,
      delivery_tx_hash: order.delivery_tx_hash || null };
  }

  async release(id) {
    const { chain } = await this.getOrder(id, null, false);
    if (chain.status !== "claimed" || chain.fulfiller !== this.accountId) fail("not_claimed", "No claim owned by this account");
    const result = await this.api.authCall("release_claim", id);
    return { order_id: id, operation: "release_claim", result };
  }

  async run(dryRun = false) {
    await this.requireSetup();
    const discovered = await this.orders();
    const choices = discovered.orders.filter((order) => !order.own_order && order.claimable && order.estimate?.profitable);
    choices.sort((a, b) => {
      const x = BigInt(a.estimate.profit_usdc);
      const y = BigInt(b.estimate.profit_usdc);
      return x > y ? -1 : x < y ? 1 : 0;
    });
    if (!choices.length) return { action: "none", reason: "No profitable non-own funded order" };
    const id = choices[0].id;
    const selected = await this.quote(id);
    if (!selected.profitable) return { action: "none", reason: "Fresh quote is not profitable" };
    const floatCheck = await this.ensureFloat(selected.usdc_in, dryRun);
    if (dryRun) return { action: "dry_run", order_id: id, quote: selected, float: floatCheck.float,
      steps: ["claim", "buy", "deliver", "prove", "status"] };
    let delivered = false;
    try {
      const claim = await this.claim(id);
      const buy = await this.buy(id);
      const delivery = await this.deliver(id);
      delivered = true;
      const proof = await this.prove(id, delivery.tx_hash);
      const status = await this.status(id);
      return { action: "completed", order_id: id, claim, buy, delivery, proof, status,
        ...(floatCheck.auto_withdraw ? { auto_withdraw: floatCheck.auto_withdraw } : {}) };
    } catch (error) {
      if (!delivered) {
        try {
          const chain = await this.rpc.view(this.escrowContract, "get_order", { id });
          if (chain?.status === "claimed" && chain.fulfiller === this.accountId) await this.api.authCall("release_claim", id);
        } catch {
          // Preserve the original error. Manual release is included in its message.
        }
      }
      if (error instanceof AgentError) throw error;
      fail(error.code || "run_failed", `Order ${id} failed; check status and release the claim if still owned`);
    }
  }
}
