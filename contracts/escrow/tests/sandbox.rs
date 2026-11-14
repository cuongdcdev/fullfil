//! Sandbox integration test: escrow against a locally built `near/intents`
//! defuse contract (the real intents.near code), a NEP-141 mock USDC and the
//! `mock-outlayer` stub (TEST ONLY: returns a canned verifier result).
//!
//! Users are generated ed25519 keys acting as implicit accounts; every user
//! action is a NEP-413 signed intent submitted by a relayer account through
//! `execute_intents`. Users never hold NEAR.
//!
//! Build the artifacts first: `contracts/escrow/tests/build-test-deps.sh`,
//! then `cargo test -p fulfil-escrow --test sandbox -- --ignored --test-threads=1`.

use base64::Engine as _;
use ed25519_dalek::{Signer, SigningKey};
use near_workspaces::types::{Gas, NearToken};
use near_workspaces::{Account, AccountId, Contract, Worker};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};

const MH: &str = "1111111111111111111111111111111111111111111111111111111111111111";
const PROOF: &str = "2222222222222222222222222222222222222222222222222222222222222222";
const ORDER_VALUE: u128 = 2_100_000; // 2.0 USDC repayment + 0.1 USDC reward
const PERSON_VALUE: u128 = 1_050_000;
const TOKEN_BUY_VALUE: u128 = 2_100_000;

fn token_buy_spec(receiver: &str) -> String {
    format!(
        "{{\"amount_out\":\"1000000000000000000\",\"receiver\":\"{receiver}\",\"token_contract\":\"token.test.near\",\"v\":1}}"
    )
}

fn person_spec(secret: &[u8; 32]) -> String {
    format!(
        "{{\"area\":\"District 1\",\"delivery_hash\":\"{}\",\"item_desc\":\"Synthetic item\",\"price\":\"1000000\",\"v\":1}}",
        hex::encode(Sha256::digest(secret))
    )
}

fn bank_spec() -> String {
    format!(
        r#"{{"amount":"50000","bank":"vpbank","country":"VN","currency":"VND","merchant_hash":"{MH}","v":1}}"#
    )
}

fn bank_spec_hash() -> String {
    hex::encode(Sha256::digest(bank_spec().as_bytes()))
}

fn wasm(env: &str, default_rel: &str) -> Vec<u8> {
    let path = std::env::var(env)
        .unwrap_or_else(|_| format!("{}/{}", env!("CARGO_MANIFEST_DIR"), default_rel));
    std::fs::read(&path).unwrap_or_else(|e| {
        panic!("{env}: cannot read {path} ({e}); run contracts/escrow/tests/build-test-deps.sh")
    })
}

/// A user identified only by an ed25519 key (NEAR implicit account id).
struct User {
    sk: SigningKey,
}

impl User {
    fn new() -> Self {
        Self {
            sk: SigningKey::generate(&mut rand::rngs::OsRng),
        }
    }
    fn id(&self) -> String {
        hex::encode(self.sk.verifying_key().to_bytes())
    }
    /// NEP-413 signed `DefuseIntents` payload (MultiPayload, standard = nep413).
    fn sign(&self, verifying_contract: &AccountId, intents: Value) -> Value {
        let message = json!({
            "signer_id": self.id(),
            "deadline": "2099-01-01T00:00:00Z",
            "intents": intents,
        })
        .to_string();
        let nonce: [u8; 32] = rand::random();
        let recipient = verifying_contract.to_string();
        // borsh((u32 tag = 2^31 + 413, Nep413Payload{message, nonce, recipient, callback_url: None}))
        let mut data = Vec::new();
        data.extend_from_slice(&((1u32 << 31) + 413).to_le_bytes());
        data.extend_from_slice(&(message.len() as u32).to_le_bytes());
        data.extend_from_slice(message.as_bytes());
        data.extend_from_slice(&nonce);
        data.extend_from_slice(&(recipient.len() as u32).to_le_bytes());
        data.extend_from_slice(recipient.as_bytes());
        data.push(0);
        let hash = Sha256::digest(&data);
        let sig = self.sk.sign(&hash);
        json!({
            "standard": "nep413",
            "payload": {
                "message": message,
                "nonce": base64::engine::general_purpose::STANDARD.encode(nonce),
                "recipient": recipient,
            },
            "public_key": format!("ed25519:{}", bs58::encode(self.sk.verifying_key().to_bytes()).into_string()),
            "signature": format!("ed25519:{}", bs58::encode(sig.to_bytes()).into_string()),
        })
    }
}

struct Env {
    _worker: Worker<near_workspaces::network::Sandbox>,
    intents: Contract,
    usdc: Contract,
    outlayer: Contract,
    escrow: Contract,
    relayer: Account,
    arbiter: Account,
    token: String,
}

impl Env {
    async fn new() -> anyhow::Result<Self> {
        Self::with_escrow(
            &wasm(
                "ESCROW_WASM",
                "../../target/near/fulfil_escrow/fulfil_escrow.wasm",
            ),
            false,
        )
        .await
    }

    async fn with_escrow(escrow_wasm: &[u8], legacy: bool) -> anyhow::Result<Self> {
        let worker = near_workspaces::sandbox().await?;
        let root = worker.root_account()?;
        let sub = |name: &'static str, near: u128| {
            let root = root.clone();
            async move {
                anyhow::Ok(
                    root.create_subaccount(name)
                        .initial_balance(NearToken::from_near(near))
                        .transact()
                        .await?
                        .into_result()?,
                )
            }
        };
        let intents_acc = sub("intents", 100).await?;
        let usdc_acc = sub("usdc", 10).await?;
        let outlayer_acc = sub("outlayer", 10).await?;
        let escrow_acc = sub("escrow", 20).await?;
        let relayer = sub("relayer", 20).await?;
        let arbiter = sub("arbiter", 5).await?;

        let intents = intents_acc
            .deploy(&wasm("DEFUSE_WASM", "tests/res/defuse.wasm"))
            .await?
            .into_result()?;
        intents
            .call("new")
            .args_json(json!({"config": {
                "wnear_id": "wnear.test.near",
                "fees": {"fee": 0, "fee_collector": intents.id()},
                "roles": {}
            }}))
            .gas(Gas::from_tgas(300))
            .transact()
            .await?
            .into_result()?;

        let usdc = usdc_acc
            .deploy(&wasm("FT_WASM", "tests/res/fungible-token.wasm"))
            .await?
            .into_result()?;
        usdc.call("new_default_meta")
            .args_json(json!({"owner_id": relayer.id(), "total_supply": "1000000000000"}))
            .transact()
            .await?
            .into_result()?;
        relayer
            .call(usdc.id(), "storage_deposit")
            .args_json(json!({"account_id": intents.id()}))
            .deposit(NearToken::from_millinear(10))
            .transact()
            .await?
            .into_result()?;

        let outlayer = outlayer_acc
            .deploy(&wasm(
                "MOCK_OUTLAYER_WASM",
                "../../target/near/mock_outlayer/mock_outlayer.wasm",
            ))
            .await?
            .into_result()?;
        outlayer.call("new").transact().await?.into_result()?;

        let token = format!("nep141:{}", usdc.id());
        let escrow = escrow_acc.deploy(escrow_wasm).await?.into_result()?;
        let mut config = json!({
            "owner": escrow.id(),
            "intents_contract": intents.id(),
            "outlayer_contract": outlayer.id(),
            "verifier_source": r#"{"Project":{"project_id":"escrow.test.near/email-verifier","version_key":null}}"#,
            "verifier_resource_limits": r#"{"max_instructions":10000000000,"max_memory_mb":128,"max_execution_seconds":60}"#,
            "secrets_profile": "default",
            "proof_blob_base_url": "https://api.example/proof-blob/",
            "outlayer_deposit": "10000000000000000000000",
            "outlayer_gas_tgas": 100,
            "arbiter": arbiter.id(),
            "relayer": relayer.id(),
            "accepted_tokens": [token],
            "bond_token": token,
            "allowed_dkim_domains": ["vpb.com.vn"],
            "min_bond": "0",
            "bond_per_job_bps": 0,
            "min_order_amount": "100000",
            "bond_hold_ns": "86400000000000",
            "challenge_window_ns": "0",
            "claim_timeout_ns": "900000000000",
            "proof_timeout_ns": "7200000000000",
            "rating_window_ns": "604800000000000",
            "max_email_skew_ns": "600000000000",
            "rating_unit": "1000000",
            "max_orders": 1000,
            "max_profiles": 1000,
            "paused": false
        });
        if !legacy {
            for field in [
                "verifier_source",
                "secrets_profile",
                "allowed_dkim_domains",
                "claim_timeout_ns",
                "proof_timeout_ns",
            ] {
                config.as_object_mut().unwrap().remove(field);
            }
            config["kinds"] = json!({"bank_transfer": {
                "enabled": true,
                "verifier_source": r#"{"Project":{"project_id":"escrow.test.near/email-verifier","version_key":null}}"#,
                "secrets_ref": {"profile":"default", "account_id": escrow.id()},
                "access": "approved", "needs_sent": true,
                "claim_timeout_ns": "900000000000", "proof_timeout_ns":"7200000000000",
                "max_deadline_ns":"86400000000000"
            }});
        }
        escrow
            .call("new")
            .args_json(json!({"config": config}))
            .transact()
            .await?
            .into_result()?;

