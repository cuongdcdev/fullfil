import assert from "node:assert/strict";
import test from "node:test";
import { Commands, buildDeliverActions } from "../src/commands.mjs";
import { canonicalJson, guardDeadline, sha256Hex } from "../src/common.mjs";
import { quoteProfit } from "../src/intear.mjs";

const spec = { amount_out: "100", receiver: "buyer.near", token_contract: "token.near", v: 1 };
const future = (BigInt(Date.now() + 600_000) * 1_000_000n).toString();
const baseOrder = { id: "FUL-1234", kind: "token_buy", status: "claimed", buyer: "buyer.near",
  fulfiller: "agent.near", deadline_ns: future, pay_amount: "1000000", reward: "50000",
  spec_hash: sha256Hex(canonicalJson(spec)), spec, token: "nep141:usdc.near",
  buy_token: { account_id: "token.near", symbol: "TOK", decimals: 18, icon: "", price_usd: 0.2 },
  delivery_tx_hash: null };

test("setup adds the intents key before registering a missing profile", async () => {
  const calls = [];
  const client = new Commands({ accountId: "agent.near", signer: { publicKey: "ed25519:synthetic" },
    api: { authCall: async (...args) => { calls.push(["intent", ...args]); return { status: "submitted", tx_hash: "profile-hash" }; } },
    rpc: { view: async (contract, method, args) => {
      calls.push(["view", contract, method, args]);
      return method === "has_public_key" ? false : { profile: null };
    }, sendActions: async (tx) => { calls.push(["tx", tx]); return { tx_hash: "key-hash" }; } },
    router: {} });
  const result = await client.setup();
  assert.deepEqual(result, { account_id: "agent.near",
    intents_key: { registered: true, action: "added", tx_hash: "key-hash" },
    fulfiller_profile: { registered: true, action: "registered", tx_hash: "profile-hash", status: "submitted" } });
  assert.deepEqual(calls.map((call) => call[0]), ["view", "view", "tx", "intent"]);
  assert.deepEqual(calls[0], ["view", "intents.near", "has_public_key",
    { account_id: "agent.near", public_key: "ed25519:synthetic" }]);
  assert.equal(calls[2][1].receiverId, "intents.near");
  assert.equal(calls[2][1].actions[0].methodName, "add_public_key");
  assert.equal(calls[2][1].actions[0].gas, "30000000000000");
  assert.equal(calls[2][1].actions[0].deposit, "1");
  assert.deepEqual(JSON.parse(calls[2][1].actions[0].args), { public_key: "ed25519:synthetic" });
  assert.deepEqual(calls[3], ["intent", "register_fulfiller"]);
});

test("setup is idempotent and dry-run never sends a transaction or intent", async () => {
  for (const [keyPresent, profilePresent, dryRun] of [
    [true, true, false], [false, false, true], [true, false, true],
  ]) {
    const client = new Commands({ accountId: "agent.near", signer: { publicKey: "ed25519:synthetic" },
      api: { authCall: async () => assert.fail("intent submitted") },
      rpc: { view: async (_, method) => method === "has_public_key" ? keyPresent
        : profilePresent ? { profile: {} } : null,
      sendActions: async () => assert.fail("transaction sent") }, router: {} });
    const result = await client.setup(dryRun);
    assert.equal(result.intents_key.action, keyPresent ? "none" : "would_add");
    assert.equal(result.fulfiller_profile.action, profilePresent ? "none" : "would_register");
  }
});

test("run requires both setup items before reading orders", async () => {
  for (const [keyPresent, profilePresent, missing] of [
    [false, true, "intents.near public key"], [true, false, "fulfiller profile"],
  ]) {
    const client = new Commands({ accountId: "agent.near", signer: { publicKey: "ed25519:synthetic" },
      api: {}, rpc: { view: async (_, method) => method === "has_public_key" ? keyPresent
        : profilePresent ? { profile: {} } : null }, router: {} });
    client.orders = async () => assert.fail("orders read before setup check");
    for (const dryRun of [true, false]) {
      await assert.rejects(client.run(dryRun), (error) => error.code === "setup_required" &&
        error.message.includes(missing) && error.message.includes("node fulfil-agent.mjs setup"));
    }
  }
});

