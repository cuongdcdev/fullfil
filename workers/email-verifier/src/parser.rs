use crate::dkim::{header, Header};
use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use chrono::{DateTime, FixedOffset, NaiveDateTime, TimeZone};
use unicode_normalization::UnicodeNormalization;

pub struct Parsed {
    pub transaction_code: String,
    pub credit_account: String,
    pub amount_vnd: u64,
    pub note: String,
    pub timestamp_ns: u64,
    pub _beneficiary_name: String,
}

fn parameter(value: &str, name: &str) -> Option<String> {
    value.split(';').skip(1).find_map(|part| {
        let (key, value) = part.trim().split_once('=')?;
        (key.trim().eq_ignore_ascii_case(name)).then(|| value.trim().trim_matches('"').to_string())
    })
}

fn decode_qp(bytes: &[u8]) -> Vec<u8> {
    let mut output = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'=' {
            if bytes.get(index + 1..index + 3) == Some(b"\r\n") {
                index += 3;
                continue;
            }
            if bytes.get(index + 1) == Some(&b'\n') {
                index += 2;
                continue;
            }
            if let Some(pair) = bytes.get(index + 1..index + 3) {
                if let Ok(hex) = std::str::from_utf8(pair) {
                    if let Ok(byte) = u8::from_str_radix(hex, 16) {
                        output.push(byte);
                        index += 3;
                        continue;
                    }
                }
            }
        }
        output.push(bytes[index]);
        index += 1;
    }
    output
}

fn decode_part(headers: &[Header], body: &[u8]) -> Option<String> {
    let transfer = header(headers, "Content-Transfer-Encoding")
        .unwrap_or("")
        .trim();
    let bytes = if transfer.eq_ignore_ascii_case("quoted-printable") {
        decode_qp(body)
    } else if transfer.eq_ignore_ascii_case("base64") {
        STANDARD
            .decode(
                body.iter()
                    .copied()
                    .filter(|b| !b.is_ascii_whitespace())
                    .collect::<Vec<_>>(),
            )
            .ok()?
    } else {
        body.to_vec()
    };
    String::from_utf8(bytes).ok()
}

pub(crate) fn duplicate_sensitive_header(
    headers: &[Header],
    top_level: bool,
) -> Option<&'static str> {
    let names = if top_level {
        &["Content-Type", "Content-Transfer-Encoding", "Date"][..]
    } else {
        &["Content-Type", "Content-Transfer-Encoding"][..]
    };
    for name in names {
        if headers
            .iter()
            .filter(|header| header.name.eq_ignore_ascii_case(name))
            .count()
            > 1
        {
            return Some(match *name {
                "Content-Type" => "duplicate_header:content-type",
                "Content-Transfer-Encoding" => "duplicate_header:content-transfer-encoding",
                _ => "duplicate_header:date",
            });
        }
    }
    None
}

fn all_parts(headers: &[Header], body: &[u8]) -> Result<Vec<(String, bool)>, &'static str> {
    if let Some(reason) = duplicate_sensitive_header(headers, false) {
        return Err(reason);
    }
    let content_type = header(headers, "Content-Type")
        .unwrap_or("text/plain")
        .trim();
    if content_type.to_ascii_lowercase().starts_with("multipart/") {
        let Some(boundary) = parameter(content_type, "boundary") else {
            return Ok(Vec::new());
        };
        let marker = format!("--{boundary}");
        let text = String::from_utf8_lossy(body);
        let mut parts = Vec::new();
        for segment in text.split(&marker).skip(1) {
            if segment.starts_with("--") {
                break;
            }
            let segment = segment.trim_start_matches("\r\n");
            let Ok((part_headers, part_body)) = crate::dkim::split_email(segment.as_bytes()) else {
                continue;
            };
            parts.extend(all_parts(&part_headers, part_body)?);
        }
        return Ok(parts);
    }
    let html = content_type.to_ascii_lowercase().starts_with("text/html");
    if html || content_type.to_ascii_lowercase().starts_with("text/plain") {
        return Ok(decode_part(headers, body)
            .map(|part| vec![(part, html)])
            .unwrap_or_default());
    }
    Ok(Vec::new())
}

