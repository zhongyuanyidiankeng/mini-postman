use super::http::KeyValue;
use serde::Deserialize;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CurlRequest {
    pub method: String,
    pub url: String,
    #[serde(default)]
    pub headers: Vec<KeyValue>,
    #[serde(default)]
    pub query_params: Vec<KeyValue>,
    #[serde(default)]
    pub body_mode: String,
    #[serde(default)]
    pub body_content: String,
}

#[cfg(target_os = "windows")]
fn shell_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "''"))
}

#[cfg(not(target_os = "windows"))]
fn shell_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\\''"))
}

#[cfg(target_os = "windows")]
const CURL_COMMAND: &str = "curl.exe";
#[cfg(not(target_os = "windows"))]
const CURL_COMMAND: &str = "curl";

#[cfg(target_os = "windows")]
const LINE_CONTINUATION: &str = " `\n  ";
#[cfg(not(target_os = "windows"))]
const LINE_CONTINUATION: &str = " \\\n  ";

#[tauri::command]
pub fn generate_curl(request: CurlRequest) -> Result<String, String> {
    let mut parts: Vec<String> = vec![CURL_COMMAND.to_string()];

    // Method
    let method_upper = request.method.to_uppercase();
    if method_upper != "GET" {
        parts.push("-X".to_string());
        parts.push(shell_quote(&method_upper));
    }

    // URL with query params
    let mut url = reqwest::Url::parse(&request.url).map_err(|e| format!("Invalid URL: {}", e))?;
    for param in &request.query_params {
        if param.enabled && !param.key.is_empty() {
            url.query_pairs_mut().append_pair(&param.key, &param.value);
        }
    }
    parts.push(shell_quote(url.as_str()));

    // Headers
    for h in &request.headers {
        if h.enabled && !h.key.is_empty() {
            parts.push("-H".to_string());
            parts.push(shell_quote(&format!("{}: {}", h.key, h.value)));
        }
    }

    // Body
    if method_upper != "GET" && method_upper != "HEAD" && request.body_mode != "none" {
        match request.body_mode.as_str() {
            "json" => {
                if !request.body_content.is_empty() {
                    parts.push("-H".to_string());
                    parts.push(shell_quote("Content-Type: application/json"));
                    parts.push("-d".to_string());
                    parts.push(shell_quote(&request.body_content));
                }
            }
            "raw" => {
                if !request.body_content.is_empty() {
                    parts.push("-d".to_string());
                    parts.push(shell_quote(&request.body_content));
                }
            }
            "form" => {
                if !request.body_content.is_empty() {
                    let items = serde_json::from_str::<Vec<KeyValue>>(&request.body_content)
                        .map_err(|e| format!("Invalid form data: {}", e))?;
                    for item in &items {
                        if item.enabled && !item.key.is_empty() {
                            parts.push("--data-urlencode".to_string());
                            parts.push(shell_quote(&format!("{}={}", item.key, item.value)));
                        }
                    }
                }
            }
            _ => {}
        }
    }

    Ok(parts.join(LINE_CONTINUATION))
}

#[cfg(test)]
mod tests {
    use super::shell_quote;

    #[cfg(target_os = "windows")]
    #[test]
    fn quotes_powershell_arguments() {
        assert_eq!(shell_quote("a'b"), "'a''b'");
    }

    #[cfg(not(target_os = "windows"))]
    #[test]
    fn quotes_posix_arguments() {
        assert_eq!(shell_quote("a'b"), "'a'\\''b'");
    }
}