test("orders read buy_token without treating the pay-token string as metadata", async () => {
  const order = { ...baseOrder, status: "funded", fulfiller: null };
  const client = new Commands({ accountId: "agent.near", signer: {},
    api: { request: async () => ({ orders: [order] }) }, rpc: {},
    router: { quote: async () => ({ dex_id: "Rhea", estimated_amount: { amount_in: "900000" },
      worst_case_amount: { amount_in: "950000" } }) } });
  client.getOrder = async () => ({ chain: order, order, spec, canonical: canonicalJson(spec) });
  const result = await client.orders();
  assert.deepEqual(result.orders[0].buy_token, order.buy_token);
  assert.equal(result.orders[0].delivery_tx_hash, null);
  assert.equal("token" in result.orders[0], false);
});

test("status exposes the submitted delivery transaction hash", async () => {
  const hash = "3".repeat(44);
  const order = { ...baseOrder, status: "paid", delivery_tx_hash: hash };
  assert.equal((await command(order).status(order.id)).delivery_tx_hash, hash);
  assert.equal((await command(baseOrder).status(baseOrder.id)).delivery_tx_hash, null);
});

test("status retries only transient order mismatches and eventually succeeds", async () => {
  const chain = { ...baseOrder, status: "paid" };
  let reads = 0;
  let waits = 0;
  const client = new Commands({ accountId: "agent.near", signer: {}, router: {},
    sleep: async () => { waits++; },
    rpc: { view: async () => chain },
    api: { request: async () => ({ order: { ...chain, status: ++reads < 3 ? "claimed" : "paid" } }) } });
  assert.equal((await client.status(chain.id)).status, "paid");
  assert.equal(reads, 3);
  assert.equal(waits, 2);
});

test("status stops after three order mismatches", async () => {
  const chain = { ...baseOrder, status: "paid" };
  let reads = 0;
  const client = new Commands({ accountId: "agent.near", signer: {}, router: {},
    sleep: async () => {}, rpc: { view: async () => chain },
    api: { request: async () => { reads++; return { order: { ...chain, status: "claimed" } }; } } });
  await assert.rejects(client.status(chain.id), { code: "order_mismatch" });
  assert.equal(reads, 3);
});

test("claim fails immediately on order mismatch without signing", async () => {
  const chain = { ...baseOrder, status: "funded", fulfiller: null };
  let reads = 0;
  const client = new Commands({ accountId: "agent.near", signer: {}, router: {},
    sleep: async () => assert.fail("write path waited"), rpc: { view: async () => chain },
    api: { request: async () => { reads++; return { order: { ...chain, status: "claimed" } }; },
      authCall: async () => assert.fail("write path signed") } });
  await assert.rejects(client.claim(chain.id), { code: "order_mismatch" });
  assert.equal(reads, 1);
});

test("claim refreshes stale API order from chain", async () => {
  const funded = { ...baseOrder, status: "funded", fulfiller: null };
  let orderReads = 0;
  let waits = 0;
  const client = new Commands({ accountId: "agent.near", signer: { publicKey: "key" }, router: {},
    sleep: async () => { waits++; },
    rpc: { view: async (_, method) => method === "get_order"
      ? (++orderReads < 3 ? funded : baseOrder)
      : method === "has_public_key" ? true : { profile: {}, stats: { active_claims: 0 } } },
    api: { request: async () => ({ order: funded }),
      authCall: async () => ({ request_id: "req", status: "success", tx_hash: "hash", order: funded }) } });
  const result = await client.claim(funded.id);
  assert.equal(result.result.order.status, "claimed");
  assert.equal(result.result.order.fulfiller, "agent.near");
  assert.deepEqual(result.result.order.buy_token, funded.buy_token);
  assert.equal(waits, 1);
});

