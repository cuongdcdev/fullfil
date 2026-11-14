import { get, list, put, remove } from "../db";
import { escrowContract, intentsContract, mode, USDC_TOKEN } from "./config";
import { view } from "./rpc";
import type { Intent } from "./intents";
import { bankTransferSpec, canonicalJson, inPersonSpec, specHash, tokenBuySpec } from "@fulfil/core";
import { createHash } from "node:crypto";

export const orderStatuses = [
  "funded",
  "claimed",
  "sent",
  "verifying",
  "proof_rejected",
  "verified",
  "under_review",
  "paid",
  "closed",
  "disputed",
  "resolved",
  "cancelled",
  "expired",
] as const;
export type Status = (typeof orderStatuses)[number];
export type Verdict = "buyer" | "fulfiller" | "split";
export type V3Order = {
  id: string;
  buyer: string;
  token: string;
  pay_amount: string;
  reward: string;
  kind: string;
  spec_hash: string;
  quoted_by: string | null;
  amount_vnd?: number;
  merchant_hash?: string;
  deadline_ns: string;
  created_at: string;
  fulfiller: string | null;
  bond_locked: string;
  claimed_at: string | null;
  claimed_at_ns: string | null;
  sent_at: string | null;
  verify_started_at: string | null;
  verified_at: string | null;
  paid_at: string | null;
  ended_at: string | null;
  proof_sha256: string | null;
  nullifier: string | null;
  status: Status;
  attempts: number;
  total_proof_attempts?: number;
  last_reject_reason: string | null;
  buyer_rating: number | null;
  fulfiller_rating: number | null;
  dispute_reason: number | null;
  disputed_by: string | null;
  verdict: Verdict | null;
  verdict_note_hash: string | null;
};
export type Stats = {
  jobs_done: number;
  jobs_as_buyer: number;
  star_sum: number;
  star_count: number;
  disputes_lost: number;
  disputes_won: number;
  volume: string;
  open_as_buyer: number;
  active_claims: number;
};
export type Profile = {
  account_id: string;
  profile: {
    bank_bin: string;
    account_last4: string;
    registered_at: string;
  } | null;
  stats: Stats;
  level: number;
  rating: { star_sum: number; star_count: number; avg: number | null };
  bond: { available: string; locked: string };
  approved: boolean;
};
type ContractOrder = Omit<V3Order, "claimed_at_ns">;
type ContractProfile = Omit<Profile, "rating">;
export type MockConfig = {
  kinds: Record<string, {
    enabled: boolean;
    access: "open" | "approved" | { allowlist: string[] };
    needs_sent: boolean;
    claim_timeout_ns: string;
    proof_timeout_ns: string;
    max_deadline_ns: string;
    quote_exclusive_ns: string;
    open_max_active_claims: number;
    open_max_order_value: string;
  }>;
  owner: string;
  intents_contract: string;
  outlayer_contract: string;
  verifier_source: string;
  verifier_resource_limits: string;
  secrets_profile: string | null;
  proof_blob_base_url: string;
  outlayer_deposit: string;
  outlayer_gas_tgas: number;
  arbiter: string;
  relayer: string;
  accepted_tokens: string[];
  bond_token: string;
  allowed_dkim_domains: string[];
  min_order_amount: string;
  min_bond: string;
  bond_per_job_bps: number;
  bond_hold_ns: string;
  challenge_window_ns: string;
  claim_timeout_ns: string;
  proof_timeout_ns: string;
  rating_window_ns: string;
  max_email_skew_ns: string;
  rating_unit: string;
  max_orders: number;
  max_profiles: number;
  paused: boolean;
  require_fulfiller_approval: boolean;
};
type Balance = { account: string; token: string; amount: string };
export type Verification = {
  ok: boolean;
  reason?: string;
  amount_vnd?: number;
  credit_account_hash?: string;
  note?: string;
  tx_ref_hash?: string;
  email_ts_ns?: string;
  dkim_domain?: string;
  proof_sha256?: string;
  order_id?: string;
};
const HOUR = BigInt("3600000000000");
const MAX_U64 = BigInt("18446744073709551615");
const MAX_U128 = BigInt("340282366920938463463374607431768211455");
const defaultConfig: MockConfig = {
  kinds: {
    bank_transfer: { enabled: true, access: "approved", needs_sent: true,
      claim_timeout_ns: String(HOUR / BigInt(4)), proof_timeout_ns: String(BigInt(2) * HOUR),
      max_deadline_ns: String(BigInt(24) * HOUR), quote_exclusive_ns: String(HOUR / BigInt(30)),
      open_max_active_claims: 1, open_max_order_value: "20000000" },
    cryptorefills_topup: { enabled: true, access: "open", needs_sent: false,
      claim_timeout_ns: String(HOUR / BigInt(4)), proof_timeout_ns: String(HOUR / BigInt(2)),
      max_deadline_ns: String(HOUR / BigInt(2)), quote_exclusive_ns: String(HOUR / BigInt(30)),
      open_max_active_claims: 1, open_max_order_value: "20000000" },
    cryptorefills_code: { enabled: true, access: { allowlist: [process.env.SHOPPER_ACCOUNT_ID || "shopper.mock.near"] }, needs_sent: false,
      claim_timeout_ns: String(HOUR / BigInt(4)), proof_timeout_ns: String(HOUR / BigInt(2)),
      max_deadline_ns: String(HOUR / BigInt(2)), quote_exclusive_ns: String(HOUR / BigInt(30)),
      open_max_active_claims: 1, open_max_order_value: "20000000" },
    in_person: { enabled: true, access: "open", needs_sent: false,
      claim_timeout_ns: String(BigInt(24) * HOUR), proof_timeout_ns: String(BigInt(24) * HOUR),
      max_deadline_ns: String(BigInt(24) * HOUR), quote_exclusive_ns: String(HOUR / BigInt(30)),
      open_max_active_claims: 1, open_max_order_value: "20000000" },
    token_buy: { enabled: true, access: "open", needs_sent: false,
      claim_timeout_ns: String(BigInt(24) * HOUR), proof_timeout_ns: String(BigInt(24) * HOUR),
      max_deadline_ns: String(BigInt(24) * HOUR), quote_exclusive_ns: String(HOUR / BigInt(30)),
      open_max_active_claims: 1, open_max_order_value: MAX_U128.toString() },
  },
  owner: escrowContract(),
  intents_contract: intentsContract(),
  outlayer_contract: "outlayer.near",
  verifier_source: '{"Project":{"project_id":"mock/email-verifier","version_key":null}}',
  verifier_resource_limits: '{"max_instructions":10000000000,"max_memory_mb":128,"max_execution_seconds":60}',
  secrets_profile: null,
  proof_blob_base_url: "http://localhost:3000/api/proof-blob/",
  outlayer_deposit: "0",
  outlayer_gas_tgas: 100,
  arbiter: "mock-arbiter",
  relayer: "mock-relayer",
  accepted_tokens: [USDC_TOKEN],
  bond_token: USDC_TOKEN,
  allowed_dkim_domains: [],
  min_order_amount: "100000",
  min_bond: "0",
  bond_per_job_bps: 0,
  bond_hold_ns: String(BigInt(24) * HOUR),
  challenge_window_ns: "0",
  claim_timeout_ns: String(HOUR / BigInt(4)),
  proof_timeout_ns: String(BigInt(2) * HOUR),
  rating_window_ns: String(BigInt(7) * BigInt(24) * HOUR),
  max_email_skew_ns: String(BigInt(10) * BigInt(60) * BigInt(1_000_000_000)),
  rating_unit: "1000000",
  max_orders: 1000,
  max_profiles: 1000,
  paused: false,
  require_fulfiller_approval: true,
};
const emptyStats = (): Stats => ({
  jobs_done: 0,
  jobs_as_buyer: 0,
  star_sum: 0,
  star_count: 0,
  disputes_lost: 0,
  disputes_won: 0,
  volume: "0",
  open_as_buyer: 0,
  active_claims: 0,
});
const value = (order: V3Order) =>
  BigInt(order.pay_amount) + BigInt(order.reward);
