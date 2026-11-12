// AUTH_DEV_BYPASS: a local-only switch for days when SMS delivery is not available.
// When on, the real login/sign-up forms skip only the SMS code step; the account is
// still created or looked up from what the person typed and gets a real session.
// It is off unless the value is exactly true, and always off in production.
import { ApiError } from "../core/errors.js";

/** @param {Record<string, any>} [config] validated env (validateEnv().config) or a test config */
export function isDevBypassEnabled(config = {}) {
  if (config.NODE_ENV === "production") return false;
  return config.AUTH_DEV_BYPASS === true || config.AUTH_DEV_BYPASS === "true";
}

/** The bypass routes look like they do not exist when the switch is off. */
export function assertDevBypass(ctx) {
  if (!ctx.devBypass) throw new ApiError(404, "not_found");
}
