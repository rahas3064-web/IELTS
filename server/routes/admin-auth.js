// /api/admin/auth/* : phone OTP (purpose admin_login) plus the admin password.
// Does not create users or change roles. The first password is set here only
// when the account is already an admin (CLI bootstrap or a later in-panel promotion).
import { randomBytes } from "node:crypto";
import express from "express";
import { audit } from "../core/audit.js";
import { ApiError } from "../core/errors.js";
import { toLatinDigits } from "../core/phone.js";
import { parseBody, v } from "../core/validate.js";
import { enforceLimit } from "../auth/limits.js";
import { assertDevBypass } from "../auth/dev-bypass.js";
import { isAdminRole, PERMISSIONS, permissionsFor } from "../authz.js";
import { hashPassword, verifyPassword } from "../passwords.js";
import { clientAddress } from "../rate-limit.js";
import { issueGateToken, readGateToken, sha256Hex } from "../auth/tokens.js";
import { requirePhone, wrap } from "./util.js";

const GATE = "admin-gate";
const GATE_TTL_MS = 10 * 60_000;
const PASSWORD_LIMIT = { max: 5, windowSec: 900 };
const USER_COLUMNS = `id, phone, first_name, last_name, role, status`;

const phoneSchema = v.object({ phone: v.string({ min: 1, max: 40 }) });
const verifySchema = v.object({
  phone: v.string({ min: 1, max: 40 }),
  code: v.string({ pattern: /^\d{5}$/, transform: toLatinDigits }),
});
const passwordSchema = v.object({
  gate: v.string({ min: 1, max: 2048 }),
  password: v.string({ min: 8, max: 128, trim: false }),
});

let dummyHashPromise = null;
const dummyHash = () => (dummyHashPromise ??= hashPassword(randomBytes(16).toString("hex")));

const genericFailure = () =>
  new ApiError(401, "unauthenticated", {
    fa: "شماره، کد یا رمز مدیریت درست نیست.",
    en: "The phone, code, or admin password is incorrect.",
  });

