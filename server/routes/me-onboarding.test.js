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
const step3 = (extra = {}) => ({
  step: 3, examDatePrecision: "exact", examDate: addDays(today(), 40), dailyMinutes: 45, studyDays: [0, 2, 4], ...extra,
});

describe("GET /api/me", () => {
  it("returns the documented shape for a brand-new learner", async () => {
    const { phone, device, user } = await learner();
    const res = await device.request("GET", "/api/me");
    expect(res.status).toBe(200);
    expect(res.json).toEqual({
      user: {
        id: user.id, firstName: "Sara", lastName: "Ahmadi", phone, email: null, hasPassword: false,
        role: "learner", locale: "fa", status: "active",
      },
      profile: null,
      onboarding: { completed: false, step: 1 },
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

  it("step 2 accepts the chip bands or null (unknown) and nothing else", async () => {
    const { device } = await learner();
    await put(device, { step: 1, examType: "academic" });
    for (const band of [5.5, 6, 6.5, 7, 7.5, 8, 8.5]) {
      const res = await put(device, { step: 2, targetBand: band });
      expect(res.status, String(band)).toBe(200);
      expect(res.json.profile.targetBand).toBe(band);
    }
    const unknown = await put(device, { step: 2, targetBand: null });
    expect(unknown.status).toBe(200);
    expect(unknown.json.profile.targetBand).toBeNull();
    for (const bad of [5, 9, 6.25, "7", undefined]) {
      expect((await put(device, { step: 2, targetBand: bad })).status, String(bad)).toBe(400);
    }
  });

  it("steps 2 and 3 need step 1 first", async () => {
    const { device } = await learner();
    const two = await put(device, { step: 2, targetBand: 7 });
    expect(two.status).toBe(400);
    expect(two.json.error.details.field).toBe("step");
    expect((await put(device, step3())).status).toBe(400);
  });

  it("step 3 validates exam date, minutes and study days", async () => {
    const { device } = await learner();
    await put(device, { step: 1, examType: "academic" });
    const bad = [
      step3({ examDate: addDays(today(), -1) }),
      step3({ examDate: today() }),
      step3({ examDate: "2026-13-40" }),
      step3({ examDate: "soon" }),
      step3({ examDate: undefined }),
      step3({ examDatePrecision: "approx", examDate: addDays(today(), 40) }),
      step3({ examDatePrecision: "approx", examDate: "2020-01" }),
      step3({ examDatePrecision: "never" }),
      step3({ dailyMinutes: 5 }),
      step3({ dailyMinutes: 241 }),
      step3({ dailyMinutes: 45.5 }),
      step3({ studyDays: [] }),
      step3({ studyDays: [7] }),
      step3({ studyDays: [-1] }),
      step3({ studyDays: [1, 1] }),
      step3({ studyDays: "1,2" }),
    ];
    for (const body of bad) expect((await put(device, body)).status, JSON.stringify(body)).toBe(400);
    expect((await device.request("GET", "/api/me")).json.onboarding.completed).toBe(false);
  });

  it("completes onboarding with an exact date", async () => {
    const { device, user } = await learner();
    await put(device, { step: 1, examType: "academic" });
    await put(device, { step: 2, targetBand: 7 });
    const examDate = addDays(today(), 30);
    const res = await put(device, step3({ examDate }));
    expect(res.status).toBe(200);
    expect(res.json.onboarding).toEqual({ completed: true, step: null });
    expect(res.json.profile).toMatchObject({
      examType: "academic", targetBand: 7, examDate, examDatePrecision: "exact", dailyMinutes: 45, studyDays: [0, 2, 4],
    });
    const { rows } = await t.db.query("select onboarding_completed_at from learner_profiles where user_id = $1", [user.id]);
    expect(rows[0].onboarding_completed_at).not.toBeNull();
    expect((await device.request("GET", "/api/me")).json.onboarding.completed).toBe(true);
  });

  it("stores an approximate month as its first day with precision 'approx'", async () => {
    const { device } = await learner();
    await put(device, { step: 1, examType: "general" });
    const month = addDays(today(), 70).slice(0, 7);
    const res = await put(device, step3({ examDatePrecision: "approx", examDate: month, studyDays: [6] }));
    expect(res.status).toBe(200);
    expect(res.json.profile).toMatchObject({ examDate: `${month}-01`, examDatePrecision: "approx" });
  });

  it("allows an unknown exam date and stores no date", async () => {
    const { device } = await learner();
    await put(device, { step: 1, examType: "general" });
    const res = await put(device, step3({ examDatePrecision: "unknown", examDate: undefined, dailyMinutes: 90 }));
    expect(res.status).toBe(200);
    expect(res.json.profile).toMatchObject({ examDate: null, examDatePrecision: "unknown", dailyMinutes: 90 });
    expect(res.json.onboarding.completed).toBe(true);
  });

  it("resumes at step 3 once a target band is saved, and keeps completion when steps are edited later", async () => {
    const { device } = await learner();
    await put(device, { step: 1, examType: "academic" });
    expect((await put(device, { step: 2, targetBand: 6.5 })).json.onboarding.step).toBe(3);
    await put(device, step3());
    const edited = await put(device, { step: 1, examType: "general" });
    expect(edited.json.onboarding).toEqual({ completed: true, step: null });
    expect(edited.json.profile.examType).toBe("general");
  });

  it("needs a session", async () => {
    expect((await put(t.client(), { step: 1, examType: "academic" })).status).toBe(401);
  });
});
