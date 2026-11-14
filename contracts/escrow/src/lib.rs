//! Fulfil escrow (CONTRACT_SPEC v1).
//!
//! * All funds are NEP-245 balances of this account inside `intents_contract`.
//! * Money in: `intents_contract` calls `mt_on_transfer` (signed `transfer` intent with `msg`).
//! * Actions: `intents_contract` calls `on_auth(signer_id, msg)` (signed `auth_call` intent).
//! * Money out: this contract calls `intents_contract.mt_transfer` (1 yocto) as predecessor.
//! * Payout is gated by an OutLayer `request_execution` of the email verifier.
//!
//! Every state transition is written before any promise is created, and every
//! outgoing transfer has a callback that books failed transfers into `owed`
//! (retryable by anyone with `retry_owed`).

mod legacy;
mod types;
mod verify;

#[cfg(test)]
mod tests;

use near_sdk::json_types::{U128, U64};
use near_sdk::serde::{
    de::{MapAccess, Visitor},
    ser::{SerializeMap, SerializeStruct},
    Deserialize, Deserializer, Serialize, Serializer,
};
use near_sdk::serde_json::{self, json, Value};
use near_sdk::store::{IterableMap, LookupMap, LookupSet};
use near_sdk::{
    assert_one_yocto, env, ext_contract, near, require, AccountId, BorshStorageKey, Gas, NearToken,
    PanicOnDefault, Promise, PromiseError, PromiseOrValue,
};

pub use types::*;
use verify::{check_output, parse_outlayer};

const GAS_MT_TRANSFER: Gas = Gas::from_tgas(15);
const GAS_ON_SENT: Gas = Gas::from_tgas(5);
const GAS_VERIFY_CB: Gas = Gas::from_tgas(40);
const GAS_SUBMIT_OVERHEAD: Gas = Gas::from_tgas(10);
const GAS_BALANCE_OF: Gas = Gas::from_tgas(5);
const GAS_SWEEP_CB: Gas = Gas::from_tgas(30);
const MAX_RESULT_LEN: usize = 8 * 1024;
/// NEAR kept free on the account on top of storage when paying OutLayer.
const NEAR_RESERVE: NearToken = NearToken::from_millinear(50);
const EVENT_STANDARD: &str = "fulfil";
const EVENT_VERSION: &str = "1.0.0";
const W9_STATE_MARKER: &[u8] = b"fulfil:w9:state";
const STORAGE_RESERVE_KEY: &[u8] = b"fulfil:w9:storage_reserve";
const DEFAULT_STORAGE_RESERVE: NearToken = NearToken::from_near(1);
const MIGRATION_BATCH: u32 = 20;
const IN_PERSON_HASH_PREFIX: &[u8] = b"fulfil:in_person:hash:";
const TOKEN_BUY_CLAIM_PREFIX: &[u8] = b"fulfil:token_buy:claim:";
const IN_PERSON_MIN_VALUE: u128 = 1_000_000;
const IN_PERSON_MAX_VALUE: u128 = 20_000_000;
const TOKEN_BUY_MIN_PAY_AMOUNT: u128 = 1_000_000;
const HOUR_NS: u64 = 3_600_000_000_000;

fn in_person_hash_key(order_id: &str) -> Vec<u8> {
    let mut key = Vec::with_capacity(IN_PERSON_HASH_PREFIX.len() + order_id.len());
    key.extend_from_slice(IN_PERSON_HASH_PREFIX);
    key.extend_from_slice(order_id.as_bytes());
    key
}

fn token_buy_claim_key(account_id: &AccountId) -> Vec<u8> {
    let mut key = Vec::with_capacity(TOKEN_BUY_CLAIM_PREFIX.len() + account_id.as_str().len());
    key.extend_from_slice(TOKEN_BUY_CLAIM_PREFIX);
    key.extend_from_slice(account_id.as_bytes());
    key
}

fn decode_lower_hex_32(hex: &str) -> Option<[u8; 32]> {
    if !is_hex64(hex) {
        return None;
    }
    let mut bytes = [0_u8; 32];
    for (index, pair) in hex.as_bytes().chunks_exact(2).enumerate() {
        let digit = |c: u8| -> u8 {
            if c.is_ascii_digit() {
                c - b'0'
            } else {
                c - b'a' + 10
            }
        };
        bytes[index] = (digit(pair[0]) << 4) | digit(pair[1]);
    }
    Some(bytes)
}

fn in_person_delivery_hash(f: &FundOrder, spec: &str, value: u128) -> [u8; 32] {
    require!(spec.len() <= 512, "spec too long");
    let parsed: Value =
        serde_json::from_str(spec).unwrap_or_else(|_| env::panic_str("bad in_person spec"));
    let fields = parsed
        .as_object()
        .unwrap_or_else(|| env::panic_str("bad in_person spec"));
    require!(fields.len() == 5 && parsed["v"] == 1, "bad in_person spec");
    require!(
        parsed["area"].is_string() && parsed["item_desc"].is_string(),
        "bad in_person spec"
    );
    let price_text = parsed["price"].as_str().unwrap_or("");
    let hash = decode_lower_hex_32(parsed["delivery_hash"].as_str().unwrap_or(""))
        .unwrap_or_else(|| env::panic_str("bad delivery_hash"));
    require!(
        price_text
            .bytes()
            .next()
            .is_some_and(|b| (b'1'..=b'9').contains(&b))
            && price_text.bytes().all(|b| b.is_ascii_digit()),
        "bad price"
    );
    let price = price_text.parse::<u128>().unwrap_or(0);
    require!(
        (IN_PERSON_MIN_VALUE..=IN_PERSON_MAX_VALUE).contains(&price),
        "bad price"
    );
    require!(price == f.pay_amount.0, "price != pay_amount");
    require!(
        (IN_PERSON_MIN_VALUE..=IN_PERSON_MAX_VALUE).contains(&value),
        "in_person value out of range"
    );
    require!(
        sha256_hex(spec.as_bytes()) == f.spec_hash,
        "spec hash mismatch"
    );
    hash
}

fn in_person_kind_config() -> KindConfig {
    KindConfig {
        enabled: true,
        // Verification is on-chain. KindConfig still requires a JSON object.
        verifier_source: "{}".into(),
        secrets_ref: None,
        access: Access::Named("open".into()),
        needs_sent: false,
        claim_timeout_ns: U64(24 * HOUR_NS),
        proof_timeout_ns: U64(24 * HOUR_NS),
        max_deadline_ns: U64(24 * HOUR_NS),
        quote_exclusive_ns: default_quote_exclusive(),
        open_max_active_claims: default_open_claims(),
        open_max_order_value: U128(IN_PERSON_MAX_VALUE),
    }
}

fn token_buy_kind_config() -> KindConfig {
    KindConfig {
        enabled: true,
        verifier_source:
            r#"{"Project":{"project_id":"nearfullfil.near/token-verifier","version_key":null}}"#
                .into(),
        secrets_ref: Some(SecretsRef {
            profile: "default".into(),
            account_id: env::current_account_id(),
        }),
        access: Access::Named("open".into()),
        needs_sent: false,
        claim_timeout_ns: U64(20 * 60 * 1_000_000_000),
        proof_timeout_ns: U64(20 * 60 * 1_000_000_000),
        max_deadline_ns: U64(24 * HOUR_NS),
        quote_exclusive_ns: default_quote_exclusive(),
        open_max_active_claims: 1,
        open_max_order_value: U128(5_250_000),
    }
}

fn sha256_hex(bytes: &[u8]) -> String {
    let mut result = String::with_capacity(64);
    const HEX: &[u8; 16] = b"0123456789abcdef";
    for byte in env::sha256(bytes) {
        result.push(HEX[(byte >> 4) as usize] as char);
        result.push(HEX[(byte & 0x0f) as usize] as char);
    }
    result
}

#[ext_contract(ext_mt)]
#[allow(dead_code)]
trait MultiTokenCore {
    fn mt_transfer(
        &mut self,
        receiver_id: AccountId,
        token_id: String,
        amount: U128,
        approval: Option<(AccountId, u64)>,
        memo: Option<String>,
    );
    fn mt_balance_of(&self, account_id: AccountId, token_id: String) -> U128;
}

#[ext_contract(ext_outlayer)]
#[allow(dead_code)]
trait OutLayer {
    #[allow(clippy::too_many_arguments)]
    fn request_execution(
        &mut self,
        source: Value,
        resource_limits: Option<Value>,
        input_data: Option<String>,
        secrets_ref: Option<Value>,
        response_format: Option<String>,
        payer_account_id: Option<AccountId>,
        params: Option<Value>,
    );
}

#[near(serializers = [borsh])]
#[derive(BorshStorageKey)]
enum Key {
    Orders,
    UsedIds,
    ByAccount,
    Profiles,
    Stats,
    Bonds,
    Nullifiers,
    Owed,
    Approved,
    Liabilities,
    /// Raw storage prefix (byte 10) for applied rating weights. Deliberately
    /// NOT a field of `Contract`: the root struct keeps its v1 borsh layout,
    /// so upgrading the live contract needs no state migration.
    /// Key: `[10, side] ++ order_id`, value: 1 byte (weight, 0..=10).
    RatingWeights,
}

#[near(serializers = [borsh])]
#[derive(Clone, Debug, near_sdk::NearSchema)]
#[abi(json)]
pub struct SecretsRef {
    pub profile: String,
    pub account_id: AccountId,
}

impl Serialize for SecretsRef {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let mut s = serializer.serialize_struct("SecretsRef", 2)?;
        s.serialize_field("profile", &self.profile)?;
        s.serialize_field("account_id", &self.account_id)?;
        s.end()
    }
}

impl<'de> Deserialize<'de> for SecretsRef {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        struct SecretsVisitor;
        impl<'de> Visitor<'de> for SecretsVisitor {
            type Value = SecretsRef;
            fn expecting(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
                f.write_str("object")
            }
            fn visit_map<M: MapAccess<'de>>(self, mut map: M) -> Result<SecretsRef, M::Error> {
                let mut profile = None;
                let mut account_id = None;
                while let Some(key) = map.next_key::<String>()? {
                    match key.as_str() {
                        "profile" => profile = Some(map.next_value()?),
                        "account_id" => account_id = Some(map.next_value()?),
                        _ => return Err(near_sdk::serde::de::Error::custom("unknown field")),
                    }
                }
                Ok(SecretsRef {
                    profile: profile.unwrap_or_else(|| env::panic_str("missing field")),
                    account_id: account_id.unwrap_or_else(|| env::panic_str("missing field")),
                })
            }
        }
        deserializer.deserialize_map(SecretsVisitor)
    }
}

#[near(serializers = [borsh])]
#[derive(Clone, Debug, near_sdk::NearSchema)]
#[abi(json)]
pub enum Access {
    Named(String),
    Allowlist { allowlist: Vec<AccountId> },
    MinBond { min_bond: U128 },
}

impl Serialize for Access {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        match self {
            Self::Named(name) => serializer.serialize_str(name),
            Self::Allowlist { allowlist } => {
                let mut map = serializer.serialize_map(Some(1))?;
                map.serialize_entry("allowlist", allowlist)?;
                map.end()
            }
            Self::MinBond { min_bond } => {
                let mut map = serializer.serialize_map(Some(1))?;
                map.serialize_entry("min_bond", min_bond)?;
                map.end()
            }
        }
    }
}

impl<'de> Deserialize<'de> for Access {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        struct AccessVisitor;
        impl<'de> Visitor<'de> for AccessVisitor {
            type Value = Access;

            fn expecting(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
                f.write_str("access")
            }

            fn visit_str<E: near_sdk::serde::de::Error>(self, value: &str) -> Result<Access, E> {
                Ok(Access::Named(value.to_string()))
            }

