use base64::engine::general_purpose::STANDARD;
use base64::Engine as _;
use email_verifier::{hex_sha256, validate_job, verify, Config, Fetcher, Job, BLOB_MAX_BYTES};
use rand::rngs::OsRng;
use rsa::pkcs1v15::SigningKey;
use rsa::pkcs8::EncodePublicKey;
use rsa::signature::{SignatureEncoding, Signer};
use rsa::RsaPrivateKey;
use sha2::{Digest, Sha256};
use std::sync::OnceLock;

struct NeverFetch;

impl Fetcher for NeverFetch {
    fn get(&self, _: &str, _: &[(&str, &str)]) -> Result<Vec<u8>, String> {
        panic!("invalid job must fail before fetching proof");
    }
}

fn job() -> Job {
    let spec = format!(
        r#"{{"amount":"10000","bank":"vpbank","country":"VN","currency":"VND","merchant_hash":"{}","v":1}}"#,
        "a".repeat(64)
    );
    Job {
        order_id: "FUL-EMAIL1".into(),
        kind: "bank_transfer".into(),
        spec_hash: hex_sha256(spec.as_bytes()),
        spec,
        proof_sha256: "b".repeat(64),
        claimed_at_ns: 0,
        blob_url: format!(
            "https://fulfil.junstudio.xyz/api/proof-blob/{}",
            "b".repeat(64)
        ),
    }
}

#[test]
fn changed_bank_spec_and_wrong_kind_fail_before_proof_fetch() {
    let mut changed = job();
    changed.spec = changed.spec.replace("10000", "10001");
    assert_eq!(validate_job(&changed), Err("spec_hash_mismatch"));
    let output = verify(&changed, None, false, &Config::default(), &NeverFetch);
    assert_eq!(output.reason.as_deref(), Some("spec_hash_mismatch"));

    let mut wrong_kind = job();
    wrong_kind.kind = "cryptorefills_topup".into();
    assert_eq!(validate_job(&wrong_kind), Err("kind_mismatch"));
}

#[test]
fn invalid_amount_or_merchant_hash_is_rejected() {
    let mut invalid = job();
    invalid.spec = invalid.spec.replace("10000", "1.00");
    invalid.spec_hash = hex_sha256(invalid.spec.as_bytes());
    assert_eq!(validate_job(&invalid), Err("spec_invalid"));

    invalid = job();
    invalid.spec = invalid.spec.replace(&"a".repeat(64), "not-a-hash");
    invalid.spec_hash = hex_sha256(invalid.spec.as_bytes());
    assert_eq!(validate_job(&invalid), Err("spec_invalid"));
}

#[test]
fn proof_size_and_off_host_url_fail_closed() {
    let valid = job();
    let too_large = vec![b'x'; BLOB_MAX_BYTES + 1];
    let output = verify(
        &valid,
        Some(&too_large),
        false,
        &Config::default(),
        &NeverFetch,
    );
    assert_eq!(output.reason.as_deref(), Some("blob_fetch_fail"));

    let mut off_host = job();
    off_host.blob_url = format!("https://attacker.test/{}", off_host.proof_sha256);
    let output = verify(&off_host, None, false, &Config::default(), &NeverFetch);
    assert_eq!(output.reason.as_deref(), Some("blob_url_not_allowed"));
}

fn signing_key() -> &'static RsaPrivateKey {
    static KEY: OnceLock<RsaPrivateKey> = OnceLock::new();
    KEY.get_or_init(|| RsaPrivateKey::new(&mut OsRng, 1024).unwrap())
}

