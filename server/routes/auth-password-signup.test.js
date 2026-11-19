import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { freshPhone, createTestApp } from "../test-support/http-app.js";

let t;
beforeAll(async () => {
  t = await createTestApp();
});
afterAll(() => t.close());
beforeEach(() => t.resetLimits());

const register = (device, body) => device.request("POST", "/api/auth/password/register", { body });

function signupBody(overrides = {}) {
  return {
    fullName: "Sara Ahmadi",
    phone: freshPhone(),
    password: "long enough 1",
    acceptedLegal: true,
    ...overrides,
  };
}

describe("password signup while SMS.ir is unset", () => {
  it("tells the client that OTP is off", async () => {
    expect((await t.client().request("GET", "/api/auth/options")).json).toEqual({ smsOtp: false });
  });

  it("creates an unverified phone, stores a password hash, and records the legal texts", async () => {
    const body = signupBody();
    const res = await register(t.client(), body);
    expect(res.status).toBe(201);
    expect(res.json.user).toMatchObject({
      firstName: "Sara", lastName: "Ahmadi", phone: body.phone, email: null, hasPassword: true, phoneVerified: false, role: "learner",
    });
    expect(res.text).not.toContain(body.password);
    const { rows } = await t.db.query(
      "select phone_verified_at, password_hash from users where id = $1",
      [res.json.user.id],
    );
    expect(rows[0].phone_verified_at).toBeNull();
    expect(rows[0].password_hash).toMatch(/^scrypt\$/);
    expect(rows[0].password_hash).not.toContain(body.password);
    const legal = await t.db.query(
      "select document, version from legal_acceptances where user_id = $1 order by document",
      [res.json.user.id],
    );
    expect(legal.rows).toEqual([
      { document: "privacy", version: "legal-2026-11-18" },
      { document: "refund", version: "legal-2026-11-18" },
      { document: "terms", version: "legal-2026-11-18" },
    ]);
    expect((await t.client().request("GET", "/api/me")).status).toBe(401);
  });

  it("starts a session for the new account", async () => {
    const device = t.client();
    const res = await register(device, signupBody());
    expect((await device.request("GET", "/api/me")).json.user.id).toBe(res.json.user.id);
  });

  it("stores one word as the first name and a sentinel last name", async () => {
    const res = await register(t.client(), signupBody({ fullName: "رها" }));
    expect(res.status).toBe(201);
    expect(res.json.user).toMatchObject({ firstName: "رها", lastName: "-" });
  });

  it("refuses a short password, a missing acceptance, and a duplicate phone", async () => {
    const first = signupBody();
    expect((await register(t.client(), first)).status).toBe(201);
    expect((await register(t.client(), signupBody({ password: "short" }))).status).toBe(400);
    const refused = await register(t.client(), signupBody({ acceptedLegal: false }));
    expect(refused.status).toBe(400);
    expect(refused.json.error.code).toBe("validation_failed");

    const samePhone = await register(t.client(), signupBody({ phone: first.phone }));
    expect(samePhone.status).toBe(409);
    expect(samePhone.json.error.details.field).toBe("phone");
  });

  it("verifies the phone once when that account later completes OTP", async () => {
    const body = signupBody();
    const created = await register(t.client(), body);
    const device = t.client();
    t.clock.advance(61);
    const requested = await device.request("POST", "/api/auth/otp/request", { body: { phone: body.phone } });
    expect(requested.status).toBe(200);
    const verified = await device.request("POST", "/api/auth/otp/verify", {
      body: { phone: body.phone, code: t.lastCodeFor(body.phone) },
    });
    expect(verified.status).toBe(200);
    expect(verified.json.user.id).toBe(created.json.user.id);
    expect(verified.json.user.phoneVerified).toBe(true);
    const { rows } = await t.db.query("select phone_verified_at from users where id = $1", [created.json.user.id]);
    expect(rows[0].phone_verified_at).not.toBeNull();
  });

  it("rate-limits repeated signup attempts for one phone", async () => {
    const phone = freshPhone();
    let last;
    for (let i = 0; i < 6; i += 1) last = await register(t.client(), signupBody({ phone }));
    expect(last.status).toBe(429);
    expect(last.json.error.code).toBe("rate_limited");
  });
});

describe("password signup once SMS.ir is set", () => {
  let sms;
  beforeAll(async () => {
    sms = await createTestApp({
      config: { SMSIR_API_KEY: "a", SMSIR_LINE_NUMBER: "1", SMSIR_TEMPLATE_OTP: "2" },
    });
  });
  afterAll(() => sms.close());

  it("hides password registration and reports OTP as on", async () => {
    expect((await sms.client().request("GET", "/api/auth/options")).json).toEqual({ smsOtp: true });
    const res = await sms.client().request("POST", "/api/auth/password/register", { body: signupBody() });
    expect(res.status).toBe(404);
  });
});