            fn visit_map<M: MapAccess<'de>>(self, mut map: M) -> Result<Access, M::Error> {
                let Some(key) = map.next_key::<String>()? else {
                    return Err(near_sdk::serde::de::Error::custom("bad access"));
                };
                let access = match key.as_str() {
                    "allowlist" => Access::Allowlist {
                        allowlist: map.next_value()?,
                    },
                    "min_bond" => Access::MinBond {
                        min_bond: map.next_value()?,
                    },
                    _ => return Err(near_sdk::serde::de::Error::custom("bad access")),
                };
                if map.next_key::<String>()?.is_some() {
                    return Err(near_sdk::serde::de::Error::custom("bad access"));
                }
                Ok(access)
            }
        }
        deserializer.deserialize_any(AccessVisitor)
    }
}

#[near(serializers = [borsh])]
#[derive(Clone, Debug, Default, near_sdk::NearSchema)]
#[abi(json)]
pub struct KindMap(Vec<(String, KindConfig)>);

impl KindMap {
    pub fn get(&self, name: &str) -> Option<&KindConfig> {
        self.0
            .iter()
            .find(|(key, _)| key == name)
            .map(|(_, value)| value)
    }

    pub fn get_mut(&mut self, name: &str) -> Option<&mut KindConfig> {
        self.0
            .iter_mut()
            .find(|(key, _)| key == name)
            .map(|(_, value)| value)
    }

    pub fn contains_key(&self, name: &str) -> bool {
        self.get(name).is_some()
    }

    pub fn insert(&mut self, name: String, config: KindConfig) {
        if let Some(existing) = self.get_mut(&name) {
            *existing = config;
        } else {
            self.0.push((name, config));
        }
    }

    pub fn remove(&mut self, name: &str) -> Option<KindConfig> {
        self.0
            .iter()
            .position(|(key, _)| key == name)
            .map(|index| self.0.remove(index).1)
    }
}

impl std::ops::Index<&str> for KindMap {
    type Output = KindConfig;

    fn index(&self, name: &str) -> &Self::Output {
        self.get(name).expect("unknown kind")
    }
}

impl Serialize for KindMap {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let mut map = serializer.serialize_map(Some(self.0.len()))?;
        for (name, config) in &self.0 {
            map.serialize_entry(name, config)?;
        }
        map.end()
    }
}

impl<'de> Deserialize<'de> for KindMap {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        struct KindVisitor;
        impl<'de> Visitor<'de> for KindVisitor {
            type Value = KindMap;

            fn expecting(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
                f.write_str("object")
            }

            fn visit_map<M: MapAccess<'de>>(self, mut map: M) -> Result<KindMap, M::Error> {
                let mut kinds = KindMap::default();
                while let Some((name, config)) = map.next_entry::<String, KindConfig>()? {
                    kinds.insert(name, config);
                }
                Ok(kinds)
            }
        }
        deserializer.deserialize_map(KindVisitor)
    }
}

#[near(serializers = [borsh])]
#[derive(Clone, Debug, near_sdk::NearSchema)]
#[abi(json)]
pub struct KindConfig {
    pub enabled: bool,
    pub verifier_source: String,
    pub secrets_ref: Option<SecretsRef>,
    pub access: Access,
    pub needs_sent: bool,
    pub claim_timeout_ns: U64,
    pub proof_timeout_ns: U64,
    pub max_deadline_ns: U64,
    pub quote_exclusive_ns: U64,
    pub open_max_active_claims: u32,
    pub open_max_order_value: U128,
}

impl Serialize for KindConfig {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let mut s = serializer.serialize_struct("KindConfig", 11)?;
        s.serialize_field("enabled", &self.enabled)?;
        s.serialize_field("verifier_source", &self.verifier_source)?;
        s.serialize_field("secrets_ref", &self.secrets_ref)?;
        s.serialize_field("access", &self.access)?;
        s.serialize_field("needs_sent", &self.needs_sent)?;
        s.serialize_field("claim_timeout_ns", &self.claim_timeout_ns)?;
        s.serialize_field("proof_timeout_ns", &self.proof_timeout_ns)?;
        s.serialize_field("max_deadline_ns", &self.max_deadline_ns)?;
        s.serialize_field("quote_exclusive_ns", &self.quote_exclusive_ns)?;
        s.serialize_field("open_max_active_claims", &self.open_max_active_claims)?;
        s.serialize_field("open_max_order_value", &self.open_max_order_value)?;
        s.end()
    }
}

impl<'de> Deserialize<'de> for KindConfig {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        struct KindConfigVisitor;
        impl<'de> Visitor<'de> for KindConfigVisitor {
            type Value = KindConfig;

            fn expecting(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
                f.write_str("object")
            }

            fn visit_map<M: MapAccess<'de>>(self, mut map: M) -> Result<KindConfig, M::Error> {
                let mut enabled = None;
                let mut verifier_source = None;
                let mut secrets_ref = None;
                let mut access = None;
                let mut needs_sent = None;
                let mut claim_timeout_ns = None;
                let mut proof_timeout_ns = None;
                let mut max_deadline_ns = None;
                let mut quote_exclusive_ns = None;
                let mut open_max_active_claims = None;
                let mut open_max_order_value = None;
                while let Some(key) = map.next_key::<String>()? {
                    match key.as_str() {
                        "enabled" => enabled = Some(map.next_value()?),
                        "verifier_source" => verifier_source = Some(map.next_value()?),
                        "secrets_ref" => secrets_ref = Some(map.next_value()?),
                        "access" => access = Some(map.next_value()?),
                        "needs_sent" => needs_sent = Some(map.next_value()?),
                        "claim_timeout_ns" => claim_timeout_ns = Some(map.next_value()?),
                        "proof_timeout_ns" => proof_timeout_ns = Some(map.next_value()?),
                        "max_deadline_ns" => max_deadline_ns = Some(map.next_value()?),
                        "quote_exclusive_ns" => quote_exclusive_ns = Some(map.next_value()?),
                        "open_max_active_claims" => {
                            open_max_active_claims = Some(map.next_value()?)
                        }
                        "open_max_order_value" => open_max_order_value = Some(map.next_value()?),
                        _ => return Err(near_sdk::serde::de::Error::custom("unknown field")),
                    }
                }
                Ok(KindConfig {
                    enabled: enabled.unwrap_or_else(|| env::panic_str("missing field")),
                    verifier_source: verifier_source
                        .unwrap_or_else(|| env::panic_str("missing field")),
                    secrets_ref: secrets_ref.unwrap_or(None),
                    access: access.unwrap_or_else(|| env::panic_str("missing field")),
                    needs_sent: needs_sent.unwrap_or_else(|| env::panic_str("missing field")),
                    claim_timeout_ns: claim_timeout_ns
                        .unwrap_or_else(|| env::panic_str("missing field")),
                    proof_timeout_ns: proof_timeout_ns
                        .unwrap_or_else(|| env::panic_str("missing field")),
                    max_deadline_ns: max_deadline_ns
                        .unwrap_or_else(|| env::panic_str("missing field")),
                    quote_exclusive_ns: quote_exclusive_ns.unwrap_or_else(default_quote_exclusive),
                    open_max_active_claims: open_max_active_claims
                        .unwrap_or_else(default_open_claims),
                    open_max_order_value: open_max_order_value.unwrap_or_else(default_open_value),
                })
            }
        }
        deserializer.deserialize_map(KindConfigVisitor)
    }
}

fn default_quote_exclusive() -> U64 {
    U64(120_000_000_000)
}
fn default_open_claims() -> u32 {
    1
}
fn default_open_value() -> U128 {
    U128(20_000_000)
}

impl KindConfig {
    fn validate(&self) {
        require!(
            serde_json::from_str::<Value>(&self.verifier_source).is_ok_and(|v| v.is_object()),
            "bad source"
        );
        require!(
            self.claim_timeout_ns.0 > 0
                && self.proof_timeout_ns.0 > 0
                && self.max_deadline_ns.0 > 0,
            "bad timeout"
        );
        match &self.access {
            Access::Named(s) => require!(s == "open" || s == "approved", "bad access"),
            Access::Allowlist { allowlist } => require!(!allowlist.is_empty(), "empty allowlist"),
            Access::MinBond { min_bond } => require!(min_bond.0 > 0, "zero min_bond"),
        }
    }
}

/// Side of a rating: the buyer rated the fulfiller / the fulfiller rated the buyer.
const SIDE_BUYER: u8 = b'b';
const SIDE_FULFILLER: u8 = b'f';

fn rating_key(order_id: &str, side: u8) -> Vec<u8> {
    let mut k = near_sdk::IntoStorageKey::into_storage_key(Key::RatingWeights);
    k.push(side);
    k.extend_from_slice(order_id.as_bytes());
    k
}

/// Weight already added to the target's stats for this order/side. Orders
/// rated before this field existed have no record and count as 0 (true for
/// every live v1 rating: they were all given at weight 0).
fn applied_weight(order_id: &str, side: u8) -> u64 {
    env::storage_read(&rating_key(order_id, side))
        .and_then(|v| v.first().copied())
        .unwrap_or(0) as u64
}

fn set_applied_weight(order_id: &str, side: u8, w: u64) {
    let k = rating_key(order_id, side);
    if w == 0 {
        env::storage_remove(&k);
    } else {
        env::storage_write(&k, &[w.min(u8::MAX as u64) as u8]);
    }
}

#[near(serializers = [borsh])]
#[derive(Clone, Debug, near_sdk::NearSchema)]
#[abi(json)]
pub struct Config {
    pub owner: AccountId,
    pub intents_contract: AccountId,
    pub outlayer_contract: AccountId,
    /// JSON passed as `source` to `request_execution`, e.g.
    /// `{"Project":{"project_id":"nearfullfil.near/email-verifier","version_key":null}}`.
    /// JSON passed as `resource_limits`.
    pub verifier_resource_limits: String,
    /// OutLayer secrets profile (owner = this contract); `None` = no secrets.
    /// `blob_url` = this prefix + proof sha256.
    pub proof_blob_base_url: String,
    /// NEAR attached to `request_execution` from this account's balance.
    pub outlayer_deposit: U128,
    pub outlayer_gas_tgas: u64,
    pub arbiter: AccountId,
    pub relayer: AccountId,
    pub accepted_tokens: Vec<String>,
    /// Token bonds are held in; fixed at init. All accepted tokens are assumed
    /// to be USD stables with the same decimals as `bond_token`.
    pub bond_token: String,
    /// If non-empty, the worker's `dkim_domain` must be in this list.
    pub min_bond: U128,
    pub bond_per_job_bps: u16,
    pub min_order_amount: U128,
    pub bond_hold_ns: U64,
    pub challenge_window_ns: U64,
    pub rating_window_ns: U64,
    pub max_email_skew_ns: U64,
    /// Order value that counts as weight 1 for ratings (1 USDC = 1_000_000).
    pub rating_unit: U128,
    pub max_orders: u32,
    pub max_profiles: u32,
    pub paused: bool,
    pub kinds: KindMap,
}