        Ok(Self {
            _worker: worker,
            intents,
            usdc,
            outlayer,
            escrow,
            relayer,
            arbiter,
            token,
        })
    }

    /// Top up a user's intents balance (stands in for 1Click `recipientType: INTENTS`).
    async fn deposit(&self, user: &User, amount: u128) -> anyhow::Result<()> {
        self.relayer
            .call(self.usdc.id(), "ft_transfer_call")
            .args_json(json!({"receiver_id": self.intents.id(), "amount": amount.to_string(), "msg": user.id()}))
            .deposit(NearToken::from_yoctonear(1))
            .gas(Gas::from_tgas(300))
            .transact()
            .await?
            .into_result()?;
        Ok(())
    }

    async fn balance(&self, account: &str) -> anyhow::Result<u128> {
        let v: String = self
            .intents
            .view("mt_balance_of")
            .args_json(json!({"account_id": account, "token_id": self.token}))
            .await?
            .json()?;
        Ok(v.parse()?)
    }

    /// Relayer submits the signed intents. Returns receipt failure messages.
    async fn execute(&self, signed: Value) -> anyhow::Result<Vec<String>> {
        let res = self
            .relayer
            .call(self.intents.id(), "execute_intents")
            .args_json(json!({"signed": [signed]}))
            .gas(Gas::from_tgas(300))
            .transact()
            .await?;
        assert!(
            res.is_success() || !res.receipt_failures().is_empty(),
            "{res:?}"
        );
        eprintln!(
            "execute_intents: gas burnt {} TGas, receipt failures {}",
            res.total_gas_burnt.as_tgas(),
            res.receipt_failures().len()
        );
        Ok(res
            .receipt_failures()
            .iter()
            .map(|f| format!("{:?}", (*f).clone().into_result().unwrap_err()))
            .collect())
    }

    async fn auth(
        &self,
        user: &User,
        msg: Value,
        min_gas_tgas: u64,
    ) -> anyhow::Result<Vec<String>> {
        let intent = json!([{
            "intent": "auth_call",
            "contract_id": self.escrow.id(),
            "msg": msg.to_string(),
            "min_gas": (min_gas_tgas * 1_000_000_000_000).to_string(),
        }]);
        self.execute(user.sign(self.intents.id(), intent)).await
    }

    async fn fund(&self, buyer: &User, id: &str, amount: u128) -> anyhow::Result<Vec<String>> {
        self.fund_with(buyer, id, amount, 2_000_000, 100_000).await
    }

    async fn fund_with(
        &self,
        buyer: &User,
        id: &str,
        amount: u128,
        pay: u128,
        reward: u128,
    ) -> anyhow::Result<Vec<String>> {
        let deadline = now_ns() + 24 * 3_600 * 1_000_000_000;
        let msg = json!({"op": "fund", "order": {
            "id": id, "kind":"bank_transfer", "spec_hash": bank_spec_hash(),
            "pay_amount": pay.to_string(), "reward": reward.to_string(), "deadline_ns": deadline.to_string()
        }});
        let intent = json!([{
            "intent": "transfer",
            "receiver_id": self.escrow.id(),
            "tokens": {self.token.clone(): amount.to_string()},
            "msg": msg.to_string(),
        }]);
        self.execute(buyer.sign(self.intents.id(), intent)).await
    }

    async fn fund_person(
        &self,
        buyer: &User,
        id: &str,
        secret: &[u8; 32],
        deadline_ns: u64,
    ) -> anyhow::Result<Vec<String>> {
        let spec = person_spec(secret);
        let msg = json!({"op":"fund","spec":spec,"order":{
            "id":id,"kind":"in_person","spec_hash":hex::encode(Sha256::digest(spec.as_bytes())),
            "pay_amount":"1000000","reward":"50000","deadline_ns":deadline_ns.to_string()
        }});
        let intent = json!([{
            "intent":"transfer","receiver_id":self.escrow.id(),
            "tokens":{self.token.clone(): PERSON_VALUE.to_string()},"msg":msg.to_string()
        }]);
        self.execute(buyer.sign(self.intents.id(), intent)).await
    }

    async fn fund_token_buy(&self, buyer: &User, id: &str) -> anyhow::Result<Vec<String>> {
        let spec = token_buy_spec(&buyer.id());
        let msg = json!({"op":"fund","order":{
            "id":id,"kind":"token_buy","spec_hash":hex::encode(Sha256::digest(spec.as_bytes())),
            "pay_amount":"2000000","reward":"100000",
            "deadline_ns":(now_ns() + 60 * 60 * 1_000_000_000).to_string()
        }});
        let intent = json!([{
            "intent":"transfer","receiver_id":self.escrow.id(),
            "tokens":{self.token.clone():TOKEN_BUY_VALUE.to_string()},"msg":msg.to_string()
        }]);
        self.execute(buyer.sign(self.intents.id(), intent)).await
    }

    async fn order(&self, id: &str) -> anyhow::Result<Value> {
        Ok(self
            .escrow
            .view("get_order")
            .args_json(json!({"id": id}))
            .await?
            .json()?)
    }

    async fn set_worker_response(&self, response: Value, fail: bool) -> anyhow::Result<()> {
        self.outlayer
            .call("set_response")
            .args_json(json!({"response": response.to_string(), "fail": fail}))
            .transact()
            .await?
            .into_result()?;
        Ok(())
    }

    /// Owner (= the escrow account here) approves a fulfiller.
    async fn approve(&self, user: &User) -> anyhow::Result<()> {
        self.escrow
            .as_account()
            .call(self.escrow.id(), "approve_fulfiller")
            .args_json(json!({"account_id": user.id(), "approved": true}))
            .deposit(NearToken::from_yoctonear(1))
            .transact()
            .await?
            .into_result()?;
        Ok(())
    }

    /// fund -> register -> approve -> claim -> sent, returns (buyer, fulfiller)
    async fn sent_order(&self, id: &str) -> anyhow::Result<(User, User)> {
        let buyer = User::new();
        let ful = User::new();
        self.deposit(&buyer, ORDER_VALUE).await?;
        assert!(self.fund(&buyer, id, ORDER_VALUE).await?.is_empty());
        assert_eq!(self.order(id).await?["status"], "funded");
        let f = self
            .auth(
                &ful,
                json!({"op":"register_fulfiller","bank_bin":"970436","account_last4":"1234"}),
                20,
            )
            .await?;
        assert!(f.is_empty(), "{f:?}");
        self.approve(&ful).await?;
        assert!(self
            .auth(&ful, json!({"op":"claim","order_id": id}), 20)
            .await?
            .is_empty());
        assert_eq!(self.order(id).await?["status"], "claimed");
        assert!(self
            .auth(&ful, json!({"op":"sent","order_id": id}), 20)
            .await?
            .is_empty());
        assert_eq!(self.order(id).await?["status"], "sent");
        Ok((buyer, ful))
    }
}

fn now_ns() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_nanos() as u64
}

fn worker_ok(id: &str, tx_ref: &str) -> Value {
    json!({
        "ok": true, "order_id": id, "proof_sha256": PROOF,
        "spec_hash":bank_spec_hash(), "nullifier":tx_ref,
        "completed_at_ns":now_ns().to_string()
    })
}

