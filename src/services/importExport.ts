import type {
  AuthType,
  BodyMode,
  CollectionItem,
  HttpRequest,
  KeyValue,
  RequestAuthConfig,
} from "../types";
import { normalizeAuthType, parseAuthConfig } from "./auth";
import * as db from "./database";
import { normalizeKeyValueRows, parseKeyValueRows } from "../utils/keyValue";
import { HTTP_METHODS } from "../constants/http";

export const MINI_POSTMAN_EXPORT_FORMAT = "mini-postman.collection.v1";

const OPENAPI_METHODS = new Set<string>(
  HTTP_METHODS.map((method) => method.toLowerCase())
);

type PlainObject = Record<string, unknown>;

type ImportItemDraft =
  | {
      type: "folder";
      name: string;
      items: ImportItemDraft[];
    }
  | {
      type: "request";
      name: string;
      request: HttpRequest;
    };

interface ImportCollectionDraft {
  name: string;
  description: string;
  authType: AuthType;
  authConfig: RequestAuthConfig;
  variables: KeyValue[];
  items: ImportItemDraft[];
}

export interface ImportCollectionsResult {
  collectionIds: string[];
  collectionCount: number;
  requestCount: number;
  firstRequestId: string | null;
}

interface ImportItemsResult {
  requestCount: number;
  firstRequestId: string | null;
}

export interface MiniPostmanExport {
  format: typeof MINI_POSTMAN_EXPORT_FORMAT;
  version: 1;
  exportedAt: string;
  collections: Array<{
    name: string;
    description: string;
    authType: AuthType;
    authConfig: RequestAuthConfig;
    variables: KeyValue[];
    items: ExportItem[];
  }>;
}

type ExportItem =
  | {
      type: "folder";
      name: string;
      items: ExportItem[];
    }
  | {
      type: "request";
      name: string;
      request: HttpRequest;
    };

function isPlainObject(value: unknown): value is PlainObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasOwn(object: PlainObject, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function asPlainObject(value: unknown): PlainObject {
  return isPlainObject(value) ? value : {};
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function nonEmptyString(value: unknown, fallback: string): string {
  const text = asString(value).trim();
  return text || fallback;
}

function normalizeBodyMode(value: unknown): BodyMode {
  return value === "json" || value === "raw" || value === "form"
    ? value
    : "none";
}

function jsonParse(value: string): unknown {
  return JSON.parse(value);
}

function parseStructuredText(content: string): unknown {
  const text = content.trim();
  if (!text) {
    throw new Error("IMPORT_CONTENT_EMPTY");
  }

  try {
    return jsonParse(text);
  } catch {
    return parseYaml(text);
  }
}

function parseJsonArrayRows(value: unknown): KeyValue[] {
  if (typeof value === "string") {
    return parseKeyValueRows(value);
  }
  return normalizeKeyValueRows(value);
}

function normalizeRequest(value: unknown): HttpRequest {
  const request = asPlainObject(value);
  return {
    method: nonEmptyString(request.method, "GET").toUpperCase(),
    url: asString(request.url),
    headers: parseJsonArrayRows(request.headers),
    queryParams: parseJsonArrayRows(request.queryParams),
    bodyMode: normalizeBodyMode(request.bodyMode),
    bodyContent: asString(request.bodyContent),
    authType: normalizeAuthType(request.authType || "inherit"),
    authConfig: parseAuthConfig(request.authConfig),
    timeoutMs:
      typeof request.timeoutMs === "number" && request.timeoutMs > 0
        ? request.timeoutMs
        : 30000,
  };
}

function collectionDraftsFromMiniPostman(value: PlainObject): ImportCollectionDraft[] {
  if (value.format !== MINI_POSTMAN_EXPORT_FORMAT || !Array.isArray(value.collections)) {
    throw new Error("UNSUPPORTED_IMPORT_FORMAT");
  }

  return value.collections.map((collection, index) => {
    const source = asPlainObject(collection);
    const authType = normalizeAuthType(source.authType);
    return {
      name: nonEmptyString(source.name, `Imported Collection ${index + 1}`),
      description: asString(source.description),
      authType: authType === "inherit" ? "none" : authType,
      authConfig: parseAuthConfig(source.authConfig),
      variables: normalizeKeyValueRows(source.variables),
      items: importItemsFromExport(source.items),
    };
  });
}

function importItemsFromExport(value: unknown): ImportItemDraft[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item): ImportItemDraft | null => {
      const source = asPlainObject(item);
      const type = source.type;
      const name = nonEmptyString(source.name, "Untitled");

      if (type === "folder") {
        return {
          type: "folder",
          name,
          items: importItemsFromExport(source.items),
        };
      }

      if (type === "request") {
        return {
          type: "request",
          name,
          request: normalizeRequest(source.request),
        };
      }

      return null;
    })
    .filter((item): item is ImportItemDraft => Boolean(item));
}

