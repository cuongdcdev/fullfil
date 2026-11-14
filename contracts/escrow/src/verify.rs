//! Parse the OutLayer wrapper and enforce kind-independent payout conditions.
use near_sdk::serde_json::{self, Value};

use crate::types::{is_hex64, Order};

#[derive(Debug)]
pub struct VerifyOutput {
    pub ok: bool,
    pub reason: Option<String>,
    pub order_id: Option<String>,
    pub proof_sha256: Option<String>,
    pub spec_hash: Option<String>,
    pub nullifier: Option<String>,
    pub completed_at_ns: Option<u64>,
}

fn get_str(v: &Value, key: &str) -> Option<String> {
    v.get(key).and_then(Value::as_str).map(str::to_string)
}

fn get_u64(v: &Value, key: &str) -> Option<u64> {
    match v.get(key) {
        Some(Value::Number(n)) => n.as_u64(),
        Some(Value::String(s)) => s.parse().ok(),
        _ => None,
    }
}

fn from_value(v: &Value) -> Result<VerifyOutput, String> {
    if !v.is_object() {
        return Err("bad worker output".into());
    }
    Ok(VerifyOutput {
        ok: v.get("ok").and_then(Value::as_bool).unwrap_or(false),
        reason: get_str(v, "reason"),
        order_id: get_str(v, "order_id"),
        proof_sha256: get_str(v, "proof_sha256"),
        spec_hash: get_str(v, "spec_hash"),
        nullifier: get_str(v, "nullifier"),
        completed_at_ns: get_u64(v, "completed_at_ns"),
    })
}

/// Accepts the worker object, JSON string, or OutLayer's success/output wrapper.
pub fn parse_outlayer(bytes: &[u8]) -> Result<VerifyOutput, String> {
    let mut value: Value = serde_json::from_slice(bytes).map_err(|_| "bad json".to_string())?;
    for _ in 0..4 {
        match value {
            Value::String(s) => {
                value = serde_json::from_str(&s).map_err(|_| "bad json string".to_string())?
            }
            Value::Object(ref mut map)
                if map.contains_key("success") && !map.contains_key("ok") =>
            {
                if map.get("success").and_then(Value::as_bool) != Some(true) {
                    let error = map
                        .get("error")
                        .and_then(Value::as_str)
                        .unwrap_or("worker failed");
                    return Err(format!("outlayer: {}", truncate(error, 80)));
                }
                value = map.remove("output").unwrap_or(Value::Null);
            }
            _ => break,
        }
    }
    from_value(&value)
}

pub fn truncate(value: &str, max: usize) -> String {
    value.chars().take(max).collect()
}

pub fn check_output(out: &VerifyOutput, order: &Order, skew_ns: u64) -> Result<String, String> {
    if !out.ok {
        return Err(format!(
            "not ok: {}",
            truncate(out.reason.as_deref().unwrap_or("-"), 80)
        ));
    }
    if out.order_id.as_deref() != Some(&order.id) {
        return Err("order id mismatch".into());
    }
    if out.proof_sha256.as_deref() != order.proof_sha256.as_deref() {
        return Err("proof hash mismatch".into());
    }
    if out.spec_hash.as_deref() != Some(&order.spec_hash) {
        return Err("spec hash mismatch".into());
    }
    if out.completed_at_ns.unwrap_or(0).saturating_add(skew_ns)
        < order.claimed_at.unwrap_or(u64::MAX)
    {
        return Err("completion older than claim".into());
    }
    let nullifier = out.nullifier.as_deref().unwrap_or_default();
    if !is_hex64(nullifier) {
        return Err("bad nullifier".into());
    }
    Ok(nullifier.to_string())
}
