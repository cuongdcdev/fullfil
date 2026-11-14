#![allow(unused_must_use)]

use super::*;
use near_sdk::borsh;
use near_sdk::mock::MockAction;
use near_sdk::test_utils::{get_created_receipts, get_logs, VMContextBuilder};
use near_sdk::{testing_env, PromiseResult, RuntimeFeesConfig};

const ESCROW: &str = "escrow.test";
const INTENTS: &str = "intents.test";
const OUTLAYER: &str = "outlayer.test";
const OWNER: &str = "owner.test";
const ARBITER: &str = "arbiter.test";
const BUYER: &str = "buyer.test";
const FUL: &str = "ful.test";
const FUL2: &str = "ful2.test";
const USDC: &str = "nep141:usdc.test";
const OTHER: &str = "nep141:other.test";
const MH: &str = "1111111111111111111111111111111111111111111111111111111111111111";
const PROOF: &str = "2222222222222222222222222222222222222222222222222222222222222222";
const TXREF: &str = "3333333333333333333333333333333333333333333333333333333333333333";
const T0: u64 = 1_800_000_000_000_000_000;
const MIN: u64 = 60 * 1_000_000_000;
const HOUR: u64 = 60 * MIN;

fn a(s: &str) -> AccountId {
    s.parse().unwrap()
}

fn builder(pred: &str, ts: u64) -> VMContextBuilder {
    let mut b = VMContextBuilder::new();
    b.current_account_id(a(ESCROW))
        .predecessor_account_id(a(pred))
        .signer_account_id(a(pred))
        .block_timestamp(ts)
        .account_balance(NearToken::from_near(10))
        .prepaid_gas(Gas::from_tgas(300));
    b
}

fn set(pred: &str, ts: u64) {
    testing_env!(builder(pred, ts).build());
}

fn set_with_result(ts: u64, r: PromiseResult) {
    testing_env!(
        builder(ESCROW, ts).build(),
        near_sdk::test_vm_config(),
        RuntimeFeesConfig::test(),
        Default::default(),
        vec![r]
    );
}

/// Mirrors the init example in contracts/escrow/README.md.
fn default_config() -> Config {
    serde_json::from_value(json!({
        "owner": OWNER,
        "intents_contract": INTENTS,
        "outlayer_contract": OUTLAYER,

        "verifier_resource_limits": r#"{"max_instructions":10000000000,"max_memory_mb":128,"max_execution_seconds":60}"#,

        "proof_blob_base_url": "https://api.example/proof-blob/",
        "outlayer_deposit": "10000000000000000000000",
        "outlayer_gas_tgas": 100,
        "arbiter": ARBITER,
        "relayer": "relayer.test",
        "accepted_tokens": [USDC, OTHER],
        "bond_token": USDC,

        "min_bond": "0",
        "bond_per_job_bps": 0,
        "min_order_amount": "100000",
        "bond_hold_ns": (24 * HOUR).to_string(),
        "challenge_window_ns": "0",


        "rating_window_ns": (7 * 24 * HOUR).to_string(),
        "max_email_skew_ns": (10 * MIN).to_string(),
        "rating_unit": "1000000",
        "max_orders": 1000,
        "max_profiles": 1000,
        "paused": false,
        "kinds": {"bank_transfer": {"enabled": true, "verifier_source": r#"{"Project":{"project_id":"escrow.test/email-verifier","version_key":null}}"#, "secrets_ref": null, "access": "approved", "needs_sent": true, "claim_timeout_ns": (15 * MIN).to_string(), "proof_timeout_ns": (2 * HOUR).to_string(), "max_deadline_ns": (24 * HOUR).to_string()}}
    }))
    .unwrap()
}

fn new_contract(f: Option<fn(&mut Config)>) -> Contract {
    set(OWNER, T0);
    let mut cfg = default_config();
    if let Some(f) = f {
        f(&mut cfg);
    }
    Contract::new(cfg)
}

fn spec() -> String {
    format!(
        r#"{{"amount":"50000","bank":"vpbank","country":"VN","currency":"VND","merchant_hash":"{MH}","v":1}}"#
    )
}

fn fund_msg(id: &str, pay: u128, reward: u128, deadline: u64) -> String {
    json!({"op":"fund","order":{"id":id,"kind":"bank_transfer","spec_hash":sha256_hex(spec().as_bytes()),
        "pay_amount":U128(pay),"reward":U128(reward),"deadline_ns":U64(deadline)}})
    .to_string()
}

fn fund(c: &mut Contract, id: &str, ts: u64) {
    set(INTENTS, ts);
    c.mt_on_transfer(
        a(BUYER),
        vec![a(BUYER)],
        vec![USDC.into()],
        vec![U128(2_100_000)],
        fund_msg(id, 2_000_000, 100_000, ts + 24 * HOUR),
    );
}

fn fund_kind(c: &mut Contract, id: &str, kind: &str, ts: u64) {
    set(INTENTS, ts);
    let msg = json!({"op":"fund","order":{"id":id,"kind":kind,
        "spec_hash":sha256_hex(spec().as_bytes()),"pay_amount":"2000000",
        "reward":"100000","deadline_ns":(ts + HOUR).to_string()}});
    c.mt_on_transfer(
        a(BUYER),
        vec![a(BUYER)],
        vec![USDC.into()],
        vec![U128(2_100_000)],
        msg.to_string(),
    );
}

fn in_person_spec(secret: &[u8; 32]) -> String {
    format!(
        "{{\"area\":\"District 1\",\"delivery_hash\":\"{}\",\"item_desc\":\"Synthetic item\",\"price\":\"1000000\",\"v\":1}}",
        sha256_hex(secret)
    )
}

fn fund_in_person(c: &mut Contract, id: &str, ts: u64, secret: &[u8; 32]) {
    let spec = in_person_spec(secret);
    let message = json!({"op":"fund","spec":spec,"order":{
        "id":id,"kind":"in_person","spec_hash":sha256_hex(spec.as_bytes()),
        "pay_amount":"1000000","reward":"50000",
        "deadline_ns":(ts + 24 * HOUR).to_string()
    }});
    set(INTENTS, ts);
    c.mt_on_transfer(
        a(BUYER),
        vec![a(BUYER)],
        vec![USDC.into()],
        vec![U128(1_050_000)],
        message.to_string(),
    );
}

fn token_buy_spec() -> String {
    r#"{"amount_out":"1000000000000000000","receiver":"buyer.test","token_contract":"token.test","v":1}"#.into()
}

fn fund_token_buy(
    c: &mut Contract,
    id: &str,
    ts: u64,
    pay_amount: u128,
    reward: u128,
    deadline_ns: u64,
    token: &str,
) {
    let value = pay_amount.checked_add(reward).unwrap();
    let msg = json!({"op":"fund","order":{
        "id":id,"kind":"token_buy","spec_hash":sha256_hex(token_buy_spec().as_bytes()),
        "pay_amount":pay_amount.to_string(),"reward":reward.to_string(),
        "deadline_ns":deadline_ns.to_string()
    }});
    set(INTENTS, ts);
    c.mt_on_transfer(
        a(BUYER),
        vec![a(BUYER)],
        vec![token.into()],
        vec![U128(value)],
        msg.to_string(),
    );
}

fn claim_followup_token_buy(c: &mut Contract, id: &str, ts: u64) {
    fund_token_buy(c, id, ts, 1_000_000, 50_000, ts + HOUR, USDC);
    claim_as(c, FUL, id, ts + MIN);
    assert_eq!(status(c, id), Status::Claimed);
}

#[test]
fn token_buy_config_has_beta_cap_and_upgrade_set_kind_compatible() {
    let c = new_contract(None);
    let config = c.config.kinds.get("token_buy").unwrap();
    config.validate();
    let expected = json!({
        "enabled": true,
        "verifier_source": r#"{"Project":{"project_id":"nearfullfil.near/token-verifier","version_key":null}}"#,
        "secrets_ref": {"profile":"default","account_id":ESCROW},
        "access": "open",
        "needs_sent": false,
        "claim_timeout_ns": "1200000000000",
        "proof_timeout_ns": "1200000000000",
        "max_deadline_ns": "86400000000000",
        "quote_exclusive_ns": "120000000000",
        "open_max_active_claims": 1,
        "open_max_order_value": "5250000",
    });
    assert_eq!(serde_json::to_value(config).unwrap(), expected);
    let parsed: KindConfig = serde_json::from_value(expected).unwrap();
    parsed.validate();
    assert_eq!(parsed.open_max_order_value.0, 5_250_000);
}

#[test]
fn token_buy_funding_enforces_usdc_minimum_beta_cap_and_24_hour_deadline() {
    let mut c = new_contract(None);
    for (id, pay, deadline, token) in [
        ("FUL-TOKLOW", 999_999, T0 + HOUR, USDC),
        ("FUL-TOKOTHER", 1_000_000, T0 + HOUR, OTHER),
        ("FUL-TOKLATE", 1_000_000, T0 + 24 * HOUR + 1, USDC),
    ] {
        assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            fund_token_buy(&mut c, id, T0, pay, 50_000, deadline, token);
        }))
        .is_err());
        assert!(c.get_order(id.into()).is_none());
    }
    fund_token_buy(&mut c, "FUL-TOKMIN", T0, 1_000_000, 50_000, T0 + HOUR, USDC);
    fund_token_buy(
        &mut c,
        "FUL-TOKMAX",
        T0,
        5_000_000,
        250_000,
        T0 + 24 * HOUR,
        USDC,
    );
    assert_eq!(
        c.get_order("FUL-TOKMAX".into()).unwrap().pay_amount.0,
        5_000_000
    );
    assert_eq!(status(&c, "FUL-TOKMIN"), Status::Funded);
    assert_panics_with("value limit", || {
        fund_token_buy(
            &mut c,
            "FUL-TOKOVER",
            T0,
            5_010_000,
            250_500,
            T0 + HOUR,
            USDC,
        );
    });
    assert!(c.get_order("FUL-TOKOVER".into()).is_none());
}

#[test]
fn token_buy_beta_cap_order_claims_for_level_zero_and_leveled_accounts() {
    let mut c = new_contract(None);
    fund_token_buy(
        &mut c,
        "FUL-TOKCAP0",
        T0,
        5_000_000,
        250_000,
        T0 + HOUR,
        USDC,
    );
    fund_token_buy(
        &mut c,
        "FUL-TOKCAP1",
        T0,
        5_000_000,
        250_000,
        T0 + HOUR,
        USDC,
    );
    register_only(&mut c, FUL);
    register_only(&mut c, FUL2);
    c.stats.insert(
        a(FUL2),
        Stats {
            jobs_done: 5,
            ..Stats::default()
        },
    );
    assert!(level(&c.stat(&a(FUL2))) > 0);

    claim_as(&mut c, FUL, "FUL-TOKCAP0", T0 + MIN);
    claim_as(&mut c, FUL2, "FUL-TOKCAP1", T0 + MIN);
    assert_eq!(status(&c, "FUL-TOKCAP0"), Status::Claimed);
    assert_eq!(status(&c, "FUL-TOKCAP1"), Status::Claimed);
}

#[test]
fn token_buy_lowered_live_cap_rejects_leveled_account_at_claim() {
    let mut c = new_contract(None);
    register_only(&mut c, FUL2);
    c.stats.insert(
        a(FUL2),
        Stats {
            jobs_done: 5,
            ..Stats::default()
        },
    );
    let mut kind = c.get_kinds()["token_buy"].clone();
    kind.open_max_order_value = U128(6_000_000);
    testing_env!(builder(OWNER, T0)
        .attached_deposit(NearToken::from_yoctonear(1))
        .build());
    c.set_kind("token_buy".into(), kind.clone());
    fund_token_buy(
        &mut c,
        "FUL-TOKRAISE",
        T0 + MIN,
        5_010_000,
        250_500,
        T0 + HOUR,
        USDC,
    );

    kind.open_max_order_value = U128(5_000_000);
    testing_env!(builder(OWNER, T0 + 2 * MIN)
        .attached_deposit(NearToken::from_yoctonear(1))
        .build());
    c.set_kind("token_buy".into(), kind);
    assert_panics_with("value limit", || {
        claim_as(&mut c, FUL2, "FUL-TOKRAISE", T0 + 3 * MIN);
    });
    assert_eq!(status(&c, "FUL-TOKRAISE"), Status::Funded);
}

#[test]
fn token_buy_claim_is_open_one_per_account_and_needs_no_global_bond() {
    let mut c = new_contract(None);
    c.config.min_bond = U128(1_000_000);
    c.config.bond_per_job_bps = 1_000;
    fund_token_buy(&mut c, "FUL-TOK01", T0, 2_000_000, 100_000, T0 + HOUR, USDC);
    fund_token_buy(&mut c, "FUL-TOK02", T0, 2_000_000, 100_000, T0 + HOUR, USDC);
    open_kind(&mut c);
    fund(&mut c, "FUL-BANKTOK", T0);
    register_only(&mut c, FUL);
    claim_as(&mut c, FUL, "FUL-TOK01", T0 + MIN);
    assert_eq!(c.get_order("FUL-TOK01".into()).unwrap().bond_locked.0, 0);
    assert!(env::storage_has_key(&token_buy_claim_key(&a(FUL))));
    c.stats.insert(
        a(FUL),
        Stats {
            jobs_done: 5,
            active_claims: 1,
            ..Stats::default()
        },
    );
    assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        claim_as(&mut c, FUL, "FUL-TOK02", T0 + 2 * MIN);
    }))
    .is_err());
    assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        claim_as(&mut c, FUL, "FUL-BANKTOK", T0 + 2 * MIN);
    }))
    .is_err());
    auth(
        &mut c,
        FUL,
        T0 + 2 * MIN,
        json!({"op":"release_claim","order_id":"FUL-TOK01"}),
    );
    assert!(!env::storage_has_key(&token_buy_claim_key(&a(FUL))));
    claim_as(&mut c, FUL, "FUL-TOK02", T0 + 2 * MIN);
    assert_eq!(c.get_order("FUL-TOK02".into()).unwrap().bond_locked.0, 0);
}

#[test]
fn token_buy_short_deadline_ends_proof_and_claim_then_clears_claim_marker() {
    let mut c = new_contract(None);
    let id = "FUL-TOKSHORT";
    let deadline = T0 + 10 * MIN;
    fund_token_buy(&mut c, id, T0, 1_000_000, 50_000, deadline, USDC);
    register_only(&mut c, FUL);
    claim_as(&mut c, FUL, id, T0 + MIN);
    assert!(env::storage_has_key(&token_buy_claim_key(&a(FUL))));

    assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        auth(
            &mut c,
            FUL,
            deadline,
            json!({"op":"submit_proof","order_id":id,"proof_sha256":PROOF,"spec":token_buy_spec()}),
        );
    }))
    .is_err());
    assert_eq!(status(&c, id), Status::Claimed);
    set(FUL, deadline);
    c.timeout(id.into());
    assert!(c.get_order(id.into()).is_none());
    assert!(!env::storage_has_key(&token_buy_claim_key(&a(FUL))));
    assert!(mt_transfers()
        .iter()
        .any(|(to, token, amount)| to == BUYER && token == USDC && *amount == 1_050_000));

    let next = "FUL-TOKNEXT";
    fund_token_buy(
        &mut c,
        next,
        deadline + MIN,
        1_000_000,
        50_000,
        deadline + HOUR,
        USDC,
    );
    claim_as(&mut c, FUL, next, deadline + 2 * MIN);
    assert_eq!(status(&c, next), Status::Claimed);
}

#[test]
fn token_buy_default_claim_timeout_is_20_minutes_before_one_hour_deadline() {
    let mut c = new_contract(None);
    let id = "FUL-TOK20MIN";
    fund_token_buy(&mut c, id, T0, 1_000_000, 50_000, T0 + HOUR, USDC);
    register_only(&mut c, FUL);
    claim_as(&mut c, FUL, id, T0 + MIN);

    set(FUL, T0 + 20 * MIN);
    assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        c.timeout(id.into());
    }))
    .is_err());
    assert_eq!(status(&c, id), Status::Claimed);

    set(FUL, T0 + 21 * MIN);
    c.timeout(id.into());
    assert_eq!(status(&c, id), Status::Funded);
    assert!(!env::storage_has_key(&token_buy_claim_key(&a(FUL))));
    claim_followup_token_buy(&mut c, "FUL-TOK20NEXT", T0 + 22 * MIN);
}

#[test]
fn token_buy_verifier_input_and_result_pay_or_reject() {
    let mut c = new_contract(None);
    register_only(&mut c, FUL);
    fund_token_buy(&mut c, "FUL-TOK03", T0, 2_000_000, 100_000, T0 + HOUR, USDC);
    claim_as(&mut c, FUL, "FUL-TOK03", T0 + MIN);
    auth(
        &mut c,
        FUL,
        T0 + 2 * MIN,
        json!({"op":"submit_proof","order_id":"FUL-TOK03","proof_sha256":PROOF,"spec":token_buy_spec()}),
    );
    let request = calls()
        .into_iter()
        .find(|(to, method, _, _)| to == OUTLAYER && method == "request_execution")
        .unwrap()
        .2;
    let input: Value = serde_json::from_str(request["input_data"].as_str().unwrap()).unwrap();
    assert_eq!(input["buyer"], BUYER);
    assert_eq!(input["fulfiller"], FUL);
    assert_eq!(input["kind"], "token_buy");
    assert_eq!(input["claimed_at_ns"], (T0 + MIN).to_string());
    assert_eq!(
        request["source"],
        json!({"Project":{"project_id":"nearfullfil.near/token-verifier","version_key":null}})
    );
    let output = json!({"ok":true,"order_id":"FUL-TOK03","proof_sha256":PROOF,
        "spec_hash":sha256_hex(token_buy_spec().as_bytes()),"nullifier":TXREF,
        "completed_at_ns":(T0 + 2 * MIN).to_string()});
    callback(&mut c, "FUL-TOK03", 1, output, T0 + 3 * MIN);
    assert_eq!(status(&c, "FUL-TOK03"), Status::Paid);
    assert!(!env::storage_has_key(&token_buy_claim_key(&a(FUL))));
    assert!(mt_transfers()
        .iter()
        .any(|(to, token, amount)| { to == FUL && token == USDC && *amount == 2_100_000 }));

    fund_token_buy(
        &mut c,
        "FUL-TOK04",
        T0 + 4 * MIN,
        2_000_000,
        100_000,
        T0 + HOUR,
        USDC,
    );
    claim_as(&mut c, FUL, "FUL-TOK04", T0 + 5 * MIN);
    auth(
        &mut c,
        FUL,
        T0 + 6 * MIN,
        json!({"op":"submit_proof","order_id":"FUL-TOK04","proof_sha256":PROOF,"spec":token_buy_spec()}),
    );
    let rejected = json!({"ok":false,"reason":"rpc_disagreement","order_id":"FUL-TOK04",
        "proof_sha256":PROOF,"spec_hash":sha256_hex(token_buy_spec().as_bytes()),
        "nullifier":"","completed_at_ns":"0"});
    callback(&mut c, "FUL-TOK04", 1, rejected, T0 + 7 * MIN);
    assert_eq!(status(&c, "FUL-TOK04"), Status::ProofRejected);
    assert!(c.get_order("FUL-TOK04".into()).unwrap().paid_at.is_none());
}

#[test]
fn token_buy_rejected_proof_keeps_claim_until_release() {
    let mut c = new_contract(None);
    register_only(&mut c, FUL);
    fund_token_buy(
        &mut c,
        "FUL-TOKREJECT",
        T0,
        1_000_000,
        50_000,
        T0 + HOUR,
        USDC,
    );
    claim_as(&mut c, FUL, "FUL-TOKREJECT", T0 + MIN);
    auth(
        &mut c,
        FUL,
        T0 + 2 * MIN,
        json!({"op":"submit_proof",
        "order_id":"FUL-TOKREJECT","proof_sha256":PROOF,"spec":token_buy_spec()}),
    );
    callback(
        &mut c,
        "FUL-TOKREJECT",
        1,
        json!({"ok":false,"reason":"bad proof"}),
        T0 + 3 * MIN,
    );
    assert_eq!(status(&c, "FUL-TOKREJECT"), Status::ProofRejected);
    assert!(env::storage_has_key(&token_buy_claim_key(&a(FUL))));
    fund_token_buy(
        &mut c,
        "FUL-TOKWAIT",
        T0 + 3 * MIN,
        1_000_000,
        50_000,
        T0 + HOUR,
        USDC,
    );
    assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        claim_as(&mut c, FUL, "FUL-TOKWAIT", T0 + 4 * MIN);
    }))
    .is_err());
    auth(
        &mut c,
        FUL,
        T0 + 4 * MIN,
        json!({"op":"release_claim","order_id":"FUL-TOKREJECT"}),
    );
    assert!(!env::storage_has_key(&token_buy_claim_key(&a(FUL))));
    claim_as(&mut c, FUL, "FUL-TOKWAIT", T0 + 4 * MIN);
}

#[test]
fn token_buy_claim_timeout_reset_clears_flag() {
    let mut c = new_contract(None);
    c.config
        .kinds
        .get_mut("token_buy")
        .unwrap()
        .claim_timeout_ns = U64(MIN);
    register_only(&mut c, FUL);
    fund_token_buy(
        &mut c,
        "FUL-TOKTIME",
        T0,
        1_000_000,
        50_000,
        T0 + 2 * HOUR,
        USDC,
    );
    claim_as(&mut c, FUL, "FUL-TOKTIME", T0);
    set(FUL, T0 + MIN);
    c.timeout("FUL-TOKTIME".into());
    assert_eq!(status(&c, "FUL-TOKTIME"), Status::Funded);
    assert!(!env::storage_has_key(&token_buy_claim_key(&a(FUL))));
    claim_followup_token_buy(&mut c, "FUL-TOKAFTERTIME", T0 + MIN);
}

#[test]
fn token_buy_verification_timeout_then_review_resolution_clears_flag() {
    let mut c = new_contract(None);
    c.config
        .kinds
        .get_mut("token_buy")
        .unwrap()
        .proof_timeout_ns = U64(MIN);
    register_only(&mut c, FUL);
    fund_token_buy(
        &mut c,
        "FUL-TOKREVIEW",
        T0,
        1_000_000,
        50_000,
        T0 + HOUR,
        USDC,
    );
    claim_as(&mut c, FUL, "FUL-TOKREVIEW", T0 + MIN);
    auth(
        &mut c,
        FUL,
        T0 + 2 * MIN,
        json!({"op":"submit_proof",
        "order_id":"FUL-TOKREVIEW","proof_sha256":PROOF,"spec":token_buy_spec()}),
    );
    set(FUL, T0 + HOUR);
    c.timeout("FUL-TOKREVIEW".into());
    assert_eq!(status(&c, "FUL-TOKREVIEW"), Status::UnderReview);
    assert!(env::storage_has_key(&token_buy_claim_key(&a(FUL))));
    set(ARBITER, T0 + HOUR + MIN);
    c.resolve_dispute("FUL-TOKREVIEW".into(), Verdict::Buyer, None);
    assert_eq!(status(&c, "FUL-TOKREVIEW"), Status::Resolved);
    assert!(!env::storage_has_key(&token_buy_claim_key(&a(FUL))));
    claim_followup_token_buy(&mut c, "FUL-TOKR2", T0 + HOUR + 2 * MIN);
}

#[test]
fn token_buy_finalize_after_challenge_window_clears_flag() {
    let mut c = new_contract(None);
    c.config.challenge_window_ns = U64(MIN);
    register_only(&mut c, FUL);
    fund_token_buy(
        &mut c,
        "FUL-TOKVERIFY",
        T0,
        1_000_000,
        50_000,
        T0 + HOUR,
        USDC,
    );
    claim_as(&mut c, FUL, "FUL-TOKVERIFY", T0 + MIN);
    auth(
        &mut c,
        FUL,
        T0 + 2 * MIN,
        json!({"op":"submit_proof",
        "order_id":"FUL-TOKVERIFY","proof_sha256":PROOF,"spec":token_buy_spec()}),
    );
    let output = json!({"ok":true,"order_id":"FUL-TOKVERIFY","proof_sha256":PROOF,
        "spec_hash":sha256_hex(token_buy_spec().as_bytes()),"nullifier":TXREF,
        "completed_at_ns":(T0 + 2 * MIN).to_string()});
    callback(&mut c, "FUL-TOKVERIFY", 1, output, T0 + 3 * MIN);
    assert_eq!(status(&c, "FUL-TOKVERIFY"), Status::Verified);
    assert!(env::storage_has_key(&token_buy_claim_key(&a(FUL))));
    set(FUL, T0 + 4 * MIN);
    c.finalize("FUL-TOKVERIFY".into());
    assert_eq!(status(&c, "FUL-TOKVERIFY"), Status::Paid);
    assert!(!env::storage_has_key(&token_buy_claim_key(&a(FUL))));
    claim_followup_token_buy(&mut c, "FUL-TOKF2", T0 + 5 * MIN);
}

