use chrono::{DateTime, NaiveDateTime, Utc};
use serde::de::{MapAccess, SeqAccess, Visitor};
use serde::{Deserialize, Deserializer, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::time::{SystemTime, UNIX_EPOCH};

pub const ALLOWED_BLOB_PREFIXES: &[&str] = &["https://fulfil.junstudio.xyz/api/proof-blob/"];
pub const MCP_URL: &str = "https://api.cryptorefills.com/mcp/http";
pub const MAX_ORDER_SKEW_NS: u64 = 600_000_000_000;
pub const MAX_FUTURE_SKEW_NS: u64 = 300_000_000_000;
pub const BLOB_MAX_BYTES: usize = 64 * 1024;
pub const MCP_MAX_BYTES: usize = 1024 * 1024;

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
}

#[derive(Serialize)]
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

    fn success(job: &Job, api_order_id: &str, completed_at_ns: u64) -> Self {
        Self {
            ok: true,
            reason: None,
            order_id: job.order_id.clone(),
            proof_sha256: job.proof_sha256.clone(),
            spec_hash: job.spec_hash.clone(),
            nullifier: hex_sha256(format!("cryptorefills:{api_order_id}").as_bytes()),
            completed_at_ns: completed_at_ns.to_string(),
        }
    }
}

#[derive(Deserialize)]
struct Spec {
    beneficiary_hash: String,
    brand_name: String,
    country: String,
    delivery_type: String,
    denomination: String,
    product_value: String,
    salt: String,
    v: u32,
}

struct Blob {
    cr_order_id: String,
    cr_order_token: String,
}

pub struct Config {
    pub blob_prefixes: Vec<String>,
    pub blob_token: Option<String>,
    pub now_ns: Option<u64>,
}

impl Config {
    pub fn from_env() -> Self {
        Self {
            blob_prefixes: std::env::var("PROOF_BLOB_PREFIX")
                .ok()
                .filter(|value| !value.is_empty())
                .map(|value| vec![value])
                .unwrap_or_else(|| {
                    ALLOWED_BLOB_PREFIXES
                        .iter()
                        .map(|value| (*value).into())
                        .collect()
                }),
            blob_token: std::env::var("PROOF_BLOB_TOKEN")
                .ok()
                .filter(|value| !value.is_empty()),
            // WASI P2's SystemTime is the OutLayer TEE wall clock; missing time fails closed.
            now_ns: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .ok()
                .and_then(|duration| u64::try_from(duration.as_nanos()).ok()),
        }
    }
}

impl Default for Config {
    fn default() -> Self {
        Self::from_env()
    }
}

pub trait Http {
    fn get(&self, url: &str, headers: &[(&str, &str)]) -> Result<Vec<u8>, HttpError>;
    fn post(&self, url: &str, headers: &[(&str, &str)], body: &[u8]) -> Result<Vec<u8>, HttpError>;
}

/// Deliberately carries no response data or credentials into errors or logs.
pub struct HttpError;

pub fn hex_sha256(bytes: &[u8]) -> String {
    Sha256::digest(bytes)
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

pub fn normalize_beneficiary(value: &str, delivery_type: &str) -> Option<String> {
    match delivery_type {
        "by_phone" => {
            let trimmed = value.trim_matches(|character: char| character.is_ascii_whitespace());
            let digits = trimmed.strip_prefix('+')?;
            if (8..=15).contains(&digits.len())
                && digits.starts_with(|digit: char| ('1'..='9').contains(&digit))
                && digits.bytes().all(|digit| digit.is_ascii_digit())
            {
                Some(trimmed.to_owned())
            } else {
                None
            }
        }
        "by_email" => {
            let email = value.trim().to_lowercase();
            let (local, domain) = email.split_once('@')?;
            let (host, suffix) = domain.rsplit_once('.')?;
            if email.len() <= 254
                && !local.is_empty()
                && !host.is_empty()
                && !suffix.is_empty()
                && !email.chars().any(char::is_whitespace)
                && !domain.contains('@')
            {
                Some(email)
            } else {
                None
            }
        }
        _ => None,
    }
}

pub fn beneficiary_hash(salt: &str, value: &str, delivery_type: &str) -> Option<String> {
    normalize_beneficiary(value, delivery_type)
        .map(|beneficiary| hex_sha256(format!("{salt}:{beneficiary}").as_bytes()))
}

fn valid_hex(value: &str, length: usize) -> bool {
    value.len() == length
        && value
            .bytes()
            .all(|byte| byte.is_ascii_hexdigit() && !byte.is_ascii_uppercase())
}

fn parse_spec(job: &Job) -> Result<Spec, &'static str> {
    if job.kind != "cryptorefills_topup" && job.kind != "cryptorefills_code" {
        return Err("kind_mismatch");
    }
    if hex_sha256(job.spec.as_bytes()) != job.spec_hash {
        return Err("spec_hash_mismatch");
    }
    let spec: Spec = serde_json::from_str(&job.spec).map_err(|_| "spec_invalid")?;
    if spec.v != 1
        || !valid_hex(&spec.beneficiary_hash, 64)
        || !valid_hex(&spec.salt, 32)
        || spec.brand_name.is_empty()
        || spec.country.is_empty()
        || spec.delivery_type.is_empty()
        || (spec.delivery_type != "by_phone" && spec.delivery_type != "by_email")
        || (spec.denomination.is_empty() == spec.product_value.is_empty())
        || (!spec.product_value.is_empty() && decimal(&spec.product_value).is_none())
    {
        return Err("spec_invalid");
    }
    Ok(spec)
}