test("claim reports pending refresh without stale order after success", async () => {
  const funded = { ...baseOrder, status: "funded", fulfiller: null };
  const client = new Commands({ accountId: "agent.near", signer: { publicKey: "key" }, router: {},
    sleep: async () => {},
    rpc: { view: async (_, method) => method === "get_order" ? funded
      : method === "has_public_key" ? true : { profile: {}, stats: {} } },
    api: { request: async () => ({ order: funded }),
      authCall: async () => ({ request_id: "req", status: "success", order: funded }) } });
  const result = await client.claim(funded.id);
  assert.equal(result.result.order, undefined);
  assert.equal(result.result.order_refresh, "pending");
});

test("prove preserves paid API order and refreshes a stale claimed snapshot", async () => {
  const paid = { ...baseOrder, status: "paid", proof_sha256: "a".repeat(64) };
  for (const nested of [paid, baseOrder]) {
    const client = command(baseOrder, { view: async () => paid });
    client.api.request = async () => ({ sha256: "a".repeat(64) });
    client.api.authCall = async () => ({ request_id: "req", status: "success", order: nested });
    const result = await client.prove(baseOrder.id, "2".repeat(44));
    assert.equal(result.result.order.status, "paid");
    assert.equal(result.result.order.proof_sha256, paid.proof_sha256);
  }
});

function command(order = baseOrder, rpc = {}) {
  const client = new Commands({ accountId: "agent.near", signer: {}, api: { authCall: async () => ({ status: "ok" }) },
    rpc, router: {}, deadlineMarginSeconds: 120 });
  client.getOrder = async () => ({ chain: order, order, spec, canonical: canonicalJson(spec) });
  return client;
}

test("profit uses BigInt above u64 and the worst-case route input", () => {
  const huge = (1n << 80n).toString();
  const result = quoteProfit({ pay_amount: huge, reward: "500000" }, {
    estimated_amount: { amount_in: (1n << 80n).toString() },
    worst_case_amount: { amount_in: ((1n << 80n) + 200000n).toString() },
  }, "200000");
  assert.equal(result.profit_usdc, "300000");
  assert.equal(result.profitable, true);
});

test("delivery builder only emits storage_deposit and plain ft_transfer", () => {
  const unregistered = buildDeliverActions("odd.receiver", "100", "1250000000000000000000");
  const registered = buildDeliverActions("odd.receiver", "100");
  assert.deepEqual(unregistered.map((action) => action.methodName), ["storage_deposit", "ft_transfer"]);
  assert.deepEqual(registered.map((action) => action.methodName), ["ft_transfer"]);
  assert.equal(unregistered[0].deposit, "1250000000000000000000");
  assert.equal(unregistered[1].deposit, "1");
  assert.deepEqual(JSON.parse(unregistered[1].args), { receiver_id: "odd.receiver", amount: "100", memo: "Fulfil token delivery" });
  assert.equal(unregistered.some((action) => action.methodName === "ft_transfer_call"), false);
});

test("deliver checks registration and sends one separate transaction", async () => {
  for (const balance of [{ total: "1250000000000000000000", available: "0" }, null, { total: "0" }]) {
    const registered = balance?.total !== "0" && balance !== null;
    const sent = [];
    const rpc = {
      tokenBalance: async () => 100n,
      view: async (_, method) => method === "storage_balance_of" ? balance : { min: "77" },
      sendActions: async (input) => {
        sent.push(input);
        return { tx_hash: "hash" };
      },
    };
    const result = await command(baseOrder, rpc).deliver("FUL-1234");
    assert.equal(result.tx_hash, "hash");
    assert.equal(sent.length, 1);
    assert.equal(sent[0].receiverId, "token.near");
    assert.deepEqual(sent[0].actions.map((action) => action.methodName), registered ? ["ft_transfer"] : ["storage_deposit", "ft_transfer"]);
    if (!registered) assert.equal(sent[0].actions[0].deposit, "77");
  }
});

test("deliver fails before sending if storage registration cannot be checked", async () => {
  const client = command(baseOrder, { tokenBalance: async () => 100n,
    view: async () => { throw new Error("RPC unavailable"); },
    sendActions: async () => assert.fail("transaction sent") });
  await assert.rejects(client.deliver(baseOrder.id), { code: "storage_check_failed" });
});

