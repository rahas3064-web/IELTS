// Which GET/HEAD paths receive the SPA document. Anything else is a real 404,
// except dev asset URLs that Vite still has to serve.
const EXACT = new Set(["/", "/login", "/signup", "/terms", "/privacy", "/refund"]);

function normalize(pathname) {
  if (typeof pathname !== "string" || !pathname.startsWith("/") || pathname.startsWith("//")) return "";
  const path = pathname.split("?")[0].split("#")[0];
  if (path.length > 1 && path.endsWith("/")) return path.slice(0, -1);
  return path;
}

export function isClientRoute(pathname) {
  const path = normalize(pathname);
  if (EXACT.has(path)) return true;
  return path === "/app" || path.startsWith("/app/") || path === "/admin" || path.startsWith("/admin/");
}

function isPanelRoute(pathname) {
  const path = normalize(pathname);
  return path === "/app" || path.startsWith("/app/") || path === "/admin" || path.startsWith("/admin/");
}

function isAssetPath(pathname) {
  const path = normalize(pathname);
  if (
    path.startsWith("/@")
    || path.startsWith("/src/")
    || path.startsWith("/node_modules/")
    || path.startsWith("/__vite")
  ) return true;
  const leaf = path.slice(path.lastIndexOf("/") + 1);
  return leaf.includes(".");
}

/**
 * @param {{sendIndex: import("express").RequestHandler, assetPassthrough?: boolean}} options
 * @returns {import("express").RequestHandler}
 */
export function clientPage({ sendIndex, assetPassthrough = false }) {
  return function clientPageMiddleware(req, res, next) {
    if (req.method !== "GET" && req.method !== "HEAD") {
      next();
      return;
    }
    if (isPanelRoute(req.path)) res.setHeader("X-Robots-Tag", "noindex");
    if (isClientRoute(req.path)) {
      sendIndex(req, res, next);
      return;
    }
    if (assetPassthrough && isAssetPath(req.path)) {
      next();
      return;
    }
    res.status(404).type("text/plain").send("Not found");
  };
}