fn blob_url_allowed(job: &Job, prefixes: &[String]) -> bool {
    valid_hex(&job.proof_sha256, 64)
        && prefixes.iter().any(|prefix| {
            prefix.starts_with("https://")
                && prefix.ends_with('/')
                && job.blob_url == format!("{prefix}{}", job.proof_sha256)
        })
}

/// Parses JSON while rejecting duplicate keys at every object depth.
/// The private number marker is emitted by serde_json's arbitrary_precision mode.
struct StrictValue(Value);

impl<'de> Deserialize<'de> for StrictValue {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        struct StrictVisitor;

        impl<'de> Visitor<'de> for StrictVisitor {
            type Value = StrictValue;

            fn expecting(&self, formatter: &mut std::fmt::Formatter) -> std::fmt::Result {
                formatter.write_str("a JSON value without duplicate object keys")
            }

            fn visit_bool<E: serde::de::Error>(self, value: bool) -> Result<Self::Value, E> {
                Ok(StrictValue(Value::Bool(value)))
            }

            fn visit_i64<E: serde::de::Error>(self, value: i64) -> Result<Self::Value, E> {
                Ok(StrictValue(Value::from(value)))
            }

            fn visit_u64<E: serde::de::Error>(self, value: u64) -> Result<Self::Value, E> {
                Ok(StrictValue(Value::from(value)))
            }

            fn visit_f64<E: serde::de::Error>(self, value: f64) -> Result<Self::Value, E> {
                Ok(StrictValue(Value::from(value)))
            }

            fn visit_str<E: serde::de::Error>(self, value: &str) -> Result<Self::Value, E> {
                Ok(StrictValue(Value::String(value.into())))
            }

            fn visit_string<E: serde::de::Error>(self, value: String) -> Result<Self::Value, E> {
                Ok(StrictValue(Value::String(value)))
            }

            fn visit_none<E: serde::de::Error>(self) -> Result<Self::Value, E> {
                Ok(StrictValue(Value::Null))
            }

            fn visit_unit<E: serde::de::Error>(self) -> Result<Self::Value, E> {
                Ok(StrictValue(Value::Null))
            }

            fn visit_seq<S: SeqAccess<'de>>(
                self,
                mut sequence: S,
            ) -> Result<Self::Value, S::Error> {
                let mut values = Vec::new();
                while let Some(StrictValue(value)) = sequence.next_element()? {
                    values.push(value);
                }
                Ok(StrictValue(Value::Array(values)))
            }

            fn visit_map<M: MapAccess<'de>>(self, mut map: M) -> Result<Self::Value, M::Error> {
                let mut values = serde_json::Map::new();
                while let Some(key) = map.next_key::<String>()? {
                    if key == "$serde_json::private::Number" && values.is_empty() {
                        let raw = map.next_value::<String>()?;
                        let number: Value =
                            serde_json::from_str(&raw).map_err(serde::de::Error::custom)?;
                        if !number.is_number() || map.next_key::<String>()?.is_some() {
                            return Err(serde::de::Error::custom("invalid number"));
                        }
                        return Ok(StrictValue(number));
                    }
                    let StrictValue(value) = map.next_value::<StrictValue>()?;
                    if values.insert(key, value).is_some() {
                        return Err(serde::de::Error::custom("duplicate JSON key"));
                    }
                }
                Ok(StrictValue(Value::Object(values)))
            }
        }

        deserializer.deserialize_any(StrictVisitor)
    }
}

fn strict_json(bytes: &[u8]) -> Result<Value, serde_json::Error> {
    serde_json::from_slice::<StrictValue>(bytes).map(|value| value.0)
}

fn parse_blob(bytes: &[u8]) -> Option<Blob> {
    let value = strict_json(bytes).ok()?;
    let cr_order_id = value.get("cr_order_id")?.as_str()?.to_string();
    let cr_order_token = value.get("cr_order_token")?.as_str()?.to_string();
    if cr_order_id.is_empty() || cr_order_token.is_empty() {
        return None;
    }
    Some(Blob {
        cr_order_id,
        cr_order_token,
    })
}