fn entity_decode(value: &str) -> String {
    let mut output = String::new();
    let mut remaining = value;
    while let Some(index) = remaining.find('&') {
        output.push_str(&remaining[..index]);
        remaining = &remaining[index..];
        let Some(end) = remaining.find(';') else {
            break;
        };
        let entity = &remaining[1..end];
        let decoded = match entity.to_ascii_lowercase().as_str() {
            "nbsp" => Some('\u{00a0}'),
            "amp" => Some('&'),
            "lt" => Some('<'),
            "gt" => Some('>'),
            "quot" => Some('"'),
            "apos" => Some('\''),
            _ => entity
                .strip_prefix("#x")
                .or_else(|| entity.strip_prefix("#X"))
                .and_then(|hex| u32::from_str_radix(hex, 16).ok())
                .or_else(|| {
                    entity
                        .strip_prefix('#')
                        .and_then(|decimal| decimal.parse().ok())
                })
                .and_then(char::from_u32),
        };
        if let Some(character) = decoded {
            output.push(character);
            remaining = &remaining[end + 1..];
        } else {
            output.push('&');
            remaining = &remaining[1..];
        }
    }
    output.push_str(remaining);
    output
}

fn collapse(value: &str) -> String {
    value.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn strip_html(value: &str) -> String {
    let mut output = String::new();
    let mut in_tag = false;
    for character in value.chars() {
        match character {
            '<' => in_tag = true,
            '>' if in_tag => {
                in_tag = false;
                output.push(' ');
            }
            _ if !in_tag => output.push(character),
            _ => {}
        }
    }
    collapse(&entity_decode(&output))
}

fn cells(html: &str) -> Vec<String> {
    let mut result = Vec::new();
    let lower = html.to_ascii_lowercase();
    let mut cursor = 0;
    while let Some(relative) = lower[cursor..].find("<td") {
        let start = cursor + relative;
        if !matches!(
            lower.as_bytes().get(start + 3),
            Some(b'>') | Some(b' ') | Some(b'\t') | Some(b'\r') | Some(b'\n')
        ) {
            cursor = start + 3;
            continue;
        }
        let Some(open) = lower[start..].find('>') else {
            break;
        };
        let content_start = start + open + 1;
        let Some(close) = lower[content_start..].find("</td>") else {
            break;
        };
        result.push(strip_html(&html[content_start..content_start + close]));
        cursor = content_start + close + 5;
    }
    result
}

fn fold(value: &str) -> String {
    let replaced = value.replace(['Đ', 'đ'], "d");
    collapse(
        &replaced
            .nfd()
            .filter(|c| !unicode_normalization::char::is_combining_mark(*c))
            .collect::<String>()
            .to_ascii_lowercase(),
    )
}

fn label_matches(value: &str, english: &str, vietnamese: &str) -> bool {
    let folded = fold(value.trim().trim_end_matches(':').trim());
    folded == english
        || folded == vietnamese
        || folded == format!("{vietnamese} {english}")
        || folded == format!("{english} {vietnamese}")
}

fn is_status_label(value: &str) -> bool {
    [
        ("status", "trang thai"),
        ("transaction status", "trang thai giao dich"),
    ]
    .iter()
    .any(|(en, vi)| label_matches(value, en, vi))
}

fn is_success(value: &str) -> bool {
    matches!(
        fold(value.trim().trim_end_matches(['.', ':']).trim()).as_str(),
        "thanh cong" | "successful" | "success" | "completed"
    )
}

fn find_field(
    values: &[String],
    english: &str,
    vietnamese: &str,
    field: &'static str,
) -> Result<Option<String>, &'static str> {
    // Every label VPBank prints (Vietnamese with a colon, English repeated in its own row).
    const LABELS: [(&str, &str); 13] = [
        ("transaction code", "ma giao dich"),
        ("transaction date/time", "ngay, gio giao dich"),
        ("transaction date, time", "ngay gio giao dich"),
        ("debit account", "tai khoan trich no"),
        ("debit amount", "so tien trich no"),
        ("charge code", "loai phi"),
        ("fee amount", "so tien phi"),
        ("debit account", "tai khoan ghi no"),
        ("debit amount", "so tien ghi no"),
        ("credit account", "tai khoan ghi co"),
        ("credit amount", "so tien ghi co"),
        ("beneficiary name", "ten nguoi huong"),
        ("details of payment", "noi dung chuyen tien"),
    ];
    let mut found: Option<String> = None;
    let mut index = 0;
    while index < values.len() {
        let label = &values[index];
        let target = if field == "status" {
            is_status_label(label)
        } else {
            label_matches(label, english, vietnamese)
        };
        let known = target
            || is_status_label(label)
            || LABELS.iter().any(|(en, vi)| label_matches(label, en, vi));
        if known {
            // VPBank repeats the English labels in their own row ("Transaction code",
            // "Transaction date, time", ...) and ends with a label-only cell. A label that is
            // followed by another label, or by nothing, carries no value: skip it.
            let is_label = |v: &str| {
                is_status_label(v) || LABELS.iter().any(|(en, vi)| label_matches(v, en, vi))
            };
            let value = match values.get(index + 1) {
                // English label rows are followed by empty spacer cells: no value there either.
                Some(v) if !v.trim().is_empty() && !is_label(v) => v,
                _ => {
                    index += 1;
                    continue;
                }
            };
            if target {
                if field == "status" && !is_success(value) {
                    return Err("status_not_success");
                }
                if found.as_ref().is_some_and(|previous| previous != value) {
                    return Err(match field {
                        "transaction_code" => "parse_ambiguous:transaction_code",
                        "credit_account" => "parse_ambiguous:credit_account",
                        "amount_vnd" => "parse_ambiguous:amount_vnd",
                        "note" => "parse_ambiguous:note",
                        "beneficiary_name" => "parse_ambiguous:beneficiary_name",
                        "email_ts_ns" => "parse_ambiguous:email_ts_ns",
                        _ => "parse_ambiguous:status",
                    });
                }
                found = Some(value.clone());
            }
            index += 2;
        } else {
            index += 1;
        }
    }
    Ok(found)
}

