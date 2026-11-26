use reqwest::{redirect::Policy, Client, Url};
use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use std::sync::OnceLock;
use std::time::Duration;

const MAX_JSON_BYTES: usize = 4 * 1024 * 1024;
static CLIENT: OnceLock<Client> = OnceLock::new();

fn local_endpoint(endpoint: &str, method: &str) -> Result<Url, &'static str> {
    let invalid = "Use localhost or a literal local IP with a supported AI endpoint.";
    if endpoint.len() > 512 || endpoint.bytes().any(|b| b.is_ascii_control() || b == b'\\') {
        return Err(invalid);
    }
    let (_, tail) = endpoint.split_once("://").ok_or(invalid)?;
    let (authority, path) = tail.split_once('/').ok_or(invalid)?;
    let (host, port) = authority.rsplit_once(':').ok_or(invalid)?;
    if !port.bytes().all(|b| b.is_ascii_digit())
        || port.parse::<u16>().ok().filter(|p| *p > 0).is_none()
    {
        return Err(invalid);
    }

    let local = if host == "localhost" {
        true
    } else if let Some(ip) = host.strip_prefix('[').and_then(|s| s.strip_suffix(']')) {
        matches!(ip.parse(), Ok(IpAddr::V6(address)) if address.is_loopback() || (address.segments()[0] & 0xfe00) == 0xfc00)
    } else {
        matches!(host.parse(), Ok(IpAddr::V4(address)) if address.is_loopback() || address.is_private())
    };
    if !local
        || !matches!(
            (method, path),
            ("GET", "api/tags" | "v1/models")
                | ("POST", "api/show" | "api/chat" | "v1/chat/completions")
        )
    {
        return Err(invalid);
    }

    let url = Url::parse(endpoint).map_err(|_| invalid)?;
    if !matches!(url.scheme(), "http" | "https")
        || !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
    {
        return Err(invalid);
    }
    Ok(url)
}

#[tauri::command]
pub async fn local_ai_json(
    window: tauri::WebviewWindow,
    endpoint: String,
    method: String,
    body: Option<String>,
) -> Result<String, String> {
    if window.label() != "main" {
        return Err("Local AI is only available in the editor.".into());
    }
    let url = local_endpoint(&endpoint, &method)?;
    if (method == "GET" && body.is_some())
        || (method == "POST"
            && body.as_ref().is_none_or(|value| {
                value.len() > MAX_JSON_BYTES
                    || serde_json::from_str::<serde_json::Value>(value).is_err()
            }))
    {
        return Err("Invalid local AI request body.".into());
    }

    let client = match CLIENT.get() {
        Some(client) => client,
        None => {
            let client = Client::builder()
                .no_proxy()
                .redirect(Policy::none())
                .resolve("localhost", SocketAddr::from((Ipv4Addr::LOCALHOST, 0)))
                .connect_timeout(Duration::from_secs(8))
                .timeout(Duration::from_secs(120))
                .build()
                .map_err(|_| "Could not start local AI transport.")?;
            CLIENT.get_or_init(|| client)
        }
    };
    let mut request = if method == "GET" {
        client.get(url)
    } else {
        client.post(url)
    };
    if let Some(body) = body {
        request = request
            .header("Content-Type", "application/json")
            .body(body);
    }
    let mut response = request
        .send()
        .await
        .map_err(|_| "Could not reach the local AI server.")?;
    if !response.status().is_success() {
        return Err(format!(
            "Local AI returned HTTP {}.",
            response.status().as_u16()
        ));
    }
    if response
        .content_length()
        .is_some_and(|len| len > MAX_JSON_BYTES as u64)
    {
        return Err("Local AI response is too large.".into());
    }
    let mut bytes = Vec::new();
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|_| "Could not read the local AI response.")?
    {
        if bytes.len().saturating_add(chunk.len()) > MAX_JSON_BYTES {
            return Err("Local AI response is too large.".into());
        }
        bytes.extend_from_slice(&chunk);
    }
    String::from_utf8(bytes).map_err(|_| "Local AI returned invalid UTF-8.".into())
}

#[cfg(test)]
mod tests {
    use super::local_endpoint;

    #[test]
    fn permits_only_explicit_local_endpoints() {
        for endpoint in [
            "http://localhost:11434/api/tags",
            "http://127.0.0.1:11434/api/tags",
            "https://192.168.1.4:1234/v1/models",
            "http://[::1]:11434/api/tags",
        ] {
            assert!(local_endpoint(endpoint, "GET").is_ok(), "{endpoint}");
        }
        for endpoint in [
            "http://example.com:11434/api/tags",
            "http://ollama.local:11434/api/tags",
            "http://127.1:11434/api/tags",
            "http://localhost:0/api/tags",
            "http://localhost:11434/api/tags?next=x",
            "http://localhost:11434/other",
            "http://user@localhost:11434/api/tags",
            "http://169.254.169.254:80/api/tags",
            "file://localhost:11434/api/tags",
        ] {
            assert!(local_endpoint(endpoint, "GET").is_err(), "{endpoint}");
        }
        assert!(local_endpoint("http://localhost:11434/api/chat", "GET").is_err());
    }
}
