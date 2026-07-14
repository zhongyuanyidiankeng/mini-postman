import type {
  AuthType,
  HttpRequest,
  KeyValue,
  RequestAuthConfig,
} from "../types";

const AUTH_TYPES: AuthType[] = [
  "none",
  "inherit",
  "basic",
  "bearer",
  "apikey",
];

export function normalizeAuthType(value: unknown): AuthType {
  if (value === "noauth") return "none";
  return AUTH_TYPES.includes(value as AuthType) ? (value as AuthType) : "none";
}

export function parseAuthConfig(value: unknown): RequestAuthConfig {
  if (typeof value !== "string") {
    return value && typeof value === "object"
      ? (value as RequestAuthConfig)
      : {};
  }

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object"
      ? (parsed as RequestAuthConfig)
      : {};
  } catch {
    return {};
  }
}

export function defaultAuthConfig(type: AuthType): RequestAuthConfig {
  switch (type) {
    case "basic":
      return { username: "", password: "" };
    case "bearer":
      return { token: "" };
    case "apikey":
      return { key: "", value: "", addTo: "header" };
    default:
      return {};
  }
}

function encodeBasicAuth(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function upsertRow(
  rows: KeyValue[],
  key: string,
  value: string,
  caseInsensitive = false
): KeyValue[] {
  if (!key.trim()) return rows;
  const normalize = (candidate: string) =>
    caseInsensitive ? candidate.toLowerCase() : candidate;
  const index = rows.findIndex((row) => normalize(row.key) === normalize(key));

  if (index === -1) {
    return [...rows, { key, value, enabled: true }];
  }

  return rows.map((row, rowIndex) =>
    rowIndex === index ? { ...row, key, value, enabled: true } : row
  );
}

export function applyRequestAuth(
  request: HttpRequest,
  authType: AuthType,
  config: RequestAuthConfig
): HttpRequest {
  if (authType === "basic") {
    const credentials = `${config.username || ""}:${config.password || ""}`;
    return {
      ...request,
      headers: upsertRow(
        request.headers,
        "Authorization",
        `Basic ${encodeBasicAuth(credentials)}`,
        true
      ),
    };
  }

  if (authType === "bearer" && config.token?.trim()) {
    return {
      ...request,
      headers: upsertRow(
        request.headers,
        "Authorization",
        `Bearer ${config.token.trim()}`,
        true
      ),
    };
  }

  if (authType === "apikey" && config.key?.trim()) {
    const target = config.addTo === "queryParams" ? "queryParams" : "headers";
    return {
      ...request,
      [target]: upsertRow(
        request[target],
        config.key.trim(),
        config.value || "",
        target === "headers"
      ),
    };
  }

  return request;
}