fn plain_values(text: &str) -> Vec<String> {
    let mut values = Vec::new();
    let mut in_note = false;
    for raw_line in text.lines() {
        if raw_line.starts_with(char::is_whitespace) {
            continue;
        }
        let line = collapse(raw_line);
        if line.is_empty() {
            continue;
        }
        if let Some((label, value)) = line.split_once('|').or_else(|| line.split_once(':')) {
            if in_note && !is_status_label(label) {
                continue;
            }
            values.push(label.trim().to_string());
            values.push(value.trim().to_string());
            if label_matches(label, "details of payment", "noi dung chuyen tien") {
                in_note = true;
            }
        }
    }
    values
}

fn field_from_parts(
    values_by_part: &[Vec<String>],
    english: &str,
    vietnamese: &str,
    field: &'static str,
) -> Result<Option<String>, &'static str> {
    let mut found: Option<String> = None;
    for values in values_by_part {
        let value = find_field(values, english, vietnamese, field)?;
        if let Some(value) = value {
            if found.as_ref().is_some_and(|previous| previous != &value) {
                return Err(match field {
                    "transaction_code" => "parse_ambiguous:transaction_code",
                    "credit_account" => "parse_ambiguous:credit_account",
                    "amount_vnd" => "parse_ambiguous:amount_vnd",
                    "note" => "parse_ambiguous:note",
                    "beneficiary_name" => "parse_ambiguous:beneficiary_name",
                    "email_ts_ns" => "parse_ambiguous:email_ts_ns",
                    _ => "parse_ambiguous:status",
                });
            }
            found = Some(value);
        }
    }
    Ok(found)
}

fn parse_amount(value: &str) -> Option<u64> {
    let upper = value.to_ascii_uppercase();
    let number = upper.strip_suffix("VND")?.trim();
    if !number
        .chars()
        .all(|c| c.is_ascii_digit() || c == ',' || c == '.' || c.is_whitespace())
    {
        return None;
    }
    number
        .chars()
        .filter(|c| c.is_ascii_digit())
        .collect::<String>()
        .parse()
        .ok()
}

fn parse_timestamp(value: &str) -> Option<u64> {
    let value = value.trim();
    let value = value
        .strip_suffix("GMT+7")
        .or_else(|| value.strip_suffix("UTC+7"))
        .unwrap_or(value)
        .trim();
    let date = NaiveDateTime::parse_from_str(value, "%d/%m/%Y %H:%M:%S").ok()?;
    let zone = FixedOffset::east_opt(7 * 3600)?;
    let utc = zone
        .from_local_datetime(&date)
        .single()?
        .timestamp_nanos_opt()?;
    u64::try_from(utc).ok()
}

