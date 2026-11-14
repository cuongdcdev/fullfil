use email_verifier::{
    merchant_hash, validate_job, verify, Config, Fetcher, Job, Output, BLOB_MAX_BYTES,
    DOH_MAX_BYTES, USER_AGENT,
};
use std::io::{self, Read, Write};
use std::time::Duration;

struct HttpFetcher;

#[cfg(not(all(target_arch = "wasm32", target_os = "wasi")))]
impl Fetcher for HttpFetcher {
    fn get(&self, url: &str, headers: &[(&str, &str)]) -> Result<Vec<u8>, String> {
        let limit = response_limit(url);
        let agent = ureq::AgentBuilder::new().redirects(0).build();
        let mut request = agent
            .get(url)
            .set("User-Agent", USER_AGENT)
            .timeout(Duration::from_secs(20));
        for (name, value) in headers {
            request = request.set(name, value);
        }
        let response = request.call().map_err(|error| error.to_string())?;
        if !(200..300).contains(&response.status()) {
            return Err("HTTP request failed".into());
        }
        let mut bytes = Vec::new();
        response
            .into_reader()
            .take((limit + 1) as u64)
            .read_to_end(&mut bytes)
            .map_err(|error| error.to_string())?;
        if bytes.len() > limit {
            return Err("HTTP response too large".into());
        }
        Ok(bytes)
    }
}

#[cfg(all(target_arch = "wasm32", target_os = "wasi"))]
impl Fetcher for HttpFetcher {
    fn get(&self, url: &str, headers: &[(&str, &str)]) -> Result<Vec<u8>, String> {
        let mut all_headers = vec![("User-Agent", USER_AGENT)];
        all_headers.extend_from_slice(headers);
        wasi_request(url, &all_headers, response_limit(url))
    }
}

fn response_limit(url: &str) -> usize {
    if url.starts_with("https://dns.google/resolve?")
        || url.starts_with("https://cloudflare-dns.com/dns-query?")
    {
        DOH_MAX_BYTES
    } else {
        BLOB_MAX_BYTES
    }
}

#[cfg(all(target_arch = "wasm32", target_os = "wasi"))]
fn wasi_request(url: &str, headers: &[(&str, &str)], limit: usize) -> Result<Vec<u8>, String> {
    use std::time::Instant;
    use wasi::http::outgoing_handler;
    use wasi::http::types::{Headers, OutgoingBody, OutgoingRequest, RequestOptions, Scheme};
    use wasi::io::streams::StreamError;

    let started = Instant::now();
    let url = url::Url::parse(url).map_err(|_| "invalid HTTP URL")?;
    if url.scheme() != "https" {
        return Err("invalid HTTP URL".into());
    }
    let fields = Headers::new();
    for (name, value) in headers {
        fields
            .set(&(*name).into(), &[(*value).into()])
            .map_err(|_| "invalid HTTP header")?;
    }
    let request = OutgoingRequest::new(fields);
    request
        .set_method(&wasi::http::types::Method::Get)
        .map_err(|_| "invalid HTTP method")?;
    request
        .set_scheme(Some(&Scheme::Https))
        .map_err(|_| "invalid HTTP scheme")?;
    request
        .set_authority(Some(url.authority()))
        .map_err(|_| "invalid HTTP authority")?;
    let path = match url.query() {
        Some(query) => format!("{}?{query}", url.path()),
        None => url.path().to_string(),
    };
    request
        .set_path_with_query(Some(&path))
        .map_err(|_| "invalid HTTP path")?;
    let outgoing = request.body().map_err(|_| "HTTP body failed")?;
    OutgoingBody::finish(outgoing, None).map_err(|_| "HTTP body failed")?;

    // wasi-http-client 0.2 exposes only connect_timeout. Set all three
    // wasi:http request-options directly and check an elapsed deadline while reading.
    let options = RequestOptions::new();
    options
        .set_connect_timeout(Some(Duration::from_secs(5).as_nanos() as u64))
        .map_err(|_| "HTTP timeout setup failed")?;
    options
        .set_first_byte_timeout(Some(Duration::from_secs(10).as_nanos() as u64))
        .map_err(|_| "HTTP timeout setup failed")?;
    options
        .set_between_bytes_timeout(Some(Duration::from_secs(5).as_nanos() as u64))
        .map_err(|_| "HTTP timeout setup failed")?;
    let future =
        outgoing_handler::handle(request, Some(options)).map_err(|_| "HTTP request failed")?;
    let response = match future.get() {
        Some(result) => result.map_err(|_| "HTTP request failed")?,
        None => {
            future.subscribe().block();
            future
                .get()
                .ok_or("HTTP request failed")?
                .map_err(|_| "HTTP request failed")?
        }
    }
    .map_err(|_| "HTTP request failed")?;
    if !(200..300).contains(&response.status()) {
        return Err("HTTP request failed".into());
    }
    let incoming = response.consume().map_err(|_| "HTTP body failed")?;
    let stream = incoming.stream().map_err(|_| "HTTP body failed")?;
    let mut bytes = Vec::new();
    loop {
        if started.elapsed() >= Duration::from_secs(20) {
            return Err("HTTP request timed out".into());
        }
        let read_len = (limit + 1 - bytes.len()).min(8192) as u64;
        match stream.blocking_read(read_len) {
            Ok(chunk) => {
                bytes.extend_from_slice(&chunk);
                if bytes.len() > limit {
                    return Err("HTTP response too large".into());
                }
            }
            Err(StreamError::Closed) => return Ok(bytes),
            Err(_) => return Err("HTTP body failed".into()),
        }
    }
}