#[test]
fn in_person_set_kind_json_matches_seeded_config() {
    let expected = json!({
        "enabled": true,
        "verifier_source": "{}",
        "secrets_ref": null,
        "access": "open",
        "needs_sent": false,
        "claim_timeout_ns": "86400000000000",
        "proof_timeout_ns": "86400000000000",
        "max_deadline_ns": "86400000000000",
        "quote_exclusive_ns": "120000000000",
        "open_max_active_claims": 1,
        "open_max_order_value": "20000000"
    });
    let c = new_contract(None);
    let seeded = c.config.kinds.get("in_person").unwrap();
    seeded.validate();
    assert_eq!(serde_json::to_value(seeded).unwrap(), expected);
    let call = json!({"kind": "in_person", "config": expected});
    let parsed: KindConfig = serde_json::from_value(call["config"].clone()).unwrap();
    parsed.validate();
    assert_eq!(serde_json::to_value(parsed).unwrap(), call["config"]);
}

#[test]
fn in_person_wrong_secret_counts_and_valid_secret_pays() {
    let secret = [7_u8; 32];
    let mut c = new_contract(None);
    fund_in_person(&mut c, "FUL-PERS01", T0, &secret);
    register_only(&mut c, FUL);
    auth(
        &mut c,
        FUL,
        T0 + MIN,
        json!({"op":"claim","order_id":"FUL-PERS01"}),
    );

    set(FUL, T0 + 2 * MIN);
    assert!(!c.confirm_delivery("FUL-PERS01".into(), "00".repeat(32)));
    assert_eq!(
        c.get_order("FUL-PERS01".into())
            .unwrap()
            .total_proof_attempts,
        1
    );
    assert_eq!(status(&c, "FUL-PERS01"), Status::Claimed);

    assert!(c.confirm_delivery("FUL-PERS01".into(), "07".repeat(32)));
    assert_eq!(status(&c, "FUL-PERS01"), Status::Paid);
    assert!(mt_transfers()
        .iter()
        .any(|(to, token, amount)| to == FUL && token == USDC && *amount == 1_050_000));
}

#[test]
fn in_person_deadline_blocks_reclaim_and_confirmation_then_refunds() {
    let secret = [7_u8; 32];
    let code = "07".repeat(32);
    let id = "FUL-PERS09";
    let deadline = T0 + 24 * HOUR;
    let mut c = new_contract(None);
    fund_in_person(&mut c, id, T0, &secret);
    register_only(&mut c, FUL);
    register_only(&mut c, FUL2);
    auth(&mut c, FUL, T0 + MIN, json!({"op":"claim","order_id":id}));

    set(FUL, T0 + 2 * MIN);
    assert!(!c.confirm_delivery(id.into(), "00".repeat(32)));
    assert_eq!(c.get_order(id.into()).unwrap().total_proof_attempts, 1);

    assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        auth(&mut c, FUL2, deadline, json!({"op":"claim","order_id":id}))
    }))
    .is_err());
    for signer in [FUL, FUL2] {
        set(signer, deadline);
        assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            c.confirm_delivery(id.into(), code.clone())
        }))
        .is_err());
    }
    assert_eq!(status(&c, id), Status::Claimed);

    // Releasing a stale claim cannot reopen a payable order.
    auth(
        &mut c,
        FUL,
        deadline,
        json!({"op":"release_claim","order_id":id}),
    );
    assert_eq!(status(&c, id), Status::Funded);
    assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        auth(&mut c, FUL2, deadline, json!({"op":"claim","order_id":id}))
    }))
    .is_err());
    set(BUYER, deadline);
    c.expire(id.into());
    assert!(c.get_order(id.into()).is_none());
    assert!(mt_transfers()
        .iter()
        .any(|(to, token, amount)| to == BUYER && token == USDC && *amount == 1_050_000));
}

#[test]
fn in_person_short_and_uppercase_codes_consume_budget() {
    let secret = [7_u8; 32];
    let mut c = new_contract(None);
    fund_in_person(&mut c, "FUL-PERS02", T0, &secret);
    register_only(&mut c, FUL);
    auth(
        &mut c,
        FUL,
        T0 + MIN,
        json!({"op":"claim","order_id":"FUL-PERS02"}),
    );
    for code in ["07", &"07".repeat(31), &"AB".repeat(32)] {
        assert!(matches!(
            auth(
                &mut c,
                FUL,
                T0 + 2 * MIN,
                json!({"op":"confirm_delivery","order_id":"FUL-PERS02","secret_hex":code})
            ),
            PromiseOrValue::Value(())
        ));
        assert_eq!(status(&c, "FUL-PERS02"), Status::Claimed);
    }
    assert_eq!(
        c.get_order("FUL-PERS02".into())
            .unwrap()
            .total_proof_attempts,
        3
    );
}

#[test]
fn in_person_wrong_caller_cannot_consume_budget() {
    let secret = [7_u8; 32];
    let mut c = new_contract(None);
    fund_in_person(&mut c, "FUL-PERS03", T0, &secret);
    register_only(&mut c, FUL);
    auth(
        &mut c,
        FUL,
        T0 + MIN,
        json!({"op":"claim","order_id":"FUL-PERS03"}),
    );
    set(FUL2, T0 + 2 * MIN);
    assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(
        || c.confirm_delivery("FUL-PERS03".into(), "07".repeat(32))
    ))
    .is_err());
    assert_eq!(
        c.get_order("FUL-PERS03".into())
            .unwrap()
            .total_proof_attempts,
        0
    );
}

#[test]
fn in_person_replay_does_not_pay_and_counts() {
    let secret = [7_u8; 32];
    let mut c = new_contract(None);
    fund_in_person(&mut c, "FUL-PERS04", T0, &secret);
    register_only(&mut c, FUL);
    auth(
        &mut c,
        FUL,
        T0 + MIN,
        json!({"op":"claim","order_id":"FUL-PERS04"}),
    );
    let nullifier = sha256_hex(b"in_person:FUL-PERS04");
    c.nullifiers.insert(nullifier, "FUL-OLD01".into());
    set(FUL, T0 + 2 * MIN);
    assert!(!c.confirm_delivery("FUL-PERS04".into(), "07".repeat(32)));
    assert_eq!(status(&c, "FUL-PERS04"), Status::Claimed);
    assert_eq!(
        c.get_order("FUL-PERS04".into())
            .unwrap()
            .total_proof_attempts,
        1
    );
}

#[test]
fn in_person_budget_exhaustion_still_refunds_after_deadline() {
    let secret = [7_u8; 32];
    let mut c = new_contract(None);
    fund_in_person(&mut c, "FUL-PERS05", T0, &secret);
    register_only(&mut c, FUL);
    auth(
        &mut c,
        FUL,
        T0 + MIN,
        json!({"op":"claim","order_id":"FUL-PERS05"}),
    );
    set(FUL, T0 + 2 * MIN);
    for _ in 0..MAX_TOTAL_PROOF_ATTEMPTS {
        assert!(!c.confirm_delivery("FUL-PERS05".into(), "00".repeat(32)));
    }
    assert_eq!(
        c.get_order("FUL-PERS05".into())
            .unwrap()
            .total_proof_attempts,
        6
    );
    assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(
        || c.confirm_delivery("FUL-PERS05".into(), "07".repeat(32))
    ))
    .is_err());
    assert_eq!(status(&c, "FUL-PERS05"), Status::Claimed);
    set(FUL, T0 + 24 * HOUR);
    assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(
        || c.confirm_delivery("FUL-PERS05".into(), "07".repeat(32))
    ))
    .is_err());
    c.expire("FUL-PERS05".into());
    assert!(c.get_order("FUL-PERS05".into()).is_none());
    assert!(mt_transfers()
        .iter()
        .any(|(to, token, amount)| to == BUYER && token == USDC && *amount == 1_050_000));
}

#[test]
fn in_person_sent_is_rejected_and_order_can_refund() {
    let secret = [7_u8; 32];
    let mut c = new_contract(None);
    fund_in_person(&mut c, "FUL-PERS07", T0, &secret);
    register_only(&mut c, FUL);
    auth(
        &mut c,
        FUL,
        T0 + MIN,
        json!({"op":"claim","order_id":"FUL-PERS07"}),
    );

    set(INTENTS, T0 + 2 * MIN);
    assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        c.on_auth(
            a(FUL),
            json!({"op":"sent","order_id":"FUL-PERS07"}).to_string(),
        )
    }))
    .is_err());
    assert_eq!(status(&c, "FUL-PERS07"), Status::Claimed);

    set(FUL, T0 + 24 * HOUR);
    c.expire("FUL-PERS07".into());
    assert!(c.get_order("FUL-PERS07".into()).is_none());
    assert!(mt_transfers()
        .iter()
        .any(|(to, token, amount)| to == BUYER && token == USDC && *amount == 1_050_000));

    fund(&mut c, "FUL-BANK02", T0 + 24 * HOUR + MIN);
    register(&mut c, FUL2);
    auth(
        &mut c,
        FUL2,
        T0 + 24 * HOUR + 2 * MIN,
        json!({"op":"claim","order_id":"FUL-BANK02"}),
    );
    auth(
        &mut c,
        FUL2,
        T0 + 24 * HOUR + 3 * MIN,
        json!({"op":"sent","order_id":"FUL-BANK02"}),
    );
    assert_eq!(status(&c, "FUL-BANK02"), Status::Sent);
}

#[test]
fn in_person_rejects_other_accepted_token() {
    let secret = [7_u8; 32];
    let spec = in_person_spec(&secret);
    let message = json!({"op":"fund","spec":spec,"order":{
        "id":"FUL-PERS08","kind":"in_person","spec_hash":sha256_hex(spec.as_bytes()),
        "pay_amount":"1000000","reward":"50000",
        "deadline_ns":(T0 + 24 * HOUR).to_string()
    }});
    let mut c = new_contract(None);
    set(INTENTS, T0);
    assert!(
        std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| c.mt_on_transfer(
            a(BUYER),
            vec![a(BUYER)],
            vec![OTHER.into()],
            vec![U128(1_050_000)],
            message.to_string(),
        )))
        .is_err()
    );
    assert!(c.get_order("FUL-PERS08".into()).is_none());
}

#[test]
fn in_person_rejects_other_kind_and_malformed_spec() {
    let mut c = new_contract(None);
    fund(&mut c, "FUL-BANK01", T0);
    set(FUL, T0 + MIN);
    assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(
        || c.confirm_delivery("FUL-BANK01".into(), "07".repeat(32))
    ))
    .is_err());
    assert_eq!(status(&c, "FUL-BANK01"), Status::Funded);

    let secret = [7_u8; 32];
    let malformed = format!(
        "{{\"area\":\"District 1\",\"delivery_hash\":\"{}\",\"item_desc\":\"Synthetic item\",\"price\":\"1000000\"}}",
        sha256_hex(&secret)
    );
    let msg = json!({"op":"fund","spec":malformed,"order":{
        "id":"FUL-PERS06","kind":"in_person","spec_hash":sha256_hex(malformed.as_bytes()),
        "pay_amount":"1000000","reward":"50000",
        "deadline_ns":(T0 + 24 * HOUR).to_string()
    }});
    set(INTENTS, T0);
    assert!(
        std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| c.mt_on_transfer(
            a(BUYER),
            vec![a(BUYER)],
            vec![USDC.into()],
            vec![U128(1_050_000)],
            msg.to_string()
        )))
        .is_err()
    );
    assert!(c.get_order("FUL-PERS06".into()).is_none());
}

fn auth(c: &mut Contract, signer: &str, ts: u64, msg: Value) -> PromiseOrValue<()> {
    set(INTENTS, ts);
    c.on_auth(a(signer), msg.to_string())
}

fn register_only(c: &mut Contract, who: &str) {
    auth(
        c,
        who,
        T0,
        json!({"op":"register_fulfiller","bank_bin":"970436","account_last4":"1234"}),
    );
}

fn approve(c: &mut Contract, who: &str, yes: bool) {
    testing_env!(builder(OWNER, T0)
        .attached_deposit(NearToken::from_yoctonear(1))
        .build());
    c.approve_fulfiller(a(who), yes);
}

/// register + owner approval
fn register(c: &mut Contract, who: &str) {
    register_only(c, who);
    approve(c, who, true);
}

fn status(c: &Contract, id: &str) -> Status {
    c.get_order(id.into()).unwrap().status
}

/// (receiver, method, args json, deposit yocto)
fn calls() -> Vec<(String, String, Value, u128)> {
    get_created_receipts()
        .into_iter()
        .flat_map(|r| {
            let to = r.receiver_id.to_string();
            r.actions.into_iter().filter_map(move |act| match act {
                MockAction::FunctionCallWeight {
                    method_name,
                    args,
                    attached_deposit,
                    ..
                } => Some((
                    to.clone(),
                    String::from_utf8(method_name).unwrap(),
                    serde_json::from_slice(&args).unwrap_or(Value::Null),
                    attached_deposit.as_yoctonear(),
                )),
                _ => None,
            })
        })
        .collect()
}

fn mt_transfers() -> Vec<(String, String, u128)> {
    calls()
        .into_iter()
        .filter(|(to, m, _, d)| to == INTENTS && m == "mt_transfer" && *d == 1)
        .map(|(_, _, args, _)| {
            (
                args["receiver_id"].as_str().unwrap().to_string(),
                args["token_id"].as_str().unwrap().to_string(),
                args["amount"].as_str().unwrap().parse().unwrap(),
            )
        })
        .collect()
}

fn good_output(id: &str, ts: u64) -> Value {
    json!({"ok":true,"order_id":id,"proof_sha256":PROOF,"spec_hash":sha256_hex(spec().as_bytes()),"nullifier":TXREF,"completed_at_ns":ts})
}

#[test]
fn migrate_c0740f2_order_preserves_state() {
    set(OWNER, T0);
    let cfg = default_config();
    let old_config = legacy::LegacyConfig {
        owner: cfg.owner.clone(),
        intents_contract: cfg.intents_contract.clone(),
        outlayer_contract: cfg.outlayer_contract.clone(),
        verifier_source: cfg.kinds["bank_transfer"].verifier_source.clone(),
        verifier_resource_limits: cfg.verifier_resource_limits.clone(),
        secrets_profile: Some("default".into()),
        proof_blob_base_url: cfg.proof_blob_base_url.clone(),
        outlayer_deposit: cfg.outlayer_deposit,
        outlayer_gas_tgas: cfg.outlayer_gas_tgas,
        arbiter: cfg.arbiter.clone(),
        relayer: cfg.relayer.clone(),
        accepted_tokens: cfg.accepted_tokens.clone(),
        bond_token: cfg.bond_token.clone(),
        allowed_dkim_domains: vec!["vpb.com.vn".into()],
        min_bond: cfg.min_bond,
        bond_per_job_bps: cfg.bond_per_job_bps,
        min_order_amount: cfg.min_order_amount,
        bond_hold_ns: cfg.bond_hold_ns,
        challenge_window_ns: cfg.challenge_window_ns,
        claim_timeout_ns: U64(15 * MIN),
        proof_timeout_ns: U64(2 * HOUR),
        rating_window_ns: cfg.rating_window_ns,
        max_email_skew_ns: cfg.max_email_skew_ns,
        rating_unit: cfg.rating_unit,
        max_orders: cfg.max_orders,
        max_profiles: cfg.max_profiles,
        paused: false,
        require_fulfiller_approval: true,
    };
    let mut old_orders: IterableMap<String, legacy::LegacyOrder> = IterableMap::new(Key::Orders);
    old_orders.insert(
        "FUL-0001".into(),
        legacy::LegacyOrder {
            id: "FUL-0001".into(),
            buyer: a(BUYER),
            token: USDC.into(),
            pay_amount: 2_000_000,
            reward: 100_000,
            amount_vnd: 50_000,
            merchant_hash: MH.into(),
            deadline_ns: T0 + 24 * HOUR,
            created_at: T0,
            fulfiller: Some(a(FUL)),
            bond_locked: 1_000_000,
            claimed_at: Some(T0),
            sent_at: Some(T0),
            verify_started_at: Some(T0),
            verified_at: Some(T0),
            paid_at: Some(T0),
            ended_at: None,
            proof_sha256: Some(PROOF.into()),
            nullifier: Some(TXREF.into()),
            status: Status::Paid,
            attempts: 1,
            last_reject_reason: None,
            buyer_rating: Some(5),
            fulfiller_rating: Some(4),
            dispute_reason: None,
            disputed_by: None,
            verdict: None,
            verdict_note_hash: None,
            settled: true,
        },
    );
    for n in 2..=21 {
        let id = format!("FUL-{n:04}");
        let mut extra: legacy::LegacyOrder =
            borsh::from_slice(&borsh::to_vec(old_orders.get("FUL-0001").unwrap()).unwrap())
                .unwrap();
        extra.id = id.clone();
        extra.status = Status::Funded;
        extra.fulfiller = None;
        extra.buyer_rating = None;
        extra.fulfiller_rating = None;
        extra.settled = false;
        old_orders.insert(id, extra);
    }
    old_orders.flush();
    let mut old = legacy::LegacyState {
        config: old_config,
        orders: borsh::from_slice(&borsh::to_vec(&old_orders).unwrap()).unwrap(),
        used_ids: LookupSet::new(Key::UsedIds),
        by_account: LookupMap::new(Key::ByAccount),
        profiles: LookupMap::new(Key::Profiles),
        profiles_count: 1,
        stats: LookupMap::new(Key::Stats),
        bonds: LookupMap::new(Key::Bonds),
        nullifiers: LookupMap::new(Key::Nullifiers),
        owed: LookupMap::new(Key::Owed),
        approved: LookupSet::new(Key::Approved),
        liabilities: LookupMap::new(Key::Liabilities),
    };
    old.profiles.insert(
        a(FUL),
        Profile {
            bank_bin: "970436".into(),
            account_last4: "1234".into(),
            registered_at: U64(T0),
        },
    );
    old.stats.insert(
        a(FUL),
        Stats {
            jobs_done: 1,
            star_sum: 5,
            star_count: 1,
            ..Stats::default()
        },
    );
    old.bonds.insert(
        a(FUL),
        Bond {
            available: U128(2_000_000),
            locked: U128(1_000_000),
        },
    );
    old.nullifiers.insert(TXREF.into(), "FUL-0001".into());
    old.owed.insert((a(FUL), USDC.into()), 500_000);
    old.liabilities.insert(USDC.into(), 3_500_000);
    old.used_ids.insert("FUL-0001".into());
    set_applied_weight("FUL-0001", SIDE_BUYER, 4);
    env::state_write(&old);
    drop(old);
    drop(old_orders);
    let mut migrated = Contract::migrate();
    assert_eq!(migrated.migration_pending.len(), 1);
    assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(
        || migrated.get_order("FUL-0001".into())
    ))
    .is_err());
    assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(Contract::migrate)).is_err());
    testing_env!(builder(OWNER, T0)
        .attached_deposit(NearToken::from_yoctonear(1))
        .build());
    assert_eq!(migrated.migrate_batch(20), 0);
    let order = migrated.get_order("FUL-0001".into()).unwrap();
    assert_eq!(order.kind, "bank_transfer");
    assert_eq!(
        order.spec_hash,
        "934777bfbd571fc8646e933c633954a1c43501516ead98d6847b78de31a89993"
    );
    assert_eq!(order.verify_seq, 0);
    assert_eq!(order.total_proof_attempts, 0);
    assert_eq!(migrated.get_profile(a(FUL)).stats.jobs_done, 1);
    assert_eq!(migrated.get_profile(a(FUL)).bond.locked.0, 1_000_000);
    assert_eq!(migrated.get_rating_weights("FUL-0001".into()), (4, 0));
    assert_eq!(
        migrated.is_nullifier_used(TXREF.into()),
        Some("FUL-0001".into())
    );
    assert_eq!(migrated.get_owed(a(FUL), USDC.into()).0, 500_000);
    assert_eq!(migrated.get_liabilities(USDC.into()).0, 3_500_000);
    assert_eq!(migrated.get_counts(), (21, 1));

    // A nullifier stored before migration remains an active replay guard for
    // generic verifier output on a later order.
    fund(&mut migrated, "FUL-9999", T0);
    approve(&mut migrated, FUL, true);
    claim_as(&mut migrated, FUL, "FUL-9999", T0 + MIN);
    auth(
        &mut migrated,
        FUL,
        T0 + 2 * MIN,
        json!({"op":"submit_proof","order_id":"FUL-9999","proof_sha256":PROOF,"spec":spec()}),
    );
    callback(
        &mut migrated,
        "FUL-9999",
        1,
        good_output("FUL-9999", T0 + 2 * MIN),
        T0 + 3 * MIN,
    );
    let replay = migrated.get_order("FUL-9999".into()).unwrap();
    assert_eq!(replay.status, Status::ProofRejected);
    assert_eq!(
        replay.last_reject_reason.as_deref(),
        Some("nullifier already used")
    );
}

fn open_kind(c: &mut Contract) {
    c.config.kinds.get_mut("bank_transfer").unwrap().access = Access::Named("open".into());
}

fn claim_as(c: &mut Contract, who: &str, id: &str, ts: u64) {
    auth(c, who, ts, json!({"op":"claim","order_id":id}));
}

#[test]
fn kind_access_modes_accept_and_reject() {
    let mut c = new_contract(None);
    fund(&mut c, "FUL-0001", T0);
    register_only(&mut c, FUL);
    assert!(
        std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| claim_as(
            &mut c, FUL, "FUL-0001", T0
        )))
        .is_err()
    );
    approve(&mut c, FUL, true);
    claim_as(&mut c, FUL, "FUL-0001", T0);
    assert_eq!(status(&c, "FUL-0001"), Status::Claimed);

    let mut c = new_contract(None);
    c.config.kinds.get_mut("bank_transfer").unwrap().access = Access::Allowlist {
        allowlist: vec![a(FUL)],
    };
    fund(&mut c, "FUL-0002", T0);
    register_only(&mut c, FUL);
    register_only(&mut c, FUL2);
    assert!(
        std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| claim_as(
            &mut c, FUL2, "FUL-0002", T0
        )))
        .is_err()
    );
    claim_as(&mut c, FUL, "FUL-0002", T0);

    let mut c = new_contract(None);
    c.config.kinds.get_mut("bank_transfer").unwrap().access = Access::MinBond {
        min_bond: U128(1_000_000),
    };
    fund(&mut c, "FUL-0003", T0);
    register_only(&mut c, FUL);
    assert!(
        std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| claim_as(
            &mut c, FUL, "FUL-0003", T0
        )))
        .is_err()
    );
    set(INTENTS, T0);
    c.mt_on_transfer(
        a(FUL),
        vec![a(FUL)],
        vec![USDC.into()],
        vec![U128(1_000_000)],
        json!({"op":"bond"}).to_string(),
    );
    claim_as(&mut c, FUL, "FUL-0003", T0);

    let mut c = new_contract(None);
    open_kind(&mut c);
    fund(&mut c, "FUL-0004", T0);
    register_only(&mut c, FUL);
    claim_as(&mut c, FUL, "FUL-0004", T0);
}

#[test]
fn quote_exclusive_window_and_releaser_clears_quote() {
    let mut c = new_contract(None);
    open_kind(&mut c);
    register_only(&mut c, FUL);
    let msg = json!({"op":"fund","order":{"id":"FUL-0001","kind":"bank_transfer","spec_hash":sha256_hex(spec().as_bytes()),
        "pay_amount":"2000000","reward":"100000","deadline_ns":(T0 + 24 * HOUR).to_string(),"quoted_by":FUL}});
    set(INTENTS, T0);
    c.mt_on_transfer(
        a(BUYER),
        vec![a(BUYER)],
        vec![USDC.into()],
        vec![U128(2_100_000)],
        msg.to_string(),
    );
    register_only(&mut c, FUL2);
    assert!(
        std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| claim_as(
            &mut c,
            FUL2,
            "FUL-0001",
            T0 + MIN
        )))
        .is_err()
    );
    claim_as(&mut c, FUL, "FUL-0001", T0 + MIN);
    auth(
        &mut c,
        FUL,
        T0 + MIN,
        json!({"op":"release_claim","order_id":"FUL-0001"}),
    );
    assert!(c.get_order("FUL-0001".into()).unwrap().quoted_by.is_none());
    claim_as(&mut c, FUL2, "FUL-0001", T0 + MIN);

    let mut c = new_contract(None);
    open_kind(&mut c);
    register_only(&mut c, FUL);
    set(INTENTS, T0);
    c.mt_on_transfer(a(BUYER), vec![a(BUYER)], vec![USDC.into()], vec![U128(2_100_000)], json!({"op":"fund","order":{"id":"FUL-0002","kind":"bank_transfer","spec_hash":sha256_hex(spec().as_bytes()),
        "pay_amount":"2000000","reward":"100000","deadline_ns":(T0 + 24 * HOUR).to_string(),"quoted_by":FUL}}).to_string());
    register_only(&mut c, FUL2);
    claim_as(&mut c, FUL2, "FUL-0002", T0 + 2 * MIN);
}