fn rpc_response(bytes: &[u8]) -> Result<Option<Value>, ()> {
    let text = std::str::from_utf8(bytes).map_err(|_| ())?;
    if let Ok(value) = strict_json(bytes) {
        return Ok((value.get("id") == Some(&json!(1))).then_some(value));
    }
    if serde_json::from_slice::<Value>(bytes)
        .ok()
        .is_some_and(|value| value.get("id") == Some(&json!(1)))
    {
        return Err(());
    }
    let mut data = Vec::new();
    let mut event_is_message = true;
    for line in text.lines().chain(std::iter::once("")) {
        let line = line.trim_end_matches('\r');
        if line.is_empty() {
            if event_is_message && !data.is_empty() {
                let event = data.join("\n");
                match strict_json(event.as_bytes()) {
                    Ok(value) if value.get("id") == Some(&json!(1)) => return Ok(Some(value)),
                    Ok(_) => {}
                    // A syntactically valid SSE message with duplicate keys is not
                    // trustworthy, even when its last duplicate id is not 1.
                    Err(_) if serde_json::from_str::<Value>(&event).is_ok() => return Err(()),
                    Err(_) => {}
                }
            }
            data.clear();
            event_is_message = true;
        } else if let Some(event) = line.strip_prefix("event:") {
            event_is_message = event.trim() == "message";
        } else if let Some(value) = line.strip_prefix("data:") {
            data.push(value.strip_prefix(' ').unwrap_or(value).to_string());
        }
    }
    Ok(None)
}

fn order_from_rpc(value: &Value) -> Result<Value, &'static str> {
    if value.get("error").is_some_and(|error| !error.is_null())
        || value.pointer("/result/isError").and_then(Value::as_bool) == Some(true)
    {
        return Err("mcp_error");
    }
    let result = value.get("result").ok_or("mcp_invalid")?;
    if let Some(order) = result.pointer("/structuredContent/result") {
        return Ok(order.clone());
    }
    let text = result
        .pointer("/content/0/text")
        .and_then(Value::as_str)
        .ok_or("mcp_invalid")?;
    let parsed = strict_json(text.as_bytes()).map_err(|_| "mcp_invalid")?;
    Ok(parsed.get("result").unwrap_or(&parsed).clone())
}

// Canonical unsigned decimal, including JSON exponent notation, without floating point rounding.
fn decimal(value: &str) -> Option<String> {
    let value = value.trim();
    let (coefficient, exponent) = match value.find(['e', 'E']) {
        Some(index) => {
            if value[index + 1..].contains(['e', 'E']) {
                return None;
            }
            let exponent = value[index + 1..].parse::<i32>().ok()?;
            (&value[..index], exponent)
        }
        None => (value, 0),
    };
    let (whole, fraction) = coefficient.split_once('.').unwrap_or((coefficient, ""));
    if whole.is_empty()
        || !whole.bytes().all(|byte| byte.is_ascii_digit())
        || !fraction.bytes().all(|byte| byte.is_ascii_digit())
        || (coefficient.contains('.') && fraction.is_empty())
    {
        return None;
    }
    let digits = format!("{whole}{fraction}");
    let trimmed = digits.trim_start_matches('0');
    if trimmed.is_empty() {
        return Some("0".into());
    }
    let decimal_index = i64::try_from(whole.len()).ok()? + i64::from(exponent)
        - i64::try_from(digits.len() - trimmed.len()).ok()?;
    // Responses are untrusted. A decimal larger than this cannot be a practical product value.
    if !(-1_024..=1_024).contains(&decimal_index) {
        return None;
    }
    let decimal_point = usize::try_from(decimal_index).ok();
    let expanded = if let Some(decimal_point) = decimal_point {
        if decimal_point >= trimmed.len() {
            format!("{trimmed}{}", "0".repeat(decimal_point - trimmed.len()))
        } else if decimal_point == 0 {
            format!("0.{trimmed}")
        } else {
            format!(
                "{}.{}",
                &trimmed[..decimal_point],
                &trimmed[decimal_point..]
            )
        }
    } else {
        format!(
            "0.{}{}",
            "0".repeat(usize::try_from(-decimal_index).ok()?),
            trimmed
        )
    };
    if let Some((whole, fraction)) = expanded.split_once('.') {
        let fraction = fraction.trim_end_matches('0');
        Some(if fraction.is_empty() {
            whole.to_string()
        } else {
            format!("{whole}.{fraction}")
        })
    } else {
        Some(expanded)
    }
}

fn created_at_ns(value: &Value) -> Option<u64> {
    if let Some(number) = value
        .as_u64()
        .or_else(|| value.as_str().and_then(|text| text.parse().ok()))
    {
        let multiplier = if number < 100_000_000_000 {
            1_000_000_000
        } else if number < 100_000_000_000_000 {
            1_000_000
        } else if number < 100_000_000_000_000_000 {
            1_000
        } else {
            1
        };
        return number.checked_mul(multiplier);
    }
    let text = value.as_str()?;
    let timestamp = DateTime::parse_from_rfc3339(text)
        .map(|date| date.with_timezone(&Utc))
        .or_else(|_| {
            NaiveDateTime::parse_from_str(text, "%Y-%m-%dT%H:%M:%S%.f").map(|date| date.and_utc())
        })
        .ok()?;
    u64::try_from(timestamp.timestamp_nanos_opt()?).ok()
}

