import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createMigratedDb } from "../../db/test-helpers.js";
import { resetLimits } from "../rate-limit.js";
import { createOtpService } from "./otp.js";
import { hmacHex } from "./tokens.js";

const PEPPER = "p".repeat(40);
let db;
let time;
let sent;
let otp;

const clock = { now: () => new Date(time) };
const advance = (seconds) => {
  time += seconds * 1000;
};
const sms = {
  async sendVerify(phone, template, params) {
    sent.push({ phone, template, code: params.CODE });
    return { providerMessageId: "t", mode: "console" };
  },
};
const lastCode = () => sent.at(-1).code;
let phoneCounter = 0;
const nextPhone = () => `0912${String(1000000 + (phoneCounter += 1))}`;

async function expectApiError(promise, { status, code }) {
  const error = await promise.then(
    () => null,
    (e) => e,
  );
  expect(error, "expected the promise to reject").not.toBeNull();
  expect({ status: error.status, code: error.code }).toEqual({ status, code });
  return error;
}

beforeAll(async () => {
  db = await createMigratedDb();
});
afterAll(async () => {
  await db.close();
});
beforeEach(async () => {
  time = Date.now();
  sent = [];
  await resetLimits(db);
  await db.query("delete from otp_codes");
  await db.query("delete from otp_locks");
  await db.query("delete from system_settings where key = 'otp'");
  otp = createOtpService({ db, pepper: PEPPER, sms, now: clock.now });
});

describe("request", () => {
  it("sends a 5-digit code and stores only its HMAC-SHA256 under the pepper", async () => {
    const phone = nextPhone();
    const result = await otp.request({ phone, purpose: "login", ip: "1.1.1.1" });
    expect(result).toEqual({ resendAfterSec: 60, expiresInSec: 120 });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ phone, template: "otp" });
    expect(lastCode()).toMatch(/^\d{5}$/);

    const { rows } = await db.query("select * from otp_codes where phone = $1", [phone]);
    expect(rows).toHaveLength(1);
    expect(rows[0].code_hash).toBe(hmacHex(PEPPER, lastCode()));
    expect(rows[0].code_hash).not.toContain(lastCode());
    expect(JSON.stringify(rows[0])).not.toContain(lastCode());
    expect(new Date(rows[0].expires_at).getTime() - new Date(rows[0].created_at).getTime()).toBe(120_000);
    expect(rows[0].attempts).toBe(0);
  });

  it("uses a CSPRNG-range of codes (leading zeros allowed, always 5 digits)", async () => {
    const codes = new Set();
    for (let i = 0; i < 12; i += 1) {
      advance(61);
      await otp.request({ phone: nextPhone(), purpose: "login", ip: `9.9.9.${i}` });
      expect(lastCode()).toMatch(/^\d{5}$/);
      codes.add(lastCode());
    }
    expect(codes.size).toBeGreaterThan(8);
  });

  it("blocks a resend within 60 seconds with retryAfter, then allows it and kills the old code", async () => {
    const phone = nextPhone();
    await otp.request({ phone, purpose: "login", ip: "1.1.1.1" });
    const first = lastCode();
    advance(20);
    const error = await expectApiError(otp.request({ phone, purpose: "login", ip: "1.1.1.1" }), {
      status: 429,
      code: "rate_limited",
    });
    expect(error.details.retryAfter).toBe(40);
    expect(sent).toHaveLength(1);

    advance(41);
    await otp.request({ phone, purpose: "login", ip: "1.1.1.1" });
    expect(sent).toHaveLength(2);
    if (first !== lastCode()) {
      await expectApiError(otp.verify({ phone, purpose: "login", code: first }), { status: 400, code: "validation_failed" });
    }
    await expect(otp.verify({ phone, purpose: "login", code: lastCode() })).resolves.toBe(true);
  });

  it("limits requests to 5 per phone per hour", async () => {
    const phone = nextPhone();
    for (let i = 0; i < 5; i += 1) {
      await otp.request({ phone, purpose: "login", ip: `2.2.2.${i}` });
      advance(61);
    }
    const error = await expectApiError(otp.request({ phone, purpose: "login", ip: "2.2.2.99" }), { status: 429, code: "rate_limited" });
    expect(error.details.retryAfter).toBeGreaterThan(0);
    expect(error.details.retryAfter).toBeLessThanOrEqual(3600);
    expect(sent).toHaveLength(5);
  });

  it("limits requests to 20 per IP per hour across phones", async () => {
    for (let i = 0; i < 20; i += 1) await otp.request({ phone: nextPhone(), purpose: "login", ip: "3.3.3.3" });
    await expectApiError(otp.request({ phone: nextPhone(), purpose: "login", ip: "3.3.3.3" }), { status: 429, code: "rate_limited" });
    await expect(otp.request({ phone: nextPhone(), purpose: "login", ip: "4.4.4.4" })).resolves.toBeTruthy();
  });

  it("reads ttl and resend window from system_settings 'otp'", async () => {
    await db.query(`insert into system_settings (key, value) values ('otp', $1::jsonb)`, [
      JSON.stringify({ ttlSec: 30, resendSec: 10, maxAttempts: 2, lockMinutes: 1 }),
    ]);
    const phone = nextPhone();
    const result = await otp.request({ phone, purpose: "login", ip: "5.5.5.5" });
    expect(result).toEqual({ resendAfterSec: 10, expiresInSec: 30 });
    advance(11);
    await otp.request({ phone, purpose: "login", ip: "5.5.5.5" });
    advance(31);
    await expectApiError(otp.verify({ phone, purpose: "login", code: lastCode() }), { status: 400, code: "validation_failed" });
  });

  it("refuses to send while the phone is locked", async () => {
    const phone = nextPhone();
    await otp.request({ phone, purpose: "login", ip: "6.6.6.6" });
    for (let i = 0; i < 5; i += 1) await otp.verify({ phone, purpose: "login", code: "00000" === lastCode() ? "00001" : "00000" }).catch(() => {});
    advance(61);
    const error = await expectApiError(otp.request({ phone, purpose: "login", ip: "6.6.6.6" }), { status: 423, code: "otp_locked" });
    expect(error.details.retryAfter).toBeGreaterThan(0);
    expect(sent).toHaveLength(1);
  });
});

