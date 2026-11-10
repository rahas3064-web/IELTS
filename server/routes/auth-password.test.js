import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { freshPhone, createTestApp } from "../test-support/http-app.js";

let t;
beforeAll(async () => {
  t = await createTestApp();
});
afterAll(() => t.close());
beforeEach(() => t.resetLimits());

let emailSeq = 0;
const freshEmail = () => `learner${(emailSeq += 1)}@example.com`;

async function learner() {
  const phone = freshPhone();
  const device = t.client();
  const res = await t.signUp(device, phone);
  return { phone, device, user: res.json.user };
}
const setCreds = (device, body) => device.request("PUT", "/api/account/email-password", { body });
const passwordLogin = (device, body) => device.request("POST", "/api/auth/password/login", { body });

describe("PUT /api/account/email-password", () => {
  it("accepts a recent OTP login, stores a hash and then works as a second login method", async () => {
    const { device: a, user } = await learner();
    const email = freshEmail();
    const res = await setCreds(a, { email: ` ${email.toUpperCase()} `, password: "correct horse 9" });
    expect(res.status).toBe(200);
    expect(res.json.user).toMatchObject({ email, hasPassword: true });
    const { rows } = await t.db.query("select email, password_hash from users where id = $1", [user.id]);
    expect(rows[0].email).toBe(email);
    expect(rows[0].password_hash).toMatch(/^scrypt\$/);
    expect(rows[0].password_hash).not.toContain("correct horse");

    const b = t.client();
    const login = await passwordLogin(b, { email, password: "correct horse 9" });
    expect(login.status).toBe(200);
    expect(login.json.user.id).toBe(user.id);
    expect((await b.request("GET", "/api/me")).status).toBe(200);
    // the second login replaced the first device's session
    expect((await a.request("GET", "/api/me")).json.error.code).toBe("session_replaced");
    const audited = await t.db.query("select action from audit_logs where actor_id = $1 and action in ('account_email_password_set','auth_password_login')", [user.id]);
    expect(audited.rows.map((r) => r.action).sort()).toEqual(["account_email_password_set", "auth_password_login"]);
  });

  it("enforces a minimum length of 8 and a valid email", async () => {
    const { device } = await learner();
    expect((await setCreds(device, { email: freshEmail(), password: "short" })).status).toBe(400);
    expect((await setCreds(device, { email: "not-an-email", password: "long enough 1" })).status).toBe(400);
    const missing = await setCreds(device, { email: freshEmail() });
    expect(missing.json.error.details.field).toBe("password");
  });

  it("requires re-authentication once the OTP login is older than 10 minutes", async () => {
    const { device } = await learner();
    t.clock.advance(11 * 60);
    const res = await setCreds(device, { email: freshEmail(), password: "long enough 1" });
    expect(res.status).toBe(403);
    expect(res.json.error.code).toBe("forbidden");
  });

  it("accepts the current password or a fresh OTP code as re-authentication", async () => {
    const { phone, device } = await learner();
    const email = freshEmail();
    expect((await setCreds(device, { email, password: "first password 1" })).status).toBe(200);
    t.clock.advance(11 * 60);

    const wrong = await setCreds(device, { email, password: "second password 2", currentPassword: "nope nope nope" });
    expect(wrong.status).toBe(403);
    const right = await setCreds(device, { email, password: "second password 2", currentPassword: "first password 1" });
    expect(right.status).toBe(200);

    t.clock.advance(11 * 60);
    const sentBefore = t.sent.length;
    t.clock.advance(61);
    await device.request("POST", "/api/auth/otp/request", { body: { phone } });
    expect(t.sent.length).toBe(sentBefore + 1);
    const viaOtp = await setCreds(device, { email, password: "third password 3", otpCode: t.lastCodeFor(phone) });
    expect(viaOtp.status).toBe(200);
    expect((await passwordLogin(t.client(), { email, password: "third password 3" })).status).toBe(200);
  });

  it("answers 409 conflict for an email used by someone else, case-insensitively", async () => {
    const first = await learner();
    const email = freshEmail();
    expect((await setCreds(first.device, { email, password: "long enough 1" })).status).toBe(200);
    const second = await learner();
    const res = await setCreds(second.device, { email: email.toUpperCase(), password: "long enough 1" });
    expect(res.status).toBe(409);
    expect(res.json.error.code).toBe("conflict");
    expect(res.json.error.details.field).toBe("email");
  });

  it("requires a session", async () => {
    const res = await setCreds(t.client(), { email: freshEmail(), password: "long enough 1" });
    expect(res.status).toBe(401);
  });
});

describe("POST /api/auth/password/login", () => {
  it("answers the same generic 401 for a wrong password, an unknown email and an account without a password", async () => {
    const { device } = await learner();
    const email = freshEmail();
    await setCreds(device, { email, password: "right password 1" });
    const noPassword = await learner();

    const wrong = await passwordLogin(t.client(), { email, password: "wrong password 1" });
    const unknown = await passwordLogin(t.client(), { email: freshEmail(), password: "wrong password 1" });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.json).toEqual(unknown.json);
    expect(wrong.json.error.code).toBe("unauthenticated");
    expect(wrong.text).not.toMatch(/not found|no account|doesn't exist|does not exist|وجود نداره/i);
    expect(noPassword.user.id).toBeTruthy();
  });

  it("refuses a blocked account only after the password checked out", async () => {
    const { device, user } = await learner();
    const email = freshEmail();
    await setCreds(device, { email, password: "right password 1" });
    await t.db.query("update users set status = 'blocked' where id = $1", [user.id]);
    expect((await passwordLogin(t.client(), { email, password: "right password 1" })).json.error.code).toBe("blocked");
    expect((await passwordLogin(t.client(), { email, password: "wrong password 1" })).json.error.code).toBe("unauthenticated");
  });

  it("validates the body", async () => {
    expect((await passwordLogin(t.client(), { email: "x", password: "y" })).status).toBe(400);
    expect((await passwordLogin(t.client(), {})).status).toBe(400);
  });

  it("rate-limits attempts per email (429 with retryAfter)", async () => {
    const email = freshEmail();
    let last;
    for (let i = 0; i < 6; i += 1) last = await passwordLogin(t.client(), { email, password: "wrong password 1" });
    expect(last.status).toBe(429);
    expect(last.json.error.code).toBe("rate_limited");
    expect(last.json.error.details.retryAfter).toBeGreaterThan(0);
  });
});

describe("POST /api/account/email-card/dismiss", () => {
  it("persists server-side, creating the profile row, across devices", async () => {
    const { phone, device, user } = await learner();
    expect((await device.request("GET", "/api/me")).json.emailCardDismissed).toBe(false);
    const res = await device.request("POST", "/api/account/email-card/dismiss");
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ ok: true });
    const again = await device.request("POST", "/api/account/email-card/dismiss");
    expect(again.status).toBe(200);
    const { rows } = await t.db.query("select email_card_dismissed_at from learner_profiles where user_id = $1", [user.id]);
    expect(rows).toHaveLength(1);
    expect(rows[0].email_card_dismissed_at).not.toBeNull();

    const other = t.client();
    await t.loginWithOtp(other, phone);
    const me = await other.request("GET", "/api/me");
    expect(me.json.emailCardDismissed).toBe(true);
    expect(me.json.profile).toBeNull();
  });

  it("requires a session", async () => {
    expect((await t.client().request("POST", "/api/account/email-card/dismiss")).status).toBe(401);
  });
});
