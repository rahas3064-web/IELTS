// Session cookie plumbing. Only this file knows the cookie name and flags.
export const SESSION_COOKIE = "bd_session";
export const ADMIN_SESSION_COOKIE = "bd_admin";

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
export function setSessionCookie(res, signedValue, { secure, maxAgeMs, name = SESSION_COOKIE }) {
  res.cookie(name, signedValue, { ...baseOptions(secure), maxAge: maxAgeMs });
}

/** @param {import("express").Response} res */
export function clearSessionCookie(res, { secure, name = SESSION_COOKIE }) {
  res.clearCookie(name, baseOptions(secure));
}
