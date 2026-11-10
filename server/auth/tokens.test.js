/* global Buffer */
import { describe, expect, it } from "vitest";
import {
  hmacHex,
  issueSignupToken,
  newSessionToken,
  readSignupToken,
  safeEqualHex,
  sha256Hex,
  signValue,
  unsignValue,
} from "./tokens.js";

const SECRET = "s".repeat(40);

describe("hashing helpers", () => {
  it("sha256Hex and hmacHex are deterministic hex digests", () => {
    expect(sha256Hex("a")).toMatch(/^[0-9a-f]{64}$/);
    expect(sha256Hex("a")).toBe(sha256Hex("a"));
    expect(hmacHex("k1", "a")).not.toBe(hmacHex("k2", "a"));
    expect(hmacHex("k1", "a")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("safeEqualHex compares equal and unequal digests without throwing on length mismatch", () => {
    const a = sha256Hex("x");
    expect(safeEqualHex(a, a)).toBe(true);
    expect(safeEqualHex(a, sha256Hex("y"))).toBe(false);
    expect(safeEqualHex(a, "abc")).toBe(false);
    expect(safeEqualHex(a, undefined)).toBe(false);
  });

  it("newSessionToken is 32 random bytes in base64url", () => {
    const t = newSessionToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(newSessionToken()).not.toBe(t);
  });
});

describe("signed values", () => {
  it("round-trips and rejects tampering or a different secret", () => {
    const signed = signValue(SECRET, "token123");
    expect(unsignValue(SECRET, signed)).toBe("token123");
    expect(unsignValue(SECRET, `${signed}x`)).toBeNull();
    expect(unsignValue(SECRET, signed.replace("token123", "token124"))).toBeNull();
    expect(unsignValue("o".repeat(40), signed)).toBeNull();
    expect(unsignValue(SECRET, "nodot")).toBeNull();
    expect(unsignValue(SECRET, undefined)).toBeNull();
  });
});

describe("signup token", () => {
  const now = new Date("2026-01-01T10:00:00Z");

  it("binds the phone and expires after the ttl", () => {
    const token = issueSignupToken(SECRET, { phone: "09121234567", now, ttlMs: 600_000 });
    expect(readSignupToken(SECRET, token, { now })).toEqual({ phone: "09121234567" });
    expect(readSignupToken(SECRET, token, { now: new Date(now.getTime() + 599_000) })).toEqual({ phone: "09121234567" });
    expect(readSignupToken(SECRET, token, { now: new Date(now.getTime() + 600_001) })).toBeNull();
  });

  it("rejects tampered, foreign-secret and non-signup values", () => {
    const token = issueSignupToken(SECRET, { phone: "09121234567", now, ttlMs: 600_000 });
    const [body, sig] = token.split(".");
    const forged = `${Buffer.from(JSON.stringify({ p: "09129999999", e: now.getTime() + 600_000 })).toString("base64url")}.${sig}`;
    expect(readSignupToken(SECRET, forged, { now })).toBeNull();
    expect(readSignupToken("o".repeat(40), token, { now })).toBeNull();
    expect(readSignupToken(SECRET, `${body}.`, { now })).toBeNull();
    expect(readSignupToken(SECRET, 42, { now })).toBeNull();
    // A signed session cookie value must never be accepted as a signup token.
    expect(readSignupToken(SECRET, signValue(SECRET, "abc"), { now })).toBeNull();
  });
});
