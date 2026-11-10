import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { freshPhone, createTestApp } from "../test-support/http-app.js";

let t;
beforeAll(async () => {
  t = await createTestApp();
});
afterAll(() => t.close());
beforeEach(() => t.resetLimits());

async function learner() {
  const phone = freshPhone();
  const device = t.client();
  const res = await t.signUp(device, phone);
  return { phone, device, user: res.json.user };
}

describe("single active session", () => {
  it("device B login makes device A's next request answer 401 session_replaced", async () => {
    const { phone, device: a, user } = await learner();
    expect((await a.request("GET", "/api/me")).status).toBe(200);

    const b = t.client();
    expect((await t.loginWithOtp(b, phone)).status).toBe(200);

    const stale = await a.request("GET", "/api/me");
    expect(stale.status).toBe(401);
    expect(stale.json.error.code).toBe("session_replaced");
    expect(stale.json.error.message_fa).toContain("با یه دستگاه دیگه وارد حسابت شدی");
    expect((await b.request("GET", "/api/me")).status).toBe(200);

    const { rows } = await t.db.query(
      "select revoked_reason from sessions where user_id = $1 order by created_at, id",
      [user.id],
    );
    expect(rows.map((r) => r.revoked_reason).sort()).toEqual([null, "replaced"]);
    const audited = await t.db.query("select 1 from audit_logs where action = 'session_replaced' and actor_id = $1", [user.id]);
    expect(audited.rows).toHaveLength(1);
  });

  it("keeps exactly one active learner session per user", async () => {
    const { phone, user } = await learner();
    for (let i = 0; i < 3; i += 1) await t.loginWithOtp(t.client(), phone);
    const { rows } = await t.db.query("select count(*)::int as n from sessions where user_id = $1 and revoked_at is null", [user.id]);
    expect(rows[0].n).toBe(1);
  });

  it("stores only a hash of the token and signs the cookie", async () => {
    const { device, user } = await learner();
    const cookie = device.jar.get("bd_session");
    const token = cookie.split(".")[0];
    const { rows } = await t.db.query("select token_hash from sessions where user_id = $1 and revoked_at is null", [user.id]);
    expect(rows[0].token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(rows[0].token_hash).not.toContain(token);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const tampered = t.client();
    tampered.jar.set("bd_session", `${token}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`);
    expect((await tampered.request("GET", "/api/me")).json.error.code).toBe("unauthenticated");
    const unsigned = t.client();
    unsigned.jar.set("bd_session", token);
    expect((await unsigned.request("GET", "/api/me")).json.error.code).toBe("unauthenticated");
  });
});

describe("cookie flags", () => {
  it("is HttpOnly, SameSite=Lax, Path=/ and not Secure outside production", async () => {
    const res = await t.signUp(t.client(), freshPhone());
    const line = res.setCookies.find((c) => c.startsWith("bd_session="));
    expect(line).toMatch(/HttpOnly/i);
    expect(line).toMatch(/SameSite=Lax/i);
    expect(line).toMatch(/Path=\//);
    expect(line).not.toMatch(/Secure/i);
    expect(line).toMatch(/Max-Age=2592000/);
  });

  it("is Secure in production", async () => {
    const prod = await createTestApp({ config: { NODE_ENV: "production", APP_BASE_URL: "https://bandora.example" } });
    try {
      const res = await prod.signUp(prod.client(), freshPhone());
      const line = res.setCookies.find((c) => c.startsWith("bd_session="));
      expect(line).toMatch(/Secure/i);
      expect(line).toMatch(/HttpOnly/i);
    } finally {
      await prod.close();
    }
  });
});

describe("requireUser", () => {
  it("answers 401 unauthenticated with no session", async () => {
    const res = await t.client().request("GET", "/api/me");
    expect(res.status).toBe(401);
    expect(res.json.error.code).toBe("unauthenticated");
  });

  it("answers 401 for an expired session", async () => {
    const { device, user } = await learner();
    await t.db.query("update sessions set expires_at = $2 where user_id = $1", [user.id, new Date(t.clock.now().getTime() - 1000)]);
    expect((await device.request("GET", "/api/me")).json.error.code).toBe("unauthenticated");
  });

  it("answers 403 blocked for a blocked user and revokes the session", async () => {
    const { device, user } = await learner();
    await t.db.query("update users set status = 'blocked' where id = $1", [user.id]);
    const res = await device.request("GET", "/api/me");
    expect(res.status).toBe(403);
    expect(res.json.error.code).toBe("blocked");
    const { rows } = await t.db.query("select revoked_reason from sessions where user_id = $1", [user.id]);
    expect(rows[0].revoked_reason).toBe("blocked");
    expect((await device.request("GET", "/api/me")).json.error.code).toBe("blocked");
  });

  it("does not log a blocked user in via OTP", async () => {
    const { phone, user } = await learner();
    await t.db.query("update users set status = 'blocked' where id = $1", [user.id]);
    const device = t.client();
    const res = await t.loginWithOtp(device, phone);
    expect(res.status).toBe(403);
    expect(res.json.error.code).toBe("blocked");
    expect(res.setCookies).toHaveLength(0);
  });

  it("answers 401 for a user pending deletion", async () => {
    const { device, user } = await learner();
    await t.db.query("update users set status = 'pending_deletion', deletion_requested_at = now() where id = $1", [user.id]);
    const res = await device.request("GET", "/api/me");
    expect(res.status).toBe(401);
    expect(res.json.error.details.reason).toBe("pending_deletion");
  });

  it("refreshes last_seen_at at most once a minute", async () => {
    const { device, user } = await learner();
    const seen = async () => (await t.db.query("select last_seen_at from sessions where user_id = $1 and revoked_at is null", [user.id])).rows[0].last_seen_at.getTime();
    const first = await seen();
    t.clock.advance(30);
    await device.request("GET", "/api/me");
    expect(await seen()).toBe(first);
    t.clock.advance(31);
    await device.request("GET", "/api/me");
    expect(await seen()).toBeGreaterThan(first);
  });
});

describe("POST /api/auth/logout", () => {
  it("revokes the session, clears the cookie and audits", async () => {
    const { device, user } = await learner();
    const saved = device.cookieHeader();
    const res = await device.request("POST", "/api/auth/logout");
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ ok: true });
    expect(res.setCookies.some((c) => c.startsWith("bd_session=;"))).toBe(true);
    expect(device.jar.size).toBe(0);

    const replay = t.client();
    for (const part of saved.split("; ")) {
      const [k, ...rest] = part.split("=");
      replay.jar.set(k, rest.join("="));
    }
    const after = await replay.request("GET", "/api/me");
    expect(after.status).toBe(401);
    expect(after.json.error.code).toBe("unauthenticated");
    const { rows } = await t.db.query("select revoked_reason from sessions where user_id = $1", [user.id]);
    expect(rows[0].revoked_reason).toBe("logout");
    const audited = await t.db.query("select 1 from audit_logs where action = 'auth_logout' and actor_id = $1", [user.id]);
    expect(audited.rows).toHaveLength(1);
  });

  it("is idempotent without a session", async () => {
    const res = await t.client().request("POST", "/api/auth/logout");
    expect(res.status).toBe(200);
  });
});

