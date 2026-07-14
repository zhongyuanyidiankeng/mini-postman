// ─── Workspace ───
export interface Workspace {
  id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

// ─── Collection ───
export interface Collection {
  id: string;
  workspace_id: string;
  name: string;
  description: string;
  auth_type: string;
  auth_config: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// ─── Collection Item (folder or request) ───
export interface CollectionItem {
  id: string;
  collection_id: string;
  parent_id: string | null;
  type: "folder" | "request";
  name: string;
  sort_order: number;
  method: string;
  url: string;
  query_params: string; // JSON array of KeyValue
  headers: string;      // JSON array of KeyValue
  body_mode: string;
  body_content: string;
  auth_type: string;
  auth_config: string;
  created_at: string;
  updated_at: string;
}

// ─── Key-Value pair ───
export interface KeyValue {
  key: string;
  value: string;
  enabled: boolean;
  description?: string;
}

export type AuthType = "none" | "inherit" | "basic" | "bearer" | "apikey";

export interface RequestAuthConfig {
  username?: string;
  password?: string;
  token?: string;
  key?: string;
  value?: string;
  addTo?: "header" | "queryParams";
}

export type BodyMode = "none" | "json" | "raw" | "form";

// ─── HTTP Request ───
export interface HttpRequest {
  method: string;
  url: string;
  headers: KeyValue[];
  queryParams: KeyValue[];
  bodyMode: BodyMode;
  bodyContent: string;
  authType: AuthType;
  authConfig: RequestAuthConfig;
  timeoutMs?: number;
}

// ─── HTTP Response ───
export interface HttpResponse {
  ok: boolean;
  status: number;
  statusText: string;
  durationMs: number;
  headers: KeyValue[];
  body: string;
  bodySize: number;
  bodyTruncated: boolean;
  error: string | null;
}

// ─── Environment ───
export interface Environment {
  id: string;
  workspace_id: string;
  name: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface EnvironmentVariable {
  id: string;
  environment_id: string;
  key: string;
  value: string;
  enabled: number; // SQLite boolean
  is_secret: number;
  sort_order: number;
}

// ─── Request History ───
export interface RequestHistoryItem {
  id: string;
  workspace_id: string;
  collection_id: string | null;
  item_id: string | null;
  method: string;
  url: string;
  request_data: string; // JSON
  response_data: string | null; // JSON
  status: number | null;
  duration_ms: number | null;
  created_at: string;
}

// ─── Tab ───
export interface TabItem {
  id: string;
  title: string;
  itemId: string | null; // linked collection_item id, null for unsaved
  isDirty: boolean;
  source: "request" | "history";
  request: HttpRequest;
  response: HttpResponse | null;
  collectionId: string | null;
  workspaceId: string | null;
}

// ─── Tree Node (for collection tree rendering) ───
export interface TreeNode {
  id: string;
  name: string;
  type: "collection" | "folder" | "request";
  method?: string;
  children: TreeNode[];
  collectionId: string;
  parentId: string | null;
  sortOrder: number;
}

// ─── Auth Config ───
export interface BasicAuthConfig {
  username: string;
  password: string;
}

export interface BearerAuthConfig {
  token: string;
}

export interface ApiKeyAuthConfig {
  key: string;
  value: string;
  addTo: "header" | "queryParams";
}

// ─── Global Variable ───
export interface GlobalVariable {
  id: string;
  workspace_id: string;
  key: string;
  value: string;
  enabled: number;
  sort_order: number;
}

// ─── Collection Variable ───
export interface CollectionVariable {
  id: string;
  collection_id: string;
  key: string;
  value: string;
  enabled: number;
  sort_order: number;
}
