// CSP is production-only. Development omits it so the Vite middleware can load
// its own scripts. img-src includes the eNamad host because the landing footer
// seal is an image from https://trustseal.enamad.ir. The seal link is a
// top-level navigation, which this policy does not restrict.
const ENAMAD_IMG_ORIGIN = "https://trustseal.enamad.ir";

export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  `img-src 'self' data: blob: ${ENAMAD_IMG_ORIGIN}`,
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

/**
 * @param {{production?: boolean}} [options]
 * @returns {import("express").RequestHandler}
 */
export function securityHeaders({ production = false } = {}) {
  return function securityHeadersMiddleware(_req, res, next) {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(self), geolocation=(), payment=()");
    if (production) {
      res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
      res.setHeader("Content-Security-Policy", CONTENT_SECURITY_POLICY);
    }
    next();
  };
}
