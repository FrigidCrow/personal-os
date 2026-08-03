import { extname, resolve, sep } from "node:path";

const MIME_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"]
]);

export function resolveStaticPath(root, pathname) {
  let decoded;
  try { decoded = decodeURIComponent(pathname); }
  catch { return null; }
  const rootPath = resolve(root);
  const relativePath = decoded.replace(/^\/+/, "");
  const candidate = resolve(rootPath, relativePath || "index.html");
  if (candidate !== rootPath && !candidate.startsWith(`${rootPath}${sep}`)) return null;
  return candidate;
}

export function contentType(path) {
  return MIME_TYPES.get(extname(path).toLowerCase()) ?? "application/octet-stream";
}

export function isApiPath(pathname) {
  return pathname === "/api" || pathname.startsWith("/api/");
}
