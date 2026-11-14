mod dkim;
mod parser;

use serde::{Deserialize, Deserializer, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;

pub use dkim::BankProfile;

pub const USER_AGENT: &str = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
pub const ALLOWED_BLOB_PREFIXES: &[&str] = &["https://fulfil.junstudio.xyz/api/proof-blob/"];
/// Maximum age gap accepted between the bank email and the on-chain claim (10 minutes).
pub const MAX_EMAIL_SKEW_NS: u64 = 600_000_000_000;
pub const BLOB_MAX_BYTES: usize = 1024 * 1024;
pub const DOH_MAX_BYTES: usize = 64 * 1024;

fn u64_or_string<'de, D: Deserializer<'de>>(deserializer: D) -> Result<u64, D::Error> {
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum Value {
        Number(u64),
        Text(String),
    }
    match Value::deserialize(deserializer)? {
        Value::Number(value) => Ok(value),
        Value::Text(value) => value.parse().map_err(serde::de::Error::custom),
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

#[derive(Debug, Serialize)]
pub struct Output {
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
    pub order_id: String,
    pub proof_sha256: String,
    pub spec_hash: String,
    pub nullifier: String,
    pub completed_at_ns: String,
}

impl Output {
    pub fn failure(job: &Job, reason: &str) -> Self {
        Self {
            ok: false,
            reason: Some(reason.to_string()),
            order_id: job.order_id.clone(),
            proof_sha256: job.proof_sha256.clone(),
            spec_hash: job.spec_hash.clone(),
            nullifier: String::new(),
            completed_at_ns: "0".into(),
        }
    }
}

#[derive(Deserialize)]
struct BankSpec {
    amount: String,
    bank: String,
    country: String,
    currency: String,
    merchant_hash: String,
    v: u32,
}

fn valid_spec(job: &Job) -> Result<BankSpec, &'static str> {
    if job.kind != "bank_transfer" {
        return Err("kind_mismatch");
    }
    if hex_sha256(job.spec.as_bytes()) != job.spec_hash {
        return Err("spec_hash_mismatch");
    }
    let spec: BankSpec = serde_json::from_str(&job.spec).map_err(|_| "spec_invalid")?;
    if spec.v != 1
        || spec.bank != "vpbank"
        || spec.country != "VN"
        || spec.currency != "VND"
        || spec.amount.parse::<u128>().is_err()
        || spec.merchant_hash.len() != 64
        || !spec
            .merchant_hash
            .bytes()
            .all(|byte| byte.is_ascii_hexdigit())
    {
        return Err("spec_invalid");
    }
    Ok(spec)
}

/// Validates the generic job prefix before a CLI-specific proof-file failure.
pub fn validate_job(job: &Job) -> Result<(), &'static str> {
    valid_spec(job).map(|_| ())
}

pub trait Fetcher {
    fn get(&self, url: &str, headers: &[(&str, &str)]) -> Result<Vec<u8>, String>;
}

pub struct Config {
    pub banks: Vec<BankProfile>,
    pub pinned_keys: HashMap<(String, String), String>,
    pub offline: bool,
    pub blob_prefixes: Vec<String>,
    pub blob_token: Option<String>,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            banks: vec![BankProfile {
                id: "vpbank",
                dkim_domains: vec!["vpb.com.vn"],
            }],
            // Pinned DKIM keys, used when DNS-over-HTTPS fails or after a bank rotates its key.
            // vpb.com.vn / rFp7LeTnK4: fetched from DNS on 2026-11-07 (RSA 1024).
            pinned_keys: HashMap::from([(
                ("vpb.com.vn".to_string(), "rfp7letnk4".to_string()),
                "MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCpO0gRxUFzB6DV+E38TDAGJQH2k23mZBMHN6+sVDoAkFFW1443uUIe/asyncm1aDpRdwGwUFo4nR8VOfKMtCLZoe6tKzjms/XQKo2glZ/HPqx6Gw2ZRQ1E/Vejn8e7PXNXKCLDhzvq8aeHeNsWHZUzEDTDyaTZWe6lSRykkdysEwIDAQAB".to_string(),
            )]),
            offline: false,
            blob_prefixes: std::env::var("PROOF_BLOB_PREFIX")
                .ok()
                .filter(|prefix| !prefix.is_empty())
                .map(|prefix| vec![prefix])
                .unwrap_or_else(|| ALLOWED_BLOB_PREFIXES.iter().map(|p| (*p).into()).collect()),
            blob_token: std::env::var("PROOF_BLOB_TOKEN")
                .ok()
                .filter(|token| !token.is_empty()),
        }
    }
}

pub fn normalize_account(account: &str) -> String {
    account
        .trim()
        .to_uppercase()
        .chars()
        .filter(|character| !character.is_whitespace() && *character != '.' && *character != '-')
        .collect()
}

