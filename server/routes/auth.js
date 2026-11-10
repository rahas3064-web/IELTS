// /api/auth/*: OTP request/verify, register, password login, logout (spec S1).
import { randomBytes } from "node:crypto";
import express from "express";
import { audit } from "../core/audit.js";
import { ApiError } from "../core/errors.js";
import { toLatinDigits } from "../core/phone.js";
import { parseBody, v } from "../core/validate.js";
import { enforceLimit } from "../auth/limits.js";
import { issueSignupToken, readSignupToken, sha256Hex } from "../auth/tokens.js";
import { clientAddress } from "../rate-limit.js";
import { hashPassword, verifyPassword } from "../passwords.js";
import { fieldFailure, isUniqueViolation, requirePhone, wrap } from "./util.js";
import { toPublicUser } from "./me-payload.js";
import { registerLearner } from "./register.js";

const SIGNUP_TOKEN_TTL_MS = 10 * 60_000;
const PASSWORD_LOGIN_EMAIL_LIMIT = { max: 5, windowSec: 900 };
const PASSWORD_LOGIN_IP_LIMIT = { max: 30, windowSec: 900 };
const USER_COLUMNS = `id, phone, first_name, last_name, email, role, locale, status, (password_hash is not null) as has_password`;

const requestSchema = v.object({ phone: v.string({ min: 1, max: 40 }) });
const verifySchema = v.object({
  phone: v.string({ min: 1, max: 40 }),
  code: v.string({ pattern: /^\d{5}$/, transform: toLatinDigits }),
});
const registerSchema = v.object({
  signupToken: v.string({ min: 1, max: 2048 }),
  firstName: v.string({ min: 1, max: 60 }),
  lastName: v.string({ min: 1, max: 60 }),
  referralCode: v.optional(v.string({ max: 64 })),
});
const passwordLoginSchema = v.object({
  email: v.string({ min: 1, max: 254, transform: (s) => s.toLowerCase() }),
  password: v.string({ min: 1, max: 128, trim: false }),
});

// Verifying against a throw-away hash when the account is missing keeps the
// response time of "unknown email" close to "wrong password".
let dummyHashPromise = null;
const dummyHash = () => (dummyHashPromise ??= hashPassword(randomBytes(16).toString("hex")));

const genericLoginFailure = () =>
  new ApiError(401, "unauthenticated", {
    fa: "ایمیل یا رمز عبور درست نیست.",
    en: "The email or password is incorrect.",
  });

/** @param {ReturnType<import("../auth/context.js").createAuthContext>} ctx */
export function authRoutes(ctx) {
  const router = express.Router();
  const { db, secret, now } = ctx;
  const actorRoleOf = (row) => row.role;

  /** Start a session for an existing, non-blocked user and audit the login. */
  async function logIn(req, res, row, method) {
    if (row.status === "blocked") throw new ApiError(403, "blocked");
    const started = await ctx.sessions.start({
      userId: row.id,
      userAgent: req.get("user-agent"),
      ip: clientAddress(req),
      actorRole: actorRoleOf(row),
    });
    ctx.startSessionCookie(res, started);
    await audit(db, {
      actorId: row.id,
      actorRole: actorRoleOf(row),
      action: method === "otp" ? "auth_login" : "auth_password_login",
      targetType: "user",
      targetId: row.id,
      ipHash: ctx.ipHash(req),
      meta: { method, phone: row.phone },
    });
    return toPublicUser(row);
  }

  router.post(
    "/otp/request",
    ctx.originGuard,
    wrap(async (req, res) => {
      const { phone } = parseBody(requestSchema, req.body);
      const result = await ctx.otp.request({ phone: requirePhone(phone), purpose: "login", ip: clientAddress(req) });
      res.json({ ok: true, ...result });
    }),
  );

  router.post(
    "/otp/verify",
    ctx.originGuard,
    wrap(async (req, res) => {
      const body = parseBody(verifySchema, req.body);
      const phone = requirePhone(body.phone);
      await ctx.otp.verify({ phone, purpose: "login", code: body.code });
      const { rows } = await db.query(`select ${USER_COLUMNS} from users where phone = $1`, [phone]);
      if (rows[0]) {
        res.json({ user: await logIn(req, res, rows[0], "otp") });
        return;
      }
      res.json({ needsProfile: true, signupToken: issueSignupToken(secret, { phone, now: now(), ttlMs: SIGNUP_TOKEN_TTL_MS }) });
    }),
  );

  router.post(
    "/register",
    ctx.originGuard,
    wrap(async (req, res) => {
      const body = parseBody(registerSchema, req.body);
      const claim = readSignupToken(secret, body.signupToken, { now: now() });
      if (!claim) {
        throw new ApiError(400, "validation_failed", {
          fa: "اعتبار تأیید شماره تموم شده. دوباره کد بگیر.",
          en: "Your phone verification expired. Request a new code.",
          details: { field: "signupToken" },
        });
      }
      let created;
      try {
        created = await registerLearner(ctx, req, { phone: claim.phone, ...body });
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new ApiError(409, "conflict", {
            fa: "با این شماره قبلاً ثبت‌نام شده. وارد شو.",
            en: "This phone number is already registered. Sign in instead.",
          });
        }
        throw error;
      }
      ctx.startSessionCookie(res, created.started);
      res.status(201).json({ user: created.user, referral: created.referral });
    }),
  );

  router.post(
    "/password/login",
    ctx.originGuard,
    wrap(async (req, res) => {
      const { email, password } = parseBody(passwordLoginSchema, req.body);
      if (!email.includes("@")) throw fieldFailure("email", "invalid_format");
      await enforceLimit(db, `pwlogin:ip:${sha256Hex(clientAddress(req)).slice(0, 32)}`, PASSWORD_LOGIN_IP_LIMIT.max, PASSWORD_LOGIN_IP_LIMIT.windowSec);
      await enforceLimit(db, `pwlogin:email:${sha256Hex(email).slice(0, 32)}`, PASSWORD_LOGIN_EMAIL_LIMIT.max, PASSWORD_LOGIN_EMAIL_LIMIT.windowSec);
      const { rows } = await db.query(`select ${USER_COLUMNS}, password_hash from users where lower(email) = $1`, [email]);
      const row = rows[0];
      const matches = await verifyPassword(password, row?.password_hash ?? (await dummyHash()));
      if (!row?.password_hash || !matches) throw genericLoginFailure();
      res.json({ user: await logIn(req, res, row, "password") });
    }),
  );

  router.post(
    "/logout",
    ctx.originGuard,
    wrap(async (req, res) => {
      const revoked = await ctx.sessions.revokeFromCookie(req.headers.cookie, "logout");
      if (revoked) {
        const { rows } = await db.query("select role from users where id = $1", [revoked.userId]);
        await audit(db, {
          actorId: revoked.userId,
          actorRole: rows[0]?.role ?? "learner",
          action: "auth_logout",
          targetType: "session",
          targetId: revoked.sessionId,
          ipHash: ctx.ipHash(req),
        });
      }
      ctx.clearSessionCookie(res);
      res.json({ ok: true });
    }),
  );

  return router;
}