impl Serialize for Config {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let mut s = serializer.serialize_struct("Config", 23)?;
        s.serialize_field("owner", &self.owner)?;
        s.serialize_field("intents_contract", &self.intents_contract)?;
        s.serialize_field("outlayer_contract", &self.outlayer_contract)?;
        s.serialize_field("verifier_resource_limits", &self.verifier_resource_limits)?;
        s.serialize_field("proof_blob_base_url", &self.proof_blob_base_url)?;
        s.serialize_field("outlayer_deposit", &self.outlayer_deposit)?;
        s.serialize_field("outlayer_gas_tgas", &self.outlayer_gas_tgas)?;
        s.serialize_field("arbiter", &self.arbiter)?;
        s.serialize_field("relayer", &self.relayer)?;
        s.serialize_field("accepted_tokens", &self.accepted_tokens)?;
        s.serialize_field("bond_token", &self.bond_token)?;
        s.serialize_field("min_bond", &self.min_bond)?;
        s.serialize_field("bond_per_job_bps", &self.bond_per_job_bps)?;
        s.serialize_field("min_order_amount", &self.min_order_amount)?;
        s.serialize_field("bond_hold_ns", &self.bond_hold_ns)?;
        s.serialize_field("challenge_window_ns", &self.challenge_window_ns)?;
        s.serialize_field("rating_window_ns", &self.rating_window_ns)?;
        s.serialize_field("max_email_skew_ns", &self.max_email_skew_ns)?;
        s.serialize_field("rating_unit", &self.rating_unit)?;
        s.serialize_field("max_orders", &self.max_orders)?;
        s.serialize_field("max_profiles", &self.max_profiles)?;
        s.serialize_field("paused", &self.paused)?;
        s.serialize_field("kinds", &self.kinds)?;
        s.end()
    }
}

impl<'de> Deserialize<'de> for Config {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        struct ConfigVisitor;
        impl<'de> Visitor<'de> for ConfigVisitor {
            type Value = Config;

            fn expecting(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
                f.write_str("object")
            }

            fn visit_map<M: MapAccess<'de>>(self, mut map: M) -> Result<Config, M::Error> {
                let mut owner = None;
                let mut intents_contract = None;
                let mut outlayer_contract = None;
                let mut verifier_resource_limits = None;
                let mut proof_blob_base_url = None;
                let mut outlayer_deposit = None;
                let mut outlayer_gas_tgas = None;
                let mut arbiter = None;
                let mut relayer = None;
                let mut accepted_tokens = None;
                let mut bond_token = None;
                let mut min_bond = None;
                let mut bond_per_job_bps = None;
                let mut min_order_amount = None;
                let mut bond_hold_ns = None;
                let mut challenge_window_ns = None;
                let mut rating_window_ns = None;
                let mut max_email_skew_ns = None;
                let mut rating_unit = None;
                let mut max_orders = None;
                let mut max_profiles = None;
                let mut paused = None;
                let mut kinds = None;
                while let Some(key) = map.next_key::<String>()? {
                    match key.as_str() {
                        "owner" => owner = Some(map.next_value()?),
                        "intents_contract" => intents_contract = Some(map.next_value()?),
                        "outlayer_contract" => outlayer_contract = Some(map.next_value()?),
                        "verifier_resource_limits" => {
                            verifier_resource_limits = Some(map.next_value()?)
                        }
                        "proof_blob_base_url" => proof_blob_base_url = Some(map.next_value()?),
                        "outlayer_deposit" => outlayer_deposit = Some(map.next_value()?),
                        "outlayer_gas_tgas" => outlayer_gas_tgas = Some(map.next_value()?),
                        "arbiter" => arbiter = Some(map.next_value()?),
                        "relayer" => relayer = Some(map.next_value()?),
                        "accepted_tokens" => accepted_tokens = Some(map.next_value()?),
                        "bond_token" => bond_token = Some(map.next_value()?),
                        "min_bond" => min_bond = Some(map.next_value()?),
                        "bond_per_job_bps" => bond_per_job_bps = Some(map.next_value()?),
                        "min_order_amount" => min_order_amount = Some(map.next_value()?),
                        "bond_hold_ns" => bond_hold_ns = Some(map.next_value()?),
                        "challenge_window_ns" => challenge_window_ns = Some(map.next_value()?),
                        "rating_window_ns" => rating_window_ns = Some(map.next_value()?),
                        "max_email_skew_ns" => max_email_skew_ns = Some(map.next_value()?),
                        "rating_unit" => rating_unit = Some(map.next_value()?),
                        "max_orders" => max_orders = Some(map.next_value()?),
                        "max_profiles" => max_profiles = Some(map.next_value()?),
                        "paused" => paused = Some(map.next_value()?),
                        "kinds" => kinds = Some(map.next_value()?),
                        _ => return Err(near_sdk::serde::de::Error::custom("unknown field")),
                    }
                }
                Ok(Config {
                    owner: owner.unwrap_or_else(|| env::panic_str("missing field")),
                    intents_contract: intents_contract
                        .unwrap_or_else(|| env::panic_str("missing field")),
                    outlayer_contract: outlayer_contract
                        .unwrap_or_else(|| env::panic_str("missing field")),
                    verifier_resource_limits: verifier_resource_limits
                        .unwrap_or_else(|| env::panic_str("missing field")),
                    proof_blob_base_url: proof_blob_base_url
                        .unwrap_or_else(|| env::panic_str("missing field")),
                    outlayer_deposit: outlayer_deposit
                        .unwrap_or_else(|| env::panic_str("missing field")),
                    outlayer_gas_tgas: outlayer_gas_tgas
                        .unwrap_or_else(|| env::panic_str("missing field")),
                    arbiter: arbiter.unwrap_or_else(|| env::panic_str("missing field")),
                    relayer: relayer.unwrap_or_else(|| env::panic_str("missing field")),
                    accepted_tokens: accepted_tokens
                        .unwrap_or_else(|| env::panic_str("missing field")),
                    bond_token: bond_token.unwrap_or_else(|| env::panic_str("missing field")),
                    min_bond: min_bond.unwrap_or_else(|| env::panic_str("missing field")),
                    bond_per_job_bps: bond_per_job_bps
                        .unwrap_or_else(|| env::panic_str("missing field")),
                    min_order_amount: min_order_amount
                        .unwrap_or_else(|| env::panic_str("missing field")),
                    bond_hold_ns: bond_hold_ns.unwrap_or_else(|| env::panic_str("missing field")),
                    challenge_window_ns: challenge_window_ns
                        .unwrap_or_else(|| env::panic_str("missing field")),
                    rating_window_ns: rating_window_ns
                        .unwrap_or_else(|| env::panic_str("missing field")),
                    max_email_skew_ns: max_email_skew_ns
                        .unwrap_or_else(|| env::panic_str("missing field")),
                    rating_unit: rating_unit.unwrap_or_else(|| env::panic_str("missing field")),
                    max_orders: max_orders.unwrap_or_else(|| env::panic_str("missing field")),
                    max_profiles: max_profiles.unwrap_or_else(|| env::panic_str("missing field")),
                    paused: paused.unwrap_or_else(|| env::panic_str("missing field")),
                    kinds: kinds.unwrap_or_else(|| env::panic_str("missing field")),
                })
            }
        }
        deserializer.deserialize_map(ConfigVisitor)
    }
}

impl Config {
    fn validate(&self) {
        require!(self.bond_per_job_bps as u128 <= BPS_DENOM, "bps > 10000");
        require!(!self.accepted_tokens.is_empty(), "no tokens");
        require!(
            self.accepted_tokens.contains(&self.bond_token),
            "bad bond token"
        );
        for (kind, config) in &self.kinds.0 {
            require!(!kind.is_empty() && kind.len() <= 64, "bad kind");
            config.validate();
        }
        require!(
            serde_json::from_str::<Value>(&self.verifier_resource_limits)
                .is_ok_and(|v| v.is_object()),
            "bad limits"
        );
        require!((20..=250).contains(&self.outlayer_gas_tgas), "bad gas");
        require!(self.rating_unit.0 > 0, "rating_unit = 0");
    }
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    config: Config,
    orders: IterableMap<String, Order>,
    used_ids: LookupSet<String>,
    by_account: LookupMap<AccountId, Vec<String>>,
    profiles: LookupMap<AccountId, Profile>,
    profiles_count: u32,
    stats: LookupMap<AccountId, Stats>,
    bonds: LookupMap<AccountId, Bond>,
    /// tx_ref_hash -> order id
    nullifiers: LookupMap<String, String>,
    /// failed outgoing transfers: (receiver, token) -> amount
    owed: LookupMap<(AccountId, String), u128>,
    /// Fulfillers approved by the owner.
    approved: LookupSet<AccountId>,
    /// token -> everything the escrow owes (live order funds, bonds, `owed`,
    /// transfers in flight). Inflows add, confirmed outflows subtract.
    liabilities: LookupMap<String, u128>,
    migration_pending: Vec<String>,
}

fn now() -> u64 {
    env::block_timestamp()
}

/// Event field value (hand-rolled instead of `json!` to keep the wasm small).
enum E<'a> {
    /// JSON string (escaped)
    S(&'a str),
    /// u128 as a decimal string (U128 style)
    Q(u128),
    /// JSON number
    N(u64),
    /// pre-serialised JSON
    R(String),
}

fn push_str(out: &mut String, s: &str) {
    out.push('"');
    for ch in s.chars() {
        match ch {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            c if (c as u32) < 0x20 => out.push_str(&format!("\\u{:04x}", c as u32)),
            c => out.push(c),
        }
    }
    out.push('"');
}

/// NEP-297: `EVENT_JSON:{"standard":"fulfil","version":"1.0.0","event":..,"data":[{..}]}`
fn emit(event: &str, fields: &[(&str, E)]) {
    let mut out = format!(
        "EVENT_JSON:{{\"standard\":\"{EVENT_STANDARD}\",\"version\":\"{EVENT_VERSION}\",\"event\":\"{event}\",\"data\":[{{"
    );
    for (i, (k, v)) in fields.iter().enumerate() {
        if i > 0 {
            out.push(',');
        }
        push_str(&mut out, k);
        out.push(':');
        match v {
            E::S(s) => push_str(&mut out, s),
            E::Q(n) => {
                out.push('"');
                out.push_str(&n.to_string());
                out.push('"');
            }
            E::N(n) => out.push_str(&n.to_string()),
            E::R(r) => out.push_str(r),
        }
    }
    out.push_str("}]}");
    env::log_str(&out);
}

fn status_json(s: Status) -> E<'static> {
    E::R(serde_json::to_string(&s).unwrap_or_default())
}

#[near]
impl Contract {
    /// Owner-triggered post-deploy migration from the c0740f2 root layout.
    #[init(ignore_state)]
    pub fn migrate() -> Self {
        require!(!env::storage_has_key(W9_STATE_MARKER), "already migrated");
        let old: legacy::LegacyState =
            env::state_read().unwrap_or_else(|| env::panic_str("no state"));
        require!(
            env::predecessor_account_id() == old.config.owner,
            "only owner"
        );
        let old_config = old.config;
        let bank = KindConfig {
            enabled: true,
            verifier_source: old_config.verifier_source,
            secrets_ref: old_config
                .secrets_profile
                .filter(|p| !p.is_empty())
                .map(|profile| SecretsRef {
                    profile,
                    account_id: env::current_account_id(),
                }),
            access: Access::Named("approved".into()),
            needs_sent: true,
            claim_timeout_ns: old_config.claim_timeout_ns,
            proof_timeout_ns: old_config.proof_timeout_ns,
            max_deadline_ns: U64(24 * 60 * 60 * 1_000_000_000),
            quote_exclusive_ns: default_quote_exclusive(),
            open_max_active_claims: default_open_claims(),
            open_max_order_value: default_open_value(),
        };
        let mut kinds = KindMap::default();
        kinds.insert("bank_transfer".into(), bank);
        kinds.insert("in_person".into(), in_person_kind_config());
        kinds.insert("token_buy".into(), token_buy_kind_config());
        let config = Config {
            owner: old_config.owner,
            intents_contract: old_config.intents_contract,
            outlayer_contract: old_config.outlayer_contract,
            verifier_resource_limits: old_config.verifier_resource_limits,
            proof_blob_base_url: old_config.proof_blob_base_url,
            outlayer_deposit: old_config.outlayer_deposit,
            outlayer_gas_tgas: old_config.outlayer_gas_tgas,
            arbiter: old_config.arbiter,
            relayer: old_config.relayer,
            accepted_tokens: old_config.accepted_tokens,
            bond_token: old_config.bond_token,
            min_bond: old_config.min_bond,
            bond_per_job_bps: old_config.bond_per_job_bps,
            min_order_amount: old_config.min_order_amount,
            bond_hold_ns: old_config.bond_hold_ns,
            challenge_window_ns: old_config.challenge_window_ns,
            rating_window_ns: old_config.rating_window_ns,
            max_email_skew_ns: old_config.max_email_skew_ns,
            rating_unit: old_config.rating_unit,
            max_orders: old_config.max_orders,
            max_profiles: old_config.max_profiles,
            paused: old_config.paused,
            kinds,
        };
        let mut this = Self {
            config,
            orders: old.orders,
            used_ids: old.used_ids,
            by_account: old.by_account,
            profiles: old.profiles,
            profiles_count: old.profiles_count,
            stats: old.stats,
            bonds: old.bonds,
            nullifiers: old.nullifiers,
            owed: old.owed,
            approved: old.approved,
            liabilities: old.liabilities,
            migration_pending: Vec::new(),
        };
        this.migration_pending = this.orders.keys().cloned().collect();
        env::storage_write(W9_STATE_MARKER, b"1");
        this.convert_orders(MIGRATION_BATCH);
        this
    }