#[test]
fn open_level_zero_limits_and_level_one_exemption() {
    let mut c = new_contract(None);
    open_kind(&mut c);
    fund(&mut c, "FUL-0001", T0);
    fund(&mut c, "FUL-0002", T0);
    register_only(&mut c, FUL);
    claim_as(&mut c, FUL, "FUL-0001", T0);
    assert!(
        std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| claim_as(
            &mut c, FUL, "FUL-0002", T0
        )))
        .is_err()
    );
    c.stats.insert(
        a(FUL),
        Stats {
            jobs_done: 5,
            active_claims: 1,
            ..Stats::default()
        },
    );
    claim_as(&mut c, FUL, "FUL-0002", T0);

    let mut c = new_contract(None);
    open_kind(&mut c);
    c.config
        .kinds
        .get_mut("bank_transfer")
        .unwrap()
        .open_max_order_value = U128(2_000_000);
    fund(&mut c, "FUL-0003", T0);
    register_only(&mut c, FUL);
    assert!(
        std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| claim_as(
            &mut c, FUL, "FUL-0003", T0
        )))
        .is_err()
    );
    c.stats.insert(
        a(FUL),
        Stats {
            jobs_done: 5,
            ..Stats::default()
        },
    );
    claim_as(&mut c, FUL, "FUL-0003", T0);
}

#[test]
fn release_claim_from_allowed_states_and_rejects_others() {
    let mut c = new_contract(None);
    register(&mut c, FUL);
    for (id, state) in [
        ("FUL-0001", Status::Claimed),
        ("FUL-0002", Status::Sent),
        ("FUL-0003", Status::ProofRejected),
    ] {
        fund(&mut c, id, T0);
        claim_as(&mut c, FUL, id, T0);
        if state == Status::Sent {
            auth(&mut c, FUL, T0, json!({"op":"sent","order_id":id}));
        } else if state == Status::ProofRejected {
            c.orders.get_mut(id).unwrap().status = Status::ProofRejected;
        }
        assert!(
            std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| auth(
                &mut c,
                FUL2,
                T0,
                json!({"op":"release_claim","order_id":id})
            )))
            .is_err()
        );
        auth(&mut c, FUL, T0, json!({"op":"release_claim","order_id":id}));
        assert_eq!(status(&c, id), Status::Funded);
        assert_eq!(c.get_profile(a(FUL)).stats.active_claims, 0);
        assert!(get_logs()
            .iter()
            .any(|line| line.contains("claim_released")));
        if state == Status::ProofRejected {
            register(&mut c, FUL2);
            claim_as(&mut c, FUL2, id, T0);
            assert_eq!(c.get_order(id.into()).unwrap().attempts, 0);
            auth(
                &mut c,
                FUL2,
                T0,
                json!({"op":"release_claim","order_id":id}),
            );
        }
    }
    fund(&mut c, "FUL-0004", T0);
    assert!(
        std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| auth(
            &mut c,
            FUL,
            T0,
            json!({"op":"release_claim","order_id":"FUL-0004"})
        )))
        .is_err()
    );
    claim_as(&mut c, FUL, "FUL-0004", T0);
    c.orders.get_mut("FUL-0004").unwrap().status = Status::Verifying;
    assert!(
        std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| auth(
            &mut c,
            FUL,
            T0,
            json!({"op":"release_claim","order_id":"FUL-0004"})
        )))
        .is_err()
    );
}

#[test]
#[should_panic(expected = "spec hash mismatch")]
fn proof_spec_hash_mismatch() {
    let mut c = new_contract(None);
    fund(&mut c, "FUL-0001", T0);
    register(&mut c, FUL);
    claim_as(&mut c, FUL, "FUL-0001", T0);
    auth(
        &mut c,
        FUL,
        T0,
        json!({"op":"submit_proof","order_id":"FUL-0001","proof_sha256":PROOF,"spec":"{}"}),
    );
}

#[test]
fn fund_checks_kind_hash_and_deadline() {
    let mut c = new_contract(None);
    let valid = |id: &str, kind: &str, hash: &str, deadline: u64| {
        json!({"op":"fund","order":{
        "id":id,"kind":kind,"spec_hash":hash,"pay_amount":"2000000","reward":"100000","deadline_ns":deadline.to_string()}}).to_string()
    };
    let attempt = |c: &mut Contract, id: &str, kind: &str, hash: &str, deadline: u64| {
        set(INTENTS, T0);
        c.mt_on_transfer(
            a(BUYER),
            vec![a(BUYER)],
            vec![USDC.into()],
            vec![U128(2_100_000)],
            valid(id, kind, hash, deadline),
        );
    };
    assert!(
        std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| attempt(
            &mut c,
            "FUL-0001",
            "unknown",
            MH,
            T0 + HOUR
        )))
        .is_err()
    );
    c.config.kinds.get_mut("bank_transfer").unwrap().enabled = false;
    assert!(
        std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| attempt(
            &mut c,
            "FUL-0002",
            "bank_transfer",
            MH,
            T0 + HOUR
        )))
        .is_err()
    );
    c.config.kinds.get_mut("bank_transfer").unwrap().enabled = true;
    assert!(
        std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| attempt(
            &mut c,
            "FUL-0003",
            "bank_transfer",
            "AAAA",
            T0 + HOUR
        )))
        .is_err()
    );
    assert!(
        std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| attempt(
            &mut c,
            "FUL-0004",
            "bank_transfer",
            MH,
            T0 + 24 * HOUR + 1
        )))
        .is_err()
    );
    attempt(&mut c, "FUL-0005", "bank_transfer", MH, T0 + 24 * HOUR);
    assert_eq!(status(&c, "FUL-0005"), Status::Funded);
}

#[test]
fn set_and_remove_kind_require_owner_and_yocto() {
    let mut c = new_contract(None);
    let config = c.get_kinds()["bank_transfer"].clone();
    set(FUL, T0);
    assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(
        || c.set_kind("topup".into(), config.clone())
    ))
    .is_err());
    set(OWNER, T0);
    assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(
        || c.set_kind("topup".into(), config.clone())
    ))
    .is_err());
    testing_env!(builder(OWNER, T0)
        .attached_deposit(NearToken::from_yoctonear(1))
        .build());
    c.set_kind("topup".into(), config);
    assert!(c.get_kinds().contains_key("topup"));
    set(FUL, T0);
    assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(
        || c.remove_kind("topup".into())
    ))
    .is_err());
    set(OWNER, T0);
    assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(
        || c.remove_kind("topup".into())
    ))
    .is_err());
    testing_env!(builder(OWNER, T0)
        .attached_deposit(NearToken::from_yoctonear(1))
        .build());
    c.remove_kind("topup".into());
    assert!(!c.get_kinds().contains_key("topup"));
}

#[test]
fn per_kind_claim_and_proof_timeouts() {
    let mut c = new_contract(None);
    c.config
        .kinds
        .get_mut("bank_transfer")
        .unwrap()
        .claim_timeout_ns = U64(MIN);
    c.config
        .kinds
        .get_mut("bank_transfer")
        .unwrap()
        .proof_timeout_ns = U64(2 * MIN);
    fund(&mut c, "FUL-0001", T0);
    register(&mut c, FUL);
    claim_as(&mut c, FUL, "FUL-0001", T0);
    set(FUL, T0 + MIN);
    c.timeout("FUL-0001".into());
    assert_eq!(status(&c, "FUL-0001"), Status::Funded);
    claim_as(&mut c, FUL, "FUL-0001", T0 + MIN);
    auth(
        &mut c,
        FUL,
        T0 + MIN,
        json!({"op":"sent","order_id":"FUL-0001"}),
    );
    set(FUL, T0 + 3 * MIN);
    c.timeout("FUL-0001".into());
    assert_eq!(status(&c, "FUL-0001"), Status::UnderReview);
}

/// funded -> claimed -> sent -> verifying; returns attempt number
fn to_verifying(c: &mut Contract, id: &str) -> u8 {
    fund(c, id, T0);
    register(c, FUL);
    auth(c, FUL, T0 + MIN, json!({"op":"claim","order_id":id}));
    auth(c, FUL, T0 + 2 * MIN, json!({"op":"sent","order_id":id}));
    auth(
        c,
        FUL,
        T0 + 3 * MIN,
        json!({"op":"submit_proof","order_id":id,"proof_sha256":PROOF,"spec":spec()}),
    );
    c.get_order(id.into()).unwrap().attempts
}

fn callback(c: &mut Contract, id: &str, attempt: u8, out: Value, ts: u64) {
    set_with_result(ts, PromiseResult::Successful(out.to_string().into_bytes()));
    current_callback(c, id, attempt);
}

fn current_callback(c: &mut Contract, id: &str, attempt: u8) {
    let o = c.order(id);
    c.on_verify_result(
        id.into(),
        attempt,
        o.verify_seq,
        o.fulfiller.unwrap(),
        o.proof_sha256.unwrap(),
    );
}

fn scheduled_verify_args() -> Value {
    calls()
        .into_iter()
        .find(|(to, method, _, _)| to == ESCROW && method == "on_verify_result")
        .expect("verification callback was not scheduled")
        .2
}

fn callback_from_args(c: &mut Contract, args: &Value, out: Value, ts: u64) {
    set_with_result(ts, PromiseResult::Successful(out.to_string().into_bytes()));
    c.on_verify_result(
        args["order_id"].as_str().unwrap().into(),
        args["attempt"].as_u64().unwrap() as u8,
        args["verify_seq"].as_u64().unwrap() as u32,
        a(args["expected_fulfiller"].as_str().unwrap()),
        args["expected_proof_sha256"].as_str().unwrap().into(),
    );
}

#[test]
fn old_callback_cannot_pay_new_fulfiller_with_same_proof() {
    let mut c = new_contract(None);
    fund(&mut c, "FUL-0001", T0);
    register(&mut c, FUL);
    register(&mut c, FUL2);
    auth(&mut c, FUL, T0, json!({"op":"claim","order_id":"FUL-0001"}));
    auth(
        &mut c,
        FUL,
        T0 + MIN,
        json!({"op":"submit_proof","order_id":"FUL-0001","proof_sha256":PROOF,"spec":spec()}),
    );
    let old_callback = scheduled_verify_args();
    set("anyone.test", T0 + 2 * HOUR + MIN);
    c.timeout("FUL-0001".into());
    assert_eq!(status(&c, "FUL-0001"), Status::ProofRejected);
    auth(
        &mut c,
        FUL,
        T0 + 2 * HOUR + 2 * MIN,
        json!({"op":"release_claim","order_id":"FUL-0001"}),
    );
    auth(
        &mut c,
        FUL2,
        T0 + 2 * HOUR + 2 * MIN,
        json!({"op":"claim","order_id":"FUL-0001"}),
    );
    auth(
        &mut c,
        FUL2,
        T0 + 2 * HOUR + 3 * MIN,
        json!({"op":"submit_proof","order_id":"FUL-0001","proof_sha256":PROOF,"spec":spec()}),
    );
    let new_callback = scheduled_verify_args();
    callback_from_args(
        &mut c,
        &old_callback,
        good_output("FUL-0001", T0 + 2 * HOUR + 2 * MIN),
        T0 + 2 * HOUR + 4 * MIN,
    );
    assert_eq!(status(&c, "FUL-0001"), Status::Verifying);
    assert_eq!(
        c.get_order("FUL-0001".into()).unwrap().total_proof_attempts,
        2
    );
    assert!(mt_transfers().is_empty());
    callback_from_args(
        &mut c,
        &new_callback,
        good_output("FUL-0001", T0 + 2 * HOUR + 2 * MIN),
        T0 + 2 * HOUR + 5 * MIN,
    );
    assert_eq!(status(&c, "FUL-0001"), Status::Paid);
    assert_eq!(mt_transfers(), vec![(FUL2.into(), USDC.into(), 2_100_000)]);
}

#[test]
fn old_callback_cannot_pay_after_same_fulfiller_reclaims() {
    let mut c = new_contract(None);
    fund(&mut c, "FUL-0001", T0);
    register(&mut c, FUL);
    auth(&mut c, FUL, T0, json!({"op":"claim","order_id":"FUL-0001"}));
    auth(
        &mut c,
        FUL,
        T0 + MIN,
        json!({"op":"submit_proof","order_id":"FUL-0001","proof_sha256":PROOF,"spec":spec()}),
    );
    let old_callback = scheduled_verify_args();
    set("anyone.test", T0 + 2 * HOUR + MIN);
    c.timeout("FUL-0001".into());
    auth(
        &mut c,
        FUL,
        T0 + 2 * HOUR + 2 * MIN,
        json!({"op":"release_claim","order_id":"FUL-0001"}),
    );
    auth(
        &mut c,
        FUL,
        T0 + 2 * HOUR + 2 * MIN,
        json!({"op":"claim","order_id":"FUL-0001"}),
    );
    auth(
        &mut c,
        FUL,
        T0 + 2 * HOUR + 3 * MIN,
        json!({"op":"submit_proof","order_id":"FUL-0001","proof_sha256":PROOF,"spec":spec()}),
    );
    let new_callback = scheduled_verify_args();
    callback_from_args(
        &mut c,
        &old_callback,
        good_output("FUL-0001", T0 + 2 * HOUR + 2 * MIN),
        T0 + 2 * HOUR + 4 * MIN,
    );
    assert_eq!(status(&c, "FUL-0001"), Status::Verifying);
    callback_from_args(
        &mut c,
        &new_callback,
        good_output("FUL-0001", T0 + 2 * HOUR + 2 * MIN),
        T0 + 2 * HOUR + 5 * MIN,
    );
    assert_eq!(status(&c, "FUL-0001"), Status::Paid);
}

#[test]
fn stale_callback_after_same_fulfiller_resubmission_is_ignored() {
    let mut c = new_contract(None);
    let _ = to_verifying(&mut c, "FUL-0001");
    let old_callback = scheduled_verify_args();

    callback_from_args(
        &mut c,
        &old_callback,
        json!({"ok":false,"reason":"retry"}),
        T0 + 4 * MIN,
    );
    assert_eq!(status(&c, "FUL-0001"), Status::ProofRejected);

    auth(
        &mut c,
        FUL,
        T0 + 5 * MIN,
        json!({"op":"submit_proof","order_id":"FUL-0001","proof_sha256":PROOF,"spec":spec()}),
    );
    let new_callback = scheduled_verify_args();
    assert_ne!(old_callback["verify_seq"], new_callback["verify_seq"]);

    callback_from_args(
        &mut c,
        &old_callback,
        good_output("FUL-0001", T0 + 2 * MIN),
        T0 + 6 * MIN,
    );
    assert_eq!(status(&c, "FUL-0001"), Status::Verifying);
    assert!(mt_transfers().is_empty());

    callback_from_args(
        &mut c,
        &new_callback,
        good_output("FUL-0001", T0 + 5 * MIN),
        T0 + 7 * MIN,
    );
    assert_eq!(status(&c, "FUL-0001"), Status::Paid);
}

#[test]
fn proof_budget_survives_release_and_blocks_seventh_request() {
    let mut c = new_contract(None);
    fund(&mut c, "FUL-0001", T0);
    register(&mut c, FUL);
    for n in 0..6 {
        let ts = T0 + n * 3 * MIN;
        auth(&mut c, FUL, ts, json!({"op":"claim","order_id":"FUL-0001"}));
        auth(
            &mut c,
            FUL,
            ts + MIN,
            json!({"op":"submit_proof","order_id":"FUL-0001","proof_sha256":PROOF,"spec":spec()}),
        );
        let args = scheduled_verify_args();
        callback_from_args(
            &mut c,
            &args,
            json!({"ok":false,"reason":"no proof"}),
            ts + 2 * MIN,
        );
        assert_eq!(status(&c, "FUL-0001"), Status::ProofRejected);
        auth(
            &mut c,
            FUL,
            ts + 2 * MIN,
            json!({"op":"release_claim","order_id":"FUL-0001"}),
        );
    }
    auth(
        &mut c,
        FUL,
        T0 + 18 * MIN,
        json!({"op":"claim","order_id":"FUL-0001"}),
    );
    let rejected = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        auth(
            &mut c,
            FUL,
            T0 + 19 * MIN,
            json!({"op":"submit_proof","order_id":"FUL-0001","proof_sha256":PROOF,"spec":spec()}),
        );
    }));
    assert!(rejected.is_err());
    assert_eq!(status(&c, "FUL-0001"), Status::Claimed);
    assert_eq!(
        c.get_order("FUL-0001".into()).unwrap().total_proof_attempts,
        6
    );
    assert_eq!(c.get_order("FUL-0001".into()).unwrap().verify_seq, 6);
    assert!(!calls()
        .iter()
        .any(|(to, method, _, _)| to == OUTLAYER && method == "request_execution"));
    assert!(!get_logs()
        .iter()
        .any(|line| line.contains("\"event\":\"order_sent\"")));
    auth(
        &mut c,
        FUL,
        T0 + 20 * MIN,
        json!({"op":"release_claim","order_id":"FUL-0001"}),
    );
    auth(
        &mut c,
        BUYER,
        T0 + 20 * MIN,
        json!({"op":"cancel","order_id":"FUL-0001"}),
    );
    assert!(c.get_order("FUL-0001".into()).is_none());
}

#[test]
fn account_index_tracks_timeout_and_reclaims_without_stale_entries() {
    let mut c = new_contract(None);
    fund(&mut c, "FUL-0001", T0);
    register(&mut c, FUL);
    register(&mut c, FUL2);
    auth(&mut c, FUL, T0, json!({"op":"claim","order_id":"FUL-0001"}));
    assert_eq!(c.orders_by_account(a(FUL), None, None).len(), 1);
    set("anyone.test", T0 + 15 * MIN);
    c.timeout("FUL-0001".into());
    assert!(c.orders_by_account(a(FUL), None, None).is_empty());
    auth(
        &mut c,
        FUL,
        T0 + 16 * MIN,
        json!({"op":"claim","order_id":"FUL-0001"}),
    );
    assert_eq!(c.orders_by_account(a(FUL), None, None).len(), 1);
    auth(
        &mut c,
        FUL,
        T0 + 17 * MIN,
        json!({"op":"release_claim","order_id":"FUL-0001"}),
    );
    assert!(c.orders_by_account(a(FUL), None, None).is_empty());
    auth(
        &mut c,
        FUL2,
        T0 + 18 * MIN,
        json!({"op":"claim","order_id":"FUL-0001"}),
    );
    assert_eq!(c.orders_by_account(a(FUL2), None, None).len(), 1);
    assert!(c.orders_by_account(a(FUL), None, None).is_empty());
    auth(
        &mut c,
        FUL2,
        T0 + 19 * MIN,
        json!({"op":"release_claim","order_id":"FUL-0001"}),
    );
    assert!(c.orders_by_account(a(FUL2), None, None).is_empty());
    auth(
        &mut c,
        FUL,
        T0 + 20 * MIN,
        json!({"op":"claim","order_id":"FUL-0001"}),
    );
    assert_eq!(c.orders_by_account(a(FUL), None, None).len(), 1);
    assert!(c.orders_by_account(a(FUL2), None, None).is_empty());
}

#[test]
fn callback_rejects_changed_fulfiller_or_proof_args_without_state_mutation() {
    let mut c = new_contract(None);
    let _ = to_verifying(&mut c, "FUL-0001");
    let args = scheduled_verify_args();
    let mut wrong_fulfiller = args.clone();
    wrong_fulfiller["expected_fulfiller"] = json!(FUL2);
    callback_from_args(
        &mut c,
        &wrong_fulfiller,
        good_output("FUL-0001", T0 + 2 * MIN),
        T0 + 4 * MIN,
    );
    assert_eq!(status(&c, "FUL-0001"), Status::Verifying);
    assert!(mt_transfers().is_empty());

    let mut wrong_proof = args.clone();
    wrong_proof["expected_proof_sha256"] = json!(TXREF);
    callback_from_args(
        &mut c,
        &wrong_proof,
        good_output("FUL-0001", T0 + 2 * MIN),
        T0 + 5 * MIN,
    );
    assert_eq!(status(&c, "FUL-0001"), Status::Verifying);
    assert!(mt_transfers().is_empty());

    callback_from_args(
        &mut c,
        &args,
        good_output("FUL-0001", T0 + 2 * MIN),
        T0 + 6 * MIN,
    );
    assert_eq!(status(&c, "FUL-0001"), Status::Paid);
}

// ---------------------------------------------------------------- fund

#[test]
fn fund_creates_order() {
    let mut c = new_contract(None);
    fund(&mut c, "FUL-0001", T0);
    let o = c.get_order("FUL-0001".into()).unwrap();
    assert_eq!(o.status, Status::Funded);
    assert_eq!(o.buyer, a(BUYER));
    assert_eq!(o.pay_amount.0 + o.reward.0, 2_100_000);
    assert!(get_logs().iter().any(|l| l.contains("order_funded")));
    assert_eq!(c.get_profile(a(BUYER)).stats.open_as_buyer, 1);
    assert_eq!(c.orders_by_account(a(BUYER), None, None).len(), 1);
}

#[test]
#[should_panic(expected = "only intents contract")]
fn fund_wrong_predecessor() {
    let mut c = new_contract(None);
    set("evil.test", T0);
    c.mt_on_transfer(
        a(BUYER),
        vec![a(BUYER)],
        vec![USDC.into()],
        vec![U128(2_100_000)],
        fund_msg("FUL-0001", 2_000_000, 100_000, T0 + HOUR),
    );
}

#[test]
#[should_panic(expected = "amount != pay_amount + reward")]
fn fund_wrong_amount() {
    let mut c = new_contract(None);
    set(INTENTS, T0);
    c.mt_on_transfer(
        a(BUYER),
        vec![a(BUYER)],
        vec![USDC.into()],
        vec![U128(2_000_000)],
        fund_msg("FUL-0001", 2_000_000, 100_000, T0 + HOUR),
    );
}

#[test]
#[should_panic(expected = "order id used")]
fn fund_reused_id() {
    let mut c = new_contract(None);
    fund(&mut c, "FUL-0001", T0);
    fund(&mut c, "FUL-0001", T0);
}

#[test]
#[should_panic(expected = "token not accepted")]
fn fund_wrong_token() {
    let mut c = new_contract(None);
    set(INTENTS, T0);
    c.mt_on_transfer(
        a(BUYER),
        vec![a(BUYER)],
        vec!["nep141:scam.test".into()],
        vec![U128(2_100_000)],
        fund_msg("FUL-0001", 2_000_000, 100_000, T0 + HOUR),
    );
}

#[test]
#[should_panic(expected = "exactly one token")]
fn fund_multiple_tokens() {
    let mut c = new_contract(None);
    set(INTENTS, T0);
    c.mt_on_transfer(
        a(BUYER),
        vec![a(BUYER), a(BUYER)],
        vec![USDC.into(), OTHER.into()],
        vec![U128(1), U128(1)],
        fund_msg("FUL-0001", 2_000_000, 100_000, T0 + HOUR),
    );
}

#[test]
#[should_panic(expected = "approvals are not supported")]
fn fund_previous_owner_mismatch() {
    let mut c = new_contract(None);
    set(INTENTS, T0);
    c.mt_on_transfer(
        a(BUYER),
        vec![a("other.test")],
        vec![USDC.into()],
        vec![U128(2_100_000)],
        fund_msg("FUL-0001", 2_000_000, 100_000, T0 + HOUR),
    );
}

#[test]
#[should_panic(expected = "bad order id")]
fn fund_bad_id() {
    let mut c = new_contract(None);
    set(INTENTS, T0);
    c.mt_on_transfer(
        a(BUYER),
        vec![a(BUYER)],
        vec![USDC.into()],
        vec![U128(2_100_000)],
        fund_msg("ful-lower", 2_000_000, 100_000, T0 + HOUR),
    );
}

#[test]
#[should_panic(expected = "bad deadline")]
fn fund_past_deadline() {
    let mut c = new_contract(None);
    set(INTENTS, T0);
    c.mt_on_transfer(
        a(BUYER),
        vec![a(BUYER)],
        vec![USDC.into()],
        vec![U128(2_100_000)],
        fund_msg("FUL-0001", 2_000_000, 100_000, T0 - 1),
    );
}

#[test]
#[should_panic(expected = "order too small")]
fn fund_too_small() {
    let mut c = new_contract(None);
    set(INTENTS, T0);
    c.mt_on_transfer(
        a(BUYER),
        vec![a(BUYER)],
        vec![USDC.into()],
        vec![U128(10)],
        fund_msg("FUL-0001", 5, 5, T0 + HOUR),
    );
}

