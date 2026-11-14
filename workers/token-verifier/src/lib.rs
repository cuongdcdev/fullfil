use serde::{Deserialize, Deserializer, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::collections::HashSet;

pub const BLOB_MAX_BYTES: usize = 64 * 1024;
pub const RPC_MAX_BYTES: usize = 1024 * 1024;
pub const DEFAULT_BLOB_PREFIX: &str = "https://fulfil.junstudio.xyz/api/proof-blob/";
pub const DEFAULT_RPC_URLS: &[&str] = &[
    "https://free.rpc.fastnear.com",
    "https://rpc.intea.rs",
    "https://rpc.shitzuapes.xyz",
    "https://archival-rpc.mainnet.near.org",
];
pub const DEFAULT_RPC_ANCHORS: &[&str] = &[
    "https://free.rpc.fastnear.com",
    "https://archival-rpc.mainnet.near.org",
];

fn u64_or_string<'de, D: Deserializer<'de>>(deserializer: D) -> Result<u64, D::Error> {
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum Number {
        Integer(u64),
        Text(String),
    }
    match Number::deserialize(deserializer)? {
        Number::Integer(value) => Ok(value),
        Number::Text(value) => value.parse().map_err(serde::de::Error::custom),
    }
}

#[derive(Clone, Deserialize)]
pub struct Job {
    pub order_id: String,
    pub kind: String,
    pub spec: String,
    pub spec_hash: String,
    pub proof_sha256: String,
    #[serde(deserialize_with = "u64_or_string")]
    pub claimed_at_ns: u64,
    pub blob_url: String,
    pub fulfiller: String,
    pub buyer: String,
}

#[derive(Debug, Serialize)]
pub struct Output {
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<&'static str>,
    pub order_id: String,
    pub proof_sha256: String,
    pub spec_hash: String,
    pub nullifier: String,
    pub completed_at_ns: String,
}

impl Output {
    pub fn failure(job: &Job, reason: &'static str) -> Self {
        Self {
            ok: false,
            reason: Some(reason),
            order_id: job.order_id.clone(),
            proof_sha256: job.proof_sha256.clone(),
            spec_hash: job.spec_hash.clone(),
            nullifier: String::new(),
            completed_at_ns: "0".into(),
        }
    }

    fn success(job: &Job, tx_hash: &str, completed_at_ns: u64) -> Self {
        Self {
            ok: true,
            reason: None,
            order_id: job.order_id.clone(),
            proof_sha256: job.proof_sha256.clone(),
            spec_hash: job.spec_hash.clone(),
            nullifier: hex_sha256(format!("near_ft:{tx_hash}").as_bytes()),
            completed_at_ns: completed_at_ns.to_string(),
        }
    }
}

#[derive(Deserialize)]
struct Spec {
    amount_out: String,
    receiver: String,
    token_contract: String,
    v: u8,
}

#[derive(Deserialize)]
struct Blob {
    order_id: String,
    tx_hash: String,
}

pub struct Config {
    pub blob_prefixes: Vec<String>,
    pub blob_token: Option<String>,
    pub rpc_urls: Vec<String>,
    pub rpc_anchors: Vec<String>,
}

impl Config {
    pub fn from_env() -> Self {
        let urls_from_env = |name: &str, defaults: &[&str]| {
            std::env::var(name)
                .ok()
                .map(|value| {
                    value
                        .split(',')
                        .map(str::trim)
                        .filter(|url| !url.is_empty())
                        .map(str::to_owned)
                        .collect::<Vec<_>>()
                })
                .unwrap_or_else(|| defaults.iter().map(|url| (*url).into()).collect())
        };
        Self {
            blob_prefixes: std::env::var("PROOF_BLOB_PREFIX")
                .ok()
                .filter(|value| !value.is_empty())
                .map(|value| vec![value])
                .unwrap_or_else(|| vec![DEFAULT_BLOB_PREFIX.into()]),
            blob_token: std::env::var("PROOF_BLOB_TOKEN")
                .ok()
                .filter(|value| !value.is_empty()),
            rpc_urls: urls_from_env("NEAR_RPC_URLS", DEFAULT_RPC_URLS),
            rpc_anchors: urls_from_env("NEAR_RPC_ANCHORS", DEFAULT_RPC_ANCHORS),
        }
    }
}

pub trait Http {
    fn get(&self, url: &str, headers: &[(&str, &str)]) -> Result<Vec<u8>, HttpError>;
    fn post(&self, url: &str, headers: &[(&str, &str)], body: &[u8]) -> Result<Vec<u8>, HttpError>;
}

/// HTTP errors never carry response bodies, URLs, or credentials into worker output.
#[derive(Clone, Copy)]
pub struct HttpError;

pub fn hex_sha256(bytes: &[u8]) -> String {
    Sha256::digest(bytes)
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

fn valid_hex64(value: &str) -> bool {
    value.len() == 64
        && value
            .bytes()
            .all(|byte| byte.is_ascii_hexdigit() && !byte.is_ascii_uppercase())
}

fn positive_u128(value: &str) -> Option<u128> {
    if !value.starts_with(|byte: char| ('1'..='9').contains(&byte))
        || !value.bytes().all(|byte| byte.is_ascii_digit())
    {
        return None;
    }
    value.parse::<u128>().ok()
}

fn valid_account_id(value: &str) -> bool {
    let bytes = value.as_bytes();
    if !(2..=64).contains(&bytes.len())
        || !bytes[0].is_ascii_lowercase() && !bytes[0].is_ascii_digit()
    {
        return false;
    }
    if !bytes[bytes.len() - 1].is_ascii_lowercase() && !bytes[bytes.len() - 1].is_ascii_digit() {
        return false;
    }
    let mut separator = false;
    for byte in bytes {
        let current_separator = matches!(byte, b'-' | b'_' | b'.');
        if current_separator && separator {
            return false;
        }
        if !current_separator && !byte.is_ascii_lowercase() && !byte.is_ascii_digit() {
            return false;
        }
        separator = current_separator;
    }
    true
}

/// Decode a base58 transaction hash, requiring exactly 32 decoded bytes.
fn valid_tx_hash(value: &str) -> bool {
    if value.is_empty() || value.len() > 44 {
        return false;
    }
    const ALPHABET: &str = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    let mut decoded = [0_u8; 32];
    for character in value.bytes() {
        let Some(digit) = ALPHABET.bytes().position(|entry| entry == character) else {
            return false;
        };
        let mut carry = digit as u32;
        for byte in decoded.iter_mut().rev() {
            carry += u32::from(*byte) * 58;
            *byte = carry as u8;
            carry >>= 8;
        }
        if carry != 0 {
            return false;
        }
    }
    let leading_zeroes = value.bytes().take_while(|byte| *byte == b'1').count();
    let decoded_zeroes = decoded.iter().take_while(|byte| **byte == 0).count();
    leading_zeroes == decoded_zeroes
}

fn parse_spec(job: &Job) -> Result<(Spec, u128), &'static str> {
    if job.kind != "token_buy" {
        return Err("kind_mismatch");
    }
    if hex_sha256(job.spec.as_bytes()) != job.spec_hash {
        return Err("spec_hash_mismatch");
    }
    let spec: Spec = serde_json::from_str(&job.spec).map_err(|_| "spec_invalid")?;
    let amount = positive_u128(&spec.amount_out).ok_or("spec_invalid")?;
    if spec.v != 1
        || !valid_account_id(&spec.receiver)
        || !valid_account_id(&spec.token_contract)
        || !valid_account_id(&job.fulfiller)
        || !valid_account_id(&job.buyer)
    {
        return Err("spec_invalid");
    }
    Ok((spec, amount))
}

fn blob_url_allowed(job: &Job, prefixes: &[String]) -> bool {
    valid_hex64(&job.proof_sha256)
        && prefixes.iter().any(|prefix| {
            prefix.starts_with("https://")
                && prefix.ends_with('/')
                && job.blob_url == format!("{prefix}{}", job.proof_sha256)
        })
}

#[derive(PartialEq, Eq)]
struct AgreedReceipt {
    id: String,
    status: Value,
    logs: Vec<String>,
}

#[derive(PartialEq, Eq)]
struct AgreedActionReceipt {
    id: String,
    executor: String,
    methods: Vec<String>,
}

#[derive(PartialEq, Eq)]
struct AgreedOutcome {
    tx_hash: String,
    signer: String,
    final_status: Value,
    block_hash: String,
    timestamp_ns: u64,
    transaction_methods: Vec<String>,
    receipts: Vec<AgreedReceipt>,
    action_receipts: Option<Vec<AgreedActionReceipt>>,
}

fn success_status(status: &Value) -> bool {
    status.as_object().is_some_and(|object| {
        object.len() == 1
            && (object.get("SuccessValue").is_some_and(Value::is_string)
                || object.get("SuccessReceiptId").is_some_and(Value::is_string))
    })
}

fn rpc_result(bytes: &[u8]) -> Option<Value> {
    if bytes.len() > RPC_MAX_BYTES {
        return None;
    }
    let response: Value = serde_json::from_slice(bytes).ok()?;
    if response.get("error").is_some() {
        return None;
    }
    response.get("result").cloned()
}

fn rpc_call(http: &impl Http, url: &str, method: &str, params: Value) -> Option<Value> {
    let body = json!({"jsonrpc":"2.0","id":"fulfil-token","method":method,"params":params});
    let bytes = http
        .post(
            url,
            &[("Content-Type", "application/json")],
            body.to_string().as_bytes(),
        )
        .ok()?;
    rpc_result(&bytes)
}

/// One RPC vote per HTTPS host, regardless of case, path, trailing slash, or
/// port. Even a non-default port on the same host is not an independent vote.
fn rpc_host_key(url: &str) -> Option<String> {
    let (scheme, rest) = url.split_once("://")?;
    if !scheme.eq_ignore_ascii_case("https") {
        return None;
    }
    let authority = rest.split(['/', '?', '#']).next()?;
    if authority.is_empty() || authority.contains('@') {
        return None;
    }
    let host = if authority.starts_with('[') {
        authority.split_once(']')?.0.strip_prefix('[')?
    } else {
        authority.split(':').next()?
    };
    let host = host.trim_end_matches('.');
    if host.is_empty()
        || !host
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'-' | b':'))
    {
        return None;
    }
    Some(format!("https://{}", host.to_ascii_lowercase()))
}