    #[payable]
    pub fn migrate_batch(&mut self, limit: u32) -> u32 {
        require!(
            env::predecessor_account_id() == self.config.owner,
            "only owner"
        );
        assert_one_yocto();
        require!(!self.migration_pending.is_empty(), "done");
        self.convert_orders(limit.min(MIGRATION_BATCH));
        self.migration_pending.len() as u32
    }

    fn convert_orders(&mut self, limit: u32) {
        for _ in 0..limit {
            let Some(id) = self.migration_pending.pop() else {
                break;
            };
            let mut key_bytes = near_sdk::IntoStorageKey::into_storage_key(Key::Orders);
            key_bytes.push(b'm');
            key_bytes.extend((id.len() as u32).to_le_bytes());
            key_bytes.extend(id.as_bytes());
            let storage_key = env::sha256(&key_bytes);
            let stored = env::storage_read(&storage_key)
                .unwrap_or_else(|| env::panic_str("old order missing"));
            let converted = convert_legacy_order(&stored);
            env::storage_write(&storage_key, &converted);
        }
    }

    fn assert_migrated(&self) {
        require!(self.migration_pending.is_empty(), "migrating");
    }

    #[init]
    #[allow(unused_mut)] // near-sdk's wrapper also binds this argument.
    pub fn new(mut config: Config) -> Self {
        config
            .kinds
            .insert("in_person".into(), in_person_kind_config());
        config
            .kinds
            .insert("token_buy".into(), token_buy_kind_config());
        config.validate();
        Self {
            config,
            orders: IterableMap::new(Key::Orders),
            used_ids: LookupSet::new(Key::UsedIds),
            by_account: LookupMap::new(Key::ByAccount),
            profiles: LookupMap::new(Key::Profiles),
            profiles_count: 0,
            stats: LookupMap::new(Key::Stats),
            bonds: LookupMap::new(Key::Bonds),
            nullifiers: LookupMap::new(Key::Nullifiers),
            owed: LookupMap::new(Key::Owed),
            approved: LookupSet::new(Key::Approved),
            liabilities: LookupMap::new(Key::Liabilities),
            migration_pending: Vec::new(),
        }
    }

    // ------------------------------------------------------------------
    // intents.near entry points
    // ------------------------------------------------------------------

    /// NEP-245 receiver. Returns the amounts to refund. Any failure panics,
    /// which makes `intents.near::mt_resolve_transfer` refund everything.
    pub fn mt_on_transfer(
        &mut self,
        sender_id: AccountId,
        previous_owner_ids: Vec<AccountId>,
        token_ids: Vec<String>,
        amounts: Vec<U128>,
        msg: String,
    ) -> PromiseOrValue<Vec<U128>> {
        self.assert_intents();
        self.assert_not_paused();
        require!(
            token_ids.len() == 1 && amounts.len() == 1 && previous_owner_ids.len() == 1,
            "exactly one token"
        );
        require!(
            previous_owner_ids[0] == sender_id,
            "approvals are not supported"
        );
        let token = &token_ids[0];
        let amount = amounts[0].0;
        require!(amount > 0, "zero amount");
        let m: Msg = serde_json::from_str(&msg).unwrap_or_else(|_| env::panic_str("bad msg"));
        match m.op.as_str() {
            "fund" => self.internal_fund(sender_id, token, amount, req(m.order, "order"), m.spec),
            "bond" => {
                self.assert_storage_reserve();
                require!(*token == self.config.bond_token, "wrong bond token");
                let mut b = self.bond(&sender_id);
                b.available = U128(
                    b.available
                        .0
                        .checked_add(amount)
                        .unwrap_or_else(|| env::panic_str("overflow")),
                );
                self.bonds.insert(sender_id.clone(), b);
                self.add_liability(token, amount);
                self.assert_storage_reserve();
                emit(
                    "bond_deposited",
                    &[
                        ("account_id", E::S(sender_id.as_str())),
                        ("amount", E::Q(amount)),
                    ],
                );
            }
            _ => env::panic_str("bad msg"),
        }
        PromiseOrValue::Value(vec![U128(0)])
    }

    /// `auth_call` receiver. `signer_id` is authenticated by `intents_contract`.
    #[payable]
    pub fn on_auth(&mut self, signer_id: AccountId, msg: String) -> PromiseOrValue<()> {
        self.assert_migrated();
        self.assert_intents();
        let m: Msg = serde_json::from_str(&msg).unwrap_or_else(|_| env::panic_str("bad msg"));
        let id = || req(m.order_id.clone(), "order_id");
        match m.op.as_str() {
            "register_fulfiller" => self.op_register(
                signer_id,
                m.bank_bin.unwrap_or_default(),
                m.account_last4.unwrap_or_default(),
            ),
            "claim" => self.op_claim(signer_id, id()),
            "release_claim" => self.op_release_claim(signer_id, id()),
            "sent" => self.op_sent(signer_id, id()),
            "submit_proof" => {
                return PromiseOrValue::Promise(self.op_submit_proof(
                    Some(signer_id),
                    id(),
                    req(m.proof_sha256, "proof_sha256"),
                    req(m.spec, "spec"),
                ))
            }
            "confirm_delivery" => {
                self.op_confirm_delivery(signer_id, id(), req(m.secret_hex, "secret_hex"));
            }
            "cancel" => self.op_cancel(signer_id, id()),
            "dispute" => self.op_dispute(signer_id, id(), req(m.reason_code, "reason_code")),
            "rate" => self.op_rate(signer_id, id(), req(m.stars, "stars")),
            "withdraw_bond" => self.op_withdraw_bond(signer_id, req(m.amount, "amount").0),
            _ => env::panic_str("bad msg"),
        }
        PromiseOrValue::Value(())
    }

    // ------------------------------------------------------------------
    // callbacks
    // ------------------------------------------------------------------

    /// A callback from a superseded claim or proof request is ignored without
    /// changing the current claim. The sequence never resets on release.
    #[private]
    pub fn on_verify_result(
        &mut self,
        order_id: String,
        attempt: u8,
        verify_seq: u32,
        expected_fulfiller: AccountId,
        expected_proof_sha256: String,
    ) {
        self.assert_migrated();
        let mut o = match self.orders.get(&order_id) {
            Some(o)
                if o.status == Status::Verifying
                    && o.attempts == attempt
                    && o.verify_seq == verify_seq
                    && o.fulfiller.as_ref() == Some(&expected_fulfiller)
                    && o.proof_sha256.as_deref() == Some(expected_proof_sha256.as_str()) =>
            {
                o.clone()
            }
            _ => {
                env::log_str("stale verify result ignored");
                return;
            }
        };
        let res = env::promise_result_checked(0, MAX_RESULT_LEN);
        let outcome = match res {
            Ok(bytes) => parse_outlayer(&bytes)
                .and_then(|out| check_output(&out, &o, self.config.max_email_skew_ns.0)),
            Err(_) => Err("outlayer call failed".to_string()),
        };
        let nullifier = match outcome {
            Ok(n) if self.nullifiers.contains_key(&n) => Err("nullifier already used".to_string()),
            other => other,
        };
        match nullifier {
            Ok(n) => {
                self.nullifiers.insert(n.clone(), o.id.clone());
                o.nullifier = Some(n.clone());
                o.verified_at = Some(now());
                emit(
                    "proof_verified",
                    &[
                        ("order_id", E::S(o.id.as_str())),
                        ("nullifier", E::S(n.as_str())),
                        ("attempt", E::N(attempt as u64)),
                    ],
                );
                if self.config.challenge_window_ns.0 == 0 {
                    self.payout(o);
                } else {
                    o.status = Status::Verified;
                    self.save(o);
                }
            }
            Err(reason) => self.reject(o, reason),
        }
    }

    /// Callback of every outgoing `mt_transfer`. Only a failed transfer
    /// (`PromiseError::Failed`) is booked into `owed` so it can be retried; a
    /// success with any return value (even an oversized one) is a success.
    #[private]
    pub fn on_sent(&mut self, receiver_id: AccountId, token_id: String, amount: U128) {
        if !matches!(env::promise_result_checked(0, 0), Err(PromiseError::Failed)) {
            self.sub_liability(&token_id, amount.0);
        } else {
            let key = (receiver_id.clone(), token_id.clone());
            let cur = self.owed.get(&key).copied().unwrap_or(0);
            self.owed.insert(key, cur.saturating_add(amount.0));
            emit(
                "transfer_failed",
                &[
                    ("receiver_id", E::S(receiver_id.as_str())),
                    ("token_id", E::S(token_id.as_str())),
                    ("amount", E::Q(amount.0)),
                ],
            );
        }
    }

    // ------------------------------------------------------------------
    // permissionless maintenance
    // ------------------------------------------------------------------

    /// Funded or Claimed and past deadline -> Expired, full refund to buyer.
    /// Sent, ProofRejected, and timed-out Verifying require arbiter review.
    pub fn expire(&mut self, order_id: String) {
        let mut o = self.order(&order_id);
        require!(now() >= o.deadline_ns, "deadline not reached");
        require!(
            matches!(o.status, Status::Funded | Status::Claimed) && o.paid_at.is_none(),
            "not refundable"
        );
        if let Some(f) = &o.fulfiller {
            self.unlock_bond(f, o.bond_locked, 0);
            o.bond_locked = 0;
        }
        o.status = Status::Expired;
        o.ended_at = Some(now());
        self.settle(&mut o);
        let (buyer, token, value) = (o.buyer.clone(), o.token.clone(), o.value());
        emit("order_expired", &[("order_id", E::S(o.id.as_str()))]);
        self.drop_order(&o);
        self.send(&buyer, &token, value, "fulfil refund");
    }

