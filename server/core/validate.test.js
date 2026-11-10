import { describe, expect, it } from "vitest";
import { ApiError } from "./errors.js";
import { parseBody, v } from "./validate.js";

function failure(fn) {
  try {
    fn();
  } catch (error) {
    return error;
  }
  throw new Error("expected a throw");
}

describe("v.string", () => {
  it("trims and enforces length", () => {
    const schema = v.object({ name: v.string({ min: 1, max: 5 }) });
    expect(parseBody(schema, { name: "  ab " })).toEqual({ name: "ab" });
    expect(failure(() => parseBody(schema, { name: "   " })).details.fields.name.code).toBe("too_short");
    expect(failure(() => parseBody(schema, { name: "abcdef" })).details.fields.name.code).toBe("too_long");
  });

  it("rejects non-strings and reports missing fields", () => {
    const schema = v.object({ name: v.string({ min: 1 }) });
    expect(failure(() => parseBody(schema, { name: 5 })).details.fields.name.code).toBe("invalid_type");
    expect(failure(() => parseBody(schema, {})).details.fields.name.code).toBe("required");
  });

  it("applies a pattern and a transform", () => {
    const schema = v.object({ code: v.string({ pattern: /^\d{5}$/, transform: (s) => s.replace(/\D/g, "") }) });
    expect(parseBody(schema, { code: "1-2345" })).toEqual({ code: "12345" });
    expect(failure(() => parseBody(schema, { code: "12" })).details.fields.code.code).toBe("invalid_format");
  });
});

describe("v.integer / v.oneOf / v.array / v.optional / v.nullable", () => {
  it("validates integers with bounds", () => {
    const schema = v.object({ n: v.integer({ min: 10, max: 240 }) });
    expect(parseBody(schema, { n: 45 })).toEqual({ n: 45 });
    expect(failure(() => parseBody(schema, { n: 9 })).details.fields.n.code).toBe("too_small");
    expect(failure(() => parseBody(schema, { n: 241 })).details.fields.n.code).toBe("too_large");
    expect(failure(() => parseBody(schema, { n: 4.5 })).details.fields.n.code).toBe("invalid_type");
    expect(failure(() => parseBody(schema, { n: "45" })).details.fields.n.code).toBe("invalid_type");
  });

  it("validates enumerations", () => {
    const schema = v.object({ t: v.oneOf(["academic", "general"]) });
    expect(parseBody(schema, { t: "academic" })).toEqual({ t: "academic" });
    expect(failure(() => parseBody(schema, { t: "other" })).details.fields.t.code).toBe("invalid_value");
  });

  it("validates arrays: size, item type and uniqueness", () => {
    const schema = v.object({ d: v.array(v.integer({ min: 0, max: 6 }), { min: 1, max: 7, unique: true }) });
    expect(parseBody(schema, { d: [0, 3] })).toEqual({ d: [0, 3] });
    expect(failure(() => parseBody(schema, { d: [] })).details.fields.d.code).toBe("too_short");
    expect(failure(() => parseBody(schema, { d: [1, 1] })).details.fields.d.code).toBe("duplicate");
    expect(failure(() => parseBody(schema, { d: [7] })).details.fields.d.code).toBe("invalid_item");
    expect(failure(() => parseBody(schema, { d: "x" })).details.fields.d.code).toBe("invalid_type");
  });

  it("supports optional and nullable fields", () => {
    const schema = v.object({
      a: v.optional(v.string({ min: 1 })),
      b: v.nullable(v.oneOf([5.5, 6])),
    });
    expect(parseBody(schema, { b: null })).toEqual({ a: undefined, b: null });
    expect(parseBody(schema, { a: "x", b: 6 })).toEqual({ a: "x", b: 6 });
    expect(failure(() => parseBody(schema, {})).details.fields.b.code).toBe("required");
  });
});

describe("parseBody", () => {
  it("drops unknown keys and never mutates the input", () => {
    const schema = v.object({ a: v.string({ min: 1 }) });
    const input = Object.freeze({ a: "x", role: "super_admin" });
    expect(parseBody(schema, input)).toEqual({ a: "x" });
  });

  it("rejects a body that is not an object", () => {
    const schema = v.object({ a: v.string() });
    for (const body of [null, undefined, "x", 5, [1]]) {
      expect(failure(() => parseBody(schema, body)).code).toBe("validation_failed");
    }
  });

  it("throws ApiError validation_failed with Persian and English messages and the first field", () => {
    const schema = v.object({ a: v.string({ min: 1 }), b: v.integer() });
    const error = failure(() => parseBody(schema, { a: "", b: "z" }));
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(400);
    expect(error.code).toBe("validation_failed");
    expect(error.details.field).toBe("a");
    expect(error.details.fields.a.message_fa).toMatch(/\S/);
    expect(error.details.fields.a.message_en).toMatch(/\S/);
    expect(Object.keys(error.details.fields)).toEqual(["a", "b"]);
  });
});
