/* global URL */
// CSRF defence for cookie-authenticated APIs: SameSite=Lax cookies plus an
// Origin/Referer host check on every state-changing request.
import { ApiError } from "../core/errors.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** @param {unknown} value @returns {string|null} host[:port] of a URL, null if unparsable */
function hostOf(value) {
  if (typeof value !== "string" || value === "") return null;
  try {
    return new URL(value).host || null;
  } catch {
    return null;
  }
}

/**
 * @param {{appBaseUrl?: string}} options APP_BASE_URL, when configured
 * @returns {import("express").RequestHandler}
 */
export function createOriginGuard({ appBaseUrl } = {}) {
  const configuredHost = hostOf(appBaseUrl);
  return function originGuard(req, _res, next) {
    if (SAFE_METHODS.has(req.method)) {
      next();
      return;
    }
    // Browsers always send Origin on non-GET fetches; Referer is the fallback.
    const source = req.get("origin") ?? req.get("referer");
    const sourceHost = hostOf(source);
    const requestHost = req.get("host");
    const allowed = sourceHost !== null && (sourceHost === configuredHost || sourceHost === requestHost);
    next(allowed ? undefined : new ApiError(403, "forbidden"));
  };
}
