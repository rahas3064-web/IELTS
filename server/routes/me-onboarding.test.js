import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { addDays, tehranDay } from "../core/tehran-time.js";
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
  const res = await t.signUp(device, phone, { firstName: "Sara", lastName: "Ahmadi" });
  return { phone, device, user: res.json.user };
}
const put = (device, body) => device.request("PUT", "/api/onboarding", { body });
const today = () => tehranDay(t.clock.now());
const goal = (extra = {}) => ({ step: 2, targetBand: 7, examDatePrecision: "unknown", ...extra });
const step3 = (extra = {}) => ({ step: 3, placementMode: "full", ...extra });

describe("GET /api/me", () => {
  it("returns the documented shape for a brand-new learner", async () => {
    const { phone, device, user } = await learner();
    const res = await device.request("GET", "/api/me");
    expect(res.status).toBe(200);
    expect(res.json).toEqual({
      user: {
        id: user.id, firstName: "Sara", lastName: "Ahmadi", phone, email: null, hasPassword: false, phoneVerified: true,
        role: "learner", locale: "fa", status: "active",
      },
      profile: null,
      onboarding: { completed: false, step: 1 },
      placementCompleted: false,
      subscription: { plan: "free", endsAt: null },
      emailCardDismissed: false,
    });
  });

  it("never exposes secrets or internal columns", async () => {
    const { device } = await learner();
    const text = (await device.request("GET", "/api/me")).text;
    expect(text).not.toMatch(/password_hash|token|code_hash|deletion_requested_at/);
  });
});

describe("PUT /api/me/locale", () => {
  it("switches between fa and en and persists", async () => {
    const { device, phone } = await learner();
    const res = await device.request("PUT", "/api/me/locale", { body: { locale: "en" } });
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ locale: "en" });
    const other = t.client();
    await t.loginWithOtp(other, phone);
    expect((await other.request("GET", "/api/me")).json.user.locale).toBe("en");
  });

  it("rejects unknown locales and needs a session", async () => {
    const { device } = await learner();
    expect((await device.request("PUT", "/api/me/locale", { body: { locale: "de" } })).status).toBe(400);
    expect((await t.client().request("PUT", "/api/me/locale", { body: { locale: "en" } })).status).toBe(401);
  });
});

describe("PUT /api/onboarding", () => {
  it("step 1 stores the exam type and returns the /api/me payload", async () => {
    const { device } = await learner();
    const res = await put(device, { step: 1, examType: "general" });
    expect(res.status).toBe(200);
    expect(res.json.profile).toMatchObject({ examType: "general" });
    expect(res.json.onboarding).toEqual({ completed: false, step: 2 });
    expect(res.json.user.firstName).toBe("Sara");
  });

  it("rejects bad steps and bad exam types", async () => {
    const { device } = await learner();
    for (const body of [{ step: 0 }, { step: 4, examType: "academic" }, { step: "1", examType: "academic" }, { step: 1, examType: "ukvi" }, { step: 1 }, {}]) {
      expect((await put(device, body)).status, JSON.stringify(body)).toBe(400);
    }
  });

  it("step 2 accepts half-bands from 5.0 to 9.0 and an exact or unknown date", async () => {
    const { device } = await learner();
    await put(device, { step: 1, examType: "academic" });
    for (const band of [5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9]) {
      const res = await put(device, goal({ targetBand: band }));
      expect(res.status, String(band)).toBe(200);
      expect(res.json.profile.targetBand).toBe(band);
      expect(res.json.onboarding.step).toBe(3);
    }
    for (const bad of [4.5, 9.5, 6.25, null, "7", undefined]) {
      expect((await put(device, goal({ targetBand: bad }))).status, String(bad)).toBe(400);
    }
    expect((await put(device, goal({ examDatePrecision: "approx", examDate: "2027-04" }))).status).toBe(400);
  });

  it("steps 2 and 3 need step 1 first", async () => {
    const { device } = await learner();
    const two = await put(device, goal());
    expect(two.status).toBe(400);
    expect(two.json.error.details.field).toBe("step");
    expect((await put(device, step3())).status).toBe(400);
  });

  it("step 2 rejects a missing, past, or invalid exam date", async () => {
    const { device } = await learner();
    await put(device, { step: 1, examType: "academic" });
    const bad = [
      goal({ examDatePrecision: "exact", examDate: addDays(today(), -1) }),
      goal({ examDatePrecision: "exact", examDate: today() }),
      goal({ examDatePrecision: "exact", examDate: "2026-13-40" }),
      goal({ examDatePrecision: "exact", examDate: "soon" }),
      goal({ examDatePrecision: "exact" }),
      goal({ examDatePrecision: "never" }),
    ];
    for (const body of bad) expect((await put(device, body)).status, JSON.stringify(body)).toBe(400);
    expect((await device.request("GET", "/api/me")).json.onboarding.completed).toBe(false);
  });

  it("completes onboarding with the default week and the chosen mode", async () => {
    const { device, user } = await learner();
    await put(device, { step: 1, examType: "academic" });
    const examDate = addDays(today(), 30);
    await put(device, goal({ examDatePrecision: "exact", examDate }));
    const res = await put(device, step3());
    expect(res.status).toBe(200);
    expect(res.json.onboarding).toEqual({ completed: true, step: null });
    expect(res.json.placementCompleted).toBe(false);
    expect(res.json.profile).toMatchObject({
      examType: "academic", targetBand: 7, examDate, examDatePrecision: "exact",
      dailyMinutes: 10, studyDays: [0, 1, 2, 3, 4], placementMode: "full",
    });
    const { rows } = await t.db.query("select onboarding_completed_at from learner_profiles where user_id = $1", [user.id]);
    expect(rows[0].onboarding_completed_at).not.toBeNull();
  });

  it("skip finishes onboarding without a placement mode", async () => {
    const { device } = await learner();
    await put(device, { step: 1, examType: "general" });
    await put(device, goal({ targetBand: 5 }));
    const res = await put(device, { step: 3 });
    expect(res.status).toBe(200);
    expect(res.json.onboarding.completed).toBe(true);
    expect(res.json.profile).toMatchObject({
      examDate: null, examDatePrecision: "unknown", dailyMinutes: 10, studyDays: [0, 1, 2, 3, 4], placementMode: null,
    });
  });

  it("rejects a bad placement mode and mode before the goal is saved", async () => {
    const { device } = await learner();
    await put(device, { step: 1, examType: "academic" });
    expect((await put(device, { step: 3, placementMode: "official" })).status).toBe(400);
    expect((await put(device, { step: 3 })).status).toBe(400);
    expect((await device.request("GET", "/api/me")).json.onboarding.completed).toBe(false);
  });

  it("resumes at step 3 once a target band is saved, and keeps completion when steps are edited later", async () => {
    const { device } = await learner();
    await put(device, { step: 1, examType: "academic" });
    expect((await put(device, goal({ targetBand: 6.5 }))).json.onboarding.step).toBe(3);
    await put(device, step3());
    const edited = await put(device, { step: 1, examType: "general" });
    expect(edited.json.onboarding).toEqual({ completed: true, step: null });
    expect(edited.json.profile.examType).toBe("general");
  });

  it("needs a session", async () => {
    expect((await put(t.client(), { step: 1, examType: "academic" })).status).toBe(401);
  });
});