test("buy preflights route storage deposits and drops registered actions", async () => {
  for (const balance of [{ total: "1" }, null]) {
    const sent = [];
    const route = { worst_case_amount: { amount_in: "900000" },
      estimated_amount: { amount_in: "850000" },
      execution_instructions: [{ NearTransaction: { receiver_id: "token.near", actions: [
        { FunctionCall: { method_name: "storage_deposit", args: "e30=", gas: 30000000000000, deposit: "125" } },
        { FunctionCall: { method_name: "ft_transfer_call", args: "e30=", gas: 30000000000000, deposit: "1" } },
      ] } }] };
    const client = new Commands({ accountId: "agent.near", signer: {}, api: {},
      rpc: { view: async (_, method, args) => {
        assert.equal(method, "storage_balance_of");
        assert.equal(args.account_id, "agent.near");
        return balance;
      }, sendActions: async (tx) => { sent.push(tx); return { tx_hash: "hash" }; },
      tokenBalance: async () => 100n },
      router: { quote: async () => route, outcome: async () => null } });
    client.ownedClaim = async () => ({ chain: baseOrder, spec });
    client.ensureFloat = async () => ({});
    await client.buy(baseOrder.id);
    assert.deepEqual(sent[0].actions.map((action) => action.methodName), balance
      ? ["ft_transfer_call"] : ["storage_deposit", "ft_transfer_call"]);
  }
});

test("buy preflights all route storage deposits before sending", async () => {
  const route = { worst_case_amount: { amount_in: "900000" },
    estimated_amount: { amount_in: "850000" }, execution_instructions: [
      { NearTransaction: { receiver_id: "usdc.near", actions: [
        { FunctionCall: { method_name: "ft_transfer_call", args: "e30=", gas: 30000000000000, deposit: "1" } },
      ] } },
      { NearTransaction: { receiver_id: "token.near", actions: [
        { FunctionCall: { method_name: "storage_deposit", args: "e30=", gas: 30000000000000, deposit: "125" } },
      ] } },
    ] };
  const client = new Commands({ accountId: "agent.near", signer: {}, api: {},
    rpc: { view: async () => { throw new Error("RPC unavailable"); },
      sendActions: async () => assert.fail("transaction sent"), tokenBalance: async () => 100n },
    router: { quote: async () => route } });
  client.ownedClaim = async () => ({ chain: baseOrder, spec });
  await assert.rejects(client.buy(baseOrder.id), { code: "storage_check_failed" });
});

test("buy skips a route transaction emptied by registration filtering", async () => {
  const sent = [];
  const route = { worst_case_amount: { amount_in: "900000" },
    estimated_amount: { amount_in: "850000" }, execution_instructions: [
      { NearTransaction: { receiver_id: "token.near", actions: [
        { FunctionCall: { method_name: "storage_deposit", args: "e30=", gas: 30000000000000, deposit: "125" } },
      ] } },
      { NearTransaction: { receiver_id: "usdc.near", actions: [
        { FunctionCall: { method_name: "ft_transfer_call", args: "e30=", gas: 30000000000000, deposit: "1" } },
      ] } },
    ] };
  const client = new Commands({ accountId: "agent.near", signer: {}, api: {},
    rpc: { view: async () => ({ total: "1" }),
      sendActions: async (tx) => { sent.push(tx); return { tx_hash: "hash" }; },
      tokenBalance: async () => 100n },
    router: { quote: async () => route, outcome: async () => null } });
  client.ownedClaim = async () => ({ chain: baseOrder, spec });
  client.ensureFloat = async () => ({});
  const result = await client.buy(baseOrder.id);
  assert.deepEqual(sent.map((tx) => tx.receiverId), ["usdc.near"]);
  assert.deepEqual(result.tx_hashes, ["hash"]);
});