describe("verify", () => {
  it("accepts the right code once and marks it consumed", async () => {
    const phone = nextPhone();
    await otp.request({ phone, purpose: "login", ip: "7.7.7.7" });
    await expect(otp.verify({ phone, purpose: "login", code: lastCode() })).resolves.toBe(true);
    await expectApiError(otp.verify({ phone, purpose: "login", code: lastCode() }), { status: 400, code: "validation_failed" });
    const { rows } = await db.query("select consumed_at from otp_codes where phone = $1", [phone]);
    expect(rows[0].consumed_at).not.toBeNull();
  });

  it("lets only one of two concurrent verifications of the same code succeed", async () => {
    const phone = nextPhone();
    await otp.request({ phone, purpose: "login", ip: "7.7.7.8" });
    const code = lastCode();
    const results = await Promise.allSettled([
      otp.verify({ phone, purpose: "login", code }),
      otp.verify({ phone, purpose: "login", code }),
      otp.verify({ phone, purpose: "login", code }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(2);
  });

  it("rejects an expired code (after 2 minutes)", async () => {
    const phone = nextPhone();
    await otp.request({ phone, purpose: "login", ip: "7.7.7.9" });
    advance(121);
    await expectApiError(otp.verify({ phone, purpose: "login", code: lastCode() }), { status: 400, code: "validation_failed" });
  });

  it("still accepts the code just before it expires", async () => {
    const phone = nextPhone();
    await otp.request({ phone, purpose: "login", ip: "7.7.7.10" });
    advance(119);
    await expect(otp.verify({ phone, purpose: "login", code: lastCode() })).resolves.toBe(true);
  });

  it("counts wrong attempts and reports how many are left", async () => {
    const phone = nextPhone();
    await otp.request({ phone, purpose: "login", ip: "8.8.8.8" });
    const wrong = lastCode() === "00000" ? "00001" : "00000";
    const error = await expectApiError(otp.verify({ phone, purpose: "login", code: wrong }), { status: 400, code: "validation_failed" });
    expect(error.details).toMatchObject({ field: "code", attemptsLeft: 4 });
    const { rows } = await db.query("select attempts from otp_codes where phone = $1", [phone]);
    expect(rows[0].attempts).toBe(1);
  });

  it("locks the phone for 15 minutes after 5 wrong codes, even for the right code", async () => {
    const phone = nextPhone();
    await otp.request({ phone, purpose: "login", ip: "8.8.8.9" });
    const right = lastCode();
    const wrong = right === "00000" ? "00001" : "00000";
    for (let i = 0; i < 4; i += 1) {
      await expectApiError(otp.verify({ phone, purpose: "login", code: wrong }), { status: 400, code: "validation_failed" });
    }
    await expectApiError(otp.verify({ phone, purpose: "login", code: wrong }), { status: 423, code: "otp_locked" });
    const locked = await expectApiError(otp.verify({ phone, purpose: "login", code: right }), { status: 423, code: "otp_locked" });
    expect(locked.details.retryAfter).toBeGreaterThan(14 * 60);

    advance(14 * 60);
    await expectApiError(otp.verify({ phone, purpose: "login", code: right }), { status: 423, code: "otp_locked" });
    advance(61);
    // The lock is over, but the code that was attacked is dead: a new one is needed.
    await expectApiError(otp.verify({ phone, purpose: "login", code: right }), { status: 400, code: "validation_failed" });
    await otp.request({ phone, purpose: "login", ip: "8.8.8.9" });
    await expect(otp.verify({ phone, purpose: "login", code: lastCode() })).resolves.toBe(true);
  });

  it("keeps purposes apart", async () => {
    const phone = nextPhone();
    await otp.request({ phone, purpose: "login", ip: "9.1.1.1" });
    await expectApiError(otp.verify({ phone, purpose: "delete_account", code: lastCode() }), { status: 400, code: "validation_failed" });
  });

  it("does not treat a lock-killed code as a successful verification", async () => {
    const phone = nextPhone();
    await otp.request({ phone, purpose: "login", ip: "9.2.2.2" });
    const wrong = lastCode() === "00000" ? "00001" : "00000";
    for (let i = 0; i < 5; i += 1) await otp.verify({ phone, purpose: "login", code: wrong }).catch(() => {});
    await expect(otp.hasRecentVerification({ phone, purpose: "login", withinMs: 600_000 })).resolves.toBe(false);
  });
});

describe("hasRecentVerification", () => {
  it("is true for 10 minutes after a successful verify and false after", async () => {
    const phone = nextPhone();
    await expect(otp.hasRecentVerification({ phone, purpose: "login", withinMs: 600_000 })).resolves.toBe(false);
    await otp.request({ phone, purpose: "login", ip: "9.3.3.3" });
    await otp.verify({ phone, purpose: "login", code: lastCode() });
    await expect(otp.hasRecentVerification({ phone, purpose: "login", withinMs: 600_000 })).resolves.toBe(true);
    advance(601);
    await expect(otp.hasRecentVerification({ phone, purpose: "login", withinMs: 600_000 })).resolves.toBe(false);
  });
});
