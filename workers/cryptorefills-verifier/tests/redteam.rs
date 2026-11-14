use cryptorefills_verifier::{
    beneficiary_hash, hex_sha256, normalize_beneficiary, verify, Config, Http, HttpError, Job,
    ALLOWED_BLOB_PREFIXES, MAX_FUTURE_SKEW_NS, MAX_ORDER_SKEW_NS, MCP_URL,
};
use serde_json::{json, Value};
use std::cell::Cell;

const SALT: &str = "0123456789abcdef0123456789abcdef";
const CREATED: u64 = 1_794_141_296_000_000_000;

struct MockHttp {
    blob: Vec<u8>,
    response: Vec<u8>,
    posts: Cell<u32>,
}

impl Http for MockHttp {
    fn get(&self, _: &str, headers: &[(&str, &str)]) -> Result<Vec<u8>, HttpError> {
        assert_eq!(headers, &[("Authorization", "Bearer synthetic-secret")]);
        Ok(self.blob.clone())
    }

    fn post(&self, url: &str, headers: &[(&str, &str)], body: &[u8]) -> Result<Vec<u8>, HttpError> {
        assert_eq!(url, MCP_URL);
        assert!(headers.contains(&("User-Agent", "Cryptorefills-MCP/1.0")));
        let request: Value = serde_json::from_slice(body).unwrap();
        assert_eq!(
            request["params"]["arguments"]["order_id"],
            "synthetic-order"
        );
        assert_eq!(
            request["params"]["arguments"]["order_token"],
            "synthetic-token"
        );
        self.posts.set(self.posts.get() + 1);
        Ok(self.response.clone())
    }
}

fn blob() -> Vec<u8> {
    br#"{"cr_order_id":"synthetic-order","cr_order_token":"synthetic-token"}"#.to_vec()
}

fn spec() -> String {
    format!(
        r#"{{"beneficiary_hash":"{}","brand_name":"Viettel","country":"VN","delivery_type":"by_phone","denomination":"20000 VND","product_value":"","salt":"{SALT}","v":1}}"#,
        beneficiary_hash(SALT, "+84901234567", "by_phone").unwrap()
    )
}

fn job() -> Job {
    let blob = blob();
    let spec = spec();
    let proof_sha256 = hex_sha256(&blob);
    Job {
        order_id: "FUL-REDTEAM".into(),
        kind: "cryptorefills_topup".into(),
        spec_hash: hex_sha256(spec.as_bytes()),
        spec,
        proof_sha256: proof_sha256.clone(),
        claimed_at_ns: CREATED,
        blob_url: format!("{}{proof_sha256}", ALLOWED_BLOB_PREFIXES[0]),
    }
}

fn order() -> Value {
    json!({"order_id":"synthetic-order","order_state":"Done","created_at":CREATED.to_string(),
        "deliveries":[{"delivery_state":"Succeeded","deliverable":{
            "brand_name":"Viettel","country_code":"VN","delivery_type":"by_phone",
            "denomination":"20000 VND","beneficiary_account":"+84901234567",
            "pin_code":"synthetic-pin"}}]})
}

fn http(blob: Vec<u8>, order: Value) -> MockHttp {
    MockHttp {
        blob,
        response: json!({"jsonrpc":"2.0","id":1,"result":{"structuredContent":{"result":order}}})
            .to_string()
            .into_bytes(),
        posts: Cell::new(0),
    }
}

fn config() -> Config {
    Config {
        blob_prefixes: vec![ALLOWED_BLOB_PREFIXES[0].into()],
        blob_token: Some("synthetic-secret".into()),
        now_ns: Some(CREATED),
    }
}

#[test]
fn fetched_blob_swap_is_rejected_before_mcp_call() {
    let swapped =
        br#"{"cr_order_id":"synthetic-order","cr_order_token":"attacker-token"}"#.to_vec();
    let http = http(swapped, order());
    let result = verify(&job(), None, &config(), &http);
    assert_eq!(result.reason, Some("sha256_mismatch"));
    assert_eq!(http.posts.get(), 0);
}

