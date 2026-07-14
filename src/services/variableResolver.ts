import type { KeyValue } from "../types";

/**
 * Resolves {{variable}} placeholders in a string using the variable scope chain.
 * Priority: environment > collection > global (highest to lowest).
 */
export function resolveVariables(
  input: string,
  envVars: Record<string, string>,
  colVars: Record<string, string>,
  globalVars: Record<string, string>
): string {
  return input.replace(/\{\{(\w+)\}\}/g, (_match, varName: string) => {
    if (varName in envVars) return envVars[varName];
    if (varName in colVars) return colVars[varName];
    if (varName in globalVars) return globalVars[varName];
    return `{{${varName}}}`; // leave unresolved
  });
}

/**
 * Resolves variables across all parts of a request.
 */
export function resolveRequestVariables(
  url: string,
  headers: KeyValue[],
  queryParams: KeyValue[],
  bodyContent: string,
  envVars: Record<string, string>,
  colVars: Record<string, string>,
  globalVars: Record<string, string>
): {
  url: string;
  headers: KeyValue[];
  queryParams: KeyValue[];
  bodyContent: string;
} {
  const resolve = (s: string) => resolveVariables(s, envVars, colVars, globalVars);

  return {
    url: resolve(url),
    headers: headers.map((h) => ({
      ...h,
      key: resolve(h.key),
      value: resolve(h.value),
    })),
    queryParams: queryParams.map((p) => ({
      ...p,
      key: resolve(p.key),
      value: resolve(p.value),
    })),
    bodyContent: resolve(bodyContent),
  };
}

/**
 * Extracts all {{variable}} names from a string.
 */
export function extractVariableNames(input: string): string[] {
  const matches = input.matchAll(/\{\{(\w+)\}\}/g);
  return [...new Set([...matches].map((m) => m[1]))];
}

/**
 * Checks if a variable name is resolved in the given scope chain.
 */
export function isVariableResolved(
  varName: string,
  envVars: Record<string, string>,
  colVars: Record<string, string>,
  globalVars: Record<string, string>
): boolean {
  return varName in envVars || varName in colVars || varName in globalVars;
}