#[test]
#[should_panic(expected = "paused")]
fn fund_when_paused() {
    let mut c = new_contract(Some(|c: &mut Config| c.paused = true));
    fund(&mut c, "FUL-0001", T0);
}

#[test]
#[should_panic(expected = "order book full")]
fn fund_order_cap() {
    let mut c = new_contract(Some(|c: &mut Config| c.max_orders = 1));
    fund(&mut c, "FUL-0001", T0);
    fund(&mut c, "FUL-0002", T0);
}

#[test]
fn bond_deposit_and_withdraw() {
    let mut c = new_contract(None);
    set(INTENTS, T0);
    c.mt_on_transfer(
        a(FUL),
        vec![a(FUL)],
        vec![USDC.into()],
        vec![U128(500)],
        r#"{"op":"bond"}"#.into(),
    );
    assert_eq!(c.get_profile(a(FUL)).bond.available.0, 500);
    auth(
        &mut c,
        FUL,
        T0,
        json!({"op":"withdraw_bond","amount":"200"}),
    );
    assert_eq!(c.get_profile(a(FUL)).bond.available.0, 300);
    assert_eq!(mt_transfers(), vec![(FUL.into(), USDC.into(), 200)]);
}

#[test]
#[should_panic(expected = "insufficient available bond")]
fn withdraw_bond_too_much() {
    let mut c = new_contract(None);
    auth(&mut c, FUL, T0, json!({"op":"withdraw_bond","amount":"1"}));
}

#[test]
#[should_panic(expected = "wrong bond token")]
fn bond_wrong_token() {
    let mut c = new_contract(None);
    set(INTENTS, T0);
    c.mt_on_transfer(
        a(FUL),
        vec![a(FUL)],
        vec![OTHER.into()],
        vec![U128(500)],
        r#"{"op":"bond"}"#.into(),
    );
}

// ---------------------------------------------------------------- on_auth guards

#[test]
#[should_panic(expected = "only intents contract")]
fn on_auth_wrong_predecessor() {
    let mut c = new_contract(None);
    set(FUL, T0);
    c.on_auth(
        a(FUL),
        json!({"op":"claim","order_id":"FUL-0001"}).to_string(),
    );
}

#[test]
#[should_panic(expected = "bad msg")]
fn on_auth_bad_msg() {
    let mut c = new_contract(None);
    auth(&mut c, FUL, T0, json!({"op":"steal"}));
}

#[test]
#[should_panic(expected = "missing order_id")]
fn on_auth_missing_field() {
    let mut c = new_contract(None);
    auth(&mut c, FUL, T0, json!({"op":"claim"}));
}

#[test]
#[should_panic(expected = "bad msg")]
fn fund_unknown_op_refunds() {
    let mut c = new_contract(None);
    set(INTENTS, T0);
    c.mt_on_transfer(
        a(BUYER),
        vec![a(BUYER)],
        vec![USDC.into()],
        vec![U128(1)],
        r#"{"op":"gift"}"#.into(),
    );
}

#[test]
#[should_panic(expected = "bank_bin must be 6 digits")]
fn register_bad_bin() {
    let mut c = new_contract(None);
    auth(
        &mut c,
        FUL,
        T0,
        json!({"op":"register_fulfiller","bank_bin":"12","account_last4":"1234"}),
    );
}

#[test]
#[should_panic(expected = "profile limit reached")]
fn register_cap() {
    let mut c = new_contract(Some(|c: &mut Config| c.max_profiles = 1));
    register(&mut c, FUL);
    register(&mut c, FUL); // update is fine
    register(&mut c, FUL2);
}

#[test]
#[should_panic(expected = "not a registered fulfiller")]
fn claim_unregistered() {
    let mut c = new_contract(None);
    fund(&mut c, "FUL-0001", T0);
    auth(&mut c, FUL, T0, json!({"op":"claim","order_id":"FUL-0001"}));
}

#[test]
#[should_panic(expected = "buyer cannot claim")]
fn claim_by_buyer() {
    let mut c = new_contract(None);
    fund(&mut c, "FUL-0001", T0);
    register(&mut c, BUYER);
    auth(
        &mut c,
        BUYER,
        T0,
        json!({"op":"claim","order_id":"FUL-0001"}),
    );
}

#[test]
#[should_panic(expected = "already claimed")]
fn double_claim() {
    let mut c = new_contract(None);
    fund(&mut c, "FUL-0001", T0);
    register(&mut c, FUL);
    register(&mut c, FUL2);
    auth(&mut c, FUL, T0, json!({"op":"claim","order_id":"FUL-0001"}));
    auth(
        &mut c,
        FUL2,
        T0,
        json!({"op":"claim","order_id":"FUL-0001"}),
    );
}

#[test]
#[should_panic(expected = "order expired")]
fn claim_after_deadline() {
    let mut c = new_contract(None);
    fund(&mut c, "FUL-0001", T0);
    register(&mut c, FUL);
    auth(
        &mut c,
        FUL,
        T0 + 25 * HOUR,
        json!({"op":"claim","order_id":"FUL-0001"}),
    );
}

#[test]
#[should_panic(expected = "insufficient bond")]
fn claim_needs_bond_when_bps_set() {
    let mut c = new_contract(Some(|c: &mut Config| c.bond_per_job_bps = 1000));
    fund(&mut c, "FUL-0001", T0);
    register(&mut c, FUL);
    auth(&mut c, FUL, T0, json!({"op":"claim","order_id":"FUL-0001"}));
}

#[test]
#[should_panic(expected = "bond below minimum")]
fn claim_min_bond() {
    let mut c = new_contract(Some(|c: &mut Config| c.min_bond = U128(1)));
    fund(&mut c, "FUL-0001", T0);
    register(&mut c, FUL);
    auth(&mut c, FUL, T0, json!({"op":"claim","order_id":"FUL-0001"}));
}

#[test]
#[should_panic(expected = "not the fulfiller")]
fn sent_by_stranger() {
    let mut c = new_contract(None);
    fund(&mut c, "FUL-0001", T0);
    register(&mut c, FUL);
    auth(&mut c, FUL, T0, json!({"op":"claim","order_id":"FUL-0001"}));
    auth(&mut c, FUL2, T0, json!({"op":"sent","order_id":"FUL-0001"}));
}

#[test]
#[should_panic(expected = "claim timed out")]
fn sent_after_claim_timeout() {
    let mut c = new_contract(None);
    fund(&mut c, "FUL-0001", T0);
    register(&mut c, FUL);
    auth(&mut c, FUL, T0, json!({"op":"claim","order_id":"FUL-0001"}));
    auth(
        &mut c,
        FUL,
        T0 + 16 * MIN,
        json!({"op":"sent","order_id":"FUL-0001"}),
    );
}

#[test]
#[should_panic(expected = "not awaiting proof")]
fn proof_while_verifying() {
    let mut c = new_contract(None);
    to_verifying(&mut c, "FUL-0001");
    auth(
        &mut c,
        FUL,
        T0 + 4 * MIN,
        json!({"op":"submit_proof","order_id":"FUL-0001","proof_sha256":PROOF,"spec":spec()}),
    );
}

#[test]
#[should_panic(expected = "bad proof_sha256")]
fn proof_bad_hash() {
    let mut c = new_contract(None);
    fund(&mut c, "FUL-0001", T0);
    register(&mut c, FUL);
    auth(&mut c, FUL, T0, json!({"op":"claim","order_id":"FUL-0001"}));
    auth(&mut c, FUL, T0, json!({"op":"sent","order_id":"FUL-0001"}));
    auth(
        &mut c,
        FUL,
        T0,
        json!({"op":"submit_proof","order_id":"FUL-0001","proof_sha256":"zz","spec":spec()}),
    );
}

#[test]
#[should_panic(expected = "not enough gas for verification")]
fn proof_low_gas() {
    let mut c = new_contract(None);
    fund(&mut c, "FUL-0001", T0);
    register(&mut c, FUL);
    auth(&mut c, FUL, T0, json!({"op":"claim","order_id":"FUL-0001"}));
    auth(&mut c, FUL, T0, json!({"op":"sent","order_id":"FUL-0001"}));
    testing_env!(builder(INTENTS, T0)
        .prepaid_gas(Gas::from_tgas(100))
        .build());
    c.on_auth(
        a(FUL),
        json!({"op":"submit_proof","order_id":"FUL-0001","proof_sha256":PROOF,"spec":spec()})
            .to_string(),
    );
}

#[test]
#[should_panic(expected = "escrow NEAR float too low")]
fn proof_low_float() {
    let mut c = new_contract(None);
    fund(&mut c, "FUL-0001", T0);
    register(&mut c, FUL);
    auth(&mut c, FUL, T0, json!({"op":"claim","order_id":"FUL-0001"}));
    auth(&mut c, FUL, T0, json!({"op":"sent","order_id":"FUL-0001"}));
    testing_env!(builder(INTENTS, T0)
        .account_balance(NearToken::from_millinear(1))
        .build());
    c.on_auth(
        a(FUL),
        json!({"op":"submit_proof","order_id":"FUL-0001","proof_sha256":PROOF,"spec":spec()})
            .to_string(),
    );
}

// ---------------------------------------------------------------- verification

#[test]
fn submit_proof_calls_outlayer() {
    let mut c = new_contract(Some(|c: &mut Config| {
        c.kinds.get_mut("bank_transfer").unwrap().secrets_ref = Some(SecretsRef {
            profile: "default".into(),
            account_id: a(ESCROW),
        })
    }));
    let attempt = to_verifying(&mut c, "FUL-0001");
    assert_eq!(attempt, 1);
    assert_eq!(status(&c, "FUL-0001"), Status::Verifying);
    let calls = calls();
    let (_, _, args, dep) = calls
        .iter()
        .find(|(to, m, _, _)| to == OUTLAYER && m == "request_execution")
        .expect("request_execution");
    assert_eq!(*dep, NearToken::from_millinear(10).as_yoctonear());
    assert_eq!(args["response_format"], "Json");
    assert_eq!(args["payer_account_id"], ESCROW);
    assert_eq!(
        args["source"]["Project"]["project_id"],
        "escrow.test/email-verifier"
    );
    assert_eq!(args["secrets_ref"]["profile"], "default");
    let input: Value = serde_json::from_str(args["input_data"].as_str().unwrap()).unwrap();
    assert_eq!(input["order_id"], "FUL-0001");
    assert_eq!(input["kind"], "bank_transfer");
    assert_eq!(input["spec_hash"], sha256_hex(spec().as_bytes()));
    assert_eq!(
        input["blob_url"],
        format!("https://api.example/proof-blob/{PROOF}")
    );
    assert!(calls
        .iter()
        .any(|(to, m, _, _)| to == ESCROW && m == "on_verify_result"));
}

#[test]
fn happy_path_pays_fulfiller() {
    let mut c = new_contract(None);
    let att = to_verifying(&mut c, "FUL-0001");
    callback(
        &mut c,
        "FUL-0001",
        att,
        good_output("FUL-0001", T0 + 2 * MIN),
        T0 + 4 * MIN,
    );
    let o = c.get_order("FUL-0001".into()).unwrap();
    assert_eq!(o.status, Status::Paid);
    assert_eq!(o.nullifier.as_deref(), Some(TXREF));
    assert_eq!(mt_transfers(), vec![(FUL.into(), USDC.into(), 2_100_000)]);
    let p = c.get_profile(a(FUL));
    assert_eq!(p.stats.jobs_done, 1);
    assert_eq!(p.stats.active_claims, 0);
    assert_eq!(p.stats.volume.0, 2_100_000);
    let b = c.get_profile(a(BUYER));
    assert_eq!(b.stats.jobs_as_buyer, 1);
    assert_eq!(b.stats.open_as_buyer, 0);
    assert_eq!(c.is_nullifier_used(TXREF.into()), Some("FUL-0001".into()));
}

#[test]
fn outlayer_wrapper_and_string_shapes_accepted() {
    // {success, output: "<json string>"}
    let mut c = new_contract(None);
    let att = to_verifying(&mut c, "FUL-0001");
    let wrapped = json!({"success": true,
        "output": good_output("FUL-0001", T0 + 2 * MIN).to_string()});
    callback(
        &mut c,
        "FUL-0001",
        att,
        Value::String(wrapped.to_string()),
        T0 + 4 * MIN,
    );
    assert_eq!(status(&c, "FUL-0001"), Status::Paid);
}

#[test]
fn outlayer_failure_wrapper_rejects() {
    let mut c = new_contract(None);
    let att = to_verifying(&mut c, "FUL-0001");
    callback(
        &mut c,
        "FUL-0001",
        att,
        json!({"success": false, "error": "dns"}),
        T0 + 4 * MIN,
    );
    let o = c.get_order("FUL-0001".into()).unwrap();
    assert_eq!(o.status, Status::ProofRejected);
    assert!(o.last_reject_reason.unwrap().contains("dns"));
    assert!(mt_transfers().is_empty());
}

#[test]
fn failed_promise_is_recoverable() {
    let mut c = new_contract(None);
    let att = to_verifying(&mut c, "FUL-0001");
    set_with_result(T0 + 4 * MIN, PromiseResult::Failed);
    current_callback(&mut c, "FUL-0001", att);
    assert_eq!(status(&c, "FUL-0001"), Status::ProofRejected);
    assert_eq!(
        c.get_order("FUL-0001".into()).unwrap().total_proof_attempts,
        1
    );
    // fulfiller can resubmit
    auth(
        &mut c,
        FUL,
        T0 + 5 * MIN,
        json!({"op":"submit_proof","order_id":"FUL-0001","proof_sha256":PROOF,"spec":spec()}),
    );
    assert_eq!(status(&c, "FUL-0001"), Status::Verifying);
    assert_eq!(c.get_order("FUL-0001".into()).unwrap().attempts, 2);
    assert_eq!(
        c.get_order("FUL-0001".into()).unwrap().total_proof_attempts,
        2
    );
}

fn assert_rejected(out: Value, reason: &str) {
    let mut c = new_contract(Some(|c: &mut Config| c.min_order_amount = U128(100_000)));
    let att = to_verifying(&mut c, "FUL-0001");
    callback(&mut c, "FUL-0001", att, out, T0 + 4 * MIN);
    let o = c.get_order("FUL-0001".into()).unwrap();
    assert_eq!(o.status, Status::ProofRejected, "{reason}");
    assert!(
        o.last_reject_reason.as_deref().unwrap().contains(reason),
        "{:?} vs {reason}",
        o.last_reject_reason
    );
    assert!(mt_transfers().is_empty());
}

#[test]
fn reject_not_ok() {
    let mut out = good_output("FUL-0001", T0);
    out["ok"] = json!(false);
    out["reason"] = json!("dkim fail");
    assert_rejected(out, "dkim fail");
}

#[test]
fn reject_spec_hash_echo_mismatch() {
    let mut out = good_output("FUL-0001", T0 + 2 * MIN);
    out["spec_hash"] = json!(PROOF);
    assert_rejected(out, "spec hash mismatch");
}

#[test]
fn reject_proof_hash_echo_mismatch() {
    let mut out = good_output("FUL-0001", T0 + 2 * MIN);
    out["proof_sha256"] = json!(TXREF);
    assert_rejected(out, "proof hash mismatch");
}

#[test]
fn reject_order_id_echo_mismatch() {
    let mut out = good_output("FUL-0001", T0 + 2 * MIN);
    out["order_id"] = json!("FUL-0002");
    assert_rejected(out, "order id mismatch");
}

#[test]
fn reject_completion_before_claim_window() {
    // Completion may be at most `max_email_skew_ns` before the claim.
    let out = good_output("FUL-0001", T0 + MIN - 10 * MIN - 1);
    assert_rejected(out, "completion older than claim");
}

#[test]
fn reject_missing_completion_time() {
    let mut out = good_output("FUL-0001", T0 + 2 * MIN);
    out["completed_at_ns"] = Value::Null;
    assert_rejected(out, "completion older than claim");
}

#[test]
fn reject_bad_nullifier() {
    let mut out = good_output("FUL-0001", T0 + 2 * MIN);
    out["nullifier"] = json!("FT123");
    assert_rejected(out, "bad nullifier");
}

#[test]
fn reject_garbage() {
    let mut c = new_contract(None);
    let att = to_verifying(&mut c, "FUL-0001");
    set_with_result(
        T0 + 4 * MIN,
        PromiseResult::Successful(b"not json".to_vec()),
    );
    current_callback(&mut c, "FUL-0001", att);
    assert_eq!(status(&c, "FUL-0001"), Status::ProofRejected);
}

#[test]
fn nullifier_replay_on_second_order_rejected() {
    let mut c = new_contract(None);
    let att = to_verifying(&mut c, "FUL-0001");
    callback(
        &mut c,
        "FUL-0001",
        att,
        good_output("FUL-0001", T0 + 2 * MIN),
        T0 + 4 * MIN,
    );
    assert_eq!(status(&c, "FUL-0001"), Status::Paid);

    fund(&mut c, "FUL-0002", T0);
    auth(
        &mut c,
        FUL,
        T0 + MIN,
        json!({"op":"claim","order_id":"FUL-0002"}),
    );
    auth(
        &mut c,
        FUL,
        T0 + 2 * MIN,
        json!({"op":"sent","order_id":"FUL-0002"}),
    );
    auth(
        &mut c,
        FUL,
        T0 + 3 * MIN,
        json!({"op":"submit_proof","order_id":"FUL-0002","proof_sha256":PROOF,"spec":spec()}),
    );
    // The generic nullifier cannot settle two distinct orders.
    let mut out = good_output("FUL-0002", T0 + 2 * MIN);
    callback(&mut c, "FUL-0002", 1, out, T0 + 4 * MIN);
    let o = c.get_order("FUL-0002".into()).unwrap();
    assert_eq!(o.status, Status::ProofRejected);
    assert_eq!(
        o.last_reject_reason.as_deref(),
        Some("nullifier already used")
    );
}

#[test]
fn stale_callback_ignored() {
    let mut c = new_contract(None);
    let att = to_verifying(&mut c, "FUL-0001");
    callback(
        &mut c,
        "FUL-0001",
        att + 1,
        good_output("FUL-0001", T0 + 2 * MIN),
        T0 + 4 * MIN,
    );
    assert_eq!(status(&c, "FUL-0001"), Status::Verifying);
    assert!(mt_transfers().is_empty());
}

#[test]
fn three_rejections_go_under_review() {
    let mut c = new_contract(None);
    let mut att = to_verifying(&mut c, "FUL-0001");
    let mut bad = good_output("FUL-0001", T0);
    bad["ok"] = json!(false);
    for i in 0..3 {
        callback(&mut c, "FUL-0001", att, bad.clone(), T0 + 4 * MIN);
        if i < 2 {
            assert_eq!(status(&c, "FUL-0001"), Status::ProofRejected);
            auth(
                &mut c,
                FUL,
                T0 + 5 * MIN,
                json!({"op":"submit_proof","order_id":"FUL-0001","proof_sha256":PROOF,"spec":spec()}),
            );
            att += 1;
        }
    }
    assert_eq!(status(&c, "FUL-0001"), Status::UnderReview);
}

#[test]
fn challenge_window_then_finalize() {
    let mut c = new_contract(Some(|c: &mut Config| c.challenge_window_ns = U64(HOUR)));
    let att = to_verifying(&mut c, "FUL-0001");
    callback(
        &mut c,
        "FUL-0001",
        att,
        good_output("FUL-0001", T0 + 2 * MIN),
        T0 + 4 * MIN,
    );
    assert_eq!(status(&c, "FUL-0001"), Status::Verified);
    assert!(mt_transfers().is_empty());
    set("anyone.test", T0 + 4 * MIN + HOUR);
    c.finalize("FUL-0001".into());
    assert_eq!(status(&c, "FUL-0001"), Status::Paid);
    assert_eq!(mt_transfers(), vec![(FUL.into(), USDC.into(), 2_100_000)]);
}

#[test]
fn verified_before_deadline_cannot_expire_and_can_finalize_afterward() {
    let mut c = new_contract(Some(|config: &mut Config| {
        config.challenge_window_ns = U64(HOUR)
    }));
    let attempt = to_verifying(&mut c, "FUL-0001");
    callback(
        &mut c,
        "FUL-0001",
        attempt,
        good_output("FUL-0001", T0 + 2 * MIN),
        T0 + 4 * MIN,
    );
    assert_eq!(status(&c, "FUL-0001"), Status::Verified);
    set("anyone.test", T0 + 24 * HOUR);
    assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        c.expire("FUL-0001".into())
    }))
    .is_err());
    assert_eq!(status(&c, "FUL-0001"), Status::Verified);
    c.finalize("FUL-0001".into());
    assert_eq!(status(&c, "FUL-0001"), Status::Paid);
    assert_eq!(mt_transfers(), vec![(FUL.into(), USDC.into(), 2_100_000)]);
}

#[test]
#[should_panic(expected = "challenge window open")]
fn finalize_too_early() {
    let mut c = new_contract(Some(|c: &mut Config| c.challenge_window_ns = U64(HOUR)));
    let att = to_verifying(&mut c, "FUL-0001");
    callback(
        &mut c,
        "FUL-0001",
        att,
        good_output("FUL-0001", T0 + 2 * MIN),
        T0 + 4 * MIN,
    );
    set("anyone.test", T0 + 5 * MIN);
    c.finalize("FUL-0001".into());
}

// ---------------------------------------------------------------- cancel / expire / timeouts

#[test]
fn cancel_refunds_buyer() {
    let mut c = new_contract(None);
    fund(&mut c, "FUL-0001", T0);
    auth(
        &mut c,
        BUYER,
        T0 + MIN,
        json!({"op":"cancel","order_id":"FUL-0001"}),
    );
    assert_eq!(mt_transfers(), vec![(BUYER.into(), USDC.into(), 2_100_000)]);
    assert_eq!(c.get_profile(a(BUYER)).stats.open_as_buyer, 0);
    // review #7: pruned at once
    assert!(c.get_order("FUL-0001".into()).is_none());
    assert!(c.orders_by_account(a(BUYER), None, None).is_empty());
    assert_eq!(c.get_counts().0, 0);
    assert!(get_logs().iter().any(|l| l.contains("order_cancelled")));
}

#[test]
#[should_panic(expected = "not the buyer")]
fn cancel_by_stranger() {
    let mut c = new_contract(None);
    fund(&mut c, "FUL-0001", T0);
    auth(
        &mut c,
        FUL,
        T0,
        json!({"op":"cancel","order_id":"FUL-0001"}),
    );
}

#[test]
#[should_panic(expected = "not cancellable")]
fn cancel_after_claim() {
    let mut c = new_contract(None);
    fund(&mut c, "FUL-0001", T0);
    register(&mut c, FUL);
    auth(&mut c, FUL, T0, json!({"op":"claim","order_id":"FUL-0001"}));
    auth(
        &mut c,
        BUYER,
        T0,
        json!({"op":"cancel","order_id":"FUL-0001"}),
    );
}

#[test]
fn expire_refunds() {
    let mut c = new_contract(None);
    fund(&mut c, "FUL-0001", T0);
    set("anyone.test", T0 + 24 * HOUR);
    c.expire("FUL-0001".into());
    assert_eq!(mt_transfers(), vec![(BUYER.into(), USDC.into(), 2_100_000)]);
    assert!(c.get_order("FUL-0001".into()).is_none());
    assert_eq!(c.get_counts().0, 0);
}

#[test]
#[should_panic(expected = "deadline not reached")]
fn expire_too_early() {
    let mut c = new_contract(None);
    fund(&mut c, "FUL-0001", T0);
    set("anyone.test", T0 + HOUR);
    c.expire("FUL-0001".into());
}

#[test]
fn claim_timeout_unclaims_and_slashes() {
    let mut c = new_contract(Some(|c: &mut Config| c.bond_per_job_bps = 1000));
    set(INTENTS, T0);
    c.mt_on_transfer(
        a(FUL),
        vec![a(FUL)],
        vec![USDC.into()],
        vec![U128(1_000_000)],
        r#"{"op":"bond"}"#.into(),
    );
    fund(&mut c, "FUL-0001", T0);
    register(&mut c, FUL);
    auth(&mut c, FUL, T0, json!({"op":"claim","order_id":"FUL-0001"}));
    let bond = c.get_profile(a(FUL)).bond;
    assert_eq!((bond.available.0, bond.locked.0), (790_000, 210_000));
    set("anyone.test", T0 + 15 * MIN);
    c.timeout("FUL-0001".into());
    let o = c.get_order("FUL-0001".into()).unwrap();
    assert_eq!(o.status, Status::Funded);
    assert!(o.fulfiller.is_none());
    let bond = c.get_profile(a(FUL)).bond;
    assert_eq!((bond.available.0, bond.locked.0), (790_000, 0));
    assert_eq!(mt_transfers(), vec![(BUYER.into(), USDC.into(), 210_000)]);
    assert_eq!(c.get_profile(a(FUL)).stats.active_claims, 0);
}

