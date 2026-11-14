use near_sdk::json_types::{U128, U64};
use near_sdk::{near, AccountId};

pub const MAX_ATTEMPTS: u8 = 3;
pub const MAX_TOTAL_PROOF_ATTEMPTS: u8 = 6;
pub const MAX_OPEN_ORDERS_PER_BUYER: u32 = 5;
pub const MAX_ACTIVE_CLAIMS: u32 = 3;
pub const MAX_ACCOUNT_INDEX: usize = 100;
pub const MAX_DEADLINE_NS: u64 = 30 * 24 * 3_600 * 1_000_000_000;
pub const MAX_LIST_LIMIT: u32 = 100;
pub const BPS_DENOM: u128 = 10_000;

#[near(serializers = [borsh, json])]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Status {
    Funded,
    Claimed,
    Sent,
    Verifying,
    ProofRejected,
    /// Proof verified, waiting for `challenge_window_ns` before payout.
    Verified,
    UnderReview,
    Paid,
    Closed,
    Disputed,
    Resolved,
    Cancelled,
    Expired,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Verdict {
    Buyer,
    Fulfiller,
    Split,
}

#[near(serializers = [borsh])]
#[derive(Clone, Debug, PartialEq)]
pub struct Order {
    pub id: String,
    pub buyer: AccountId,
    pub token: String,
    pub pay_amount: u128,
    pub reward: u128,
    pub kind: String,
    pub spec_hash: String,
    pub quoted_by: Option<AccountId>,
    pub deadline_ns: u64,
    pub created_at: u64,
    pub fulfiller: Option<AccountId>,
    pub bond_locked: u128,
    pub claimed_at: Option<u64>,
    pub sent_at: Option<u64>,
    pub verify_started_at: Option<u64>,
    pub verified_at: Option<u64>,
    pub paid_at: Option<u64>,
    pub ended_at: Option<u64>,
    pub proof_sha256: Option<String>,
    pub nullifier: Option<String>,
    pub status: Status,
    pub attempts: u8,
    pub last_reject_reason: Option<String>,
    /// Stars the buyer gave the fulfiller.
    pub buyer_rating: Option<u8>,
    /// Stars the fulfiller gave the buyer.
    pub fulfiller_rating: Option<u8>,
    pub dispute_reason: Option<u8>,
    pub disputed_by: Option<AccountId>,
    pub verdict: Option<Verdict>,
    pub verdict_note_hash: Option<String>,
    /// Buyer/fulfiller counters already moved out of "open"/"active".
    pub settled: bool,
    /// Monotonic identity of the last OutLayer request for this order.
    pub verify_seq: u32,
    /// Proof requests paid for across every claim on this order.
    pub total_proof_attempts: u8,
}

impl Order {
    pub fn value(&self) -> u128 {
        // checked at funding time
        self.pay_amount + self.reward
    }
}

#[derive(near_sdk::serde::Serialize, near_sdk::NearSchema)]
#[serde(crate = "near_sdk::serde")]
#[abi(json)]
#[derive(Clone, Debug)]
pub struct OrderView {
    pub id: String,
    pub buyer: AccountId,
    pub token: String,
    pub pay_amount: U128,
    pub reward: U128,
    pub kind: String,
    pub spec_hash: String,
    pub quoted_by: Option<AccountId>,
    pub deadline_ns: U64,
    pub created_at: U64,
    pub fulfiller: Option<AccountId>,
    pub bond_locked: U128,
    pub claimed_at: Option<U64>,
    pub sent_at: Option<U64>,
    pub verify_started_at: Option<U64>,
    pub verified_at: Option<U64>,
    pub paid_at: Option<U64>,
    pub ended_at: Option<U64>,
    pub proof_sha256: Option<String>,
    pub nullifier: Option<String>,
    pub status: Status,
    pub attempts: u8,
    pub verify_seq: u32,
    pub total_proof_attempts: u8,
    pub last_reject_reason: Option<String>,
    pub buyer_rating: Option<u8>,
    pub fulfiller_rating: Option<u8>,
    pub dispute_reason: Option<u8>,
    pub disputed_by: Option<AccountId>,
    pub verdict: Option<Verdict>,
    pub verdict_note_hash: Option<String>,
}

impl From<&Order> for OrderView {
    fn from(o: &Order) -> Self {
        Self {
            id: o.id.clone(),
            buyer: o.buyer.clone(),
            token: o.token.clone(),
            pay_amount: U128(o.pay_amount),
            reward: U128(o.reward),
            kind: o.kind.clone(),
            spec_hash: o.spec_hash.clone(),
            quoted_by: o.quoted_by.clone(),
            deadline_ns: U64(o.deadline_ns),
            created_at: U64(o.created_at),
            fulfiller: o.fulfiller.clone(),
            bond_locked: U128(o.bond_locked),
            claimed_at: o.claimed_at.map(U64),
            sent_at: o.sent_at.map(U64),
            verify_started_at: o.verify_started_at.map(U64),
            verified_at: o.verified_at.map(U64),
            paid_at: o.paid_at.map(U64),
            ended_at: o.ended_at.map(U64),
            proof_sha256: o.proof_sha256.clone(),
            nullifier: o.nullifier.clone(),
            status: o.status,
            attempts: o.attempts,
            verify_seq: o.verify_seq,
            total_proof_attempts: o.total_proof_attempts,
            last_reject_reason: o.last_reject_reason.clone(),
            buyer_rating: o.buyer_rating,
            fulfiller_rating: o.fulfiller_rating,
            dispute_reason: o.dispute_reason,
            disputed_by: o.disputed_by.clone(),
            verdict: o.verdict,
            verdict_note_hash: o.verdict_note_hash.clone(),
        }
    }
}