pub fn parse(headers: &[Header], body: &[u8]) -> Result<Parsed, &'static str> {
    let values_by_part = all_parts(headers, body)?
        .into_iter()
        .map(|(text, html)| {
            if html {
                cells(&text)
            } else {
                plain_values(&text)
            }
        })
        .collect::<Vec<_>>();
    if values_by_part.is_empty() {
        return Err("body");
    }
    field_from_parts(&values_by_part, "status", "trang thai", "status")?;
    let transaction_code = field_from_parts(
        &values_by_part,
        "transaction code",
        "ma giao dich",
        "transaction_code",
    )?
    .ok_or("transaction_code")?;
    let credit_account = field_from_parts(
        &values_by_part,
        "credit account",
        "tai khoan ghi co",
        "credit_account",
    )?
    .ok_or("credit_account")?;
    let amount_text = field_from_parts(
        &values_by_part,
        "credit amount",
        "so tien ghi co",
        "amount_vnd",
    )?
    .ok_or("amount_vnd")?;
    let amount_vnd = parse_amount(&amount_text).ok_or("amount_vnd")?;
    let note = field_from_parts(
        &values_by_part,
        "details of payment",
        "noi dung chuyen tien",
        "note",
    )?
    .ok_or("note")?;
    let beneficiary_name = field_from_parts(
        &values_by_part,
        "beneficiary name",
        "ten nguoi huong",
        "beneficiary_name",
    )?
    .ok_or("beneficiary_name")?;
    let timestamp_ns = field_from_parts(
        &values_by_part,
        "transaction date/time",
        "ngay, gio giao dich",
        "email_ts_ns",
    )?
    .and_then(|value| parse_timestamp(&value))
    .or_else(|| {
        header(headers, "Date")
            .and_then(|date| DateTime::parse_from_rfc2822(date.trim()).ok())
            .and_then(|date| date.timestamp_nanos_opt())
            .and_then(|nanos| u64::try_from(nanos).ok())
    })
    .ok_or("email_ts_ns")?;
    Ok(Parsed {
        transaction_code,
        credit_account,
        amount_vnd,
        note,
        timestamp_ns,
        _beneficiary_name: beneficiary_name,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn quoted_printable_and_entities() {
        assert_eq!(
            String::from_utf8(decode_qp(b"a=3Db=\r\nc")).unwrap(),
            "a=bc"
        );
        assert_eq!(strip_html("<b> A&nbsp;&amp;&#66;&#x43; </b>"), "A &BC");
    }

    #[test]
    fn amounts_and_labels() {
        assert_eq!(parse_amount("10,000 VND"), Some(10000));
        assert_eq!(parse_amount("10.000 VND"), Some(10000));
        assert_eq!(parse_amount("10,000 USD"), None);
        assert!(label_matches(
            "Tài khoản ghi có",
            "credit account",
            "tai khoan ghi co"
        ));
        assert!(!label_matches(
            "Tài khoản ghi nợ",
            "credit account",
            "tai khoan ghi co"
        ));
    }

    #[test]
    fn multipart_collects_and_decodes_base64_parts() {
        let html = "<table><tr><td>Credit Account</td><td>0000123456789</td></tr></table>";
        let encoded = STANDARD.encode(html);
        let eml = format!("Date: Sat, 31 Oct 2026 12:34:56 +0700\r\nContent-Type: multipart/alternative; boundary=PART\r\n\r\n--PART\r\nContent-Type: text/plain\r\n\r\nCredit Account: WRONG\r\n--PART\r\nContent-Type: text/html\r\nContent-Transfer-Encoding: base64\r\n\r\n{encoded}\r\n--PART--\r\n");
        let (headers, body) = crate::dkim::split_email(eml.as_bytes()).unwrap();
        let parts = all_parts(&headers, body).unwrap();
        assert_eq!(parts.len(), 2);
        let (selected, is_html) = parts.iter().find(|(_, html)| *html).unwrap();
        assert!(*is_html);
        assert_eq!(cells(selected)[1], "0000123456789");
    }

    #[test]
    fn plain_table_uses_date_header_when_transaction_time_missing() {
        let eml = b"Date: Sat, 31 Oct 2026 12:34:56 +0700\r\nContent-Type: text/plain\r\n\r\nTransaction code: FT26311000000001\r\nDebit Account: WRONG\r\nCredit Account: 0000123456789\r\nCredit Amount: 10.000 VND\r\nBeneficiary Name: NGUYEN VAN TEST\r\nDetails of Payment: FUL-ORDER123 test\r\n";
        let (headers, body) = crate::dkim::split_email(eml).unwrap();
        let parsed = parse(&headers, body).unwrap();
        assert_eq!(parsed.credit_account, "0000123456789");
        assert_eq!(parsed.timestamp_ns, 1793424896000000000);
    }

    #[test]
    fn invalid_transaction_time_falls_back_to_date_header() {
        let eml = b"Date: Sat, 31 Oct 2026 12:34:56 +0700\r\nContent-Type: text/plain\r\n\r\nTransaction date/time: unavailable\r\nTransaction code: FT26311000000001\r\nCredit Account: 0000123456789\r\nCredit Amount: 10,000 VND\r\nBeneficiary Name: NGUYEN VAN TEST\r\nDetails of Payment: FUL-ORDER123 test\r\n";
        let (headers, body) = crate::dkim::split_email(eml).unwrap();
        let parsed = parse(&headers, body).unwrap();
        assert_eq!(parsed.timestamp_ns, 1793424896000000000);
    }

    #[test]
    fn note_before_credit_fields_cannot_become_a_label() {
        for note in [
            "credit amount 999,999 VND; transaction code X",
            "transaction code X; credit account WRONG",
        ] {
            let eml = format!("Date: Sat, 31 Oct 2026 12:34:56 +0700\r\nContent-Type: text/html; charset=utf-8\r\n\r\n<table><tr><td>Details of Payment</td><td>{note}</td></tr><tr><td>Transaction code</td><td>FT26311000000001</td></tr><tr><td>Credit Account</td><td>0000123456789</td></tr><tr><td>Credit Amount</td><td>10,000 VND</td></tr><tr><td>Beneficiary Name</td><td>NGUYEN VAN TEST</td></tr></table>");
            let (headers, body) = crate::dkim::split_email(eml.as_bytes()).unwrap();
            let parsed = parse(&headers, body).unwrap();
            assert_eq!(parsed.transaction_code, "FT26311000000001");
            assert_eq!(parsed.credit_account, "0000123456789");
            assert_eq!(parsed.amount_vnd, 10000);
            assert_eq!(parsed.note, note);
        }
    }

    #[test]
    fn beneficiary_is_parsed_but_never_returned() {
        let eml = b"Date: Sat, 31 Oct 2026 12:34:56 +0700\r\nContent-Type: text/plain\r\n\r\nTransaction code: FT26311000000001\r\nCredit Account: 0000123456789\r\nCredit Amount: 10.000 VND\r\nDetails of Payment: FUL-ORDER123 test\r\n";
        let (headers, body) = crate::dkim::split_email(eml).unwrap();
        assert!(matches!(parse(&headers, body), Err("beneficiary_name")));
    }

    #[test]
    fn transaction_time_accepts_gmt_suffix() {
        assert_eq!(
            parse_timestamp("31/10/2026 12:34:56 GMT+7"),
            Some(1793424896000000000)
        );
        assert_eq!(
            parse_timestamp(" 31/10/2026 12:34:56 UTC+7 "),
            Some(1793424896000000000)
        );
    }

    fn table_mail(extra_rows: &str, note: &str) -> String {
        format!("Date: Sat, 31 Oct 2026 12:34:56 +0700\r\nContent-Type: text/html\r\n\r\n<table><tr><td>Transaction code</td><td>FT26311000000001</td></tr><tr><td>Credit Account</td><td>0000123456789</td></tr><tr><td>Credit Amount</td><td>10,000 VND</td></tr><tr><td>Beneficiary Name</td><td>TEST PERSON</td></tr><tr><td>Details of Payment</td><td>{note}</td></tr>{extra_rows}</table>")
    }

    #[test]
    fn rejects_different_repeated_fields_but_allows_identical_values() {
        let same = table_mail(
            "<tr><td>Credit Amount</td><td>10,000 VND</td></tr>",
            "FUL-ORDER123",
        );
        let (headers, body) = crate::dkim::split_email(same.as_bytes()).unwrap();
        assert_eq!(parse(&headers, body).unwrap().amount_vnd, 10000);

        let different = table_mail(
            "<tr><td>Credit Amount</td><td>999,999 VND</td></tr>",
            "FUL-ORDER123",
        );
        let (headers, body) = crate::dkim::split_email(different.as_bytes()).unwrap();
        assert!(matches!(
            parse(&headers, body),
            Err("parse_ambiguous:amount_vnd")
        ));
    }

    #[test]
    fn status_must_be_success_when_present() {
        for value in ["Thành công", "Successful", "Success", "Completed"] {
            let mail = table_mail(
                &format!("<tr><td>Trạng thái giao dịch</td><td>{value}</td></tr>"),
                "FUL-ORDER123",
            );
            let (headers, body) = crate::dkim::split_email(mail.as_bytes()).unwrap();
            assert!(parse(&headers, body).is_ok(), "{value}");
        }
        for value in ["Thất bại", "Pending", "Đang xử lý", "Chờ xử lý", "Unknown"] {
            let mail = table_mail(
                &format!("<tr><td>Status</td><td>{value}</td></tr>"),
                "FUL-ORDER123",
            );
            let (headers, body) = crate::dkim::split_email(mail.as_bytes()).unwrap();
            assert!(
                matches!(parse(&headers, body), Err("status_not_success")),
                "{value}"
            );
        }
    }

    #[test]
    fn note_text_cannot_supply_amount_or_account_labels() {
        let note = "FUL-ORDER123 Số tiền ghi có: 9,999,999 VND Số tài khoản ghi có: 123456789";
        let html = table_mail("", note);
        let (headers, body) = crate::dkim::split_email(html.as_bytes()).unwrap();
        let parsed = parse(&headers, body).unwrap();
        assert_eq!(parsed.amount_vnd, 10000);
        assert_eq!(parsed.credit_account, "0000123456789");

        let plain = format!("Date: Sat, 31 Oct 2026 12:34:56 +0700\r\nContent-Type: text/plain\r\n\r\nTransaction code: FT26311000000001\r\nCredit Account: 0000123456789\r\nCredit Amount: 10,000 VND\r\nBeneficiary Name: TEST PERSON\r\nDetails of Payment: {note}\r\n");
        let (headers, body) = crate::dkim::split_email(plain.as_bytes()).unwrap();
        let parsed = parse(&headers, body).unwrap();
        assert_eq!(parsed.amount_vnd, 10000);
        assert_eq!(parsed.credit_account, "0000123456789");
    }

    #[test]
    fn duplicated_mime_part_header_is_rejected() {
        let body = table_mail("", "FUL-ORDER123");
        let (_, html) = body.split_once("\r\n\r\n").unwrap();
        let mail = format!("Content-Type: multipart/alternative; boundary=PART\r\n\r\n--PART\r\nContent-Type: text/html\r\nContent-Type: text/plain\r\n\r\n{html}\r\n--PART--\r\n");
        let (headers, body) = crate::dkim::split_email(mail.as_bytes()).unwrap();
        assert!(matches!(
            parse(&headers, body),
            Err("duplicate_header:content-type")
        ));
    }

    fn multipart_alternative(html: &str, plain: &str) -> String {
        format!("Content-Type: multipart/alternative; boundary=PART\r\n\r\n--PART\r\nContent-Type: text/html\r\n\r\n{html}\r\n--PART\r\nContent-Type: text/plain\r\n\r\n{plain}\r\n--PART--\r\n")
    }

    #[test]
    fn real_vpbank_layout_with_english_label_rows_and_spacers() {
        // Mirrors the real VPBank NEO table (synthetic values): Vietnamese label + value cells,
        // English labels repeated in their own row, empty spacer cells, label-only last cell.
        let cells = [
            "M\u{e3} giao d\u{1ecb}ch:",
            "FT26311000000001",
            "Ng\u{e0}y, gi\u{1edd} giao d\u{1ecb}ch:",
            "07/11/2026 19:09:27",
            "Transaction code",
            "Transaction date, time",
            "T\u{e0}i kho\u{1ea3}n tr\u{ed}ch n\u{1ee3}",
            "111122223",
            "S\u{1ed1} ti\u{1ec1}n tr\u{ed}ch n\u{1ee3}:",
            "10,000 VND",
            "Debit Account",
            "",
            "Debit Amount",
            "",
            "T\u{e0}i kho\u{1ea3}n ghi c\u{f3}:",
            "0000123456789",
            "S\u{1ed1} ti\u{1ec1}n ghi c\u{f3}:",
            "10,000 VND",
            "Credit Account",
            "",
            "Credit Amount",
            "",
            "T\u{ea}n ng\u{1b0}\u{1edd}i h\u{1b0}\u{1edf}ng:",
            "TEST PERSON",
            "",
            "",
            "Beneficiary Name",
            "",
            "",
            "",
            "Lo\u{1ea1}i ph\u{ed}:",
            "Ph\u{ed} ng\u{1b0}\u{1edd}i chuy\u{1ec3}n tr\u{1ea3}",
            "S\u{1ed1} ti\u{1ec1}n ph\u{ed}:",
            "0 VND",
            "Charge Code",
            "Exclude",
            "Fee Amount",
            "",
            "",
            "N\u{1ed9}i dung chuy\u{1ec3}n ti\u{1ec1}n:",
            "FUL-ORDER123",
            "Details of Payment",
        ];
        let html: String = cells.iter().map(|c| format!("<td>{c}</td>")).collect();
        let mail = format!(
            "From: VPBank NEO <vpbankonline@vpb.com.vn>\r\nDate: Sat, 7 Nov 2026 19:09:27 +0700\r\nContent-Type: text/html; charset=utf-8\r\n\r\n<table><tr>{html}</tr></table>"
        );
        let (headers, body) = crate::dkim::split_email(mail.as_bytes()).unwrap();
        let parsed = parse(&headers, body).expect("real layout parses");
        assert_eq!(parsed.amount_vnd, 10000);
        assert_eq!(parsed.note, "FUL-ORDER123");
    }

    #[test]
    fn all_mime_alternatives_are_checked_for_status_and_conflicts() {
        let html_mail = table_mail("", "FUL-ORDER123");
        let (_, html) = html_mail.split_once("\r\n\r\n").unwrap();
        let plain = "Transaction code: FT26311000000001\r\nCredit Account: 0000123456789\r\nCredit Amount: 10,000 VND\r\nBeneficiary Name: TEST PERSON\r\nDetails of Payment: FUL-ORDER123\r\nStatus: Pending";
        let mail = multipart_alternative(html, plain);
        let (headers, body) = crate::dkim::split_email(mail.as_bytes()).unwrap();
        assert!(matches!(parse(&headers, body), Err("status_not_success")));

        let plain = plain
            .replace("Credit Amount: 10,000 VND", "Credit Amount: 999,999 VND")
            .replace("Status: Pending", "Status: Success");
        let mail = multipart_alternative(html, &plain);
        let (headers, body) = crate::dkim::split_email(mail.as_bytes()).unwrap();
        assert!(matches!(
            parse(&headers, body),
            Err("parse_ambiguous:amount_vnd")
        ));
    }

    #[test]
    fn folded_plain_note_cannot_introduce_fields() {
        for continuation in [
            " Credit Amount: 999,999 VND\r\n Credit Account: 123456789",
            "Credit Amount: 999,999 VND\r\nCredit Account: 123456789",
        ] {
            let mail = format!("Date: Sat, 31 Oct 2026 12:34:56 +0700\r\nContent-Type: text/plain\r\n\r\nTransaction code: FT26311000000001\r\nCredit Account: 0000123456789\r\nCredit Amount: 10,000 VND\r\nBeneficiary Name: TEST PERSON\r\nDetails of Payment: FUL-ORDER123\r\n{continuation}\r\n");
            let (headers, body) = crate::dkim::split_email(mail.as_bytes()).unwrap();
            let parsed = parse(&headers, body).unwrap();
            assert_eq!(parsed.amount_vnd, 10000);
            assert_eq!(parsed.credit_account, "0000123456789");
        }
    }
}
