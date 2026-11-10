// OTP service (spec S1). The code exists in plain text only in memory and in the
// SMS; the database holds HMAC-SHA256(code, OTP_PEPPER). A code can be consumed
// once, even under concurrency, because consumption is a single guarded UPDATE.
import { randomInt } from "node:crypto";
import { ApiError } from "../core/errors.js";
import { enforceLimit } from "./limits.js";
import { hmacHex, safeEqualHex } from "./tokens.js";

const PHONE_LIMIT = { max: 5, windowSec: 3600 };
const IP_LIMIT = { max: 20, windowSec: 3600 };
const DEFAULTS = Object.freeze({ length: 5, ttlSec: 120, resendSec: 60, maxAttempts: 5, lockMinutes: 15 });

const positiveInt = (value, fallback) => (Number.isInteger(value) && value > 0 ? value : fallback);

/** Read system_settings 'otp'; every field falls back to the spec default. */
async function loadSettings(db) {
  const { rows } = await db.query("select value from system_settings where key = 'otp'");
  const stored = rows[0]?.value ?? {};
  return {
    length: DEFAULTS.length,
    ttlSec: positiveInt(stored.ttlSec, DEFAULTS.ttlSec),
    resendSec: positiveInt(stored.resendSec, DEFAULTS.resendSec),
    maxAttempts: positiveInt(stored.maxAttempts, DEFAULTS.maxAttempts),
    lockMinutes: positiveInt(stored.lockMinutes, DEFAULTS.lockMinutes),
  };
}

const generateCode = (length) => String(randomInt(0, 10 ** length)).padStart(length, "0");

const invalidCode = (attemptsLeft) =>
  new ApiError(400, "validation_failed", {
    fa: "کد واردشده درست نیست یا منقضی شده.",
    en: "The code is incorrect or has expired.",
    details: { field: "code", ...(attemptsLeft === undefined ? {} : { attemptsLeft }) },
  });

/**
 * @param {{
 *   db: import("../db.js").Database,
 *   pepper: string,
 *   sms: {sendVerify: (phone: string, template: string, params: Record<string, string>) => Promise<unknown>},
 *   now?: () => Date,
 * }} deps
 */
