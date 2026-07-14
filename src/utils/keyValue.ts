import type { KeyValue } from "../types";

export const emptyKeyValue = (): KeyValue => ({
  key: "",
  value: "",
  enabled: true,
});

export function normalizeKeyValueRows(value: unknown): KeyValue[] {
  if (!Array.isArray(value)) return [emptyKeyValue()];

  const rows = value
    .filter(
      (row): row is Record<string, unknown> =>
        Boolean(row) && typeof row === "object"
    )
    .map((row) => ({
      key: typeof row.key === "string" ? row.key : "",
      value: typeof row.value === "string" ? row.value : "",
      enabled: typeof row.enabled === "boolean" ? row.enabled : true,
      ...(typeof row.description === "string"
        ? { description: row.description }
        : {}),
    }));

  return rows.length > 0 ? rows : [emptyKeyValue()];
}

export function parseKeyValueRows(content: string): KeyValue[] {
  try {
    return normalizeKeyValueRows(JSON.parse(content));
  } catch {
    return [emptyKeyValue()];
  }
}
