use reqwest::header::{HeaderMap, HeaderName, HeaderValue};
use serde::{Deserialize, Serialize};
use std::time::Instant;

const MAX_RESPONSE_BODY_BYTES: usize = 5 * 1024 * 1024;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpRequestPayload {
    pub method: String,
    pub url: String,
    #[serde(default)]
    pub headers: Vec<KeyValue>,
    #[serde(default)]
    pub query_params: Vec<KeyValue>,
    #[serde(default = "default_body_mode")]
    pub body_mode: String,
    #[serde(default)]
    pub body_content: String,
    pub timeout_ms: Option<u64>,
}

fn default_body_mode() -> String {
    "none".to_string()
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct KeyValue {
    pub key: String,
    pub value: String,
    #[serde(default = "default_true")]
    pub enabled: bool,
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpResponsePayload {
    pub ok: bool,
    pub status: u16,
    pub status_text: String,
    pub duration_ms: u64,
    pub headers: Vec<KeyValue>,
    pub body: String,
    pub body_size: usize,
    pub body_truncated: bool,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn send_http_request(request: HttpRequestPayload) -> Result<HttpResponsePayload, String> {
    let timeout_ms = request.timeout_ms.unwrap_or(30000);
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_millis(timeout_ms))
        .build()
        .map_err(|e| e.to_string())?;

    // Build URL with query params
    let mut url = reqwest::Url::parse(&request.url).map_err(|e| format!("Invalid URL: {}", e))?;

    if url.scheme() != "http" && url.scheme() != "https" {
        return Err("Only http and https URLs are supported".to_string());
    }

    for param in &request.query_params {
        if param.enabled && !param.key.is_empty() {
            url.query_pairs_mut().append_pair(&param.key, &param.value);
        }
    }

    // Build method
    let method = request
        .method
        .to_uppercase()
        .parse::<reqwest::Method>()
        .map_err(|e| format!("Invalid method: {}", e))?;

    // Build headers
    let mut header_map = HeaderMap::new();
    for h in &request.headers {
        if h.enabled && !h.key.is_empty() {
            if let (Ok(name), Ok(value)) = (
                HeaderName::from_bytes(h.key.as_bytes()),
                HeaderValue::from_str(&h.value),
            ) {
                header_map.insert(name, value);
            }
        }
    }

    // Build request
    let mut req_builder = client
        .request(method.clone(), url)
        .headers(header_map.clone());

    // Add body (not for GET/HEAD)
    if method != reqwest::Method::GET && method != reqwest::Method::HEAD {
        match request.body_mode.as_str() {
            "json" => {
                if !request.body_content.is_empty() {
                    serde_json::from_str::<serde_json::Value>(&request.body_content)
                        .map_err(|e| format!("Invalid JSON body: {}", e))?;
                    if !header_map.contains_key("content-type") {
                        req_builder = req_builder.header("Content-Type", "application/json");
                    }
                    req_builder = req_builder.body(request.body_content.clone());
                }
            }
            "raw" => {
                if !request.body_content.is_empty() {
                    req_builder = req_builder.body(request.body_content.clone());
                }
            }
            "form" => {
                if !request.body_content.is_empty() {
                    let form_items: Vec<KeyValue> = serde_json::from_str(&request.body_content)
                        .map_err(|e| format!("Invalid form data: {}", e))?;
                    let mut params = Vec::new();
                    for item in &form_items {
                        if item.enabled && !item.key.is_empty() {
                            params.push((item.key.clone(), item.value.clone()));
                        }
                    }
                    req_builder = req_builder.form(&params);
                }
            }
            _ => {} // "none"
        }
    }

    // Send and measure
    let start = Instant::now();
    match req_builder.send().await {
        Ok(mut response) => {
            let status = response.status().as_u16();
            let status_text = response
                .status()
                .canonical_reason()
                .unwrap_or("")
                .to_string();
            let headers: Vec<KeyValue> = response
                .headers()
                .iter()
                .map(|(k, v)| KeyValue {
                    key: k.to_string(),
                    value: v.to_str().unwrap_or("").to_string(),
                    enabled: true,
                })
                .collect();

            let mut body_bytes = Vec::new();
            let mut body_truncated = false;
            while let Some(chunk) = response.chunk().await.map_err(|e| e.to_string())? {
                let remaining = MAX_RESPONSE_BODY_BYTES.saturating_sub(body_bytes.len());
                if chunk.len() > remaining {
                    body_bytes.extend_from_slice(&chunk[..remaining]);
                    body_truncated = true;
                    break;
                }
                body_bytes.extend_from_slice(&chunk);
            }
            let mut body = String::from_utf8_lossy(&body_bytes).into_owned();
            if body.len() > MAX_RESPONSE_BODY_BYTES {
                body_truncated = true;
                let mut end = MAX_RESPONSE_BODY_BYTES;
                while !body.is_char_boundary(end) {
                    end -= 1;
                }
                body.truncate(end);
            }
            let body_size = body.len();
            let duration_ms = start.elapsed().as_millis() as u64;

            Ok(HttpResponsePayload {
                ok: true,
                status,
                status_text,
                duration_ms,
                headers,
                body,
                body_size,
                body_truncated,
                error: None,
            })
        }
        Err(e) => {
            let duration_ms = start.elapsed().as_millis() as u64;
            let error_msg = if e.is_timeout() {
                format!("Request timed out after {}ms", timeout_ms)
            } else if e.is_connect() {
                format!("Connection failed: {}", e)
            } else {
                e.to_string()
            };

            Ok(HttpResponsePayload {
                ok: false,
                status: 0,
                status_text: String::new(),
                duration_ms,
                headers: vec![],
                body: String::new(),
                body_size: 0,
                body_truncated: false,
                error: Some(error_msg),
            })
        }
    }
}
