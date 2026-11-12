import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PERMISSIONS } from "../authz.js";
import { freshPhone, createTestApp } from "../test-support/http-app.js";

let t;
beforeAll(async () => {
  t = await createTestApp();
});
afterAll(() => t.close());
beforeEach(() => t.resetLimits());

async function makeAdmin(role) {
  const phone = freshPhone();
  const signed = await t.signUp(t.client(), phone);
  await t.db.query("update users set role = $2 where id = $1", [signed.json.user.id, role]);
  return { phone, id: signed.json.user.id };
}

async function otpGate(device, phone) {
  t.clock.advance(61);
  const requested = await device.request("POST", "/api/admin/auth/otp/request", { body: { phone } });
  expect(requested.status).toBe(200);
  const code = t.lastCodeFor(phone);
  return device.request("POST", "/api/admin/auth/otp/verify", { body: { phone, code } });
}

describe("admin login", () => {
  it("sets the admin password on first login and then requires it", async () => {
    const { phone } = await makeAdmin("reviewer");
    const device = t.client();
    const verified = await otpGate(device, phone);
    expect(verified.status).toBe(200);
    expect(verified.json.needsPasswordSetup).toBe(true);
    const created = await device.request("POST", "/api/admin/auth/password/setup", {
      body: { gate: verified.json.gate, password: "correct-horse" },
    });
    expect(created.status).toBe(201);
    expect(created.json.role).toBe("reviewer");
    expect(device.jar.has("bd_admin")).toBe(true);
    expect(device.jar.has("bd_session")).toBe(false);

    const home = await device.request("GET", "/api/admin/me");
    expect(home.status).toBe(200);
    expect(home.json.user.role).toBe("reviewer");

    const again = t.client();
    const second = await otpGate(again, phone);
    expect(second.json.needsPasswordSetup).toBe(false);
    const bad = await again.request("POST", "/api/admin/auth/password", {
      body: { gate: second.json.gate, password: "wrong-password" },
    });
    expect(bad.status).toBe(401);
    const good = await again.request("POST", "/api/admin/auth/password", {
      body: { gate: second.json.gate, password: "correct-horse" },
    });
    expect(good.status).toBe(200);
    expect(good.json.permissions).toEqual(["content.review"]);
  });

  it("does not send a code or create an admin for a learner phone", async () => {
    const phone = freshPhone();
    await t.signUp(t.client(), phone);
    t.clock.advance(61);
    const before = t.sent.length;
    const res = await t.client().request("POST", "/api/admin/auth/otp/request", { body: { phone } });
    expect(res.status).toBe(200);
    expect(t.sent.length).toBe(before);
    const role = await t.db.query("select role from users where phone = $1", [phone]);
    expect(role.rows[0].role).toBe("learner");
  });

  it("rejects a learner session on admin routes and idle admin sessions", async () => {
    const learner = t.client();
    await t.signUp(learner, freshPhone());
    expect((await learner.request("GET", "/api/admin/me")).status).toBe(401);

    const { phone } = await makeAdmin("super_admin");
    const admin = t.client();
    const verified = await otpGate(admin, phone);
    await admin.request("POST", "/api/admin/auth/password/setup", {
      body: { gate: verified.json.gate, password: "correct-horse" },
    });
    t.clock.advance(31 * 60);
    expect((await admin.request("GET", "/api/admin/me")).status).toBe(401);
  });
});

describe("admin permission guards", () => {
  const expected = {
    super_admin: PERMISSIONS,
    content_manager: ["content.generate", "content.manage"],
    reviewer: ["content.review"],
    support_agent: ["users.read", "finance.read"],
  };

  it("returns 403 for every permission the role does not have", async () => {
    for (const [role, allowed] of Object.entries(expected)) {
      const { phone } = await makeAdmin(role);
      const device = t.client();
      const verified = await otpGate(device, phone);
      const started = await device.request("POST", "/api/admin/auth/password/setup", {
        body: { gate: verified.json.gate, password: "correct-horse" },
      });
      expect(started.status, role).toBe(201);
      for (const permission of PERMISSIONS) {
        const res = await device.request("GET", `/api/admin/guard/${permission}`);
        expect(res.status, `${role} ${permission}`).toBe(allowed.includes(permission) ? 200 : 403);
      }
      const audit = await device.request("GET", "/api/admin/audit");
      expect(audit.status, role).toBe(role === "super_admin" ? 200 : 403);
    }
    const denied = await t.db.query("select count(*)::int as n from audit_logs where action = 'admin_access_denied'");
    expect(denied.rows[0].n).toBeGreaterThan(0);
  });
});
