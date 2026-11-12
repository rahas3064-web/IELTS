/* global Buffer */
// Small crypto helpers: digests, signed cookie values and the signup token.
// Every signature uses a key derived per purpose so one token type can never be
// replayed as another.
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const sha256Hex = (value) => createHash("sha256").update(String(value)).digest("hex");

export const hmacHex = (key, value) => createHmac("sha256", key).update(String(value)).digest("hex");

const hmacBase64Url = (key, value) => createHmac("sha256", key).update(String(value)).digest("base64url");

/** Constant-time comparison of two hex digests; false on any length/type mismatch. */
export function safeEqualHex(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length || a.length === 0) return false;
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  if (left.length !== right.length || left.length === 0) return false;
  return timingSafeEqual(left, right);
}

/** 32 random bytes, base64url (43 chars). */
export const newSessionToken = () => randomBytes(32).toString("base64url");

const subKey = (secret, label) => hmacHex(secret, `bandora:${label}`);

/** `value.signature` (signature = HMAC-SHA256 under the cookie sub-key). */
export function signValue(secret, value) {
  return `${value}.${hmacBase64Url(subKey(secret, "cookie"), value)}`;
}

/** @returns {string|null} the original value, or null when the signature is not valid */
export function unsignValue(secret, signed) {
  if (typeof signed !== "string") return null;
  const dot = signed.lastIndexOf(".");
  if (dot <= 0) return null;
  const value = signed.slice(0, dot);
  const expected = Buffer.from(hmacBase64Url(subKey(secret, "cookie"), value));
  const actual = Buffer.from(signed.slice(dot + 1));
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  return value;
}

/**
 * Short-lived token proving a phone passed OTP verification (used by register).
 * @param {string} secret
 * @param {{phone: string, now: Date, ttlMs: number}} input
 */
export function issueSignupToken(secret, { phone, now, ttlMs }) {
  const body = Buffer.from(JSON.stringify({ p: phone, e: now.getTime() + ttlMs })).toString("base64url");
  return `${body}.${hmacBase64Url(subKey(secret, "signup"), body)}`;
}

/**
 * Short-lived signed payload. `label` is part of the key, so tokens cannot cross purposes.
 * @param {string} secret
 * @param {string} label
 * @param {Record<string, string>} payload
 * @param {{now: Date, ttlMs: number}} clock
 */
export function issueGateToken(secret, label, payload, { now, ttlMs }) {
  const body = Buffer.from(JSON.stringify({ ...payload, e: now.getTime() + ttlMs })).toString("base64url");
  return `${body}.${hmacBase64Url(subKey(secret, label), body)}`;
}

/** @returns {Record<string, unknown>|null} */
export function readGateToken(secret, label, token, { now }) {
  if (typeof token !== "string") return null;
  const [body, signature, extra] = token.split(".");
  if (!body || !signature || extra !== undefined) return null;
  const expected = Buffer.from(hmacBase64Url(subKey(secret, label), body));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!parsed || typeof parsed !== "object" || !Number.isFinite(parsed.e)) return null;
    if (now.getTime() > parsed.e) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** @returns {{phone: string}|null} null when forged, malformed or expired */
export function readSignupToken(secret, token, { now }) {
  if (typeof token !== "string") return null;
  const [body, signature, extra] = token.split(".");
  if (!body || !signature || extra !== undefined) return null;
  const expected = Buffer.from(hmacBase64Url(subKey(secret, "signup"), body));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (typeof parsed?.p !== "string" || !Number.isFinite(parsed?.e)) return null;
    if (now.getTime() > parsed.e) return null;
    return { phone: parsed.p };
  } catch {
    return null;
  }
}