fn function_call_methods(actions: &Value) -> Option<Vec<String>> {
    let mut methods = Vec::new();
    for action in actions.as_array()? {
        if let Some(call) = action.get("FunctionCall") {
            methods.push(call.get("method_name")?.as_str()?.to_owned());
        }
    }
    Some(methods)
}

fn parse_outcome(
    tx: &Value,
    block: &Value,
    expected_hash: &str,
    token_contract: &str,
) -> Option<AgreedOutcome> {
    if tx.get("final_execution_status")?.as_str()? != "FINAL" {
        return None;
    }
    let transaction = tx.get("transaction")?;
    let tx_hash = transaction.get("hash")?.as_str()?;
    if tx_hash != expected_hash {
        return None;
    }
    let signer = transaction.get("signer_id")?.as_str()?.to_owned();
    let transaction_methods = function_call_methods(transaction.get("actions")?)?;
    let final_status = tx.get("status")?.clone();
    let block_hash = tx.get("transaction_outcome")?.get("block_hash")?.as_str()?;
    if !valid_tx_hash(block_hash) || block.get("header")?.get("hash")?.as_str()? != block_hash {
        return None;
    }
    let timestamp = block.get("header")?.get("timestamp_nanosec")?;
    let timestamp_ns = timestamp
        .as_str()
        .and_then(|value| value.parse::<u64>().ok())
        .or_else(|| timestamp.as_u64())?;
    let mut receipts = Vec::new();
    for receipt in tx.get("receipts_outcome")?.as_array()? {
        let outcome = receipt.get("outcome")?;
        if outcome.get("executor_id")?.as_str()? != token_contract {
            continue;
        }
        let id = receipt.get("id")?.as_str()?.to_owned();
        let status = outcome.get("status")?.clone();
        let logs = outcome
            .get("logs")?
            .as_array()?
            .iter()
            .map(|log| log.as_str().map(str::to_owned))
            .collect::<Option<Vec<_>>>()?;
        receipts.push(AgreedReceipt { id, status, logs });
    }
    receipts.sort_by(|a, b| a.id.cmp(&b.id));
    if receipts.windows(2).any(|pair| pair[0].id == pair[1].id) {
        return None;
    }
    let action_receipts = if let Some(raw) = tx.get("receipts") {
        let mut entries = Vec::new();
        for receipt in raw.as_array()? {
            let id = receipt.get("receipt_id")?.as_str()?.to_owned();
            let executor = receipt.get("receiver_id")?.as_str()?.to_owned();
            let body = receipt.get("receipt").unwrap_or(receipt);
            let methods = match body.get("Action") {
                Some(action) => function_call_methods(action.get("actions")?)?,
                None => Vec::new(),
            };
            entries.push(AgreedActionReceipt {
                id,
                executor,
                methods,
            });
        }
        entries.sort_by(|a, b| a.id.cmp(&b.id));
        if entries.windows(2).any(|pair| pair[0].id == pair[1].id) {
            return None;
        }
        Some(entries)
    } else {
        None
    };
    Some(AgreedOutcome {
        tx_hash: tx_hash.to_owned(),
        signer,
        final_status,
        block_hash: block_hash.to_owned(),
        timestamp_ns,
        transaction_methods,
        receipts,
        action_receipts,
    })
}

