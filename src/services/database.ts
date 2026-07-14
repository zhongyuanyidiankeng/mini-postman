import Database from "@tauri-apps/plugin-sql";
import type {
  Workspace,
  Collection,
  CollectionItem,
  Environment,
  EnvironmentVariable,
  RequestHistoryItem,
  GlobalVariable,
  CollectionVariable,
} from "../types";

export const DEFAULT_WORKSPACE_ID = "default-workspace";
const COLLECTION_NAME_EXISTS_ERROR = "COLLECTION_NAME_EXISTS";
export const MAX_HISTORY_ITEMS_PER_WORKSPACE = 200;

let db: Database | null = null;
let dbPromise: Promise<Database> | null = null;

export async function getDb(): Promise<Database> {
  if (db) {
    return db;
  }
  if (!dbPromise) {
    dbPromise = Database.load("sqlite:mini_postman.db").then((loaded) => {
      db = loaded;
      return loaded;
    });
  }
  return dbPromise;
}

export async function initDatabase(): Promise<void> {
  const database = await getDb();
  await database.execute(
    "INSERT OR IGNORE INTO workspaces (id, name, description) VALUES ($1, $2, $3)",
    [DEFAULT_WORKSPACE_ID, "Default Workspace", ""]
  );
}

// ─── Workspace CRUD ───
export async function listWorkspaces(): Promise<Workspace[]> {
  const d = await getDb();
  return d.select<Workspace[]>(
    "SELECT * FROM workspaces ORDER BY created_at"
  );
}

export async function createWorkspace(name: string): Promise<string> {
  const d = await getDb();
  const id = crypto.randomUUID();
  await d.execute(
    "INSERT INTO workspaces (id, name) VALUES ($1, $2)",
    [id, name]
  );
  return id;
}

export async function updateWorkspace(id: string, name: string): Promise<void> {
  const d = await getDb();
  await d.execute(
    "UPDATE workspaces SET name = $1, updated_at = datetime('now') WHERE id = $2",
    [name, id]
  );
}

export async function deleteWorkspace(id: string): Promise<void> {
  const d = await getDb();
  await d.execute("DELETE FROM workspaces WHERE id = $1", [id]);
}

// ─── Collection CRUD ───
export async function listCollections(workspaceId: string): Promise<Collection[]> {
  const d = await getDb();
  return d.select(
    "SELECT * FROM collections WHERE workspace_id = $1 ORDER BY sort_order, name",
    [workspaceId]
  );
}

export async function getCollection(id: string): Promise<Collection | null> {
  const d = await getDb();
  const rows = await d.select<Collection[]>(
    "SELECT * FROM collections WHERE id = $1",
    [id]
  );
  return rows[0] || null;
}

async function assertCollectionNameAvailable(
  database: Database,
  workspaceId: string,
  name: string,
  excludeId?: string
): Promise<void> {
  const rows = excludeId
    ? await database.select<{ id: string }[]>(
        `SELECT id FROM collections
         WHERE workspace_id = $1
           AND lower(trim(name)) = lower(trim($2))
           AND id <> $3
         LIMIT 1`,
        [workspaceId, name, excludeId]
      )
    : await database.select<{ id: string }[]>(
        `SELECT id FROM collections
         WHERE workspace_id = $1
           AND lower(trim(name)) = lower(trim($2))
         LIMIT 1`,
        [workspaceId, name]
      );

  if (rows.length > 0) {
    throw new Error(COLLECTION_NAME_EXISTS_ERROR);
  }
}

export function isDuplicateCollectionNameError(error: unknown): boolean {
  return String(error).includes(COLLECTION_NAME_EXISTS_ERROR);
}

export async function createCollection(workspaceId: string, name: string): Promise<string> {
  const d = await getDb();
  await assertCollectionNameAvailable(d, workspaceId, name);
  const id = crypto.randomUUID();
  await d.execute(
    "INSERT INTO collections (id, workspace_id, name) VALUES ($1, $2, $3)",
    [id, workspaceId, name]
  );
  return id;
}

