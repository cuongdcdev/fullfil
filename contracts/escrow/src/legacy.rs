//! Exact c0740f2 Borsh layouts. Keep field order and types unchanged.
use near_sdk::borsh::BorshDeserialize;
#[cfg(test)]
use near_sdk::borsh::BorshSerialize;
use near_sdk::json_types::{U128, U64};
use near_sdk::store::{IterableMap, LookupMap, LookupSet};
use near_sdk::AccountId;

use crate::{Bond, Order, Profile, Stats};
#[cfg(test)]
use crate::{Status, Verdict};

#[derive(BorshDeserialize)]
#[cfg_attr(test, derive(BorshSerialize))]
#[borsh(crate = "near_sdk::borsh")]
#[allow(dead_code)]
pub struct LegacyConfig {
    pub owner: AccountId,
    pub intents_contract: AccountId,
    pub outlayer_contract: AccountId,
    pub verifier_source: String,
    pub verifier_resource_limits: String,
    pub secrets_profile: Option<String>,
    pub proof_blob_base_url: String,
    pub outlayer_deposit: U128,
    pub outlayer_gas_tgas: u64,
    pub arbiter: AccountId,
    pub relayer: AccountId,
    pub accepted_tokens: Vec<String>,
    pub bond_token: String,
    pub allowed_dkim_domains: Vec<String>,
    pub min_bond: U128,
    pub bond_per_job_bps: u16,
    pub min_order_amount: U128,
    pub bond_hold_ns: U64,
    pub challenge_window_ns: U64,
    pub claim_timeout_ns: U64,
    pub proof_timeout_ns: U64,
    pub rating_window_ns: U64,
    pub max_email_skew_ns: U64,
    pub rating_unit: U128,
    pub max_orders: u32,
    pub max_profiles: u32,
    pub paused: bool,
    pub require_fulfiller_approval: bool,
}

#[cfg(test)]
#[derive(BorshDeserialize, BorshSerialize)]
#[borsh(crate = "near_sdk::borsh")]
pub struct LegacyOrder {
    pub id: String,
    pub buyer: AccountId,
    pub token: String,
    pub pay_amount: u128,
    pub reward: u128,
    pub amount_vnd: u64,
    pub merchant_hash: String,
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
    pub buyer_rating: Option<u8>,
    pub fulfiller_rating: Option<u8>,
    pub dispute_reason: Option<u8>,
    pub disputed_by: Option<AccountId>,
    pub verdict: Option<Verdict>,
    pub verdict_note_hash: Option<String>,
    pub settled: bool,
}

#[derive(BorshDeserialize)]
#[cfg_attr(test, derive(BorshSerialize))]
#[borsh(crate = "near_sdk::borsh")]
pub struct LegacyState {
    pub config: LegacyConfig,
    // IterableMap's root Borsh layout is independent of its value type. We
    // decode values from raw storage while migrating, never through this map.
    pub orders: IterableMap<String, Order>,
    pub used_ids: LookupSet<String>,
    pub by_account: LookupMap<AccountId, Vec<String>>,
    pub profiles: LookupMap<AccountId, Profile>,
    pub profiles_count: u32,
    pub stats: LookupMap<AccountId, Stats>,
    pub bonds: LookupMap<AccountId, Bond>,
    pub nullifiers: LookupMap<String, String>,
    pub owed: LookupMap<(AccountId, String), u128>,
    pub approved: LookupSet<AccountId>,
    pub liabilities: LookupMap<String, u128>,
}