#[test]
#[should_panic(expected = "nothing to time out")]
fn timeout_too_early() {
    let mut c = new_contract(None);
    fund(&mut c, "FUL-0001", T0);
    register(&mut c, FUL);
    auth(&mut c, FUL, T0, json!({"op":"claim","order_id":"FUL-0001"}));
    set("anyone.test", T0 + 5 * MIN);
    c.timeout("FUL-0001".into());
}

#[test]
fn proof_timeout_goes_under_review_never_refunds() {
    let mut c = new_contract(None);
    fund(&mut c, "FUL-0001", T0);
    register(&mut c, FUL);
    auth(&mut c, FUL, T0, json!({"op":"claim","order_id":"FUL-0001"}));
    auth(
        &mut c,
        FUL,
        T0 + MIN,
        json!({"op":"sent","order_id":"FUL-0001"}),
    );
    set("anyone.test", T0 + MIN + 2 * HOUR);
    c.timeout("FUL-0001".into());
    assert_eq!(status(&c, "FUL-0001"), Status::UnderReview);
    assert!(mt_transfers().is_empty());
}

#[test]
fn stuck_verification_times_out() {
    let mut c = new_contract(None);
    let att = to_verifying(&mut c, "FUL-0001");
    set("anyone.test", T0 + 3 * MIN + 2 * HOUR);
    c.timeout("FUL-0001".into());
    assert_eq!(status(&c, "FUL-0001"), Status::ProofRejected);
    // late callback is ignored
    callback(
        &mut c,
        "FUL-0001",
        att,
        good_output("FUL-0001", T0 + 2 * MIN),
        T0 + 3 * HOUR,
    );
    assert_eq!(status(&c, "FUL-0001"), Status::ProofRejected);
}

// ---------------------------------------------------------------- disputes

fn paid_order(c: &mut Contract, bps: u16) {
    if bps > 0 {
        set(INTENTS, T0);
        c.mt_on_transfer(
            a(FUL),
            vec![a(FUL)],
            vec![USDC.into()],
            vec![U128(1_000_000)],
            r#"{"op":"bond"}"#.into(),
        );
    }
    let att = to_verifying(c, "FUL-0001");
    callback(
        c,
        "FUL-0001",
        att,
        good_output("FUL-0001", T0 + 2 * MIN),
        T0 + 4 * MIN,
    );
    assert_eq!(status(c, "FUL-0001"), Status::Paid);
}

#[test]
fn dispute_paid_buyer_wins_from_bond() {
    let mut c = new_contract(Some(|c: &mut Config| c.bond_per_job_bps = 1000));
    paid_order(&mut c, 1000);
    auth(
        &mut c,
        BUYER,
        T0 + HOUR,
        json!({"op":"dispute","order_id":"FUL-0001","reason_code":1}),
    );
    assert_eq!(status(&c, "FUL-0001"), Status::Disputed);
    set(ARBITER, T0 + 2 * HOUR);
    c.resolve_dispute("FUL-0001".into(), Verdict::Buyer, Some(MH.into()));
    assert_eq!(status(&c, "FUL-0001"), Status::Resolved);
    assert_eq!(mt_transfers(), vec![(BUYER.into(), USDC.into(), 210_000)]);
    let f = c.get_profile(a(FUL));
    assert_eq!(f.stats.disputes_lost, 1);
    assert_eq!((f.bond.available.0, f.bond.locked.0), (790_000, 0));
    assert_eq!(c.get_profile(a(BUYER)).stats.disputes_won, 1);
}

#[test]
fn dispute_paid_zero_bond_refunds_nothing() {
    let mut c = new_contract(None);
    paid_order(&mut c, 0);
    auth(
        &mut c,
        BUYER,
        T0 + HOUR,
        json!({"op":"dispute","order_id":"FUL-0001","reason_code":1}),
    );
    set(ARBITER, T0 + 2 * HOUR);
    c.resolve_dispute("FUL-0001".into(), Verdict::Buyer, None);
    assert!(mt_transfers().is_empty());
    assert_eq!(c.get_profile(a(FUL)).stats.disputes_lost, 1);
}

#[test]
#[should_panic(expected = "dispute not allowed")]
fn dispute_after_bond_hold() {
    let mut c = new_contract(None);
    paid_order(&mut c, 0);
    auth(
        &mut c,
        BUYER,
        T0 + 4 * MIN + 24 * HOUR,
        json!({"op":"dispute","order_id":"FUL-0001","reason_code":1}),
    );
}

#[test]
#[should_panic(expected = "dispute not allowed")]
fn dispute_by_stranger() {
    let mut c = new_contract(None);
    paid_order(&mut c, 0);
    auth(
        &mut c,
        FUL2,
        T0 + HOUR,
        json!({"op":"dispute","order_id":"FUL-0001","reason_code":1}),
    );
}

#[test]
#[should_panic(expected = "only arbiter")]
fn resolve_not_arbiter() {
    let mut c = new_contract(None);
    paid_order(&mut c, 0);
    auth(
        &mut c,
        BUYER,
        T0 + HOUR,
        json!({"op":"dispute","order_id":"FUL-0001","reason_code":1}),
    );
    set(OWNER, T0 + 2 * HOUR);
    c.resolve_dispute("FUL-0001".into(), Verdict::Buyer, None);
}

fn under_review(c: &mut Contract) {
    fund(c, "FUL-0001", T0);
    register(c, FUL);
    auth(c, FUL, T0, json!({"op":"claim","order_id":"FUL-0001"}));
    auth(c, FUL, T0 + MIN, json!({"op":"sent","order_id":"FUL-0001"}));
    set("anyone.test", T0 + 3 * HOUR);
    c.timeout("FUL-0001".into());
    assert_eq!(status(c, "FUL-0001"), Status::UnderReview);
}

#[test]
fn under_review_resolved_for_fulfiller() {
    let mut c = new_contract(None);
    under_review(&mut c);
    set(ARBITER, T0 + 4 * HOUR);
    c.resolve_dispute("FUL-0001".into(), Verdict::Fulfiller, None);
    assert_eq!(mt_transfers(), vec![(FUL.into(), USDC.into(), 2_100_000)]);
    assert_eq!(c.get_profile(a(FUL)).stats.jobs_done, 1);
    assert_eq!(c.get_profile(a(BUYER)).stats.open_as_buyer, 0);
}

#[test]
fn under_review_buyer_dispute_and_refund() {
    let mut c = new_contract(None);
    under_review(&mut c);
    auth(
        &mut c,
        BUYER,
        T0 + 4 * HOUR,
        json!({"op":"dispute","order_id":"FUL-0001","reason_code":2}),
    );
    set(ARBITER, T0 + 5 * HOUR);
    c.resolve_dispute("FUL-0001".into(), Verdict::Buyer, None);
    assert_eq!(mt_transfers(), vec![(BUYER.into(), USDC.into(), 2_100_000)]);
}

#[test]
fn under_review_split() {
    let mut c = new_contract(None);
    under_review(&mut c);
    set(ARBITER, T0 + 4 * HOUR);
    c.resolve_dispute("FUL-0001".into(), Verdict::Split, None);
    assert_eq!(
        mt_transfers(),
        vec![
            (BUYER.into(), USDC.into(), 1_050_000),
            (FUL.into(), USDC.into(), 1_050_000)
        ]
    );
}

#[test]
fn release_bond_after_hold() {
    let mut c = new_contract(Some(|c: &mut Config| c.bond_per_job_bps = 1000));
    paid_order(&mut c, 1000);
    set("anyone.test", T0 + 4 * MIN + 24 * HOUR);
    c.release_bond("FUL-0001".into());
    assert_eq!(status(&c, "FUL-0001"), Status::Closed);
    let b = c.get_profile(a(FUL)).bond;
    assert_eq!((b.available.0, b.locked.0), (1_000_000, 0));
}

#[test]
#[should_panic(expected = "bond hold not over")]
fn release_bond_too_early() {
    let mut c = new_contract(None);
    paid_order(&mut c, 0);
    set("anyone.test", T0 + HOUR);
    c.release_bond("FUL-0001".into());
}

// ---------------------------------------------------------------- ratings

#[test]
fn ratings_weighted_once_each() {
    let mut c = new_contract(None);
    paid_order(&mut c, 0);
    auth(
        &mut c,
        BUYER,
        T0 + HOUR,
        json!({"op":"rate","order_id":"FUL-0001","stars":5}),
    );
    auth(
        &mut c,
        FUL,
        T0 + HOUR,
        json!({"op":"rate","order_id":"FUL-0001","stars":4}),
    );
    // value 2.1 USDC -> weight 2
    let f = c.get_profile(a(FUL)).stats;
    assert_eq!((f.star_sum, f.star_count), (10, 2));
    let b = c.get_profile(a(BUYER)).stats;
    assert_eq!((b.star_sum, b.star_count), (8, 2));
}

#[test]
#[should_panic(expected = "already rated")]
fn rate_twice() {
    let mut c = new_contract(None);
    paid_order(&mut c, 0);
    auth(
        &mut c,
        BUYER,
        T0 + HOUR,
        json!({"op":"rate","order_id":"FUL-0001","stars":5}),
    );
    auth(
        &mut c,
        BUYER,
        T0 + HOUR,
        json!({"op":"rate","order_id":"FUL-0001","stars":1}),
    );
}

#[test]
#[should_panic(expected = "rating window over")]
fn rate_late() {
    let mut c = new_contract(None);
    paid_order(&mut c, 0);
    auth(
        &mut c,
        BUYER,
        T0 + 8 * 24 * HOUR,
        json!({"op":"rate","order_id":"FUL-0001","stars":5}),
    );
}

#[test]
#[should_panic(expected = "order not paid")]
fn rate_unfinished() {
    let mut c = new_contract(None);
    fund(&mut c, "FUL-0001", T0);
    auth(
        &mut c,
        BUYER,
        T0,
        json!({"op":"rate","order_id":"FUL-0001","stars":5}),
    );
}

#[test]
#[should_panic(expected = "stars must be 1..5")]
fn rate_bad_stars() {
    let mut c = new_contract(None);
    paid_order(&mut c, 0);
    auth(
        &mut c,
        BUYER,
        T0 + HOUR,
        json!({"op":"rate","order_id":"FUL-0001","stars":6}),
    );
}

#[test]
fn small_order_rating_has_no_weight() {
    let mut c = new_contract(None);
    set(INTENTS, T0);
    c.mt_on_transfer(
        a(BUYER),
        vec![a(BUYER)],
        vec![USDC.into()],
        vec![U128(500_000)],
        fund_msg("FUL-0001", 400_000, 100_000, T0 + HOUR),
    );
    register(&mut c, FUL);
    auth(
        &mut c,
        FUL,
        T0 + MIN,
        json!({"op":"claim","order_id":"FUL-0001"}),
    );
    auth(
        &mut c,
        FUL,
        T0 + 2 * MIN,
        json!({"op":"sent","order_id":"FUL-0001"}),
    );
    auth(
        &mut c,
        FUL,
        T0 + 3 * MIN,
        json!({"op":"submit_proof","order_id":"FUL-0001","proof_sha256":PROOF,"spec":spec()}),
    );
    callback(
        &mut c,
        "FUL-0001",
        1,
        good_output("FUL-0001", T0 + 2 * MIN),
        T0 + 4 * MIN,
    );
    auth(
        &mut c,
        BUYER,
        T0 + HOUR,
        json!({"op":"rate","order_id":"FUL-0001","stars":1}),
    );
    assert_eq!(c.get_profile(a(FUL)).stats.star_count, 0);
}

// ---------------------------------------------------------------- recount_rating

/// Mirrors mainnet FUL-892B4EF7: value 0.493701 USDC, paid.
fn small_paid_order(c: &mut Contract) {
    set(INTENTS, T0);
    c.mt_on_transfer(
        a(BUYER),
        vec![a(BUYER)],
        vec![USDC.into()],
        vec![U128(493_701)],
        fund_msg("FUL-0001", 393_701, 100_000, T0 + HOUR),
    );
    register(c, FUL);
    auth(
        c,
        FUL,
        T0 + MIN,
        json!({"op":"claim","order_id":"FUL-0001"}),
    );
    auth(
        c,
        FUL,
        T0 + 2 * MIN,
        json!({"op":"submit_proof","order_id":"FUL-0001","proof_sha256":PROOF,"spec":spec()}),
    );
    callback(
        c,
        "FUL-0001",
        1,
        good_output("FUL-0001", T0 + 2 * MIN),
        T0 + 4 * MIN,
    );
    assert_eq!(status(c, "FUL-0001"), Status::Paid);
}

fn rate(c: &mut Contract, who: &str, stars: u8) {
    auth(
        c,
        who,
        T0 + HOUR,
        json!({"op":"rate","order_id":"FUL-0001","stars":stars}),
    );
}

fn set_rating_unit(c: &mut Contract, unit: u128) {
    testing_env!(builder(OWNER, T0 + 2 * HOUR)
        .attached_deposit(NearToken::from_yoctonear(1))
        .build());
    let mut cfg = c.get_config();
    cfg.rating_unit = U128(unit);
    c.update_config(cfg);
}

fn recount(c: &mut Contract, ts: u64) -> Vec<String> {
    set("anyone.test", ts);
    c.recount_rating("FUL-0001".into());
    get_logs()
        .into_iter()
        .filter(|l| l.contains("\"rating_recounted\""))
        .collect()
}

fn stars(c: &Contract, who: &str) -> (u64, u64) {
    let s = c.get_profile(a(who)).stats;
    (s.star_sum, s.star_count)
}

#[test]
fn recount_after_rating_unit_lowered_is_idempotent() {
    let mut c = new_contract(None);
    small_paid_order(&mut c);
    rate(&mut c, BUYER, 5);
    rate(&mut c, FUL, 5);
    // weight 0 at rating_unit 1 USDC (the live mainnet state)
    assert_eq!(stars(&c, FUL), (0, 0));
    assert_eq!(stars(&c, BUYER), (0, 0));
    assert_eq!(c.get_rating_weights("FUL-0001".into()), (0, 0));
    set_rating_unit(&mut c, 100_000);
    let ev = recount(&mut c, T0 + 3 * HOUR);
    assert_eq!(ev.len(), 2, "{ev:?}");
    assert!(
        ev[0].contains(
            r#""by":"buyer.test","target":"ful.test","stars":5,"old_weight":0,"weight":4"#
        ),
        "{ev:?}"
    );
    assert!(
        ev[1].contains(r#""by":"ful.test","target":"buyer.test""#),
        "{ev:?}"
    );
    assert_eq!(stars(&c, FUL), (20, 4));
    assert_eq!(stars(&c, BUYER), (20, 4));
    assert_eq!(c.get_rating_weights("FUL-0001".into()), (4, 4));
    // second call: no-op, no event
    assert!(recount(&mut c, T0 + 4 * HOUR).is_empty());
    assert_eq!(stars(&c, FUL), (20, 4));
    assert_eq!(stars(&c, BUYER), (20, 4));
    // also allowed after the rating window and after Closed
    set("anyone.test", T0 + 25 * HOUR);
    c.release_bond("FUL-0001".into());
    assert!(recount(&mut c, T0 + 30 * 24 * HOUR).is_empty());
}

#[test]
fn recount_adds_only_the_delta() {
    let mut c = new_contract(None);
    paid_order(&mut c, 0); // 2.1 USDC
    rate(&mut c, BUYER, 5); // weight 2
    assert_eq!(stars(&c, FUL), (10, 2));
    assert_eq!(c.get_rating_weights("FUL-0001".into()), (2, 0));
    set_rating_unit(&mut c, 500_000); // weight 4
    let ev = recount(&mut c, T0 + 3 * HOUR);
    assert_eq!(ev.len(), 1, "only the rated side: {ev:?}");
    assert!(ev[0].contains(r#""old_weight":2,"weight":4"#), "{ev:?}");
    assert_eq!(stars(&c, FUL), (20, 4), "10 + 5*2, not 10 + 5*4");
    assert_eq!(stars(&c, BUYER), (0, 0));
    assert!(recount(&mut c, T0 + 3 * HOUR).is_empty());
    assert_eq!(stars(&c, FUL), (20, 4));
}

#[test]
fn recount_never_decreases() {
    let mut c = new_contract(Some(|c: &mut Config| c.rating_unit = U128(500_000)));
    paid_order(&mut c, 0);
    rate(&mut c, BUYER, 3); // weight 4
    assert_eq!(stars(&c, FUL), (12, 4));
    set_rating_unit(&mut c, 2_000_000); // weight 1
    assert!(recount(&mut c, T0 + 3 * HOUR).is_empty());
    assert_eq!(stars(&c, FUL), (12, 4));
    assert_eq!(c.get_rating_weights("FUL-0001".into()), (4, 0));
}

#[test]
fn rate_after_recount_stays_consistent() {
    let mut c = new_contract(None);
    small_paid_order(&mut c);
    rate(&mut c, BUYER, 5); // weight 0
    set_rating_unit(&mut c, 100_000);
    assert_eq!(recount(&mut c, T0 + 3 * HOUR).len(), 1);
    assert_eq!(stars(&c, FUL), (20, 4));
    // fulfiller rates now, at the current unit: weight 4 recorded by `rate`
    auth(
        &mut c,
        FUL,
        T0 + 3 * HOUR,
        json!({"op":"rate","order_id":"FUL-0001","stars":4}),
    );
    assert_eq!(stars(&c, BUYER), (16, 4));
    assert_eq!(c.get_rating_weights("FUL-0001".into()), (4, 4));
    // nothing left to recount: no double count
    assert!(recount(&mut c, T0 + 4 * HOUR).is_empty());
    assert_eq!(stars(&c, BUYER), (16, 4));
    assert_eq!(stars(&c, FUL), (20, 4));
}

#[test]
#[should_panic(expected = "not rated")]
fn recount_unrated() {
    let mut c = new_contract(None);
    paid_order(&mut c, 0);
    recount(&mut c, T0 + HOUR);
}

#[test]
#[should_panic(expected = "order not finished")]
fn recount_unfinished() {
    let mut c = new_contract(None);
    fund(&mut c, "FUL-0001", T0);
    recount(&mut c, T0 + HOUR);
}

#[test]
#[should_panic(expected = "order not found")]
fn recount_unknown_order() {
    let mut c = new_contract(None);
    recount(&mut c, T0 + HOUR);
}

#[test]
#[should_panic(expected = "order not finished")]
fn recount_disputed_order() {
    let mut c = new_contract(None);
    paid_order(&mut c, 0);
    rate(&mut c, BUYER, 5);
    auth(
        &mut c,
        BUYER,
        T0 + HOUR,
        json!({"op":"dispute","order_id":"FUL-0001","reason_code":1}),
    );
    recount(&mut c, T0 + 2 * HOUR);
}

#[test]
fn prune_clears_rating_weights() {
    let mut c = new_contract(None);
    paid_order(&mut c, 0);
    rate(&mut c, BUYER, 5);
    assert_eq!(c.get_rating_weights("FUL-0001".into()), (2, 0));
    set("anyone.test", T0 + 25 * HOUR);
    c.release_bond("FUL-0001".into());
    set("anyone.test", T0 + 25 * HOUR + 7 * 24 * HOUR);
    c.prune("FUL-0001".into());
    assert_eq!(c.get_rating_weights("FUL-0001".into()), (0, 0));
}

#[test]
fn level_rules() {
    let mut s = Stats::default();
    assert_eq!(level(&s), 0);
    s.jobs_done = 5;
    assert_eq!(level(&s), 1);
    s.disputes_lost = 1;
    assert_eq!(level(&s), 0);
    s.jobs_done = 21;
    assert_eq!(level(&s), 2);
    s.disputes_lost = 2;
    assert_eq!(level(&s), 0);
}

// ---------------------------------------------------------------- owed / prune / config

#[test]
fn failed_transfer_is_owed_and_retryable() {
    let mut c = new_contract(None);
    set_with_result(T0, PromiseResult::Failed);
    c.on_sent(a(BUYER), USDC.into(), U128(77));
    assert_eq!(c.get_owed(a(BUYER), USDC.into()).0, 77);
    set("anyone.test", T0);
    c.retry_owed(a(BUYER), USDC.into());
    assert_eq!(c.get_owed(a(BUYER), USDC.into()).0, 0);
    assert_eq!(mt_transfers(), vec![(BUYER.into(), USDC.into(), 77)]);
}

#[test]
fn successful_transfer_not_owed() {
    let mut c = new_contract(None);
    set_with_result(T0, PromiseResult::Successful(vec![]));
    c.on_sent(a(BUYER), USDC.into(), U128(77));
    assert_eq!(c.get_owed(a(BUYER), USDC.into()).0, 0);
}

#[test]
fn prune_after_window_keeps_id_and_nullifier() {
    let mut c = new_contract(None);
    paid_order(&mut c, 0);
    set("anyone.test", T0 + 25 * HOUR);
    c.release_bond("FUL-0001".into());
    set("anyone.test", T0 + 25 * HOUR + 7 * 24 * HOUR);
    c.prune("FUL-0001".into());
    assert!(c.get_order("FUL-0001".into()).is_none());
    assert!(c.orders_by_account(a(BUYER), None, None).is_empty());
    assert!(c.is_nullifier_used(TXREF.into()).is_some());
}

#[test]
#[should_panic(expected = "order id used")]
fn pruned_id_cannot_be_reused() {
    let mut c = new_contract(None);
    fund(&mut c, "FUL-0001", T0);
    auth(
        &mut c,
        BUYER,
        T0,
        json!({"op":"cancel","order_id":"FUL-0001"}),
    );
    fund(&mut c, "FUL-0001", T0 + MIN);
}

#[test]
#[should_panic(expected = "not finished")]
fn prune_active_order() {
    let mut c = new_contract(None);
    fund(&mut c, "FUL-0001", T0);
    set("anyone.test", T0 + 8 * 24 * HOUR);
    c.prune("FUL-0001".into());
}

#[test]
fn owner_updates_config() {
    let mut c = new_contract(None);
    testing_env!(builder(OWNER, T0)
        .attached_deposit(NearToken::from_yoctonear(1))
        .build());
    let mut cfg = c.get_config();
    cfg.paused = true;
    cfg.bond_per_job_bps = 500;
    c.update_config(cfg);
    let cfg = c.get_config();
    assert!(cfg.paused);
    assert_eq!(cfg.bond_per_job_bps, 500);
}

#[test]
fn update_config_cannot_remove_a_kind_with_orders() {
    let mut c = new_contract(None);
    fund(&mut c, "FUL-0001", T0);
    let mut config = c.get_config();
    config.kinds.remove("bank_transfer");
    config.paused = true;
    testing_env!(builder(OWNER, T0)
        .attached_deposit(NearToken::from_yoctonear(1))
        .build());
    c.update_config(config);
    assert!(c.get_kinds().contains_key("bank_transfer"));
    assert!(c.get_config().paused);
}

#[test]
#[should_panic(expected = "intents_contract and bond_token are immutable")]
fn update_config_cannot_move_intents() {
    let mut c = new_contract(None);
    testing_env!(builder(OWNER, T0)
        .attached_deposit(NearToken::from_yoctonear(1))
        .build());
    let mut cfg = c.get_config();
    cfg.intents_contract = a("other-intents.test");
    c.update_config(cfg);
}

#[test]
#[should_panic(expected = "only owner")]
fn update_config_not_owner() {
    let mut c = new_contract(None);
    testing_env!(builder(BUYER, T0)
        .attached_deposit(NearToken::from_yoctonear(1))
        .build());
    let cfg = c.get_config();
    c.update_config(cfg);
}

#[test]
#[should_panic(expected = "Requires attached deposit of exactly 1 yoctoNEAR")]
fn update_config_needs_yocto() {
    let mut c = new_contract(None);
    set(OWNER, T0);
    let cfg = c.get_config();
    c.update_config(cfg);
}

#[test]
#[should_panic(expected = "bps > 10000")]
fn config_validation() {
    new_contract(Some(|c: &mut Config| c.bond_per_job_bps = 10_001));
}

#[test]
fn list_orders_filters() {
    let mut c = new_contract(None);
    fund(&mut c, "FUL-0001", T0);
    fund(&mut c, "FUL-0002", T0);
    auth(
        &mut c,
        BUYER,
        T0,
        json!({"op":"cancel","order_id":"FUL-0001"}),
    );
    assert_eq!(c.list_orders(None, None, None, None).len(), 1);
    let funded = c.list_orders(Some(Status::Funded), None, None, None);
    assert_eq!(funded.len(), 1);
    assert_eq!(funded[0].id, "FUL-0002");
}

#[test]
fn note_normalised_matching() {
    // review #12: both sides uppercased, everything but [A-Z0-9] removed
    assert!(note_has_id("ful-0001 cam on", "FUL-0001"));
    assert!(note_has_id("Chuyen tien FUL-0001.", "FUL-0001"));
    assert!(note_has_id("Thanh toán FUL-0001 đơn", "FUL-0001"));
    assert!(note_has_id("FUL0001", "FUL-0001"));
    assert!(note_has_id("ful 0001", "FUL-0001"));
    assert!(note_has_id(
        "NGUYEN VAN A chuyen tien-FUL.0001-",
        "FUL-0001"
    ));
    assert!(note_has_id("FUL-0001", "ful0001"));
    assert!(!note_has_id("FUL-0002", "FUL-0001"));
    assert!(!note_has_id("FUL-001", "FUL-0001"));
    assert!(!note_has_id("", "FUL-0001"));
    assert!(!note_has_id("anything", "---"));
}

// ---------------------------------------------------------------- relayer submit_proof

fn sent_order(c: &mut Contract) {
    fund(c, "FUL-0001", T0);
    register(c, FUL);
    auth(
        c,
        FUL,
        T0 + MIN,
        json!({"op":"claim","order_id":"FUL-0001"}),
    );
    auth(
        c,
        FUL,
        T0 + 2 * MIN,
        json!({"op":"sent","order_id":"FUL-0001"}),
    );
}

#[test]
fn relayer_submit_proof_pays_fulfiller() {
    let mut c = new_contract(None);
    sent_order(&mut c);
    set("relayer.test", T0 + 3 * MIN);
    c.submit_proof("FUL-0001".into(), PROOF.into(), spec());
    assert_eq!(status(&c, "FUL-0001"), Status::Verifying);
    assert!(calls()
        .iter()
        .any(|(to, m, _, _)| to == OUTLAYER && m == "request_execution"));
    callback(
        &mut c,
        "FUL-0001",
        1,
        good_output("FUL-0001", T0 + 2 * MIN),
        T0 + 4 * MIN,
    );
    assert_eq!(mt_transfers(), vec![(FUL.into(), USDC.into(), 2_100_000)]);
}

#[test]
#[should_panic(expected = "only relayer")]
fn submit_proof_direct_not_relayer() {
    let mut c = new_contract(None);
    sent_order(&mut c);
    set(FUL, T0 + 3 * MIN);
    c.submit_proof("FUL-0001".into(), PROOF.into(), spec());
}

#[test]
#[should_panic(expected = "not awaiting proof")]
fn relayer_submit_proof_wrong_state() {
    let mut c = new_contract(None);
    fund(&mut c, "FUL-0001", T0);
    set("relayer.test", T0 + 3 * MIN);
    c.submit_proof("FUL-0001".into(), PROOF.into(), spec());
}

#[test]
#[should_panic(expected = "no attempts left")]
fn relayer_submit_proof_attempt_limit() {
    let mut c = new_contract(None);
    sent_order(&mut c);
    let mut bad = good_output("FUL-0001", T0);
    bad["ok"] = json!(false);
    for att in 1..=3u8 {
        set("relayer.test", T0 + 3 * MIN);
        c.submit_proof("FUL-0001".into(), PROOF.into(), spec());
        callback(&mut c, "FUL-0001", att, bad.clone(), T0 + 4 * MIN);
    }
    // the 3rd rejection moved the order to UnderReview
    assert_eq!(status(&c, "FUL-0001"), Status::UnderReview);
    // force the state back to exercise the attempt guard itself
    let mut o = c.order("FUL-0001");
    o.status = Status::ProofRejected;
    c.save(o);
    set("relayer.test", T0 + 5 * MIN);
    c.submit_proof("FUL-0001".into(), PROOF.into(), spec());
}

// ---------------------------------------------------------------- review fixes (2026-11-07)

// #1 fulfiller approval

#[test]
#[should_panic(expected = "fulfiller not approved")]
fn claim_unapproved_fulfiller() {
    let mut c = new_contract(None);
    assert!(
        matches!(c.get_kinds()["bank_transfer"].access, Access::Named(ref s) if s == "approved"),
        "default on"
    );
    fund(&mut c, "FUL-0001", T0);
    register_only(&mut c, FUL);
    auth(&mut c, FUL, T0, json!({"op":"claim","order_id":"FUL-0001"}));
}

#[test]
#[should_panic(expected = "fulfiller not approved")]
fn claim_after_approval_revoked() {
    let mut c = new_contract(None);
    fund(&mut c, "FUL-0001", T0);
    register(&mut c, FUL);
    approve(&mut c, FUL, false);
    auth(&mut c, FUL, T0, json!({"op":"claim","order_id":"FUL-0001"}));
}

#[test]
fn claim_unapproved_ok_when_flag_off() {
    let mut c = new_contract(Some(|c: &mut Config| {
        c.kinds.get_mut("bank_transfer").unwrap().access = Access::Named("open".into())
    }));
    fund(&mut c, "FUL-0001", T0);
    register_only(&mut c, FUL);
    auth(&mut c, FUL, T0, json!({"op":"claim","order_id":"FUL-0001"}));
    assert_eq!(status(&c, "FUL-0001"), Status::Claimed);
}

#[test]
fn approval_shown_in_profile_and_reset_by_new_bank_details() {
    let mut c = new_contract(None);
    register_only(&mut c, FUL);
    assert!(!c.get_profile(a(FUL)).approved);
    approve(&mut c, FUL, true);
    assert!(c.get_profile(a(FUL)).approved);
    assert!(get_logs().iter().any(|l| l.contains("fulfiller_approved")));
    register_only(&mut c, FUL); // same details: stays approved
    assert!(c.get_profile(a(FUL)).approved);
    auth(
        &mut c,
        FUL,
        T0,
        json!({"op":"register_fulfiller","bank_bin":"970436","account_last4":"9999"}),
    );
    assert!(!c.get_profile(a(FUL)).approved);
}

#[test]
#[should_panic(expected = "only owner")]
fn approve_not_owner() {
    let mut c = new_contract(None);
    testing_env!(builder(ARBITER, T0)
        .attached_deposit(NearToken::from_yoctonear(1))
        .build());
    c.approve_fulfiller(a(FUL), true);
}

#[test]
#[should_panic(expected = "Requires attached deposit of exactly 1 yoctoNEAR")]
fn approve_needs_yocto() {
    let mut c = new_contract(None);
    set(OWNER, T0);
    c.approve_fulfiller(a(FUL), true);
}

// #8 payout booking

#[test]
fn oversized_success_result_is_not_owed() {
    let mut c = new_contract(None);
    fund(&mut c, "FUL-0001", T0);
    set_with_result(T0, PromiseResult::Successful(vec![b'x'; 4096]));
    c.on_sent(a(BUYER), USDC.into(), U128(2_100_000));
    assert_eq!(c.get_owed(a(BUYER), USDC.into()).0, 0);
    assert_eq!(c.get_liabilities(USDC.into()).0, 0);
    assert!(!get_logs().iter().any(|l| l.contains("transfer_failed")));
}

#[test]
fn retry_owed_cannot_pay_twice() {
    let mut c = new_contract(None);
    set_with_result(T0, PromiseResult::Failed);
    c.on_sent(a(BUYER), USDC.into(), U128(77));
    set("anyone.test", T0);
    c.retry_owed(a(BUYER), USDC.into());
    // cleared before the promise: a second retry has nothing to send
    assert_eq!(c.get_owed(a(BUYER), USDC.into()).0, 0);
    set("anyone.test", T0);
    let again = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        c.retry_owed(a(BUYER), USDC.into())
    }));
    assert!(again.is_err(), "second retry must fail");
    // retry succeeded (with a return value): still nothing owed
    set_with_result(T0, PromiseResult::Successful(b"\"ok\"".to_vec()));
    c.on_sent(a(BUYER), USDC.into(), U128(77));
    assert_eq!(c.get_owed(a(BUYER), USDC.into()).0, 0);
    // retry failed: restored exactly once
    set_with_result(T0, PromiseResult::Failed);
    c.on_sent(a(BUYER), USDC.into(), U128(77));
    assert_eq!(c.get_owed(a(BUYER), USDC.into()).0, 77);
}