export async function exportWorkspaceCollections(
  workspaceId: string
): Promise<MiniPostmanExport> {
  const collections = await db.listCollections(workspaceId);
  const exportedCollections = await Promise.all(
    collections.map(async (collection) => {
      const [items, variables] = await Promise.all([
        db.listCollectionItems(collection.id),
        db.listCollectionVariables(collection.id),
      ]);

      return {
        name: collection.name,
        description: collection.description || "",
        authType: normalizeAuthType(collection.auth_type),
        authConfig: parseAuthConfig(collection.auth_config),
        variables: variables.map((variable) => ({
          key: variable.key,
          value: variable.value,
          enabled: Boolean(variable.enabled),
        })),
        items: exportItems(items, null),
      };
    })
  );

  return {
    format: MINI_POSTMAN_EXPORT_FORMAT,
    version: 1,
    exportedAt: new Date().toISOString(),
    collections: exportedCollections,
  };
}

function exportItems(items: CollectionItem[], parentId: string | null): ExportItem[] {
  return items
    .filter((item) => item.parent_id === parentId)
    .map((item): ExportItem => {
      if (item.type === "folder") {
        return {
          type: "folder",
          name: item.name,
          items: exportItems(items, item.id),
        };
      }

      return {
        type: "request",
        name: item.name,
        request: {
          method: item.method || "GET",
          url: item.url || "",
          headers: parseKeyValueRows(item.headers),
          queryParams: parseKeyValueRows(item.query_params),
          bodyMode: normalizeBodyMode(item.body_mode),
          bodyContent: item.body_content || "",
          authType: normalizeAuthType(item.auth_type || "inherit"),
          authConfig: parseAuthConfig(item.auth_config),
          timeoutMs: 30000,
        },
      };
    });
}

export async function importCollectionsFromText(
  workspaceId: string,
  content: string
): Promise<ImportCollectionsResult> {
  const parsed = parseStructuredText(content);
  const root = asPlainObject(parsed);
  const drafts =
    root.format === MINI_POSTMAN_EXPORT_FORMAT
      ? collectionDraftsFromMiniPostman(root)
      : [collectionDraftFromOpenApi(root)];

  const collectionIds: string[] = [];
  let requestCount = 0;
  let firstRequestId: string | null = null;

  try {
    for (const draft of drafts) {
      const collectionId = await createCollectionWithAvailableName(
        workspaceId,
        draft.name
      );
      collectionIds.push(collectionId);

      await db.updateCollection(collectionId, {
        description: draft.description,
        auth_type: draft.authType,
        auth_config: JSON.stringify(draft.authConfig),
      });

      const variables = draft.variables.filter((variable) => variable.key.trim());
      for (const [index, variable] of variables.entries()) {
        await db.upsertCollectionVariable({
          id: crypto.randomUUID(),
          collection_id: collectionId,
          key: variable.key,
          value: variable.value,
          enabled: variable.enabled ? 1 : 0,
          sort_order: index,
        });
      }

      const importedItems = await createImportItems(
        collectionId,
        null,
        draft.items
      );
      requestCount += importedItems.requestCount;
      firstRequestId ||= importedItems.firstRequestId;
    }
  } catch (error) {
    await Promise.allSettled(
      collectionIds.map((collectionId) => db.deleteCollection(collectionId))
    );
    throw error;
  }

  return {
    collectionIds,
    collectionCount: collectionIds.length,
    requestCount,
    firstRequestId,
  };
}

async function createCollectionWithAvailableName(
  workspaceId: string,
  preferredName: string
): Promise<string> {
  const baseName = preferredName.trim() || "Imported Collection";

  for (let index = 0; index < 100; index++) {
    const name = index === 0 ? baseName : `${baseName} (${index + 1})`;
    try {
      return await db.createCollection(workspaceId, name);
    } catch (error) {
      if (!db.isDuplicateCollectionNameError(error)) {
        throw error;
      }
    }
  }

  return db.createCollection(workspaceId, `${baseName} ${Date.now()}`);
}

