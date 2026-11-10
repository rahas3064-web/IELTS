// /api/account/*: optional e-mail + password (second login method) and the
// dismissible "add a second way to sign in" card (spec S1).
import express from "express";
import { audit } from "../core/audit.js";
import { ApiError } from "../core/errors.js";
import { toLatinDigits } from "../core/phone.js";
import { parseBody, v } from "../core/validate.js";
import { enforceLimit } from "../auth/limits.js";
import { hashPassword, verifyPassword } from "../passwords.js";
import { isUniqueViolation, wrap } from "./util.js";
import { toPublicUser } from "./me-payload.js";

const RECENT_OTP_MS = 10 * 60_000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const CHANGE_LIMIT = { max: 10, windowSec: 3600 };

const emailPasswordSchema = v.object({
  email: v.string({ min: 3, max: 254, pattern: EMAIL_RE, transform: (s) => s.toLowerCase() }),
  password: v.string({ min: 8, max: 128, trim: false }),
  currentPassword: v.optional(v.string({ min: 1, max: 128, trim: false })),
  otpCode: v.optional(v.string({ pattern: /^\d{5}$/, transform: toLatinDigits })),
});

const reauthRequired = (reason) =>
  new ApiError(403, "forbidden", {
    fa: "برای تغییر روش ورود باید هویتت رو دوباره تأیید کنی (رمز فعلی یا کد پیامکی).",
    en: "Confirm it's you first (current password or an SMS code) to change your sign-in method.",
    details: { reason },
  });

/** @param {ReturnType<import("../auth/context.js").createAuthContext>} ctx */
export function accountRoutes(ctx) {
  const router = express.Router();
  const { db, now } = ctx;
  const auth = ctx.requireUser();

  /** Current password, a fresh OTP code, or an OTP login in the last 10 minutes. */
  async function reauthenticate(user, { currentPassword, otpCode }) {
    if (currentPassword !== undefined) {
      const { rows } = await db.query("select password_hash from users where id = $1", [user.id]);
      const ok = rows[0]?.password_hash ? await verifyPassword(currentPassword, rows[0].password_hash) : false;
      if (!ok) throw reauthRequired("wrong_current_password");
      return;
    }
    if (otpCode !== undefined) {
      await ctx.otp.verify({ phone: user.phone, purpose: "login", code: otpCode });
      return;
    }
    const recent = await ctx.otp.hasRecentVerification({ phone: user.phone, purpose: "login", withinMs: RECENT_OTP_MS });
    if (!recent) throw reauthRequired("reauth_required");
  }

  router.put(
    "/email-password",
    ctx.originGuard,
    auth,
    wrap(async (req, res) => {
      const body = parseBody(emailPasswordSchema, req.body);
      await enforceLimit(db, `acct:emailpw:${req.user.id}`, CHANGE_LIMIT.max, CHANGE_LIMIT.windowSec);
      await reauthenticate(req.user, body);
      const passwordHash = await hashPassword(body.password);
      let row;
      try {
        const result = await db.query(
          `update users set email = $2, email_verified_at = null, password_hash = $3
           where id = $1
           returning id, phone, first_name, last_name, email, role, locale, status, true as has_password`,
          [req.user.id, body.email, passwordHash],
        );
        row = result.rows[0];
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        throw new ApiError(409, "conflict", {
          fa: "این ایمیل قبلاً برای حساب دیگه‌ای استفاده شده.",
          en: "This email is already used by another account.",
          details: { field: "email" },
        });
      }
      await audit(db, {
        actorId: req.user.id,
        actorRole: req.user.role,
        action: "account_email_password_set",
        targetType: "user",
        targetId: req.user.id,
        ipHash: ctx.ipHash(req),
        meta: { phone: req.user.phone, hadPassword: req.user.hasPassword },
      });
      res.json({ user: toPublicUser(row) });
    }),
  );

  router.post(
    "/email-card/dismiss",
    ctx.originGuard,
    auth,
    wrap(async (req, res) => {
      await db.query(
        `insert into learner_profiles (user_id, email_card_dismissed_at) values ($1, $2)
         on conflict (user_id) do update
           set email_card_dismissed_at = coalesce(learner_profiles.email_card_dismissed_at, excluded.email_card_dismissed_at)`,
        [req.user.id, now()],
      );
      res.json({ ok: true });
    }),
  );

  return router;
}