export function createOtpService({ db, pepper, sms, now = () => new Date() }) {
  const hashCode = (code) => hmacHex(pepper, code);
  const bucketKey = (kind, value) => `otp:${kind}:${hmacHex(pepper, value).slice(0, 32)}`;

  async function activeLock(phone, purpose, at) {
    const { rows } = await db.query(
      "select locked_until from otp_locks where phone = $1 and purpose = $2 and locked_until > $3",
      [phone, purpose, at],
    );
    return rows[0] ? new Date(rows[0].locked_until) : null;
  }

  const lockedError = (until, at) =>
    new ApiError(423, "otp_locked", { details: { retryAfter: Math.max(1, Math.ceil((until - at) / 1000)) } });

  async function assertNotLocked(phone, purpose, at) {
    const until = await activeLock(phone, purpose, at);
    if (until) throw lockedError(until, at);
  }

  async function assertResendAllowed(phone, purpose, at, resendSec) {
    const { rows } = await db.query(
      "select max(last_sent_at) as last_sent_at from otp_codes where phone = $1 and purpose = $2",
      [phone, purpose],
    );
    if (!rows[0]?.last_sent_at) return;
    const allowedAt = new Date(rows[0].last_sent_at).getTime() + resendSec * 1000;
    if (allowedAt > at.getTime()) {
      throw new ApiError(429, "rate_limited", { details: { retryAfter: Math.ceil((allowedAt - at.getTime()) / 1000) } });
    }
  }

  return {
    /**
     * Create and send a code. Never reveals whether the phone has an account.
     * @param {{phone: string, purpose: string, ip: string}} input phone already normalised
     * @returns {Promise<{resendAfterSec: number, expiresInSec: number}>}
     */
    async request({ phone, purpose, ip }) {
      const at = now();
      const settings = await loadSettings(db);
      await assertNotLocked(phone, purpose, at);
      await assertResendAllowed(phone, purpose, at, settings.resendSec);
      await enforceLimit(db, bucketKey("phone", `${purpose}:${phone}`), PHONE_LIMIT.max, PHONE_LIMIT.windowSec);
      await enforceLimit(db, bucketKey("ip", String(ip)), IP_LIMIT.max, IP_LIMIT.windowSec);

      const code = generateCode(settings.length);
      const expiresAt = new Date(at.getTime() + settings.ttlSec * 1000);
      const codeId = await db.transaction(async (tx) => {
        // Only the newest code may work: older live ones are expired, never "consumed".
        await tx.query(
          "update otp_codes set expires_at = $3 where phone = $1 and purpose = $2 and consumed_at is null and expires_at > $3",
          [phone, purpose, at],
        );
        const { rows } = await tx.query(
          `insert into otp_codes (phone, purpose, code_hash, expires_at, last_sent_at, created_at)
           values ($1, $2, $3, $4, $5, $5) returning id`,
          [phone, purpose, hashCode(code), expiresAt, at],
        );
        return rows[0].id;
      });

      try {
        await sms.sendVerify(phone, "otp", { CODE: code });
      } catch (error) {
        // Nothing reached the user, so do not make them wait out the resend window.
        await db.query("delete from otp_codes where id = $1", [codeId]);
        throw error;
      }
      return { resendAfterSec: settings.resendSec, expiresInSec: settings.ttlSec };
    },

    /**
     * Check a code and consume it. Throws on wrong/expired/locked; resolves true on success.
     * @param {{phone: string, purpose: string, code: string}} input
     */
    async verify({ phone, purpose, code }) {
      const at = now();
      const settings = await loadSettings(db);
      await assertNotLocked(phone, purpose, at);

      const { rows } = await db.query(
        `select id, code_hash, attempts from otp_codes
         where phone = $1 and purpose = $2 and consumed_at is null and expires_at > $3
         order by created_at desc, last_sent_at desc limit 1`,
        [phone, purpose, at],
      );
      const current = rows[0];
      if (!current) throw invalidCode();

      if (!safeEqualHex(hashCode(code), current.code_hash)) {
        // Bump, lock and kill the code in ONE transaction so "attempts >= max" can never exist without a lock.
        const outcome = await db.transaction(async (tx) => {
          const bumped = await tx.query(
            "update otp_codes set attempts = attempts + 1 where id = $1 returning attempts",
            [current.id],
          );
          const attempts = Number(bumped.rows[0]?.attempts ?? settings.maxAttempts);
          if (attempts < settings.maxAttempts) return { attempts, until: null };
          const until = new Date(at.getTime() + settings.lockMinutes * 60_000);
          await tx.query(
            `insert into otp_locks (phone, purpose, locked_until) values ($1, $2, $3)
             on conflict (phone, purpose) do update set locked_until = excluded.locked_until`,
            [phone, purpose, until],
          );
          // Kill the attacked code (expired, not consumed: it must not count as a verification).
          await tx.query("update otp_codes set expires_at = $2 where id = $1 and expires_at > $2", [current.id, at]);
          return { attempts, until };
        });
        if (outcome.until) throw lockedError(outcome.until, at);
        throw invalidCode(settings.maxAttempts - outcome.attempts);
      }

      const consumed = await db.query(
        `update otp_codes set consumed_at = $2
         where id = $1 and consumed_at is null and expires_at > $2 returning id`,
        [current.id, at],
      );
      if (consumed.rows.length !== 1) throw invalidCode();
      return true;
    },

    /** True when this phone passed OTP verification for `purpose` within the last `withinMs`. */
    async hasRecentVerification({ phone, purpose, withinMs }) {
      const since = new Date(now().getTime() - withinMs);
      const { rows } = await db.query(
        "select 1 from otp_codes where phone = $1 and purpose = $2 and consumed_at is not null and consumed_at > $3 limit 1",
        [phone, purpose, since],
      );
      return rows.length > 0;
    },
  };
}