async function createImportItems(
  collectionId: string,
  parentId: string | null,
  items: ImportItemDraft[]
): Promise<ImportItemsResult> {
  let requestCount = 0;
  let firstRequestId: string | null = null;

  for (const [index, item] of items.entries()) {
    if (item.type === "folder") {
      const folderId = await db.createCollectionItem({
        collection_id: collectionId,
        parent_id: parentId,
        type: "folder",
        name: item.name,
        sort_order: index,
      });
      const importedChildren = await createImportItems(
        collectionId,
        folderId,
        item.items
      );
      requestCount += importedChildren.requestCount;
      firstRequestId ||= importedChildren.firstRequestId;
      continue;
    }

    const requestId = await db.createCollectionItem({
      collection_id: collectionId,
      parent_id: parentId,
      type: "request",
      name: item.name,
      method: item.request.method,
      url: item.request.url,
      query_params: JSON.stringify(item.request.queryParams),
      headers: JSON.stringify(item.request.headers),
      body_mode: item.request.bodyMode,
      body_content: item.request.bodyContent,
      auth_type: item.request.authType,
      auth_config: JSON.stringify(item.request.authConfig),
      sort_order: index,
    });
    firstRequestId ||= requestId;
    requestCount += 1;
  }

  return { requestCount, firstRequestId };
}

function collectionDraftFromOpenApi(root: PlainObject): ImportCollectionDraft {
  const openapi = asString(root.openapi);
  const paths = asPlainObject(root.paths);
  if (!openapi.startsWith("3.") || Object.keys(paths).length === 0) {
    throw new Error("UNSUPPORTED_IMPORT_FORMAT");
  }

  const info = asPlainObject(root.info);
  const title = nonEmptyString(info.title, "OpenAPI Import");
  const serverUrl = openApiServerUrl(root.servers);
  const auth = authFromSecurity(root, root.security, "none");
  const operationVariables: KeyValue[] = [];
  const folders = new Map<string, Extract<ImportItemDraft, { type: "folder" }>>();

  for (const [path, pathValue] of Object.entries(paths)) {
    const pathItem = resolveRefObject(pathValue, root);
    if (!pathItem) continue;

    for (const [methodKey, operationValue] of Object.entries(pathItem)) {
      const method = methodKey.toLowerCase();
      if (!OPENAPI_METHODS.has(method)) continue;

      const operation = resolveRefObject(operationValue, root);
      if (!operation) continue;

      const operationAuth = Object.prototype.hasOwnProperty.call(
        operation,
        "security"
      )
        ? authFromSecurity(root, operation.security, "none")
        : emptySecurity("inherit");

      const folderName = operationFolderName(operation, path);
      const folder =
        folders.get(folderName) ||
        ({
          type: "folder",
          name: folderName,
          items: [],
        } satisfies Extract<ImportItemDraft, { type: "folder" }>);
      folders.set(folderName, folder);

      const requestDraft = requestDraftFromOperation({
        root,
        path,
        pathItem,
        operation,
        method: method.toUpperCase(),
        rootServerUrl: serverUrl,
        operationAuth,
      });
      folder.items.push(requestDraft.item);
      operationVariables.push(...requestDraft.variables);
    }
  }

  return {
    name: title,
    description: asString(info.description),
    authType: auth.authType,
    authConfig: auth.authConfig,
    variables: uniqueKeyValues([
      { key: "baseUrl", value: serverUrl, enabled: true },
      ...auth.variables,
      ...operationVariables,
    ]),
    items: Array.from(folders.values()).filter((folder) => folder.items.length > 0),
  };
}

interface SecurityDraft {
  authType: AuthType;
  authConfig: RequestAuthConfig;
  variables: KeyValue[];
}

function emptySecurity(authType: "none" | "inherit"): SecurityDraft {
  return { authType, authConfig: {}, variables: [] };
}

