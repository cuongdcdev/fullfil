use cryptorefills_verifier::{
    beneficiary_hash, verify, Config, Http, HttpError, Job, Output, BLOB_MAX_BYTES, MCP_MAX_BYTES,
    MCP_URL,
};
use std::io::{self, Read, Write};
use std::time::Duration;

struct HttpClient;

#[cfg(not(all(target_arch = "wasm32", target_os = "wasi")))]
impl Http for HttpClient {
    fn get(&self, url: &str, headers: &[(&str, &str)]) -> Result<Vec<u8>, HttpError> {
        let agent = ureq::AgentBuilder::new()
            .redirects(0)
            .timeout(Duration::from_secs(20))
            .build();
        let mut request = agent.get(url).set("User-Agent", browser_user_agent());
        for (name, value) in headers {
            request = request.set(name, value);
        }
        let response = request.call().map_err(|_| HttpError)?;
        if !(200..300).contains(&response.status()) {
            return Err(HttpError);
        }
        let mut bytes = Vec::new();
        response
            .into_reader()
            .take((BLOB_MAX_BYTES + 1) as u64)
            .read_to_end(&mut bytes)
            .map_err(|_| HttpError)?;
        if bytes.len() > BLOB_MAX_BYTES {
            return Err(HttpError);
        }
        Ok(bytes)
    }

    fn post(&self, url: &str, headers: &[(&str, &str)], body: &[u8]) -> Result<Vec<u8>, HttpError> {
        if url != MCP_URL {
            return Err(HttpError);
        }
        let agent = ureq::AgentBuilder::new()
            .redirects(0)
            .timeout(Duration::from_secs(20))
            .build();
        let mut request = agent.post(url);
        for (name, value) in headers {
            request = request.set(name, value);
        }
        let response = request.send_bytes(body).map_err(|_| HttpError)?;
        if !(200..300).contains(&response.status()) {
            return Err(HttpError);
        }
        let mut bytes = Vec::new();
        response
            .into_reader()
            .take((MCP_MAX_BYTES + 1) as u64)
            .read_to_end(&mut bytes)
            .map_err(|_| HttpError)?;
        if bytes.len() > MCP_MAX_BYTES {
            return Err(HttpError);
        }
        Ok(bytes)
    }
}

#[cfg(all(target_arch = "wasm32", target_os = "wasi"))]
impl Http for HttpClient {
    fn get(&self, url: &str, headers: &[(&str, &str)]) -> Result<Vec<u8>, HttpError> {
        let mut all_headers = vec![("User-Agent", browser_user_agent())];
        all_headers.extend_from_slice(headers);
        wasi_request(
            wasi::http::types::Method::Get,
            url,
            &all_headers,
            None,
            BLOB_MAX_BYTES,
        )
    }

    fn post(&self, url: &str, headers: &[(&str, &str)], body: &[u8]) -> Result<Vec<u8>, HttpError> {
        if url != MCP_URL {
            return Err(HttpError);
        }
        wasi_request(
            wasi::http::types::Method::Post,
            url,
            headers,
            Some(body),
            MCP_MAX_BYTES,
        )
    }
}

