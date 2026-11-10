/* global console, setTimeout, AbortSignal */
// SMS.ir adapter for templated ("verify") messages. Rule D: the API key and the
// template ids come from the environment only. A code is printed in exactly one
// place, the dev console branch below, and never in live production sends.
import { ApiError } from "../core/errors.js";
import { maskPhone } from "../core/phone.js";

// VERIFY BEFORE LAUNCH: confirm this endpoint, the `x-api-key` header and the body
// shape ({mobile, templateId, parameters:[{name, value}]}) against the current
// SMS.ir developer docs (https://app.sms.ir/developer). They are written from the
// documented "send verify" API but have not been exercised against the live service.
const SMSIR_VERIFY_URL = "https://api.sms.ir/v1/send/verify";
const TEMPLATE_ENV = Object.freeze({
  otp: "SMSIR_TEMPLATE_OTP",
  study_reminder: "SMSIR_TEMPLATE_STUDY_REMINDER",
  renewal_reminder: "SMSIR_TEMPLATE_RENEWAL_REMINDER",
});
const MAX_TRIES = 2;
const BACKOFF_MS = 400;
const REQUEST_TIMEOUT_MS = 8000;

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** @param {unknown} flag boolean from validateEnv, or a raw env string */
const isTrue = (flag) => flag === true || String(flag).toLowerCase() === "true";

class AttemptFailed extends Error {
  /** @param {string} reason short, secret-free reason code @param {boolean} retryable */
  constructor(reason, retryable) {
    super(reason);
    this.reason = reason;
    this.retryable = retryable;
  }
}

/**
 * @param {{
 *   env: Record<string, any>,
 *   db: {query: Function},
 *   fetchImpl?: typeof fetch,
 *   logger?: {info: Function, warn: Function, error: Function},
 *   sleep?: (ms: number) => Promise<void>,
 * }} deps
 */
export function createSmsSender({ env, db, fetchImpl = globalThis.fetch, logger = console, sleep = defaultSleep }) {
  const production = env.NODE_ENV === "production";
  const consoleMode = !production || isTrue(env.SMS_DEV_CONSOLE);

  async function record({ phone, templateKey, status, providerMessageId = null, error = null }) {
    try {
      await db.query(
        `insert into sms_messages (phone_masked, template_key, provider_message_id, status, error, purpose)
         values ($1, $2, $3, $4, $5, $6)`,
        [maskPhone(phone), templateKey, providerMessageId, status, error, templateKey],
      );
    } catch {
      // The delivery log must never break a send; the failure is visible in the server log.
      logger.error("[sms] could not write sms_messages row");
    }
  }

  async function attemptLive(phone, templateKey, params) {
    const templateId = Number(env[TEMPLATE_ENV[templateKey]]);
    if (!env.SMSIR_API_KEY || !Number.isInteger(templateId) || templateId <= 0) {
      throw new AttemptFailed("not_configured", false);
    }
    let response;
    try {
      response = await fetchImpl(SMSIR_VERIFY_URL, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json", "x-api-key": env.SMSIR_API_KEY },
        body: JSON.stringify({
          mobile: phone,
          templateId,
          parameters: Object.entries(params).map(([name, value]) => ({ name, value: String(value) })),
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      throw new AttemptFailed("network_error", true);
    }
    if (!response.ok) throw new AttemptFailed(`http_${response.status}`, response.status >= 500 || response.status === 429);
    let body;
    try {
      body = await response.json();
    } catch {
      throw new AttemptFailed("bad_response", false);
    }
    if (body?.status !== 1) throw new AttemptFailed("provider_rejected", false);
    return body?.data?.messageId === undefined ? null : String(body.data.messageId);
  }

  async function sendLive(phone, templateKey, params) {
    let last = new AttemptFailed("unknown", false);
    for (let attempt = 1; attempt <= MAX_TRIES; attempt += 1) {
      try {
        return await attemptLive(phone, templateKey, params);
      } catch (error) {
        if (!(error instanceof AttemptFailed)) throw error;
        last = error;
        if (!error.retryable || attempt === MAX_TRIES) break;
        await sleep(BACKOFF_MS * attempt);
      }
    }
    throw last;
  }

  /**
   * @param {string} phone canonical 09xxxxxxxxx
   * @param {'otp'|'study_reminder'|'renewal_reminder'} templateKey
   * @param {Record<string, string|number>} params template parameters, e.g. {CODE}
   * @param {{log?: boolean}} [options] log:false when the caller owns the sms_messages row
   *   (e.g. the study-reminder job, whose row carries the one-per-day guarantee)
   * @returns {Promise<{providerMessageId: string|null, mode: 'console'|'live'}>}
   */
  async function sendTemplate(phone, templateKey, params, { log = true } = {}) {
    if (!Object.hasOwn(TEMPLATE_ENV, templateKey)) throw new TypeError("unknown SMS template key");
    const write = (fields) => (log ? record({ phone, templateKey, ...fields }) : Promise.resolve());
    if (consoleMode) {
      // The only place a code is ever logged, and only outside live production sends.
      logger.info(
        templateKey === "otp"
          ? `[dev-sms] ${maskPhone(phone)} code=${params.CODE ?? ""}`
          : `[dev-sms] ${maskPhone(phone)} template=${templateKey}`,
      );
      await write({ status: "sent", providerMessageId: "dev-console" });
      return { providerMessageId: "dev-console", mode: "console" };
    }
    try {
      const providerMessageId = await sendLive(phone, templateKey, params);
      await write({ status: "sent", providerMessageId });
      return { providerMessageId, mode: "live" };
    } catch (error) {
      const reason = error instanceof AttemptFailed ? error.reason : "unexpected";
      await write({ status: "failed", error: reason });
      logger.warn(`[sms] send failed (${templateKey}): ${reason}`);
      throw new ApiError(502, "sms_failed");
    }
  }

  return {
    sendTemplate,
    /** OTP entry point (and the contract the auth code and its test doubles rely on). */
    sendVerify: (phone, templateKey, params) => sendTemplate(phone, templateKey, params),
  };
}