function requestDraftFromOperation({
  root,
  path,
  pathItem,
  operation,
  method,
  rootServerUrl,
  operationAuth,
}: {
  root: PlainObject;
  path: string;
  pathItem: PlainObject;
  operation: PlainObject;
  method: string;
  rootServerUrl: string;
  operationAuth: SecurityDraft;
}): { item: ImportItemDraft; variables: KeyValue[] } {
  const parameters = mergedParameters(
    root,
    pathItem.parameters,
    operation.parameters
  );
  const queryParams: KeyValue[] = [];
  const pathVariables: KeyValue[] = [];
  let headers: KeyValue[] = [];
  let requestPath = path.replace(/\{([^}]+)\}/g, (_match, name: string) => {
    const parameter = parameters.find(
      (candidate) =>
        asString(candidate.name) === name && asString(candidate.in) === "path"
    );
    pathVariables.push({
      key: name,
      value: parameter ? parameterSampleValue(parameter, root) : "",
      enabled: true,
    });
    return `{{${asString(parameter?.name, name)}}}`;
  });

  if (!requestPath.startsWith("/")) {
    requestPath = `/${requestPath}`;
  }

  for (const parameter of parameters) {
    const location = asString(parameter.in);
    const key = asString(parameter.name);
    if (!key) continue;

    const row = {
      key,
      value: parameterSampleValue(parameter, root),
      enabled: true,
      ...(typeof parameter.description === "string"
        ? { description: parameter.description }
        : {}),
    };

    if (location === "query") {
      queryParams.push(row);
    } else if (location === "header") {
      headers.push(row);
    }
  }

  const body = requestBodyFromOpenApi(operation.requestBody, root);
  headers = upsertHeaders(headers, body.headers);
  const overriddenServerUrl =
    openApiServerUrl(operation.servers) || openApiServerUrl(pathItem.servers);
  const requestBase =
    !overriddenServerUrl || overriddenServerUrl === rootServerUrl
      ? "{{baseUrl}}"
      : overriddenServerUrl;

  return {
    item: {
      type: "request",
      name:
        asString(operation.summary).trim() ||
        asString(operation.operationId).trim() ||
        `${method} ${path}`,
      request: {
        method,
        url: requestBase
          ? joinServerAndPath(requestBase, requestPath)
          : requestPath,
        headers:
          headers.length > 0
            ? headers
            : [{ key: "", value: "", enabled: true }],
        queryParams:
          queryParams.length > 0
            ? queryParams
            : [{ key: "", value: "", enabled: true }],
        bodyMode: body.bodyMode,
        bodyContent: body.bodyContent,
        authType: operationAuth.authType,
        authConfig: operationAuth.authConfig,
        timeoutMs: 30000,
      },
    },
    variables: [...pathVariables, ...operationAuth.variables],
  };
}

function operationFolderName(operation: PlainObject, path: string): string {
  const tags = Array.isArray(operation.tags) ? operation.tags : [];
  const tag = tags.find((value): value is string => typeof value === "string");
  if (tag?.trim()) return tag.trim();

  const firstSegment = path.split("/").find((segment) => segment.trim());
  return firstSegment ? firstSegment.replace(/[{}]/g, "") : "Default";
}

function openApiServerUrl(value: unknown): string {
  const servers = Array.isArray(value) ? value : [];
  const server = servers.map(asPlainObject).find((entry) => typeof entry.url === "string");
  if (!server) return "";

  const variables = asPlainObject(server.variables);
  return asString(server.url)
    .trim()
    .replace(/\{([^}]+)\}/g, (_match, name: string) => {
      const variable = asPlainObject(
        hasOwn(variables, name) ? variables[name] : null
      );
      return asString(variable.default, `{${name}}`);
    })
    .replace(/\/+$/, "");
}

