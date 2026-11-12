// Environment contract (spec section 4.1). Fail fast in production; safe defaults in dev.
// Rule: error messages carry variable NAMES only, never values.

/**
 * @typedef {object} EnvVar
 * @property {string} name
 * @property {boolean} requiredInProduction
 * @property {boolean} secret
 * @property {string} [default]
 */

const v = (name, { required = false, secret = false, def } = {}) => ({
  name,
  requiredInProduction: required,
  secret,
  ...(def === undefined ? {} : { default: def }),
});

/** @type {ReadonlyArray<EnvVar>} */
export const ENV_SPEC = Object.freeze([
  // Core
  v("NODE_ENV", { def: "development" }),
  v("PORT", { def: "3000" }),
  v("APP_BASE_URL", { required: true }),
  v("DATABASE_URL", { required: true, secret: true }),
  v("SESSION_SECRET", { required: true, secret: true }),
  v("OTP_PEPPER", { required: true, secret: true }),
  v("TZ", { def: "Asia/Tehran" }),
  // AI (AvalAI)
  v("AVALAI_API_KEY", { secret: true }),
  v("AVALAI_BASE_URL", { def: "https://api.avalai.ir/v1" }),
  v("AVALAI_MODEL"),
  v("AVALAI_SCORING_MODEL"),
  v("AVALAI_STT_MODEL", { def: "whisper-1" }),
  v("AI_COST_PER_1K_INPUT_RIAL"),
  v("AI_COST_PER_1K_OUTPUT_RIAL"),
  // SMS.ir
  v("SMSIR_API_KEY", { secret: true }),
  v("SMSIR_LINE_NUMBER"),
  v("SMSIR_TEMPLATE_OTP"),
  v("SMSIR_TEMPLATE_STUDY_REMINDER"),
  v("SMSIR_TEMPLATE_RENEWAL_REMINDER"),
  v("SMS_DEV_CONSOLE", { def: "true" }),
  // Bale payment
  v("BALE_BOT_TOKEN", { secret: true }),
  v("BALE_BOT_USERNAME"),
  v("BALE_PAYMENT_PROVIDER_TOKEN", { secret: true }),
  v("BALE_PAYMENT_MODE", { def: "test" }),
  v("BALE_PAYMENT_FLOW", { def: "bot_chat" }),
  v("BALE_WEBHOOK_SECRET", { secret: true }),
  // Storage
  v("STORAGE_ENDPOINT"),
  v("STORAGE_BUCKET"),
  v("STORAGE_ACCESS_KEY", { secret: true }),
  v("STORAGE_SECRET_KEY", { secret: true }),
  // Admin bootstrap
  v("ADMIN_BOOTSTRAP_PHONE", { secret: true }),
  // Scheduled jobs always run in production; set 1 to run them in development too
  v("ENABLE_JOBS"),
  // Local-only switch: "true" skips the SMS code step on the real login forms. Never in production.
  v("AUTH_DEV_BYPASS", { def: "false" }),
]);

const MIN_SECRET_LENGTH = 32;
const MIN_PORT = 1;
const MAX_PORT = 65535;

/**
 * @param {unknown} raw
 * @returns {string|undefined} trimmed value, undefined when unset/blank
 */
function read(raw) {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  return trimmed === "" ? undefined : trimmed;
}

/**
 * @param {string|undefined} raw
 * @returns {number|null}
 */
function parsePort(raw) {
  if (raw === undefined || !/^\d+$/.test(raw)) return null;
  const port = Number(raw);
  return port >= MIN_PORT && port <= MAX_PORT ? port : null;
}

/**
 * Validate and normalise an environment. Never mutates `env`.
 * @param {Record<string, string|undefined>} env
 * @returns {{ok: boolean, errors: string[], config: Record<string, any>}}
 */
export function validateEnv(env = {}) {
  const nodeEnv = read(env.NODE_ENV) ?? "development";
  const production = nodeEnv === "production";
  const errors = [];
  const config = {};

  for (const spec of ENV_SPEC) {
    // In production the dev-console SMS fallback must be opted into explicitly.
    const fallback = spec.name === "SMS_DEV_CONSOLE" && production ? "false" : spec.default;
    const value = read(env[spec.name]) ?? fallback;
    if (value === undefined) {
      if (production && spec.requiredInProduction) errors.push(`${spec.name} is required in production`);
      continue;
    }
    config[spec.name] = value;
  }

  const port = parsePort(config.PORT);
  if (port === null) errors.push("PORT must be an integer between 1 and 65535");
  config.PORT = port ?? 3000;
  config.SMS_DEV_CONSOLE = config.SMS_DEV_CONSOLE !== "false";
  // Only the exact string "true" turns the local code-skip on; anything else keeps OTP mandatory.
  config.AUTH_DEV_BYPASS = config.AUTH_DEV_BYPASS === "true";
  config.NODE_ENV = nodeEnv;

  if (production) {
    // The dev console sender prints OTP codes; it must never be active in production.
    if (config.AUTH_DEV_BYPASS === true) {
      errors.push("AUTH_DEV_BYPASS must not be true in production (it skips the SMS code)");
    }
    if (config.SMS_DEV_CONSOLE === true) {
      errors.push("SMS_DEV_CONSOLE must not be true in production (it prints OTP codes to the logs)");
    }
    for (const name of ["SESSION_SECRET", "OTP_PEPPER"]) {
      if (config[name] !== undefined && config[name].length < MIN_SECRET_LENGTH) {
        errors.push(`${name} must be at least ${MIN_SECRET_LENGTH} characters`);
      }
    }
  }

  return { ok: errors.length === 0, errors, config: Object.freeze(config) };
}

/**
 * Validate or throw. The message lists variable names only.
 * @param {Record<string, string|undefined>} env
 * @returns {Record<string, any>} the validated config
 */
export function assertEnv(env) {
  const { ok, errors, config } = validateEnv(env);
  if (!ok) throw new Error(`Invalid environment configuration: ${errors.join("; ")}`);
  return config;
}

/**
 * Safe-to-log view of the known variables: secret values become '***'; unknown
 * variables are dropped entirely.
 * @param {Record<string, string|undefined>} env
 * @returns {Record<string, string>}
 */
export function redactEnv(env = {}) {
  const out = {};
  for (const spec of ENV_SPEC) {
    const value = env[spec.name];
    if (value === undefined) continue;
    out[spec.name] = spec.secret ? "***" : value;
  }
  return out;
}

/**
 * Which optional integrations are usable with this config.
 * @param {Record<string, any>} config result of validateEnv().config
 * @returns {{sms: boolean, ai: boolean, bale: boolean, storage: boolean}}
 */
export function featureStatus(config) {
  const has = (...names) => names.every((n) => Boolean(config[n]));
  return {
    sms: config.SMS_DEV_CONSOLE === true || has("SMSIR_API_KEY", "SMSIR_LINE_NUMBER", "SMSIR_TEMPLATE_OTP"),
    ai: has("AVALAI_API_KEY", "AVALAI_MODEL"),
    bale: has("BALE_BOT_TOKEN", "BALE_PAYMENT_PROVIDER_TOKEN"),
    storage: has("STORAGE_ENDPOINT", "STORAGE_BUCKET", "STORAGE_ACCESS_KEY", "STORAGE_SECRET_KEY"),
  };
}