#[cfg(all(target_arch = "wasm32", target_os = "wasi"))]
fn wasi_request(
    method: wasi::http::types::Method,
    url: &str,
    headers: &[(&str, &str)],
    body: Option<&[u8]>,
    limit: usize,
) -> Result<Vec<u8>, HttpError> {
    use std::time::Instant;
    use wasi::http::outgoing_handler;
    use wasi::http::types::{Headers, OutgoingBody, OutgoingRequest, RequestOptions, Scheme};
    use wasi::io::streams::StreamError;

    let started = Instant::now();
    let url = url::Url::parse(url).map_err(|_| HttpError)?;
    if url.scheme() != "https" {
        return Err(HttpError);
    }
    let fields = Headers::new();
    for (name, value) in headers {
        fields
            .set(&(*name).into(), &[(*value).into()])
            .map_err(|_| HttpError)?;
    }
    let request = OutgoingRequest::new(fields);
    request.set_method(&method).map_err(|_| HttpError)?;
    request
        .set_scheme(Some(&Scheme::Https))
        .map_err(|_| HttpError)?;
    request
        .set_authority(Some(url.authority()))
        .map_err(|_| HttpError)?;
    let path = match url.query() {
        Some(query) => format!("{}?{query}", url.path()),
        None => url.path().to_string(),
    };
    request
        .set_path_with_query(Some(&path))
        .map_err(|_| HttpError)?;
    let outgoing = request.body().map_err(|_| HttpError)?;
    if let Some(body) = body {
        outgoing
            .write()
            .map_err(|_| HttpError)?
            .blocking_write_and_flush(body)
            .map_err(|_| HttpError)?;
    }
    OutgoingBody::finish(outgoing, None).map_err(|_| HttpError)?;

    // wasi-http-client 0.2 exposes only connect_timeout. Set all three
    // wasi:http request-options directly and check an elapsed deadline while reading.
    let options = RequestOptions::new();
    options
        .set_connect_timeout(Some(Duration::from_secs(5).as_nanos() as u64))
        .map_err(|_| HttpError)?;
    options
        .set_first_byte_timeout(Some(Duration::from_secs(10).as_nanos() as u64))
        .map_err(|_| HttpError)?;
    options
        .set_between_bytes_timeout(Some(Duration::from_secs(5).as_nanos() as u64))
        .map_err(|_| HttpError)?;
    let future = outgoing_handler::handle(request, Some(options)).map_err(|_| HttpError)?;
    let response = match future.get() {
        Some(result) => result.map_err(|_| HttpError)?,
        None => {
            future.subscribe().block();
            future.get().ok_or(HttpError)?.map_err(|_| HttpError)?
        }
    }
    .map_err(|_| HttpError)?;
    if !(200..300).contains(&response.status()) {
        return Err(HttpError);
    }
    let incoming = response.consume().map_err(|_| HttpError)?;
    let stream = incoming.stream().map_err(|_| HttpError)?;
    let mut bytes = Vec::new();
    loop {
        if started.elapsed() >= Duration::from_secs(20) {
            return Err(HttpError);
        }
        let read_len = (limit + 1 - bytes.len()).min(8192) as u64;
        match stream.blocking_read(read_len) {
            Ok(chunk) => {
                bytes.extend_from_slice(&chunk);
                if bytes.len() > limit {
                    return Err(HttpError);
                }
            }
            Err(StreamError::Closed) => return Ok(bytes),
            Err(_) => return Err(HttpError),
        }
    }
}

fn browser_user_agent() -> &'static str {
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
}

fn run() -> Result<(), &'static str> {
    let mut args = std::env::args().skip(1).peekable();
    if args.peek().is_some_and(|arg| arg == "hash-beneficiary") {
        args.next();
        let salt = args.next().ok_or("hash-beneficiary requires SALT")?;
        let delivery_type = args.next().unwrap_or_else(|| "by_phone".into());
        if args.next().is_some() {
            return Err("unexpected argument");
        }
        let mut beneficiary = String::new();
        io::stdin()
            .read_to_string(&mut beneficiary)
            .map_err(|_| "stdin read failed")?;
        let hash =
            beneficiary_hash(&salt, &beneficiary, &delivery_type).ok_or("invalid beneficiary")?;
        println!("{hash}");
        io::stdout().flush().map_err(|_| "stdout write failed")?;
        return Ok(());
    }
    let mut input_file = None;
    let mut blob_file = None;
    let mut live = false;
    while let Some(flag) = args.next() {
        match flag.as_str() {
            "--input" => input_file = Some(args.next().ok_or("--input requires PATH")?),
            "--blob-file" => blob_file = Some(args.next().ok_or("--blob-file requires PATH")?),
            "--live" => live = true,
            _ => return Err("unknown argument"),
        }
    }
    if blob_file.is_some() && !live {
        return Err("--blob-file requires --live");
    }
    let input = if let Some(path) = input_file {
        std::fs::read_to_string(path).map_err(|_| "input read failed")?
    } else {
        let mut input = String::new();
        io::stdin()
            .read_to_string(&mut input)
            .map_err(|_| "stdin read failed")?;
        input
    };
    let job: Job = serde_json::from_str(&input).map_err(|_| "invalid job JSON")?;
    let config = Config::from_env();
    let result = if let Some(path) = blob_file {
        match std::fs::read(path) {
            Ok(blob) => verify(&job, Some(&blob), &config, &HttpClient),
            Err(_) => Output::failure(&job, "blob_fetch_fail"),
        }
    } else {
        verify(&job, None, &config, &HttpClient)
    };
    let output = serde_json::to_string(&result).map_err(|_| "output JSON failed")?;
    println!("{output}");
    io::stdout().flush().map_err(|_| "stdout write failed")?;
    Ok(())
}

fn main() {
    if let Err(error) = run() {
        eprintln!("{error}");
        std::process::exit(1);
    }
}