function joinServerAndPath(serverUrl: string, path: string): string {
  if (!serverUrl) return path;
  if (!path) return serverUrl;
  return `${serverUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

function mergedParameters(
  root: PlainObject,
  pathParameters: unknown,
  operationParameters: unknown
): PlainObject[] {
  const byLocationAndName = new Map<string, PlainObject>();
  for (const parameter of [
    ...parameterArray(pathParameters, root),
    ...parameterArray(operationParameters, root),
  ]) {
    const location = asString(parameter.in);
    const name = asString(parameter.name);
    if (!location || !name) continue;
    byLocationAndName.set(`${location}:${name}`, parameter);
  }
  return Array.from(byLocationAndName.values());
}

function parameterArray(value: unknown, root: PlainObject): PlainObject[] {
  return (Array.isArray(value) ? value : [])
    .map((entry) => resolveRefObject(entry, root))
    .filter((entry): entry is PlainObject => Boolean(entry));
}

function parameterSampleValue(parameter: PlainObject, root: PlainObject): string {
  if ("example" in parameter) return stringifyScalar(parameter.example);
  const schema = resolveRefObject(parameter.schema, root);
  if (!schema) return "";
  return stringifyScalar(sampleFromSchema(schema, root));
}

function requestBodyFromOpenApi(
  value: unknown,
  root: PlainObject
): { bodyMode: BodyMode; bodyContent: string; headers: KeyValue[] } {
  const requestBody = resolveRefObject(value, root);
  const content = asPlainObject(requestBody?.content);
  const mediaType = chooseMediaType(content);
  if (!mediaType) {
    return { bodyMode: "none", bodyContent: "", headers: [] };
  }

  const mediaObject = asPlainObject(content[mediaType]);
  const headers = [{ key: "Content-Type", value: mediaType, enabled: true }];
  const lowerMediaType = mediaType.toLowerCase();

  if (lowerMediaType.includes("json")) {
    const sample = mediaSample(mediaObject, root) ?? {};
    return {
      bodyMode: "json",
      bodyContent: JSON.stringify(sample, null, 2),
      headers,
    };
  }

  if (lowerMediaType === "application/x-www-form-urlencoded") {
    return {
      bodyMode: "form",
      bodyContent: JSON.stringify(formRowsFromMedia(mediaObject, root)),
      headers,
    };
  }

  if (lowerMediaType.startsWith("text/")) {
    const sample = mediaSample(mediaObject, root);
    return {
      bodyMode: "raw",
      bodyContent: stringifyScalar(sample),
      headers,
    };
  }

  const sample = mediaSample(mediaObject, root);
  return {
    bodyMode: "raw",
    bodyContent:
      typeof sample === "string"
        ? sample
        : sample == null
          ? ""
          : JSON.stringify(sample, null, 2),
    headers,
  };
}

function chooseMediaType(content: PlainObject): string {
  const keys = Object.keys(content);
  const lower = new Map(keys.map((key) => [key.toLowerCase(), key]));
  return (
    lower.get("application/json") ||
    keys.find((key) => key.toLowerCase().includes("json")) ||
    lower.get("application/x-www-form-urlencoded") ||
    keys.find((key) => key.toLowerCase().startsWith("text/")) ||
    keys[0] ||
    ""
  );
}

function mediaSample(mediaObject: PlainObject, root: PlainObject): unknown {
  if ("example" in mediaObject) return mediaObject.example;

  const examples = asPlainObject(mediaObject.examples);
  const exampleWithValue = Object.values(examples)
    .map((example) => resolveRefObject(example, root))
    .find((example) => example && "value" in example);
  if (exampleWithValue) {
    return exampleWithValue.value;
  }

  const schema = resolveRefObject(mediaObject.schema, root);
  return schema ? sampleFromSchema(schema, root) : undefined;
}

function formRowsFromMedia(mediaObject: PlainObject, root: PlainObject): KeyValue[] {
  const sample = mediaSample(mediaObject, root);
  if (isPlainObject(sample)) {
    return Object.entries(sample).map(([key, value]) => ({
      key,
      value: stringifyScalar(value),
      enabled: true,
    }));
  }

  const schema = resolveRefObject(mediaObject.schema, root);
  const properties = asPlainObject(schema?.properties);
  const rows = Object.entries(properties).map(([key, property]) => ({
    key,
    value: stringifyScalar(sampleFromSchema(asPlainObject(property), root)),
    enabled: true,
    ...(typeof asPlainObject(property).description === "string"
      ? { description: asPlainObject(property).description as string }
      : {}),
  }));

  return rows.length > 0 ? rows : [{ key: "", value: "", enabled: true }];
}

function upsertHeaders(headers: KeyValue[], nextHeaders: KeyValue[]): KeyValue[] {
  let result = [...headers];
  for (const header of nextHeaders) {
    const index = result.findIndex(
      (row) => row.key.toLowerCase() === header.key.toLowerCase()
    );
    if (index >= 0) {
      result[index] = header;
    } else {
      result = [...result, header];
    }
  }
  return result;
}

function authFromSecurity(
  root: PlainObject,
  security: unknown,
  fallbackAuthType: "none" | "inherit"
): SecurityDraft {
  const requirements = Array.isArray(security) ? security : [];
  if (
    requirements.some(
      (entry) => Object.keys(asPlainObject(entry)).length === 0
    )
  ) {
    return emptySecurity(fallbackAuthType);
  }

  const components = asPlainObject(root.components);
  const schemes = asPlainObject(components.securitySchemes);

  for (const requirement of requirements.map(asPlainObject)) {
    for (const schemeName of Object.keys(requirement)) {
      if (!hasOwn(schemes, schemeName)) continue;
      const scheme = resolveRefObject(schemes[schemeName], root);
      if (!scheme) continue;

      const auth = authFromSecurityScheme(schemeName, scheme);
      if (auth) return auth;
    }
  }

  return emptySecurity(fallbackAuthType);
}

function authFromSecurityScheme(
  schemeName: string,
  scheme: PlainObject
): SecurityDraft | null {
  const variableBase = variableName(schemeName);
  const type = asString(scheme.type).toLowerCase();
  if (type === "http" && asString(scheme.scheme).toLowerCase() === "bearer") {
    const key = `${variableBase}Token`;
    return {
      authType: "bearer",
      authConfig: { token: `{{${key}}}` },
      variables: [{ key, value: "", enabled: true }],
    };
  }

  if (type === "http" && asString(scheme.scheme).toLowerCase() === "basic") {
    const usernameKey = `${variableBase}Username`;
    const passwordKey = `${variableBase}Password`;
    return {
      authType: "basic",
      authConfig: {
        username: `{{${usernameKey}}}`,
        password: `{{${passwordKey}}}`,
      },
      variables: [
        { key: usernameKey, value: "", enabled: true },
        { key: passwordKey, value: "", enabled: true },
      ],
    };
  }

  if (type === "apikey") {
    const key = `${variableBase}Value`;
    const location = asString(scheme.in).toLowerCase();
    const parameterName = asString(scheme.name);
    if (!parameterName || !["header", "query", "cookie"].includes(location)) {
      return null;
    }
    return {
      authType: "apikey",
      authConfig: {
        key: location === "cookie" ? "Cookie" : parameterName,
        value:
          location === "cookie"
            ? `${parameterName}={{${key}}}`
            : `{{${key}}}`,
        addTo: location === "query" ? "queryParams" : "header",
      },
      variables: [{ key, value: "", enabled: true }],
    };
  }

  if (type === "oauth2" || type === "openidconnect") {
    const key = `${variableBase}Token`;
    return {
      authType: "bearer",
      authConfig: { token: `{{${key}}}` },
      variables: [{ key, value: "", enabled: true }],
    };
  }

  return null;
}

function variableName(value: string): string {
  const cleaned = value.replace(/[^A-Za-z0-9_]/g, " ").trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "auth";
  return parts
    .map((part, index) =>
      index === 0 ? part.charAt(0).toLowerCase() + part.slice(1) : part
    )
    .join("");
}

function uniqueKeyValues(rows: KeyValue[]): KeyValue[] {
  const seen = new Set<string>();
  const result: KeyValue[] = [];
  for (const row of rows) {
    if (!row.key.trim() || seen.has(row.key)) continue;
    seen.add(row.key);
    result.push(row);
  }
  return result;
}

function resolveRefObject(value: unknown, root: PlainObject): PlainObject | null {
  const resolved = resolveRef(value, root);
  return isPlainObject(resolved) ? resolved : null;
}

function resolveRef(value: unknown, root: PlainObject, seen = new Set<string>()): unknown {
  if (!isPlainObject(value) || typeof value.$ref !== "string") {
    return value;
  }

  const ref = value.$ref;
  if (!ref.startsWith("#/") || seen.has(ref)) {
    return value;
  }

  seen.add(ref);
  const target = ref
    .slice(2)
    .split("/")
    .map((segment) => segment.replace(/~1/g, "/").replace(/~0/g, "~"))
    .reduce<unknown>((current, segment) => {
      return isPlainObject(current) && hasOwn(current, segment)
        ? current[segment]
        : undefined;
    }, root);

  return resolveRef(target, root, seen);
}

function sampleFromSchema(schema: PlainObject, root: PlainObject): unknown {
  const resolved = resolveRefObject(schema, root) || schema;
  if ("example" in resolved) return resolved.example;
  if (Array.isArray(resolved.examples) && resolved.examples.length > 0) {
    return resolved.examples[0];
  }
  if ("default" in resolved) return resolved.default;
  if ("const" in resolved) return resolved.const;
  if (Array.isArray(resolved.enum) && resolved.enum.length > 0) {
    return resolved.enum[0];
  }

  const oneOf = schemaArray(resolved.oneOf, root);
  if (oneOf.length > 0) return sampleFromSchema(preferredSchema(oneOf), root);
  const anyOf = schemaArray(resolved.anyOf, root);
  if (anyOf.length > 0) return sampleFromSchema(preferredSchema(anyOf), root);
  const allOf = schemaArray(resolved.allOf, root);
  if (allOf.length > 0) {
    return allOf.reduce<PlainObject>((merged, child) => {
      const sample = sampleFromSchema(child, root);
      return isPlainObject(sample) ? { ...merged, ...sample } : merged;
    }, {});
  }

  const schemaType = Array.isArray(resolved.type)
    ? resolved.type.find((entry) => entry !== "null")
    : resolved.type;
  const properties = asPlainObject(resolved.properties);
  if (schemaType === "object" || Object.keys(properties).length > 0) {
    return Object.fromEntries(
      Object.entries(properties).map(([key, property]) => [
        key,
        sampleFromSchema(asPlainObject(resolveRef(property, root)), root),
      ])
    );
  }

  if (schemaType === "array") {
    const itemSchema = resolveRefObject(resolved.items, root) || {};
    return [sampleFromSchema(itemSchema, root)];
  }

  if (schemaType === "integer" || schemaType === "number") return 0;
  if (schemaType === "boolean") return true;
  if (schemaType === "string") {
    const format = asString(resolved.format);
    if (format === "date-time") return "2026-01-01T00:00:00Z";
    if (format === "date") return "2026-01-01";
    if (format === "email") return "user@example.com";
    if (format === "uuid") return "00000000-0000-4000-8000-000000000000";
    return "";
  }

  return {};
}

function preferredSchema(schemas: PlainObject[]): PlainObject {
  return (
    schemas.find((schema) => {
      const type = schema.type;
      return Array.isArray(type)
        ? type.some((entry) => entry !== "null")
        : type !== "null";
    }) || schemas[0]
  );
}

function schemaArray(value: unknown, root: PlainObject): PlainObject[] {
  return (Array.isArray(value) ? value : [])
    .map((entry) => resolveRefObject(entry, root))
    .filter((entry): entry is PlainObject => Boolean(entry));
}

function stringifyScalar(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

interface YamlLine {
  indent: number;
  text: string;
}

function parseYaml(content: string): unknown {
  const lines = content
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map(toYamlLine)
    .filter((line): line is YamlLine => Boolean(line))
    .filter((line) => line.text !== "---" && line.text !== "...")
    .filter((line) => !(line.indent === 0 && line.text.startsWith("%")));

  if (lines.length === 0) {
    throw new Error("IMPORT_CONTENT_EMPTY");
  }

  const [value, nextIndex] = parseYamlBlock(lines, 0, lines[0].indent);
  if (nextIndex !== lines.length) {
    throw new Error("INVALID_YAML");
  }
  return value;
}

function toYamlLine(rawLine: string): YamlLine | null {
  const line = stripYamlComment(rawLine.replace(/\t/g, "  ")).replace(/\s+$/, "");
  if (!line.trim()) return null;
  const indent = line.match(/^ */)?.[0].length || 0;
  return { indent, text: line.slice(indent) };
}

function stripYamlComment(line: string): string {
  let quote: string | null = null;
  for (let index = 0; index < line.length; index++) {
    const char = line[index];
    if ((char === "\"" || char === "'") && line[index - 1] !== "\\") {
      quote = quote === char ? null : quote || char;
      continue;
    }
    if (!quote && char === "#" && (index === 0 || /\s/.test(line[index - 1]))) {
      return line.slice(0, index);
    }
  }
  return line;
}

function parseYamlBlock(
  lines: YamlLine[],
  index: number,
  minimumIndent: number
): [unknown, number] {
  if (index >= lines.length || lines[index].indent < minimumIndent) {
    return [undefined, index];
  }

  const indent = lines[index].indent;
  return lines[index].text.startsWith("-")
    ? parseYamlArray(lines, index, indent)
    : parseYamlObject(lines, index, indent);
}

function parseYamlObject(
  lines: YamlLine[],
  index: number,
  indent: number
): [PlainObject, number] {
  const object = Object.create(null) as PlainObject;
  let cursor = index;

  while (cursor < lines.length) {
    const line = lines[cursor];
    if (line.indent < indent || line.text.startsWith("-")) break;
    if (line.indent > indent) break;

    const pair = splitYamlPair(line.text);
    if (!pair) {
      throw new Error("INVALID_YAML");
    }

    const blockStyle = yamlBlockStyle(pair.value);
    if (blockStyle) {
      const [value, nextCursor] = collectYamlBlockScalar(
        lines,
        cursor + 1,
        line.indent,
        blockStyle === ">"
      );
      object[pair.key] = value;
      cursor = nextCursor;
      continue;
    }

    if (!pair.value) {
      const nextLine = lines[cursor + 1];
      const childIndent =
        nextLine?.indent === line.indent && nextLine.text.startsWith("-")
          ? line.indent
          : line.indent + 1;
      const [value, nextCursor] = parseYamlBlock(
        lines,
        cursor + 1,
        childIndent
      );
      object[pair.key] = value ?? {};
      cursor = nextCursor;
      continue;
    }

    object[pair.key] = parseYamlScalar(pair.value);
    cursor += 1;
  }

  return [object, cursor];
}

function parseYamlArray(
  lines: YamlLine[],
  index: number,
  indent: number
): [unknown[], number] {
  const items: unknown[] = [];
  let cursor = index;

  while (cursor < lines.length) {
    const line = lines[cursor];
    if (line.indent < indent || line.indent > indent || !line.text.startsWith("-")) {
      break;
    }

    const rest = line.text.slice(1).trim();
    cursor += 1;

    if (!rest) {
      const [value, nextCursor] = parseYamlBlock(lines, cursor, line.indent + 1);
      items.push(value ?? null);
      cursor = nextCursor;
      continue;
    }

    const scalarBlockStyle = yamlBlockStyle(rest);
    if (scalarBlockStyle) {
      const [value, nextCursor] = collectYamlBlockScalar(
        lines,
        cursor,
        line.indent,
        scalarBlockStyle === ">"
      );
      items.push(value);
      cursor = nextCursor;
      continue;
    }

    if (
      (rest.startsWith("{") && rest.endsWith("}")) ||
      (rest.startsWith("[") && rest.endsWith("]"))
    ) {
      items.push(parseYamlScalar(rest));
      continue;
    }

    const pair = splitYamlPair(rest);
    if (!pair) {
      items.push(parseYamlScalar(rest));
      continue;
    }

    const item = Object.create(null) as PlainObject;
    const pairBlockStyle = yamlBlockStyle(pair.value);
    if (pairBlockStyle) {
      const [value, nextCursor] = collectYamlBlockScalar(
        lines,
        cursor,
        line.indent + 2,
        pairBlockStyle === ">"
      );
      item[pair.key] = value;
      cursor = nextCursor;
    } else if (!pair.value) {
      const [value, nextCursor] = parseYamlBlock(lines, cursor, line.indent + 1);
      item[pair.key] = value ?? {};
      cursor = nextCursor;
    } else {
      item[pair.key] = parseYamlScalar(pair.value);
    }

    const [child, nextCursor] = parseYamlBlock(lines, cursor, line.indent + 1);
    if (isPlainObject(child)) {
      items.push({ ...item, ...child });
      cursor = nextCursor;
    } else {
      items.push(item);
    }
  }

  return [items, cursor];
}

function yamlBlockStyle(value: string): "|" | ">" | null {
  return /^[|>][0-9+-]*$/.test(value) ? (value[0] as "|" | ">") : null;
}

function collectYamlBlockScalar(
  lines: YamlLine[],
  index: number,
  parentIndent: number,
  folded: boolean
): [string, number] {
  const blockLines: YamlLine[] = [];
  let cursor = index;
  while (cursor < lines.length && lines[cursor].indent > parentIndent) {
    blockLines.push(lines[cursor]);
    cursor += 1;
  }
  const contentIndent = blockLines.reduce(
    (minimum, line) => Math.min(minimum, line.indent),
    Infinity
  );
  const parts = blockLines.map(
    (line) => `${" ".repeat(line.indent - contentIndent)}${line.text}`
  );
  return [folded ? parts.join(" ").replace(/\s+/g, " ").trim() : parts.join("\n"), cursor];
}

function splitYamlPair(
  text: string,
  allowCompact = false
): { key: string; value: string } | null {
  let quote: string | null = null;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if ((char === "\"" || char === "'") && text[index - 1] !== "\\") {
      quote = quote === char ? null : quote || char;
      continue;
    }
    if (
      !quote &&
      char === ":" &&
      (allowCompact || index === text.length - 1 || /\s/.test(text[index + 1]))
    ) {
      return {
        key: unquoteYamlString(text.slice(0, index).trim()),
        value: text.slice(index + 1).trim(),
      };
    }
  }
  return null;
}

function parseYamlScalar(value: string): unknown {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return unquoteYamlString(trimmed);
  }
  const normalized = trimmed.toLowerCase();
  if (normalized === "null" || trimmed === "~") return null;
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(trimmed)) {
    return Number(trimmed);
  }
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return splitInlineYaml(trimmed.slice(1, -1)).map(parseYamlScalar);
  }
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return Object.fromEntries(
      splitInlineYaml(trimmed.slice(1, -1))
        .map((entry) => splitYamlPair(entry, true))
        .filter((pair): pair is { key: string; value: string } => Boolean(pair))
        .map((pair) => [pair.key, parseYamlScalar(pair.value)])
    );
  }
  return trimmed;
}

function unquoteYamlString(value: string): string {
  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replace(/''/g, "'");
  }
  if (value.startsWith("\"") && value.endsWith("\"")) {
    try {
      return JSON.parse(value) as string;
    } catch {
      return value.slice(1, -1);
    }
  }
  return value;
}

function splitInlineYaml(value: string): string[] {
  const parts: string[] = [];
  let quote: string | null = null;
  let depth = 0;
  let start = 0;
  for (let index = 0; index < value.length; index++) {
    const char = value[index];
    if ((char === "\"" || char === "'") && value[index - 1] !== "\\") {
      quote = quote === char ? null : quote || char;
      continue;
    }
    if (quote) continue;
    if (char === "[" || char === "{") depth += 1;
    if (char === "]" || char === "}") depth -= 1;
    if (char === "," && depth === 0) {
      parts.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }
  parts.push(value.slice(start).trim());
  return parts.filter(Boolean);
}
