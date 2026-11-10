// Builds the auth services once per createApi(). Dependencies are injectable so
// tests need no real environment: secrets, clock and SMS sender come from options.
import { randomBytes } from "node:crypto";
import { clientAddress } from "../rate-limit.js";
import { clearSessionCookie, setSessionCookie } from "./cookies.js";
import { createOriginGuard } from "./csrf.js";
import { createOtpService } from "./otp.js";
import { createSessionService } from "./sessions.js";
import { createSmsSender } from "./sms.js";

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

  return Object.freeze({
    db,
    secret,
    now,
    sms,
    otp,
    sessions,
    originGuard,
    requireUser,
    ipHash: (req) => sessions.ipHash(clientAddress(req)),
    startSessionCookie: (res, started) => setSessionCookie(res, started.cookieValue, { secure, maxAgeMs: started.maxAgeMs }),
    clearSessionCookie: (res) => clearSessionCookie(res, { secure }),
  });
}