#[tokio::test]
#[ignore = "needs wasm artifacts: run contracts/escrow/tests/build-test-deps.sh"]
async fn sandbox_happy_path_cancel_and_rejection() -> anyhow::Result<()> {
    let env = Env::new().await?;
    let escrow = env.escrow.id().to_string();

    // ---------------- happy path: signed transfer -> claim -> sent -> proof -> payout
    let (buyer, ful) = env.sent_order("FUL-0001").await?;
    assert_eq!(env.balance(&buyer.id()).await?, 0);
    assert_eq!(env.balance(&escrow).await?, ORDER_VALUE);
    assert_eq!(env.balance(&ful.id()).await?, 0);

    let tx_ref = "aa".repeat(32);
    env.set_worker_response(
        json!({"success": true, "output": worker_ok("FUL-0001", &tx_ref)}),
        false,
    )
    .await?;
    let f = env
        .auth(
            &ful,
            json!({"op":"submit_proof","order_id":"FUL-0001","proof_sha256":PROOF,"spec":bank_spec()}),
            200,
        )
        .await?;
    assert!(f.is_empty(), "{f:?}");
    let o = env.order("FUL-0001").await?;
    assert_eq!(o["status"], "paid", "{o}");
    assert_eq!(o["nullifier"], tx_ref);
    assert_eq!(
        env.balance(&ful.id()).await?,
        ORDER_VALUE,
        "fulfiller paid inside intents"
    );
    eprintln!(
        "HAPPY PATH: order {} -> fulfiller intents balance {}",
        o["status"],
        env.balance(&ful.id()).await?
    );
    assert_eq!(env.balance(&escrow).await?, 0);

    // OutLayer was called with the agreed args
    let req: Value =
        serde_json::from_str(&env.outlayer.view("last_request").await?.json::<String>()?)?;
    assert_eq!(req["predecessor"], escrow);
    assert_eq!(req["response_format"], "Json");
    assert_eq!(req["payer_account_id"], escrow);
    assert_eq!(req["secrets_ref"]["profile"], "default");
    assert_eq!(req["deposit"], "10000000000000000000000");
    let input: Value = serde_json::from_str(req["input_data"].as_str().unwrap())?;
    assert_eq!(input["order_id"], "FUL-0001");
    assert_eq!(
        input["blob_url"],
        format!("https://api.example/proof-blob/{PROOF}")
    );

    // fulfiller rates the buyer, buyer rates the fulfiller (weighted 2 = 2.1 USDC)
    assert!(env
        .auth(
            &buyer,
            json!({"op":"rate","order_id":"FUL-0001","stars":5}),
            20
        )
        .await?
        .is_empty());
    let p: Value = env
        .escrow
        .view("get_profile")
        .args_json(json!({"account_id": ful.id()}))
        .await?
        .json()?;
    assert_eq!(p["stats"]["jobs_done"], 1);
    assert_eq!(p["stats"]["star_sum"], 10);

    // ---------------- cancel refund
    let buyer2 = User::new();
    env.deposit(&buyer2, ORDER_VALUE).await?;
    assert!(env.fund(&buyer2, "FUL-0002", ORDER_VALUE).await?.is_empty());
    assert_eq!(env.balance(&buyer2.id()).await?, 0);
    assert!(env
        .auth(&buyer2, json!({"op":"cancel","order_id":"FUL-0002"}), 20)
        .await?
        .is_empty());
    // cancelled orders are pruned at once
    assert!(env.order("FUL-0002").await?.is_null());
    assert_eq!(
        env.balance(&buyer2.id()).await?,
        ORDER_VALUE,
        "buyer refunded"
    );
    assert_eq!(env.balance(&escrow).await?, 0);

    // ---------------- wrong amount: mt_on_transfer panics, intents refunds the sender
    let buyer3 = User::new();
    env.deposit(&buyer3, ORDER_VALUE).await?;
    let f = env.fund(&buyer3, "FUL-0003", ORDER_VALUE - 1).await?;
    assert!(
        f.iter()
            .any(|e| e.contains("amount != pay_amount + reward")),
        "{f:?}"
    );
    assert_eq!(
        env.balance(&buyer3.id()).await?,
        ORDER_VALUE,
        "refunded by mt_resolve_transfer"
    );
    assert!(env.order("FUL-0003").await?.is_null());

    // A buyer cannot reserve the quote window for itself; Intents refunds it.
    let deadline = now_ns() + 3_600 * 1_000_000_000;
    let pin_msg = json!({"op":"fund","order":{
        "id":"FUL-PIN01","kind":"bank_transfer","spec_hash":bank_spec_hash(),
        "pay_amount":"2000000","reward":"100000","deadline_ns":deadline.to_string(),
        "quoted_by":buyer3.id()
    }});
    let pin_intent = json!([{"intent":"transfer","receiver_id":env.escrow.id(),
        "tokens":{env.token.clone():ORDER_VALUE.to_string()},"msg":pin_msg.to_string()}]);
    let failures = env
        .execute(buyer3.sign(env.intents.id(), pin_intent))
        .await?;
    assert!(
        failures
            .iter()
            .any(|e| e.contains("buyer cannot quote itself")),
        "{failures:?}"
    );
    assert_eq!(env.balance(&buyer3.id()).await?, ORDER_VALUE);
    assert!(env.order("FUL-PIN01").await?.is_null());

    // ---------------- rejected proof (amount too low), then nullifier replay
    let (_b4, ful4) = env.sent_order("FUL-0004").await?;
    let mut low = worker_ok("FUL-0004", &"bb".repeat(32));
    low["spec_hash"] = json!("00".repeat(32));
    env.set_worker_response(low, false).await?;
    assert!(env
        .auth(
            &ful4,
            json!({"op":"submit_proof","order_id":"FUL-0004","proof_sha256":PROOF,"spec":bank_spec()}),
            200
        )
        .await?
        .is_empty());
    let o = env.order("FUL-0004").await?;
    assert_eq!(o["status"], "proof_rejected", "{o}");
    assert_eq!(o["last_reject_reason"], "spec hash mismatch");
    assert_eq!(env.balance(&ful4.id()).await?, 0);
    assert_eq!(
        env.balance(&escrow).await?,
        ORDER_VALUE,
        "funds stay in escrow"
    );

    // resubmit with the bank ref already used by FUL-0001 -> rejected
    env.set_worker_response(worker_ok("FUL-0004", &tx_ref), false)
        .await?;
    env.auth(
        &ful4,
        json!({"op":"submit_proof","order_id":"FUL-0004","proof_sha256":PROOF,"spec":bank_spec()}),
        200,
    )
    .await?;
    let o = env.order("FUL-0004").await?;
    assert_eq!(o["last_reject_reason"], "nullifier already used", "{o}");

    // worker failure (promise fails) -> still recoverable; relayer path then pays
    env.set_worker_response(json!(null), true).await?;
    let _ = env
        .relayer
        .call(env.escrow.id(), "submit_proof")
        .args_json(json!({"order_id": "FUL-0004", "proof_sha256": PROOF,"spec":bank_spec()}))
        .gas(Gas::from_tgas(300))
        .transact()
        .await?;
    let o = env.order("FUL-0004").await?;
    assert_eq!(
        o["status"], "under_review",
        "3rd failed attempt -> under_review: {o}"
    );
    assert_eq!(o["last_reject_reason"], "outlayer call failed");
    // arbiter resolves for the fulfiller
    env.arbiter
        .call(env.escrow.id(), "resolve_dispute")
        .args_json(json!({"order_id": "FUL-0004", "verdict": "fulfiller", "note_hash": null}))
        .gas(Gas::from_tgas(300))
        .transact()
        .await?
        .into_result()?;
    assert_eq!(env.balance(&ful4.id()).await?, ORDER_VALUE);
    assert_eq!(env.balance(&escrow).await?, 0);

    // ---------------- sweep: a stray transfer (no msg) can be recovered, order funds cannot
    let (_b5, _f5) = env.sent_order("FUL-0005").await?;
    let stray = User::new();
    env.deposit(&stray, 500).await?;
    let intent = json!([{
        "intent": "transfer",
        "receiver_id": env.escrow.id(),
        "tokens": {env.token.clone(): "500"},
    }]);
    assert!(env
        .execute(stray.sign(env.intents.id(), intent))
        .await?
        .is_empty());
    assert_eq!(env.balance(&escrow).await?, ORDER_VALUE + 500);
    let sweep = |amount: &'static str| {
        env.escrow
            .as_account()
            .call(env.escrow.id(), "sweep")
            .args_json(
                json!({"token_id": env.token, "amount": amount, "receiver_id": env.arbiter.id()}),
            )
            .deposit(NearToken::from_yoctonear(1))
            .gas(Gas::from_tgas(100))
            .transact()
    };
    let r = sweep("501").await?;
    assert!(
        format!("{:?}", r.receipt_failures()).contains("amount exceeds stray balance"),
        "{r:?}"
    );
    assert_eq!(env.balance(&escrow).await?, ORDER_VALUE + 500);
    sweep("500").await?.into_result()?;
    assert_eq!(env.balance(&env.arbiter.id().to_string()).await?, 500);
    assert_eq!(
        env.balance(&escrow).await?,
        ORDER_VALUE,
        "order funds untouched"
    );
    Ok(())
}