fn agreed_outcome(
    job: &Job,
    spec: &Spec,
    tx_hash: &str,
    config: &Config,
    http: &impl Http,
) -> Option<AgreedOutcome> {
    let anchors: HashSet<String> = config
        .rpc_anchors
        .iter()
        .filter_map(|url| rpc_host_key(url))
        .collect();
    let mut first_outcome: Option<AgreedOutcome> = None;
    let mut answered_hosts = HashSet::new();
    let mut anchor_answered = false;
    let mut disagreed = false;
    for url in &config.rpc_urls {
        let Some(host) = rpc_host_key(url) else {
            continue;
        };
        let Some(tx) = rpc_call(
            http,
            url,
            "EXPERIMENTAL_tx_status",
            json!({
                "tx_hash": tx_hash,
                "sender_account_id": job.fulfiller,
                "wait_until": "FINAL",
            }),
        ) else {
            continue;
        };
        let Some(block_hash) = tx
            .get("transaction_outcome")
            .and_then(|value| value.get("block_hash"))
            .and_then(Value::as_str)
        else {
            continue;
        };
        let Some(block) = rpc_call(http, url, "block", json!({"block_id":block_hash})) else {
            continue;
        };
        if let Some(outcome) = parse_outcome(&tx, &block, tx_hash, &spec.token_contract) {
            answered_hosts.insert(host.clone());
            anchor_answered |= anchors.contains(&host);
            if first_outcome
                .as_ref()
                .is_some_and(|first| first != &outcome)
            {
                disagreed = true;
            } else if first_outcome.is_none() {
                first_outcome = Some(outcome);
            }
        }
    }
    if disagreed || answered_hosts.len() < 2 || !anchor_answered {
        None
    } else {
        first_outcome
    }
}

#[derive(Deserialize)]
struct FtTransfer {
    old_owner_id: String,
    new_owner_id: String,
    amount: String,
}

#[derive(Deserialize)]
struct FtBurn {
    owner_id: String,
    amount: String,
}

fn verify_transfer(
    outcome: &AgreedOutcome,
    job: &Job,
    spec: &Spec,
    amount_out: u128,
) -> Result<(), &'static str> {
    if outcome.signer != job.fulfiller || !success_status(&outcome.final_status) {
        return Err("tx_invalid");
    }
    if outcome.timestamp_ns < job.claimed_at_ns {
        return Err("old_tx");
    }
    if outcome
        .transaction_methods
        .iter()
        .any(|method| method == "ft_transfer_call")
        || outcome.action_receipts.as_ref().is_some_and(|receipts| {
            receipts.iter().any(|receipt| {
                (receipt.executor == spec.token_contract || receipt.executor == spec.receiver)
                    && receipt
                        .methods
                        .iter()
                        .any(|method| method == "ft_on_transfer" || method == "ft_resolve_transfer")
            })
        })
    {
        return Err("transfer_call_path");
    }
    let mut delivered = 0_u128;
    let mut burned = 0_u128;
    for receipt in &outcome.receipts {
        if !success_status(&receipt.status) {
            return Err("receipt_failed");
        }
        for log in &receipt.logs {
            let Some(payload) = log.strip_prefix("EVENT_JSON:") else {
                continue;
            };
            let Ok(event) = serde_json::from_str::<Value>(payload) else {
                continue;
            };
            if event.get("standard").and_then(Value::as_str) != Some("nep141") {
                continue;
            }
            match event.get("event").and_then(Value::as_str) {
                Some("ft_transfer") => {
                    let transfers: Vec<FtTransfer> =
                        serde_json::from_value(event.get("data").cloned().ok_or("event_invalid")?)
                            .map_err(|_| "event_invalid")?;
                    for transfer in transfers {
                        let amount = positive_u128(&transfer.amount).ok_or("event_invalid")?;
                        if transfer.old_owner_id == spec.receiver
                            && transfer.new_owner_id == job.fulfiller
                        {
                            return Err("reverse_transfer");
                        }
                        if transfer.old_owner_id == job.fulfiller
                            && transfer.new_owner_id == spec.receiver
                        {
                            delivered = delivered.checked_add(amount).ok_or("amount_overflow")?;
                        }
                    }
                }
                Some("ft_burn") => {
                    let burns: Vec<FtBurn> =
                        serde_json::from_value(event.get("data").cloned().ok_or("event_invalid")?)
                            .map_err(|_| "event_invalid")?;
                    for burn in burns {
                        let amount = positive_u128(&burn.amount).ok_or("event_invalid")?;
                        if burn.owner_id == spec.receiver {
                            burned = burned.checked_add(amount).ok_or("amount_overflow")?;
                        }
                    }
                }
                _ => {}
            }
        }
    }
    if delivered.saturating_sub(burned) < amount_out {
        return Err("amount_short");
    }
    Ok(())
}

