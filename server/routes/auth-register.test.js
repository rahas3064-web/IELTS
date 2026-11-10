/* global Buffer */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { freshPhone, createTestApp } from "../test-support/http-app.js";

let t;
beforeAll(async () => {
  t = await createTestApp();
});
afterAll(() => t.close());
beforeEach(() => t.resetLimits());

const register = (device, signupToken, extra = {}) =>
  device.request("POST", "/api/auth/register", { body: { signupToken, firstName: "Sara", lastName: "Ahmadi", ...extra } });

async function verifiedToken(phone) {
  const res = await t.loginWithOtp(t.client(), phone);
  return res.json.signupToken;
}

describe("POST /api/auth/register", () => {
  it("creates a verified user, trims names and starts a session", async () => {
    const phone = freshPhone();
    const device = t.client();
    const token = (await t.loginWithOtp(device, phone)).json.signupToken;
    const res = await register(device, token, { firstName: "  Sara ", lastName: " Ahmadi  " });
    expect(res.status).toBe(201);
    expect(res.json.user).toMatchObject({ firstName: "Sara", lastName: "Ahmadi", phone, role: "learner", locale: "fa" });
    expect(res.json.referral).toBeNull();
    const { rows } = await t.db.query("select phone_verified_at, status, role from users where phone = $1", [phone]);
    expect(rows[0].phone_verified_at).not.toBeNull();
    expect(rows[0]).toMatchObject({ status: "active", role: "learner" });
    expect((await device.request("GET", "/api/me")).status).toBe(200);
  });

  it("requires first and last name (1-60 chars)", async () => {
    const token = await verifiedToken(freshPhone());
    for (const body of [{ firstName: "" }, { lastName: "   " }, { firstName: "x".repeat(61) }, { lastName: 5 }]) {
      const res = await register(t.client(), token, body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(res.json.error.code).toBe("validation_failed");
      expect(res.json.error.message_fa).toBeTruthy();
    }
    const missing = await t.client().request("POST", "/api/auth/register", { body: { signupToken: token, firstName: "A" } });
    expect(missing.status).toBe(400);
    expect(missing.json.error.details.field).toBe("lastName");
    expect((await t.db.query("select 1 from users where first_name = 'x'")).rows).toHaveLength(0);
  });

  it("rejects forged, garbage and expired signup tokens", async () => {
    const phone = freshPhone();
    const token = await verifiedToken(phone);
    const [body, sig] = token.split(".");
    const forgedBody = Buffer.from(JSON.stringify({ p: freshPhone(), e: Date.now() + 600000 })).toString("base64url");
    for (const bad of ["garbage", `${forgedBody}.${sig}`, `${body}.AAAA`, ""]) {
      const res = await register(t.client(), bad);
      expect(res.status, bad).toBe(400);
      expect(res.json.error.details.field).toBe("signupToken");
    }
    t.clock.advance(10 * 60 + 5);
    const expired = await register(t.client(), token);
    expect(expired.status).toBe(400);
    expect(expired.json.error.details.field).toBe("signupToken");
    expect((await t.db.query("select 1 from users where phone = $1", [phone])).rows).toHaveLength(0);
  });

  it("answers 409 conflict when the phone already has an account", async () => {
    const phone = freshPhone();
    const token = await verifiedToken(phone);
    expect((await register(t.client(), token)).status).toBe(201);
    const second = await register(t.client(), token);
    expect(second.status).toBe(409);
    expect(second.json.error.code).toBe("conflict");
  });

  it("attributes a valid referral code", async () => {
    const referrer = (await t.signUp(t.client(), freshPhone())).json.user;
    await t.db.query("insert into referral_codes (user_id, code) values ($1, 'FRIEND42')", [referrer.id]);
    const phone = freshPhone();
    const res = await t.signUp(t.client(), phone, { referralCode: " friend42 " });
    expect(res.status).toBe(201);
    expect(res.json.referral).toEqual({ accepted: true });
    const { rows } = await t.db.query(
      `select a.referred_user_id, c.user_id as referrer from referral_attributions a
       join referral_codes c on c.id = a.code_id where a.referred_user_id = $1`,
      [res.json.user.id],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].referrer).toBe(referrer.id);
  });

  it("treats an invalid referral code as a field problem, not a failure", async () => {
    const countAttributions = async () => (await t.db.query("select count(*)::int as n from referral_attributions")).rows[0].n;
    const before = await countAttributions();
    for (const code of ["NOPE1234", "!!", "x".repeat(40)]) {
      const phone = freshPhone();
      const res = await t.signUp(t.client(), phone, { referralCode: code });
      expect(res.status, code).toBe(201);
      expect(res.json.referral).toEqual({ accepted: false });
      expect((await t.db.query("select 1 from users where phone = $1", [phone])).rows).toHaveLength(1);
    }
    expect(await countAttributions()).toBe(before);
  });

  it("ignores a deactivated referral code", async () => {
    const referrer = (await t.signUp(t.client(), freshPhone())).json.user;
    await t.db.query("insert into referral_codes (user_id, code, is_active) values ($1, 'OLDCODE1', false)", [referrer.id]);
    const res = await t.signUp(t.client(), freshPhone(), { referralCode: "OLDCODE1" });
    expect(res.status).toBe(201);
    expect(res.json.referral).toEqual({ accepted: false });
  });

  it("writes an audit row with a masked phone and no token", async () => {
    const phone = freshPhone();
    const res = await t.signUp(t.client(), phone);
    const { rows } = await t.db.query(
      "select actor_role, target_id, meta, ip_hash from audit_logs where action = 'auth_register' and actor_id = $1",
      [res.json.user.id],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].actor_role).toBe("learner");
    const text = JSON.stringify(rows[0]);
    expect(text).not.toContain(phone);
    expect(text).toContain(`${phone.slice(0, 4)}***${phone.slice(-4)}`);
    expect(rows[0].ip_hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
