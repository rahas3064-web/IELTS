import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { freshPhone, createTestApp } from "../test-support/http-app.js";

let t;
beforeAll(async () => {
  t = await createTestApp();
});
afterAll(() => t.close());
beforeEach(() => t.resetLimits());

const requestOtp = (device, phone) => device.request("POST", "/api/auth/otp/request", { body: { phone } });

describe("POST /api/auth/otp/request", () => {
  it("sends a 5-digit code and never reveals whether the phone is registered", async () => {
    const known = freshPhone();
    await t.signUp(t.client(), known);
    const unknown = freshPhone();
    t.clock.advance(61);
    const a = await requestOtp(t.client(), known);
    const b = await requestOtp(t.client(), unknown);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(a.json).toEqual(b.json);
    expect(a.json).toEqual({ ok: true, resendAfterSec: 60, expiresInSec: 120 });
    expect(t.lastCodeFor(known)).toMatch(/^\d{5}$/);
    expect(t.lastCodeFor(unknown)).toMatch(/^\d{5}$/);
  });

  it("normalises +98 / Persian digits and rejects foreign or malformed numbers", async () => {
    const phone = freshPhone();
    const international = `+98${phone.slice(1)}`;
    expect((await requestOtp(t.client(), international)).status).toBe(200);
    expect(t.lastCodeFor(phone)).toMatch(/^\d{5}$/);

    const persian = freshPhone().replace(/\d/g, (d) => String.fromCharCode(0x06f0 + Number(d)));
    expect((await requestOtp(t.client(), persian)).status).toBe(200);

    for (const bad of ["+14155550123", "0212345678", "12345", "", "abc"]) {
      const res = await requestOtp(t.client(), bad);
      expect(res.status, bad).toBe(400);
      expect(res.json.error.code).toBe("validation_failed");
      expect(res.json.error.details.field).toBe("phone");
    }
    expect((await t.client().request("POST", "/api/auth/otp/request", { body: {} })).status).toBe(400);
  });

  it("blocks a resend inside 60 s with retryAfter and the Retry-After header", async () => {
    const phone = freshPhone();
    const device = t.client();
    expect((await requestOtp(device, phone)).status).toBe(200);
    t.clock.advance(15);
    const second = await requestOtp(device, phone);
    expect(second.status).toBe(429);
    expect(second.json.error.code).toBe("rate_limited");
    expect(second.json.error.details.retryAfter).toBe(45);
    expect(second.headers.get("retry-after")).toBe("45");
    t.clock.advance(46);
    expect((await requestOtp(device, phone)).status).toBe(200);
  });

  it("stores only a hash of the code", async () => {
    const phone = freshPhone();
    await requestOtp(t.client(), phone);
    const { rows } = await t.db.query("select code_hash from otp_codes where phone = $1", [phone]);
    expect(rows).toHaveLength(1);
    expect(rows[0].code_hash).not.toBe(t.lastCodeFor(phone));
    expect(rows[0].code_hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("POST /api/auth/otp/verify", () => {
  it("rejects wrong codes, locks after 5 and answers 423", async () => {
    const phone = freshPhone();
    const device = t.client();
    await requestOtp(device, phone);
    const right = t.lastCodeFor(phone);
    const wrong = right === "11111" ? "22222" : "11111";
    for (let i = 0; i < 4; i += 1) {
      const res = await device.request("POST", "/api/auth/otp/verify", { body: { phone, code: wrong } });
      expect(res.status).toBe(400);
      expect(res.json.error.details.attemptsLeft).toBe(4 - i);
    }
    const fifth = await device.request("POST", "/api/auth/otp/verify", { body: { phone, code: wrong } });
    expect(fifth.status).toBe(423);
    expect(fifth.json.error.code).toBe("otp_locked");
    const correct = await device.request("POST", "/api/auth/otp/verify", { body: { phone, code: right } });
    expect(correct.status).toBe(423);
    const again = await requestOtp(device, phone);
    expect(again.status).toBe(423);
    t.clock.advance(15 * 60 + 5);
    expect((await requestOtp(device, phone)).status).toBe(200);
  });

  it("rejects an expired code after 2 minutes", async () => {
    const phone = freshPhone();
    const device = t.client();
    await requestOtp(device, phone);
    t.clock.advance(121);
    const res = await device.request("POST", "/api/auth/otp/verify", { body: { phone, code: t.lastCodeFor(phone) } });
    expect(res.status).toBe(400);
    expect(res.json.error.details.field).toBe("code");
  });

  it("validates the code format and accepts Persian digits", async () => {
    const phone = freshPhone();
    const device = t.client();
    await requestOtp(device, phone);
    expect((await device.request("POST", "/api/auth/otp/verify", { body: { phone, code: "12" } })).status).toBe(400);
    expect((await device.request("POST", "/api/auth/otp/verify", { body: { phone, code: 12345 } })).status).toBe(400);
    const persian = t.lastCodeFor(phone).replace(/\d/g, (d) => String.fromCharCode(0x06f0 + Number(d)));
    const res = await device.request("POST", "/api/auth/otp/verify", { body: { phone, code: persian } });
    expect(res.status).toBe(200);
    expect(res.json.needsProfile).toBe(true);
  });

  it("returns needsProfile + signupToken for a new phone and sets no session", async () => {
    const device = t.client();
    const res = await t.loginWithOtp(device, freshPhone());
    expect(res.status).toBe(200);
    expect(res.json.needsProfile).toBe(true);
    expect(res.json.signupToken).toMatch(/\./);
    expect(res.setCookies).toHaveLength(0);
    expect((await device.request("GET", "/api/me")).status).toBe(401);
  });

  it("a code works once", async () => {
    const phone = freshPhone();
    const device = t.client();
    await requestOtp(device, phone);
    const code = t.lastCodeFor(phone);
    expect((await device.request("POST", "/api/auth/otp/verify", { body: { phone, code } })).status).toBe(200);
    expect((await device.request("POST", "/api/auth/otp/verify", { body: { phone, code } })).status).toBe(400);
  });

  it("logs an existing user straight in", async () => {
    const phone = freshPhone();
    await t.signUp(t.client(), phone, { firstName: "Nima", lastName: "Karimi" });
    const device = t.client();
    const res = await t.loginWithOtp(device, phone);
    expect(res.status).toBe(200);
    expect(res.json.needsProfile).toBeUndefined();
    expect(res.json.user).toMatchObject({ firstName: "Nima", lastName: "Karimi", phone, role: "learner", locale: "fa", status: "active" });
    expect((await device.request("GET", "/api/me")).status).toBe(200);
  });
});