export async function updateCollection(id: string, updates: Partial<Collection>): Promise<void> {
  const d = await getDb();
  if (typeof updates.name === "string") {
    const current = await getCollection(id);
    if (current) {
      await assertCollectionNameAvailable(
        d,
        current.workspace_id,
        updates.name,
        id
      );
    }
  }
  const sets: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;
  for (const [k, v] of Object.entries(updates)) {
    if (k !== "id") {
      sets.push(`${k} = $${idx}`);
      vals.push(v);
      idx++;
    }
  }
  sets.push(`updated_at = datetime('now')`);
  vals.push(id);
  await d.execute(
    `UPDATE collections SET ${sets.join(", ")} WHERE id = $${idx}`,
    vals
  );
}

export async function deleteCollection(id: string): Promise<void> {
  const d = await getDb();
  await d.execute("DELETE FROM collections WHERE id = $1", [id]);
}

// ─── Collection Item CRUD ───
export async function listCollectionItems(collectionId: string): Promise<CollectionItem[]> {
  const d = await getDb();
  return d.select(
    "SELECT * FROM collection_items WHERE collection_id = $1 ORDER BY sort_order, name",
    [collectionId]
  );
}

export async function getCollectionItem(id: string): Promise<CollectionItem | null> {
  const d = await getDb();
  const rows = await d.select<CollectionItem[]>(
    "SELECT * FROM collection_items WHERE id = $1",
    [id]
  );
  return rows[0] || null;
}

