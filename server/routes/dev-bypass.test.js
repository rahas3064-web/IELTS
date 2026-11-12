// AUTH_DEV_BYPASS: local-only switch that skips only the SMS code step on the real forms.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { isDevBypassEnabled } from "../auth/dev-bypass.js";
import { validateEnv } from "../core/env.js";
import { createTestApp, freshPhone } from "../test-support/http-app.js";

describe("isDevBypassEnabled", () => {
  it("is on only for exactly true outside production", () => {
    expect(isDevBypassEnabled({})).toBe(false);
    expect(isDevBypassEnabled({ AUTH_DEV_BYPASS: "1" })).toBe(false);
    expect(isDevBypassEnabled({ AUTH_DEV_BYPASS: "false" })).toBe(false);
    expect(isDevBypassEnabled({ AUTH_DEV_BYPASS: "true" })).toBe(true);
    expect(isDevBypassEnabled({ AUTH_DEV_BYPASS: true, NODE_ENV: "production" })).toBe(false);
    expect(validateEnv({}).config.AUTH_DEV_BYPASS).toBe(false);
    expect(validateEnv({ AUTH_DEV_BYPASS: "yes" }).config.AUTH_DEV_BYPASS).toBe(false);
    expect(validateEnv({ AUTH_DEV_BYPASS: "true" }).config.AUTH_DEV_BYPASS).toBe(true);
  });

  it("refuses to boot production with the switch on", () => {
    const res = validateEnv({
      NODE_ENV: "production", APP_BASE_URL: "https://bandora.ir", DATABASE_URL: "postgres://x",
      SESSION_SECRET: "s".repeat(40), OTP_PEPPER: "p".repeat(40), SMS_DEV_CONSOLE: "false", AUTH_DEV_BYPASS: "true",
    });
    expect(res.ok).toBe(false);
    expect(res.errors.join(" ")).toContain("AUTH_DEV_BYPASS");
  });
});

describe("switch off", () => {
  let t;
  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());

  it("reports off and refuses both bypass routes", async () => {
    const device = t.client();
    const status = await device.request("GET", "/api/auth/dev-bypass");
    expect(status.json).toEqual({ enabled: false });
    const phone = freshPhone();
    const learner = await device.request("POST", "/api/auth/dev-bypass/phone", { body: { phone } });
    expect(learner.status).toBe(404);
    const admin = await device.request("POST", "/api/admin/auth/dev-bypass/phone", { body: { phone } });
    expect(admin.status).toBe(404);
    expect(device.jar.size).toBe(0);
    const users = await t.db.query("select 1 from users where phone = $1", [phone]);
    expect(users.rows).toHaveLength(0);
  });

  it("stays off in production even when the value is true", async () => {
    const prod = await createTestApp({ config: { NODE_ENV: "production", AUTH_DEV_BYPASS: true } });
    try {
      const res = await prod.client().request("POST", "/api/auth/dev-bypass/phone", { body: { phone: freshPhone() } });
      expect(res.status).toBe(404);
    } finally {
      await prod.close();
    }
  });
});

describe("switch on", () => {
  let t;
  beforeAll(async () => {
    t = await createTestApp({ config: { AUTH_DEV_BYPASS: true } });
  });
  afterAll(() => t.close());
  beforeEach(() => t.resetLimits());

  it("signs up a new learner from the submitted phone and name, without an SMS", async () => {
    const sentBefore = t.sent.length;
    const phone = freshPhone();
    const device = t.client();
    expect((await device.request("GET", "/api/auth/dev-bypass")).json).toEqual({ enabled: true });
    const first = await device.request("POST", "/api/auth/dev-bypass/phone", { body: { phone } });
    expect(first.status).toBe(200);
    expect(first.json.needsProfile).toBe(true);
    expect(device.jar.has("bd_session")).toBe(false);
    const registered = await device.request("POST", "/api/auth/register", {
      body: { signupToken: first.json.signupToken, firstName: "Mina", lastName: "Karimi" },
    });
    expect(registered.status).toBe(201);
    expect(device.jar.has("bd_session")).toBe(true);
    const me = await device.request("GET", "/api/me");
    expect(me.status).toBe(200);
    expect(me.json.user).toMatchObject({ phone, firstName: "Mina", lastName: "Karimi" });
    const stored = await t.db.query("select first_name, last_name from users where phone = $1", [phone]);
    expect(stored.rows[0]).toEqual({ first_name: "Mina", last_name: "Karimi" });
    expect(t.sent.length).toBe(sentBefore);

    const again = t.client();
    const second = await again.request("POST", "/api/auth/dev-bypass/phone", { body: { phone } });
    expect(second.status).toBe(200);
    expect(second.json.user).toMatchObject({ phone, firstName: "Mina" });
    expect(again.jar.has("bd_session")).toBe(true);
    expect((await again.request("GET", "/api/me")).status).toBe(200);
  });

  it("rejects an invalid phone and a request without a trusted origin", async () => {
    const device = t.client();
    expect((await device.request("POST", "/api/auth/dev-bypass/phone", { body: { phone: "12345" } })).status).toBe(400);
    expect((await device.request("POST", "/api/auth/dev-bypass/phone", { body: { phone: freshPhone() }, origin: null })).status).toBe(403);
  });

  it("skips only the admin SMS code: non-admins are refused and the admin password stays required", async () => {
    const learnerPhone = freshPhone();
    await t.signUp(t.client(), learnerPhone);
    const refused = await t.client().request("POST", "/api/admin/auth/dev-bypass/phone", { body: { phone: learnerPhone } });
    expect(refused.status).toBe(401);

    const phone = freshPhone();
    const signed = await t.signUp(t.client(), phone);
    await t.db.query("update users set role = 'super_admin' where id = $1", [signed.json.user.id]);
    const device = t.client();
    const gated = await device.request("POST", "/api/admin/auth/dev-bypass/phone", { body: { phone } });
    expect(gated.status).toBe(200);
    expect(gated.json.needsPasswordSetup).toBe(true);
    expect(device.jar.has("bd_admin")).toBe(false);
    const created = await device.request("POST", "/api/admin/auth/password/setup", {
      body: { gate: gated.json.gate, password: "correct-horse" },
    });
    expect(created.status).toBe(201);
    expect(device.jar.has("bd_admin")).toBe(true);
    expect((await device.request("GET", "/api/admin/me")).json.user.role).toBe("super_admin");

    const next = t.client();
    const gate2 = await next.request("POST", "/api/admin/auth/dev-bypass/phone", { body: { phone } });
    expect(gate2.json.needsPasswordSetup).toBe(false);
    const wrong = await next.request("POST", "/api/admin/auth/password", { body: { gate: gate2.json.gate, password: "wrong-password" } });
    expect(wrong.status).toBe(401);
    const right = await next.request("POST", "/api/admin/auth/password", { body: { gate: gate2.json.gate, password: "correct-horse" } });
    expect(right.status).toBe(200);
  });
});