// #9 proof from Claimed

#[test]
fn proof_from_claimed_marks_sent() {
    let mut c = new_contract(None);
    fund(&mut c, "FUL-0001", T0);
    register(&mut c, FUL);
    auth(
        &mut c,
        FUL,
        T0 + MIN,
        json!({"op":"claim","order_id":"FUL-0001"}),
    );
    auth(
        &mut c,
        FUL,
        T0 + 20 * MIN, // past claim_timeout, but nobody called timeout()
        json!({"op":"submit_proof","order_id":"FUL-0001","proof_sha256":PROOF,"spec":spec()}),
    );
    let o = c.get_order("FUL-0001".into()).unwrap();
    assert_eq!(o.status, Status::Verifying);
    assert_eq!(o.sent_at, Some(U64(T0 + 20 * MIN)));
    assert!(get_logs().iter().any(|l| l.contains("order_sent")));
    callback(
        &mut c,
        "FUL-0001",
        1,
        good_output("FUL-0001", T0 + 5 * MIN),
        T0 + 21 * MIN,
    );
    assert_eq!(status(&c, "FUL-0001"), Status::Paid);
}

#[test]
fn needs_sent_kind_requires_explicit_sent() {
    let mut c = new_contract(None);
    let mut kind = c.get_kinds()["bank_transfer"].clone();
    kind.access = Access::Named("open".into());
    kind.needs_sent = true;
    c.config.kinds.insert("other".into(), kind);
    fund_kind(&mut c, "FUL-0001", "other", T0);
    register_only(&mut c, FUL);
    auth(&mut c, FUL, T0, json!({"op":"claim","order_id":"FUL-0001"}));
    assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        auth(
            &mut c,
            FUL,
            T0 + MIN,
            json!({"op":"submit_proof","order_id":"FUL-0001","proof_sha256":PROOF,"spec":spec()}),
        );
    }))
    .is_err());
    assert_eq!(status(&c, "FUL-0001"), Status::Claimed);
    auth(
        &mut c,
        FUL,
        T0 + MIN,
        json!({"op":"sent","order_id":"FUL-0001"}),
    );
    auth(
        &mut c,
        FUL,
        T0 + MIN,
        json!({"op":"submit_proof","order_id":"FUL-0001","proof_sha256":PROOF,"spec":spec()}),
    );
    assert_eq!(status(&c, "FUL-0001"), Status::Verifying);
}

#[test]
fn no_sent_kind_verifies_directly_without_sent_event() {
    let mut c = new_contract(None);
    let mut kind = c.get_kinds()["bank_transfer"].clone();
    kind.access = Access::Named("open".into());
    kind.needs_sent = false;
    c.config.kinds.insert("other".into(), kind);
    fund_kind(&mut c, "FUL-0001", "other", T0);
    register_only(&mut c, FUL);
    auth(&mut c, FUL, T0, json!({"op":"claim","order_id":"FUL-0001"}));
    auth(
        &mut c,
        FUL,
        T0 + MIN,
        json!({"op":"submit_proof","order_id":"FUL-0001","proof_sha256":PROOF,"spec":spec()}),
    );
    let o = c.get_order("FUL-0001".into()).unwrap();
    assert_eq!(o.status, Status::Verifying);
    assert_eq!(o.sent_at, Some(U64(T0 + MIN)));
    assert!(!get_logs().iter().any(|line| line.contains("order_sent")));
}

#[test]
fn disabling_kind_does_not_strand_funded_order() {
    let mut c = new_contract(None);
    fund(&mut c, "FUL-0001", T0);
    c.config.kinds.get_mut("bank_transfer").unwrap().enabled = false;
    register(&mut c, FUL);
    auth(&mut c, FUL, T0, json!({"op":"claim","order_id":"FUL-0001"}));
    auth(
        &mut c,
        FUL,
        T0 + MIN,
        json!({"op":"submit_proof","order_id":"FUL-0001","proof_sha256":PROOF,"spec":spec()}),
    );
    callback(
        &mut c,
        "FUL-0001",
        1,
        good_output("FUL-0001", T0 + MIN),
        T0 + 2 * MIN,
    );
    assert_eq!(status(&c, "FUL-0001"), Status::Paid);
}

#[test]
fn relayer_proof_from_claimed() {
    let mut c = new_contract(None);
    fund(&mut c, "FUL-0001", T0);
    register(&mut c, FUL);
    auth(
        &mut c,
        FUL,
        T0 + MIN,
        json!({"op":"claim","order_id":"FUL-0001"}),
    );
    set("relayer.test", T0 + 2 * MIN);
    c.submit_proof("FUL-0001".into(), PROOF.into(), spec());
    assert_eq!(status(&c, "FUL-0001"), Status::Verifying);
}

#[test]
#[should_panic(expected = "nothing to time out")]
fn claim_timeout_skips_proof_in_flight() {
    let mut c = new_contract(None);
    fund(&mut c, "FUL-0001", T0);
    register(&mut c, FUL);
    auth(&mut c, FUL, T0, json!({"op":"claim","order_id":"FUL-0001"}));
    auth(
        &mut c,
        FUL,
        T0 + 14 * MIN,
        json!({"op":"submit_proof","order_id":"FUL-0001","proof_sha256":PROOF,"spec":spec()}),
    );
    set("anyone.test", T0 + 16 * MIN);
    c.timeout("FUL-0001".into());
}

#[test]
fn rejected_proof_from_claimed_is_never_unclaimed() {
    let mut c = new_contract(None);
    fund(&mut c, "FUL-0001", T0);
    register(&mut c, FUL);
    auth(&mut c, FUL, T0, json!({"op":"claim","order_id":"FUL-0001"}));
    auth(
        &mut c,
        FUL,
        T0 + MIN,
        json!({"op":"submit_proof","order_id":"FUL-0001","proof_sha256":PROOF,"spec":spec()}),
    );
    let mut bad = good_output("FUL-0001", T0);
    bad["ok"] = json!(false);
    callback(&mut c, "FUL-0001", 1, bad, T0 + 2 * MIN);
    set("anyone.test", T0 + MIN + 2 * HOUR);
    c.timeout("FUL-0001".into());
    let o = c.get_order("FUL-0001".into()).unwrap();
    assert_eq!(o.status, Status::UnderReview);
    assert_eq!(o.fulfiller, Some(a(FUL)));
}

// #11 worker output bound to input

#[test]
fn reject_missing_order_id_echo() {
    let mut out = good_output("FUL-0001", T0);
    out.as_object_mut().unwrap().remove("order_id");
    assert_rejected(out, "order id mismatch");
}

#[test]
fn reject_other_order_id_echo() {
    let mut out = good_output("FUL-0001", T0);
    out["order_id"] = json!("FUL-0002");
    assert_rejected(out, "order id mismatch");
}

#[test]
fn reject_missing_proof_echo() {
    let mut out = good_output("FUL-0001", T0);
    out.as_object_mut().unwrap().remove("proof_sha256");
    assert_rejected(out, "proof hash mismatch");
}

#[test]
fn reject_other_proof_echo() {
    let mut out = good_output("FUL-0001", T0);
    out["proof_sha256"] = json!(MH);
    assert_rejected(out, "proof hash mismatch");
}

#[test]
fn uppercase_proof_echo_accepted() {
    let mut c = new_contract(None);
    let att = to_verifying(&mut c, "FUL-0001");
    let mut out = good_output("FUL-0001", T0 + 2 * MIN);
    out["proof_sha256"] = json!(PROOF.to_ascii_uppercase());
    callback(&mut c, "FUL-0001", att, out, T0 + 4 * MIN);
    assert_eq!(status(&c, "FUL-0001"), Status::Paid);
}

// #12 note normalisation end to end

#[test]
fn mangled_note_accepted() {
    let mut c = new_contract(None);
    let att = to_verifying(&mut c, "FUL-0001");
    let mut out = good_output("FUL-0001", T0 + 2 * MIN);
    out["note"] = json!("NGUYEN VAN A CHUYEN KHOAN FUL0001");
    callback(&mut c, "FUL-0001", att, out, T0 + 4 * MIN);
    assert_eq!(status(&c, "FUL-0001"), Status::Paid);
}

// #14 dispute window, sweep

#[test]
#[should_panic(expected = "dispute not allowed")]
fn dispute_verified_after_hold() {
    let mut c = new_contract(Some(|c: &mut Config| c.challenge_window_ns = U64(HOUR)));
    let att = to_verifying(&mut c, "FUL-0001");
    callback(
        &mut c,
        "FUL-0001",
        att,
        good_output("FUL-0001", T0 + 2 * MIN),
        T0 + 4 * MIN,
    );
    assert_eq!(status(&c, "FUL-0001"), Status::Verified);
    auth(
        &mut c,
        BUYER,
        T0 + 4 * MIN + HOUR + 24 * HOUR,
        json!({"op":"dispute","order_id":"FUL-0001","reason_code":1}),
    );
}

#[test]
fn dispute_verified_within_window() {
    let mut c = new_contract(Some(|c: &mut Config| c.challenge_window_ns = U64(HOUR)));
    let att = to_verifying(&mut c, "FUL-0001");
    callback(
        &mut c,
        "FUL-0001",
        att,
        good_output("FUL-0001", T0 + 2 * MIN),
        T0 + 4 * MIN,
    );
    auth(
        &mut c,
        BUYER,
        T0 + 2 * HOUR,
        json!({"op":"dispute","order_id":"FUL-0001","reason_code":1}),
    );
    assert_eq!(status(&c, "FUL-0001"), Status::Disputed);
}

#[test]
fn liabilities_track_orders_and_bonds() {
    let mut c = new_contract(None);
    fund(&mut c, "FUL-0001", T0);
    set(INTENTS, T0);
    c.mt_on_transfer(
        a(FUL),
        vec![a(FUL)],
        vec![USDC.into()],
        vec![U128(500)],
        r#"{"op":"bond"}"#.into(),
    );
    assert_eq!(c.get_liabilities(USDC.into()).0, 2_100_500);
    // failed payout stays a liability (it is in `owed`)
    set_with_result(T0, PromiseResult::Failed);
    c.on_sent(a(FUL), USDC.into(), U128(2_100_000));
    assert_eq!(c.get_liabilities(USDC.into()).0, 2_100_500);
    set_with_result(T0, PromiseResult::Successful(vec![]));
    c.on_sent(a(FUL), USDC.into(), U128(2_100_000));
    assert_eq!(c.get_liabilities(USDC.into()).0, 500);
}

#[test]
fn sweep_queries_balance() {
    let mut c = new_contract(None);
    testing_env!(builder(OWNER, T0)
        .attached_deposit(NearToken::from_yoctonear(1))
        .build());
    c.sweep(USDC.into(), U128(10), a(OWNER));
    let cs = calls();
    assert!(cs.iter().any(|(to, m, args, _)| to == INTENTS
        && m == "mt_balance_of"
        && args["account_id"] == ESCROW
        && args["token_id"] == USDC));
    assert!(cs.iter().any(|(_, m, _, _)| m == "on_sweep_balance"));
}

#[test]
fn sweep_sends_only_stray_tokens() {
    let mut c = new_contract(None);
    fund(&mut c, "FUL-0001", T0);
    // escrow holds 2_100_000 for the order + 100_000 stray
    set_with_result(T0, PromiseResult::Successful(b"\"2200000\"".to_vec()));
    c.on_sweep_balance(USDC.into(), U128(100_000), a(OWNER));
    assert_eq!(mt_transfers(), vec![(OWNER.into(), USDC.into(), 100_000)]);
    // in flight: counted until confirmed, so it cannot be swept twice
    assert_eq!(c.get_liabilities(USDC.into()).0, 2_200_000);
    set_with_result(T0, PromiseResult::Successful(b"\"2200000\"".to_vec()));
    let again = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        c.on_sweep_balance(USDC.into(), U128(1), a(OWNER))
    }));
    assert!(again.is_err());
}

#[test]
#[should_panic(expected = "amount exceeds stray balance")]
fn sweep_cannot_touch_order_funds() {
    let mut c = new_contract(None);
    fund(&mut c, "FUL-0001", T0);
    set_with_result(T0, PromiseResult::Successful(b"\"2200000\"".to_vec()));
    c.on_sweep_balance(USDC.into(), U128(100_001), a(OWNER));
}

#[test]
#[should_panic(expected = "only owner")]
fn sweep_not_owner() {
    let mut c = new_contract(None);
    testing_env!(builder(ARBITER, T0)
        .attached_deposit(NearToken::from_yoctonear(1))
        .build());
    c.sweep(USDC.into(), U128(10), a(ARBITER));
}

#[test]
fn redteam_cancel_cannot_race_verification_or_payout() {
    let mut c = new_contract(None);
    fund(&mut c, "FUL-RACE1", T0);
    register(&mut c, FUL);
    claim_as(&mut c, FUL, "FUL-RACE1", T0);
    auth(
        &mut c,
        FUL,
        T0,
        json!({"op":"submit_proof","order_id":"FUL-RACE1","proof_sha256":PROOF,"spec":spec()}),
    );
    assert_eq!(status(&c, "FUL-RACE1"), Status::Verifying);
    let args = scheduled_verify_args();
    let attempted = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        auth(
            &mut c,
            BUYER,
            T0,
            json!({"op":"cancel","order_id":"FUL-RACE1"}),
        )
    }));
    assert!(attempted.is_err());
    assert_eq!(status(&c, "FUL-RACE1"), Status::Verifying);
    callback_from_args(&mut c, &args, good_output("FUL-RACE1", T0), T0);
    assert_eq!(status(&c, "FUL-RACE1"), Status::Paid);
    assert_eq!(mt_transfers(), vec![(FUL.into(), USDC.into(), 2_100_000)]);
    let attempted = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        auth(
            &mut c,
            BUYER,
            T0,
            json!({"op":"cancel","order_id":"FUL-RACE1"}),
        )
    }));
    assert!(attempted.is_err());
    assert_eq!(status(&c, "FUL-RACE1"), Status::Paid);
}

#[test]
fn redteam_failed_refund_is_owed_once_and_id_remains_used() {
    let mut c = new_contract(None);
    fund(&mut c, "FUL-REFUND", T0);
    auth(
        &mut c,
        BUYER,
        T0,
        json!({"op":"cancel","order_id":"FUL-REFUND"}),
    );
    assert!(c.get_order("FUL-REFUND".into()).is_none());
    assert_eq!(mt_transfers(), vec![(BUYER.into(), USDC.into(), 2_100_000)]);
    set_with_result(T0, PromiseResult::Failed);
    c.on_sent(a(BUYER), USDC.into(), U128(2_100_000));
    assert_eq!(c.get_owed(a(BUYER), USDC.into()).0, 2_100_000);
    set(OWNER, T0);
    c.retry_owed(a(BUYER), USDC.into());
    assert_eq!(c.get_owed(a(BUYER), USDC.into()).0, 0);
    let attempted = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        c.retry_owed(a(BUYER), USDC.into())
    }));
    assert!(attempted.is_err());
    assert!(c.used_ids.contains("FUL-REFUND"));
}

#[test]
fn redteam_released_claim_can_expire_after_original_deadline() {
    let mut c = new_contract(None);
    fund(&mut c, "FUL-LOCKUP", T0);
    register(&mut c, FUL);
    claim_as(&mut c, FUL, "FUL-LOCKUP", T0);
    auth(
        &mut c,
        FUL,
        T0 + MIN,
        json!({"op":"release_claim","order_id":"FUL-LOCKUP"}),
    );
    set(OWNER, T0 + 24 * HOUR);
    c.expire("FUL-LOCKUP".into());
    assert!(c.get_order("FUL-LOCKUP".into()).is_none());
    assert_eq!(mt_transfers(), vec![(BUYER.into(), USDC.into(), 2_100_000)]);
}

#[test]
fn vuln_buyer_cannot_pin_quote_to_unregistered_account() {
    let mut c = new_contract(None);
    let msg = json!({"op":"fund","order":{"id":"FUL-PIN01","kind":"bank_transfer",
        "spec_hash":sha256_hex(spec().as_bytes()),"pay_amount":"2000000","reward":"100000",
        "deadline_ns":(T0 + HOUR).to_string(),"quoted_by":BUYER}});
    set(INTENTS, T0);
    assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        c.mt_on_transfer(
            a(BUYER),
            vec![a(BUYER)],
            vec![USDC.into()],
            vec![U128(2_100_000)],
            msg.to_string(),
        );
    }))
    .is_err());
    assert!(c.get_order("FUL-PIN01".into()).is_none());
}

#[test]
fn vuln_unpaid_resolved_order_cannot_be_rated() {
    let mut c = new_contract(None);
    fund(&mut c, "FUL-UNPAID", T0);
    register(&mut c, FUL);
    claim_as(&mut c, FUL, "FUL-UNPAID", T0);
    c.orders.get_mut("FUL-UNPAID").unwrap().status = Status::UnderReview;
    set(ARBITER, T0);
    c.resolve_dispute("FUL-UNPAID".into(), Verdict::Buyer, None);
    assert!(c.get_order("FUL-UNPAID".into()).unwrap().paid_at.is_none());
    assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        auth(
            &mut c,
            BUYER,
            T0,
            json!({"op":"rate","order_id":"FUL-UNPAID","stars":5}),
        );
    }))
    .is_err());
    assert_eq!(c.get_order("FUL-UNPAID".into()).unwrap().buyer_rating, None);
}