    /// Enforces claim / proof / verification timeouts.
    pub fn timeout(&mut self, order_id: String) {
        let mut o = self.order(&order_id);
        let t = now();
        let c = self.kind(&o.kind).clone();
        if t >= o.deadline_ns && o.status == Status::Claimed {
            self.expire(order_id);
            return;
        }
        match o.status {
            Status::Claimed
                if t >= o
                    .claimed_at
                    .unwrap_or(0)
                    .saturating_add(c.claim_timeout_ns.0)
                    .min(o.deadline_ns) =>
            {
                let f = o.fulfiller.clone().unwrap();
                let slash = o.bond_locked;
                if slash > 0 {
                    let mut b = self.bond(&f);
                    b.locked = U128(b.locked.0 - slash);
                    self.bonds.insert(f.clone(), b);
                }
                self.clear_active_claim(&o, &f);
                o.bond_locked = 0;
                o.fulfiller = None;
                o.claimed_at = None;
                o.status = Status::Funded;
                self.unindex(&f, &o.id);
                let buyer = o.buyer.clone();
                emit(
                    "order_unclaimed",
                    &[
                        ("order_id", E::S(o.id.as_str())),
                        ("fulfiller", E::S(f.as_str())),
                        ("slashed", E::Q(slash)),
                    ],
                );
                self.save(o);
                let bt = self.config.bond_token.clone();
                self.send(&buyer, &bt, slash, "fulfil bond slash");
            }
            Status::Sent | Status::ProofRejected
                if t >= o
                    .sent_at
                    .unwrap_or(0)
                    .saturating_add(c.proof_timeout_ns.0)
                    .min(o.deadline_ns) =>
            {
                self.under_review(o, "proof timeout");
            }
            Status::Verifying
                if t >= o
                    .verify_started_at
                    .unwrap_or(0)
                    .saturating_add(c.proof_timeout_ns.0) =>
            {
                if t >= o.deadline_ns {
                    self.under_review(o, "verification timed out");
                } else {
                    self.reject(o, "verification timed out".into());
                }
            }
            _ => env::panic_str("nothing to time out"),
        }
    }

    /// Verified (challenge window > 0) and window over -> payout.
    pub fn finalize(&mut self, order_id: String) {
        let o = self.order(&order_id);
        require!(o.status == Status::Verified, "not verified");
        require!(
            now()
                >= o.verified_at
                    .unwrap_or(0)
                    .saturating_add(self.config.challenge_window_ns.0),
            "challenge window open"
        );
        self.payout(o);
    }

    /// Paid and `bond_hold` over with no dispute -> Closed, bond unlocked.
    pub fn release_bond(&mut self, order_id: String) {
        let mut o = self.order(&order_id);
        require!(o.status == Status::Paid, "not paid");
        require!(
            now()
                >= o.paid_at
                    .unwrap_or(0)
                    .saturating_add(self.config.bond_hold_ns.0),
            "bond hold not over"
        );
        let f = o.fulfiller.clone().unwrap();
        self.unlock_bond(&f, o.bond_locked, 0);
        o.bond_locked = 0;
        o.status = Status::Closed;
        o.ended_at = Some(now());
        emit(
            "bond_released",
            &[
                ("order_id", E::S(o.id.as_str())),
                ("fulfiller", E::S(f.as_str())),
            ],
        );
        self.save(o);
    }

    /// Deletes a finished order once its rating window is over (storage bound).
    /// The id stays reserved and the nullifier stays recorded. Cancelled and
    /// Expired orders are deleted at once by `cancel` / `expire`.
    pub fn prune(&mut self, order_id: String) {
        let o = self.order(&order_id);
        require!(
            matches!(o.status, Status::Closed | Status::Resolved),
            "not finished"
        );
        require!(
            now()
                >= o.ended_at
                    .unwrap_or(u64::MAX)
                    .saturating_add(self.config.rating_window_ns.0)
                && now()
                    >= o.paid_at
                        .unwrap_or(0)
                        .saturating_add(self.config.rating_window_ns.0),
            "rating window open"
        );
        self.drop_order(&o);
    }

    /// Retries a transfer that failed earlier. `owed` is cleared before the
    /// transfer and re-booked by `on_sent` only if it fails again, so a
    /// retry can never pay twice.
    pub fn retry_owed(&mut self, account_id: AccountId, token_id: String) {
        let key = (account_id.clone(), token_id.clone());
        let amount = self
            .owed
            .remove(&key)
            .unwrap_or_else(|| env::panic_str("nothing owed"));
        self.send(&account_id, &token_id, amount, "fulfil retry");
    }

    /// Re-weighs the stored ratings of a finished order with the CURRENT
    /// `rating_unit` (same formula as `rate`). Adds only the difference
    /// between the new weight and the weight already applied for that
    /// order/side, never subtracts, so repeated calls are no-ops.
    pub fn recount_rating(&mut self, order_id: String) {
        self.assert_storage_reserve();
        let o = self.order(&order_id);
        require!(
            matches!(o.status, Status::Paid | Status::Closed | Status::Resolved),
            "order not finished"
        );
        require!(
            o.buyer_rating.is_some() || o.fulfiller_rating.is_some(),
            "not rated"
        );
        let w = self.rating_weight(&o);
        let Some(f) = o.fulfiller.clone() else {
            env::panic_str("not rated")
        };
        let sides = [
            (SIDE_BUYER, o.buyer_rating, &o.buyer, &f),
            (SIDE_FULFILLER, o.fulfiller_rating, &f, &o.buyer),
        ];
        for (side, stars, by, target) in sides {
            let Some(stars) = stars else { continue };
            let old = applied_weight(&order_id, side);
            if w <= old {
                continue;
            }
            let d = w - old;
            self.bump(target, |s| {
                s.star_sum += stars as u64 * d;
                s.star_count += d;
            });
            set_applied_weight(&order_id, side, w);
            emit(
                "rating_recounted",
                &[
                    ("order_id", E::S(order_id.as_str())),
                    ("by", E::S(by.as_str())),
                    ("target", E::S(target.as_str())),
                    ("stars", E::N(stars as u64)),
                    ("old_weight", E::N(old)),
                    ("weight", E::N(w)),
                ],
            );
        }
        self.assert_storage_reserve();
    }

    // ------------------------------------------------------------------
    // roles
    // ------------------------------------------------------------------

    /// Arbiter only. Resolves a `Disputed` or `UnderReview` order.
    /// If the order was already paid out, a `buyer` verdict can only refund up
    /// to the fulfiller's locked bond (0 while `bond_per_job_bps == 0`).
    pub fn resolve_dispute(
        &mut self,
        order_id: String,
        verdict: Verdict,
        note_hash: Option<String>,
    ) {
        require!(
            env::predecessor_account_id() == self.config.arbiter,
            "only arbiter"
        );
        let mut o = self.order(&order_id);
        require!(
            matches!(o.status, Status::Disputed | Status::UnderReview),
            "not disputed"
        );
        let f = o.fulfiller.clone().unwrap();
        let buyer = o.buyer.clone();
        let value = o.value();
        let locked = o.bond_locked;
        let bt = self.config.bond_token.clone();
        let token = o.token.clone();
        let mut sends: Vec<(AccountId, String, u128)> = vec![];
        if o.paid_at.is_none() {
            // funds still in escrow
            let (to_buyer, to_f) = match verdict {
                Verdict::Buyer => (value, 0),
                Verdict::Fulfiller => (0, value),
                Verdict::Split => (value - value / 2, value / 2),
            };
            self.unlock_bond(&f, locked, 0);
            sends.push((buyer.clone(), token.clone(), to_buyer));
            sends.push((f.clone(), token, to_f));
            if verdict == Verdict::Fulfiller {
                self.count_job(&o);
            }
        } else {
            let cover = locked.min(value);
            let slash = match verdict {
                Verdict::Buyer => cover,
                Verdict::Fulfiller => 0,
                Verdict::Split => cover / 2,
            };
            self.unlock_bond(&f, locked, slash);
            sends.push((buyer.clone(), bt, slash));
        }
        match verdict {
            Verdict::Buyer => {
                self.bump(&f, |s| s.disputes_lost += 1);
                self.bump(&buyer, |s| s.disputes_won += 1);
            }
            Verdict::Fulfiller => {
                self.bump(&buyer, |s| s.disputes_lost += 1);
                self.bump(&f, |s| s.disputes_won += 1);
            }
            Verdict::Split => {}
        }
        o.bond_locked = 0;
        o.status = Status::Resolved;
        o.verdict = Some(verdict);
        o.verdict_note_hash = note_hash;
        o.ended_at = Some(now());
        self.settle(&mut o);
        emit(
            "dispute_resolved",
            &[
                ("order_id", E::S(o.id.as_str())),
                (
                    "verdict",
                    E::R(serde_json::to_string(&verdict).unwrap_or_default()),
                ),
            ],
        );
        self.save(o);
        for (to, tok, amt) in sends {
            self.send(&to, &tok, amt, "fulfil verdict");
        }
    }

    /// Relayer only (inbound email-forward service): same as the fulfiller's
    /// `submit_proof` op, same guards and attempt limit.
    pub fn submit_proof(
        &mut self,
        order_id: String,
        proof_sha256: String,
        spec: String,
    ) -> Promise {
        require!(
            env::predecessor_account_id() == self.config.relayer,
            "only relayer"
        );
        self.op_submit_proof(None, order_id, proof_sha256, spec)
    }

    /// Direct claimer call. A bad code returns `false` so its attempt count commits.
    /// Hex is deliberately lowercase only, including the 64-character length.
    pub fn confirm_delivery(&mut self, order_id: String, secret_hex: String) -> bool {
        self.op_confirm_delivery(env::predecessor_account_id(), order_id, secret_hex)
    }

    /// Owner only, 1 yocto. Approves (or revokes) a fulfiller for `claim`.
    #[payable]
    pub fn approve_fulfiller(&mut self, account_id: AccountId, approved: bool) {
        self.assert_owner();
        if approved {
            self.approved.insert(account_id.clone());
            self.assert_storage_reserve();
        } else {
            self.approved.remove(&account_id);
        }
        emit(
            "fulfiller_approved",
            &[
                ("account_id", E::S(account_id.as_str())),
                ("approved", E::R(approved.to_string())),
            ],
        );
    }