#[test]
fn stale_or_mismatched_purchase_cannot_pay() {
    let cases = [
        (
            "/created_at",
            json!((CREATED - MAX_ORDER_SKEW_NS - 1).to_string()),
            "order_too_old",
        ),
        (
            "/deliveries/0/deliverable/denomination",
            json!("10000 VND"),
            "denomination_mismatch",
        ),
        (
            "/deliveries/0/deliverable/beneficiary_account",
            json!("+84999999999"),
            "beneficiary_mismatch",
        ),
        (
            "/order_id",
            json!("someone-elses-order"),
            "order_id_mismatch",
        ),
    ];
    for (path, value, reason) in cases {
        let mut changed = order();
        *changed.pointer_mut(path).unwrap() = value;
        let result = verify(&job(), Some(&blob()), &config(), &http(blob(), changed));
        assert_eq!(result.reason, Some(reason), "{path}");
    }
}

#[test]
fn successful_output_namespaces_nullifier_and_hides_credentials() {
    let result = verify(&job(), Some(&blob()), &config(), &http(blob(), order()));
    assert!(result.ok);
    assert_eq!(
        result.nullifier,
        hex_sha256(b"cryptorefills:synthetic-order")
    );
    let serialized = serde_json::to_string(&result).unwrap();
    assert!(!serialized.contains("synthetic-token"));
    assert!(!serialized.contains("synthetic-pin"));
}

#[test]
fn vuln_beneficiary_normalization_requires_e164_phone() {
    assert_ne!(
        normalize_beneficiary("abc+84901234567", "by_phone"),
        Some("+84901234567".into())
    );
}

#[test]
fn shared_beneficiary_vectors_match_worker_validation() {
    let vectors: Value = serde_json::from_str(include_str!(
        "../../../packages/core/src/beneficiary-vectors.json"
    ))
    .unwrap();
    for vector in vectors.as_array().unwrap() {
        let actual = normalize_beneficiary(
            vector["input"].as_str().unwrap(),
            vector["delivery_type"].as_str().unwrap(),
        );
        assert_eq!(actual.as_deref(), vector["normalized"].as_str(), "{vector}");
    }
}

#[test]
fn non_e164_upstream_beneficiary_fails_closed() {
    let mut changed = order();
    changed["deliveries"][0]["deliverable"]["beneficiary_account"] = json!(" +84 (90) 123-4567 ");
    let result = verify(&job(), Some(&blob()), &config(), &http(blob(), changed));
    assert_eq!(result.reason, Some("beneficiary_mismatch"));
}

#[test]
fn vuln_future_purchase_timestamp_is_rejected() {
    let mut future = order();
    future["created_at"] = json!((CREATED + 24 * 60 * 60 * 1_000_000_000).to_string());
    let result = verify(&job(), Some(&blob()), &config(), &http(blob(), future));
    assert!(!result.ok);
    assert_eq!(result.reason, Some("created_at_in_future"));
}

#[test]
fn future_purchase_skew_boundary_is_inclusive() {
    let mut at_boundary = order();
    at_boundary["created_at"] = json!((CREATED + MAX_FUTURE_SKEW_NS).to_string());
    assert!(verify(&job(), Some(&blob()), &config(), &http(blob(), at_boundary)).ok);

    let mut beyond_boundary = order();
    beyond_boundary["created_at"] = json!((CREATED + MAX_FUTURE_SKEW_NS + 1).to_string());
    let result = verify(
        &job(),
        Some(&blob()),
        &config(),
        &http(blob(), beyond_boundary),
    );
    assert_eq!(result.reason, Some("created_at_in_future"));
}

#[test]
fn unavailable_clock_fails_closed() {
    let mut unavailable = config();
    unavailable.now_ns = None;
    let result = verify(&job(), Some(&blob()), &unavailable, &http(blob(), order()));
    assert_eq!(result.reason, Some("clock_unavailable"));
}