fn run() -> Result<(), String> {
    let mut args = std::env::args().skip(1).collect::<Vec<_>>().into_iter();
    if args
        .as_slice()
        .first()
        .is_some_and(|command| command == "hash-account")
    {
        args.next();
        let account_arg = args.next();
        if args.next().is_some() {
            return Err("unexpected argument".to_string());
        }
        let account = match account_arg.as_deref() {
            Some(value) if value != "-" => value.to_string(),
            _ => {
                let mut account = String::new();
                io::stdin()
                    .read_to_string(&mut account)
                    .map_err(|error| error.to_string())?;
                account
            }
        };
        if account.trim().is_empty() {
            return Err("hash-account requires ACCOUNT on stdin".to_string());
        }
        println!("{}", merchant_hash(&account));
        io::stdout().flush().map_err(|error| error.to_string())?;
        return Ok(());
    }
    let mut job_file = None;
    let mut eml_file = None;
    let mut skip_sha = false;
    let mut config = Config::default();
    while let Some(flag) = args.next() {
        match flag.as_str() {
            "--job-file" => job_file = Some(args.next().ok_or("--job-file requires PATH")?),
            "--eml-file" => eml_file = Some(args.next().ok_or("--eml-file requires PATH")?),
            "--skip-sha" => skip_sha = true,
            "--offline" => config.offline = true,
            "--pin" => {
                let pin = args
                    .next()
                    .ok_or("--pin requires DOMAIN:SELECTOR:BASE64SPKI")?;
                let mut parts = pin.splitn(3, ':');
                let domain = parts.next().unwrap_or("").to_ascii_lowercase();
                let selector = parts
                    .next()
                    .ok_or("pin selector missing")?
                    .to_ascii_lowercase();
                let key = parts.next().ok_or("pin key missing")?.to_string();
                config.pinned_keys.insert((domain, selector), key);
            }
            _ => return Err(format!("unknown argument: {flag}")),
        }
    }
    let input = if let Some(path) = job_file {
        std::fs::read_to_string(path).map_err(|error| error.to_string())?
    } else {
        let mut input = String::new();
        io::stdin()
            .read_to_string(&mut input)
            .map_err(|error| error.to_string())?;
        input
    };
    let job: Job =
        serde_json::from_str(&input).map_err(|error| format!("invalid job JSON: {error}"))?;
    let result = match eml_file {
        Some(path) => verify_eml_file(&path, &job, skip_sha, &config),
        None => verify(&job, None, skip_sha, &config, &HttpFetcher),
    };
    println!(
        "{}",
        serde_json::to_string(&result).map_err(|error| error.to_string())?
    );
    io::stdout().flush().map_err(|error| error.to_string())?;
    Ok(())
}

fn verify_eml_file(path: &str, job: &Job, skip_sha: bool, config: &Config) -> Output {
    match std::fs::read(path) {
        Ok(eml) => verify(job, Some(&eml), skip_sha, config, &HttpFetcher),
        Err(_) => match validate_job(job) {
            Ok(()) => Output::failure(job, "blob_fetch_fail"),
            Err(reason) => Output::failure(job, reason),
        },
    }
}

fn main() {
    if let Err(error) = run() {
        eprintln!("{error}");
        std::process::exit(1);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn eml_read_failure_echoes_job() {
        let spec = format!(
            r#"{{"amount":"10000","bank":"vpbank","country":"VN","currency":"VND","merchant_hash":"{}","v":1}}"#,
            "0".repeat(64)
        );
        let job = Job {
            order_id: "FUL-ORDER123".into(),
            kind: "bank_transfer".into(),
            spec_hash: email_verifier::hex_sha256(spec.as_bytes()),
            spec,
            proof_sha256: "0".repeat(64),
            claimed_at_ns: 0,
            blob_url: "https://example.test/unused".into(),
        };
        let output = verify_eml_file("\0", &job, false, &Config::default());
        assert_eq!(output.reason.as_deref(), Some("blob_fetch_fail"));
        assert_eq!(output.order_id, job.order_id);
        assert_eq!(output.proof_sha256, job.proof_sha256);
    }

    #[test]
    fn eml_read_failure_still_checks_generic_job_prefix() {
        let job = Job {
            order_id: "FUL-ORDER123".into(),
            kind: "wrong".into(),
            spec: "{}".into(),
            spec_hash: "0".repeat(64),
            proof_sha256: "0".repeat(64),
            claimed_at_ns: 0,
            blob_url: "https://example.test/unused".into(),
        };
        assert_eq!(
            verify_eml_file("\0", &job, false, &Config::default())
                .reason
                .as_deref(),
            Some("kind_mismatch")
        );
    }
}