    /// Owner only, 1 yocto. Sends tokens that reached the escrow outside any
    /// order or bond (stray transfers). Limited to the escrow's intents
    /// balance of `token_id` minus `liabilities[token_id]`.
    #[payable]
    pub fn sweep(&mut self, token_id: String, amount: U128, receiver_id: AccountId) -> Promise {
        self.assert_owner();
        require!(amount.0 > 0, "zero amount");
        ext_mt::ext(self.config.intents_contract.clone())
            .with_static_gas(GAS_BALANCE_OF)
            .with_unused_gas_weight(0)
            .mt_balance_of(env::current_account_id(), token_id.clone())
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(GAS_SWEEP_CB)
                    .with_unused_gas_weight(0)
                    .on_sweep_balance(token_id, amount, receiver_id),
            )
    }

    #[private]
    pub fn on_sweep_balance(&mut self, token_id: String, amount: U128, receiver_id: AccountId) {
        let bal: U128 = env::promise_result_checked(0, 64)
            .ok()
            .and_then(|b| serde_json::from_slice(&b).ok())
            .unwrap_or_else(|| env::panic_str("balance unavailable"));
        let free = bal.0.saturating_sub(self.liability(&token_id));
        require!(amount.0 <= free, "amount exceeds stray balance");
        // Counted as owed to the receiver until the transfer is confirmed.
        self.add_liability(&token_id, amount.0);
        emit(
            "swept",
            &[
                ("token_id", E::S(token_id.as_str())),
                ("receiver_id", E::S(receiver_id.as_str())),
                ("amount", E::Q(amount.0)),
            ],
        );
        self.send(&receiver_id, &token_id, amount.0, "fulfil sweep");
    }

    /// Owner only, 1 yocto.
    #[payable]
    #[allow(unused_mut)] // The near-sdk wrapper also binds this argument.
    pub fn update_config(&mut self, mut config: Config) {
        self.assert_owner();
        require!(
            config.intents_contract == self.config.intents_contract
                && config.bond_token == self.config.bond_token,
            "intents_contract and bond_token are immutable"
        );
        config.kinds = self.config.kinds.clone();
        config.validate();
        let pausing = config.paused;
        self.config = config;
        if !pausing {
            self.assert_storage_reserve();
        }
        emit("config_updated", &[]);
    }

    #[payable]
    pub fn set_kind(&mut self, kind: String, config: KindConfig) {
        self.assert_owner();
        require!(!kind.is_empty() && kind.len() <= 64, "bad kind");
        config.validate();
        self.config.kinds.insert(kind, config);
        self.assert_storage_reserve();
        emit("config_updated", &[]);
    }

    #[payable]
    pub fn remove_kind(&mut self, kind: String) {
        self.assert_owner();
        require!(!self.orders.values().any(|o| o.kind == kind), "in use");
        require!(self.config.kinds.remove(&kind).is_some(), "kind not found");
        emit("config_updated", &[]);
    }

    /// Owner-only free-NEAR floor, stored outside the live root layout.
    #[payable]
    pub fn set_storage_reserve(&mut self, reserve: U128) {
        self.assert_owner();
        env::storage_write(STORAGE_RESERVE_KEY, &reserve.0.to_le_bytes());
        self.assert_storage_reserve();
    }

    // ------------------------------------------------------------------
    // views
    // ------------------------------------------------------------------

    pub fn get_config(&self) -> Config {
        self.config.clone()
    }

    pub fn get_storage_reserve(&self) -> U128 {
        U128(self.storage_reserve())
    }

    pub fn get_kinds(&self) -> KindMap {
        self.config.kinds.clone()
    }

    pub fn get_order(&self, id: String) -> Option<OrderView> {
        self.orders.get(&id).map(OrderView::from)
    }

    pub fn list_orders(
        &self,
        status: Option<Status>,
        from: Option<u32>,
        limit: Option<u32>,
        kind: Option<String>,
    ) -> Vec<OrderView> {
        let limit = limit.unwrap_or(50).min(MAX_LIST_LIMIT) as usize;
        self.orders
            .values()
            .filter(|o| {
                status.is_none_or(|s| o.status == s) && kind.as_ref().is_none_or(|k| &o.kind == k)
            })
            .skip(from.unwrap_or(0) as usize)
            .take(limit)
            .map(OrderView::from)
            .collect()
    }

    pub fn orders_by_account(
        &self,
        account_id: AccountId,
        from: Option<u32>,
        limit: Option<u32>,
    ) -> Vec<OrderView> {
        let limit = limit.unwrap_or(50).min(MAX_LIST_LIMIT) as usize;
        self.by_account
            .get(&account_id)
            .map(|ids| {
                ids.iter()
                    .rev()
                    .filter_map(|id| self.orders.get(id))
                    .skip(from.unwrap_or(0) as usize)
                    .take(limit)
                    .map(OrderView::from)
                    .collect()
            })
            .unwrap_or_default()
    }

    pub fn get_profile(&self, account_id: AccountId) -> ProfileView {
        let stats = self.stat(&account_id);
        ProfileView {
            profile: self.profiles.get(&account_id).cloned(),
            level: level(&stats),
            stats,
            bond: self.bond(&account_id),
            approved: self.approved.contains(&account_id),
            account_id,
        }
    }

    pub fn is_nullifier_used(&self, tx_ref_hash: String) -> Option<String> {
        self.nullifiers
            .get(&tx_ref_hash.to_ascii_lowercase())
            .cloned()
    }

    pub fn get_liabilities(&self, token_id: String) -> U128 {
        U128(self.liability(&token_id))
    }

    pub fn get_owed(&self, account_id: AccountId, token_id: String) -> U128 {
        U128(self.owed.get(&(account_id, token_id)).copied().unwrap_or(0))
    }

    /// `[buyer side, fulfiller side]` rating weight already applied to stats.
    pub fn get_rating_weights(&self, order_id: String) -> (u64, u64) {
        (
            applied_weight(&order_id, SIDE_BUYER),
            applied_weight(&order_id, SIDE_FULFILLER),
        )
    }

    /// `[orders stored, profiles registered]`
    pub fn get_counts(&self) -> (u32, u32) {
        (self.orders.len(), self.profiles_count)
    }
}

fn read_old_bytes<'a>(bytes: &'a [u8], position: &mut usize) -> &'a [u8] {
    require!(bytes.len() >= *position + 4, "bad order");
    let len = u32::from_le_bytes(bytes[*position..*position + 4].try_into().unwrap()) as usize;
    *position += 4;
    require!(bytes.len() >= *position + len, "bad order");
    let text = &bytes[*position..*position + len];
    *position += len;
    text
}

fn append_borsh_string(bytes: &mut Vec<u8>, value: &str) {
    bytes.extend((value.len() as u32).to_le_bytes());
    bytes.extend(value.as_bytes());
}

/// Replace the two bank-only Borsh fields with the generic fields. The
/// settlement, rating and dispute suffix and IterableMap key index survive.
fn convert_legacy_order(stored: &[u8]) -> Vec<u8> {
    let mut position = 0;
    for _ in 0..3 {
        read_old_bytes(stored, &mut position); // id, buyer, token
    }
    require!(stored.len() >= position + 16 + 16 + 8, "bad order");
    position += 32; // pay_amount, reward
    let prefix_end = position;
    let amount = u64::from_le_bytes(stored[position..position + 8].try_into().unwrap());
    position += 8;
    let merchant_hash = std::str::from_utf8(read_old_bytes(stored, &mut position))
        .unwrap_or_else(|_| env::panic_str("bad order"));
    let spec = format!("{{\"amount\":\"{amount}\",\"bank\":\"vpbank\",\"country\":\"VN\",\"currency\":\"VND\",\"merchant_hash\":\"{merchant_hash}\",\"v\":1}}");
    let hash = sha256_hex(spec.as_bytes());
    let mut result = stored[..prefix_end].to_vec();
    append_borsh_string(&mut result, "bank_transfer");
    append_borsh_string(&mut result, &hash);
    result.push(0); // quoted_by = None
    require!(stored.len() >= position + 4, "bad order");
    let index_start = stored.len() - 4;
    result.extend_from_slice(&stored[position..index_start]);
    result.extend_from_slice(&0u32.to_le_bytes()); // verify_seq starts at zero
    result.push(0); // total proof budget starts at migration
    result.extend_from_slice(&stored[index_start..]);
    result
}

// ----------------------------------------------------------------------
// internal ops
// ----------------------------------------------------------------------
impl Contract {
    fn storage_reserve(&self) -> u128 {
        env::storage_read(STORAGE_RESERVE_KEY)
            .and_then(|bytes| bytes.try_into().ok())
            .map(u128::from_le_bytes)
            .unwrap_or(DEFAULT_STORAGE_RESERVE.as_yoctonear())
    }

    fn assert_storage_reserve(&self) {
        // The root state and lazy collections may flush after this method returns.
        let storage_cost = env::storage_byte_cost()
            .as_yoctonear()
            .saturating_mul(env::storage_usage() as u128 + 2_000);
        require!(
            env::account_balance()
                .as_yoctonear()
                .saturating_sub(storage_cost)
                >= self.storage_reserve(),
            "storage reserve exhausted"
        );
    }

    fn kind(&self, name: &str) -> &KindConfig {
        self.config
            .kinds
            .get(name)
            .unwrap_or_else(|| env::panic_str("unknown kind"))
    }

    fn assert_intents(&self) {
        require!(
            env::predecessor_account_id() == self.config.intents_contract,
            "only intents contract"
        );
    }

    fn assert_not_paused(&self) {
        self.assert_migrated();
        require!(!self.config.paused, "paused");
    }

    fn assert_owner(&self) {
        self.assert_migrated();
        assert_one_yocto();
        require!(
            env::predecessor_account_id() == self.config.owner,
            "only owner"
        );
    }

    fn liability(&self, token: &str) -> u128 {
        self.liabilities.get(token).copied().unwrap_or(0)
    }

    fn add_liability(&mut self, token: &str, amount: u128) {
        let v = self
            .liability(token)
            .checked_add(amount)
            .unwrap_or_else(|| env::panic_str("overflow"));
        self.liabilities.insert(token.to_string(), v);
    }

    fn sub_liability(&mut self, token: &str, amount: u128) {
        let v = self.liability(token).saturating_sub(amount);
        self.liabilities.insert(token.to_string(), v);
    }

    /// Deletes the order record (the id stays in `used_ids`).
    fn drop_order(&mut self, o: &Order) {
        self.orders.remove(&o.id);
        if o.kind == "in_person" {
            env::storage_remove(&in_person_hash_key(&o.id));
        }
        set_applied_weight(&o.id, SIDE_BUYER, 0);
        set_applied_weight(&o.id, SIDE_FULFILLER, 0);
        self.unindex(&o.buyer, &o.id);
        if let Some(f) = &o.fulfiller {
            self.unindex(f, &o.id);
        }
        emit("order_pruned", &[("order_id", E::S(o.id.as_str()))]);
    }

    fn order(&self, id: &str) -> Order {
        self.assert_migrated();
        self.orders
            .get(id)
            .cloned()
            .unwrap_or_else(|| env::panic_str("order not found"))
    }

    fn save(&mut self, o: Order) {
        self.orders.insert(o.id.clone(), o);
    }

    fn stat(&self, a: &AccountId) -> Stats {
        self.stats.get(a).cloned().unwrap_or_default()
    }

    fn bump(&mut self, a: &AccountId, f: impl FnOnce(&mut Stats)) {
        let mut s = self.stat(a);
        f(&mut s);
        self.stats.insert(a.clone(), s);
    }

    fn bond(&self, a: &AccountId) -> Bond {
        self.bonds.get(a).cloned().unwrap_or_default()
    }

    /// Moves `locked` out of the locked bond: `slash` leaves the bond (caller
    /// sends it), the rest returns to `available`.
    fn unlock_bond(&mut self, f: &AccountId, locked: u128, slash: u128) {
        if locked == 0 {
            return;
        }
        let mut b = self.bond(f);
        b.locked = U128(b.locked.0 - locked);
        b.available = U128(b.available.0 + (locked - slash));
        self.bonds.insert(f.clone(), b);
    }

    fn index(&mut self, a: &AccountId, id: &str) {
        let mut v = self.by_account.get(a).cloned().unwrap_or_default();
        if v.last().map(String::as_str) == Some(id) {
            return;
        }
        v.push(id.to_string());
        if v.len() > MAX_ACCOUNT_INDEX {
            v.remove(0);
        }
        self.by_account.insert(a.clone(), v);
    }

    fn unindex(&mut self, a: &AccountId, id: &str) {
        if let Some(v) = self.by_account.get_mut(a) {
            v.retain(|x| x != id);
        }
    }

    /// Open-kind limits apply only to level-0 accounts, so token_buy needs a
    /// separate flag to keep every level at one active claim. All clearing
    /// paths use this helper to avoid leaving an account locked.
    fn clear_active_claim(&mut self, o: &Order, fulfiller: &AccountId) {
        self.bump(fulfiller, |s| {
            s.active_claims = s.active_claims.saturating_sub(1)
        });
        if o.kind == "token_buy" {
            env::storage_remove(&token_buy_claim_key(fulfiller));
        }
    }

    /// Moves the order out of the buyer's open count and fulfiller's active count (once).
    fn settle(&mut self, o: &mut Order) {
        if o.settled {
            return;
        }
        o.settled = true;
        self.bump(&o.buyer, |s| {
            s.open_as_buyer = s.open_as_buyer.saturating_sub(1)
        });
        if let Some(f) = o.fulfiller.clone() {
            self.clear_active_claim(o, &f);
        }
    }

    /// Rating weight of an order: 1 per `rating_unit` of value, at most 10.
    fn rating_weight(&self, o: &Order) -> u64 {
        (o.value() / self.config.rating_unit.0).min(10) as u64
    }

