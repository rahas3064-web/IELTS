// Single-active-session service (spec S1). A new login replaces the old session in
// the same transaction; the old device learns about it on its next request.
// Only the SHA-256 of the token is stored. The cookie carries `token.signature`.
import { ApiError } from "../core/errors.js";
import { audit } from "../core/audit.js";
import { SESSION_COOKIE, parseCookies } from "./cookies.js";
import { hmacHex, newSessionToken, sha256Hex, signValue, unsignValue } from "./tokens.js";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** Learner: 30 days, sliding. Admin (wired in S12): 8 h absolute, 30 min idle. */
export const SESSION_POLICY = Object.freeze({
  learner: Object.freeze({ ttlMs: 30 * DAY_MS, idleMs: null, sliding: true }),
  admin: Object.freeze({ ttlMs: 8 * HOUR_MS, idleMs: 30 * MINUTE_MS, sliding: false }),
});

const TOUCH_INTERVAL_MS = MINUTE_MS;
const UNIQUE_VIOLATION = "23505";

/**
 * @param {{db: import("../db.js").Database, secret: string, now?: () => Date}} deps
 */
export function createSessionService({ db, secret, now = () => new Date() }) {
  const ipHash = (ip) => hmacHex(secret, `ip:${ip}`);

  /** Revoke the active session of (user, kind) and insert a new one, on `executor`. */
  async function replaceIn(executor, { userId, kind, userAgent, ip, actorRole }) {
    const at = now();
    const policy = SESSION_POLICY[kind];
    const revoked = await executor.query(
      `update sessions set revoked_at = $3, revoked_reason = 'replaced'
       where user_id = $1 and kind = $2 and revoked_at is null returning id`,
      [userId, kind, at],
    );
    const token = newSessionToken();
    const expiresAt = new Date(at.getTime() + policy.ttlMs);
    await executor.query(
      `insert into sessions (user_id, kind, token_hash, user_agent, ip_hash, created_at, last_seen_at, expires_at)
       values ($1, $2, $3, $4, $5, $6, $6, $7)`,
      [userId, kind, sha256Hex(token), String(userAgent ?? "").slice(0, 300) || null, ip ? ipHash(ip) : null, at, expiresAt],
    );
    if (revoked.rows.length > 0) {
      await audit(executor, {
        actorId: userId,
        actorRole,
        action: "session_replaced",
        targetType: "session",
        targetId: revoked.rows[0].id,
        ipHash: ip ? ipHash(ip) : null,
      });
    }
    return { cookieValue: signValue(secret, token), expiresAt, maxAgeMs: policy.ttlMs, replaced: revoked.rows.length > 0 };
  }

  return {
    ipHash,

    /**
     * Create a session inside an existing transaction (e.g. registration).
     * @param {{query: Function}} tx
     */
    startIn: replaceIn,

    /** Create a session in its own transaction (retried once if two logins race). */
    async start({ userId, kind = "learner", userAgent, ip, actorRole = "learner" }) {
      for (let attempt = 1; ; attempt += 1) {
        try {
          return await db.transaction((tx) => replaceIn(tx, { userId, kind, userAgent, ip, actorRole }));
        } catch (error) {
          if (error?.code !== UNIQUE_VIOLATION || attempt >= 2) throw error;
        }
      }
    },

    /** Revoke every active session of a user (block, delete, admin force logout). */
    async revokeAll(executor, userId, reason) {
      await executor.query(
        "update sessions set revoked_at = $3, revoked_reason = $2 where user_id = $1 and revoked_at is null",
        [userId, reason, now()],
      );
    },

    /** Revoke the session behind a cookie header (logout). Returns the user id, or null if none was active. */
    async revokeFromCookie(cookieHeader, reason) {
      const token = unsignValue(secret, parseCookies(cookieHeader)[SESSION_COOKIE]);
      if (!token) return null;
      const { rows } = await db.query(
        `update sessions set revoked_at = $2, revoked_reason = $3
         where token_hash = $1 and revoked_at is null returning id, user_id`,
        [sha256Hex(token), now(), reason],
      );
      return rows[0] ? { sessionId: rows[0].id, userId: rows[0].user_id } : null;
    },

    /**
     * Resolve the session behind a request or throw the right ApiError.
     * @param {string|undefined} cookieHeader
     * @param {{kind?: 'learner'|'admin', allowPendingDeletion?: boolean}} [options]
     */
    async authenticate(cookieHeader, { kind = "learner", allowPendingDeletion = false } = {}) {
      const token = unsignValue(secret, parseCookies(cookieHeader)[SESSION_COOKIE]);
      if (!token) throw new ApiError(401, "unauthenticated");
      const { rows } = await db.query(
        `select s.id as session_id, s.kind, s.expires_at, s.last_seen_at, s.revoked_at, s.revoked_reason,
                u.id, u.phone, u.first_name, u.last_name, u.email, u.role, u.locale, u.status,
                (u.password_hash is not null) as has_password
         from sessions s join users u on u.id = s.user_id
         where s.token_hash = $1`,
        [sha256Hex(token)],
      );
      const row = rows[0];
      if (!row || row.kind !== kind) throw new ApiError(401, "unauthenticated");
      const at = now();

      if (row.status === "blocked") {
        if (!row.revoked_at) await this.revokeAll(db, row.id, "blocked");
        throw new ApiError(403, "blocked");
      }
      if (row.revoked_at) {
        throw new ApiError(401, row.revoked_reason === "replaced" ? "session_replaced" : "unauthenticated");
      }
      if (new Date(row.expires_at) <= at) throw new ApiError(401, "unauthenticated");
      if (row.status === "pending_deletion" && !allowPendingDeletion) {
        throw new ApiError(401, "unauthenticated", { details: { reason: "pending_deletion" } });
      }

      const policy = SESSION_POLICY[kind];
      if (at.getTime() - new Date(row.last_seen_at).getTime() >= TOUCH_INTERVAL_MS) {
        const expiresAt = policy.sliding ? new Date(at.getTime() + policy.ttlMs) : new Date(row.expires_at);
        await db.query("update sessions set last_seen_at = $2, expires_at = $3 where id = $1", [row.session_id, at, expiresAt]);
      }
      return {
        session: { id: row.session_id, kind: row.kind },
        user: {
          id: row.id,
          phone: row.phone,
          firstName: row.first_name,
          lastName: row.last_name,
          email: row.email,
          hasPassword: row.has_password,
          role: row.role,
          locale: row.locale,
          status: row.status,
        },
      };
    },
  };
}