describe("CSRF origin check", () => {
  it("rejects mutating requests from another origin, with a bad Referer or with neither header", async () => {
    const phone = freshPhone();
    const device = t.client();
    const evil = await device.request("POST", "/api/auth/otp/request", { body: { phone }, origin: "https://evil.example" });
    expect(evil.status).toBe(403);
    expect(evil.json.error.code).toBe("forbidden");
    expect((await device.request("POST", "/api/auth/otp/request", { body: { phone }, origin: null })).status).toBe(403);
    expect((await device.request("POST", "/api/auth/otp/request", { body: { phone }, origin: "null" })).status).toBe(403);
    const badReferer = await device.request("POST", "/api/auth/otp/request", {
      body: { phone }, origin: null, headers: { referer: "https://evil.example/login" },
    });
    expect(badReferer.status).toBe(403);
    expect(t.sent.filter((s) => s.phone === phone)).toHaveLength(0);
  });

  it("accepts the request host, a same-host Referer, and APP_BASE_URL", async () => {
    const phone = freshPhone();
    const device = t.client();
    expect((await device.request("POST", "/api/auth/otp/request", { body: { phone }, origin: null, headers: { referer: `${t.base}/login` } })).status).toBe(200);

    const configured = await createTestApp({ config: { APP_BASE_URL: "https://bandora.example" } });
    try {
      const ok = await configured.client().request("POST", "/api/auth/otp/request", {
        body: { phone: freshPhone() }, origin: "https://bandora.example",
      });
      expect(ok.status).toBe(200);
    } finally {
      await configured.close();
    }
  });

  it("guards logout and every authenticated mutation too", async () => {
    const { device } = await learner();
    for (const [method, path, body] of [
      ["POST", "/api/auth/logout", undefined],
      ["PUT", "/api/me/locale", { locale: "en" }],
      ["PUT", "/api/onboarding", { step: 1, examType: "academic" }],
      ["POST", "/api/account/email-card/dismiss", undefined],
      ["PUT", "/api/account/email-password", { email: "a@b.co", password: "longenough1" }],
    ]) {
      const res = await device.request(method, path, { body, origin: "https://evil.example" });
      expect(res.status, `${method} ${path}`).toBe(403);
    }
    expect((await device.request("GET", "/api/me")).status).toBe(200);
  });
});