pub fn verify(
    job: &Job,
    blob_override: Option<&[u8]>,
    config: &Config,
    http: &impl Http,
) -> Output {
    let (spec, amount_out) = match parse_spec(job) {
        Ok(value) => value,
        Err(reason) => return Output::failure(job, reason),
    };
    let blob = match blob_override {
        Some(blob) => blob.to_vec(),
        None => {
            if !blob_url_allowed(job, &config.blob_prefixes) {
                return Output::failure(job, "blob_url_not_allowed");
            }
            let Some(token) = config.blob_token.as_deref() else {
                return Output::failure(job, "blob_token_missing");
            };
            let authorization = format!("Bearer {token}");
            match http.get(&job.blob_url, &[("Authorization", &authorization)]) {
                Ok(blob) => blob,
                Err(_) => return Output::failure(job, "blob_fetch_fail"),
            }
        }
    };
    if blob.len() > BLOB_MAX_BYTES {
        return Output::failure(job, "blob_fetch_fail");
    }
    if hex_sha256(&blob) != job.proof_sha256 {
        return Output::failure(job, "sha256_mismatch");
    }
    let proof: Blob = match serde_json::from_slice(&blob) {
        Ok(proof) => proof,
        Err(_) => return Output::failure(job, "blob_invalid"),
    };
    if proof.order_id != job.order_id {
        return Output::failure(job, "order_id_mismatch");
    }
    if !valid_tx_hash(&proof.tx_hash) {
        return Output::failure(job, "tx_hash_invalid");
    }
    let Some(outcome) = agreed_outcome(job, &spec, &proof.tx_hash, config, http) else {
        return Output::failure(job, "rpc_disagreement");
    };
    if let Err(reason) = verify_transfer(&outcome, job, &spec, amount_out) {
        return Output::failure(job, reason);
    }
    Output::success(job, &proof.tx_hash, outcome.timestamp_ns)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::{json, Value};
    use std::collections::HashMap;

    const TX_HASH: &str = "11111111111111111111111111111111";
    const BLOCK_HASH: &str = "11111111111111111111111111111111";
    const CLAIMED: u64 = 1_800_000_000_000_000_000;

    struct MockHttp {
        responses: HashMap<(String, String), Result<Vec<u8>, HttpError>>,
        blob: Option<Vec<u8>>,
    }

    impl Http for MockHttp {
        fn get(&self, url: &str, headers: &[(&str, &str)]) -> Result<Vec<u8>, HttpError> {
            let blob = self.blob.as_ref().ok_or(HttpError)?;
            assert_eq!(url, format!("{DEFAULT_BLOB_PREFIX}{}", hex_sha256(blob)));
            assert_eq!(headers, &[("Authorization", "Bearer synthetic-token")]);
            Ok(blob.clone())
        }

        fn post(&self, url: &str, _: &[(&str, &str)], body: &[u8]) -> Result<Vec<u8>, HttpError> {
            let request: Value = serde_json::from_slice(body).unwrap();
            let method = request["method"].as_str().unwrap();
            if method == "EXPERIMENTAL_tx_status" {
                assert_eq!(request["params"]["tx_hash"], TX_HASH);
                assert_eq!(request["params"]["sender_account_id"], "fulfiller.testnet");
                assert_eq!(request["params"]["wait_until"], "FINAL");
            } else {
                assert_eq!(request["params"]["block_id"], BLOCK_HASH);
            }
            self.responses
                .get(&(url.to_owned(), method.to_owned()))
                .cloned()
                .unwrap_or(Err(HttpError))
        }
    }

    fn event(old: &str, new: &str, amount: &str) -> String {
        format!("EVENT_JSON:{{\"standard\":\"nep141\",\"event\":\"ft_transfer\",\"data\":[{{\"old_owner_id\":\"{old}\",\"new_owner_id\":\"{new}\",\"amount\":\"{amount}\"}}]}}")
    }

    fn burn(owner: &str, amount: &str) -> String {
        format!("EVENT_JSON:{{\"standard\":\"nep141\",\"event\":\"ft_burn\",\"data\":[{{\"owner_id\":\"{owner}\",\"amount\":\"{amount}\"}}]}}")
    }

    fn happy_tx() -> Value {
        serde_json::from_str(include_str!("../tests/fixtures/tx_status_happy.json")).unwrap()
    }

    fn refund_tx() -> Value {
        serde_json::from_str(include_str!("../tests/fixtures/tx_status_refund.json")).unwrap()
    }

    fn block(timestamp: u64) -> Value {
        let mut block: Value =
            serde_json::from_str(include_str!("../tests/fixtures/block_happy.json")).unwrap();
        block["result"]["header"]["timestamp_nanosec"] = json!(timestamp.to_string());
        block["result"]["header"]["timestamp"] = json!(timestamp);
        block
    }

    fn job(blob: &[u8]) -> Job {
        let spec = r#"{"amount_out":"100","receiver":"buyer.testnet","token_contract":"token.testnet","v":1}"#;
        Job {
            order_id: "FUL-TOKEN01".into(),
            kind: "token_buy".into(),
            spec: spec.into(),
            spec_hash: hex_sha256(spec.as_bytes()),
            proof_sha256: hex_sha256(blob),
            claimed_at_ns: CLAIMED,
            blob_url: format!(
                "https://fulfil.junstudio.xyz/api/proof-blob/{}",
                hex_sha256(blob)
            ),
            fulfiller: "fulfiller.testnet".into(),
            buyer: "buyer.testnet".into(),
        }
    }

    fn verify_case(txs: Vec<Option<Value>>, blocks: Vec<Option<Value>>, blob: &[u8]) -> Output {
        let rpc_urls: Vec<String> = (0..txs.len())
            .map(|i| format!("https://rpc{i}.test"))
            .collect();
        verify_urls(
            rpc_urls,
            vec!["https://rpc0.test".into()],
            txs,
            blocks,
            blob,
        )
    }

    fn verify_urls(
        rpc_urls: Vec<String>,
        rpc_anchors: Vec<String>,
        txs: Vec<Option<Value>>,
        blocks: Vec<Option<Value>>,
        blob: &[u8],
    ) -> Output {
        let mut responses = HashMap::new();
        for (i, (tx, block)) in txs.into_iter().zip(blocks).enumerate() {
            let url = &rpc_urls[i];
            if let Some(tx) = tx {
                responses.insert(
                    (url.clone(), "EXPERIMENTAL_tx_status".into()),
                    Ok(tx.to_string().into_bytes()),
                );
            }
            if let Some(block) = block {
                responses.insert(
                    (url.clone(), "block".into()),
                    Ok(block.to_string().into_bytes()),
                );
            }
        }
        let config = Config {
            blob_prefixes: vec!["https://fulfil.junstudio.xyz/api/proof-blob/".into()],
            blob_token: None,
            rpc_urls,
            rpc_anchors,
        };
        verify(
            &job(blob),
            Some(blob),
            &config,
            &MockHttp {
                responses,
                blob: None,
            },
        )
    }

    fn proof() -> Vec<u8> {
        format!(r#"{{"order_id":"FUL-TOKEN01","tx_hash":"{TX_HASH}"}}"#).into_bytes()
    }

    fn agreed(tx: Value) -> Output {
        let blob = proof();
        verify_case(
            vec![Some(tx.clone()), Some(tx)],
            vec![Some(block(CLAIMED)), Some(block(CLAIMED))],
            &blob,
        )
    }

    #[test]
    fn valid_transfer_needs_two_matching_rpcs() {
        let blob = proof();
        let tx = happy_tx();
        assert_eq!(
            tx["result"]["transaction"]["actions"][0]["FunctionCall"]["method_name"],
            "storage_deposit"
        );
        assert_eq!(tx["result"]["receipts_outcome"][0]["id"], "storage-receipt");
        let result = verify_case(
            vec![Some(tx.clone()), Some(tx)],
            vec![Some(block(CLAIMED)), Some(block(CLAIMED))],
            &blob,
        );
        assert!(result.ok, "{:?}", result.reason);
        assert_eq!(result.completed_at_ns, CLAIMED.to_string());
        assert_eq!(
            result.nullifier,
            hex_sha256(format!("near_ft:{TX_HASH}").as_bytes())
        );
        assert!(serde_json::to_vec(&result).unwrap().len() < 900);
    }

    #[test]
    fn rotates_past_rpc_error_to_two_agreeing_answers() {
        let blob = proof();
        let tx = happy_tx();
        let out = verify_urls(
            vec![
                "https://rpc0.test".into(),
                "https://rpc1.test".into(),
                "https://rpc2.test".into(),
            ],
            vec!["https://rpc1.test".into()],
            vec![None, Some(tx.clone()), Some(tx)],
            vec![None, Some(block(CLAIMED)), Some(block(CLAIMED))],
            &blob,
        );
        assert!(out.ok, "{:?}", out.reason);
        assert_eq!(out.reason, None);
    }

    #[test]
    fn sums_transfers_and_ignores_other_executors() {
        let blob = proof();
        let mut value = happy_tx();
        value["result"]["receipts_outcome"][1]["outcome"]["logs"] = json!([
            event("fulfiller.testnet", "buyer.testnet", "40"),
            event("fulfiller.testnet", "buyer.testnet", "60"),
        ]);
        value["result"]["receipts_outcome"].as_array_mut().unwrap().push(json!({
            "id":"unrelated", "outcome":{"executor_id":"evil.testnet", "status":{"SuccessValue":""},
                "logs":[event("buyer.testnet", "fulfiller.testnet", "1000")]}
        }));
        let result = verify_case(
            vec![Some(value.clone()), Some(value)],
            vec![Some(block(CLAIMED)), Some(block(CLAIMED))],
            &blob,
        );
        assert!(result.ok, "{:?}", result.reason);
    }

    #[test]
    fn fake_transfer_event_from_another_contract_is_not_counted() {
        let mut tx = happy_tx();
        tx["result"]["receipts_outcome"][1]["outcome"]["logs"] = json!([]);
        tx["result"]["receipts_outcome"]
            .as_array_mut()
            .unwrap()
            .push(json!({
                "id":"forged-event-receipt",
                "block_hash":BLOCK_HASH,
                "outcome":{
                    "executor_id":"evil.testnet",
                    "status":{"SuccessValue":""},
                    "logs":[event("fulfiller.testnet", "buyer.testnet", "100")],
                    "receipt_ids":[]
                }
            }));
        assert_eq!(agreed(tx).reason, Some("amount_short"));
    }

    #[test]
    fn ft_transfer_call_refund_is_rejected() {
        let tx = refund_tx();
        assert_eq!(
            tx["result"]["transaction"]["actions"][0]["FunctionCall"]["method_name"],
            "ft_transfer_call"
        );
        assert_eq!(
            tx["result"]["receipts_outcome"][1]["outcome"]["executor_id"],
            "buyer.testnet"
        );
        assert_eq!(
            tx["result"]["receipts_outcome"][2]["outcome"]["executor_id"],
            "token.testnet"
        );
        assert_eq!(agreed(tx).reason, Some("transfer_call_path"));
    }

    #[test]
    fn transfer_call_transaction_rejected_without_receipt_action_data() {
        let mut tx = refund_tx();
        tx["result"].as_object_mut().unwrap().remove("receipts");
        assert_eq!(agreed(tx).reason, Some("transfer_call_path"));
    }

    #[test]
    fn receiver_on_transfer_receipt_rejected() {
        let mut tx = happy_tx();
        tx["result"]["receipts"][1]["receiver_id"] = json!("buyer.testnet");
        tx["result"]["receipts"][1]["receipt"]["Action"]["actions"][0]["FunctionCall"]
            ["method_name"] = json!("ft_on_transfer");
        assert_eq!(agreed(tx).reason, Some("transfer_call_path"));
    }

    #[test]
    fn token_resolve_transfer_receipt_rejected() {
        let mut tx = happy_tx();
        tx["result"]["receipts"][1]["receipt"]["Action"]["actions"][0]["FunctionCall"]
            ["method_name"] = json!("ft_resolve_transfer");
        assert_eq!(agreed(tx).reason, Some("transfer_call_path"));
    }

    #[test]
    fn receipt_action_disagreement_rejected() {
        let first = happy_tx();
        let mut second = happy_tx();
        second["result"]["receipts"][1]["receipt"]["Action"]["actions"][0]["FunctionCall"]
            ["method_name"] = json!("ft_resolve_transfer");
        let blob = proof();
        assert_eq!(
            verify_case(
                vec![Some(first), Some(second)],
                vec![Some(block(CLAIMED)), Some(block(CLAIMED))],
                &blob,
            )
            .reason,
            Some("rpc_disagreement")
        );
    }

    #[test]
    fn wrong_transaction_signer_is_rejected() {
        let mut tx = happy_tx();
        tx["result"]["transaction"]["signer_id"] = json!("wrong.testnet");
        assert_eq!(agreed(tx).reason, Some("tx_invalid"));
    }

    #[test]
    fn short_transfer_amount_is_rejected() {
        let mut tx = happy_tx();
        tx["result"]["receipts_outcome"][1]["outcome"]["logs"] =
            json!([event("fulfiller.testnet", "buyer.testnet", "99")]);
        assert_eq!(agreed(tx).reason, Some("amount_short"));
    }

    #[test]
    fn burn_by_other_owner_does_not_reduce_delivery() {
        let mut tx = happy_tx();
        tx["result"]["receipts_outcome"][1]["outcome"]["logs"] = json!([
            event("fulfiller.testnet", "buyer.testnet", "100"),
            burn("someone.testnet", "100")
        ]);
        assert_eq!(agreed(tx).reason, None);
    }

    #[test]
    fn receiver_burn_reduces_net_delivery() {
        let mut tx = happy_tx();
        tx["result"]["receipts_outcome"][1]["outcome"]["logs"] = json!([
            event("fulfiller.testnet", "buyer.testnet", "100"),
            burn("buyer.testnet", "1")
        ]);
        assert_eq!(agreed(tx).reason, Some("amount_short"));
    }

    #[test]
    fn receiver_burn_larger_than_delivery_fails_short() {
        let mut tx = happy_tx();
        tx["result"]["receipts_outcome"][1]["outcome"]["logs"] = json!([
            burn("buyer.testnet", "101"),
            event("fulfiller.testnet", "buyer.testnet", "100")
        ]);
        assert_eq!(agreed(tx).reason, Some("amount_short"));
    }

    #[test]
    fn mint_event_is_ignored() {
        let mut tx = happy_tx();
        tx["result"]["receipts_outcome"][1]["outcome"]["logs"] = json!([
            "EVENT_JSON:{\"standard\":\"nep141\",\"event\":\"ft_mint\",\"data\":[{\"owner_id\":\"buyer.testnet\",\"amount\":\"1000\"}]}",
            event("fulfiller.testnet", "buyer.testnet", "100")
        ]);
        assert_eq!(agreed(tx).reason, None);
    }

    #[test]
    fn other_standard_event_is_ignored() {
        let mut tx = happy_tx();
        tx["result"]["receipts_outcome"][1]["outcome"]["logs"] = json!([
            "EVENT_JSON:{\"standard\":\"nep999\",\"event\":\"ft_transfer\",\"data\":\"not an array\"}",
            event("fulfiller.testnet", "buyer.testnet", "100")
        ]);
        assert_eq!(agreed(tx).reason, None);
    }

    #[test]
    fn known_nep141_event_with_bad_data_is_rejected() {
        let mut tx = happy_tx();
        tx["result"]["receipts_outcome"][1]["outcome"]["logs"] = json!([
            "EVENT_JSON:{\"standard\":\"nep141\",\"event\":\"ft_burn\",\"data\":{\"owner_id\":\"buyer.testnet\",\"amount\":\"1\"}}",
            event("fulfiller.testnet", "buyer.testnet", "100")
        ]);
        assert_eq!(agreed(tx).reason, Some("event_invalid"));
    }

    #[test]
    fn failed_token_contract_receipt_is_rejected_even_with_delivery() {
        let mut tx = happy_tx();
        tx["result"]["receipts_outcome"][0]["outcome"]["status"] =
            json!({"Failure":{"ActionError":{}}});
        assert_eq!(agreed(tx).reason, Some("receipt_failed"));
    }

    #[test]
    fn failed_final_transaction_status_is_rejected() {
        let mut tx = happy_tx();
        tx["result"]["status"] = json!({"Failure":{"ActionError":{}}});
        assert_eq!(agreed(tx).reason, Some("tx_invalid"));
    }

    #[test]
    fn malformed_event_json_at_token_contract_is_rejected() {
        let mut tx = happy_tx();
        tx["result"]["receipts_outcome"][1]["outcome"]["logs"] = json!([
            "EVENT_JSON:{\"standard\":\"nep141\",\"event\":\"ft_transfer\",\"data\":\"bad\"}"
        ]);
        assert_eq!(agreed(tx).reason, Some("event_invalid"));
    }

    #[test]
    fn unidentified_malformed_event_text_is_ignored() {
        let mut tx = happy_tx();
        tx["result"]["receipts_outcome"][1]["outcome"]["logs"] = json!([
            "EVENT_JSON:{bad",
            event("fulfiller.testnet", "buyer.testnet", "100")
        ]);
        assert_eq!(agreed(tx).reason, None);
    }

    #[test]
    fn transfer_to_different_receiver_is_rejected() {
        let mut tx = happy_tx();
        tx["result"]["receipts_outcome"][1]["outcome"]["logs"] =
            json!([event("fulfiller.testnet", "other.testnet", "100")]);
        assert_eq!(agreed(tx).reason, Some("amount_short"));
    }

    #[test]
    fn checked_u128_sum_overflow_is_rejected() {
        let mut tx = happy_tx();
        tx["result"]["receipts_outcome"][1]["outcome"]["logs"] = json!([
            event("fulfiller.testnet", "buyer.testnet", &u128::MAX.to_string()),
            event("fulfiller.testnet", "buyer.testnet", "1")
        ]);
        assert_eq!(agreed(tx).reason, Some("amount_overflow"));
    }

    #[test]
    fn rpc_disagreement_on_token_event_is_rejected() {
        let blob = proof();
        let first = happy_tx();
        let mut second = happy_tx();
        second["result"]["receipts_outcome"][1]["outcome"]["logs"] =
            json!([event("fulfiller.testnet", "buyer.testnet", "101")]);
        let out = verify_case(
            vec![Some(first), Some(second)],
            vec![Some(block(CLAIMED)), Some(block(CLAIMED))],
            &blob,
        );
        assert_eq!(out.reason, Some("rpc_disagreement"));
    }

    #[test]
    fn honest_dissent_rejects_even_when_two_other_rpcs_match() {
        let blob = proof();
        let mut honest = happy_tx();
        honest["result"]["receipts_outcome"][1]["outcome"]["logs"] = json!([]);
        let forged = happy_tx();
        let out = verify_case(
            vec![Some(honest), Some(forged.clone()), Some(forged)],
            vec![Some(block(CLAIMED)); 3],
            &blob,
        );
        assert_eq!(out.reason, Some("rpc_disagreement"));
    }

    #[test]
    fn agreeing_community_rpcs_rejected_when_all_anchors_down() {
        let blob = proof();
        let good = happy_tx();
        let out = verify_urls(
            (0..4).map(|i| format!("https://rpc{i}.test")).collect(),
            vec!["https://rpc0.test".into(), "https://rpc1.test".into()],
            vec![None, None, Some(good.clone()), Some(good)],
            vec![None, None, Some(block(CLAIMED)), Some(block(CLAIMED))],
            &blob,
        );
        assert_eq!(out.reason, Some("rpc_disagreement"));
    }

    #[test]
    fn anchor_and_community_rpc_agree() {
        let blob = proof();
        let good = happy_tx();
        let out = verify_urls(
            vec![
                "https://anchor.test/path".into(),
                "https://community.test/".into(),
            ],
            vec!["https://ANCHOR.TEST/".into()],
            vec![Some(good.clone()), Some(good)],
            vec![Some(block(CLAIMED)); 2],
            &blob,
        );
        assert_eq!(out.reason, None);
        assert!(out.ok);
    }

    #[test]
    fn unknown_transaction_rpc_error_is_skipped() {
        let blob = proof();
        let good = happy_tx();
        let mut responses = HashMap::new();
        responses.insert(
            ("https://unknown.test".into(), "EXPERIMENTAL_tx_status".into()),
            Ok(json!({"jsonrpc":"2.0","error":{"code":-32000,"message":"UNKNOWN_TRANSACTION"},"id":"synthetic"}).to_string().into_bytes()),
        );
        for url in ["https://anchor.test", "https://community.test"] {
            responses.insert(
                (url.into(), "EXPERIMENTAL_tx_status".into()),
                Ok(good.to_string().into_bytes()),
            );
            responses.insert(
                (url.into(), "block".into()),
                Ok(block(CLAIMED).to_string().into_bytes()),
            );
        }
        let config = Config {
            blob_prefixes: vec![DEFAULT_BLOB_PREFIX.into()],
            blob_token: None,
            rpc_urls: vec![
                "https://unknown.test".into(),
                "https://anchor.test".into(),
                "https://community.test".into(),
            ],
            rpc_anchors: vec!["https://anchor.test".into()],
        };
        let out = verify(
            &job(&blob),
            Some(&blob),
            &config,
            &MockHttp {
                responses,
                blob: None,
            },
        );
        assert_eq!(out.reason, None);
        assert!(out.ok);
    }

    #[test]
    fn only_one_rpc_answering_is_rejected() {
        let blob = proof();
        let out = verify_case(
            vec![Some(happy_tx()), None],
            vec![Some(block(CLAIMED)), None],
            &blob,
        );
        assert_eq!(out.reason, Some("rpc_disagreement"));
    }

    #[test]
    fn both_rpcs_erroring_is_rejected() {
        let blob = proof();
        let out = verify_case(vec![None, None], vec![None, None], &blob);
        assert_eq!(out.reason, Some("rpc_disagreement"));
    }

    #[test]
    fn rpc_disagreement_on_inclusion_block_timestamp_is_rejected() {
        let blob = proof();
        let tx = happy_tx();
        let out = verify_case(
            vec![Some(tx.clone()), Some(tx)],
            vec![Some(block(CLAIMED)), Some(block(CLAIMED + 1))],
            &blob,
        );
        assert_eq!(out.reason, Some("rpc_disagreement"));
    }

    #[test]
    fn transaction_before_claim_is_rejected() {
        let blob = proof();
        let tx = happy_tx();
        let out = verify_case(
            vec![Some(tx.clone()), Some(tx)],
            vec![Some(block(CLAIMED - 1)), Some(block(CLAIMED - 1))],
            &blob,
        );
        assert_eq!(out.reason, Some("old_tx"));
    }

    #[test]
    fn non_final_execution_status_is_rejected() {
        let mut tx = happy_tx();
        tx["result"]["final_execution_status"] = json!("EXECUTED");
        assert_eq!(agreed(tx).reason, Some("rpc_disagreement"));
    }

    #[test]
    fn returned_transaction_hash_must_match_requested_hash() {
        let mut tx = happy_tx();
        tx["result"]["transaction"]["hash"] = json!("22222222222222222222222222222222");
        assert_eq!(agreed(tx).reason, Some("rpc_disagreement"));
    }

    #[test]
    fn duplicate_rpc_url_variants_count_once() {
        let blob = proof();
        let good = happy_tx();
        let url = "https://same.test".to_owned();
        let responses = HashMap::from([
            (
                (url.clone(), "EXPERIMENTAL_tx_status".into()),
                Ok(good.to_string().into_bytes()),
            ),
            (
                (url.clone(), "block".into()),
                Ok(block(CLAIMED).to_string().into_bytes()),
            ),
        ]);
        let config = Config {
            blob_prefixes: vec![DEFAULT_BLOB_PREFIX.into()],
            blob_token: None,
            rpc_urls: vec![
                url,
                "https://SAME.TEST/".into(),
                "https://same.test:443/rpc".into(),
            ],
            rpc_anchors: vec!["https://same.test/path".into()],
        };
        let output = verify(
            &job(&blob),
            Some(&blob),
            &config,
            &MockHttp {
                responses,
                blob: None,
            },
        );
        assert_eq!(output.reason, Some("rpc_disagreement"));
    }

    #[test]
    fn duplicate_host_variants_are_all_queried_and_disagreement_rejects() {
        let blob = proof();
        let good = happy_tx();
        let mut changed = happy_tx();
        changed["result"]["receipts_outcome"][1]["outcome"]["logs"] = json!([]);
        let out = verify_urls(
            vec![
                "https://anchor.test".into(),
                "https://ANCHOR.TEST/path".into(),
                "https://community.test".into(),
            ],
            vec!["https://anchor.test".into()],
            vec![Some(good.clone()), Some(changed), Some(good)],
            vec![Some(block(CLAIMED)); 3],
            &blob,
        );
        assert_eq!(out.reason, Some("rpc_disagreement"));
    }

    #[test]
    fn fetches_blob_with_bearer_token_and_checks_hash() {
        let blob = proof();
        let good = happy_tx();
        let responses = HashMap::from_iter((0..2).flat_map(|index| {
            let url = format!("https://rpc{index}.test");
            [
                (
                    (url.clone(), "EXPERIMENTAL_tx_status".into()),
                    Ok(good.to_string().into_bytes()),
                ),
                (
                    (url, "block".into()),
                    Ok(block(CLAIMED).to_string().into_bytes()),
                ),
            ]
        }));
        let config = Config {
            blob_prefixes: vec![DEFAULT_BLOB_PREFIX.into()],
            blob_token: Some("synthetic-token".into()),
            rpc_urls: vec!["https://rpc0.test".into(), "https://rpc1.test".into()],
            rpc_anchors: vec!["https://rpc0.test".into()],
        };
        let http = MockHttp {
            responses,
            blob: Some(blob.clone()),
        };
        assert!(verify(&job(&blob), None, &config, &http).ok);
        let mut tampered = job(&blob);
        tampered.proof_sha256 = "0".repeat(64);
        assert_eq!(
            verify(&tampered, Some(&blob), &config, &http).reason,
            Some("sha256_mismatch")
        );
    }

    #[test]
    fn wrong_order_id_in_proof_blob_is_rejected() {
        let blob = format!(r#"{{"order_id":"OTHER","tx_hash":"{TX_HASH}"}}"#);
        let tx = happy_tx();
        let out = verify_case(
            vec![Some(tx.clone()), Some(tx)],
            vec![Some(block(CLAIMED)), Some(block(CLAIMED))],
            blob.as_bytes(),
        );
        assert_eq!(out.reason, Some("order_id_mismatch"));
    }

    #[test]
    fn invalid_base58_transaction_hash_is_rejected() {
        let blob = br#"{"order_id":"FUL-TOKEN01","tx_hash":"bad"}"#;
        let tx = happy_tx();
        let out = verify_case(
            vec![Some(tx.clone()), Some(tx)],
            vec![Some(block(CLAIMED)), Some(block(CLAIMED))],
            blob,
        );
        assert_eq!(out.reason, Some("tx_hash_invalid"));
    }
}
