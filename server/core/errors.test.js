/* global console */
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, CODES, errorBody, errorHandler, notFoundHandler } from "./errors.js";

function fakeRes() {
  const res = {
    statusCode: null,
    body: null,
    headers: {},
    headersSent: false,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    set(k, val) { this.headers[k] = val; return this; },
  };
  return res;
}

afterEach(() => vi.restoreAllMocks());

describe("CODES", () => {
  it("has the required catalogue with statuses and bilingual messages", () => {
    const expected = {
      unauthenticated: 401, session_replaced: 401, blocked: 403, forbidden: 403, not_found: 404,
      validation_failed: 400, rate_limited: 429, quota_exhausted: 402, otp_locked: 423,
      scoring_failed: 502, internal: 500,
    };
    for (const [code, status] of Object.entries(expected)) {
      expect(CODES[code].status).toBe(status);
      expect(CODES[code].fa).toMatch(/\S/);
      expect(CODES[code].en).toMatch(/\S/);
    }
  });

  it("has the conflict and sms_failed codes used by the auth flow", () => {
    expect(CODES.conflict.status).toBe(409);
    expect(CODES.sms_failed.status).toBe(502);
    for (const code of ["conflict", "sms_failed"]) {
      expect(CODES[code].fa).toMatch(/\S/);
      expect(CODES[code].en).toMatch(/\S/);
    }
  });

  it("uses the exact Persian session_replaced message", () => {
    expect(CODES.session_replaced.fa).toBe(
      "با یه دستگاه دیگه وارد حسابت شدی، برای همین از این دستگاه خارج شدی. اگه خودت نبودی، دوباره وارد شو.",
    );
  });
});

describe("errorBody", () => {
  it("builds the uniform shape from the catalogue", () => {
    expect(errorBody("not_found")).toEqual({
      error: { code: "not_found", message_fa: CODES.not_found.fa, message_en: CODES.not_found.en },
    });
  });

  it("applies overrides and details", () => {
    const body = errorBody("rate_limited", { en: "Slow down", details: { retryAfter: 42 } });
    expect(body.error.message_en).toBe("Slow down");
    expect(body.error.message_fa).toBe(CODES.rate_limited.fa);
    expect(body.error.details).toEqual({ retryAfter: 42 });
  });

  it("falls back to internal for unknown codes", () => {
    expect(errorBody("nope").error.code).toBe("internal");
  });
});

describe("ApiError", () => {
  it("carries status, code, messages and details", () => {
    const err = new ApiError(429, "rate_limited", { details: { retryAfter: 5 } });
    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(429);
    expect(err.code).toBe("rate_limited");
    expect(err.message_fa).toBe(CODES.rate_limited.fa);
    expect(err.message_en).toBe(CODES.rate_limited.en);
    expect(err.details).toEqual({ retryAfter: 5 });
  });

  it("allows custom messages", () => {
    const err = new ApiError(400, "validation_failed", { fa: "نامعتبر", en: "Bad" });
    expect(err.message_fa).toBe("نامعتبر");
    expect(err.message_en).toBe("Bad");
  });
});

describe("errorHandler", () => {
  it("maps ApiError to its status and body", () => {
    const res = fakeRes();
    errorHandler()(new ApiError(403, "forbidden"), {}, res, () => {});
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual(errorBody("forbidden"));
  });

  it("sets Retry-After for rate_limited with details.retryAfter", () => {
    const res = fakeRes();
    errorHandler()(new ApiError(429, "rate_limited", { details: { retryAfter: 30 } }), {}, res, () => {});
    expect(res.statusCode).toBe(429);
    expect(res.headers["Retry-After"]).toBe("30");
    expect(res.body.error.details.retryAfter).toBe(30);
  });

  it("maps unknown errors to 500 internal without leaking message or stack", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = fakeRes();
    const err = new Error("secret db password=hunter2");
    errorHandler()(err, { body: { password: "hunter2" }, method: "POST", path: "/x" }, res, () => {});
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual(errorBody("internal"));
    expect(JSON.stringify(res.body)).not.toContain("hunter2");
    expect(JSON.stringify(res.body)).not.toContain("stack");
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]).toContain(err);
    expect(JSON.stringify(spy.mock.calls)).not.toContain('"password"');
  });

  it("maps body-parser style errors safely", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = fakeRes();
    const err = Object.assign(new Error("Unexpected token"), { status: 400, type: "entity.parse.failed" });
    errorHandler()(err, {}, res, () => {});
    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe("validation_failed");
    expect(JSON.stringify(res.body)).not.toContain("Unexpected token");
  });

  it("delegates to next when headers were already sent", () => {
    const res = fakeRes();
    res.headersSent = true;
    const next = vi.fn();
    const err = new Error("late");
    errorHandler()(err, {}, res, next);
    expect(next).toHaveBeenCalledWith(err);
    expect(res.statusCode).toBeNull();
  });

  it("has Express error-middleware arity (4 args)", () => {
    expect(errorHandler().length).toBe(4);
  });
});

describe("notFoundHandler", () => {
  it("responds 404 not_found", () => {
    const res = fakeRes();
    notFoundHandler({}, res);
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual(errorBody("not_found"));
  });
});
