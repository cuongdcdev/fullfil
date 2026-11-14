use crate::{Config, Fetcher, DOH_MAX_BYTES};
use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use rsa::pkcs1::DecodeRsaPublicKey;
use rsa::pkcs1v15::{Signature, VerifyingKey};
use rsa::pkcs8::DecodePublicKey;
use rsa::signature::Verifier;
use rsa::RsaPublicKey;
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::collections::HashMap;

pub struct BankProfile {
    pub id: &'static str,
    pub dkim_domains: Vec<&'static str>,
}

impl BankProfile {
    pub(crate) fn parse(
        &self,
        headers: &[Header],
        body: &[u8],
    ) -> Result<crate::parser::Parsed, &'static str> {
        match self.id {
            "vpbank" => crate::parser::parse(headers, body),
            _ => Err("bank"),
        }
    }
}

#[derive(Clone)]
pub struct Header {
    pub name: String,
    pub value: String,
    pub raw: Option<Vec<u8>>,
}

pub fn normalize_newlines(input: &[u8]) -> Vec<u8> {
    let mut output = Vec::with_capacity(input.len());
    for (index, byte) in input.iter().enumerate() {
        if *byte == b'\n' && (index == 0 || input[index - 1] != b'\r') {
            output.push(b'\r');
        }
        output.push(*byte);
    }
    output
}

pub fn split_email(eml: &[u8]) -> Result<(Vec<Header>, &[u8]), ()> {
    let offset = eml
        .windows(4)
        .position(|part| part == b"\r\n\r\n")
        .ok_or(())?;
    let mut headers: Vec<Header> = Vec::new();
    for line in eml[..offset].split(|byte| *byte == b'\n') {
        let line = line.strip_suffix(b"\r").unwrap_or(line);
        if line.starts_with(b" ") || line.starts_with(b"\t") {
            headers.last_mut().ok_or(())?.value.push_str("\r\n");
            headers
                .last_mut()
                .ok_or(())?
                .value
                .push_str(&String::from_utf8_lossy(line));
            let raw = headers.last_mut().ok_or(())?.raw.as_mut().ok_or(())?;
            raw.extend_from_slice(b"\r\n");
            raw.extend_from_slice(line);
        } else {
            let colon = line.iter().position(|byte| *byte == b':').ok_or(())?;
            headers.push(Header {
                name: String::from_utf8_lossy(&line[..colon]).into_owned(),
                value: String::from_utf8_lossy(&line[colon + 1..]).into_owned(),
                raw: Some(line.to_vec()),
            });
        }
    }
    Ok((headers, &eml[offset + 4..]))
}

pub fn header<'a>(headers: &'a [Header], name: &str) -> Option<&'a str> {
    headers
        .iter()
        .rev()
        .find(|h| h.name.eq_ignore_ascii_case(name))
        .map(|h| h.value.as_str())
}

fn tags(value: &str) -> HashMap<String, String> {
    value
        .split(';')
        .filter_map(|part| {
            let (name, value) = part.split_once('=')?;
            Some((name.trim().to_ascii_lowercase(), value.trim().to_string()))
        })
        .collect()
}

fn tag<'a>(tags: &'a HashMap<String, String>, name: &str) -> Option<&'a str> {
    tags.get(name).map(String::as_str)
}

fn unfold(value: &str) -> String {
    value.replace("\r\n", "")
}

pub(crate) fn canonical_header(header: &Header, mode: &str) -> Vec<u8> {
    if mode == "simple" {
        if let Some(raw) = &header.raw {
            let mut bytes = raw.clone();
            bytes.extend_from_slice(b"\r\n");
            return bytes;
        }
        return format!("{}:{}\r\n", header.name, header.value).into_bytes();
    }
    if let Some(raw) = &header.raw {
        if let Some(colon) = raw.iter().position(|byte| *byte == b':') {
            let mut unfolded = Vec::new();
            let mut index = colon + 1;
            while index < raw.len() {
                if raw[index..].starts_with(b"\r\n")
                    && raw
                        .get(index + 2)
                        .is_some_and(|byte| *byte == b' ' || *byte == b'\t')
                {
                    index += 2;
                    continue;
                }
                unfolded.push(raw[index]);
                index += 1;
            }
            let mut value = Vec::new();
            let mut whitespace = false;
            for byte in unfolded {
                if byte == b' ' || byte == b'\t' {
                    whitespace = true;
                } else {
                    if whitespace && !value.is_empty() {
                        value.push(b' ');
                    }
                    value.push(byte);
                    whitespace = false;
                }
            }
            let mut result = raw[..colon]
                .iter()
                .map(|byte| byte.to_ascii_lowercase())
                .collect::<Vec<_>>();
            result.push(b':');
            result.extend(value);
            result.extend(b"\r\n");
            return result;
        }
    }
    let unfolded = unfold(&header.value);
    let compact = unfolded.split_whitespace().collect::<Vec<_>>().join(" ");
    format!("{}:{}\r\n", header.name.to_ascii_lowercase(), compact).into_bytes()
}

