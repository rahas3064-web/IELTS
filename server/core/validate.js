// Tiny schema validator for request bodies (no dependency). A schema is an object
// with `parse(input, present)` returning `{value}` or `{error: {code, fa, en}}`.
// Schemas never mutate their input; `parseBody` throws an ApiError validation_failed.
import { ApiError } from "./errors.js";

const MESSAGES = Object.freeze({
  required: ["این فیلد الزامیه.", "This field is required."],
  invalid_type: ["نوع مقدار درست نیست.", "The value has the wrong type."],
  too_short: ["مقدار خیلی کوتاهه.", "The value is too short."],
  too_long: ["مقدار خیلی بلنده.", "The value is too long."],
  too_small: ["عدد خیلی کوچیکه.", "The number is too small."],
  too_large: ["عدد خیلی بزرگه.", "The number is too large."],
  invalid_format: ["فرمت مقدار درست نیست.", "The value has an invalid format."],
  invalid_value: ["این مقدار مجاز نیست.", "This value is not allowed."],
  invalid_item: ["یکی از آیتم‌ها درست نیست.", "One of the items is invalid."],
  duplicate: ["مقدار تکراری وجود داره.", "There are duplicate values."],
});

/** @param {string} code */
export function fieldError(code) {
  const [fa, en] = MESSAGES[code] ?? MESSAGES.invalid_value;
  return { code, message_fa: fa, message_en: en };
}

const ok = (value) => ({ value });
const fail = (code) => ({ error: fieldError(code) });

const isPlainObject = (x) => x !== null && typeof x === "object" && !Array.isArray(x);

/** @param {{min?: number, max?: number, trim?: boolean, pattern?: RegExp, transform?: (s: string) => string}} [o] */
function string({ min = 0, max = Infinity, trim = true, pattern, transform } = {}) {
  return {
    parse(input) {
      if (typeof input !== "string") return fail("invalid_type");
      let value = trim ? input.trim() : input;
      if (transform) value = transform(value);
      if (value.length < min) return fail("too_short");
      if (value.length > max) return fail("too_long");
      if (pattern && !pattern.test(value)) return fail("invalid_format");
      return ok(value);
    },
  };
}

/** @param {{min?: number, max?: number}} [o] */
function integer({ min = -Infinity, max = Infinity } = {}) {
  return {
    parse(input) {
      if (typeof input !== "number" || !Number.isInteger(input)) return fail("invalid_type");
      if (input < min) return fail("too_small");
      if (input > max) return fail("too_large");
      return ok(input);
    },
  };
}

/** @param {ReadonlyArray<string|number>} values */
function oneOf(values) {
  return { parse: (input) => (values.includes(input) ? ok(input) : fail("invalid_value")) };
}

/** @param {{parse: Function}} item @param {{min?: number, max?: number, unique?: boolean}} [o] */
function array(item, { min = 0, max = Infinity, unique = false } = {}) {
  return {
    parse(input) {
      if (!Array.isArray(input)) return fail("invalid_type");
      if (input.length < min) return fail("too_short");
      if (input.length > max) return fail("too_long");
      const out = [];
      for (const entry of input) {
        const result = item.parse(entry, true);
        if (result.error) return fail("invalid_item");
        out.push(result.value);
      }
      if (unique && new Set(out).size !== out.length) return fail("duplicate");
      return ok(out);
    },
  };
}

/** Field may be absent (or undefined); null is not accepted. */
function optional(inner) {
  return { optional: true, parse: (input) => (input === undefined ? ok(undefined) : inner.parse(input)) };
}

/** Field must be present, but may be null. */
function nullable(inner) {
  return { parse: (input) => (input === null ? ok(null) : inner.parse(input)) };
}

/** @param {Record<string, {parse: Function, optional?: boolean}>} shape unknown keys are dropped */
function object(shape) {
  return {
    parse(input) {
      if (!isPlainObject(input)) return fail("invalid_type");
      const value = {};
      const fields = {};
      for (const [key, schema] of Object.entries(shape)) {
        const present = Object.hasOwn(input, key) && input[key] !== undefined;
        if (!present && !schema.optional) {
          fields[key] = fieldError("required");
          continue;
        }
        const result = schema.parse(present ? input[key] : undefined);
        if (result.error) fields[key] = result.error;
        else value[key] = result.value;
      }
      return Object.keys(fields).length > 0 ? { error: { code: "invalid_fields", fields } } : ok(value);
    },
  };
}

export const v = Object.freeze({ string, integer, oneOf, array, optional, nullable, object });

/**
 * Validate a request body. Returns a new, trimmed object with only known keys.
 * @template T
 * @param {{parse: (input: unknown) => any}} schema
 * @param {unknown} body
 * @returns {T}
 * @throws {ApiError} 400 validation_failed with details {field, fields}
 */
export function parseBody(schema, body) {
  const result = schema.parse(body);
  if (!result.error) return result.value;
  const fields = result.error.fields ?? { body: result.error };
  throw new ApiError(400, "validation_failed", {
    details: { field: Object.keys(fields)[0], fields },
  });
}