#[test]
fn vuln_registration_rejects_when_storage_reserve_is_exhausted() {
    let mut c = new_contract(None);
    testing_env!(builder(INTENTS, T0)
        .account_balance(NearToken::from_yoctonear(0))
        .build());
    assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        c.on_auth(a(FUL), json!({"op":"register_fulfiller"}).to_string());
    }))
    .is_err());
    assert!(c.get_profile(a(FUL)).profile.is_none());
}

#[test]
fn vuln_proof_after_order_deadline_is_rejected() {
    let mut c = new_contract(None);
    fund(&mut c, "FUL-LATE01", T0);
    register(&mut c, FUL);
    claim_as(&mut c, FUL, "FUL-LATE01", T0 + 24 * HOUR - MIN);
    assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        auth(
            &mut c,
            FUL,
            T0 + 24 * HOUR + MIN,
            json!({"op":"submit_proof","order_id":"FUL-LATE01","proof_sha256":PROOF,"spec":spec()}),
        );
    }))
    .is_err());
    assert_ne!(status(&c, "FUL-LATE01"), Status::Verifying);
}

#[test]
fn proof_before_deadline_can_settle_after_it() {
    let mut c = new_contract(None);
    fund(&mut c, "FUL-EDGE01", T0);
    register(&mut c, FUL);
    claim_as(&mut c, FUL, "FUL-EDGE01", T0 + 24 * HOUR - MIN);
    auth(
        &mut c,
        FUL,
        T0 + 24 * HOUR - 1,
        json!({"op":"submit_proof","order_id":"FUL-EDGE01","proof_sha256":PROOF,"spec":spec()}),
    );
    assert_eq!(status(&c, "FUL-EDGE01"), Status::Verifying);
    callback(
        &mut c,
        "FUL-EDGE01",
        1,
        good_output("FUL-EDGE01", T0 + 24 * HOUR - 1),
        T0 + 24 * HOUR + MIN,
    );
    assert_eq!(status(&c, "FUL-EDGE01"), Status::Paid);
}

#[test]
fn proof_at_deadline_is_rejected() {
    let mut c = new_contract(None);
    fund(&mut c, "FUL-EDGE07", T0);
    register(&mut c, FUL);
    claim_as(&mut c, FUL, "FUL-EDGE07", T0 + 24 * HOUR - MIN);
    assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        auth(
            &mut c,
            FUL,
            T0 + 24 * HOUR,
            json!({"op":"submit_proof","order_id":"FUL-EDGE07","proof_sha256":PROOF,"spec":spec()}),
        );
    }))
    .is_err());
    assert_eq!(status(&c, "FUL-EDGE07"), Status::Claimed);
}

#[test]
fn deadline_refund_unlocks_bond_without_slash() {
    let mut c = new_contract(Some(|config: &mut Config| {
        config.bond_per_job_bps = 1_000;
    }));
    fund(&mut c, "FUL-EDGE08", T0);
    register(&mut c, FUL);
    set(INTENTS, T0);
    c.mt_on_transfer(
        a(FUL),
        vec![a(FUL)],
        vec![USDC.into()],
        vec![U128(500_000)],
        r#"{"op":"bond"}"#.into(),
    );
    claim_as(&mut c, FUL, "FUL-EDGE08", T0);
    assert_eq!(c.get_profile(a(FUL)).bond.locked.0, 210_000);
    set("anyone.test", T0 + 24 * HOUR);
    c.expire("FUL-EDGE08".into());
    let bond = c.get_profile(a(FUL)).bond;
    assert_eq!(bond.locked.0, 0);
    assert_eq!(bond.available.0, 500_000);
    assert_eq!(mt_transfers(), vec![(BUYER.into(), USDC.into(), 2_100_000)]);
}

#[test]
fn claim_and_proof_windows_end_at_deadline() {
    let mut c = new_contract(None);
    fund(&mut c, "FUL-EDGE02", T0);
    register(&mut c, FUL);
    claim_as(&mut c, FUL, "FUL-EDGE02", T0 + 24 * HOUR - MIN);
    let rejected = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        auth(
            &mut c,
            FUL,
            T0 + 24 * HOUR,
            json!({"op":"sent","order_id":"FUL-EDGE02"}),
        );
    }));
    assert!(rejected.is_err());
    set("anyone.test", T0 + 24 * HOUR);
    c.timeout("FUL-EDGE02".into());
    assert!(c.get_order("FUL-EDGE02".into()).is_none());
    assert_eq!(mt_transfers(), vec![(BUYER.into(), USDC.into(), 2_100_000)]);
}

#[test]
fn deadline_sent_and_rejected_require_arbiter() {
    for (id, rejected, verdict) in [
        ("FUL-EDGE03", false, Verdict::Buyer),
        ("FUL-EDGE06", true, Verdict::Fulfiller),
    ] {
        let mut c = new_contract(None);
        fund(&mut c, id, T0);
        register(&mut c, FUL);
        claim_as(&mut c, FUL, id, T0);
        auth(&mut c, FUL, T0 + MIN, json!({"op":"sent","order_id":id}));
        if rejected {
            auth(
                &mut c,
                FUL,
                T0 + 2 * MIN,
                json!({"op":"submit_proof","order_id":id,"proof_sha256":PROOF,"spec":spec()}),
            );
            let args = scheduled_verify_args();
            callback_from_args(&mut c, &args, json!({"ok":false}), T0 + 3 * MIN);
            assert_eq!(status(&c, id), Status::ProofRejected);
        }
        set("anyone.test", T0 + 24 * HOUR);
        assert_panics_with("not refundable", || c.expire(id.into()));
        c.timeout(id.into());
        assert_eq!(status(&c, id), Status::UnderReview);
        assert_eq!(c.get_profile(a(BUYER)).stats.open_as_buyer, 1);
        assert_eq!(c.get_profile(a(FUL)).stats.active_claims, 1);
        set(ARBITER, T0 + 24 * HOUR);
        c.resolve_dispute(id.into(), verdict, None);
        assert_eq!(status(&c, id), Status::Resolved);
        assert_eq!(c.get_profile(a(BUYER)).stats.open_as_buyer, 0);
        assert_eq!(c.get_profile(a(FUL)).stats.active_claims, 0);
        let receiver = if verdict == Verdict::Buyer {
            BUYER
        } else {
            FUL
        };
        assert_eq!(
            mt_transfers(),
            vec![(receiver.into(), USDC.into(), 2_100_000)]
        );
    }
}

#[test]
fn verification_without_callback_goes_under_review() {
    let mut c = new_contract(None);
    fund(&mut c, "FUL-EDGE05", T0);
    register(&mut c, FUL);
    claim_as(&mut c, FUL, "FUL-EDGE05", T0 + 24 * HOUR - MIN);
    auth(
        &mut c,
        FUL,
        T0 + 24 * HOUR - 1,
        json!({"op":"submit_proof","order_id":"FUL-EDGE05","proof_sha256":PROOF,"spec":spec()}),
    );
    let args = scheduled_verify_args();
    set("anyone.test", T0 + 24 * HOUR);
    assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(
        || c.expire("FUL-EDGE05".into())
    ))
    .is_err());
    set("anyone.test", T0 + 26 * HOUR);
    assert_panics_with("not refundable", || c.expire("FUL-EDGE05".into()));
    c.timeout("FUL-EDGE05".into());
    assert_eq!(status(&c, "FUL-EDGE05"), Status::UnderReview);
    assert_eq!(c.get_profile(a(BUYER)).stats.open_as_buyer, 1);
    assert_eq!(c.get_profile(a(FUL)).stats.active_claims, 1);
    assert!(mt_transfers().is_empty());
    callback_from_args(
        &mut c,
        &args,
        good_output("FUL-EDGE05", T0 + 24 * HOUR - 1),
        T0 + 26 * HOUR + MIN,
    );
    assert!(mt_transfers().is_empty());
    assert_eq!(status(&c, "FUL-EDGE05"), Status::UnderReview);
    assert_eq!(c.is_nullifier_used(TXREF.into()), None);
    set(ARBITER, T0 + 26 * HOUR + MIN);
    c.resolve_dispute("FUL-EDGE05".into(), Verdict::Fulfiller, None);
    assert_eq!(mt_transfers(), vec![(FUL.into(), USDC.into(), 2_100_000)]);
}

#[test]
fn quote_requires_registered_eligible_fulfiller() {
    let mut c = new_contract(None);
    let msg = json!({"op":"fund","order":{"id":"FUL-QUOTE1","kind":"bank_transfer",
        "spec_hash":sha256_hex(spec().as_bytes()),"pay_amount":"2000000","reward":"100000",
        "deadline_ns":(T0 + HOUR).to_string(),"quoted_by":FUL}});
    set(INTENTS, T0);
    assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        c.mt_on_transfer(
            a(BUYER),
            vec![a(BUYER)],
            vec![USDC.into()],
            vec![U128(2_100_000)],
            msg.to_string(),
        );
    }))
    .is_err());
    register_only(&mut c, FUL);
    set(INTENTS, T0);
    assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        c.mt_on_transfer(
            a(BUYER),
            vec![a(BUYER)],
            vec![USDC.into()],
            vec![U128(2_100_000)],
            msg.to_string(),
        );
    }))
    .is_err());
    approve(&mut c, FUL, true);
    set(INTENTS, T0);
    c.mt_on_transfer(
        a(BUYER),
        vec![a(BUYER)],
        vec![USDC.into()],
        vec![U128(2_100_000)],
        msg.to_string(),
    );
    assert_eq!(
        c.get_order("FUL-QUOTE1".into()).unwrap().quoted_by,
        Some(a(FUL))
    );
}

#[test]
fn buyer_open_cap_releases_on_settlement() {
    let mut c = new_contract(None);
    for n in 1..=5 {
        fund(&mut c, &format!("FUL-CAP{n:02}"), T0);
    }
    assert_eq!(c.get_profile(a(BUYER)).stats.open_as_buyer, 5);
    assert!(
        std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| fund(
            &mut c,
            "FUL-CAP06",
            T0
        )))
        .is_err()
    );
    auth(
        &mut c,
        BUYER,
        T0,
        json!({"op":"cancel","order_id":"FUL-CAP01"}),
    );
    assert_eq!(c.get_profile(a(BUYER)).stats.open_as_buyer, 4);
    fund(&mut c, "FUL-CAP06", T0);
    assert_eq!(c.get_profile(a(BUYER)).stats.open_as_buyer, 5);
}

#[test]
fn buyer_open_stats_clear_on_payout_and_verdict() {
    let mut c = new_contract(None);
    paid_order(&mut c, 0);
    assert_eq!(c.get_profile(a(BUYER)).stats.open_as_buyer, 0);

    fund(&mut c, "FUL-CAP07", T0);
    claim_as(&mut c, FUL, "FUL-CAP07", T0);
    c.orders.get_mut("FUL-CAP07").unwrap().status = Status::UnderReview;
    set(ARBITER, T0);
    c.resolve_dispute("FUL-CAP07".into(), Verdict::Buyer, None);
    assert_eq!(c.get_profile(a(BUYER)).stats.open_as_buyer, 0);
}

#[test]
fn preexisting_buyer_open_count_is_enforced() {
    let mut c = new_contract(None);
    c.stats.insert(
        a(BUYER),
        Stats {
            open_as_buyer: 4,
            ..Stats::default()
        },
    );
    fund(&mut c, "FUL-CAP08", T0);
    assert_eq!(c.get_profile(a(BUYER)).stats.open_as_buyer, 5);
    assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        fund(&mut c, "FUL-CAP09", T0)
    }))
    .is_err());
    auth(
        &mut c,
        BUYER,
        T0,
        json!({"op":"cancel","order_id":"FUL-CAP08"}),
    );
    assert_eq!(c.get_profile(a(BUYER)).stats.open_as_buyer, 4);
    fund(&mut c, "FUL-CAP09", T0);
    assert_eq!(c.get_profile(a(BUYER)).stats.open_as_buyer, 5);
}

#[test]
fn storage_reserve_override_is_owner_only() {
    let mut c = new_contract(None);
    assert_eq!(
        c.get_storage_reserve().0,
        NearToken::from_near(1).as_yoctonear()
    );
    testing_env!(builder(OWNER, T0)
        .attached_deposit(NearToken::from_yoctonear(1))
        .build());
    c.set_storage_reserve(U128(NearToken::from_near(2).as_yoctonear()));
    assert_eq!(
        c.get_storage_reserve().0,
        NearToken::from_near(2).as_yoctonear()
    );
    testing_env!(builder(FUL, T0)
        .attached_deposit(NearToken::from_yoctonear(1))
        .build());
    assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(
        || c.set_storage_reserve(U128(0))
    ))
    .is_err());
}

#[test]
fn funded_order_progresses_below_storage_reserve() {
    let mut c = new_contract(Some(|config: &mut Config| {
        config.challenge_window_ns = U64(HOUR)
    }));
    fund(&mut c, "FUL-LIVE01", T0);
    register(&mut c, FUL);
    claim_as(&mut c, FUL, "FUL-LIVE01", T0);

    testing_env!(builder(OWNER, T0)
        .account_balance(NearToken::from_near(100))
        .attached_deposit(NearToken::from_yoctonear(1))
        .build());
    c.set_storage_reserve(U128(NearToken::from_near(50).as_yoctonear()));

    testing_env!(builder(INTENTS, T0 + MIN)
        .account_balance(NearToken::from_near(20))
        .build());
    c.on_auth(
        a(FUL),
        json!({"op":"sent","order_id":"FUL-LIVE01"}).to_string(),
    );
    c.on_auth(
        a(FUL),
        json!({"op":"submit_proof","order_id":"FUL-LIVE01","proof_sha256":PROOF,"spec":spec()})
            .to_string(),
    );
    assert_eq!(status(&c, "FUL-LIVE01"), Status::Verifying);
    callback(
        &mut c,
        "FUL-LIVE01",
        1,
        good_output("FUL-LIVE01", T0 + MIN),
        T0 + 2 * MIN,
    );
    assert_eq!(status(&c, "FUL-LIVE01"), Status::Verified);

    testing_env!(builder(INTENTS, T0 + 3 * MIN)
        .account_balance(NearToken::from_yoctonear(0))
        .build());
    c.on_auth(
        a(BUYER),
        json!({"op":"dispute","order_id":"FUL-LIVE01","reason_code":1}).to_string(),
    );
    assert_eq!(status(&c, "FUL-LIVE01"), Status::Disputed);
}

fn panic_text(f: impl FnOnce()) -> String {
    let error = std::panic::catch_unwind(std::panic::AssertUnwindSafe(f))
        .expect_err("expected contract call to panic");
    if let Some(message) = error.downcast_ref::<String>() {
        message.clone()
    } else if let Some(message) = error.downcast_ref::<&str>() {
        (*message).to_string()
    } else {
        format!("{error:?}")
    }
}

fn assert_panics_with(expected: &str, f: impl FnOnce()) {
    let message = panic_text(f);
    assert!(message.contains(expected), "unexpected panic: {message}");
}

#[test]
fn owner_can_revoke_and_pause_below_storage_reserve() {
    let mut c = new_contract(None);
    approve(&mut c, FUL, true);
    testing_env!(builder(OWNER, T0)
        .attached_deposit(NearToken::from_yoctonear(1))
        .account_balance(NearToken::from_yoctonear(0))
        .build());
    c.approve_fulfiller(a(FUL), false);
    assert!(!c.approved.contains(&a(FUL)));

    let mut paused = c.get_config();
    paused.paused = true;
    c.update_config(paused);
    assert!(c.get_config().paused);
}

#[test]
fn owner_growth_actions_still_require_storage_reserve() {
    let mut c = new_contract(None);
    testing_env!(builder(OWNER, T0)
        .attached_deposit(NearToken::from_yoctonear(1))
        .account_balance(NearToken::from_yoctonear(0))
        .build());
    assert_panics_with("storage reserve exhausted", || {
        c.approve_fulfiller(a(FUL), true)
    });

    let mut c = new_contract(None);
    testing_env!(builder(OWNER, T0)
        .attached_deposit(NearToken::from_yoctonear(1))
        .account_balance(NearToken::from_yoctonear(0))
        .build());
    assert_panics_with("storage reserve exhausted", || {
        c.update_config(c.get_config())
    });
}

#[test]
fn post_upgrade_live_balance_blocks_new_orders_until_reserve_lowered() {
    let mut c = new_contract(None);
    let live_balance = NearToken::from_yoctonear(4_222_835_802_983_730_000_000_000);
    testing_env!(builder(INTENTS, T0)
        .account_balance(live_balance)
        .storage_usage(368_700)
        .build());
    assert_panics_with("storage reserve exhausted", || {
        c.mt_on_transfer(
            a(BUYER),
            vec![a(BUYER)],
            vec![USDC.into()],
            vec![U128(2_100_000)],
            fund_msg("FUL-LIVE02", 2_000_000, 100_000, T0 + 24 * HOUR),
        );
    });
    assert!(!c.used_ids.contains("FUL-LIVE02"));
    testing_env!(builder(OWNER, T0)
        .account_balance(live_balance)
        .storage_usage(368_700)
        .attached_deposit(NearToken::from_yoctonear(1))
        .build());
    c.set_storage_reserve(U128(NearToken::from_millinear(300).as_yoctonear()));
    testing_env!(builder(INTENTS, T0)
        .account_balance(live_balance)
        .storage_usage(368_700)
        .build());
    c.mt_on_transfer(
        a(BUYER),
        vec![a(BUYER)],
        vec![USDC.into()],
        vec![U128(2_100_000)],
        fund_msg("FUL-LIVE02", 2_000_000, 100_000, T0 + 24 * HOUR),
    );
    assert_eq!(status(&c, "FUL-LIVE02"), Status::Funded);
}

#[test]
fn claim_blocked_under_reserve_but_funded_order_still_refundable() {
    for cancel in [true, false] {
        let mut c = new_contract(None);
        let id = if cancel { "FUL-LOW01" } else { "FUL-LOW02" };
        fund(&mut c, id, T0);
        register(&mut c, FUL);
        testing_env!(builder(INTENTS, T0)
            .account_balance(NearToken::from_near(1))
            .build());
        assert_panics_with("storage reserve exhausted", || {
            c.on_auth(a(FUL), json!({"op":"claim","order_id":id}).to_string());
        });
        assert_eq!(status(&c, id), Status::Funded);
        if cancel {
            testing_env!(builder(INTENTS, T0)
                .account_balance(NearToken::from_near(1))
                .build());
            c.on_auth(a(BUYER), json!({"op":"cancel","order_id":id}).to_string());
        } else {
            testing_env!(builder("anyone.test", T0 + 24 * HOUR)
                .account_balance(NearToken::from_near(1))
                .build());
            c.expire(id.into());
        }
        assert!(c.get_order(id.into()).is_none());
        assert_eq!(mt_transfers(), vec![(BUYER.into(), USDC.into(), 2_100_000)]);
    }
}

#[test]
fn legacy_open_count_above_cap() {
    let mut c = new_contract(None);
    for n in 1..=3 {
        fund(&mut c, &format!("FUL-OLD{n:02}"), T0);
    }
    c.stats.insert(
        a(BUYER),
        Stats {
            open_as_buyer: 7,
            ..Stats::default()
        },
    );
    assert_panics_with("too many open orders", || fund(&mut c, "FUL-OLD04", T0));
    for n in 1..=3 {
        auth(
            &mut c,
            BUYER,
            T0,
            json!({"op":"cancel","order_id":format!("FUL-OLD{n:02}")}),
        );
    }
    assert_eq!(c.get_profile(a(BUYER)).stats.open_as_buyer, 4);
    fund(&mut c, "FUL-OLD04", T0);
    assert_eq!(c.get_profile(a(BUYER)).stats.open_as_buyer, 5);
}

#[test]
fn unpaid_fulfiller_verdict_cannot_be_rated_or_recounted() {
    let mut c = new_contract(None);
    fund(&mut c, "FUL-R3401", T0);
    register(&mut c, FUL);
    claim_as(&mut c, FUL, "FUL-R3401", T0);
    auth(
        &mut c,
        FUL,
        T0 + MIN,
        json!({"op":"sent","order_id":"FUL-R3401"}),
    );
    set("anyone.test", T0 + 3 * HOUR);
    c.timeout("FUL-R3401".into());
    set(ARBITER, T0 + 4 * HOUR);
    c.resolve_dispute("FUL-R3401".into(), Verdict::Fulfiller, None);
    let order = c.get_order("FUL-R3401".into()).unwrap();
    assert_eq!(order.status, Status::Resolved);
    assert!(order.paid_at.is_none());
    assert_panics_with("order not paid", || {
        auth(
            &mut c,
            BUYER,
            T0 + 4 * HOUR,
            json!({"op":"rate","order_id":"FUL-R3401","stars":5}),
        );
    });
    set("anyone.test", T0 + 4 * HOUR);
    assert_panics_with("not rated", || c.recount_rating("FUL-R3401".into()));
}

fn quote_fund(c: &mut Contract, id: &str, quoted_by: &str) {
    set(INTENTS, T0);
    c.mt_on_transfer(
        a(BUYER),
        vec![a(BUYER)],
        vec![USDC.into()],
        vec![U128(2_100_000)],
        json!({"op":"fund","order":{"id":id,"kind":"bank_transfer",
            "spec_hash":sha256_hex(spec().as_bytes()),"pay_amount":"2000000",
            "reward":"100000","deadline_ns":(T0 + HOUR).to_string(),
            "quoted_by":quoted_by}})
        .to_string(),
    );
}

#[test]
fn quoted_by_requires_kind_eligibility_before_fund_mutates_state() {
    for (mode_index, mode) in ["open", "allowlist", "approved"].into_iter().enumerate() {
        let mut c = new_contract(None);
        c.config.kinds.get_mut("bank_transfer").unwrap().access = match mode {
            "open" => Access::Named("open".into()),
            "allowlist" => Access::Allowlist {
                allowlist: vec![a(FUL)],
            },
            _ => Access::Named("approved".into()),
        };
        register_only(&mut c, FUL);
        register_only(&mut c, FUL2);
        if mode == "approved" {
            approve(&mut c, FUL, true);
        }
        let valid_id = format!("FUL-QOK{mode_index:02}");
        quote_fund(&mut c, &valid_id, FUL);
        assert_eq!(c.order(&valid_id).quoted_by, Some(a(FUL)));
        let baseline = c.get_profile(a(BUYER)).stats.open_as_buyer;
        let invalid = [
            (format!("FUL-QBAD{mode_index}1"), "stranger.test"),
            (format!("FUL-QBAD{mode_index}2"), BUYER),
            (format!("FUL-QBAD{mode_index}3"), FUL2),
        ];
        for (id, quote) in invalid {
            if mode == "open" && quote == FUL2 {
                continue;
            }
            assert_panics_with(
                if quote == BUYER {
                    "buyer cannot quote itself"
                } else if quote == "stranger.test" {
                    "not a registered fulfiller"
                } else if mode == "allowlist" {
                    "fulfiller not allowed"
                } else {
                    "fulfiller not approved"
                },
                || quote_fund(&mut c, &id, quote),
            );
            // Unit-test panics do not roll back storage. `internal_fund` checks
            // quoted_by before the first stats, used_ids, liability, or order write.
            assert!(!c.used_ids.contains(&id));
            assert!(c.get_order(id).is_none());
            assert_eq!(c.get_profile(a(BUYER)).stats.open_as_buyer, baseline);
        }
    }
}

fn audit_start_verifying(c: &mut Contract, id: &str) -> Value {
    auth(c, FUL, T0 + MIN, json!({"op":"sent","order_id":id}));
    auth(
        c,
        FUL,
        T0 + 2 * MIN,
        json!({"op":"submit_proof","order_id":id,"proof_sha256":PROOF,"spec":spec()}),
    );
    scheduled_verify_args()
}

fn audit_verify_success(c: &mut Contract, id: &str, args: &Value) {
    let mut output = good_output(id, T0 + MIN);
    output["nullifier"] = Value::String(sha256_hex(id.as_bytes()));
    callback_from_args(c, args, output, T0 + 3 * MIN);
}

fn audit_under_review(c: &mut Contract, id: &str) {
    auth(c, FUL, T0 + MIN, json!({"op":"sent","order_id":id}));
    set("anyone.test", T0 + 3 * HOUR);
    c.timeout(id.into());
    assert_eq!(status(c, id), Status::UnderReview);
}

