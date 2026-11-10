/* global console */
// Uniform API error shape (spec 4.7): { error: { code, message_fa, message_en, details? } }

/**
 * @typedef {{status: number, fa: string, en: string}} ErrorSpec
 */

/** @type {Readonly<Record<string, ErrorSpec>>} */
export const CODES = Object.freeze({
  unauthenticated: {
    status: 401,
    fa: "برای ادامه باید وارد حسابت بشی.",
    en: "You need to sign in to continue.",
  },
  session_replaced: {
    status: 401,
    fa: "با یه دستگاه دیگه وارد حسابت شدی، برای همین از این دستگاه خارج شدی. اگه خودت نبودی، دوباره وارد شو.",
    en: "You signed in on another device, so you were signed out here. If that wasn't you, sign in again.",
  },
  blocked: {
    status: 403,
    fa: "دسترسی حساب تو مسدود شده. برای پیگیری با پشتیبانی تماس بگیر.",
    en: "Your account has been blocked. Contact support for help.",
  },
  forbidden: {
    status: 403,
    fa: "اجازهٔ انجام این کار رو نداری.",
    en: "You are not allowed to do this.",
  },
  not_found: {
    status: 404,
    fa: "چیزی که دنبالش بودی پیدا نشد.",
    en: "We couldn't find what you were looking for.",
  },
  validation_failed: {
    status: 400,
    fa: "اطلاعات واردشده درست نیست. یه بار دیگه بررسی کن.",
    en: "Some of the information is invalid. Please check and try again.",
  },
  rate_limited: {
    status: 429,
    fa: "درخواست‌هات زیاد بود. کمی صبر کن و دوباره امتحان کن.",
    en: "Too many requests. Please wait a bit and try again.",
  },
  quota_exhausted: {
    status: 402,
    fa: "سهمیهٔ این ماه تموم شده. برای ادامه، پلنت رو ارتقا بده.",
    en: "You've used this month's quota. Upgrade your plan to continue.",
  },
  otp_locked: {
    status: 423,
    fa: "به‌خاطر تلاش‌های ناموفق زیاد، ورود با کد موقتاً قفل شده. بعداً دوباره امتحان کن.",
    en: "Too many failed attempts. Code sign-in is temporarily locked. Try again later.",
  },
  scoring_failed: {
    status: 502,
    fa: "تصحیح هوشمند الان در دسترس نیست. نمره‌ای ثبت نشد؛ کمی بعد دوباره امتحان کن.",
    en: "AI scoring is unavailable right now. No score was recorded; please try again shortly.",
  },
  internal: {
    status: 500,
    fa: "مشکلی پیش اومد. لطفاً دوباره امتحان کن.",
    en: "Something went wrong. Please try again.",
  },
});

/**
 * Build the response body for a catalogue code.
 * @param {string} code unknown codes fall back to `internal`
 * @param {{fa?: string, en?: string, details?: unknown}} [overrides]
 * @returns {{error: {code: string, message_fa: string, message_en: string, details?: unknown}}}
 */
export function errorBody(code, overrides = {}) {
  const key = Object.hasOwn(CODES, code) ? code : "internal";
  const spec = CODES[key];
  return {
    error: {
      code: key,
      message_fa: overrides.fa ?? spec.fa,
      message_en: overrides.en ?? spec.en,
      ...(overrides.details === undefined ? {} : { details: overrides.details }),
    },
  };
}

export class ApiError extends Error {
  /**
   * @param {number} status HTTP status
   * @param {string} code key of CODES
   * @param {{fa?: string, en?: string, details?: unknown}} [options]
   */
  constructor(status, code, { fa, en, details } = {}) {
    const body = errorBody(code, { fa, en, details }).error;
    super(body.message_en);
    this.name = "ApiError";
    this.status = status;
    this.code = body.code;
    this.message_fa = body.message_fa;
    this.message_en = body.message_en;
    this.details = details;
  }
}

/** Known body-parser failures that are the client's fault. */
const CLIENT_BODY_ERRORS = Object.freeze({
  "entity.parse.failed": 400,
  "entity.too.large": 413,
});

/**
 * Express error middleware (4 args). Never leaks messages or stacks of
 * unexpected errors; logs the error object server-side, never request bodies.
 * @returns {(err: any, req: any, res: any, next: Function) => void}
 */
export function errorHandler() {
  return function apiErrorHandler(err, req, res, next) {
    if (res.headersSent) {
      next(err);
      return;
    }
    if (err instanceof ApiError) {
      if (err.code === "rate_limited" && Number.isFinite(err.details?.retryAfter)) {
        res.set("Retry-After", String(err.details.retryAfter));
      }
      res.status(err.status).json(errorBody(err.code, { fa: err.message_fa, en: err.message_en, details: err.details }));
      return;
    }
    const clientStatus = CLIENT_BODY_ERRORS[err?.type];
    if (clientStatus) {
      res.status(clientStatus).json(errorBody("validation_failed"));
      return;
    }
    console.error("[api] unhandled error", { method: req?.method, path: req?.path }, err);
    res.status(CODES.internal.status).json(errorBody("internal"));
  };
}

/**
 * Express 404 handler for unmatched API routes.
 * @param {any} _req
 * @param {any} res
 */
export function notFoundHandler(_req, res) {
  res.status(CODES.not_found.status).json(errorBody("not_found"));
}