#[near(serializers = [borsh])]
#[derive(near_sdk::serde::Serialize, near_sdk::NearSchema)]
#[serde(crate = "near_sdk::serde")]
#[abi(json)]
#[derive(Clone, Debug, Default, PartialEq)]
pub struct Stats {
    pub jobs_done: u32,
    pub jobs_as_buyer: u32,
    /// Weighted star sum (stars * weight).
    pub star_sum: u64,
    /// Sum of weights.
    pub star_count: u64,
    pub disputes_lost: u32,
    pub disputes_won: u32,
    pub volume: U128,
    pub open_as_buyer: u32,
    pub active_claims: u32,
}

#[near(serializers = [borsh])]
#[derive(near_sdk::serde::Serialize, near_sdk::NearSchema)]
#[serde(crate = "near_sdk::serde")]
#[abi(json)]
#[derive(Clone, Debug, Default, PartialEq)]
pub struct Bond {
    pub available: U128,
    pub locked: U128,
}

#[near(serializers = [borsh])]
#[derive(near_sdk::serde::Serialize, near_sdk::NearSchema)]
#[serde(crate = "near_sdk::serde")]
#[abi(json)]
#[derive(Clone, Debug, PartialEq)]
pub struct Profile {
    pub bank_bin: String,
    pub account_last4: String,
    pub registered_at: U64,
}

#[derive(near_sdk::serde::Serialize, near_sdk::NearSchema)]
#[serde(crate = "near_sdk::serde")]
#[abi(json)]
pub struct ProfileView {
    pub account_id: AccountId,
    pub profile: Option<Profile>,
    pub stats: Stats,
    pub level: u8,
    pub bond: Bond,
    /// Owner-approved to claim orders (see `require_fulfiller_approval`).
    pub approved: bool,
}

pub fn level(s: &Stats) -> u8 {
    let jobs = s.jobs_done as u64;
    let lost = s.disputes_lost as u64;
    if jobs >= 20 && lost * 20 < jobs {
        2
    } else if jobs >= 5 && lost == 0 {
        1
    } else {
        0
    }
}

#[derive(near_sdk::serde::Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct FundOrder {
    pub id: String,
    pub kind: String,
    pub spec_hash: String,
    pub quoted_by: Option<AccountId>,
    pub pay_amount: U128,
    pub reward: U128,
    pub deadline_ns: U64,
}

/// `msg` of `mt_on_transfer` and `on_auth`: `{"op": "<name>", ...fields}`.
/// One flat struct (instead of a serde-tagged enum) keeps the wasm small.
///
/// mt_on_transfer ops: `fund {order}`, `bond`.
/// on_auth ops: `register_fulfiller {bank_bin, account_last4}`, `claim {order_id}`,
/// `sent {order_id}`, `submit_proof {order_id, proof_sha256}`, `cancel {order_id}`,
/// `dispute {order_id, reason_code}`, `rate {order_id, stars}`, `withdraw_bond {amount}`.
#[derive(near_sdk::serde::Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct Msg {
    pub op: String,
    pub order: Option<FundOrder>,
    pub order_id: Option<String>,
    pub proof_sha256: Option<String>,
    pub spec: Option<String>,
    pub secret_hex: Option<String>,
    pub bank_bin: Option<String>,
    pub account_last4: Option<String>,
    pub reason_code: Option<u8>,
    pub stars: Option<u8>,
    pub amount: Option<U128>,
}

pub fn req<T>(v: Option<T>, field: &str) -> T {
    v.unwrap_or_else(|| near_sdk::env::panic_str(&format!("missing {field}")))
}

pub fn is_hex64(s: &str) -> bool {
    s.len() == 64
        && s.bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}

pub fn is_order_id(s: &str) -> bool {
    (6..=16).contains(&s.len())
        && s.bytes()
            .all(|b| b.is_ascii_uppercase() || b.is_ascii_digit() || b == b'-')
}

pub fn is_digits(s: &str, n: usize) -> bool {
    s.len() == n && s.bytes().all(|b| b.is_ascii_digit())
}

/// Uppercases and keeps only `[A-Z0-9]`, so bank-mangled notes like
/// `ful 0001`, `FUL.0001` or `FUL0001` all compare equal to `FUL-0001`.
pub fn norm_note(s: &str) -> String {
    s.bytes()
        .filter(u8::is_ascii_alphanumeric)
        .map(|b| b.to_ascii_uppercase() as char)
        .collect()
}

/// True if the normalised `note` contains the normalised order `id`.
pub fn note_has_id(note: &str, id: &str) -> bool {
    let id = norm_note(id);
    !id.is_empty() && norm_note(note).contains(&id)
}