fn check_order(
    job: &Job,
    spec: &Spec,
    blob: &Blob,
    order: &Value,
    now_ns: u64,
) -> Result<Output, &'static str> {
    let api_order_id = order
        .get("order_id")
        .and_then(Value::as_str)
        .ok_or("order_id_mismatch")?;
    if api_order_id != blob.cr_order_id {
        return Err("order_id_mismatch");
    }
    if order.get("order_state").and_then(Value::as_str) != Some("Done") {
        return Err("order_not_done");
    }
    let deliveries = order
        .get("deliveries")
        .and_then(Value::as_array)
        .ok_or("delivery_count")?;
    if deliveries.len() != 1 {
        return Err("delivery_count");
    }
    let delivery = &deliveries[0];
    if delivery.get("delivery_state").and_then(Value::as_str) != Some("Succeeded") {
        return Err("delivery_not_succeeded");
    }
    let deliverable = delivery.get("deliverable").ok_or("mcp_invalid")?;
    if deliverable.get("brand_name").and_then(Value::as_str) != Some(spec.brand_name.as_str()) {
        return Err("brand_mismatch");
    }
    if !deliverable
        .get("country_code")
        .and_then(Value::as_str)
        .is_some_and(|country| country.eq_ignore_ascii_case(&spec.country))
    {
        return Err("country_mismatch");
    }
    if deliverable.get("delivery_type").and_then(Value::as_str) != Some(spec.delivery_type.as_str())
    {
        return Err("delivery_type_mismatch");
    }
    if !spec.denomination.is_empty() {
        if deliverable
            .get("denomination")
            .and_then(Value::as_str)
            .map(str::trim)
            != Some(spec.denomination.trim())
        {
            return Err("denomination_mismatch");
        }
    } else {
        let product = deliverable
            .get("product_value")
            .ok_or("product_value_mismatch")?;
        let value = product
            .as_str()
            .map(str::to_owned)
            .or_else(|| product.as_number().map(ToString::to_string));
        if value.as_deref().and_then(decimal) != decimal(&spec.product_value) {
            return Err("product_value_mismatch");
        }
    }
    let beneficiary = deliverable
        .get("beneficiary_account")
        .and_then(Value::as_str)
        .ok_or("beneficiary_mismatch")?;
    if beneficiary_hash(&spec.salt, beneficiary, &spec.delivery_type).as_deref()
        != Some(spec.beneficiary_hash.as_str())
    {
        return Err("beneficiary_mismatch");
    }
    let created = order
        .get("created_at")
        .and_then(created_at_ns)
        .ok_or("created_at_invalid")?;
    if created.saturating_add(MAX_ORDER_SKEW_NS) < job.claimed_at_ns {
        return Err("order_too_old");
    }
    if created > now_ns.saturating_add(MAX_FUTURE_SKEW_NS) {
        return Err("created_at_in_future");
    }
    Ok(Output::success(job, api_order_id, created))
}