#[test]
fn terminal_paths_restore_counters_and_bond_accounting() {
    let mut c = new_contract(Some(|config: &mut Config| {
        config.min_bond = U128(100_000);
        config.bond_per_job_bps = 1_000;
        config.challenge_window_ns = U64(HOUR);
    }));
    register(&mut c, FUL);
    set(INTENTS, T0);
    c.mt_on_transfer(
        a(FUL),
        vec![a(FUL)],
        vec![USDC.into()],
        vec![U128(1_000_000)],
        r#"{"op":"bond"}"#.into(),
    );
    let paths = [
        "cancel",
        "funded_expire",
        "claimed_expire",
        "sent_review_buyer",
        "sent_review_fulfiller",
        "rejected_review_buyer",
        "rejected_review_fulfiller",
        "verifying_review_buyer",
        "verifying_review_fulfiller",
        "claim_slash_then_expire",
        "paid_release",
        "review_buyer",
        "review_fulfiller",
        "review_split",
        "disputed_buyer",
        "disputed_fulfiller",
        "disputed_split",
    ];
    let mut slashed = 0;
    for (index, path) in paths.iter().enumerate() {
        let id = format!("FUL-TERM{index:02}");
        fund(&mut c, &id, T0);
        if *path == "cancel" {
            auth(&mut c, BUYER, T0, json!({"op":"cancel","order_id":id}));
        } else if *path == "funded_expire" {
            set("anyone.test", T0 + 24 * HOUR);
            c.expire(id.clone());
        } else {
            claim_as(&mut c, FUL, &id, T0);
            assert_eq!(c.get_profile(a(FUL)).bond.locked.0, 210_000);
            match *path {
                "claimed_expire" => {
                    set("anyone.test", T0 + 24 * HOUR);
                    c.expire(id.clone());
                }
                "sent_review_buyer" | "sent_review_fulfiller" => {
                    auth(&mut c, FUL, T0 + MIN, json!({"op":"sent","order_id":id}));
                    set("anyone.test", T0 + 24 * HOUR);
                    assert_panics_with("not refundable", || c.expire(id.clone()));
                    c.timeout(id.clone());
                }
                "rejected_review_buyer" | "rejected_review_fulfiller" => {
                    let args = audit_start_verifying(&mut c, &id);
                    callback_from_args(
                        &mut c,
                        &args,
                        json!({"success":false,"error":"rejected"}),
                        T0 + 3 * MIN,
                    );
                    assert_eq!(status(&c, &id), Status::ProofRejected);
                    set("anyone.test", T0 + 24 * HOUR);
                    assert_panics_with("not refundable", || c.expire(id.clone()));
                    c.timeout(id.clone());
                }
                "verifying_review_buyer" | "verifying_review_fulfiller" => {
                    let args = audit_start_verifying(&mut c, &id);
                    set("anyone.test", T0 + 26 * HOUR);
                    assert_panics_with("not refundable", || c.expire(id.clone()));
                    c.timeout(id.clone());
                    callback_from_args(
                        &mut c,
                        &args,
                        good_output(&id, T0 + MIN),
                        T0 + 26 * HOUR + MIN,
                    );
                    assert_eq!(status(&c, &id), Status::UnderReview);
                    assert!(mt_transfers().is_empty());
                }
                "claim_slash_then_expire" => {
                    set("anyone.test", T0 + 15 * MIN);
                    c.timeout(id.clone());
                    slashed += 210_000;
                    assert_eq!(status(&c, &id), Status::Funded);
                    set("anyone.test", T0 + 24 * HOUR);
                    c.expire(id.clone());
                }
                "paid_release" | "disputed_buyer" | "disputed_fulfiller" | "disputed_split" => {
                    let args = audit_start_verifying(&mut c, &id);
                    audit_verify_success(&mut c, &id, &args);
                    set("anyone.test", T0 + 2 * HOUR);
                    c.finalize(id.clone());
                    if *path == "paid_release" {
                        set("anyone.test", T0 + 26 * HOUR);
                        c.release_bond(id.clone());
                    } else {
                        auth(
                            &mut c,
                            BUYER,
                            T0 + 3 * HOUR,
                            json!({"op":"dispute","order_id":id,"reason_code":1}),
                        );
                        set(ARBITER, T0 + 4 * HOUR);
                        let verdict = match *path {
                            "disputed_buyer" => Verdict::Buyer,
                            "disputed_fulfiller" => Verdict::Fulfiller,
                            _ => Verdict::Split,
                        };
                        c.resolve_dispute(id.clone(), verdict, None);
                        if verdict == Verdict::Buyer {
                            slashed += 210_000;
                        } else if verdict == Verdict::Split {
                            slashed += 105_000;
                        }
                    }
                }
                "review_buyer" | "review_fulfiller" | "review_split" => {
                    audit_under_review(&mut c, &id);
                    set(ARBITER, T0 + 4 * HOUR);
                    let verdict = match *path {
                        "review_buyer" => Verdict::Buyer,
                        "review_fulfiller" => Verdict::Fulfiller,
                        _ => Verdict::Split,
                    };
                    c.resolve_dispute(id.clone(), verdict, None);
                }
                _ => unreachable!(),
            }
            if path.starts_with("sent_review")
                || path.starts_with("rejected_review")
                || path.starts_with("verifying_review")
            {
                assert_eq!(status(&c, &id), Status::UnderReview, "{path}");
                assert_eq!(c.get_profile(a(BUYER)).stats.open_as_buyer, 1, "{path}");
                assert_eq!(c.get_profile(a(FUL)).bond.locked.0, 210_000, "{path}");
                let verdict = if path.ends_with("buyer") {
                    Verdict::Buyer
                } else {
                    Verdict::Fulfiller
                };
                set(ARBITER, T0 + 27 * HOUR);
                c.resolve_dispute(id.clone(), verdict, None);
            }
        }
        let buyer = c.get_profile(a(BUYER)).stats;
        let fulfiller = c.get_profile(a(FUL));
        assert_eq!(buyer.open_as_buyer, 0, "{path}");
        assert_eq!(fulfiller.stats.active_claims, 0, "{path}");
        assert_eq!(fulfiller.bond.locked.0, 0, "{path}");
        assert_eq!(fulfiller.bond.available.0, 1_000_000 - slashed, "{path}");
    }
    for index in 0..MAX_OPEN_ORDERS_PER_BUYER {
        fund(&mut c, &format!("FUL-NEW{index:02}"), T0);
    }
    assert_eq!(
        c.get_profile(a(BUYER)).stats.open_as_buyer,
        MAX_OPEN_ORDERS_PER_BUYER
    );
    assert_panics_with("too many open orders", || fund(&mut c, "FUL-NEW05", T0));
}

fn audit_settlement_events() -> Vec<String> {
    get_logs()
        .into_iter()
        .filter_map(|line| line.strip_prefix("EVENT_JSON:").map(str::to_string))
        .filter_map(|line| serde_json::from_str::<Value>(&line).ok())
        .filter_map(|event| event["event"].as_str().map(str::to_string))
        .filter(|name| {
            matches!(
                name.as_str(),
                "order_expired" | "order_paid" | "dispute_resolved"
            )
        })
        .collect()
}

fn audit_no_second_settlement(c: &mut Contract, id: &str, callback_args: Option<&Value>) {
    set("anyone.test", T0 + 50 * HOUR);
    let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| c.expire(id.into())));
    assert!(audit_settlement_events().is_empty());

    set("anyone.test", T0 + 50 * HOUR);
    let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| c.timeout(id.into())));
    assert!(audit_settlement_events().is_empty());

    set("anyone.test", T0 + 50 * HOUR);
    let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| c.finalize(id.into())));
    assert!(audit_settlement_events().is_empty());

    set("anyone.test", T0 + 50 * HOUR);
    let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| c.release_bond(id.into())));
    assert!(audit_settlement_events().is_empty());

    set(ARBITER, T0 + 50 * HOUR);
    let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        c.resolve_dispute(id.into(), Verdict::Buyer, None)
    }));
    assert!(audit_settlement_events().is_empty());

    let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        auth(
            c,
            FUL,
            T0 + 50 * HOUR,
            json!({"op":"release_claim","order_id":id}),
        );
    }));
    assert!(audit_settlement_events().is_empty());

    let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        auth(
            c,
            FUL,
            T0 + 50 * HOUR,
            json!({"op":"submit_proof","order_id":id,"proof_sha256":PROOF,"spec":spec()}),
        );
    }));
    assert!(audit_settlement_events().is_empty());

    if let Some(args) = callback_args {
        callback_from_args(c, args, good_output(id, T0 + MIN), T0 + 50 * HOUR);
        assert!(audit_settlement_events().is_empty());
    }
}

fn audit_resolve_deadline_review(c: &mut Contract, id: &str, verdict: Verdict) {
    assert_eq!(status(c, id), Status::UnderReview);
    assert_eq!(c.get_profile(a(BUYER)).stats.open_as_buyer, 1);
    assert_eq!(c.get_profile(a(FUL)).stats.active_claims, 1);
    set(ARBITER, T0 + 27 * HOUR);
    c.resolve_dispute(id.into(), verdict, None);
    assert_eq!(c.get_profile(a(BUYER)).stats.open_as_buyer, 0);
    assert_eq!(c.get_profile(a(FUL)).stats.active_claims, 0);
    assert_eq!(status(c, id), Status::Resolved);
    let recipient = if verdict == Verdict::Buyer {
        BUYER
    } else {
        FUL
    };
    assert_eq!(
        mt_transfers(),
        vec![(recipient.into(), USDC.into(), 2_100_000)]
    );
}

#[test]
fn deadline_paths_settle_once_and_ignore_late_callbacks() {
    let cases = [
        "funded",
        "claimed",
        "claimed_release",
        "sent",
        "sent_release",
        "rejected",
        "rejected_release",
        "verifying_stuck",
        "verifying_callback_failed",
        "verifying_callback_succeeded",
        "verifying_fresh",
        "verified",
        "review",
        "disputed",
        "paid",
    ];
    for (index, case) in cases.iter().enumerate() {
        for reverse in [false, true] {
            let id = format!("FUL-RACE{index:02}{}", if reverse { "B" } else { "A" });
            let mut c = new_contract(Some(|config: &mut Config| {
                config.challenge_window_ns = U64(HOUR);
            }));
            fund(&mut c, &id, T0);
            let mut args = None;
            if *case != "funded" {
                register(&mut c, FUL);
                let claimed_at = if *case == "verifying_fresh" {
                    T0 + 24 * HOUR - 2 * MIN
                } else {
                    T0
                };
                claim_as(&mut c, FUL, &id, claimed_at);
            }
            match *case {
                "sent" | "sent_release" | "review" | "disputed" => {
                    auth(&mut c, FUL, T0 + MIN, json!({"op":"sent","order_id":id}));
                }
                "rejected"
                | "rejected_release"
                | "verifying_stuck"
                | "verifying_callback_failed"
                | "verifying_callback_succeeded"
                | "verified"
                | "paid" => {
                    args = Some(audit_start_verifying(&mut c, &id));
                }
                "verifying_fresh" => {
                    // Verification starts just before deadline; its callback window survives.
                    auth(
                        &mut c,
                        FUL,
                        T0 + 24 * HOUR - MIN,
                        json!({"op":"sent","order_id":id}),
                    );
                    auth(
                        &mut c,
                        FUL,
                        T0 + 24 * HOUR - 1,
                        json!({"op":"submit_proof","order_id":id,"proof_sha256":PROOF,"spec":spec()}),
                    );
                    args = Some(scheduled_verify_args());
                }
                _ => {}
            }
            match *case {
                "rejected" | "rejected_release" => callback_from_args(
                    &mut c,
                    args.as_ref().unwrap(),
                    json!({"success":false,"error":"bad proof"}),
                    T0 + 3 * MIN,
                ),
                "verified" | "paid" => {
                    audit_verify_success(&mut c, &id, args.as_ref().unwrap());
                }
                _ => {}
            }
            if *case == "review" || *case == "disputed" {
                set("anyone.test", T0 + 3 * HOUR);
                c.timeout(id.clone());
                if *case == "disputed" {
                    auth(
                        &mut c,
                        BUYER,
                        T0 + 4 * HOUR,
                        json!({"op":"dispute","order_id":id,"reason_code":1}),
                    );
                }
            }
            if *case == "paid" {
                set("anyone.test", T0 + 2 * HOUR);
                c.finalize(id.clone());
            }
            if matches!(*case, "sent_release" | "rejected_release") {
                auth(
                    &mut c,
                    FUL,
                    T0 + 4 * MIN,
                    json!({"op":"release_claim","order_id":id}),
                );
                assert_eq!(status(&c, &id), Status::Funded);
            }
            set("anyone.test", T0 + 24 * HOUR);
            let initial = status(&c, &id);
            if matches!(
                initial,
                Status::Sent
                    | Status::ProofRejected
                    | Status::Verifying
                    | Status::Verified
                    | Status::UnderReview
                    | Status::Disputed
                    | Status::Paid
            ) {
                assert_panics_with("not refundable", || c.expire(id.clone()));
                assert_eq!(status(&c, &id), initial);
            }
            let mut events = Vec::new();
            let verdict = if reverse {
                Verdict::Fulfiller
            } else {
                Verdict::Buyer
            };
            match *case {
                "funded" | "claimed" | "claimed_release" | "sent_release" | "rejected_release" => {
                    if *case == "claimed_release" {
                        auth(
                            &mut c,
                            FUL,
                            T0 + 24 * HOUR,
                            json!({"op":"release_claim","order_id":id}),
                        );
                        set("anyone.test", T0 + 24 * HOUR);
                        c.expire(id.clone());
                    } else if reverse && *case == "claimed" {
                        set("anyone.test", T0 + 24 * HOUR);
                        c.timeout(id.clone());
                    } else {
                        set("anyone.test", T0 + 24 * HOUR);
                        c.expire(id.clone());
                    }
                    events.extend(audit_settlement_events());
                    assert!(c.get_order(id.clone()).is_none());
                }
                "sent" | "rejected" | "verifying_stuck" => {
                    set("anyone.test", T0 + 24 * HOUR);
                    c.timeout(id.clone());
                    if *case == "verifying_stuck" {
                        callback_from_args(
                            &mut c,
                            args.as_ref().unwrap(),
                            good_output(&id, T0 + MIN),
                            T0 + 24 * HOUR + MIN,
                        );
                        assert_eq!(c.is_nullifier_used(TXREF.into()), None);
                    }
                    audit_resolve_deadline_review(&mut c, &id, verdict);
                    events.extend(audit_settlement_events());
                }
                "verifying_callback_failed" => {
                    if reverse {
                        set("anyone.test", T0 + 24 * HOUR);
                        c.timeout(id.clone());
                        callback_from_args(
                            &mut c,
                            args.as_ref().unwrap(),
                            json!({"success":false,"error":"late failure"}),
                            T0 + 24 * HOUR + MIN,
                        );
                    } else {
                        callback_from_args(
                            &mut c,
                            args.as_ref().unwrap(),
                            json!({"success":false,"error":"late failure"}),
                            T0 + 24 * HOUR,
                        );
                        set("anyone.test", T0 + 24 * HOUR);
                        c.timeout(id.clone());
                    }
                    audit_resolve_deadline_review(&mut c, &id, verdict);
                    events.extend(audit_settlement_events());
                }
                "verifying_callback_succeeded" | "verifying_fresh" => {
                    if reverse && *case == "verifying_callback_succeeded" {
                        set("anyone.test", T0 + 24 * HOUR);
                        c.timeout(id.clone());
                        let mut output = good_output(&id, T0 + 24 * HOUR - 1);
                        let nullifier = sha256_hex(id.as_bytes());
                        output["nullifier"] = Value::String(nullifier.clone());
                        callback_from_args(&mut c, args.as_ref().unwrap(), output, T0 + 24 * HOUR);
                        assert_eq!(c.is_nullifier_used(nullifier), None);
                        audit_resolve_deadline_review(&mut c, &id, verdict);
                        events.extend(audit_settlement_events());
                    } else {
                        let mut output = good_output(&id, T0 + 24 * HOUR - 1);
                        output["nullifier"] = Value::String(sha256_hex(id.as_bytes()));
                        callback_from_args(&mut c, args.as_ref().unwrap(), output, T0 + 24 * HOUR);
                        set("anyone.test", T0 + 25 * HOUR);
                        c.finalize(id.clone());
                        events.extend(audit_settlement_events());
                    }
                }
                "verified" => {
                    set("anyone.test", T0 + 24 * HOUR);
                    c.finalize(id.clone());
                    events.extend(audit_settlement_events());
                }
                "review" | "disputed" => {
                    set(ARBITER, T0 + 24 * HOUR);
                    c.resolve_dispute(id.clone(), verdict, None);
                    events.extend(audit_settlement_events());
                }
                "paid" => {
                    set("anyone.test", T0 + 26 * HOUR);
                    c.release_bond(id.clone());
                    events.extend(audit_settlement_events());
                }
                _ => unreachable!(),
            }
            assert!(events.len() <= 1, "{case}: {events:?}");
            if matches!(
                *case,
                "funded" | "claimed" | "claimed_release" | "sent_release" | "rejected_release"
            ) {
                assert_eq!(events, ["order_expired"]);
                if args.is_some() {
                    callback_from_args(
                        &mut c,
                        args.as_ref().unwrap(),
                        good_output(&id, T0 + MIN),
                        T0 + 24 * HOUR + MIN,
                    );
                    assert_eq!(c.is_nullifier_used(TXREF.into()), None);
                    assert!(audit_settlement_events().is_empty());
                }
            } else if matches!(
                *case,
                "sent"
                    | "rejected"
                    | "verifying_stuck"
                    | "verifying_callback_failed"
                    | "review"
                    | "disputed"
            ) || (reverse && *case == "verifying_callback_succeeded")
            {
                assert_eq!(events, ["dispute_resolved"], "{case}");
            }
            audit_no_second_settlement(&mut c, &id, args.as_ref());
        }
    }
}

#[test]
fn underreview_griefing_matches_baseline() {
    let mut c = new_contract(None);
    open_kind(&mut c);
    assert_eq!(c.config.min_bond.0, 0);
    assert_eq!(c.config.bond_per_job_bps, 0);
    register_only(&mut c, FUL);
    register_only(&mut c, FUL2);
    assert_eq!(c.get_profile(a(FUL)).level, 0);
    assert_eq!(c.get_profile(a(FUL)).bond.available.0, 0);

    let id = "FUL-GRIEF1";
    let deadline = T0 + 24 * HOUR;
    let quote_window = c.kind("bank_transfer").quote_exclusive_ns.0;
    set(INTENTS, T0);
    c.mt_on_transfer(
        a(BUYER),
        vec![a(BUYER)],
        vec![USDC.into()],
        vec![U128(2_100_000)],
        json!({"op":"fund","order":{"id":id,"kind":"bank_transfer",
            "spec_hash":sha256_hex(spec().as_bytes()),"pay_amount":"2000000",
            "reward":"100000","deadline_ns":deadline.to_string(),"quoted_by":FUL2}})
        .to_string(),
    );
    let claimed_at = T0 + quote_window + MIN;
    claim_as(&mut c, FUL, id, claimed_at);
    assert_eq!(status(&c, id), Status::Claimed);
    let sent_at = claimed_at + MIN;
    auth(&mut c, FUL, sent_at, json!({"op":"sent","order_id":id}));
    auth(
        &mut c,
        FUL,
        sent_at + MIN,
        json!({"op":"submit_proof","order_id":id,"proof_sha256":PROOF,"spec":spec()}),
    );
    let callback_args = scheduled_verify_args();
    callback_from_args(
        &mut c,
        &callback_args,
        json!({"ok":false}),
        sent_at + 2 * MIN,
    );
    assert_eq!(status(&c, id), Status::ProofRejected);

    assert_panics_with("not cancellable", || {
        auth(
            &mut c,
            BUYER,
            sent_at + 3 * MIN,
            json!({"op":"cancel","order_id":id}),
        );
    });
    set("anyone.test", sent_at + 3 * MIN);
    assert_panics_with("deadline not reached", || c.expire(id.into()));
    assert_eq!(status(&c, id), Status::ProofRejected);

    let review_at = sent_at
        .saturating_add(c.kind("bank_transfer").proof_timeout_ns.0)
        .min(deadline);
    set("anyone.test", review_at);
    c.timeout(id.into());
    assert_eq!(status(&c, id), Status::UnderReview);
    assert_eq!(c.get_profile(a(BUYER)).stats.open_as_buyer, 1);
    assert_eq!(c.get_profile(a(FUL)).stats.active_claims, 1);
    assert_eq!(c.get_profile(a(FUL)).bond.locked.0, 0);

    // Pre-W9.8 reached the same UnderReview lock at sent_at + proof_timeout
    // without a deadline; W9.8b adds no new griefing capability.
    let other_buyer = a("other-buyer.test");
    set(INTENTS, review_at);
    c.mt_on_transfer(
        other_buyer.clone(),
        vec![other_buyer.clone()],
        vec![USDC.into()],
        vec![U128(2_100_000)],
        fund_msg("FUL-GRIEF2", 2_000_000, 100_000, deadline),
    );
    assert_panics_with("claim limit", || {
        claim_as(&mut c, FUL, "FUL-GRIEF2", review_at + MIN);
    });
    assert_eq!(c.get_profile(a(FUL)).stats.active_claims, 1);

    set(INTENTS, deadline);
    assert_panics_with("not cancellable", || {
        c.on_auth(a(BUYER), json!({"op":"cancel","order_id":id}).to_string());
    });
    set("anyone.test", deadline);
    assert_panics_with("not refundable", || c.expire(id.into()));
    assert_panics_with("not releasable", || {
        auth(
            &mut c,
            FUL,
            deadline,
            json!({"op":"release_claim","order_id":id}),
        );
    });
    callback_from_args(
        &mut c,
        &callback_args,
        good_output(id, sent_at + MIN),
        deadline + MIN,
    );
    assert_eq!(status(&c, id), Status::UnderReview);
    assert_eq!(c.is_nullifier_used(TXREF.into()), None);
    assert!(mt_transfers().is_empty());
    assert_eq!(c.get_profile(a(BUYER)).stats.open_as_buyer, 1);
    assert_eq!(c.get_profile(a(FUL)).stats.active_claims, 1);

    set(ARBITER, deadline + 2 * MIN);
    c.resolve_dispute(id.into(), Verdict::Buyer, None);
    assert_eq!(status(&c, id), Status::Resolved);
    assert_eq!(mt_transfers(), vec![(BUYER.into(), USDC.into(), 2_100_000)]);
    assert_eq!(c.get_profile(a(BUYER)).stats.open_as_buyer, 0);
    assert_eq!(c.get_profile(a(FUL)).stats.active_claims, 0);
    set(ARBITER, deadline + 3 * MIN);
    assert_panics_with("not disputed", || {
        c.resolve_dispute(id.into(), Verdict::Buyer, None)
    });
    assert!(mt_transfers().is_empty());
}

#[test]
fn needs_sent_false_claimed_order_refunds_at_deadline_unless_marked_sent() {
    let kind_name = "cryptorefills_topup";
    let mut c = new_contract(None);
    let mut kind = c.kind("bank_transfer").clone();
    kind.access = Access::Named("open".into());
    kind.needs_sent = false;
    c.config.kinds.insert(kind_name.into(), kind);
    fund_kind(&mut c, "FUL-NOSENT1", kind_name, T0);
    register_only(&mut c, FUL);
    claim_as(&mut c, FUL, "FUL-NOSENT1", T0);
    assert_eq!(status(&c, "FUL-NOSENT1"), Status::Claimed);
    set("anyone.test", T0 + HOUR);
    c.expire("FUL-NOSENT1".into());
    assert!(c.get_order("FUL-NOSENT1".into()).is_none());
    assert_eq!(mt_transfers(), vec![(BUYER.into(), USDC.into(), 2_100_000)]);
    assert_eq!(c.get_profile(a(BUYER)).stats.open_as_buyer, 0);
    assert_eq!(c.get_profile(a(FUL)).stats.active_claims, 0);
    // Residual risk: the shopper may already have paid the merchant before
    // this Claimed order is refunded to the buyer.

    let mut c = new_contract(None);
    let mut kind = c.kind("bank_transfer").clone();
    kind.access = Access::Named("open".into());
    kind.needs_sent = false;
    c.config.kinds.insert(kind_name.into(), kind);
    fund_kind(&mut c, "FUL-NOSENT2", kind_name, T0);
    register_only(&mut c, FUL);
    claim_as(&mut c, FUL, "FUL-NOSENT2", T0);
    auth(
        &mut c,
        FUL,
        T0 + MIN,
        json!({"op":"sent","order_id":"FUL-NOSENT2"}),
    );
    assert_eq!(status(&c, "FUL-NOSENT2"), Status::Sent);
    set("anyone.test", T0 + HOUR);
    c.timeout("FUL-NOSENT2".into());
    assert_eq!(status(&c, "FUL-NOSENT2"), Status::UnderReview);
    assert_panics_with("not refundable", || c.expire("FUL-NOSENT2".into()));
    assert_eq!(c.get_profile(a(BUYER)).stats.open_as_buyer, 1);
    assert_eq!(c.get_profile(a(FUL)).stats.active_claims, 1);
}
