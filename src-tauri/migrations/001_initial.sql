-- Workspaces
CREATE TABLE IF NOT EXISTS workspaces (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Collections
CREATE TABLE IF NOT EXISTS collections (
  id           TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  description  TEXT DEFAULT '',
  auth_type    TEXT DEFAULT 'noauth',
  auth_config  TEXT DEFAULT '{}',
  sort_order   INTEGER DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Collection items (folders + requests, self-referencing tree)
CREATE TABLE IF NOT EXISTS collection_items (
  id            TEXT PRIMARY KEY,
  collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  parent_id     TEXT REFERENCES collection_items(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK(type IN ('folder', 'request')),
  name          TEXT NOT NULL,
  sort_order    INTEGER DEFAULT 0,
  method        TEXT DEFAULT 'GET',
  url           TEXT DEFAULT '',
  query_params  TEXT DEFAULT '[]',
  headers       TEXT DEFAULT '[]',
  body_mode     TEXT DEFAULT 'none',
  body_content  TEXT DEFAULT '',
  auth_type     TEXT DEFAULT 'inherit',
  auth_config   TEXT DEFAULT '{}',
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Environments
CREATE TABLE IF NOT EXISTS environments (
  id           TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  sort_order   INTEGER DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Environment variables
CREATE TABLE IF NOT EXISTS environment_variables (
  id             TEXT PRIMARY KEY,
  environment_id TEXT NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  key            TEXT NOT NULL,
  value          TEXT DEFAULT '',
  enabled        INTEGER DEFAULT 1,
  is_secret      INTEGER DEFAULT 0,
  sort_order     INTEGER DEFAULT 0
);

-- Collection variables
CREATE TABLE IF NOT EXISTS collection_variables (
  id            TEXT PRIMARY KEY,
  collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  key           TEXT NOT NULL,
  value         TEXT DEFAULT '',
  enabled       INTEGER DEFAULT 1,
  sort_order    INTEGER DEFAULT 0
);

-- Global variables
CREATE TABLE IF NOT EXISTS global_variables (
  id           TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  key          TEXT NOT NULL,
  value        TEXT DEFAULT '',
  enabled      INTEGER DEFAULT 1,
  sort_order   INTEGER DEFAULT 0
);

-- Request history
CREATE TABLE IF NOT EXISTS request_history (
  id            TEXT PRIMARY KEY,
  workspace_id  TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  collection_id TEXT REFERENCES collections(id) ON DELETE SET NULL,
  item_id       TEXT REFERENCES collection_items(id) ON DELETE SET NULL,
  method        TEXT NOT NULL,
  url           TEXT NOT NULL,
  request_data  TEXT NOT NULL,
  response_data TEXT,
  status        INTEGER,
  duration_ms   INTEGER,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- App settings
CREATE TABLE IF NOT EXISTS app_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