pub fn hex_sha256(value: &[u8]) -> String {
    Sha256::digest(value)
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

pub fn merchant_hash(account: &str) -> String {
    hex_sha256(normalize_account(account).as_bytes())
}

fn blob_url_allowed(job: &Job, prefixes: &[String]) -> bool {
    if job.proof_sha256.len() != 64
        || !job
            .proof_sha256
            .bytes()
            .all(|byte| byte.is_ascii_hexdigit())
    {
        return false;
    }
    let suffix = job.proof_sha256.to_ascii_lowercase();
    prefixes.iter().any(|prefix| {
        prefix.starts_with("https://")
            && prefix.ends_with('/')
            && job.blob_url == format!("{prefix}{suffix}")
    })
}

pub fn verify(
    job: &Job,
    eml_override: Option<&[u8]>,
    skip_sha: bool,
    config: &Config,
    fetcher: &impl Fetcher,
) -> Output {
    let spec = match valid_spec(job) {
        Ok(spec) => spec,
        Err(reason) => return Output::failure(job, reason),
    };
    let eml = match eml_override {
        Some(value) => value.to_vec(),
        None => {
            if !blob_url_allowed(job, &config.blob_prefixes) {
                return Output::failure(job, "blob_url_not_allowed");
            }
            let token = match config.blob_token.as_deref() {
                Some(token) => token,
                None => return Output::failure(job, "blob_token_missing"),
            };
            let authorization = format!("Bearer {token}");
            match fetcher.get(&job.blob_url, &[("Authorization", &authorization)]) {
                Ok(bytes) => bytes,
                Err(_) => return Output::failure(job, "blob_fetch_fail"),
            }
        }
    };
    if eml.len() > BLOB_MAX_BYTES {
        return Output::failure(job, "blob_fetch_fail");
    }
    if !skip_sha && !hex_sha256(&eml).eq_ignore_ascii_case(&job.proof_sha256) {
        return Output::failure(job, "sha256_mismatch");
    }
    let normalized = dkim::normalize_newlines(&eml);
    let (headers, body) = match dkim::split_email(&normalized) {
        Ok(parts) => parts,
        Err(_) => return Output::failure(job, "dkim_fail"),
    };
    if let Some(reason) = parser::duplicate_sensitive_header(&headers, true) {
        return Output::failure(job, reason);
    }
    let domain = match dkim::verify(&headers, body, config, fetcher) {
        Ok(domain) => domain,
        Err(reason) => return Output::failure(job, reason),
    };
    let bank = config.banks.iter().find(|bank| {
        bank.dkim_domains
            .iter()
            .any(|candidate| candidate.eq_ignore_ascii_case(&domain))
    });
    let parsed = match bank
        .ok_or("bank")
        .and_then(|bank| bank.parse(&headers, body))
    {
        Ok(parsed) => parsed,
        Err(reason)
            if reason.starts_with("duplicate_header:")
                || reason.starts_with("parse_ambiguous:")
                || reason == "status_not_success" =>
        {
            return Output::failure(job, reason);
        }
        Err(field) => return Output::failure(job, &format!("parse_fail:{field}")),
    };
    let amount = spec.amount.parse::<u128>().expect("validated spec amount");
    let reason = if u128::from(parsed.amount_vnd) < amount {
        Some("amount_too_low")
    } else if !merchant_hash(&parsed.credit_account).eq_ignore_ascii_case(&spec.merchant_hash) {
        Some("merchant_mismatch")
    } else if !note_contains_order_id(&parsed.note, &job.order_id) {
        Some("note_missing_order_id")
    } else if parsed.timestamp_ns.saturating_add(MAX_EMAIL_SKEW_NS) < job.claimed_at_ns {
        Some("email_too_old")
    } else {
        None
    };
    if let Some(reason) = reason {
        return Output::failure(job, reason);
    }
    Output {
        ok: true,
        reason: None,
        order_id: job.order_id.clone(),
        proof_sha256: job.proof_sha256.clone(),
        spec_hash: job.spec_hash.clone(),
        nullifier: hex_sha256(
            format!(
                "bank_transfer:{}",
                parsed.transaction_code.trim().to_uppercase()
            )
            .as_bytes(),
        ),
        completed_at_ns: parsed.timestamp_ns.to_string(),
    }
}

fn compact(value: &str) -> String {
    value
        .chars()
        .filter(|c| !c.is_whitespace())
        .flat_map(char::to_lowercase)
        .collect()
}

fn note_contains_order_id(note: &str, order_id: &str) -> bool {
    let note = note.to_lowercase();
    let mut order_id_chars = Vec::new();
    for character in compact(order_id).chars() {
        if (character == '-' || character == '_')
            && order_id_chars
                .last()
                .is_some_and(|previous| *previous == '-' || *previous == '_')
        {
            continue;
        }
        order_id_chars.push(character);
    }
    if order_id_chars.is_empty()
        || matches!(order_id_chars.first(), Some('-' | '_'))
        || matches!(order_id_chars.last(), Some('-' | '_'))
    {
        return false;
    }
    note.char_indices().any(|(start, _)| {
        if note[..start]
            .chars()
            .next_back()
            .is_some_and(is_order_id_character)
        {
            return false;
        }
        let mut source = note[start..].char_indices().peekable();
        let mut end = start;
        for (index, expected) in order_id_chars.iter().enumerate() {
            if *expected == '-' || *expected == '_' {
                while source
                    .peek()
                    .is_some_and(|(_, character)| character.is_whitespace())
                {
                    source.next();
                }
                if source
                    .peek()
                    .is_some_and(|(_, character)| *character == '-' || *character == '_')
                {
                    source.next();
                }
                while source
                    .peek()
                    .is_some_and(|(_, character)| character.is_whitespace())
                {
                    source.next();
                }
                continue;
            }
            if index > 0 {
                while source
                    .peek()
                    .is_some_and(|(_, character)| character.is_whitespace())
                {
                    source.next();
                }
            }
            let Some((offset, actual)) = source.next() else {
                return false;
            };
            if actual != *expected {
                return false;
            }
            end = start + offset + actual.len_utf8();
        }
        let suffix = &note[end..];
        if suffix.chars().next().is_some_and(is_order_id_character) {
            return false;
        }
        let continuation = suffix.trim_start_matches(char::is_whitespace);
        !continuation.chars().next().is_some_and(|character| {
            character.is_ascii_digit() || character == '-' || character == '_'
        })
    })
}

fn is_order_id_character(character: char) -> bool {
    character.is_alphanumeric() || character == '-' || character == '_'
}

#[cfg(test)]
mod tests {
    use super::*;
    use base64::engine::general_purpose::STANDARD;
    use base64::Engine;
    use rand::rngs::OsRng;
    use rsa::pkcs1v15::SigningKey;
    use rsa::pkcs8::EncodePublicKey;
    use rsa::signature::{SignatureEncoding, Signer};
    use rsa::RsaPrivateKey;
    use std::cell::RefCell;
    use std::sync::OnceLock;

    struct MockFetcher {
        doh_key: Option<String>,
    }

    impl Fetcher for MockFetcher {
        fn get(&self, url: &str, _: &[(&str, &str)]) -> Result<Vec<u8>, String> {
            if url.contains("/resolve?") || url.contains("/dns-query?") {
                return self
                    .doh_key
                    .as_ref()
                    .map(|key| {
                        format!(
                            r#"{{"Answer":[{{"type":16,"data":"\"v=DKIM1; k=rsa; p={key}\""}}]}}"#
                        )
                        .into_bytes()
                    })
                    .ok_or("DoH unavailable".into());
            }
            Err("blob unavailable".into())
        }
    }

    fn private_key() -> &'static RsaPrivateKey {
        static KEY: OnceLock<RsaPrivateKey> = OnceLock::new();
        KEY.get_or_init(|| RsaPrivateKey::new(&mut OsRng, 1024).unwrap())
    }

    fn public_key() -> String {
        STANDARD.encode(
            private_key()
                .to_public_key()
                .to_public_key_der()
                .unwrap()
                .as_bytes(),
        )
    }

    fn qp(value: &str) -> String {
        value
            .as_bytes()
            .iter()
            .map(|byte| {
                if *byte == b'=' || !byte.is_ascii() {
                    format!("={byte:02X}")
                } else {
                    (*byte as char).to_string()
                }
            })
            .collect()
    }

    fn body(amount: &str, nfd: bool) -> String {
        let labels = if nfd {
            "Mã giao dịch"
        } else {
            "Mã giao dịch"
        };
        let html = format!("<html><table>\r\n<tr><td>Ngày, giờ giao dịch<br>Transaction date/time</td><td>31/10/2026 12:34:56</td></tr>\r\n<tr><td>{labels}<br>Transaction code</td><td>FT26311000000001</td></tr>\r\n<tr><td>Tài khoản ghi nợ<br>Debit Account</td><td>999988887777</td></tr>\r\n<tr><td>Số tiền ghi nợ<br>Debit Amount</td><td>999,999 VND</td></tr>\r\n<tr><td>Tài khoản ghi có<br>Credit Account</td><td>0000123456789</td></tr>\r\n<tr><td>Số tiền ghi có<br>Credit Amount</td><td>{amount}</td></tr>\r\n<tr><td>Tên người hưởng<br>Beneficiary Name</td><td>NGUYEN VAN TEST</td></tr>\r\n<tr><td>Nội dung chuyển tiền<br>Details of Payment</td><td>FUL-ORDER123&nbsp;test &amp; done</td></tr>\r\n</table></html>\r\n");
        qp(&html)
    }

    fn signed_email(mode: &str, amount: &str, domain: &str, l_tag: bool, nfd: bool) -> Vec<u8> {
        let body = body(amount, nfd);
        let header_text = format!("Date: Sat, 31 Oct 2026 12:34:56 +0700\r\nFrom: \"A@other.test\" <notice@{domain}>\r\nSubject: Credit\r\n notice\r\nContent-Type: text/html; charset=utf-8\r\nContent-Transfer-Encoding: quoted-printable\r\n");
        let (headers, _) = dkim::split_email(format!("{header_text}\r\n").as_bytes()).unwrap();
        let (_, body_mode) = mode.split_once('/').unwrap();
        let header_mode = mode.split('/').next().unwrap();
        let bh = STANDARD.encode(Sha256::digest(dkim::canonical_body(
            body.as_bytes(),
            body_mode,
        )));
        let l = if l_tag { "l=20; " } else { "" };
        let unsigned = format!("v=1; a=rsa-sha256; d={domain}; s=test; c={mode}; h=date:from:subject:content-type:content-transfer-encoding:from; {l}bh={bh}; b=");
        let mut signed = Vec::new();
        let mut used_from = false;
        for name in [
            "date",
            "from",
            "subject",
            "content-type",
            "content-transfer-encoding",
            "from",
        ] {
            if let Some(header) = headers
                .iter()
                .find(|header| header.name.eq_ignore_ascii_case(name))
            {
                if name == "from" {
                    if used_from {
                        continue;
                    }
                    used_from = true;
                }
                signed.extend(dkim::canonical_header(header, header_mode));
            }
        }
        let signature_header = dkim::Header {
            name: "DKIM-Signature".into(),
            value: format!(" {unsigned}"),
            raw: None,
        };
        let mut signature_bytes = dkim::canonical_header(&signature_header, header_mode);
        signature_bytes.truncate(signature_bytes.len() - 2);
        signed.extend(signature_bytes);
        let signature = SigningKey::<Sha256>::new(private_key().clone()).sign(&signed);
        format!(
            "{header_text}DKIM-Signature: {unsigned}{}\r\n\r\n{body}",
            STANDARD.encode(signature.to_bytes())
        )
        .into_bytes()
    }

    fn config() -> Config {
        let mut config = Config {
            offline: true,
            blob_token: None,
            blob_prefixes: ALLOWED_BLOB_PREFIXES
                .iter()
                .map(|prefix| (*prefix).into())
                .collect(),
            ..Config::default()
        };
        config
            .pinned_keys
            .insert(("vpb.com.vn".into(), "test".into()), public_key());
        config
            .pinned_keys
            .insert(("other.test".into(), "test".into()), public_key());
        config
    }

    fn job(eml: &[u8], amount: u64) -> Job {
        let spec = format!(
            r#"{{"amount":"{amount}","bank":"vpbank","country":"VN","currency":"VND","merchant_hash":"{}","v":1}}"#,
            merchant_hash("0000123456789")
        );
        Job {
            order_id: "FUL-ORDER123".into(),
            kind: "bank_transfer".into(),
            spec_hash: hex_sha256(spec.as_bytes()),
            spec,
            proof_sha256: hex_sha256(eml),
            claimed_at_ns: 0,
            blob_url: "https://example.test/proof".into(),
        }
    }

    fn check(eml: &[u8], amount: u64, config: &Config, fetcher: &impl Fetcher) -> Output {
        verify(&job(eml, amount), Some(eml), false, config, fetcher)
    }

    #[test]
    fn note_accepts_optional_order_id_separator() {
        for note in [
            "FUL-2A6D0AEE",
            "FUL 2A6D0AEE",
            "FUL2A6D0AEE",
            "ful_2a6d0aee",
            "FUL - 2A6D0AEE",
            "NGUYEN VAN A chuyen tien FUL 2A6D0AEE qua Napas",
            "(FUL 2A6D0AEE).",
        ] {
            assert!(note_contains_order_id(note, "FUL-2A6D0AEE"), "{note}");
        }
        assert!(note_contains_order_id("FUL 2A6D0AEE", "FUL-_2A6D0AEE"));
    }

    #[test]
    fn note_rejects_order_id_collisions_and_invalid_ids() {
        for note in [
            "XFUL 2A6D0AEE",
            "9FUL 2A6D0AEE",
            "prefix_FUL-2A6D0AEE",
            "FUL 2A6D0AEE1",
            "FUL 2A6D0AE",
            "FUL 2A6D0AEE-5",
            "FUL 2A6D0AEE_suffix",
            "FUL-2A6D0AEF",
            "FUL-_2A6D0AEE",
        ] {
            assert!(!note_contains_order_id(note, "FUL-2A6D0AEE"), "{note}");
        }
        assert!(!note_contains_order_id("FUL-0001 0", "FUL-0001"));
        assert!(!note_contains_order_id("FUL-0001 -2", "FUL-0001"));
        assert!(!note_contains_order_id("FUL-0001", "FUL-00010"));
        for order_id in ["", "-_", "-FUL", "FUL-"] {
            assert!(!note_contains_order_id("FUL", order_id), "{order_id}");
        }
    }

    #[test]
    fn shared_hash_vectors() {
        assert_eq!(normalize_account(" 0000 1234.567-89 "), "0000123456789");
        assert_eq!(
            merchant_hash(" 0000 1234.567-89 "),
            "50ebbc094dfa0bcccdd67d4c216eeab9fed26448b1c698c9ecfba7a7bda1d345"
        );
        assert_eq!(normalize_account(" a b.c-123 "), "ABC123");
        assert_eq!(
            merchant_hash(" a b.c-123 "),
            "e0bebd22819993425814866b62701e2919ea26f1370499c1037b53b9d49c2c8a"
        );
        assert_eq!(normalize_account(" A\u{0085}B "), "AB");
        assert_eq!(
            merchant_hash(" A\u{0085}B "),
            "38164fbd17603d73f696b8b4d72664d735bb6a7c88577687fd2ae33fd6964153"
        );
    }

    #[test]
    fn signed_vpbank_emails_verify_and_hide_pii() {
        for mode in ["relaxed/simple", "relaxed/relaxed", "simple/simple"] {
            let eml = signed_email(mode, "10,000 VND", "vpb.com.vn", false, false);
            let result = check(&eml, 10000, &config(), &MockFetcher { doh_key: None });
            assert!(result.ok, "{mode}: {result:?}");
            assert_eq!(result.completed_at_ns, "1793424896000000000");
            assert_eq!(
                result.nullifier,
                hex_sha256(b"bank_transfer:FT26311000000001")
            );
            let json = serde_json::to_string(&result).unwrap();
            assert!(!json.contains("NGUYEN VAN TEST"));
            assert!(!json.contains("0000123456789"));
        }
    }

    #[test]
    fn signature_failures_and_order_checks() {
        let eml = signed_email("relaxed/simple", "10.000 VND", "vpb.com.vn", false, false);
        assert_eq!(
            check(&eml, 10001, &config(), &MockFetcher { doh_key: None })
                .reason
                .as_deref(),
            Some("amount_too_low")
        );
        let tampered = String::from_utf8(eml.clone())
            .unwrap()
            .replace("10.000 VND", "20.000 VND")
            .into_bytes();
        assert_eq!(
            check(&tampered, 10000, &config(), &MockFetcher { doh_key: None })
                .reason
                .as_deref(),
            Some("dkim_fail")
        );
        let l = signed_email("relaxed/simple", "10,000 VND", "vpb.com.vn", true, false);
        assert_eq!(
            check(&l, 10000, &config(), &MockFetcher { doh_key: None })
                .reason
                .as_deref(),
            Some("l_tag_rejected")
        );
        let disallowed = signed_email("relaxed/simple", "10,000 VND", "other.test", false, false);
        assert_eq!(
            check(
                &disallowed,
                10000,
                &config(),
                &MockFetcher { doh_key: None }
            )
            .reason
            .as_deref(),
            Some("domain_not_allowed")
        );
        let mut wrong_sha = job(&eml, 10000);
        wrong_sha.proof_sha256 = "0".repeat(64);
        assert_eq!(
            verify(
                &wrong_sha,
                Some(&eml),
                false,
                &config(),
                &MockFetcher { doh_key: None }
            )
            .reason
            .as_deref(),
            Some("sha256_mismatch")
        );
    }

    #[test]
    fn nfd_lf_and_doh_paths() {
        let eml = signed_email("relaxed/relaxed", "10.000 VND", "vpb.com.vn", false, true);
        let lf = String::from_utf8(eml.clone())
            .unwrap()
            .replace("\r\n", "\n")
            .into_bytes();
        assert!(check(&lf, 10000, &config(), &MockFetcher { doh_key: None }).ok);
        let mut doh_config = config();
        doh_config.offline = false;
        doh_config.pinned_keys.clear();
        assert!(
            check(
                &eml,
                10000,
                &doh_config,
                &MockFetcher {
                    doh_key: Some(public_key())
                }
            )
            .ok
        );
        doh_config
            .pinned_keys
            .insert(("vpb.com.vn".into(), "test".into()), public_key());
        assert!(check(&eml, 10000, &doh_config, &MockFetcher { doh_key: None }).ok);
        let wrong_key = RsaPrivateKey::new(&mut OsRng, 1024).unwrap();
        let wrong_public = STANDARD.encode(
            wrong_key
                .to_public_key()
                .to_public_key_der()
                .unwrap()
                .as_bytes(),
        );
        assert!(
            check(
                &eml,
                10000,
                &doh_config,
                &MockFetcher {
                    doh_key: Some(wrong_public)
                }
            )
            .ok
        );
    }

    #[test]
    fn second_signature_can_succeed() {
        let eml = String::from_utf8(signed_email(
            "relaxed/simple",
            "10,000 VND",
            "vpb.com.vn",
            false,
            false,
        ))
        .unwrap();
        let dual = eml.replacen("DKIM-Signature:", "DKIM-Signature: v=1; d=vpb.com.vn; s=test; a=rsa-sha256; h=from; bh=bad; b=bad\r\nDKIM-Signature:", 1);
        assert!(
            check(
                dual.as_bytes(),
                10000,
                &config(),
                &MockFetcher { doh_key: None }
            )
            .ok
        );
        let l_and_valid = dual.replacen("h=from; bh=bad", "h=from; l=0; bh=bad", 1);
        assert!(
            check(
                l_and_valid.as_bytes(),
                10000,
                &config(),
                &MockFetcher { doh_key: None }
            )
            .ok
        );
    }

    #[test]
    fn folded_signature_and_post_parse_checks() {
        let eml = String::from_utf8(signed_email(
            "relaxed/simple",
            "10,000 VND",
            "vpb.com.vn",
            false,
            false,
        ))
        .unwrap();
        let prefix = eml.find("; b=").unwrap() + 4;
        let folded = format!("{}\r\n {}", &eml[..prefix], &eml[prefix..]);
        assert!(
            check(
                folded.as_bytes(),
                10000,
                &config(),
                &MockFetcher { doh_key: None }
            )
            .ok
        );
        let mut wrong_merchant = job(folded.as_bytes(), 10000);
        wrong_merchant.spec = wrong_merchant
            .spec
            .replace(&merchant_hash("0000123456789"), &"0".repeat(64));
        wrong_merchant.spec_hash = hex_sha256(wrong_merchant.spec.as_bytes());
        let result = verify(
            &wrong_merchant,
            Some(folded.as_bytes()),
            false,
            &config(),
            &MockFetcher { doh_key: None },
        );
        assert_eq!(result.reason.as_deref(), Some("merchant_mismatch"));
        assert_eq!(result.nullifier, "");
        let mut wrong_note = job(folded.as_bytes(), 10000);
        wrong_note.order_id = "FUL-MISSING".into();
        assert_eq!(
            verify(
                &wrong_note,
                Some(folded.as_bytes()),
                false,
                &config(),
                &MockFetcher { doh_key: None }
            )
            .reason
            .as_deref(),
            Some("note_missing_order_id")
        );
    }

    #[test]
    fn blob_failure_and_numeric_string_input() {
        let mut job = job(b"synthetic", 10000);
        job.proof_sha256 = "00".into();
        job.claimed_at_ns = 1;
        let output = verify(&job, None, false, &config(), &MockFetcher { doh_key: None });
        assert_eq!(output.reason.as_deref(), Some("blob_url_not_allowed"));
        assert_eq!(output.nullifier, "");
        assert_eq!(output.order_id, job.order_id);
        assert_eq!(output.proof_sha256, job.proof_sha256);
    }

    struct BlobFetcher {
        eml: Vec<u8>,
        calls: RefCell<Vec<(String, String)>>,
    }

    impl Fetcher for BlobFetcher {
        fn get(&self, url: &str, headers: &[(&str, &str)]) -> Result<Vec<u8>, String> {
            let authorization = headers
                .iter()
                .find(|(name, _)| *name == "Authorization")
                .map(|(_, value)| (*value).to_string())
                .unwrap_or_default();
            self.calls
                .borrow_mut()
                .push((url.to_string(), authorization));
            Ok(self.eml.clone())
        }
    }

    #[test]
    fn oversized_blob_fails_closed_and_at_limit_is_accepted() {
        let mut eml = signed_email("relaxed/simple", "10,000 VND", "vpb.com.vn", false, false);
        eml.resize(BLOB_MAX_BYTES, b'\n');
        let mut config = config();
        config.blob_token = Some("synthetic-test-token".into());
        let mut valid_job = job(&eml, 10000);
        valid_job.blob_url = format!("{}{}", ALLOWED_BLOB_PREFIXES[0], valid_job.proof_sha256);
        let fetcher = BlobFetcher {
            eml: eml.clone(),
            calls: RefCell::new(Vec::new()),
        };
        assert!(verify(&valid_job, None, false, &config, &fetcher).ok);

        let mut oversized = eml;
        oversized.push(b'\n');
        let mut oversized_job = job(&oversized, 10000);
        oversized_job.blob_url =
            format!("{}{}", ALLOWED_BLOB_PREFIXES[0], oversized_job.proof_sha256);
        let oversized_fetcher = BlobFetcher {
            eml: oversized.clone(),
            calls: RefCell::new(Vec::new()),
        };
        assert_eq!(
            verify(&oversized_job, None, false, &config, &oversized_fetcher)
                .reason
                .as_deref(),
            Some("blob_fetch_fail")
        );
        assert_eq!(
            verify(
                &oversized_job,
                Some(&oversized),
                false,
                &config,
                &oversized_fetcher
            )
            .reason
            .as_deref(),
            Some("blob_fetch_fail")
        );
    }

    #[test]
    fn oversized_doh_response_is_rejected_and_at_limit_is_accepted() {
        struct DnsFetcher {
            response: Vec<u8>,
        }

        impl Fetcher for DnsFetcher {
            fn get(&self, _: &str, _: &[(&str, &str)]) -> Result<Vec<u8>, String> {
                Ok(self.response.clone())
            }
        }

        let eml = signed_email("relaxed/simple", "10,000 VND", "vpb.com.vn", false, false);
        let mut config = config();
        config.offline = false;
        config.pinned_keys.clear();
        let mut response = format!(
            r#"{{"Answer":[{{"type":16,"data":"v=DKIM1; k=rsa; p={}"}}]}}"#,
            public_key()
        )
        .into_bytes();
        response.resize(DOH_MAX_BYTES, b' ');
        assert!(
            check(
                &eml,
                10000,
                &config,
                &DnsFetcher {
                    response: response.clone()
                }
            )
            .ok
        );

        response.push(b' ');
        assert_eq!(
            check(&eml, 10000, &config, &DnsFetcher { response })
                .reason
                .as_deref(),
            Some("dkim_fail")
        );
    }

    #[test]
    fn blob_url_pinning_prevents_token_leaks() {
        let eml = signed_email("relaxed/simple", "10,000 VND", "vpb.com.vn", false, false);
        let fetcher = BlobFetcher {
            eml: eml.clone(),
            calls: RefCell::new(Vec::new()),
        };
        let mut config = config();
        config.blob_token = Some("synthetic-test-token".into());
        let mut job = job(&eml, 10000);
        let valid = format!("{}{}", ALLOWED_BLOB_PREFIXES[0], job.proof_sha256);
        job.blob_url = valid.clone();
        assert!(verify(&job, None, false, &config, &fetcher).ok);
        assert_eq!(
            fetcher.calls.borrow().as_slice(),
            &[(valid.clone(), "Bearer synthetic-test-token".into())]
        );
        fetcher.calls.borrow_mut().clear();

        for url in [
            format!("https://evil.test/api/proof-blob/{}", job.proof_sha256),
            format!(
                "http://fulfil.junstudio.xyz/api/proof-blob/{}",
                job.proof_sha256
            ),
            format!(
                "https://fulfil.junstudio.xyz.evil.com/api/proof-blob/{}",
                job.proof_sha256
            ),
            "https://fulfil.junstudio.xyz/api/proof-blob/../x".into(),
            format!("{}{}", ALLOWED_BLOB_PREFIXES[0], "0".repeat(64)),
            format!("{valid}?download=1"),
        ] {
            job.blob_url = url;
            let output = verify(&job, None, false, &config, &fetcher);
            assert_eq!(output.reason.as_deref(), Some("blob_url_not_allowed"));
            assert!(fetcher.calls.borrow().is_empty());
        }

        config.blob_prefixes = vec!["http://unsafe.test/".into()];
        job.blob_url = format!("http://unsafe.test/{}", job.proof_sha256);
        assert_eq!(
            verify(&job, None, false, &config, &fetcher)
                .reason
                .as_deref(),
            Some("blob_url_not_allowed")
        );
        assert!(fetcher.calls.borrow().is_empty());

        config.blob_prefixes = vec!["https://override.test/proof/".into()];
        job.proof_sha256 = job.proof_sha256.to_ascii_uppercase();
        job.blob_url = format!(
            "https://override.test/proof/{}",
            job.proof_sha256.to_ascii_lowercase()
        );
        assert!(verify(&job, None, false, &config, &fetcher).ok);
    }

    #[test]
    fn output_echoes_job_on_success_and_failure_in_field_order() {
        let eml = signed_email("relaxed/simple", "10,000 VND", "vpb.com.vn", false, false);
        let job = job(&eml, 10000);
        for result in [
            verify(
                &job,
                Some(&eml),
                false,
                &config(),
                &MockFetcher { doh_key: None },
            ),
            Output::failure(&job, "blob_fetch_fail"),
        ] {
            let json = serde_json::to_string(&result).unwrap();
            assert_eq!(result.order_id, job.order_id);
            assert_eq!(result.proof_sha256, job.proof_sha256);
            assert!(json.find("\"order_id\"").unwrap() < json.find("\"proof_sha256\"").unwrap());
            assert!(json.find("\"proof_sha256\"").unwrap() < json.find("\"spec_hash\"").unwrap());
            assert!(json.find("\"spec_hash\"").unwrap() < json.find("\"nullifier\"").unwrap());
        }
    }

    #[test]
    fn generic_input_checks_and_exact_result() {
        let eml = signed_email("relaxed/simple", "10,000 VND", "vpb.com.vn", false, false);
        let mut job = job(&eml, 10000);
        let fetcher = MockFetcher { doh_key: None };
        let result = verify(&job, Some(&eml), false, &config(), &fetcher);
        assert_eq!(
            result.nullifier,
            hex_sha256(b"bank_transfer:FT26311000000001")
        );
        assert_eq!(result.completed_at_ns, "1793424896000000000");
        let json = serde_json::to_string(&result).unwrap();
        assert_eq!(
            json,
            format!(
                r#"{{"ok":true,"order_id":"FUL-ORDER123","proof_sha256":"{}","spec_hash":"{}","nullifier":"{}","completed_at_ns":"1793424896000000000"}}"#,
                job.proof_sha256, job.spec_hash, result.nullifier
            )
        );
        job.kind = "wrong".into();
        assert_eq!(
            verify(&job, Some(&eml), false, &config(), &fetcher)
                .reason
                .as_deref(),
            Some("kind_mismatch")
        );
        job.kind = "bank_transfer".into();
        job.spec_hash = "0".repeat(64);
        assert_eq!(
            verify(&job, Some(&eml), false, &config(), &fetcher)
                .reason
                .as_deref(),
            Some("spec_hash_mismatch")
        );
        job.spec_hash = hex_sha256(job.spec.as_bytes());
        job.claimed_at_ns = 1793424896000000000 + MAX_EMAIL_SKEW_NS + 1;
        assert_eq!(
            verify(&job, Some(&eml), false, &config(), &fetcher)
                .reason
                .as_deref(),
            Some("email_too_old")
        );
    }

    #[test]
    fn u128_spec_amount_is_not_rejected_as_invalid() {
        let eml = signed_email("relaxed/simple", "10,000 VND", "vpb.com.vn", false, false);
        let mut job = job(&eml, 10000);
        job.spec = job
            .spec
            .replacen("\"10000\"", "\"18446744073709551616\"", 1);
        job.spec_hash = hex_sha256(job.spec.as_bytes());
        let result = verify(
            &job,
            Some(&eml),
            false,
            &config(),
            &MockFetcher { doh_key: None },
        );
        assert_eq!(result.reason.as_deref(), Some("amount_too_low"));
    }

    #[test]
    fn merchant_hash_comparison_accepts_uppercase_hex() {
        let eml = signed_email("relaxed/simple", "10,000 VND", "vpb.com.vn", false, false);
        let mut job = job(&eml, 10000);
        job.spec = job.spec.replace(
            &merchant_hash("0000123456789"),
            &merchant_hash("0000123456789").to_ascii_uppercase(),
        );
        job.spec_hash = hex_sha256(job.spec.as_bytes());
        assert!(
            verify(
                &job,
                Some(&eml),
                false,
                &config(),
                &MockFetcher { doh_key: None },
            )
            .ok
        );
    }

    fn unsigned_mime_email() -> Vec<u8> {
        let body = body("10,000 VND", false);
        let header_text = "Date: Sat, 31 Oct 2026 12:34:56 +0700\r\nFrom: notice@vpb.com.vn\r\nTo: customer@example.test\r\nSubject: Credit\r\nContent-Type: text/html; charset=utf-8\r\nContent-Transfer-Encoding: quoted-printable\r\n";
        let (headers, _) = dkim::split_email(format!("{header_text}\r\n").as_bytes()).unwrap();
        let bh = STANDARD.encode(Sha256::digest(dkim::canonical_body(
            body.as_bytes(),
            "simple",
        )));
        let unsigned = format!("v=1; a=rsa-sha256; d=vpb.com.vn; s=test; c=relaxed/simple; h=Date:From:To:Subject:From; bh={bh}; b=");
        let mut signed = Vec::new();
        for name in ["date", "from", "to", "subject"] {
            let header = headers
                .iter()
                .find(|header| header.name.eq_ignore_ascii_case(name))
                .unwrap();
            signed.extend(dkim::canonical_header(header, "relaxed"));
        }
        let signature_header = dkim::Header {
            name: "DKIM-Signature".into(),
            value: format!(" {unsigned}"),
            raw: None,
        };
        let mut signature_bytes = dkim::canonical_header(&signature_header, "relaxed");
        signature_bytes.truncate(signature_bytes.len() - 2);
        signed.extend(signature_bytes);
        let signature = SigningKey::<Sha256>::new(private_key().clone()).sign(&signed);
        format!(
            "{header_text}DKIM-Signature: {unsigned}{}\r\n\r\n{body}",
            STANDARD.encode(signature.to_bytes())
        )
        .into_bytes()
    }

    #[test]
    fn duplicate_top_level_headers_rejected_and_single_unsigned_mime_accepted() {
        let eml = unsigned_mime_email();
        assert!(check(&eml, 10000, &config(), &MockFetcher { doh_key: None }).ok);
        let text = String::from_utf8(eml).unwrap();
        for (needle, extra, reason) in [
            (
                "Content-Type: text/html; charset=utf-8\r\n",
                "Content-Type: text/plain\r\n",
                "duplicate_header:content-type",
            ),
            (
                "Content-Transfer-Encoding: quoted-printable\r\n",
                "Content-Transfer-Encoding: base64\r\n",
                "duplicate_header:content-transfer-encoding",
            ),
            (
                "Date: Sat, 31 Oct 2026 12:34:56 +0700\r\n",
                "Date: Sat, 31 Oct 2026 12:34:56 +0700\r\n",
                "duplicate_header:date",
            ),
        ] {
            let duplicate = text.replacen(needle, &format!("{needle}{extra}"), 1);
            assert_eq!(
                check(
                    duplicate.as_bytes(),
                    10000,
                    &config(),
                    &MockFetcher { doh_key: None }
                )
                .reason
                .as_deref(),
                Some(reason)
            );
        }
    }

    #[test]
    fn simple_header_canonicalization_preserves_non_utf8_bytes() {
        let eml = b"Subject: \xff\r\nFrom: notice@vpb.com.vn\r\n\r\nbody";
        let (headers, _) = dkim::split_email(eml).unwrap();
        assert_eq!(
            dkim::canonical_header(&headers[0], "simple"),
            b"Subject: \xff\r\n"
        );
    }

    #[test]
    fn relaxed_canonicalization_uses_only_ascii_wsp() {
        let eml = b"Subject: \t  A\xc2\xa0B\t C \r\nFrom: notice@vpb.com.vn\r\n\r\n";
        let (headers, _) = dkim::split_email(eml).unwrap();
        assert_eq!(
            dkim::canonical_header(&headers[0], "relaxed"),
            b"subject:A\xc2\xa0B C\r\n"
        );
        let eml = b"Subject:  A\tB \r\nFrom: notice@vpb.com.vn\r\n\r\n";
        let (headers, _) = dkim::split_email(eml).unwrap();
        assert_eq!(
            dkim::canonical_header(&headers[0], "relaxed"),
            b"subject:A B\r\n"
        );
        assert_eq!(
            dkim::canonical_body(b" \talpha\t \r\n\r\n", "relaxed"),
            b" alpha\r\n"
        );
        assert!(dkim::canonical_body(b"\r\n\r\n", "relaxed").is_empty());
    }
}