function orderView(order: ContractOrder): V3Order {
  const legacy = order as ContractOrder & { amount_vnd?: number; merchant_hash?: string };
  return { ...order,
    kind: order.kind || "bank_transfer",
    spec_hash: order.spec_hash || (legacy.amount_vnd && legacy.merchant_hash
      ? specHash(bankTransferSpec(legacy.amount_vnd, legacy.merchant_hash)) : ""),
    quoted_by: order.quoted_by ?? null,
    claimed_at_ns: order.claimed_at };
}
function profileView(profile: ContractProfile): Profile {
  const { star_sum, star_count } = profile.stats;
  return {
    ...profile,
    rating: {
      star_sum,
      star_count,
      avg: star_count === 0 ? null : star_sum / star_count,
    },
  };
}
function noteHasId(note: string, id: string): boolean {
  const upper = note.toUpperCase();
  const token = (char: string) => /^[A-Z0-9-]$/.test(char);
  let position = upper.indexOf(id);
  while (position >= 0) {
    const end = position + id.length;
    if (
      (position === 0 || !token(upper[position - 1])) &&
      (end === upper.length || !token(upper[end]))
    ) {
      return true;
    }
    position = upper.indexOf(id, position + 1);
  }
  return false;
}
function check(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

export interface EscrowBackend {
  balance(account: string, token?: string): Promise<string>;
  profile(account: string): Promise<Profile>;
  order(id: string): Promise<V3Order | null>;
  orders(status?: string, account?: string, from?: number, limit?: number): Promise<V3Order[]>;
  apply?(account: string, intents: Intent[]): Promise<V3Order | null>;
  resolve?(id: string, verdict: Verdict, noteHash?: string): Promise<V3Order>;
  credit?(account: string, amount: string, token?: string): Promise<void>;
}

export class MockEscrow implements EscrowBackend {
  readonly config: MockConfig;
  private readonly clock: () => bigint;

  constructor(
    config: Partial<MockConfig> = {},
    clock: () => bigint = () => BigInt(Date.now()) * BigInt(1_000_000),
  ) {
    this.config = { ...defaultConfig, ...config };
    this.clock = clock;
  }

  private now(): bigint {
    return this.clock();
  }
  private key(account: string, token: string): string {
    return `v3:balance:${account}:${token}`;
  }
  async balance(account: string, token = USDC_TOKEN): Promise<string> {
    return get<Balance>(this.key(account, token))?.amount || "0";
  }
  async credit(account: string, amount: string, token = USDC_TOKEN): Promise<void> {
    this.setBalance(account, token, BigInt(await this.balance(account, token)) + BigInt(amount));
  }
  async seed(account: string): Promise<void> {
    const key = `v3:seed:${account}`;
    if (get<boolean>(key)) {
      return;
    }
    await this.credit(account, "100000000");
    put(key, "v3:seed", true);
  }
  private setBalance(account: string, token: string, amount: bigint): void {
    check(amount >= BigInt(0), "Insufficient intents balance");
    put(this.key(account, token), "v3:balance", {
      account, token, amount: String(amount),
    } satisfies Balance);
  }
  private async move(from: string, to: string, token: string, amount: bigint): Promise<void> {
    if (amount === BigInt(0)) {
      return;
    }
    const source = BigInt(await this.balance(from, token));
    check(source >= amount, "Insufficient intents balance");
    this.setBalance(from, token, source - amount);
    this.setBalance(to, token, BigInt(await this.balance(to, token)) + amount);
  }
  private stats(account: string): Stats {
    return get<Stats>(`v3:stats:${account}`) || emptyStats();
  }
  private saveStats(account: string, stats: Stats): void {
    put(`v3:stats:${account}`, "v3:stats", stats);
  }
  private bond(account: string): Profile["bond"] {
    return get<Profile["bond"]>(`v3:bond:${account}`) || { available: "0", locked: "0" };
  }
  private saveBond(account: string, bond: Profile["bond"]): void {
    put(`v3:bond:${account}`, "v3:bond", bond);
  }
  private save(order: V3Order): void {
    if (order.status === "cancelled" || order.status === "expired") {
      remove(`v3:order:${order.id}`);
      put(`v3:final:${order.id}`, "v3:final", order);
      return;
    }
    put(`v3:order:${order.id}`, "v3:order", order);
  }
  private index(account: string, id: string): void {
    const key = `v3:index:${account}`;
    const ids = get<string[]>(key) || [];
    if (ids[ids.length - 1] === id) {
      return;
    }
    ids.push(id);
    if (ids.length > 100) ids.shift();
    put(key, "v3:index", ids);
  }
  private settle(order: V3Order): void {
    if (get<boolean>(`v3:settled:${order.id}`)) {
      return;
    }
    const buyer = this.stats(order.buyer);
    buyer.open_as_buyer = Math.max(0, buyer.open_as_buyer - 1);
    this.saveStats(order.buyer, buyer);
    if (order.fulfiller) {
      const fulfiller = this.stats(order.fulfiller);
      fulfiller.active_claims = Math.max(0, fulfiller.active_claims - 1);
      this.saveStats(order.fulfiller, fulfiller);
    }
    put(`v3:settled:${order.id}`, "v3:settled", true);
  }
  private countJob(order: V3Order): void {
    if (!order.fulfiller) {
      return;
    }
    const fulfiller = this.stats(order.fulfiller);
    fulfiller.jobs_done += 1;
    fulfiller.volume = String(BigInt(fulfiller.volume) + value(order));
    this.saveStats(order.fulfiller, fulfiller);
    const buyer = this.stats(order.buyer);
    buyer.jobs_as_buyer += 1;
    this.saveStats(order.buyer, buyer);
  }
  private unlock(order: V3Order, slash: bigint): void {
    if (!order.fulfiller) {
      return;
    }
    const locked = BigInt(order.bond_locked);
    const bond = this.bond(order.fulfiller);
    bond.locked = String(BigInt(bond.locked) - locked);
    bond.available = String(BigInt(bond.available) + locked - slash);
    this.saveBond(order.fulfiller, bond);
    order.bond_locked = "0";
  }
  private async payout(order: V3Order): Promise<void> {
    order.status = "paid";
    order.paid_at = String(this.now());
    this.settle(order);
    this.countJob(order);
    this.save(order);
    await this.move(escrowContract(), order.fulfiller!, order.token, value(order));
  }
  async profile(account: string): Promise<Profile> {
    const stats = this.stats(account);
    const level = stats.jobs_done >= 20 && stats.disputes_lost * 20 < stats.jobs_done
      ? 2 : stats.jobs_done >= 5 && stats.disputes_lost === 0 ? 1 : 0;
    return profileView({
      account_id: account,
      profile: get<Profile["profile"]>(`v3:profile:${account}`) || null,
      stats,
      level,
      bond: this.bond(account),
      approved: !!get<Profile["profile"]>(`v3:profile:${account}`) &&
        (!this.config.require_fulfiller_approval ||
          get<boolean>(`v3:approval:${account}`) === true),
    });
  }
  async order(id: string): Promise<V3Order | null> {
    const order = get<ContractOrder>(`v3:order:${id}`) || get<ContractOrder>(`v3:final:${id}`);
    return order ? orderView(order) : null;
  }
  get_order(id: string): Promise<V3Order | null> {
    const order = get<ContractOrder>(`v3:order:${id}`);
    return Promise.resolve(order ? orderView(order) : null);
  }
  async orders(status?: string, account?: string, from = 0, limit = 50): Promise<V3Order[]> {
    const all = [...list<V3Order>("v3:order"), ...list<V3Order>("v3:final")];
    const ordered = account
      ? (get<string[]>(`v3:index:${account}`) || []).slice().reverse()
        .flatMap((id) => all.filter((order) => order.id === id))
      : all;
    return ordered.filter((order) => !status || order.status === status)
      .slice(from, from + Math.min(limit, 100))
      .map(orderView);
  }
  list_orders(status?: Status, from?: number, limit?: number): Promise<V3Order[]> {
    return this.orders(status, undefined, from, limit);
  }
  orders_by_account(account_id: string, from?: number, limit?: number): Promise<V3Order[]> {
    return this.orders(undefined, account_id, from, limit);
  }
  get_profile(account_id: string): Promise<Profile> {
    return this.profile(account_id);
  }
  get_config(): MockConfig {
    return this.config;
  }
  get_kinds(): MockConfig["kinds"] {
    return this.config.kinds;
  }
  approve_fulfiller(account_id: string, approved: boolean, caller = this.config.owner): void {
    check(caller === this.config.owner, "owner only");
    put(`v3:approval:${account_id}`, "v3:approval", approved);
  }
  is_nullifier_used(tx_ref_hash: string): string | null {
    return get<string>(`v3:nullifier:${tx_ref_hash.toLowerCase()}`) || null;
  }
  get_owed(_account_id: string, _token_id: string): string {
    return "0";
  }
  get_counts(): [number, number] {
    return [list<V3Order>("v3:order").length, list<Profile["profile"]>("v3:profile").length];
  }
  setNextVerification(orderId: string, outcome: Verification): void {
    put(`v3:verify:${orderId}`, "v3:verify", outcome);
  }
  private verificationError(order: V3Order, proof: string, outcome: Verification): string | null {
    if (!outcome.ok) {
      return `not ok: ${(outcome.reason || "-").slice(0, 80)}`;
    }
    if (outcome.proof_sha256 && outcome.proof_sha256 !== proof) {
      return "proof hash mismatch";
    }
    if (outcome.order_id && outcome.order_id !== order.id) {
      return "order id mismatch";
    }
    const generic = outcome as Verification & { spec_hash?: string; completed_at_ns?: string; nullifier?: string };
    if (generic.spec_hash && generic.spec_hash !== order.spec_hash) return "spec hash mismatch";
    if (generic.completed_at_ns && BigInt(generic.completed_at_ns) +
      BigInt(this.config.max_email_skew_ns) < BigInt(order.claimed_at!)) return "proof older than claim";
    if (order.kind !== "bank_transfer") return null;
    const stored = get<{ spec: string }>(`v3:spec:${order.id}`);
    const bankSpec = stored ? JSON.parse(stored.spec) as { amount: string; merchant_hash: string } : null;
    const expectedAmount = bankSpec ? Number(bankSpec.amount) : order.amount_vnd ?? 0;
    const expectedHash = bankSpec?.merchant_hash ?? order.merchant_hash;
    if ((outcome.amount_vnd ?? expectedAmount) < expectedAmount) {
      return "amount too low";
    }
    if ((outcome.credit_account_hash ?? expectedHash) !== expectedHash) {
      return "wrong recipient";
    }
    if (!noteHasId(outcome.note ?? order.id, order.id)) {
      return "note missing order id";
    }
    const emailTime = BigInt(outcome.email_ts_ns ?? String(this.now()));
    if (emailTime + BigInt(this.config.max_email_skew_ns) < BigInt(order.claimed_at!)) {
      return "email older than claim";
    }
    if (this.config.allowed_dkim_domains.length &&
      !this.config.allowed_dkim_domains.some((domain) =>
        domain.toLowerCase() === (outcome.dkim_domain || "").toLowerCase())) {
      return "dkim domain not allowed";
    }
    if (!/^[a-f0-9]{64}$/.test((outcome.tx_ref_hash ?? proof).toLowerCase())) {
      return "bad tx_ref_hash";
    }
    return null;
  }
  async apply(account: string, intents: Intent[]): Promise<V3Order | null> {
    let latest: V3Order | null = null;
    for (const intent of intents) {
      if (intent.intent === "transfer") {
        const entries = Object.entries(intent.tokens as Record<string, string>);
        check(entries.length === 1, "exactly one token");
        const [token, quantity] = entries[0];
        const amount = BigInt(quantity);
        check(amount > BigInt(0) && amount <= MAX_U128, "zero amount");
        if (intent.receiver_id !== escrowContract()) {
          await this.move(account, String(intent.receiver_id), token, amount);
          continue;
        }
        check(!this.config.paused, "paused");
        const msg = JSON.parse(String(intent.msg || "")) as Record<string, unknown>;
        if (msg.op === "bond") {
          check(token === this.config.bond_token, "wrong bond token");
          await this.move(account, escrowContract(), token, amount);
          const bond = this.bond(account);
          bond.available = String(BigInt(bond.available) + amount);
          this.saveBond(account, bond);
          continue;
        }
        check(msg.op === "fund" && !!msg.order, "bad msg");
        const input = msg.order as Record<string, unknown>;
        const id = String(input.id);
        const pay = BigInt(String(input.pay_amount));
        const reward = BigInt(String(input.reward));
        const deadline = BigInt(String(input.deadline_ns));
        const stats = this.stats(account);
        check(this.config.accepted_tokens.includes(token), "token not accepted");
        check(/^[A-Z0-9-]{6,16}$/.test(id), "bad order id");
        check(!get<boolean>(`v3:used:${id}`), "order id used");
        const kind = String(input.kind || "");
        const kindConfig = this.config.kinds[kind];
        check(kindConfig?.enabled, "kind unavailable");
        check(/^[a-f0-9]{64}$/.test(String(input.spec_hash)), "bad spec_hash");
        check(pay > BigInt(0) && reward >= BigInt(0), "zero amount");
        check(pay <= MAX_U128 && reward <= MAX_U128, "overflow");
        check(pay + reward <= MAX_U128, "overflow");
        check(pay + reward === amount, "amount != pay_amount + reward");
        check(amount >= BigInt(this.config.min_order_amount), "order too small");
        let deliveryHash: string | undefined;
        if (kind === "in_person" || kind === "token_buy") {
          const rawSpec = String(msg.spec || "");
          let parsed: Record<string, unknown>;
          try {
            parsed = JSON.parse(rawSpec) as Record<string, unknown>;
          } catch {
            throw new Error("bad order spec");
          }
          check(parsed && typeof parsed === "object" && !Array.isArray(parsed), "bad order spec");
          const canonical = canonicalJson(kind === "in_person"
            ? inPersonSpec(parsed as Parameters<typeof inPersonSpec>[0])
            : tokenBuySpec(parsed as Parameters<typeof tokenBuySpec>[0]));
          check(rawSpec === canonical && specHash(rawSpec) === input.spec_hash, "spec hash mismatch");
          if (kind === "in_person") {
            check(pay === BigInt(String(parsed.price)) && amount <= BigInt(20_000_000) &&
              amount >= BigInt(1_000_000), "in_person value limit");
            deliveryHash = String(parsed.delivery_hash);
          } else {
            check(pay >= BigInt(1_000_000), "token_buy value minimum");
          }
        }
        check(deadline <= MAX_U64 && deadline > this.now() &&
          deadline - this.now() <= BigInt(kindConfig.max_deadline_ns), "bad deadline");
        check(this.get_counts()[0] < this.config.max_orders, "order book full");
        check(stats.open_as_buyer < 20, "too many open orders");
        await this.move(account, escrowContract(), token, amount);
        stats.open_as_buyer += 1;
        this.saveStats(account, stats);
        put(`v3:used:${id}`, "v3:used", true);
        if (deliveryHash) put(`v3:delivery_hash:${id}`, "v3:delivery_hash", deliveryHash);
        this.index(account, id);
        latest = {
          id, buyer: account, token, pay_amount: String(pay), reward: String(reward),
          kind, spec_hash: String(input.spec_hash), quoted_by: input.quoted_by ? String(input.quoted_by) : null,
          deadline_ns: String(deadline), created_at: String(this.now()), fulfiller: null,
          bond_locked: "0", claimed_at: null, claimed_at_ns: null,
          sent_at: null, verify_started_at: null,
          verified_at: null, paid_at: null, ended_at: null, proof_sha256: null,
          nullifier: null, status: "funded", attempts: 0, total_proof_attempts: 0, last_reject_reason: null,
          buyer_rating: null, fulfiller_rating: null, dispute_reason: null,
          disputed_by: null, verdict: null, verdict_note_hash: null,
        };
        this.save(latest);
      } else if (intent.intent === "auth_call") {
        const msg = JSON.parse(String(intent.msg)) as Record<string, unknown>;
        const op = String(msg.op);
        if (op === "register_fulfiller") {
          check(!this.config.paused, "paused");
          if (msg.bank_bin !== undefined) check(/^\d{6}$/.test(String(msg.bank_bin)), "bank_bin must be 6 digits");
          if (msg.account_last4 !== undefined) check(/^\d{4}$/.test(String(msg.account_last4)), "account_last4 must be 4 digits");
          const existing = (await this.profile(account)).profile;
          check(existing || this.get_counts()[1] < this.config.max_profiles, "profile limit reached");
          put(`v3:profile:${account}`, "v3:profile", {
            bank_bin: msg.bank_bin ? String(msg.bank_bin) : "",
            account_last4: msg.account_last4 ? String(msg.account_last4) : "",
            registered_at: String(this.now()),
          });
          if (this.config.require_fulfiller_approval &&
            get<boolean>(`v3:approval:${account}`) === undefined) {
            put(`v3:approval:${account}`, "v3:approval", true);
          }
          continue;
        }
        if (op === "withdraw_bond") {
          const amount = BigInt(String(msg.amount));
          const bond = this.bond(account);
          check(amount > BigInt(0) && BigInt(bond.available) >= amount, "insufficient available bond");
          bond.available = String(BigInt(bond.available) - amount);
          this.saveBond(account, bond);
          await this.move(escrowContract(), account, this.config.bond_token, amount);
          continue;
        }
        const order = await this.order(String(msg.order_id));
        check(order, "order not found");
        switch (op) {
          case "claim": {
            check(!this.config.paused, "paused");
            check((await this.profile(account)).profile, "not a registered fulfiller");
            const kindConfig = this.config.kinds[order.kind];
            check(kindConfig?.enabled, "kind unavailable");
            if (kindConfig.access === "approved") {
              check(get<boolean>(`v3:approval:${account}`) === true, "fulfiller not approved");
            } else if (kindConfig.access !== "open") {
              check(kindConfig.access.allowlist.includes(account), "fulfiller not allowlisted");
            }
            check(account !== order.buyer, "buyer cannot claim");
            check(order.status === "funded", order.fulfiller ? "already claimed" : "not claimable");
            check(this.now() < BigInt(order.deadline_ns), "order expired");
            check(!order.quoted_by || account === order.quoted_by ||
              this.now() >= BigInt(order.created_at) + BigInt(kindConfig.quote_exclusive_ns), "quote exclusive");
            const stats = this.stats(account);
            const level = (await this.profile(account)).level;
            check(stats.active_claims < (kindConfig.access === "open" && level === 0
              ? kindConfig.open_max_active_claims : 3), "too many active claims");
            if (kindConfig.access === "open" && level === 0) {
              check(value(order) <= BigInt(kindConfig.open_max_order_value), "open order value limit");
            }
            const bond = this.bond(account);
            const lock = value(order) * BigInt(this.config.bond_per_job_bps) / BigInt(10_000);
            check(BigInt(bond.available) + BigInt(bond.locked) >= BigInt(this.config.min_bond), "bond below minimum");
            check(BigInt(bond.available) >= lock, "insufficient bond");
            bond.available = String(BigInt(bond.available) - lock);
            bond.locked = String(BigInt(bond.locked) + lock);
            this.saveBond(account, bond);
            stats.active_claims += 1;
            this.saveStats(account, stats);
            order.fulfiller = account;
            order.claimed_at = String(this.now());
            order.claimed_at_ns = order.claimed_at;
            order.bond_locked = String(lock);
            order.status = "claimed";
            this.index(account, order.id);
            break;
          }
          case "release_claim": {
            check(order.fulfiller === account, "not the fulfiller");
            check(["claimed", "sent", "proof_rejected"].includes(order.status), "release not allowed");
            this.unlock(order, BigInt(0));
            const stats = this.stats(account);
            stats.active_claims = Math.max(0, stats.active_claims - 1);
            this.saveStats(account, stats);
            order.status = "funded";
            order.fulfiller = null;
            order.claimed_at = null;
            order.claimed_at_ns = null;
            order.sent_at = null;
            if (order.quoted_by === account) order.quoted_by = null;
            break;
          }
          case "sent":
            check(this.config.kinds[order.kind]?.needs_sent, "sent not allowed");
            check(order.fulfiller === account, "not the fulfiller");
            check(order.status === "claimed", "not claimed");
            check(this.now() < BigInt(order.claimed_at!) + BigInt(this.config.claim_timeout_ns), "claim timed out");
            order.status = "sent";
            order.sent_at = String(this.now());
            break;
          case "submit_proof":
            check(order.kind !== "in_person", "proof not allowed");
            await this.submitProof(order, String(msg.proof_sha256), account, String(msg.spec || ""));
            break;
          case "confirm_delivery": {
            check(order.kind === "in_person", "wrong kind");
            check(order.fulfiller === account, "not the fulfiller");
            check(order.status === "claimed", "not claimed");
            check(this.now() < BigInt(order.deadline_ns), "order expired");
            check(
              this.now() < BigInt(order.claimed_at!) +
                BigInt(this.config.kinds.in_person.claim_timeout_ns),
              "claim timed out",
            );
            check((order.total_proof_attempts ?? 0) < 6, "proof budget used");
            order.total_proof_attempts = (order.total_proof_attempts ?? 0) + 1;
            order.attempts += 1;
            const secret = String(msg.secret_hex || "");
            const digest = /^[a-f0-9]{64}$/.test(secret)
              ? createHash("sha256").update(Buffer.from(secret, "hex")).digest("hex") : "";
            if (digest !== get<string>(`v3:delivery_hash:${order.id}`)) {
              order.last_reject_reason = "wrong delivery code";
              break;
            }
            const nullifier = specHash(`in_person:${order.id}`);
            if (get<string>(`v3:nullifier:${nullifier}`)) {
              order.last_reject_reason = "nullifier already used";
              break;
            }
            put(`v3:nullifier:${nullifier}`, "v3:nullifier", order.id);
            order.nullifier = nullifier;
            order.verified_at = String(this.now());
            await this.payout(order);
            break;
          }
          case "cancel":
            check(order.buyer === account, "not the buyer");
            check(order.status === "funded", "not cancellable");
            order.status = "cancelled";
            order.ended_at = String(this.now());
            this.settle(order);
            await this.move(escrowContract(), account, order.token, value(order));
            break;
          case "dispute": {
            const buyer = account === order.buyer;
            const fulfiller = account === order.fulfiller;
            const allowed = order.status === "paid"
              ? buyer && this.now() < BigInt(order.paid_at!) + BigInt(this.config.bond_hold_ns)
              : order.status === "verified" ? buyer
                : order.status === "under_review" && (buyer || fulfiller);
            check(allowed, "dispute not allowed");
            const reason = Number(msg.reason_code);
            check(Number.isInteger(reason) && reason >= 0 && reason <= 255, "bad reason_code");
            order.status = "disputed";
            order.dispute_reason = reason;
            order.disputed_by = account;
            break;
          }
          case "rate": {
            const stars = Number(msg.stars);
            check(Number.isInteger(stars) && stars >= 1 && stars <= 5, "stars must be 1..5");
            const anchor = order.status === "paid" || order.status === "closed"
              ? order.paid_at : order.status === "resolved" ? order.ended_at : null;
            check(anchor, "order not finished");
            check(this.now() <= BigInt(anchor) + BigInt(this.config.rating_window_ns), "rating window over");
            let target: string;
            if (account === order.buyer) {
              check(order.buyer_rating === null, "already rated");
              order.buyer_rating = stars;
              target = order.fulfiller!;
            } else if (account === order.fulfiller) {
              check(order.fulfiller_rating === null, "already rated");
              order.fulfiller_rating = stars;
              target = order.buyer;
            } else throw new Error("not a party");
            const rawWeight = value(order) / BigInt(this.config.rating_unit);
            const weight = Number(rawWeight > BigInt(10) ? BigInt(10) : rawWeight);
            const stats = this.stats(target);
            stats.star_sum += stars * weight;
            stats.star_count += weight;
            this.saveStats(target, stats);
            break;
          }
          default:
            throw new Error("bad msg");
        }
        this.save(order);
        latest = order;
      } else if (intent.intent === "ft_withdraw") {
        await this.move(
          account,
          `external:${String(intent.receiver_id)}`,
          `nep141:${String(intent.token)}`,
          BigInt(String(intent.amount)),
        );
      } else throw new Error("Unsupported mock intent");
    }
    return latest;
  }
  async submitProof(order: V3Order, proofSha256: string, signer?: string, spec?: string): Promise<void> {
    check(!this.config.paused, "paused");
    if (signer) check(order.fulfiller === signer, "not the fulfiller");
    check(["claimed", "sent", "proof_rejected"].includes(order.status), "not awaiting proof");
    const proof = proofSha256.toLowerCase();
    check(/^[a-f0-9]{64}$/.test(proof), "bad proof_sha256");
    if (signer) check(!!spec && specHash(spec) === order.spec_hash, "spec hash mismatch");
    check(order.attempts < 3, "no attempts left");
    const proofAnchor = order.sent_at || order.claimed_at;
    check(proofAnchor && this.now() < BigInt(proofAnchor) + BigInt(this.config.kinds[order.kind]?.proof_timeout_ns || this.config.proof_timeout_ns), "proof window over");
    order.attempts += 1;
    order.status = "verifying";
    order.verify_started_at = String(this.now());
    order.proof_sha256 = proof;
    this.save(order);
    const outcome = get<Verification>(`v3:verify:${order.id}`) || { ok: true, tx_ref_hash: proof };
    put(`v3:verify_result:${order.id}`, "v3:verify_result", outcome);
    put(`v3:verify:${order.id}`, "v3:verify", { ok: true, tx_ref_hash: proof });
    const nullifier = (outcome.tx_ref_hash || proof).toLowerCase();
    const rejection = this.verificationError(order, proof, outcome) ||
      (this.is_nullifier_used(nullifier) ? "nullifier already used" : null);
    if (rejection) {
      order.status = order.attempts >= 3 ? "under_review" : "proof_rejected";
      order.last_reject_reason = rejection;
      this.save(order);
      return;
    }
    put(`v3:nullifier:${nullifier}`, "v3:nullifier", order.id);
    order.nullifier = nullifier;
    order.verified_at = String(this.now());
    if (BigInt(this.config.challenge_window_ns) > BigInt(0)) {
      order.status = "verified";
      this.save(order);
    } else await this.payout(order);
  }
  async relayerSubmitProof(id: string, proofSha256: string, spec?: string): Promise<V3Order> {
    const order = await this.order(id);
    check(order, "order not found");
    // The service always forwards the canonical spec. Keeping the test helper
    // compatible with existing direct mock callers still exercises the same
    // hash guard by loading it from the backend store.
    const canonicalSpec = spec ?? get<{ spec: string }>(`v3:spec:${id}`)?.spec;
    check(!!canonicalSpec && specHash(canonicalSpec) === order.spec_hash, "spec hash mismatch");
    await this.submitProof(order, proofSha256, undefined, canonicalSpec);
    return (await this.order(id))!;
  }
  async expire(id: string): Promise<V3Order> {
    const order = await this.order(id);
    check(order && ["funded", "claimed"].includes(order.status), "not refundable");
    check(this.now() >= BigInt(order.deadline_ns), "deadline not reached");
    if (order.fulfiller) this.unlock(order, BigInt(0));
    order.status = "expired";
    order.ended_at = String(this.now());
    this.settle(order);
    this.save(order);
    await this.move(escrowContract(), order.buyer, order.token, value(order));
    return order;
  }
  async timeout(id: string): Promise<V3Order> {
    const order = await this.order(id);
    check(order, "order not found");
    if (order.status === "claimed" && this.now() >= BigInt(order.deadline_ns)) {
      return this.expire(id);
    }
    if (order.status === "claimed" && this.now() >= BigInt(order.claimed_at!) +
      BigInt(this.config.kinds[order.kind]?.claim_timeout_ns || this.config.claim_timeout_ns)) {
      const fulfiller = order.fulfiller!;
      const slash = BigInt(order.bond_locked);
      this.unlock(order, slash);
      const stats = this.stats(fulfiller);
      stats.active_claims = Math.max(0, stats.active_claims - 1);
      this.saveStats(fulfiller, stats);
      order.fulfiller = null;
      order.claimed_at = null;
      order.claimed_at_ns = null;
      order.status = "funded";
      await this.move(escrowContract(), order.buyer, this.config.bond_token, slash);
    } else if ((order.status === "sent" || order.status === "proof_rejected") && this.now() >= BigInt(order.sent_at!) + BigInt(this.config.proof_timeout_ns)) {
      order.status = "under_review";
    } else if (order.status === "verifying" && this.now() >= BigInt(order.verify_started_at!) + BigInt(this.config.proof_timeout_ns)) {
      order.status = order.attempts >= 3 ? "under_review" : "proof_rejected";
      order.last_reject_reason = "verification timed out";
    } else throw new Error("nothing to time out");
    this.save(order);
    return order;
  }
  async finalize(id: string): Promise<V3Order> {
    const order = await this.order(id);
    check(order && order.status === "verified", "not verified");
    check(this.now() >= BigInt(order.verified_at!) + BigInt(this.config.challenge_window_ns), "challenge window open");
    await this.payout(order);
    return order;
  }
  async releaseBond(id: string): Promise<V3Order> {
    const order = await this.order(id);
    check(order && order.status === "paid", "not paid");
    check(this.now() >= BigInt(order.paid_at!) + BigInt(this.config.bond_hold_ns), "bond hold not over");
    this.unlock(order, BigInt(0));
    order.status = "closed";
    order.ended_at = String(this.now());
    this.save(order);
    return order;
  }
  prune(id: string): void {
    const order = get<V3Order>(`v3:order:${id}`);
    check(order && ["closed", "resolved", "cancelled", "expired"].includes(order.status), "not finished");
    const ratingWindow = BigInt(this.config.rating_window_ns);
    check(this.now() >= BigInt(order.ended_at!) + ratingWindow &&
      this.now() >= BigInt(order.paid_at || "0") + ratingWindow, "rating window open");
    remove(`v3:order:${id}`);
    for (const account of [order.buyer, order.fulfiller].filter((value): value is string => !!value)) {
      const key = `v3:index:${account}`;
      put(key, "v3:index", (get<string[]>(key) || []).filter((indexed) => indexed !== id));
    }
  }
  async resolve(id: string, verdict: Verdict, noteHash: string | null = null): Promise<V3Order> {
    const order = await this.order(id);
    check(order && (order.status === "disputed" || order.status === "under_review"), "not disputed");
    const fulfiller = order.fulfiller!;
    if (!order.paid_at) {
      const toFulfiller = verdict === "buyer" ? BigInt(0) : verdict === "fulfiller" ? value(order) : value(order) / BigInt(2);
      this.unlock(order, BigInt(0));
      await this.move(escrowContract(), order.buyer, order.token, value(order) - toFulfiller);
      await this.move(escrowContract(), fulfiller, order.token, toFulfiller);
      if (verdict === "fulfiller") this.countJob(order);
    } else {
      const locked = BigInt(order.bond_locked);
      const cover = locked < value(order) ? locked : value(order);
      const slash = verdict === "buyer" ? cover : verdict === "split" ? cover / BigInt(2) : BigInt(0);
      this.unlock(order, slash);
      await this.move(escrowContract(), order.buyer, this.config.bond_token, slash);
    }
    if (verdict !== "split") {
      const loser = verdict === "buyer" ? fulfiller : order.buyer;
      const winner = verdict === "buyer" ? order.buyer : fulfiller;
      const losingStats = this.stats(loser);
      losingStats.disputes_lost += 1;
      this.saveStats(loser, losingStats);
      const winningStats = this.stats(winner);
      winningStats.disputes_won += 1;
      this.saveStats(winner, winningStats);
    }
    order.status = "resolved";
    order.verdict = verdict;
    order.verdict_note_hash = noteHash;
    order.ended_at = String(this.now());
    this.settle(order);
    this.save(order);
    return order;
  }
}

export class LiveEscrow implements EscrowBackend {
  async balance(account: string, token = USDC_TOKEN): Promise<string> {
    const balances = await view<string[]>(intentsContract(), "mt_batch_balance_of", {
      account_id: account, token_ids: [token],
    });
    return balances[0] || "0";
  }
  async profile(account: string): Promise<Profile> {
    const profile = await view<ContractProfile>(escrowContract(), "get_profile", {
      account_id: account,
    });
    return profileView(profile);
  }
  async order(id: string): Promise<V3Order | null> {
    const order = await view<ContractOrder | null>(escrowContract(), "get_order", { id });
    if (order) {
      put(`v3:observed:${id}`, "v3:observed", order);
      return orderView(order);
    }
    let recorded = get<ContractOrder>(`v3:final:${id}`) ||
      get<ContractOrder>(`v3:observed:${id}`);
    if (!recorded) {
      const submitted = get<{
        account_id: string;
        order: Pick<V3Order, "id" | "kind" | "spec_hash" | "pay_amount" | "reward" | "deadline_ns"> & { quoted_by?: string | null };
        submitted_at_ns: string;
      }>(`v3:submitted:${id}`);
      if (!submitted || submitted.order.id !== id ||
        (!get<boolean>(`v3:cancel_submitted:${id}`) &&
          BigInt(submitted.order.deadline_ns) > BigInt(Date.now()) * BigInt(1_000_000))) {
        return null;
      }
      recorded = {
        ...submitted.order,
        quoted_by: submitted.order.quoted_by ?? null,
        buyer: submitted.account_id,
        token: USDC_TOKEN,
        created_at: submitted.submitted_at_ns,
        fulfiller: null,
        bond_locked: "0",
        claimed_at: null,
        sent_at: null,
        verify_started_at: null,
        verified_at: null,
        paid_at: null,
        ended_at: null,
        proof_sha256: null,
        nullifier: null,
        status: "funded",
        attempts: 0,
        last_reject_reason: null,
        buyer_rating: null,
        fulfiller_rating: null,
        dispute_reason: null,
        disputed_by: null,
        verdict: null,
        verdict_note_hash: null,
      };
    }
    const status = ["paid", "closed", "resolved", "cancelled", "expired"].includes(recorded.status)
      ? recorded.status
      : get<boolean>(`v3:cancel_submitted:${id}`) ? "cancelled"
      : BigInt(recorded.deadline_ns) <= BigInt(Date.now()) * BigInt(1_000_000)
        ? "expired" : "cancelled";
    const final = { ...recorded, status, ended_at: recorded.ended_at || String(Date.now() * 1_000_000) };
    put(`v3:final:${id}`, "v3:final", final);
    return orderView(final);
  }
  get_order(id: string): Promise<V3Order | null> {
    return view<ContractOrder | null>(escrowContract(), "get_order", { id })
      .then((order) => order ? orderView(order) : null);
  }
  async orders(status?: string, account?: string, from = 0, limit = 50): Promise<V3Order[]> {
    const orders = account
      ? await view<ContractOrder[]>(escrowContract(), "orders_by_account", { account_id: account, from, limit })
      : await view<ContractOrder[]>(escrowContract(), "list_orders", { status: status || null, from, limit });
    for (const order of orders) {
      put(`v3:observed:${order.id}`, "v3:observed", order);
    }
    const submitted = list<{
      account_id: string;
      order: { id: string; deadline_ns: string };
    }>("v3:submitted").filter((entry) =>
      !account || entry.account_id === account);
    for (const entry of submitted.slice(-100)) {
      const id = entry.order.id;
      if (orders.some((order) => order.id === id) || get<ContractOrder>(`v3:final:${id}`)) {
        continue;
      }
      const canBeFinal = !!get<boolean>(`v3:cancel_submitted:${id}`) ||
        BigInt(entry.order.deadline_ns) <= BigInt(Date.now()) * BigInt(1_000_000);
      if (canBeFinal) await this.order(id);
    }
    const knownFinal = list<ContractOrder>("v3:final")
      .filter((order) => (!account || order.buyer === account || order.fulfiller === account) &&
        (!status || order.status === status));
    return [...orders, ...knownFinal]
      .filter((order) => !status || order.status === status)
      .slice(0, limit)
      .map(orderView);
  }
  list_orders(status?: Status, from?: number, limit?: number): Promise<V3Order[]> {
    return this.orders(status, undefined, from, limit);
  }
  orders_by_account(account_id: string, from?: number, limit?: number): Promise<V3Order[]> {
    return this.orders(undefined, account_id, from, limit);
  }
  get_profile(account_id: string): Promise<Profile> {
    return this.profile(account_id);
  }
  get_config(): Promise<MockConfig> { return view<MockConfig>(escrowContract(), "get_config"); }
  is_nullifier_used(tx_ref_hash: string): Promise<string | null> {
    return view<string | null>(escrowContract(), "is_nullifier_used", { tx_ref_hash });
  }
  get_owed(account_id: string, token_id: string): Promise<string> {
    return view<string>(escrowContract(), "get_owed", { account_id, token_id });
  }
  get_counts(): Promise<[number, number]> { return view<[number, number]>(escrowContract(), "get_counts"); }
}

export function escrowBackend(): EscrowBackend {
  return mode() === "mock" ? new MockEscrow() : new LiveEscrow();
}
