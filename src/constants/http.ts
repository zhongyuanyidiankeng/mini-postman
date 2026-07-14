export const HTTP_METHODS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
] as const;

export const METHOD_COLORS: Record<string, string> = {
  GET: "#49cc90",
  POST: "#fca130",
  PUT: "#50b5ff",
  PATCH: "#9b59b6",
  DELETE: "#f93e3e",
  HEAD: "#9012fe",
};