    fn count_job(&mut self, o: &Order) {
        let value = o.value();
        if let Some(f) = &o.fulfiller {
            self.bump(f, |s| {
                s.jobs_done += 1;
                s.volume = U128(s.volume.0.saturating_add(value));
            });
        }
        self.bump(&o.buyer, |s| s.jobs_as_buyer += 1);
    }

    /// Schedules `mt_transfer` with an `on_sent` callback. No-op for 0.
    fn send(&mut self, to: &AccountId, token: &str, amount: u128, memo: &str) {
        if amount == 0 {
            return;
        }
        ext_mt::ext(self.config.intents_contract.clone())
            .with_attached_deposit(NearToken::from_yoctonear(1))
            .with_static_gas(GAS_MT_TRANSFER)
            .with_unused_gas_weight(0)
            .mt_transfer(
                to.clone(),
                token.to_string(),
                U128(amount),
                None,
                Some(memo.to_string()),
            )
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(GAS_ON_SENT)
                    .with_unused_gas_weight(0)
                    .on_sent(to.clone(), token.to_string(), U128(amount)),
            )
            .detach();
    }

    fn payout(&mut self, mut o: Order) {
        o.status = Status::Paid;
        o.paid_at = Some(now());
        self.settle(&mut o);
        self.count_job(&o);
        let f = o.fulfiller.clone().unwrap();
        let (token, value) = (o.token.clone(), o.value());
        emit(
            "order_paid",
            &[
                ("order_id", E::S(o.id.as_str())),
                ("fulfiller", E::S(f.as_str())),
                ("amount", E::Q(value)),
            ],
        );
        self.save(o);
        self.send(&f, &token, value, "fulfil payout");
    }

    fn reject(&mut self, mut o: Order, reason: String) {
        o.status = if o.attempts >= MAX_ATTEMPTS {
            Status::UnderReview
        } else {
            Status::ProofRejected
        };
        emit(
            "proof_rejected",
            &[
                ("order_id", E::S(o.id.as_str())),
                ("attempt", E::N(o.attempts as u64)),
                ("reason", E::S(reason.as_str())),
                ("status", status_json(o.status)),
            ],
        );
        o.last_reject_reason = Some(reason);
        self.save(o);
    }

    fn under_review(&mut self, mut o: Order, reason: &str) {
        o.status = Status::UnderReview;
        emit(
            "order_under_review",
            &[("order_id", E::S(o.id.as_str())), ("reason", E::S(reason))],
        );
        self.save(o);
    }

    fn internal_fund(
        &mut self,
        buyer: AccountId,
        token: &str,
        amount: u128,
        f: FundOrder,
        spec: Option<String>,
    ) {
        self.assert_migrated();
        self.assert_storage_reserve();
        let c = &self.config;
        let kind_config = self.kind(&f.kind);
        require!(kind_config.enabled, "disabled");
        require!(
            c.accepted_tokens.iter().any(|t| t == token),
            "token not accepted"
        );
        if f.kind == "in_person" {
            require!(token == c.bond_token, "in_person requires bond token");
        }
        if f.kind == "token_buy" {
            require!(token == c.bond_token, "token_buy requires bond token");
            require!(
                f.pay_amount.0 >= TOKEN_BUY_MIN_PAY_AMOUNT,
                "token_buy amount below 1 USDC"
            );
        }
        require!(is_order_id(&f.id), "bad order id");
        require!(!self.used_ids.contains(&f.id), "order id used");
        require!(is_hex64(&f.spec_hash), "bad spec_hash");
        require!(f.pay_amount.0 > 0, "zero amount");
        let value = f
            .pay_amount
            .0
            .checked_add(f.reward.0)
            .unwrap_or_else(|| env::panic_str("overflow"));
        require!(value == amount, "amount != pay_amount + reward");
        if f.kind == "token_buy" {
            require!(value <= kind_config.open_max_order_value.0, "value limit");
        }
        require!(value >= c.min_order_amount.0, "order too small");
        let delivery_hash = if f.kind == "in_person" {
            Some(in_person_delivery_hash(
                &f,
                spec.as_deref()
                    .unwrap_or_else(|| env::panic_str("missing spec")),
                value,
            ))
        } else {
            None
        };
        let t = now();
        require!(
            f.deadline_ns.0 > t && f.deadline_ns.0 - t <= kind_config.max_deadline_ns.0,
            "bad deadline"
        );
        require!(self.orders.len() < c.max_orders, "order book full");
        if let Some(quoted_by) = &f.quoted_by {
            require!(quoted_by != &buyer, "buyer cannot quote itself");
            self.assert_kind_eligible(quoted_by, kind_config);
        }
        let mut s = self.stat(&buyer);
        require!(
            s.open_as_buyer < MAX_OPEN_ORDERS_PER_BUYER,
            "too many open orders"
        );
        s.open_as_buyer += 1;
        self.stats.insert(buyer.clone(), s);

        let o = Order {
            id: f.id.clone(),
            buyer: buyer.clone(),
            token: token.to_string(),
            pay_amount: f.pay_amount.0,
            reward: f.reward.0,
            kind: f.kind,
            spec_hash: f.spec_hash,
            quoted_by: f.quoted_by,
            deadline_ns: f.deadline_ns.0,
            created_at: t,
            fulfiller: None,
            bond_locked: 0,
            claimed_at: None,
            sent_at: None,
            verify_started_at: None,
            verified_at: None,
            paid_at: None,
            ended_at: None,
            proof_sha256: None,
            nullifier: None,
            status: Status::Funded,
            attempts: 0,
            last_reject_reason: None,
            buyer_rating: None,
            fulfiller_rating: None,
            dispute_reason: None,
            disputed_by: None,
            verdict: None,
            verdict_note_hash: None,
            settled: false,
            verify_seq: 0,
            total_proof_attempts: 0,
        };
        self.used_ids.insert(f.id.clone());
        self.add_liability(token, value);
        self.index(&buyer, &f.id);
        emit(
            "order_funded",
            &[
                ("order_id", E::S(f.id.as_str())),
                ("buyer", E::S(buyer.as_str())),
                ("token", E::S(token)),
                ("amount", E::Q(value)),
            ],
        );
        self.save(o);
        if let Some(hash) = delivery_hash {
            env::storage_write(&in_person_hash_key(&f.id), &hash);
        }
        self.assert_storage_reserve();
    }

    fn op_register(&mut self, signer: AccountId, bank_bin: String, last4: String) {
        self.assert_not_paused();
        self.assert_storage_reserve();
        require!(
            bank_bin.is_empty() || is_digits(&bank_bin, 6),
            "bank_bin must be 6 digits"
        );
        require!(
            last4.is_empty() || is_digits(&last4, 4),
            "account_last4 must be 4 digits"
        );
        match self.profiles.get(&signer) {
            None => {
                require!(
                    self.profiles_count < self.config.max_profiles,
                    "profile limit reached"
                );
                self.profiles_count += 1;
            }
            // new bank details need a new approval
            Some(p) if p.bank_bin != bank_bin || p.account_last4 != last4 => {
                self.approved.remove(&signer);
            }
            _ => {}
        }
        self.profiles.insert(
            signer.clone(),
            Profile {
                bank_bin,
                account_last4: last4,
                registered_at: U64(now()),
            },
        );
        self.assert_storage_reserve();
        emit(
            "fulfiller_registered",
            &[("account_id", E::S(signer.as_str()))],
        );
    }

    fn op_claim(&mut self, signer: AccountId, order_id: String) {
        self.assert_not_paused();
        self.assert_storage_reserve();
        let mut o = self.order(&order_id);
        let kind = self.kind(&o.kind).clone();
        self.assert_kind_eligible(&signer, &kind);
        if o.quoted_by.as_ref().is_some_and(|q| q != &signer)
            && now() < o.created_at.saturating_add(kind.quote_exclusive_ns.0)
        {
            env::panic_str("quote exclusive");
        }
        require!(signer != o.buyer, "buyer cannot claim");
        if o.status != Status::Funded {
            env::panic_str(if o.fulfiller.is_some() {
                "already claimed"
            } else {
                "not claimable"
            });
        }
        require!(now() < o.deadline_ns, "order expired");
        let mut s = self.stat(&signer);
        require!(
            !env::storage_has_key(&token_buy_claim_key(&signer)),
            "claim limit"
        );
        if o.kind == "token_buy" {
            require!(s.active_claims == 0, "claim limit");
        }
        let open_level_zero =
            matches!(&kind.access, Access::Named(s) if s == "open") && level(&s) == 0;
        if open_level_zero {
            require!(s.active_claims < kind.open_max_active_claims, "claim limit");
        }
        if o.kind == "token_buy" || open_level_zero {
            require!(o.value() <= kind.open_max_order_value.0, "value limit");
        }
        require!(
            s.active_claims < MAX_ACTIVE_CLAIMS,
            "too many active claims"
        );
        let lock = if o.kind == "token_buy" {
            0
        } else {
            o.value()
                .checked_mul(self.config.bond_per_job_bps as u128)
                .unwrap_or_else(|| env::panic_str("overflow"))
                / BPS_DENOM
        };
        let mut b = self.bond(&signer);
        if o.kind != "token_buy" {
            require!(
                b.available.0.saturating_add(b.locked.0) >= self.config.min_bond.0,
                "bond below minimum"
            );
        }
        require!(b.available.0 >= lock, "insufficient bond");
        if lock > 0 {
            b.available = U128(b.available.0 - lock);
            b.locked = U128(b.locked.0 + lock);
            self.bonds.insert(signer.clone(), b);
        }
        s.active_claims += 1;
        self.stats.insert(signer.clone(), s);
        if o.kind == "token_buy" {
            env::storage_write(&token_buy_claim_key(&signer), b"1");
        }
        o.fulfiller = Some(signer.clone());
        o.claimed_at = Some(now());
        o.bond_locked = lock;
        o.status = Status::Claimed;
        self.index(&signer, &order_id);
        emit(
            "order_claimed",
            &[
                ("order_id", E::S(order_id.as_str())),
                ("fulfiller", E::S(signer.as_str())),
                ("bond_locked", E::Q(lock)),
            ],
        );
        self.save(o);
        self.assert_storage_reserve();
    }

    fn assert_kind_eligible(&self, signer: &AccountId, kind: &KindConfig) {
        require!(
            self.profiles.contains_key(signer),
            "not a registered fulfiller"
        );
        match &kind.access {
            Access::Named(s) if s == "approved" => {
                require!(self.approved.contains(signer), "fulfiller not approved")
            }
            Access::Named(_) => {}
            Access::Allowlist { allowlist } => {
                require!(allowlist.contains(&signer), "fulfiller not allowed")
            }
            Access::MinBond { min_bond } => {
                let bond = self.bond(&signer);
                require!(
                    bond.available.0.saturating_add(bond.locked.0) >= min_bond.0,
                    "bond below kind minimum"
                );
            }
        }
    }

    fn op_release_claim(&mut self, signer: AccountId, order_id: String) {
        let mut o = self.order(&order_id);
        Self::assert_fulfiller(&o, &signer);
        require!(
            matches!(
                o.status,
                Status::Claimed | Status::Sent | Status::ProofRejected
            ),
            "not releasable"
        );
        self.unlock_bond(&signer, o.bond_locked, 0);
        self.clear_active_claim(&o, &signer);
        self.unindex(&signer, &order_id);
        o.fulfiller = None;
        o.claimed_at = None;
        o.sent_at = None;
        o.verify_started_at = None;
        o.proof_sha256 = None;
        o.attempts = 0;
        o.last_reject_reason = None;
        o.bond_locked = 0;
        o.status = Status::Funded;
        if o.quoted_by.as_ref() == Some(&signer) {
            o.quoted_by = None;
        }
        emit(
            "claim_released",
            &[
                ("order_id", E::S(&order_id)),
                ("fulfiller", E::S(signer.as_str())),
            ],
        );
        self.save(o);
    }

    fn assert_fulfiller(o: &Order, signer: &AccountId) {
        require!(o.fulfiller.as_ref() == Some(signer), "not the fulfiller");
    }

    fn op_sent(&mut self, signer: AccountId, order_id: String) {
        let mut o = self.order(&order_id);
        Self::assert_fulfiller(&o, &signer);
        require!(o.status == Status::Claimed, "not claimed");
        require!(o.kind != "in_person", "sent not allowed for in_person");
        require!(
            now()
                < o.claimed_at
                    .unwrap_or(0)
                    .saturating_add(self.kind(&o.kind).claim_timeout_ns.0)
                    .min(o.deadline_ns),
            "claim timed out"
        );
        o.status = Status::Sent;
        o.sent_at = Some(now());
        emit("order_sent", &[("order_id", E::S(order_id.as_str()))]);
        self.save(o);
    }

    fn op_confirm_delivery(
        &mut self,
        signer: AccountId,
        order_id: String,
        secret_hex: String,
    ) -> bool {
        self.assert_not_paused();
        let mut o = self.order(&order_id);
        require!(o.kind == "in_person", "not an in_person order");
        Self::assert_fulfiller(&o, &signer);
        require!(o.status == Status::Claimed, "not claimed");
        let claim_end = o
            .claimed_at
            .unwrap_or(0)
            .saturating_add(self.kind(&o.kind).claim_timeout_ns.0);
        require!(now() < o.deadline_ns && now() < claim_end, "timed out");
        require!(
            o.total_proof_attempts < MAX_TOTAL_PROOF_ATTEMPTS,
            "proof budget used"
        );

        // No failing `require!` or panic below this point: every code attempt
        // by the current claimer must commit its counter even if invalid.
        o.attempts += 1;
        o.total_proof_attempts += 1;
        let valid_secret = decode_lower_hex_32(&secret_hex).is_some_and(|secret| {
            env::storage_read(&in_person_hash_key(&order_id))
                .is_some_and(|expected| env::sha256(&secret) == expected)
        });
        let nullifier = sha256_hex(format!("in_person:{order_id}").as_bytes());
        let fresh = !self.nullifiers.contains_key(&nullifier);
        if !valid_secret || !fresh {
            o.last_reject_reason = Some("invalid delivery code".into());
            emit(
                "delivery_attempt_failed",
                &[
                    ("order_id", E::S(&order_id)),
                    ("attempt", E::N(o.total_proof_attempts as u64)),
                ],
            );
            self.save(o);
            return false;
        }

        self.nullifiers.insert(nullifier.clone(), order_id.clone());
        o.nullifier = Some(nullifier.clone());
        o.verified_at = Some(now());
        emit(
            "proof_verified",
            &[
                ("order_id", E::S(&order_id)),
                ("nullifier", E::S(&nullifier)),
                ("attempt", E::N(o.total_proof_attempts as u64)),
            ],
        );
        self.payout(o);
        true
    }

    /// `signer = Some(fulfiller)` via `on_auth`, `None` when called by `relayer`.
    fn op_submit_proof(
        &mut self,
        signer: Option<AccountId>,
        order_id: String,
        proof: String,
        spec: String,
    ) -> Promise {
        self.assert_not_paused();
        let mut o = self.order(&order_id);
        require!(o.kind != "in_person", "use confirm_delivery");
        let kind = self.kind(&o.kind).clone();
        require!(now() < o.deadline_ns, "order deadline over");
        if let Some(signer) = &signer {
            Self::assert_fulfiller(&o, signer);
        }
        require!(
            matches!(
                o.status,
                Status::Claimed | Status::Sent | Status::ProofRejected
            ),
            "not awaiting proof"
        );
        require!(o.attempts < MAX_ATTEMPTS, "no attempts left");
        require!(
            o.total_proof_attempts < MAX_TOTAL_PROOF_ATTEMPTS,
            "proof budget used"
        );
        if o.status == Status::Claimed {
            require!(!kind.needs_sent || o.kind == "bank_transfer", "not sent");
            // The first proof starts the proof window, even without a sent step.
            o.sent_at = Some(now());
            if o.kind == "bank_transfer" {
                emit("order_sent", &[("order_id", E::S(order_id.as_str()))]);
            }
        }
        let proof = proof.to_ascii_lowercase();
        require!(is_hex64(&proof), "bad proof_sha256");
        require!(
            sha256_hex(spec.as_bytes()) == o.spec_hash,
            "spec hash mismatch"
        );
        require!(
            now()
                < o.sent_at
                    .unwrap_or(0)
                    .saturating_add(kind.proof_timeout_ns.0)
                    .min(o.deadline_ns),
            "proof window over"
        );
        let c = self.config.clone();
        let outlayer_gas = Gas::from_tgas(c.outlayer_gas_tgas);
        let need = outlayer_gas
            .saturating_add(GAS_VERIFY_CB)
            .saturating_add(GAS_SUBMIT_OVERHEAD);
        require!(
            env::prepaid_gas().saturating_sub(env::used_gas()) >= need,
            "not enough gas for verification"
        );
        let deposit = NearToken::from_yoctonear(c.outlayer_deposit.0);
        let storage = env::storage_byte_cost().saturating_mul(env::storage_usage() as u128 + 2_000);
        require!(
            env::account_balance() >= storage.saturating_add(deposit).saturating_add(NEAR_RESERVE),
            "escrow NEAR float too low"
        );

        o.attempts += 1;
        o.total_proof_attempts += 1;
        o.verify_seq = o
            .verify_seq
            .checked_add(1)
            .unwrap_or_else(|| env::panic_str("verify seq overflow"));
        o.status = Status::Verifying;
        o.verify_started_at = Some(now());
        o.proof_sha256 = Some(proof.clone());
        let attempt = o.attempts;
        let verify_seq = o.verify_seq;
        let expected_fulfiller = o.fulfiller.clone().unwrap();
        let expected_proof_sha256 = proof.clone();
        let input = json!({
            "order_id": o.id,
            "kind": o.kind,
            "spec": spec,
            "spec_hash": o.spec_hash,
            "proof_sha256": proof,
            "claimed_at_ns": U64(o.claimed_at.unwrap_or(0)),
            "fulfiller": expected_fulfiller,
            "buyer": o.buyer,
            "blob_url": format!("{}{}", c.proof_blob_base_url, proof),
        })
        .to_string();
        emit(
            "proof_submitted",
            &[
                ("order_id", E::S(o.id.as_str())),
                ("proof_sha256", E::S(proof.as_str())),
                (
                    "by",
                    E::S(signer.as_ref().map_or("relayer", |s| s.as_str())),
                ),
                ("attempt", E::N(attempt as u64)),
            ],
        );
        self.save(o);

        let source: Value = serde_json::from_str(&kind.verifier_source).unwrap();
        let limits: Value = serde_json::from_str(&c.verifier_resource_limits).unwrap();
        let secrets = kind
            .secrets_ref
            .map(|r| json!({"profile": r.profile, "account_id": r.account_id}));
        ext_outlayer::ext(c.outlayer_contract.clone())
            .with_attached_deposit(deposit)
            .with_static_gas(outlayer_gas)
            .with_unused_gas_weight(1)
            .request_execution(
                source,
                Some(limits),
                Some(input),
                secrets,
                Some("Json".into()),
                Some(env::current_account_id()),
                None,
            )
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(GAS_VERIFY_CB)
                    .with_unused_gas_weight(0)
                    .on_verify_result(
                        order_id,
                        attempt,
                        verify_seq,
                        expected_fulfiller,
                        expected_proof_sha256,
                    ),
            )
    }

    fn op_cancel(&mut self, signer: AccountId, order_id: String) {
        let mut o = self.order(&order_id);
        require!(o.buyer == signer, "not the buyer");
        require!(o.status == Status::Funded, "not cancellable");
        o.status = Status::Cancelled;
        o.ended_at = Some(now());
        self.settle(&mut o);
        let (token, value) = (o.token.clone(), o.value());
        emit("order_cancelled", &[("order_id", E::S(order_id.as_str()))]);
        self.drop_order(&o);
        self.send(&signer, &token, value, "fulfil refund");
    }

    fn op_dispute(&mut self, signer: AccountId, order_id: String, reason_code: u8) {
        let mut o = self.order(&order_id);
        let is_buyer = o.buyer == signer;
        let is_f = o.fulfiller.as_ref() == Some(&signer);
        let allowed = match o.status {
            Status::Paid => {
                is_buyer
                    && now()
                        < o.paid_at
                            .unwrap_or(0)
                            .saturating_add(self.config.bond_hold_ns.0)
            }
            // anchored at the earliest possible payout time
            Status::Verified => {
                is_buyer
                    && now()
                        < o.verified_at
                            .unwrap_or(0)
                            .saturating_add(self.config.challenge_window_ns.0)
                            .saturating_add(self.config.bond_hold_ns.0)
            }
            Status::UnderReview => is_buyer || is_f,
            _ => false,
        };
        require!(allowed, "dispute not allowed");
        o.status = Status::Disputed;
        o.dispute_reason = Some(reason_code);
        o.disputed_by = Some(signer.clone());
        emit(
            "dispute_opened",
            &[
                ("order_id", E::S(order_id.as_str())),
                ("by", E::S(signer.as_str())),
                ("reason_code", E::N(reason_code as u64)),
            ],
        );
        self.save(o);
    }

    fn op_rate(&mut self, signer: AccountId, order_id: String, stars: u8) {
        require!((1..=5).contains(&stars), "stars must be 1..5");
        let mut o = self.order(&order_id);
        require!(o.paid_at.is_some(), "order not paid");
        let anchor = match o.status {
            Status::Paid | Status::Closed => o.paid_at,
            Status::Resolved => o.ended_at,
            _ => None,
        }
        .unwrap_or_else(|| env::panic_str("order not finished"));
        require!(
            now() <= anchor.saturating_add(self.config.rating_window_ns.0),
            "rating window over"
        );
        let (target, side) = if signer == o.buyer {
            require!(o.buyer_rating.is_none(), "already rated");
            o.buyer_rating = Some(stars);
            (o.fulfiller.clone().unwrap(), SIDE_BUYER)
        } else if o.fulfiller.as_ref() == Some(&signer) {
            require!(o.fulfiller_rating.is_none(), "already rated");
            o.fulfiller_rating = Some(stars);
            (o.buyer.clone(), SIDE_FULFILLER)
        } else {
            env::panic_str("not a party")
        };
        let w = self.rating_weight(&o);
        if w > 0 {
            self.bump(&target, |s| {
                s.star_sum += stars as u64 * w;
                s.star_count += w;
            });
            // recorded so `recount_rating` only ever adds the difference
            set_applied_weight(&order_id, side, w);
        }
        emit(
            "rated",
            &[
                ("order_id", E::S(order_id.as_str())),
                ("by", E::S(signer.as_str())),
                ("target", E::S(target.as_str())),
                ("stars", E::N(stars as u64)),
                ("weight", E::N(w as u64)),
            ],
        );
        self.save(o);
        self.assert_storage_reserve();
    }

    fn op_withdraw_bond(&mut self, signer: AccountId, amount: u128) {
        let mut b = self.bond(&signer);
        require!(
            amount > 0 && b.available.0 >= amount,
            "insufficient available bond"
        );
        b.available = U128(b.available.0 - amount);
        self.bonds.insert(signer.clone(), b);
        emit(
            "bond_withdrawn",
            &[
                ("account_id", E::S(signer.as_str())),
                ("amount", E::Q(amount)),
            ],
        );
        let bt = self.config.bond_token.clone();
        self.send(&signer, &bt, amount, "fulfil bond withdraw");
    }
}
