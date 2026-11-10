import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const LEGACY = { N: 16384, r: 8, p: 1 };
const CURRENT = { N: 32768, r: 8, p: 1 };
const MAXMEM = 64 * 1024 * 1024;

function derive(password, salt, params) {
  return scryptAsync(password, salt, 64, { ...params, maxmem: MAXMEM });
}

export function needsRehash(stored) {
  return typeof stored === "string" && stored.split("$").length === 3 && stored.startsWith("scrypt$");
}

export async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derived = await derive(password, salt, CURRENT);
  return `scrypt$2$${CURRENT.N}$${CURRENT.r}$${CURRENT.p}$${salt}$${Buffer.from(derived).toString("hex")}`;
}

function parsed(stored) {
  if (typeof stored !== "string") return null;
  const parts = stored.split("$");
  if (parts.length === 3 && parts[0] === "scrypt" && parts[1] && parts[2]) {
    return { ...LEGACY, salt: parts[1], hex: parts[2] };
  }
  if (parts.length === 7 && parts[0] === "scrypt" && parts[1] === "2") {
    const N = Number(parts[2]);
    const r = Number(parts[3]);
    const p = Number(parts[4]);
    if ((N !== LEGACY.N && N !== CURRENT.N) || r !== 8 || p !== 1 || !parts[5] || !parts[6]) return null;
    return { N, r, p, salt: parts[5], hex: parts[6] };
  }
  return null;
}

export async function verifyPassword(password, stored) {
  const record = parsed(stored);
  if (!record) return false;
  const derived = Buffer.from(await derive(password, record.salt, { N: record.N, r: record.r, p: record.p }));
  const expected = Buffer.from(record.hex, "hex");
  if (expected.length !== derived.length) return false;
  return timingSafeEqual(expected, derived);
}
