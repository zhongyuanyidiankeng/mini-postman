import { invoke } from "@tauri-apps/api/core";
import type { HttpRequest, HttpResponse } from "../types";

export async function sendRequest(request: HttpRequest): Promise<HttpResponse> {
  return invoke<HttpResponse>("send_http_request", { request });
}

export async function generateCurl(request: HttpRequest): Promise<string> {
  return invoke<string>("generate_curl", { request });
}