test("deadline guard prevents claim, buy and deliver before side effects", async () => {
  const close = { ...baseOrder, deadline_ns: (BigInt(Date.now() + 30_000) * 1_000_000n).toString() };
  const rpc = { view: async () => { throw new Error("side effect"); } };
  const client = command(close, rpc);
  await assert.rejects(client.buy("FUL-1234"), { code: "deadline_too_close" });
  await assert.rejects(client.deliver("FUL-1234"), { code: "deadline_too_close" });
  await assert.rejects(command({ ...close, status: "funded", fulfiller: null }, rpc).claim("FUL-1234"), { code: "deadline_too_close" });
  assert.throws(() => guardDeadline({ deadline_ns: "1" }, 120), { code: "deadline_too_close" });
});

test("own-order claim is refused", async () => {
  const client = command({ ...baseOrder, buyer: "agent.near", status: "funded", fulfiller: null });
  await assert.rejects(client.claim("FUL-1234"), { code: "own_order" });
});

test("claim refuses a second active claim", async () => {
  const chain = { ...baseOrder, status: "funded", fulfiller: null };
  const client = command(chain, { view: async (_, method) => method === "has_public_key"
    ? true : { profile: {}, stats: { active_claims: 1 } } });
  await assert.rejects(client.claim("FUL-1234"), { code: "active_claim" });
});

test("order detail can obtain documented spec from the list and checks its chain hash", async () => {
  const chain = { ...baseOrder, status: "funded", fulfiller: null };
  const detail = { ...chain };
  delete detail.spec;
  const api = { request: async (_, path) => path.startsWith("/orders/") ? { order: detail } : { orders: [{ id: chain.id, spec }] } };
  const rpc = { view: async () => chain };
  const client = new Commands({ accountId: "agent.near", signer: {}, api, rpc, router: {} });
  assert.deepEqual((await client.getOrder(chain.id)).spec, spec);
  await assert.rejects(async () => {
    detail.spec_hash = "0".repeat(64);
    await client.getOrder(chain.id);
  }, { code: "order_mismatch" });
});

test("run releases an owned claim after a buy failure", async () => {
  const calls = [];
  const api = { authCall: async (op) => {
    calls.push(op);
    return { status: "ok" };
  } };
  const rpc = { view: async (_, method) => method === "has_public_key" ? true
    : method === "get_profile" ? { profile: {} } : { ...baseOrder, status: "claimed" } };
  const client = new Commands({ accountId: "agent.near", signer: {}, api, rpc, router: {} });
  client.orders = async () => ({ orders: [{ id: "FUL-1234", own_order: false, claimable: true,
    estimate: { profitable: true, profit_usdc: "100" } }] });
  client.quote = async () => ({ profitable: true });
  client.ensureFloat = async () => ({});
  client.claim = async () => ({ result: { status: "ok" } });
  client.buy = async () => { throw new Error("synthetic buy failure"); };
  await assert.rejects(client.run(), { code: "run_failed" });
  assert.deepEqual(calls, ["release_claim"]);
});

test("failed swap executes outcome next_steps before reporting swap_failed", async () => {
  const sent = [];
  const route = { worst_case_amount: { amount_in: "900000" }, estimated_amount: { amount_in: "850000" },
    execution_instructions: [{ NearTransaction: { receiver_id: "usdc.near", is_fee_transaction: false,
      actions: [{ FunctionCall: { method_name: "ft_transfer_call", args: "e30=", gas: 10000000000000, deposit: "1" } }] } }] };
  const recovery = { NearTransaction: { receiver_id: "wrap.near", is_fee_transaction: false,
    actions: [{ FunctionCall: { method_name: "near_withdraw", args: "e30=", gas: 10000000000000, deposit: "1" } }] } };
  const client = new Commands({ accountId: "agent.near", signer: {}, api: {},
    rpc: { sendActions: async (tx) => {
      sent.push(tx.receiverId);
      return { tx_hash: `hash-${sent.length}` };
    } },
    router: { quote: async () => route,
      outcome: async () => ({ charge_fee: false, error: "Price moved", settled: true, next_steps: [recovery] }) } });
  client.ownedClaim = async () => ({ chain: baseOrder, spec });
  client.ensureFloat = async () => ({});
  await assert.rejects(client.buy("FUL-1234"), { code: "swap_failed" });
  assert.deepEqual(sent, ["usdc.near", "wrap.near"]);
});
