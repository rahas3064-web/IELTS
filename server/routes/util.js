// Small helpers shared by the route files.
import { ApiError } from "../core/errors.js";
import { fieldError } from "../core/validate.js";
import { normalizePhone } from "../core/phone.js";

/** Express 4 does not catch async rejections: forward them to the error middleware. */
export const wrap = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

/** @param {string} field @param {string} code key of validate.js messages */
export function fieldFailure(field, code) {
  return new ApiError(400, "validation_failed", { details: { field, fields: { [field]: fieldError(code) } } });
}

/** Normalise an Iranian mobile or throw validation_failed on `phone`. */
export function requirePhone(raw) {
  const phone = normalizePhone(raw);
  if (!phone) {
    throw new ApiError(400, "validation_failed", {
      fa: "شماره موبایل باید یه شماره ایرانی مثل ۰۹۱۲۱۲۳۴۵۶۷ باشه.",
      en: "Enter an Iranian mobile number such as 09121234567.",
      details: {
        field: "phone",
        fields: {
          phone: {
            code: "invalid_phone",
            message_fa: "شماره موبایل ایرانی معتبر نیست.",
            message_en: "Not a valid Iranian mobile number.",
          },
        },
      },
    });
  }
  return phone;
}

export const isUniqueViolation = (error, constraintFragment) =>
  error?.code === "23505" && (constraintFragment === undefined || String(error.constraint ?? error.message).includes(constraintFragment));
