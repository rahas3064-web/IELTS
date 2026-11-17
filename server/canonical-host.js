// Production-only host canonicalisation. GET/HEAD on the Railway hostname or a
// www host move to APP_BASE_URL. Other methods stay put with 421 so a redirect
// cannot drop the body. /api/health is exempt for the platform healthcheck.
import { ApiError } from "./core/errors.js";

const RAILWAY_HOST = /\.up\.railway\.app$/i;

function canonicalOrigin(appBaseUrl) {
  if (typeof appBaseUrl !== "string" || appBaseUrl.trim() === "") return null;
  try {
    return new URL(appBaseUrl.trim());
  } catch {
    return null;
  }
}

/**
 * @param {{NODE_ENV?: string, APP_BASE_URL?: string}} [config]
 * @returns {import("express").RequestHandler}
 */
export function canonicalHost(config = {}) {
  const canonical = config.NODE_ENV === "production" ? canonicalOrigin(config.APP_BASE_URL) : null;
  return function canonicalHostMiddleware(req, res, next) {
    if (!canonical) {
      next();
      return;
    }
    const host = String(req.hostname || "").toLowerCase();
    if (!host || host === canonical.hostname.toLowerCase()) {
      next();
      return;
    }
    const alias = host.startsWith("www.") || RAILWAY_HOST.test(host);
    if (!alias || req.path === "/api/health") {
      next();
      return;
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      next(new ApiError(421, "wrong_host"));
      return;
    }
    const pathAndQuery = typeof req.originalUrl === "string" && req.originalUrl.startsWith("/") && !req.originalUrl.startsWith("//")
      ? req.originalUrl
      : "/";
    res.redirect(301, `${canonical.origin}${pathAndQuery}`);
  };
}