fn signed_bank_email(note: &str) -> Vec<u8> {
    let body = format!(
        "<html><table>\r\n<tr><td>Ngày, giờ giao dịch<br>Transaction date/time</td><td>31/10/2026 12:34:56</td></tr>\r\n<tr><td>Mã giao dịch<br>Transaction code</td><td>FT26311000000099</td></tr>\r\n<tr><td>Tài khoản ghi nợ<br>Debit Account</td><td>999988887777</td></tr>\r\n<tr><td>Số tiền ghi nợ<br>Debit Amount</td><td>999,999 VND</td></tr>\r\n<tr><td>Tài khoản ghi có<br>Credit Account</td><td>0000123456789</td></tr>\r\n<tr><td>Số tiền ghi có<br>Credit Amount</td><td>10,000 VND</td></tr>\r\n<tr><td>Tên người hưởng<br>Beneficiary Name</td><td>SYNTHETIC TEST</td></tr>\r\n<tr><td>Nội dung chuyển tiền<br>Details of Payment</td><td>{note}</td></tr>\r\n</table></html>\r\n"
    );
    let headers = "Date: Sat, 31 Oct 2026 12:34:56 +0700\r\nFrom: notice@vpb.com.vn\r\nContent-Type: text/html; charset=utf-8\r\n";
    let body_hash = STANDARD.encode(Sha256::digest(body.as_bytes()));
    let unsigned = format!(
        "v=1; a=rsa-sha256; d=vpb.com.vn; s=redteam; c=simple/simple; h=date:from:content-type:from; bh={body_hash}; b="
    );
    let mut signed = headers.as_bytes().to_vec();
    signed.extend_from_slice(format!("DKIM-Signature: {unsigned}").as_bytes());
    let signature = SigningKey::<Sha256>::new(signing_key().clone()).sign(&signed);
    format!(
        "{headers}DKIM-Signature: {unsigned}{}\r\n\r\n{body}",
        STANDARD.encode(signature.to_bytes())
    )
    .into_bytes()
}

fn signed_email_result_for_order(note: &str, order_id: &str) -> email_verifier::Output {
    let eml = signed_bank_email(note);
    let mut config = Config::default();
    config.offline = true;
    config.pinned_keys.insert(
        ("vpb.com.vn".into(), "redteam".into()),
        STANDARD.encode(
            signing_key()
                .to_public_key()
                .to_public_key_der()
                .unwrap()
                .as_bytes(),
        ),
    );
    let mut job = job();
    job.order_id = order_id.into();
    job.spec = job.spec.replace(
        &"a".repeat(64),
        &email_verifier::merchant_hash("0000123456789"),
    );
    job.spec_hash = hex_sha256(job.spec.as_bytes());
    job.proof_sha256 = hex_sha256(&eml);
    verify(&job, Some(&eml), false, &config, &NeverFetch)
}

fn signed_email_result(note: &str) -> email_verifier::Output {
    signed_email_result_for_order(note, "FUL-0001")
}

#[test]
fn signed_email_fixture_verifies_exact_order_note() {
    let output = signed_email_result("FUL-0001");
    assert!(output.ok, "{:?}", output.reason);
}

#[test]
fn vuln_email_note_requires_order_id_boundary() {
    let output = signed_email_result("FUL-00010");
    assert!(!output.ok, "prefix collision must not pay another order");
}

#[test]
fn signed_note_accepts_delimited_order_id_variants() {
    for note in [
        "FUL-0001.",
        "(FUL-0001)",
        "FUL-0001,",
        "FUL-0001",
        "Payment:FUL-0001.",
        "FUL-0001. Completed",
        "(FUL- 0001)",
        "FUL 0001",
        "FUL0001",
    ] {
        let result = signed_email_result(note);
        assert!(result.ok, "{note}: {:?}", result.reason);
    }
}

#[test]
fn signed_note_rejects_order_id_extensions_and_embedded_ids() {
    for note in [
        "FUL-00010",
        "XFUL-0001",
        "9FUL-0001",
        "FUL-0001X",
        "FUL-00012",
        "FUL-0001 0",
        "FUL-0001-2",
        "FUL-0001 -2",
        "FUL-0001_suffix",
        "prefix_FUL-0001",
    ] {
        let result = signed_email_result(note);
        assert_eq!(
            result.reason.as_deref(),
            Some("note_missing_order_id"),
            "{note}"
        );
    }
    let reverse = signed_email_result_for_order("FUL-0001", "FUL-00010");
    assert_eq!(reverse.reason.as_deref(), Some("note_missing_order_id"));
}
