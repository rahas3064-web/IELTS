import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { freshPhone, createTestApp } from "../test-support/http-app.js";

let t;
beforeAll(async () => {
  t = await createTestApp();
});
afterAll(() => t.close());
beforeEach(() => t.resetLimits());

describe("OTP request rate limits over HTTP", () => {
  it("allows 5 codes per phone per hour, then 429 with retryAfter", async () => {
    const phone = freshPhone();
    const device = t.client();
    for (let i = 0; i < 5; i += 1) {
      t.clock.advance(61);
      expect((await device.request("POST", "/api/auth/otp/request", { body: { phone } })).status, `request ${i + 1}`).toBe(200);
    }
    t.clock.advance(61);
    const res = await device.request("POST", "/api/auth/otp/request", { body: { phone } });
    expect(res.status).toBe(429);
    expect(res.json.error.code).toBe("rate_limited");
    expect(res.json.error.details.retryAfter).toBeGreaterThan(0);
    expect(res.json.error.details.retryAfter).toBeLessThanOrEqual(3600);
    expect(t.sent.filter((s) => s.phone === phone)).toHaveLength(5);
  });

  it("allows 20 codes per IP per hour across phones, then 429", async () => {
    const device = t.client();
    for (let i = 0; i < 20; i += 1) {
      expect((await device.request("POST", "/api/auth/otp/request", { body: { phone: freshPhone() } })).status).toBe(200);
    }
    const res = await device.request("POST", "/api/auth/otp/request", { body: { phone: freshPhone() } });
    expect(res.status).toBe(429);
  });
});

describe("no HTTP route creates or promotes an admin", () => {
  const paths = [
    "/api/admin/bootstrap", "/api/admin/users", "/api/admin/admins", "/api/admin/promote",
    "/api/admin/login", "/api/admin/create", "/api/auth/admin", "/api/auth/admin/bootstrap",
    "/api/auth/bootstrap", "/api/auth/promote", "/api/auth/role", "/api/me/role", "/api/account/role",
    "/api/account/promote", "/api/users", "/api/users/role", "/api/setup", "/api/provision-admin",
  ];

  it("answers 404 for every plausible path, anonymous or signed in, for every method", async () => {
    const signedIn = t.client();
    await t.signUp(signedIn, freshPhone());
    for (const device of [t.client(), signedIn]) {
      for (const path of paths) {
        for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE"]) {
          const res = await device.request(method, path, { body: method === "GET" ? undefined : { role: "super_admin", phone: "09121234567" } });
          expect(res.status, `${method} ${path}`).toBe(404);
        }
      }
    }
  });

  it("ignores a role field smuggled into register / onboarding / locale bodies", async () => {
    const phone = freshPhone();
    const device = t.client();
    const verified = await t.loginWithOtp(device, phone);
    const res = await device.request("POST", "/api/auth/register", {
      body: { signupToken: verified.json.signupToken, firstName: "A", lastName: "B", role: "super_admin", status: "active" },
    });
    expect(res.status).toBe(201);
    expect(res.json.user.role).toBe("learner");
    await device.request("PUT", "/api/me/locale", { body: { locale: "en", role: "super_admin" } });
    await device.request("PUT", "/api/onboarding", { body: { step: 1, examType: "academic", role: "super_admin" } });
    const { rows } = await t.db.query("select role from users where phone = $1", [phone]);
    expect(rows[0].role).toBe("learner");
    expect((await t.db.query("select 1 from users where role = 'super_admin'")).rows).toHaveLength(0);
  });
});