pub fn verify(
    job: &Job,
    blob_override: Option<&[u8]>,
    config: &Config,
    http: &impl Http,
) -> Output {
    let spec = match parse_spec(job) {
        Ok(spec) => spec,
        Err(reason) => return Output::failure(job, reason),
    };
    let Some(now_ns) = config.now_ns else {
        return Output::failure(job, "clock_unavailable");
    };
    let blob_bytes = if let Some(bytes) = blob_override {
        bytes.to_vec()
    } else {
        if !blob_url_allowed(job, &config.blob_prefixes) {
            return Output::failure(job, "blob_url_not_allowed");
        }
        let Some(token) = config.blob_token.as_deref() else {
            return Output::failure(job, "blob_token_missing");
        };
        let authorization = format!("Bearer {token}");
        match http.get(&job.blob_url, &[("Authorization", &authorization)]) {
            Ok(bytes) => bytes,
            Err(_) => return Output::failure(job, "blob_fetch_fail"),
        }
    };
    if blob_bytes.len() > BLOB_MAX_BYTES {
        return Output::failure(job, "blob_fetch_fail");
    }
    if hex_sha256(&blob_bytes) != job.proof_sha256 {
        return Output::failure(job, "sha256_mismatch");
    }
    let Some(blob) = parse_blob(&blob_bytes) else {
        return Output::failure(job, "blob_invalid");
    };
    let request = json!({"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"getOrderStatus","arguments":{"order_id":blob.cr_order_id,"order_token":blob.cr_order_token}}});
    let body = serde_json::to_vec(&request).expect("fixed JSON-RPC request");
    let response = match http.post(
        MCP_URL,
        &[
            ("User-Agent", "Cryptorefills-MCP/1.0"),
            ("Content-Type", "application/json"),
            ("Accept", "application/json, text/event-stream"),
        ],
        &body,
    ) {
        Ok(bytes) => bytes,
        Err(_) => return Output::failure(job, "mcp_fetch_fail"),
    };
    if response.len() > MCP_MAX_BYTES {
        return Output::failure(job, "mcp_fetch_fail");
    }
    let Ok(Some(rpc)) = rpc_response(&response) else {
        return Output::failure(job, "mcp_invalid");
    };
    let order = match order_from_rpc(&rpc) {
        Ok(order) => order,
        Err(reason) => return Output::failure(job, reason),
    };
    match check_order(job, &spec, &blob, &order, now_ns) {
        Ok(output) => output,
        Err(reason) => Output::failure(job, reason),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::RefCell;

    const SALT: &str = "0123456789abcdef0123456789abcdef";
    const TOKEN: &str = "synthetic-order-token-SECRET";
    const PIN: &str = "synthetic-pin-SECRET";
    const SECURITY: &str = "synthetic-security-SECRET";
    const CREATED: &str = "2026-11-08T12:34:56.123456789Z";
    const CREATED_NS: u64 = 1_794_141_296_123_456_789;

    struct MockHttp {
        blob: Vec<u8>,
        response: Vec<u8>,
        calls: RefCell<Vec<String>>,
    }

    impl Http for MockHttp {
        fn get(&self, url: &str, headers: &[(&str, &str)]) -> Result<Vec<u8>, HttpError> {
            assert_eq!(headers.len(), 1);
            assert_eq!(headers[0], ("Authorization", "Bearer synthetic-blob-token"));
            self.calls.borrow_mut().push(url.into());
            Ok(self.blob.clone())
        }

        fn post(
            &self,
            url: &str,
            headers: &[(&str, &str)],
            body: &[u8],
        ) -> Result<Vec<u8>, HttpError> {
            assert_eq!(url, MCP_URL);
            assert_eq!(headers[0], ("User-Agent", "Cryptorefills-MCP/1.0"));
            assert_eq!(headers[1], ("Content-Type", "application/json"));
            assert_eq!(
                headers[2],
                ("Accept", "application/json, text/event-stream")
            );
            let request: Value = serde_json::from_slice(body).unwrap();
            assert_eq!(request["params"]["name"], "getOrderStatus");
            assert_eq!(
                request["params"]["arguments"]["order_id"],
                "synthetic-cr-order-1"
            );
            assert_eq!(request["params"]["arguments"]["order_token"], TOKEN);
            self.calls.borrow_mut().push(url.into());
            Ok(self.response.clone())
        }
    }

    fn test_config() -> Config {
        Config {
            now_ns: Some(CREATED_NS),
            ..Config::default()
        }
    }

    fn blob() -> Vec<u8> {
        format!(r#"{{"cr_order_id":"synthetic-cr-order-1","cr_order_token":"{TOKEN}"}}"#)
            .into_bytes()
    }

    fn spec(denomination: &str, product_value: &str) -> String {
        format!(
            r#"{{"beneficiary_hash":"{}","brand_name":"Viettel Mobile Credits","country":"VN","delivery_type":"by_phone","denomination":"{denomination}","product_value":"{product_value}","salt":"{SALT}","v":1}}"#,
            beneficiary_hash(SALT, "+84901234567", "by_phone").unwrap()
        )
    }

    fn job(blob: &[u8], spec: String) -> Job {
        Job {
            order_id: "FUL-SYNTHETIC-1".into(),
            kind: "cryptorefills_topup".into(),
            spec_hash: hex_sha256(spec.as_bytes()),
            spec,
            proof_sha256: hex_sha256(blob),
            claimed_at_ns: CREATED_NS,
            blob_url: format!("{}{}", ALLOWED_BLOB_PREFIXES[0], hex_sha256(blob)),
        }
    }

    fn order() -> Value {
        json!({
            "order_id":"synthetic-cr-order-1",
            "order_state":"Done",
            "created_at":CREATED,
            "deliveries":[{
                "delivery_state":"Succeeded",
                "deliverable":{
                    "brand_name":"Viettel Mobile Credits",
                    "country_code":"vn",
                    "delivery_type":"by_phone",
                    "denomination":" 20000 VND ",
                    "product_value":20000.00,
                    "beneficiary_account":"+84901234567",
                    "pin_code":PIN,
                    "security_code":SECURITY,
                    "voucher_url":"https://synthetic.test/SECRET",
                    "redeem_url":"https://synthetic.test/redeem/SECRET"
                }
            }]
        })
    }

    fn response(order: &Value) -> Vec<u8> {
        serde_json::to_vec(
            &json!({"jsonrpc":"2.0","id":1,"result":{"structuredContent":{"result":order}}}),
        )
        .unwrap()
    }

    fn run_with(job: &Job, order: &Value) -> Output {
        verify(
            job,
            Some(&blob()),
            &test_config(),
            &MockHttp {
                blob: blob(),
                response: response(order),
                calls: RefCell::new(Vec::new()),
            },
        )
    }

    #[test]
    fn success_exact_json_and_no_secret_leak() {
        let blob = blob();
        let job = self::job(&blob, spec("20000 VND", ""));
        let output = run_with(&job, &order());
        let json = serde_json::to_string(&output).unwrap();
        let expected = format!(
            r#"{{"ok":true,"order_id":"FUL-SYNTHETIC-1","proof_sha256":"{}","spec_hash":"{}","nullifier":"{}","completed_at_ns":"{CREATED_NS}"}}"#,
            job.proof_sha256,
            job.spec_hash,
            hex_sha256(b"cryptorefills:synthetic-cr-order-1")
        );
        assert_eq!(json, expected);
        for secret in [
            TOKEN,
            PIN,
            SECURITY,
            "https://synthetic.test/SECRET",
            "https://synthetic.test/redeem/SECRET",
        ] {
            assert!(!json.contains(secret));
        }
    }

    #[test]
    fn formatted_upstream_phone_is_rejected() {
        let blob = blob();
        let job = self::job(&blob, spec("20000 VND", ""));
        let mut formatted = order();
        formatted["deliveries"][0]["deliverable"]["beneficiary_account"] =
            json!(" +84 (90) 123-4567 ");
        assert_eq!(
            run_with(&job, &formatted).reason,
            Some("beneficiary_mismatch")
        );
        assert!(run_with(&job, &order()).ok);
    }

    #[test]
    fn field_mismatches_have_distinct_reasons() {
        let blob = blob();
        let job = job(&blob, spec("20000 VND", ""));
        let cases = [
            ("/order_state", json!("Pending"), "order_not_done"),
            (
                "/deliveries/0/delivery_state",
                json!("Pending"),
                "delivery_not_succeeded",
            ),
            (
                "/deliveries/0/deliverable/brand_name",
                json!("Wrong Brand"),
                "brand_mismatch",
            ),
            (
                "/deliveries/0/deliverable/country_code",
                json!("US"),
                "country_mismatch",
            ),
            (
                "/deliveries/0/deliverable/delivery_type",
                json!("by_email"),
                "delivery_type_mismatch",
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
            ("/created_at", json!("invalid"), "created_at_invalid"),
        ];
        for (path, value, reason) in cases {
            let mut changed = order();
            *changed.pointer_mut(path).unwrap() = value;
            assert_eq!(run_with(&job, &changed).reason, Some(reason), "{path}");
        }
        let mut changed = order();
        changed["deliveries"]
            .as_array_mut()
            .unwrap()
            .push(order()["deliveries"][0].clone());
        assert_eq!(run_with(&job, &changed).reason, Some("delivery_count"));
        let mut old = order();
        old["created_at"] = json!(CREATED_NS - MAX_ORDER_SKEW_NS - 1);
        assert_eq!(run_with(&job, &old).reason, Some("order_too_old"));
    }

    #[test]
    fn api_order_id_must_match_blob_exactly() {
        let blob = blob();
        let job = job(&blob, spec("20000 VND", ""));
        for order_id in [
            "SYNTHETIC-cr-order-1",
            " synthetic-cr-order-1",
            "synthetic-cr-order-1 ",
        ] {
            let mut changed = order();
            changed["order_id"] = json!(order_id);
            assert_eq!(run_with(&job, &changed).reason, Some("order_id_mismatch"));
        }
        let mut missing = order();
        missing.as_object_mut().unwrap().remove("order_id");
        assert_eq!(run_with(&job, &missing).reason, Some("order_id_mismatch"));
        missing["order_id"] = json!(1);
        assert_eq!(run_with(&job, &missing).reason, Some("order_id_mismatch"));
    }

    #[test]
    fn duplicate_checked_json_keys_are_invalid() {
        let duplicate_blob = format!(r#"{{"cr_order_id":"synthetic-cr-order-1","cr_order_id":"other","cr_order_token":"{TOKEN}"}}"#).into_bytes();
        let job = job(&duplicate_blob, spec("20000 VND", ""));
        let http = MockHttp {
            blob: duplicate_blob.clone(),
            response: response(&order()),
            calls: RefCell::new(Vec::new()),
        };
        assert_eq!(
            verify(&job, Some(&duplicate_blob), &test_config(), &http).reason,
            Some("blob_invalid")
        );
        assert!(http.calls.borrow().is_empty());

        let blob = blob();
        let job = self::job(&blob, spec("20000 VND", ""));
        let rpc = String::from_utf8(response(&order())).unwrap();
        let duplicate_order_id = rpc.replace(
            "\"order_id\":\"synthetic-cr-order-1\"",
            "\"order_id\":\"synthetic-cr-order-1\",\"order_id\":\"synthetic-cr-order-1\"",
        );
        let duplicate_brand = rpc.replace(
            "\"brand_name\":\"Viettel Mobile Credits\"",
            "\"brand_name\":\"Viettel Mobile Credits\",\"brand_name\":\"Other\"",
        );
        for raw in [duplicate_order_id, duplicate_brand] {
            let http = MockHttp {
                blob: blob.clone(),
                response: raw.into_bytes(),
                calls: RefCell::new(Vec::new()),
            };
            assert_eq!(
                verify(&job, Some(&blob), &test_config(), &http).reason,
                Some("mcp_invalid")
            );
        }
    }

    #[test]
    fn oversized_http_bodies_and_failed_post_use_fetch_reasons() {
        let blob = blob();
        let oversized_blob = vec![b'x'; BLOB_MAX_BYTES + 1];
        let job = job(&oversized_blob, spec("20000 VND", ""));
        let http = MockHttp {
            blob: oversized_blob.clone(),
            response: response(&order()),
            calls: RefCell::new(Vec::new()),
        };
        assert_eq!(
            verify(
                &job,
                None,
                &Config {
                    blob_prefixes: vec![ALLOWED_BLOB_PREFIXES[0].into()],
                    blob_token: Some("synthetic-blob-token".into()),
                    now_ns: Some(CREATED_NS),
                },
                &http
            )
            .reason,
            Some("blob_fetch_fail")
        );
        assert_eq!(
            verify(&job, Some(&oversized_blob), &test_config(), &http).reason,
            Some("blob_fetch_fail")
        );

        let job = self::job(&blob, spec("20000 VND", ""));
        let http = MockHttp {
            blob: blob.clone(),
            response: vec![b'x'; MCP_MAX_BYTES + 1],
            calls: RefCell::new(Vec::new()),
        };
        assert_eq!(
            verify(&job, Some(&blob), &test_config(), &http).reason,
            Some("mcp_fetch_fail")
        );
        struct RejectedPost;
        impl Http for RejectedPost {
            fn get(&self, _: &str, _: &[(&str, &str)]) -> Result<Vec<u8>, HttpError> {
                Err(HttpError)
            }
            fn post(&self, _: &str, _: &[(&str, &str)], _: &[u8]) -> Result<Vec<u8>, HttpError> {
                Err(HttpError)
            }
        }
        assert_eq!(
            verify(&job, Some(&blob), &test_config(), &RejectedPost).reason,
            Some("mcp_fetch_fail")
        );
    }

    #[test]
    fn missing_beneficiary_fails_closed() {
        let blob = blob();
        let job = job(&blob, spec("20000 VND", ""));
        let mut changed = order();
        changed["deliveries"][0]["deliverable"]
            .as_object_mut()
            .unwrap()
            .remove("beneficiary_account");
        assert_eq!(
            run_with(&job, &changed).reason,
            Some("beneficiary_mismatch")
        );
    }

    #[test]
    fn proof_and_spec_hashes_are_checked_before_http() {
        let blob = blob();
        let mut job = job(&blob, spec("20000 VND", ""));
        let http = MockHttp {
            blob: blob.clone(),
            response: response(&order()),
            calls: RefCell::new(Vec::new()),
        };
        job.spec_hash = "0".repeat(64);
        assert_eq!(
            verify(&job, None, &test_config(), &http).reason,
            Some("spec_hash_mismatch")
        );
        job.spec_hash = hex_sha256(job.spec.as_bytes());
        job.kind = "wrong".into();
        assert_eq!(
            verify(&job, None, &test_config(), &http).reason,
            Some("kind_mismatch")
        );
        job.kind = "cryptorefills_code".into();
        job.proof_sha256 = "0".repeat(64);
        assert_eq!(
            verify(&job, Some(&blob), &test_config(), &http).reason,
            Some("sha256_mismatch")
        );
        assert!(http.calls.borrow().is_empty());
    }

    #[test]
    fn sse_framing_and_fallback_content() {
        let blob = blob();
        let job = job(&blob, spec("20000 VND", ""));
        let rpc = String::from_utf8(response(&order())).unwrap();
        let split = rpc.find(",\"result\"").unwrap() + 1;
        let sse = format!("event: ping\ndata: {{\"jsonrpc\":\"2.0\",\"id\":2}}\n\nevent: message\ndata: {}\ndata: {}\n\n", &rpc[..split], &rpc[split..]);
        // A multiline SSE data event joins lines with a newline; split at a JSON token boundary.
        let http = MockHttp {
            blob: blob.clone(),
            response: sse.into_bytes(),
            calls: RefCell::new(Vec::new()),
        };
        assert!(verify(&job, Some(&blob), &test_config(), &http).ok);
        let notification = "event: message\ndata: {\"jsonrpc\":\"2.0\",\"method\":\"notifications/progress\"}\n\nevent: message\ndata: {\"jsonrpc\":\"2.0\",\"id\":2,\"result\":{}}\n\n";
        let http = MockHttp {
            blob: blob.clone(),
            response: format!("{notification}event: message\ndata: {rpc}\n\n").into_bytes(),
            calls: RefCell::new(Vec::new()),
        };
        assert!(verify(&job, Some(&blob), &test_config(), &http).ok);
        let duplicate_id_one = rpc.replace(
            "\"order_id\":\"synthetic-cr-order-1\"",
            "\"order_id\":\"synthetic-cr-order-1\",\"order_id\":\"other\"",
        );
        let http = MockHttp {
            blob: blob.clone(),
            response: format!(
                "event: message\ndata: {duplicate_id_one}\n\nevent: message\ndata: {rpc}\n\n"
            )
            .into_bytes(),
            calls: RefCell::new(Vec::new()),
        };
        assert_eq!(
            verify(&job, Some(&blob), &test_config(), &http).reason,
            Some("mcp_invalid")
        );
        let duplicate_id =
            "event: message\ndata: {\"jsonrpc\":\"2.0\",\"id\":1,\"id\":2,\"result\":{}}\n\n";
        let http = MockHttp {
            blob: blob.clone(),
            response: format!("{duplicate_id}event: message\ndata: {rpc}\n\n").into_bytes(),
            calls: RefCell::new(Vec::new()),
        };
        assert_eq!(
            verify(&job, Some(&blob), &test_config(), &http).reason,
            Some("mcp_invalid")
        );
        let fallback = json!({"jsonrpc":"2.0","id":1,"result":{"content":[{"text":json!({"result":order()}).to_string()}]}});
        let http = MockHttp {
            blob: blob.clone(),
            response: fallback.to_string().into_bytes(),
            calls: RefCell::new(Vec::new()),
        };
        assert!(verify(&job, Some(&blob), &test_config(), &http).ok);
    }

    #[test]
    fn range_values_and_epoch_timestamps() {
        let blob = blob();
        let job = job(&blob, spec("", "20000.000"));
        let mut changed = order();
        changed["created_at"] = json!(CREATED_NS);
        assert_eq!(
            run_with(&job, &changed).completed_at_ns,
            CREATED_NS.to_string()
        );
        changed["created_at"] = json!(CREATED_NS / 1_000_000);
        assert!(run_with(&job, &changed).ok);
        changed["deliveries"][0]["deliverable"]["product_value"] = json!("20000.001");
        assert_eq!(
            run_with(&job, &changed).reason,
            Some("product_value_mismatch")
        );
        changed["deliveries"][0]["deliverable"]["product_value"] =
            serde_json::from_str("2e4").unwrap();
        assert!(run_with(&job, &changed).ok);
    }

    #[test]
    fn epoch_seconds_created_at_is_converted_to_nanoseconds() {
        const EPOCH_SECONDS: u64 = 1_794_111_051;
        let blob = blob();
        let mut job = job(&blob, spec("20000 VND", ""));
        job.claimed_at_ns = EPOCH_SECONDS * 1_000_000_000;
        let mut changed = order();
        changed["created_at"] = json!(EPOCH_SECONDS);
        assert_eq!(
            run_with(&job, &changed).completed_at_ns,
            (EPOCH_SECONDS * 1_000_000_000).to_string()
        );
    }

    #[test]
    fn decimal_normalizes_exponents_without_floating_point() {
        assert_eq!(decimal("20000"), Some("20000".into()));
        assert_eq!(decimal("20000.000"), Some("20000".into()));
        assert_eq!(decimal("2e4"), Some("20000".into()));
        assert_eq!(decimal("2.00e-3"), Some("0.002".into()));
        assert_eq!(decimal("1e1025"), None);
        assert_eq!(decimal("2e"), None);
    }

    #[test]
    fn high_precision_json_product_value_is_compared_exactly() {
        let blob = blob();
        let job = job(&blob, spec("", "20000.000000000000000001"));
        let mut changed = order();
        changed["deliveries"][0]["deliverable"]["product_value"] =
            serde_json::from_str("20000.000000000000000001").unwrap();
        assert!(run_with(&job, &changed).ok);
        changed["deliveries"][0]["deliverable"]["product_value"] =
            serde_json::from_str("20000.000000000000000002").unwrap();
        assert_eq!(
            run_with(&job, &changed).reason,
            Some("product_value_mismatch")
        );
    }

    #[test]
    fn mcp_errors_use_the_fixed_reason() {
        let blob = blob();
        let job = job(&blob, spec("20000 VND", ""));
        let http = MockHttp {
            blob: blob.clone(),
            response: br#"{"jsonrpc":"2.0","id":1,"error":{"code":-32000}}"#.to_vec(),
            calls: RefCell::new(Vec::new()),
        };
        assert_eq!(
            verify(&job, Some(&blob), &test_config(), &http).reason,
            Some("mcp_error")
        );
    }

    #[test]
    fn fetches_blob_only_from_exact_allowed_url() {
        let blob = blob();
        let mut job = job(&blob, spec("20000 VND", ""));
        let config = Config {
            blob_prefixes: vec![ALLOWED_BLOB_PREFIXES[0].into()],
            blob_token: Some("synthetic-blob-token".into()),
            now_ns: Some(CREATED_NS),
        };
        let http = MockHttp {
            blob: blob.clone(),
            response: response(&order()),
            calls: RefCell::new(Vec::new()),
        };
        assert!(verify(&job, None, &config, &http).ok);
        http.calls.borrow_mut().clear();
        job.blob_url.push_str("?redirect=https://synthetic.test");
        assert_eq!(
            verify(&job, None, &config, &http).reason,
            Some("blob_url_not_allowed")
        );
        assert!(http.calls.borrow().is_empty());
    }
}