export async function createCollectionItem(
  item: Partial<CollectionItem> & { collection_id: string; type: string; name: string }
): Promise<string> {
  const d = await getDb();
  const id = crypto.randomUUID();
  await d.execute(
    `INSERT INTO collection_items (id, collection_id, parent_id, type, name, method, url, query_params, headers, body_mode, body_content, auth_type, auth_config, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
    [
      id,
      item.collection_id,
      item.parent_id || null,
      item.type,
      item.name,
      item.method || "GET",
      item.url || "",
      item.query_params || "[]",
      item.headers || "[]",
      item.body_mode || "none",
      item.body_content || "",
      item.auth_type || "inherit",
      item.auth_config || "{}",
      item.sort_order || 0,
    ]
  );
  return id;
}

export async function updateCollectionItem(
  id: string,
  updates: Partial<CollectionItem>
): Promise<void> {
  const d = await getDb();
  const sets: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;
  for (const [k, v] of Object.entries(updates)) {
    if (k !== "id" && k !== "created_at") {
      sets.push(`${k} = $${idx}`);
      vals.push(v);
      idx++;
    }
  }
  if (sets.length === 0) return;
  sets.push(`updated_at = datetime('now')`);
  vals.push(id);
  await d.execute(
    `UPDATE collection_items SET ${sets.join(", ")} WHERE id = $${idx}`,
    vals
  );
}

export async function deleteCollectionItem(id: string): Promise<void> {
  const d = await getDb();
  await d.execute("DELETE FROM collection_items WHERE id = $1", [id]);
}

// ─── Environment CRUD ───
export async function listEnvironments(workspaceId: string): Promise<Environment[]> {
  const d = await getDb();
  return d.select(
    "SELECT * FROM environments WHERE workspace_id = $1 ORDER BY sort_order, name",
    [workspaceId]
  );
}

export async function createEnvironment(workspaceId: string, name: string): Promise<string> {
  const d = await getDb();
  const id = crypto.randomUUID();
  await d.execute(
    "INSERT INTO environments (id, workspace_id, name) VALUES ($1, $2, $3)",
    [id, workspaceId, name]
  );
  return id;
}

export async function deleteEnvironment(id: string): Promise<void> {
  const d = await getDb();
  await d.execute("DELETE FROM environments WHERE id = $1", [id]);
}

export async function listEnvVariables(envId: string): Promise<EnvironmentVariable[]> {
  const d = await getDb();
  return d.select(
    "SELECT * FROM environment_variables WHERE environment_id = $1 ORDER BY sort_order",
    [envId]
  );
}

export async function upsertEnvVariable(v: EnvironmentVariable): Promise<void> {
  const d = await getDb();
  await d.execute(
    `INSERT INTO environment_variables (id, environment_id, key, value, enabled, is_secret, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT(id) DO UPDATE SET key=$3, value=$4, enabled=$5, is_secret=$6, sort_order=$7`,
    [v.id, v.environment_id, v.key, v.value, v.enabled, v.is_secret, v.sort_order]
  );
}

export async function deleteEnvVariable(id: string): Promise<void> {
  const d = await getDb();
  await d.execute("DELETE FROM environment_variables WHERE id = $1", [id]);
}

// ─── Global Variables ───
export async function listGlobalVariables(workspaceId: string): Promise<GlobalVariable[]> {
  const d = await getDb();
  return d.select(
    "SELECT * FROM global_variables WHERE workspace_id = $1 ORDER BY sort_order",
    [workspaceId]
  );
}

export async function upsertGlobalVariable(v: GlobalVariable): Promise<void> {
  const d = await getDb();
  await d.execute(
    `INSERT INTO global_variables (id, workspace_id, key, value, enabled, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT(id) DO UPDATE SET key=$3, value=$4, enabled=$5, sort_order=$6`,
    [v.id, v.workspace_id, v.key, v.value, v.enabled, v.sort_order]
  );
}

export async function deleteGlobalVariable(id: string): Promise<void> {
  const d = await getDb();
  await d.execute("DELETE FROM global_variables WHERE id = $1", [id]);
}

// ─── Collection Variables ───
export async function listCollectionVariables(collectionId: string): Promise<CollectionVariable[]> {
  const d = await getDb();
  return d.select(
    "SELECT * FROM collection_variables WHERE collection_id = $1 ORDER BY sort_order",
    [collectionId]
  );
}

export async function upsertCollectionVariable(
  v: CollectionVariable
): Promise<void> {
  const d = await getDb();
  await d.execute(
    `INSERT INTO collection_variables (id, collection_id, key, value, enabled, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT(id) DO UPDATE SET key=$3, value=$4, enabled=$5, sort_order=$6`,
    [v.id, v.collection_id, v.key, v.value, v.enabled, v.sort_order]
  );
}

export async function deleteCollectionVariable(id: string): Promise<void> {
  const d = await getDb();
  await d.execute("DELETE FROM collection_variables WHERE id = $1", [id]);
}

// ─── History ───
export async function addHistory(item: Omit<RequestHistoryItem, "created_at">): Promise<void> {
  const d = await getDb();
  await d.execute(
    `INSERT INTO request_history (id, workspace_id, collection_id, item_id, method, url, request_data, response_data, status, duration_ms)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      item.id,
      item.workspace_id,
      item.collection_id,
      item.item_id,
      item.method,
      item.url,
      item.request_data,
      item.response_data,
      item.status,
      item.duration_ms,
    ]
  );
  await d.execute(
    `DELETE FROM request_history
     WHERE workspace_id = $1
       AND id NOT IN (
         SELECT id FROM request_history
         WHERE workspace_id = $1
         ORDER BY created_at DESC, rowid DESC
         LIMIT $2
       )`,
    [item.workspace_id, MAX_HISTORY_ITEMS_PER_WORKSPACE]
  );
}

export async function listHistory(workspaceId: string, limit = 100): Promise<RequestHistoryItem[]> {
  const d = await getDb();
  return d.select(
    "SELECT * FROM request_history WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT $2",
    [workspaceId, limit]
  );
}

export async function clearHistory(workspaceId: string): Promise<void> {
  const d = await getDb();
  await d.execute("DELETE FROM request_history WHERE workspace_id = $1", [workspaceId]);
}

// ─── Settings ───
export async function getSetting(key: string): Promise<string | null> {
  const d = await getDb();
  const rows = await d.select<{ value: string }[]>(
    "SELECT value FROM app_settings WHERE key = $1",
    [key]
  );
  return rows[0]?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const d = await getDb();
  await d.execute(
    "INSERT INTO app_settings (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value = $2",
    [key, value]
  );
}
