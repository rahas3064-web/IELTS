// Session cookie plumbing. Only this file knows the cookie name and flags.
export const SESSION_COOKIE = "bd_session";

/** @param {string|undefined} header raw Cookie header @returns {Record<string, string>} */
export function parseCookies(header) {
  const out = {};
  if (typeof header !== "string") return out;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    const name = part.slice(0, eq).trim();
    if (Object.hasOwn(out, name)) continue;
    try {
      out[name] = decodeURIComponent(part.slice(eq + 1).trim());
    } catch {
      // A malformed value is ignored rather than failing the request.
    }
  }
  return out;
}

const baseOptions = (secure) => ({ httpOnly: true, sameSite: "lax", secure, path: "/" });

/** @param {import("express").Response} res @param {string} signedValue */
export function setSessionCookie(res, signedValue, { secure, maxAgeMs }) {
  res.cookie(SESSION_COOKIE, signedValue, { ...baseOptions(secure), maxAge: maxAgeMs });
}

/** @param {import("express").Response} res */
export function clearSessionCookie(res, { secure }) {
  res.clearCookie(SESSION_COOKIE, baseOptions(secure));
}