/** @param {ReturnType<import("../auth/context.js").createAuthContext>} ctx */
export function adminAuthRoutes(ctx) {
  const router = express.Router();
  const { db, secret, now } = ctx;

  async function adminByPhone(phone) {
    const { rows } = await db.query(`select ${USER_COLUMNS} from users where phone = $1`, [phone]);
    const row = rows[0];
    if (!row || !isAdminRole(row.role) || row.status === "blocked") return null;
    return row;
  }

  function issueGate(phone, mode) {
    return issueGateToken(secret, GATE, { p: phone, m: mode }, { now: now(), ttlMs: GATE_TTL_MS });
  }

  function readGate(token, mode) {
    const parsed = readGateToken(secret, GATE, token, { now: now() });
    if (!parsed || parsed.m !== mode || typeof parsed.p !== "string") return null;
    return parsed.p;
  }

  /** Next step after the phone is accepted: the admin password (or its first-time setup). */
  async function passwordGate(admin, phone) {
    const { rows } = await db.query("select 1 from admin_credentials where user_id = $1", [admin.id]);
    const mode = rows[0] ? "login" : "setup";
    return { needsPasswordSetup: mode === "setup", gate: issueGate(phone, mode) };
  }

  async function startAdmin(req, res, row, action) {
    const started = await ctx.sessions.start({
      userId: row.id,
      kind: "admin",
      userAgent: req.get("user-agent"),
      ip: clientAddress(req),
      actorRole: row.role,
    });
    ctx.startAdminSessionCookie(res, started);
    await audit(db, {
      actorId: row.id,
      actorRole: row.role,
      action,
      targetType: "user",
      targetId: row.id,
      ipHash: ctx.ipHash(req),
    });
    return { role: row.role, permissions: permissionsFor(row.role) };
  }

  router.post(
    "/otp/request",
    ctx.originGuard,
    wrap(async (req, res) => {
      const { phone } = parseBody(phoneSchema, req.body);
      const normalised = requirePhone(phone);
      const admin = await adminByPhone(normalised);
      if (admin) {
        const result = await ctx.otp.request({ phone: normalised, purpose: "admin_login", ip: clientAddress(req) });
        res.json({ ok: true, ...result });
        return;
      }
      res.json({ ok: true, resendAfterSec: 60, expiresInSec: 120 });
    }),
  );

  router.post(
    "/otp/verify",
    ctx.originGuard,
    wrap(async (req, res) => {
      const body = parseBody(verifySchema, req.body);
      const phone = requirePhone(body.phone);
      await ctx.otp.verify({ phone, purpose: "admin_login", code: body.code });
      const admin = await adminByPhone(phone);
      if (!admin) throw genericFailure();
      res.json(await passwordGate(admin, phone));
    }),
  );

  // Local-only (AUTH_DEV_BYPASS=true): skips only the SMS code. The account must already
  // be an admin and the admin password step still follows. 404 when the switch is off.
  router.post(
    "/dev-bypass/phone",
    ctx.originGuard,
    wrap(async (req, res) => {
      assertDevBypass(ctx);
      const { phone } = parseBody(phoneSchema, req.body);
      const normalised = requirePhone(phone);
      await enforceLimit(db, `adminbypass:ip:${sha256Hex(clientAddress(req)).slice(0, 32)}`, PASSWORD_LIMIT.max * 6, PASSWORD_LIMIT.windowSec);
      const admin = await adminByPhone(normalised);
      if (!admin) throw genericFailure();
      res.json(await passwordGate(admin, normalised));
    }),
  );

  router.post(
    "/password",
    ctx.originGuard,
    wrap(async (req, res) => {
      const body = parseBody(passwordSchema, req.body);
      const phone = readGate(body.gate, "login");
      if (!phone) throw genericFailure();
      await enforceLimit(db, `adminpw:${sha256Hex(phone).slice(0, 32)}`, PASSWORD_LIMIT.max, PASSWORD_LIMIT.windowSec);
      const admin = await adminByPhone(phone);
      const { rows } = admin
        ? await db.query("select password_hash from admin_credentials where user_id = $1", [admin.id])
        : { rows: [] };
      const matches = await verifyPassword(body.password, rows[0]?.password_hash ?? (await dummyHash()));
      if (!admin || !rows[0] || !matches) throw genericFailure();
      res.json(await startAdmin(req, res, admin, "admin_login"));
    }),
  );

  router.post(
    "/password/setup",
    ctx.originGuard,
    wrap(async (req, res) => {
      const body = parseBody(passwordSchema, req.body);
      const phone = readGate(body.gate, "setup");
      if (!phone) throw genericFailure();
      const admin = await adminByPhone(phone);
      if (!admin) throw genericFailure();
      const passwordHash = await hashPassword(body.password);
      const inserted = await db.query(
        `insert into admin_credentials (user_id, password_hash) values ($1, $2)
         on conflict (user_id) do nothing returning user_id`,
        [admin.id, passwordHash],
      );
      if (inserted.rows.length === 0) throw genericFailure();
      await audit(db, {
        actorId: admin.id,
        actorRole: admin.role,
        action: "admin_password_set",
        targetType: "user",
        targetId: admin.id,
        ipHash: ctx.ipHash(req),
      });
      res.status(201).json(await startAdmin(req, res, admin, "admin_login"));
    }),
  );

  router.post(
    "/logout",
    ctx.originGuard,
    wrap(async (req, res) => {
      const revoked = await ctx.sessions.revokeFromCookie(req.headers.cookie, "logout", { kind: "admin" });
      if (revoked) {
        const { rows } = await db.query("select role from users where id = $1", [revoked.userId]);
        await audit(db, {
          actorId: revoked.userId,
          actorRole: rows[0]?.role ?? "learner",
          action: "admin_logout",
          targetType: "session",
          targetId: revoked.sessionId,
          ipHash: ctx.ipHash(req),
        });
      }
      ctx.clearAdminSessionCookie(res);
      res.json({ ok: true });
    }),
  );

  return router;
}

/** Session + role + permission guards. Probe route exists so each permission can be refused with 403. */
export function adminGuardRoutes(ctx) {
  const router = express.Router();
  const admin = ctx.requireAdmin();

  router.get(
    "/me",
    admin,
    wrap(async (req, res) => {
      res.json({
        user: {
          id: req.user.id,
          firstName: req.user.firstName,
          lastName: req.user.lastName,
          role: req.user.role,
        },
        permissions: permissionsFor(req.user.role),
      });
    }),
  );

  router.get(
    "/audit",
    ctx.requirePermission("audit.read"),
    wrap(async (req, res) => {
      const { rows } = await ctx.db.query(
        `select id, actor_role, action, target_type, created_at
         from audit_logs order by created_at desc limit 50`,
      );
      res.json({
        items: rows.map((row) => ({
          id: row.id,
          actorRole: row.actor_role,
          action: row.action,
          targetType: row.target_type,
          createdAt: row.created_at,
        })),
      });
    }),
  );

  router.get(
    "/guard/:permission",
    (req, res, next) => {
      if (!PERMISSIONS.includes(req.params.permission)) {
        next();
        return;
      }
      ctx.requirePermission(req.params.permission)(req, res, next);
    },
    (_req, res) => {
      res.json({ ok: true });
    },
  );

  return router;
}
