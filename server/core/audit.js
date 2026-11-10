import { maskPhone } from "./phone.js";

export const AUDIT_LOGS_DDL = `create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid null,
  actor_role text,
  action text not null,
  target_type text,
  target_id text,
  before jsonb,
  after jsonb,
  ip_hash text,
  meta jsonb,
  created_at timestamptz not null default now()
)`;

const REDACT_KEY_RE = /(password|otp|code|token|secret|prompt|hash)/i;
const PHONE_KEY_RE = /phone/i;
const REDACTED = "[redacted]";
// An ip_hash is already a one-way hash that the audit trail is meant to keep.
const KEPT_KEYS = new Set(["ip_hash", "iphash"]);

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isPlainObject(value) {
  if (value === null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * @param {unknown} value
 * @param {WeakSet<object>} seen ancestors on the current path (cycle guard)
 * @returns {unknown}
 */
function walk(value, seen) {
  if (Array.isArray(value) || isPlainObject(value)) {
    if (seen.has(value)) return "[circular]";
    seen.add(value);
    try {
      if (Array.isArray(value)) return value.map((item) => walk(item, seen));
      return Object.fromEntries(
        Object.entries(value).map(([key, inner]) => [key, sanitizeEntry(key, inner, seen)]),
      );
    } finally {
      seen.delete(value);
    }
  }
  return value;
}

/**
 * @param {string} key
 * @param {unknown} value
 * @param {WeakSet<object>} seen
 * @returns {unknown}
 */
function sanitizeEntry(key, value, seen) {
  if (KEPT_KEYS.has(key.toLowerCase())) return value;
  // Redaction runs before phone masking so e.g. `phone_verification_code` never leaks digits.
  if (REDACT_KEY_RE.test(key)) return REDACTED;
  if (PHONE_KEY_RE.test(key) && value !== null && typeof value !== "object") return maskPhone(value);
  return walk(value, seen);
}

/**
 * Deep-sanitize a payload for the audit trail. Returns a new structure; the
 * input is never mutated.
 * @param {unknown} value
 * @returns {unknown}
 */
export function sanitizeAuditValue(value) {
  return walk(value, new WeakSet());
}

/**
 * @param {unknown} value
 * @returns {string|null}
 */
function toJson(value) {
  return value === undefined || value === null ? null : JSON.stringify(sanitizeAuditValue(value));
}

/**
 * Append an audit record. `before`, `after` and `meta` are sanitized first
 * (phones masked, secrets/OTPs/tokens/prompts redacted).
 * @param {{query: (sql: string, params?: unknown[]) => Promise<{rows: any[]}>}} db
 * @param {{
 *   actorId?: string|null, actorRole?: string|null, action: string,
 *   targetType?: string|null, targetId?: string|number|null,
 *   before?: unknown, after?: unknown, ipHash?: string|null, meta?: unknown
 * }} event
 * @returns {Promise<string>} inserted row id
 */
export async function audit(db, event) {
  if (typeof event?.action !== "string" || event.action === "") {
    throw new TypeError("audit: action is required");
  }
  const { rows } = await db.query(
    `insert into audit_logs
       (actor_id, actor_role, action, target_type, target_id, before, after, ip_hash, meta)
     values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9::jsonb)
     returning id`,
    [
      event.actorId ?? null,
      event.actorRole ?? null,
      event.action,
      event.targetType ?? null,
      event.targetId === undefined || event.targetId === null ? null : String(event.targetId),
      toJson(event.before),
      toJson(event.after),
      event.ipHash ?? null,
      toJson(event.meta),
    ],
  );
  return rows[0].id;
}
