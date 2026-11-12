// Builds the auth services once per createApi(). Dependencies are injectable so
// tests need no real environment: secrets, clock and SMS sender come from options.
import { randomBytes } from "node:crypto";
import { clientAddress } from "../rate-limit.js";
import { audit } from "../core/audit.js";
import { ApiError } from "../core/errors.js";
import { hasPermission, isAdminRole } from "../authz.js";
import { ADMIN_SESSION_COOKIE, clearSessionCookie, setSessionCookie } from "./cookies.js";
import { createOriginGuard } from "./csrf.js";
import { createOtpService } from "./otp.js";
import { createSessionService } from "./sessions.js";
import { createSmsSender } from "./sms.js";
import { isDevBypassEnabled } from "./dev-bypass.js";

/**
 * @param {import("../db.js").Database} db
 * @param {{config?: Record<string, any>, sms?: {sendVerify: Function}, now?: () => Date, logger?: any}} [options]
 *   config is the validated env (validateEnv().config)
 */
export function createAuthContext(db, options = {}) {
  const config = options.config ?? {};
  const production = config.NODE_ENV === "production";
  const secure = production;
  // Outside production a missing secret becomes a per-process random one (sessions
  // then do not survive a restart); production already failed fast in assertEnv().
  const secretFor = (name) => {
    if (config[name]) return config[name];
    if (production) throw new Error(`${name} is required in production`);
    return randomBytes(32).toString("hex");
  };
  const secret = secretFor("SESSION_SECRET");
  const pepper = secretFor("OTP_PEPPER");
  const now = options.now ?? (() => new Date());
  const sms = options.sms ?? createSmsSender({ env: config, db, logger: options.logger });
  const sessions = createSessionService({ db, secret, now });
  const otp = createOtpService({ db, pepper, sms, now });
  const originGuard = createOriginGuard({ appBaseUrl: config.APP_BASE_URL });

  /** Express middleware factory: attaches req.user / req.session or fails with the right ApiError. */
  const requireUser = (authOptions = {}) => async (req, _res, next) => {
    try {
      const { user, session } = await sessions.authenticate(req.headers.cookie, authOptions);
      req.user = user;
      req.session = session;
      next();
    } catch (error) {
      next(error);
    }
  };

  const requireAdmin = () => async (req, res, next) => {
    try {
      const { user, session } = await sessions.authenticate(req.headers.cookie, { kind: "admin" });
      if (!isAdminRole(user.role)) throw new ApiError(403, "forbidden");
      req.user = user;
      req.session = session;
      next();
    } catch (error) {
      next(error);
    }
  };

  const requirePermission = (permission) => async (req, res, next) => {
    requireAdmin()(req, res, async (error) => {
      if (error) {
        next(error);
        return;
      }
      if (hasPermission(req.user.role, permission)) {
        next();
        return;
      }
      await audit(db, {
        actorId: req.user.id,
        actorRole: req.user.role,
        action: "admin_access_denied",
        targetType: "permission",
        targetId: permission,
        ipHash: sessions.ipHash(clientAddress(req)),
      });
      next(new ApiError(403, "forbidden"));
    });
  };

  return Object.freeze({
    db,
    secret,
    now,
    sms,
    otp,
    sessions,
    originGuard,
    /** AUTH_DEV_BYPASS: local-only, never true in production (see dev-bypass.js). */
    devBypass: isDevBypassEnabled(config),
    requireUser,
    requireAdmin,
    requirePermission,
    ipHash: (req) => sessions.ipHash(clientAddress(req)),
    startSessionCookie: (res, started) => setSessionCookie(res, started.cookieValue, { secure, maxAgeMs: started.maxAgeMs }),
    clearSessionCookie: (res) => clearSessionCookie(res, { secure }),
    startAdminSessionCookie: (res, started) =>
      setSessionCookie(res, started.cookieValue, { secure, maxAgeMs: started.maxAgeMs, name: ADMIN_SESSION_COOKIE }),
    clearAdminSessionCookie: (res) => clearSessionCookie(res, { secure, name: ADMIN_SESSION_COOKIE }),
  });
}