pub(crate) fn canonical_body(body: &[u8], mode: &str) -> Vec<u8> {
    let lines = body
        .split(|byte| *byte == b'\n')
        .map(|line| line.strip_suffix(b"\r").unwrap_or(line));
    let mut cleaned: Vec<Vec<u8>> = lines
        .map(|line| {
            if mode == "simple" {
                return line.to_vec();
            }
            let mut compact = Vec::new();
            let mut space = false;
            for byte in line {
                if *byte == b' ' || *byte == b'\t' {
                    space = true;
                } else {
                    if space {
                        compact.push(b' ');
                    }
                    compact.push(*byte);
                    space = false;
                }
            }
            compact
        })
        .collect();
    while cleaned.last().is_some_and(|line| line.is_empty()) {
        cleaned.pop();
    }
    let mut output = Vec::new();
    for line in cleaned {
        output.extend(line);
        output.extend(b"\r\n");
    }
    if output.is_empty() && mode == "simple" {
        output.extend(b"\r\n");
    }
    output
}

fn empty_b_tag(value: &str) -> Option<String> {
    let mut cursor = 0;
    for part in value.split(';') {
        if let Some((name, _)) = part.split_once('=') {
            if name.trim().eq_ignore_ascii_case("b") {
                let equals = cursor + part.find('=')?;
                let mut result = value.to_string();
                result.replace_range(equals + 1..cursor + part.len(), "");
                return Some(result);
            }
        }
        cursor += part.len() + 1;
    }
    None
}

fn parse_key(key_record: &str) -> Option<RsaPublicKey> {
    let key_tags = tags(key_record);
    if !tag(&key_tags, "k")
        .unwrap_or("rsa")
        .eq_ignore_ascii_case("rsa")
    {
        return None;
    }
    let encoded = tag(&key_tags, "p")?
        .chars()
        .filter(|c| !c.is_whitespace())
        .collect::<String>();
    let bytes = STANDARD.decode(encoded).ok()?;
    RsaPublicKey::from_public_key_der(&bytes)
        .or_else(|_| RsaPublicKey::from_pkcs1_der(&bytes))
        .ok()
}

fn doh_records(fetcher: &impl Fetcher, domain: &str, selector: &str) -> Vec<String> {
    let name = format!("{selector}._domainkey.{domain}");
    let paths = [
        (
            format!("https://dns.google/resolve?name={name}&type=TXT"),
            false,
        ),
        (
            format!("https://cloudflare-dns.com/dns-query?name={name}&type=TXT"),
            true,
        ),
    ];
    for (url, cloudflare) in paths {
        let headers = if cloudflare {
            vec![("accept", "application/dns-json")]
        } else {
            vec![]
        };
        let Ok(bytes) = fetcher.get(&url, &headers) else {
            continue;
        };
        if bytes.len() > DOH_MAX_BYTES {
            continue;
        }
        let Ok(json) = serde_json::from_slice::<Value>(&bytes) else {
            continue;
        };
        let records: Vec<String> = json["Answer"]
            .as_array()
            .into_iter()
            .flatten()
            .filter(|answer| answer["type"].as_u64() == Some(16))
            .filter_map(|answer| answer["data"].as_str())
            .map(|data| {
                // Resolvers return TXT data either as quoted chunks ("v=DKIM1; " "p=...")
                // or as one unquoted string (dns.google). Handle both.
                if data.contains('"') {
                    data.split('"')
                        .enumerate()
                        .filter(|(i, _)| i % 2 == 1)
                        .map(|(_, part)| part)
                        .collect::<String>()
                } else {
                    data.to_string()
                }
            })
            .collect();
        if !records.is_empty() {
            return records;
        }
    }
    Vec::new()
}