#[tokio::test]
#[ignore = "needs wasm artifacts: run contracts/escrow/tests/build-test-deps.sh"]
async fn sandbox_guards() -> anyhow::Result<()> {
    let env = Env::new().await?;
    let (_buyer, _ful) = env.sent_order("FUL-0001").await?;
    let stranger = &env.arbiter;

    // on_auth / mt_on_transfer only from intents
    let r = stranger
        .call(env.escrow.id(), "on_auth")
        .args_json(
            json!({"signer_id": stranger.id(), "msg": r#"{"op":"cancel","order_id":"FUL-0001"}"#}),
        )
        .transact()
        .await?;
    assert!(format!("{:?}", r.into_result().unwrap_err()).contains("only intents contract"));
    let r = stranger
        .call(env.escrow.id(), "mt_on_transfer")
        .args_json(
            json!({"sender_id": stranger.id(), "previous_owner_ids": [stranger.id()],
            "token_ids": [env.token], "amounts": ["2100000"], "msg": r#"{"op":"bond"}"#}),
        )
        .transact()
        .await?;
    assert!(format!("{:?}", r.into_result().unwrap_err()).contains("only intents contract"));

    // callbacks are private
    for (m, args) in [
        (
            "on_verify_result",
            json!({"order_id": "FUL-0001", "attempt": 1}),
        ),
        (
            "on_sent",
            json!({"receiver_id": stranger.id(), "token_id": env.token, "amount": "1"}),
        ),
    ] {
        let r = stranger
            .call(env.escrow.id(), m)
            .args_json(args)
            .transact()
            .await?;
        assert!(
            format!("{:?}", r.into_result().unwrap_err()).contains("is private"),
            "{m} must be private"
        );
    }

    // relayer-only submit_proof
    let r = stranger
        .call(env.escrow.id(), "submit_proof")
        .args_json(json!({"order_id": "FUL-0001", "proof_sha256": PROOF,"spec":bank_spec()}))
        .gas(Gas::from_tgas(300))
        .transact()
        .await?;
    assert!(format!("{:?}", r.into_result().unwrap_err()).contains("only relayer"));

    // a second fulfiller cannot take a claimed order
    let other = User::new();
    env.auth(
        &other,
        json!({"op":"register_fulfiller","bank_bin":"970436","account_last4":"9999"}),
        20,
    )
    .await?;
    let f = env
        .auth(&other, json!({"op":"claim","order_id":"FUL-0001"}), 20)
        .await?;
    assert!(
        f.iter().any(|e| e.contains("fulfiller not approved")),
        "{f:?}"
    );
    env.approve(&other).await?;
    let f = env
        .auth(&other, json!({"op":"claim","order_id":"FUL-0001"}), 20)
        .await?;
    assert!(f.iter().any(|e| e.contains("already claimed")), "{f:?}");
    Ok(())
}

#[tokio::test]
#[ignore = "needs wasm artifacts and nearcore 2.14 sandbox"]
async fn sandbox_token_buy_fund_claim_verify_and_pay() -> anyhow::Result<()> {
    let env = Env::new().await?;
    let buyer = User::new();
    let fulfiller = User::new();
    let id = "FUL-TOKSANDBOX";
    let spec = token_buy_spec(&buyer.id());
    let spec_hash = hex::encode(Sha256::digest(spec.as_bytes()));
    env.deposit(&buyer, TOKEN_BUY_VALUE).await?;
    assert!(env.fund_token_buy(&buyer, id).await?.is_empty());
    assert!(env
        .auth(&fulfiller, json!({"op":"register_fulfiller"}), 20)
        .await?
        .is_empty());
    assert!(env
        .auth(&fulfiller, json!({"op":"claim","order_id":id}), 20)
        .await?
        .is_empty());
    assert_eq!(env.order(id).await?["bond_locked"], "0");
    env.set_worker_response(
        json!({
            "ok":true,"order_id":id,"proof_sha256":PROOF,"spec_hash":spec_hash,
            "nullifier":"ab".repeat(32),"completed_at_ns":now_ns().to_string()
        }),
        false,
    )
    .await?;
    let failures = env
        .auth(
            &fulfiller,
            json!({
                "op":"submit_proof","order_id":id,"proof_sha256":PROOF,"spec":spec
            }),
            200,
        )
        .await?;
    assert!(failures.is_empty(), "{failures:?}");
    assert_eq!(env.order(id).await?["status"], "paid");
    assert_eq!(env.balance(&fulfiller.id()).await?, TOKEN_BUY_VALUE);
    let request: Value =
        serde_json::from_str(&env.outlayer.view("last_request").await?.json::<String>()?)?;
    let input: Value = serde_json::from_str(request["input_data"].as_str().unwrap())?;
    assert_eq!(input["buyer"], buyer.id());
    assert_eq!(input["fulfiller"], fulfiller.id());
    assert_eq!(input["kind"], "token_buy");
    assert_eq!(
        request["source"],
        json!({"Project":{"project_id":"nearfullfil.near/token-verifier","version_key":null}})
    );
    Ok(())
}

#[tokio::test]
#[ignore = "needs prepared W10 wasm and nearcore 2.14 sandbox"]
async fn sandbox_upgrade_live_w10_preserves_in_flight_orders_without_migrate() -> anyhow::Result<()>
{
    let old_wasm = std::fs::read(format!(
        "{}/tests/res/escrow-w10-9052688c.wasm",
        env!("CARGO_MANIFEST_DIR")
    ))?;
    assert_eq!(
        hex::encode(Sha256::digest(&old_wasm)),
        "9052688c96451e8077e4098d7f61f2c9d15a197b55f4e7f7523e6741cc785d23"
    );
    let new_wasm = wasm(
        "ESCROW_WASM",
        "../../target/near/fulfil_escrow/fulfil_escrow.wasm",
    );
    let env = Env::with_escrow(&old_wasm, false).await?;
    let buyer = User::new();
    let fulfiller = User::new();
    env.deposit(&buyer, ORDER_VALUE + PERSON_VALUE).await?;
    assert!(env
        .fund(&buyer, "FUL-W10BANK", ORDER_VALUE)
        .await?
        .is_empty());
    assert!(env
        .fund_person(
            &buyer,
            "FUL-W10PERSON",
            &[7; 32],
            now_ns() + 60 * 60 * 1_000_000_000
        )
        .await?
        .is_empty());
    assert!(env
        .auth(&fulfiller, json!({"op":"register_fulfiller"}), 20)
        .await?
        .is_empty());
    assert!(env
        .auth(
            &fulfiller,
            json!({"op":"claim","order_id":"FUL-W10PERSON"}),
            20
        )
        .await?
        .is_empty());

    let before_config = view(&env.escrow, "get_config", json!({})).await?;
    let before_kinds = view(&env.escrow, "get_kinds", json!({})).await?;
    let before_bank = env.order("FUL-W10BANK").await?;
    let before_person = env.order("FUL-W10PERSON").await?;
    let before_counts = view(&env.escrow, "get_counts", json!({})).await?;
    let before_liabilities = view(
        &env.escrow,
        "get_liabilities",
        json!({"token_id":env.token}),
    )
    .await?;
    assert_eq!(before_bank["status"], "funded");
    assert_eq!(before_person["status"], "claimed");
    assert!(before_kinds["in_person"].is_object());
    assert!(before_kinds.get("token_buy").is_none());

    let owner = env.escrow.as_account().clone();
    owner.deploy(&new_wasm).await?.into_result()?;
    // The W10 Borsh root and collections remain unchanged; no migrate call.
    assert_eq!(
        view(&env.escrow, "get_config", json!({})).await?,
        before_config
    );
    assert_eq!(
        view(&env.escrow, "get_kinds", json!({})).await?,
        before_kinds
    );
    assert_eq!(env.order("FUL-W10BANK").await?, before_bank);
    assert_eq!(env.order("FUL-W10PERSON").await?, before_person);
    assert_eq!(
        view(&env.escrow, "get_counts", json!({})).await?,
        before_counts
    );
    assert_eq!(
        view(
            &env.escrow,
            "get_liabilities",
            json!({"token_id":env.token})
        )
        .await?,
        before_liabilities
    );

    owner.call(env.escrow.id(), "set_kind").args_json(json!({"kind":"token_buy","config":{
        "enabled":true,
        "verifier_source":r#"{"Project":{"project_id":"nearfullfil.near/token-verifier","version_key":null}}"#,
        "secrets_ref":{"profile":"default","account_id":env.escrow.id()},"access":"open","needs_sent":false,
        "claim_timeout_ns":"1200000000000","proof_timeout_ns":"1200000000000",
        "max_deadline_ns":"86400000000000","quote_exclusive_ns":"120000000000",
        "open_max_active_claims":1,"open_max_order_value":"5250000"
    }})).deposit(NearToken::from_yoctonear(1)).transact().await?.into_result()?;
    assert_eq!(
        view(&env.escrow, "get_kinds", json!({})).await?["token_buy"]["access"],
        "open"
    );
    let kinds = view(&env.escrow, "get_kinds", json!({})).await?;
    let token_kind = &kinds["token_buy"];
    assert_eq!(token_kind["claim_timeout_ns"], "1200000000000");
    assert_eq!(token_kind["proof_timeout_ns"], "1200000000000");
    assert_eq!(token_kind["open_max_order_value"], "5250000");
    assert_eq!(
        token_kind["secrets_ref"]["account_id"],
        env.escrow.id().as_str()
    );
    let next_buyer = User::new();
    let next_fulfiller = User::new();
    let id = "FUL-W10TOKEN";
    env.deposit(&next_buyer, TOKEN_BUY_VALUE).await?;
    assert!(env.fund_token_buy(&next_buyer, id).await?.is_empty());
    assert!(env
        .auth(&next_fulfiller, json!({"op":"register_fulfiller"}), 20)
        .await?
        .is_empty());
    assert!(env
        .auth(&next_fulfiller, json!({"op":"claim","order_id":id}), 20)
        .await?
        .is_empty());
    let spec = token_buy_spec(&next_buyer.id());
    env.set_worker_response(
        json!({"ok":true,"order_id":id,"proof_sha256":PROOF,
        "spec_hash":hex::encode(Sha256::digest(spec.as_bytes())),"nullifier":"cd".repeat(32),
        "completed_at_ns":now_ns().to_string()}),
        false,
    )
    .await?;
    assert!(env
        .auth(
            &next_fulfiller,
            json!({"op":"submit_proof","order_id":id,
        "proof_sha256":PROOF,"spec":spec}),
            200
        )
        .await?
        .is_empty());
    assert_eq!(env.order(id).await?["status"], "paid");
    assert_eq!(env.balance(&next_fulfiller.id()).await?, TOKEN_BUY_VALUE);
    assert_eq!(env.order("FUL-W10PERSON").await?["status"], "claimed");
    Ok(())
}

#[tokio::test]
#[ignore = "needs wasm artifacts and nearcore 2.14 sandbox"]
async fn sandbox_in_person_delivery_and_refund() -> anyhow::Result<()> {
    let env = Env::new().await?;
    let buyer = User::new();
    let ful = User::new();
    let other = User::new();
    let secret = [7_u8; 32];
    let code = hex::encode(secret);
    env.deposit(&buyer, PERSON_VALUE * 3).await?;
    assert!(env
        .fund_person(
            &buyer,
            "FUL-PERS01",
            &secret,
            now_ns() + 24 * 3_600 * 1_000_000_000
        )
        .await?
        .is_empty());
    assert!(env
        .auth(&ful, json!({"op":"register_fulfiller"}), 20)
        .await?
        .is_empty());
    assert!(env
        .auth(&ful, json!({"op":"claim","order_id":"FUL-PERS01"}), 20)
        .await?
        .is_empty());

    let rejected_sent = env
        .auth(&ful, json!({"op":"sent","order_id":"FUL-PERS01"}), 20)
        .await?;
    assert!(
        rejected_sent
            .iter()
            .any(|message| message.contains("sent not allowed for in_person")),
        "{rejected_sent:?}"
    );
    assert_eq!(env.order("FUL-PERS01").await?["status"], "claimed");

    let bad_caller = env
        .auth(
            &other,
            json!({"op":"confirm_delivery","order_id":"FUL-PERS01","secret_hex":code}),
            80,
        )
        .await?;
    assert!(
        bad_caller
            .iter()
            .any(|message| message.contains("not the fulfiller")),
        "{bad_caller:?}"
    );
    assert_eq!(env.order("FUL-PERS01").await?["total_proof_attempts"], 0);
    for bad in ["07".to_string(), "00".repeat(32)] {
        assert!(env
            .auth(
                &ful,
                json!({"op":"confirm_delivery","order_id":"FUL-PERS01","secret_hex":bad}),
                80
            )
            .await?
            .is_empty());
    }
    assert_eq!(env.order("FUL-PERS01").await?["status"], "claimed");
    assert_eq!(env.order("FUL-PERS01").await?["total_proof_attempts"], 2);
    assert!(env
        .auth(
            &ful,
            json!({"op":"confirm_delivery","order_id":"FUL-PERS01","secret_hex":code}),
            80
        )
        .await?
        .is_empty());
    assert_eq!(env.order("FUL-PERS01").await?["status"], "paid");
    assert_eq!(env.balance(&ful.id()).await?, PERSON_VALUE);
    let replay = env
        .auth(
            &ful,
            json!({"op":"confirm_delivery","order_id":"FUL-PERS01","secret_hex":code}),
            80,
        )
        .await?;
    assert!(
        replay.iter().any(|message| message.contains("not claimed")),
        "{replay:?}"
    );

    assert!(env
        .fund_person(
            &buyer,
            "FUL-PERS02",
            &secret,
            now_ns() + 24 * 3_600 * 1_000_000_000
        )
        .await?
        .is_empty());
    assert!(env
        .auth(&ful, json!({"op":"claim","order_id":"FUL-PERS02"}), 20)
        .await?
        .is_empty());
    for _ in 0..6 {
        assert!(env.auth(&ful,
            json!({"op":"confirm_delivery","order_id":"FUL-PERS02","secret_hex":"00".repeat(32)}), 80)
            .await?.is_empty());
    }
    let exhausted = env
        .auth(
            &ful,
            json!({"op":"confirm_delivery","order_id":"FUL-PERS02","secret_hex":code}),
            80,
        )
        .await?;
    assert!(
        exhausted
            .iter()
            .any(|message| message.contains("proof budget used")),
        "{exhausted:?}"
    );
    assert_eq!(env.order("FUL-PERS02").await?["status"], "claimed");

    assert!(env
        .fund_person(
            &buyer,
            "FUL-PERS03",
            &secret,
            now_ns() + 5 * 60 * 1_000_000_000
        )
        .await?
        .is_empty());
    let deadline: u64 = env.order("FUL-PERS03").await?["deadline_ns"]
        .as_str()
        .unwrap()
        .parse()?;
    for _ in 0..10 {
        if env._worker.view_block().await?.timestamp() >= deadline {
            break;
        }
        env._worker.fast_forward(1_500).await?;
    }
    assert!(env._worker.view_block().await?.timestamp() >= deadline);
    env.relayer
        .call(env.escrow.id(), "expire")
        .args_json(json!({"order_id":"FUL-PERS03"}))
        .gas(Gas::from_tgas(100))
        .transact()
        .await?
        .into_result()?;
    assert!(env.order("FUL-PERS03").await?.is_null());
    assert_eq!(env.balance(&buyer.id()).await?, PERSON_VALUE);

    let bank = User::new();
    env.deposit(&bank, ORDER_VALUE).await?;
    assert!(env.fund(&bank, "FUL-BANK01", ORDER_VALUE).await?.is_empty());
    let wrong_kind = env
        .relayer
        .call(env.escrow.id(), "confirm_delivery")
        .args_json(json!({"order_id":"FUL-BANK01","secret_hex":code}))
        .transact()
        .await?;
    assert!(format!("{:?}", wrong_kind.receipt_failures()).contains("not an in_person order"));
    Ok(())
}

async fn view(c: &Contract, method: &str, args: Value) -> anyhow::Result<Value> {
    Ok(c.view(method).args_json(args).await?.json()?)
}

#[tokio::test]
#[ignore = "needs wasm artifacts and nearcore 2.14 sandbox"]
async fn sandbox_upgrade_c0740f2_migrate_then_cryptorefills() -> anyhow::Result<()> {
    let old_wasm = wasm("ESCROW_C0740F2_WASM", "tests/res/escrow-c0740f2.wasm");
    let new_wasm = wasm(
        "ESCROW_WASM",
        "../../target/near/fulfil_escrow/fulfil_escrow.wasm",
    );
    let env = Env::with_escrow(&old_wasm, true).await?;
    let owner = env.escrow.as_account().clone();
    let buyer = User::new();
    let fulfiller = User::new();
    let old_id = "FUL-0001";
    let old_nullifier = "ab".repeat(32);

    let failures = env
        .auth(
            &fulfiller,
            json!({"op":"register_fulfiller","bank_bin":"970436","account_last4":"1234"}),
            20,
        )
        .await?;
    assert!(failures.is_empty(), "{failures:?}");
    env.approve(&fulfiller).await?;
    env.deposit(&fulfiller, 1_000_000).await?;
    let bond_intent = json!([{"intent":"transfer","receiver_id":env.escrow.id(),"tokens":{env.token.clone():"1000000"},"msg":json!({"op":"bond"}).to_string()}]);
    let failures = env
        .execute(fulfiller.sign(env.intents.id(), bond_intent))
        .await?;
    assert!(failures.is_empty(), "{failures:?}");

    env.deposit(&buyer, ORDER_VALUE).await?;
    let old_fund = json!({"op":"fund","order":{"id":old_id,"amount_vnd":50000,"merchant_hash":MH,
        "pay_amount":"2000000","reward":"100000","deadline_ns":(now_ns() + 24 * 3_600 * 1_000_000_000).to_string()}});
    let old_intent = json!([{"intent":"transfer","receiver_id":env.escrow.id(),"tokens":{env.token.clone():ORDER_VALUE.to_string()},"msg":old_fund.to_string()}]);
    let failures = env
        .execute(buyer.sign(env.intents.id(), old_intent))
        .await?;
    assert!(failures.is_empty(), "{failures:?}");
    assert!(env
        .auth(&fulfiller, json!({"op":"claim","order_id":old_id}), 20)
        .await?
        .is_empty());
    env.set_worker_response(
        json!({"success":true,"output":{"ok":true,"order_id":old_id,"proof_sha256":PROOF,
        "amount_vnd":50000,"credit_account_hash":MH,"note":old_id,"tx_ref_hash":old_nullifier,
        "email_ts_ns":now_ns().to_string(),"dkim_domain":"vpb.com.vn"}}),
        false,
    )
    .await?;
    let failures = env
        .auth(
            &fulfiller,
            json!({"op":"submit_proof","order_id":old_id,"proof_sha256":PROOF}),
            200,
        )
        .await?;
    assert!(failures.is_empty(), "{failures:?}");
    assert_eq!(env.order(old_id).await?["status"], "paid");
    for who in [&buyer, &fulfiller] {
        assert!(env
            .auth(who, json!({"op":"rate","order_id":old_id,"stars":5}), 20)
            .await?
            .is_empty());
    }
    let before_fulfiller = view(
        &env.escrow,
        "get_profile",
        json!({"account_id":fulfiller.id()}),
    )
    .await?;
    let before_buyer = view(&env.escrow, "get_profile", json!({"account_id":buyer.id()})).await?;
    let before_weights = view(
        &env.escrow,
        "get_rating_weights",
        json!({"order_id":old_id}),
    )
    .await?;
    let before_liability = view(
        &env.escrow,
        "get_liabilities",
        json!({"token_id":env.token}),
    )
    .await?;
    let before_counts = view(&env.escrow, "get_counts", json!({})).await?;

    owner.deploy(&new_wasm).await?.into_result()?;
    owner
        .call(env.escrow.id(), "migrate")
        .args_json(json!({}))
        .gas(Gas::from_tgas(300))
        .transact()
        .await?
        .into_result()?;
    let old_order = env.order(old_id).await?;
    assert_eq!(old_order["kind"], "bank_transfer");
    assert_eq!(
        old_order["spec_hash"],
        "934777bfbd571fc8646e933c633954a1c43501516ead98d6847b78de31a89993"
    );
    assert_eq!(old_order["status"], "paid");
    assert_eq!(old_order["verify_seq"], 0);
    assert_eq!(old_order["total_proof_attempts"], 0);
    assert_eq!(old_order["buyer_rating"], 5);
    assert_eq!(old_order["fulfiller_rating"], 5);
    assert_eq!(
        view(
            &env.escrow,
            "get_profile",
            json!({"account_id":fulfiller.id()})
        )
        .await?,
        before_fulfiller
    );
    assert_eq!(
        view(&env.escrow, "get_profile", json!({"account_id":buyer.id()})).await?,
        before_buyer
    );
    assert_eq!(
        view(
            &env.escrow,
            "get_rating_weights",
            json!({"order_id":old_id})
        )
        .await?,
        before_weights
    );
    assert_eq!(
        view(
            &env.escrow,
            "get_liabilities",
            json!({"token_id":env.token})
        )
        .await?,
        before_liability
    );
    assert_eq!(
        view(&env.escrow, "get_counts", json!({})).await?,
        before_counts
    );
    assert_eq!(
        view(
            &env.escrow,
            "is_nullifier_used",
            json!({"tx_ref_hash":old_nullifier})
        )
        .await?,
        old_id
    );
    assert_eq!(
        view(
            &env.escrow,
            "get_owed",
            json!({"account_id":fulfiller.id(),"token_id":env.token})
        )
        .await?,
        "0"
    );
    assert_eq!(
        view(&env.escrow, "get_kinds", json!({})).await?["bank_transfer"]["access"],
        "approved"
    );

    let source = r#"{"Project":{"project_id":"escrow.test.near/cryptorefills-verifier","version_key":null}}"#;
    owner.call(env.escrow.id(), "set_kind").args_json(json!({"kind":"cryptorefills_topup","config":{
        "enabled":true,"verifier_source":source,"secrets_ref":null,"access":"open","needs_sent":false,
        "claim_timeout_ns":"900000000000","proof_timeout_ns":"1800000000000","max_deadline_ns":"1800000000000"
    }})).deposit(NearToken::from_yoctonear(1)).transact().await?.into_result()?;
    let topup_spec = r#"{"beneficiary_hash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","v":1}"#;
    let topup_hash = hex::encode(Sha256::digest(topup_spec.as_bytes()));
    let topup_buyer = User::new();
    let topup_fulfiller = User::new();
    env.deposit(&topup_buyer, ORDER_VALUE).await?;
    let topup_id = "FUL-0002";
    let topup_fund = json!({"op":"fund","order":{"id":topup_id,"kind":"cryptorefills_topup","spec_hash":topup_hash,
        "pay_amount":"2000000","reward":"100000","deadline_ns":(now_ns() + 30 * 60 * 1_000_000_000).to_string()}});
    let topup_intent = json!([{"intent":"transfer","receiver_id":env.escrow.id(),"tokens":{env.token.clone():ORDER_VALUE.to_string()},"msg":topup_fund.to_string()}]);
    let failures = env
        .execute(topup_buyer.sign(env.intents.id(), topup_intent))
        .await?;
    assert!(failures.is_empty(), "{failures:?}");
    assert!(env
        .auth(&topup_fulfiller, json!({"op":"register_fulfiller"}), 20)
        .await?
        .is_empty());
    assert!(env
        .auth(
            &topup_fulfiller,
            json!({"op":"claim","order_id":topup_id}),
            20
        )
        .await?
        .is_empty());
    env.set_worker_response(
        json!({"ok":true,"order_id":topup_id,"proof_sha256":PROOF,"spec_hash":topup_hash,
        "nullifier":"cd".repeat(32),"completed_at_ns":now_ns().to_string()}),
        false,
    )
    .await?;
    let failures = env
        .auth(
            &topup_fulfiller,
            json!({"op":"submit_proof","order_id":topup_id,"proof_sha256":PROOF,"spec":topup_spec}),
            200,
        )
        .await?;
    assert!(failures.is_empty(), "{failures:?}");
    let topup_order = env.order(topup_id).await?;
    assert_eq!(topup_order["status"], "paid");
    assert_eq!(topup_order["verify_seq"], 1);
    assert_eq!(topup_order["total_proof_attempts"], 1);
    assert_eq!(env.balance(&topup_fulfiller.id()).await?, ORDER_VALUE);
    Ok(())
}

#[tokio::test]
#[ignore = "needs prepared wasm artifacts and nearcore 2.14 sandbox"]
async fn sandbox_upgrade_live_w9_preserves_in_flight_orders_without_migrate() -> anyhow::Result<()>
{
    let old_wasm = std::fs::read(format!(
        "{}/tests/res/escrow-w9-ca2fff3c.wasm",
        env!("CARGO_MANIFEST_DIR")
    ))?;
    assert_eq!(
        hex::encode(Sha256::digest(&old_wasm)),
        "ca2fff3c36b58b188b8aef8507d556fdd150ac2167286b6f5f184992d75368dd"
    );
    let new_wasm = wasm(
        "ESCROW_WASM",
        "../../target/near/fulfil_escrow/fulfil_escrow.wasm",
    );
    let env = Env::with_escrow(&old_wasm, false).await?;
    let owner = env.escrow.as_account().clone();
    let buyer = User::new();
    let fulfiller = User::new();
    let ids = [
        "FUL-W9FUNDED",
        "FUL-W9CLAIMED",
        "FUL-W9SENT",
        "FUL-W9REJECT",
        "FUL-W9PAID",
    ];

    let mut config = view(&env.escrow, "get_config", json!({})).await?;
    config["min_bond"] = json!("100000");
    config["bond_per_job_bps"] = json!(1_000);
    config["bond_hold_ns"] = json!("60000000000");
    owner
        .call(env.escrow.id(), "update_config")
        .args_json(json!({"config":config}))
        .deposit(NearToken::from_yoctonear(1))
        .transact()
        .await?
        .into_result()?;

    assert!(env
        .auth(
            &fulfiller,
            json!({"op":"register_fulfiller","bank_bin":"970436","account_last4":"1234"}),
            20,
        )
        .await?
        .is_empty());
    env.approve(&fulfiller).await?;
    env.deposit(&fulfiller, 1_000_000).await?;
    let bond_intent = json!([{"intent":"transfer","receiver_id":env.escrow.id(),
        "tokens":{env.token.clone():"1000000"},"msg":json!({"op":"bond"}).to_string()}]);
    let failures = env
        .execute(fulfiller.sign(env.intents.id(), bond_intent))
        .await?;
    assert!(failures.is_empty(), "{failures:?}");

    env.deposit(&buyer, ORDER_VALUE * ids.len() as u128).await?;
    for id in ids {
        let fund = json!({"op":"fund","order":{"id":id,"kind":"bank_transfer",
            "spec_hash":bank_spec_hash(),"pay_amount":"2000000","reward":"100000",
            "deadline_ns":(now_ns() + 10 * 60 * 1_000_000_000).to_string()}});
        let intent = json!([{"intent":"transfer","receiver_id":env.escrow.id(),
            "tokens":{env.token.clone():ORDER_VALUE.to_string()},"msg":fund.to_string()}]);
        let failures = env.execute(buyer.sign(env.intents.id(), intent)).await?;
        assert!(failures.is_empty(), "{id}: {failures:?}");
    }
    assert_eq!(env.balance(&buyer.id()).await?, 0);

    // Pay one job first so the same fulfiller can hold the other three claims.
    assert!(env
        .auth(&fulfiller, json!({"op":"claim","order_id":ids[4]}), 20,)
        .await?
        .is_empty());
    assert!(env
        .auth(&fulfiller, json!({"op":"sent","order_id":ids[4]}), 20)
        .await?
        .is_empty());
    env.set_worker_response(worker_ok(ids[4], &"a1".repeat(32)), false)
        .await?;
    let failures = env
        .auth(
            &fulfiller,
            json!({"op":"submit_proof","order_id":ids[4],"proof_sha256":PROOF,"spec":bank_spec()}),
            200,
        )
        .await?;
    assert!(failures.is_empty(), "{failures:?}");
    assert_eq!(env.order(ids[4]).await?["status"], "paid");
    for user in [&buyer, &fulfiller] {
        assert!(env
            .auth(user, json!({"op":"rate","order_id":ids[4],"stars":5}), 20)
            .await?
            .is_empty());
    }

    for id in &ids[1..4] {
        assert!(env
            .auth(&fulfiller, json!({"op":"claim","order_id":id}), 20)
            .await?
            .is_empty());
    }
    for id in &ids[2..4] {
        assert!(env
            .auth(&fulfiller, json!({"op":"sent","order_id":id}), 20)
            .await?
            .is_empty());
    }
    env.set_worker_response(json!({"ok":false}), false).await?;
    let failures = env
        .auth(
            &fulfiller,
            json!({"op":"submit_proof","order_id":ids[3],"proof_sha256":PROOF,"spec":bank_spec()}),
            200,
        )
        .await?;
    assert!(failures.is_empty(), "{failures:?}");
    for (id, expected) in ids
        .iter()
        .zip(["funded", "claimed", "sent", "proof_rejected", "paid"])
    {
        assert_eq!(env.order(id).await?["status"], expected, "{id}");
    }

    let before_config = view(&env.escrow, "get_config", json!({})).await?;
    let before_kinds = view(&env.escrow, "get_kinds", json!({})).await?;
    let mut before_orders = Vec::new();
    for id in ids {
        before_orders.push(env.order(id).await?);
    }
    let before_buyer = view(&env.escrow, "get_profile", json!({"account_id":buyer.id()})).await?;
    let before_fulfiller = view(
        &env.escrow,
        "get_profile",
        json!({"account_id":fulfiller.id()}),
    )
    .await?;
    let before_counts = view(&env.escrow, "get_counts", json!({})).await?;
    let before_liabilities = view(
        &env.escrow,
        "get_liabilities",
        json!({"token_id":env.token}),
    )
    .await?;
    assert_eq!(before_buyer["stats"]["open_as_buyer"], 4);
    assert_eq!(before_fulfiller["stats"]["active_claims"], 3);
    assert_eq!(before_fulfiller["bond"]["locked"], "840000");
    assert_eq!(before_liabilities, "9400000");

    owner.deploy(&new_wasm).await?.into_result()?;
    // W9 root and collection layouts are unchanged: deliberately no migrate call.
    assert_eq!(
        view(&env.escrow, "get_config", json!({})).await?,
        before_config
    );
    assert_eq!(
        view(&env.escrow, "get_kinds", json!({})).await?,
        before_kinds
    );
    for (id, before) in ids.iter().zip(before_orders) {
        assert_eq!(env.order(id).await?, before, "{id}");
    }
    assert_eq!(
        view(&env.escrow, "get_profile", json!({"account_id":buyer.id()})).await?,
        before_buyer
    );
    assert_eq!(
        view(
            &env.escrow,
            "get_profile",
            json!({"account_id":fulfiller.id()})
        )
        .await?,
        before_fulfiller
    );
    assert_eq!(
        view(&env.escrow, "get_counts", json!({})).await?,
        before_counts
    );
    assert_eq!(
        view(
            &env.escrow,
            "get_liabilities",
            json!({"token_id":env.token})
        )
        .await?,
        before_liabilities
    );
    assert_eq!(
        view(&env.escrow, "get_storage_reserve", json!({})).await?,
        "1000000000000000000000000"
    );
    // The sandbox escrow starts with 20 NEAR, so the 1 NEAR default needs no override.

    // Live W9 state receives the new kind through the existing owner call.
    owner
        .call(env.escrow.id(), "set_kind")
        .args_json(json!({"kind":"in_person","config":{
            "enabled":true,"verifier_source":"{}","secrets_ref":null,
            "access":"open","needs_sent":false,
            "claim_timeout_ns":"86400000000000","proof_timeout_ns":"86400000000000",
            "max_deadline_ns":"86400000000000","quote_exclusive_ns":"120000000000",
            "open_max_active_claims":1,"open_max_order_value":"20000000"
        }}))
        .deposit(NearToken::from_yoctonear(1))
        .transact()
        .await?
        .into_result()?;
    assert_eq!(
        view(&env.escrow, "get_kinds", json!({})).await?["in_person"]["access"],
        "open"
    );
    assert_eq!(
        view(&env.escrow, "get_kinds", json!({})).await?["in_person"]["claim_timeout_ns"],
        "86400000000000"
    );

    assert!(env
        .auth(&fulfiller, json!({"op":"sent","order_id":ids[1]}), 20)
        .await?
        .is_empty());
    for (id, nullifier) in [(ids[1], "b2"), (ids[2], "c3")] {
        env.set_worker_response(worker_ok(id, &nullifier.repeat(32)), false)
            .await?;
        let failures = env
            .auth(
                &fulfiller,
                json!({"op":"submit_proof","order_id":id,"proof_sha256":PROOF,"spec":bank_spec()}),
                200,
            )
            .await?;
        assert!(failures.is_empty(), "{id}: {failures:?}");
        assert_eq!(env.order(id).await?["status"], "paid", "{id}");
    }
    assert!(env
        .auth(&buyer, json!({"op":"cancel","order_id":ids[0]}), 20)
        .await?
        .is_empty());
    assert!(env.order(ids[0]).await?.is_null());
    assert_eq!(env.balance(&buyer.id()).await?, ORDER_VALUE);

    let deadline: u64 = env.order(ids[3]).await?["deadline_ns"]
        .as_str()
        .unwrap()
        .parse()?;
    for _ in 0..10 {
        if env._worker.view_block().await?.timestamp() >= deadline {
            break;
        }
        env._worker.fast_forward(1_500).await?;
    }
    assert!(env._worker.view_block().await?.timestamp() >= deadline);
    let premature_refund = env
        .relayer
        .call(env.escrow.id(), "expire")
        .args_json(json!({"order_id":ids[3]}))
        .gas(Gas::from_tgas(100))
        .transact()
        .await?;
    assert!(format!("{:?}", premature_refund.receipt_failures()).contains("not refundable"));
    env.relayer
        .call(env.escrow.id(), "timeout")
        .args_json(json!({"order_id":ids[3]}))
        .gas(Gas::from_tgas(100))
        .transact()
        .await?
        .into_result()?;
    assert_eq!(env.order(ids[3]).await?["status"], "under_review");
    assert_eq!(env.balance(&buyer.id()).await?, ORDER_VALUE);
    assert_eq!(
        view(
            &env.escrow,
            "get_profile",
            json!({"account_id":fulfiller.id()})
        )
        .await?["bond"]["locked"],
        "840000"
    );
    env.arbiter
        .call(env.escrow.id(), "resolve_dispute")
        .args_json(json!({"order_id":ids[3],"verdict":"fulfiller","note_hash":null}))
        .gas(Gas::from_tgas(100))
        .transact()
        .await?
        .into_result()?;
    assert_eq!(env.order(ids[3]).await?["status"], "resolved");
    assert_eq!(
        view(
            &env.escrow,
            "get_profile",
            json!({"account_id":fulfiller.id()})
        )
        .await?["bond"]["locked"],
        "630000"
    );
    for id in [ids[1], ids[2], ids[4]] {
        env.relayer
            .call(env.escrow.id(), "release_bond")
            .args_json(json!({"order_id":id}))
            .gas(Gas::from_tgas(100))
            .transact()
            .await?
            .into_result()?;
        assert_eq!(env.order(id).await?["status"], "closed");
    }
    let profile = view(
        &env.escrow,
        "get_profile",
        json!({"account_id":fulfiller.id()}),
    )
    .await?;
    assert_eq!(profile["stats"]["active_claims"], 0);
    assert_eq!(profile["bond"]["locked"], "0");
    assert_eq!(profile["bond"]["available"], "1000000");
    assert_eq!(env.balance(&fulfiller.id()).await?, ORDER_VALUE * 4);
    assert_eq!(env.balance(&env.escrow.id().to_string()).await?, 1_000_000);

    let failures = env
        .auth(
            &fulfiller,
            json!({"op":"withdraw_bond","amount":"1000000"}),
            20,
        )
        .await?;
    assert!(failures.is_empty(), "{failures:?}");
    assert_eq!(
        env.balance(&fulfiller.id()).await?,
        ORDER_VALUE * 4 + 1_000_000
    );
    assert_eq!(env.balance(&env.escrow.id().to_string()).await?, 0);
    assert_eq!(
        view(&env.escrow, "get_profile", json!({"account_id":buyer.id()})).await?["stats"]
            ["open_as_buyer"],
        0
    );
    assert_eq!(
        view(
            &env.escrow,
            "get_profile",
            json!({"account_id":fulfiller.id()})
        )
        .await?["bond"]["locked"],
        "0"
    );
    assert_eq!(
        view(
            &env.escrow,
            "get_liabilities",
            json!({"token_id":env.token})
        )
        .await?,
        "0"
    );
    Ok(())
}

#[tokio::test]
#[ignore = "needs wasm artifacts: uses prepared sandbox wasm"]
async fn sandbox_redteam_claim_cancel_release_refund_sequence() -> anyhow::Result<()> {
    let env = Env::new().await?;
    let buyer = User::new();
    let fulfiller = User::new();
    env.deposit(&buyer, ORDER_VALUE).await?;
    assert!(env
        .fund(&buyer, "FUL-REDTEAM", ORDER_VALUE)
        .await?
        .is_empty());
    assert!(env
        .auth(&fulfiller, json!({"op":"register_fulfiller"}), 20)
        .await?
        .is_empty());
    env.approve(&fulfiller).await?;
    assert!(env
        .auth(
            &fulfiller,
            json!({"op":"claim","order_id":"FUL-REDTEAM"}),
            20
        )
        .await?
        .is_empty());
    let failed_cancel = env
        .auth(&buyer, json!({"op":"cancel","order_id":"FUL-REDTEAM"}), 20)
        .await?;
    assert!(failed_cancel
        .iter()
        .any(|failure| failure.contains("not cancellable")));
    assert_eq!(env.order("FUL-REDTEAM").await?["status"], "claimed");
    assert_eq!(env.balance(&buyer.id()).await?, 0);

    assert!(env
        .auth(
            &fulfiller,
            json!({"op":"release_claim","order_id":"FUL-REDTEAM"}),
            20,
        )
        .await?
        .is_empty());
    assert_eq!(env.order("FUL-REDTEAM").await?["status"], "funded");
    assert!(env
        .auth(&buyer, json!({"op":"cancel","order_id":"FUL-REDTEAM"}), 20)
        .await?
        .is_empty());
    assert!(env.order("FUL-REDTEAM").await?.is_null());
    assert_eq!(env.balance(&buyer.id()).await?, ORDER_VALUE);
    let again = env
        .auth(&buyer, json!({"op":"cancel","order_id":"FUL-REDTEAM"}), 20)
        .await?;
    assert!(again
        .iter()
        .any(|failure| failure.contains("order not found")));
    assert_eq!(env.balance(&buyer.id()).await?, ORDER_VALUE);

    // A callback from an old proof request cannot revive an already refunded order.
    env.escrow
        .as_account()
        .call(env.escrow.id(), "on_verify_result")
        .args_json(json!({
            "order_id":"FUL-REDTEAM",
            "attempt":1,
            "verify_seq":1,
            "expected_fulfiller":fulfiller.id(),
            "expected_proof_sha256":PROOF,
        }))
        .transact()
        .await?
        .into_result()?;
    assert_eq!(env.balance(&buyer.id()).await?, ORDER_VALUE);
    assert!(env.order("FUL-REDTEAM").await?.is_null());

    // Direct NEP-141 transfer_call is not an order-funding entry point.
    env.relayer
        .call(env.usdc.id(), "storage_deposit")
        .args_json(json!({"account_id":env.escrow.id()}))
        .deposit(NearToken::from_millinear(10))
        .transact()
        .await?
        .into_result()?;
    let relayer_before: String = env
        .usdc
        .view("ft_balance_of")
        .args_json(json!({"account_id":env.relayer.id()}))
        .await?
        .json()?;
    let direct_message = json!({"op":"fund","order":{
        "id":"FUL-DIRECT","kind":"bank_transfer","spec_hash":bank_spec_hash(),
        "pay_amount":"2000000","reward":"100000",
        "deadline_ns":(now_ns() + 24 * 3_600 * 1_000_000_000).to_string()
    }});
    let direct = env
        .relayer
        .call(env.usdc.id(), "ft_transfer_call")
        .args_json(
            json!({"receiver_id":env.escrow.id(),"amount":ORDER_VALUE.to_string(),
            "msg":direct_message.to_string()}),
        )
        .deposit(NearToken::from_yoctonear(1))
        .gas(Gas::from_tgas(300))
        .transact()
        .await?;
    assert!(
        !direct.receipt_failures().is_empty(),
        "missing ft_on_transfer must fail"
    );
    let relayer_after: String = env
        .usdc
        .view("ft_balance_of")
        .args_json(json!({"account_id":env.relayer.id()}))
        .await?
        .json()?;
    assert_eq!(relayer_after, relayer_before);
    assert!(env.order("FUL-DIRECT").await?.is_null());

    // Deposit a second, unsupported FT into intents; the escrow receiver must
    // reject the fund and intents must resolve the whole amount to its sender.
    let root = env._worker.root_account()?;
    let other_account = root
        .create_subaccount("other")
        .initial_balance(NearToken::from_near(10))
        .transact()
        .await?
        .into_result()?;
    let other_token = other_account
        .deploy(&wasm("FT_WASM", "tests/res/fungible-token.wasm"))
        .await?
        .into_result()?;
    other_token
        .call("new_default_meta")
        .args_json(json!({"owner_id":env.relayer.id(),"total_supply":"1000000000"}))
        .transact()
        .await?
        .into_result()?;
    env.relayer
        .call(other_token.id(), "storage_deposit")
        .args_json(json!({"account_id":env.intents.id()}))
        .deposit(NearToken::from_millinear(10))
        .transact()
        .await?
        .into_result()?;
    env.relayer
        .call(other_token.id(), "ft_transfer_call")
        .args_json(json!({"receiver_id":env.intents.id(),"amount":ORDER_VALUE.to_string(),"msg":buyer.id()}))
        .deposit(NearToken::from_yoctonear(1))
        .gas(Gas::from_tgas(300))
        .transact()
        .await?
        .into_result()?;
    let other_id = format!("nep141:{}", other_token.id());
    let message = json!({"op":"fund","order":{
        "id":"FUL-WRONG1","kind":"bank_transfer","spec_hash":bank_spec_hash(),
        "pay_amount":"2000000","reward":"100000",
        "deadline_ns":(now_ns() + 24 * 3_600 * 1_000_000_000).to_string()
    }});
    let intent = json!([{
        "intent":"transfer","receiver_id":env.escrow.id(),
        "tokens":{other_id.clone():ORDER_VALUE.to_string()},"msg":message.to_string()
    }]);
    let failures = env.execute(buyer.sign(env.intents.id(), intent)).await?;
    assert!(failures
        .iter()
        .any(|failure| failure.contains("token not accepted")));
    let other_balance: String = env
        .intents
        .view("mt_balance_of")
        .args_json(json!({"account_id":buyer.id(),"token_id":other_id}))
        .await?
        .json()?;
    assert_eq!(other_balance, ORDER_VALUE.to_string());
    assert!(env.order("FUL-WRONG1").await?.is_null());
    Ok(())
}
