// Thin wrapper over the DB-backed rate limiter that speaks ApiError.
import { ApiError } from "../core/errors.js";
import { consumeLimit } from "../rate-limit.js";

/** Seconds until the current fixed window (aligned to the epoch, like the SQL) ends. */
export function secondsToWindowEnd(windowSec) {
  return windowSec - (Math.floor(Date.now() / 1000) % windowSec);
}

/**
 * Count one hit on `bucket`; throws 429 rate_limited (with details.retryAfter)
 * when over `max`, and 500 when the limiter's storage is unavailable (fail closed).
 * @param {{query: Function}} db
 * @param {string} bucket
 * @param {number} max
 * @param {number} windowSec
 */
export async function enforceLimit(db, bucket, max, windowSec) {
  const result = await consumeLimit(db, bucket, max, windowSec);
  if (result.unavailable) throw new ApiError(500, "internal");
  if (!result.ok) throw new ApiError(429, "rate_limited", { details: { retryAfter: secondsToWindowEnd(windowSec) } });
}