fn verify_one(
    headers: &[Header],
    body: &[u8],
    index: usize,
    config: &Config,
    fetcher: &impl Fetcher,
) -> Result<String, &'static str> {
    let dkim = &headers[index];
    let signature_tags = tags(&dkim.value);
    let domain = tag(&signature_tags, "d")
        .ok_or("dkim_fail")?
        .to_ascii_lowercase();
    let allowed = config.banks.iter().any(|bank| {
        bank.dkim_domains
            .iter()
            .any(|candidate| candidate.eq_ignore_ascii_case(&domain))
    });
    if !allowed {
        return Err("domain_not_allowed");
    }
    if signature_tags.contains_key("l") {
        return Err("l_tag_rejected");
    }
    if !tag(&signature_tags, "a").is_some_and(|a| a.eq_ignore_ascii_case("rsa-sha256")) {
        return Err("dkim_fail");
    }
    let from = header(headers, "From").ok_or("dkim_fail")?;
    let mailbox = if let Some(start) = from.rfind('<') {
        from[start + 1..].split('>').next().unwrap_or("")
    } else {
        from.split_whitespace().next().unwrap_or("")
    };
    let from_domain = mailbox
        .split_once('@')
        .map(|(_, domain)| domain.trim())
        .unwrap_or("")
        .to_ascii_lowercase();
    if from_domain != domain && !from_domain.ends_with(&format!(".{domain}")) {
        return Err("domain_not_allowed");
    }
    let selector = tag(&signature_tags, "s").ok_or("dkim_fail")?;
    let canonical = tag(&signature_tags, "c").unwrap_or("simple/simple");
    let (header_mode, body_mode) = canonical.split_once('/').unwrap_or((canonical, "simple"));
    if !matches!(header_mode, "simple" | "relaxed") || !matches!(body_mode, "simple" | "relaxed") {
        return Err("dkim_fail");
    }
    let body_hash = tag(&signature_tags, "bh")
        .ok_or("dkim_fail")?
        .chars()
        .filter(|c| !c.is_whitespace())
        .collect::<String>();
    if STANDARD.decode(body_hash).map_err(|_| "dkim_fail")?
        != Sha256::digest(canonical_body(body, body_mode)).to_vec()
    {
        return Err("dkim_fail");
    }
    let signed_names: Vec<_> = tag(&signature_tags, "h")
        .ok_or("dkim_fail")?
        .split(':')
        .map(str::trim)
        .collect();
    if !signed_names
        .iter()
        .any(|name| name.eq_ignore_ascii_case("from"))
    {
        return Err("dkim_fail");
    }
    let mut used = vec![false; headers.len()];
    let mut signed = Vec::new();
    for name in signed_names {
        if let Some((position, selected)) = headers
            .iter()
            .enumerate()
            .rev()
            .find(|(position, h)| !used[*position] && h.name.eq_ignore_ascii_case(name))
        {
            used[position] = true;
            signed.extend(canonical_header(selected, header_mode));
        }
    }
    let mut empty = dkim.clone();
    empty.value = empty_b_tag(&dkim.value).ok_or("dkim_fail")?;
    empty.raw = None;
    let mut canonical_signature = canonical_header(&empty, header_mode);
    canonical_signature.truncate(canonical_signature.len().saturating_sub(2));
    signed.extend(canonical_signature);
    let encoded = tag(&signature_tags, "b")
        .ok_or("dkim_fail")?
        .chars()
        .filter(|c| !c.is_whitespace())
        .collect::<String>();
    let signature_bytes = STANDARD.decode(encoded).map_err(|_| "dkim_fail")?;
    let signature = Signature::try_from(signature_bytes.as_slice()).map_err(|_| "dkim_fail")?;
    let signature_verifies = |key: RsaPublicKey| {
        VerifyingKey::<Sha256>::new(key)
            .verify(&signed, &signature)
            .is_ok()
    };
    if !config.offline
        && doh_records(fetcher, &domain, selector)
            .into_iter()
            .filter_map(|record| parse_key(&record))
            .any(&signature_verifies)
    {
        return Ok(domain);
    }
    let pinned = config
        .pinned_keys
        .get(&(domain.clone(), selector.to_ascii_lowercase()));
    if pinned
        .and_then(|key| parse_key(&format!("k=rsa; p={key}")))
        .is_some_and(signature_verifies)
    {
        return Ok(domain);
    }
    Err("dkim_fail")
}

pub fn verify(
    headers: &[Header],
    body: &[u8],
    config: &Config,
    fetcher: &impl Fetcher,
) -> Result<String, &'static str> {
    let mut reason = "dkim_fail";
    let mut any = false;
    for (index, h) in headers.iter().enumerate() {
        if h.name.eq_ignore_ascii_case("DKIM-Signature") {
            any = true;
            match verify_one(headers, body, index, config, fetcher) {
                Ok(domain) => return Ok(domain),
                Err("l_tag_rejected") => reason = "l_tag_rejected",
                Err("domain_not_allowed") if reason == "dkim_fail" => reason = "domain_not_allowed",
                Err(_) => {}
            }
        }
    }
    if any {
        Err(reason)
    } else {
        Err("dkim_fail")
    }
}
