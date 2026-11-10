import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { insert } from "../../db/test-helpers.js";
import { addDays, tehranDay, tehranWeekStart } from "../core/tehran-time.js";
import { completedPractice } from "../test-support/activity-fixtures.js";
import { createTestApp, freshPhone } from "../test-support/http-app.js";
import { recordActivity } from "../services/streak.js";

let t;
beforeAll(async () => {
  t = await createTestApp();
});
afterAll(() => t.close());
beforeEach(() => t.resetLimits());

async function learner() {
  const device = t.client();
  const res = await t.signUp(device, freshPhone());
  return { device, user: res.json.user };
}
const frame = (device) => device.request("GET", "/api/frame");
const today = () => tehranDay(t.clock.now());
const profile = (user, fields) =>
  insert(t.db, "learner_profiles", {
    user_id: user.id, exam_type: "academic", exam_date_precision: "unknown", daily_minutes: 30, study_days: "{0,1,2,3,4,5,6}", ...fields,
  });

async function studyPlan(user, { status = "active", weekStart = tehranWeekStart(t.clock.now()) } = {}) {
  return insert(t.db, "study_plans", { user_id: user.id, week_start: weekStart, phase: 1, inputs: "{}", status });
}
const task = (plan, day, fields = {}) =>
  insert(t.db, "plan_tasks", {
    plan_id: plan.id, day, original_day: day, skill: "reading", kind: "review", title_fa: "تمرین", title_en: "Practice", minutes: 20, ...fields,
  });

describe("GET /api/frame", () => {
  it("needs a session", async () => {
    expect((await frame(t.client())).status).toBe(401);
  });

  it("returns the documented zero state for a brand-new learner", async () => {
    const { device } = await learner();
    const res = await frame(device);
    expect(res.status).toBe(200);
    expect(res.json).toEqual({
      unreadCount: 0,
      streak: { current: 0, best: 0, activeToday: false },
      examCountdown: { days: null, date: null, precision: null, past: false },
      planToday: { total: 0, done: 0 },
    });
  });

  it("counts unread notifications only", async () => {
    const { device, user } = await learner();
    await insert(t.db, "notifications", { user_id: user.id, kind: "info", title: "a", body: "b" });
    await insert(t.db, "notifications", { user_id: user.id, kind: "info", title: "a", body: "b" });
    await insert(t.db, "notifications", { user_id: user.id, kind: "info", title: "a", body: "b", read_at: new Date() });
    expect((await frame(device)).json.unreadCount).toBe(2);
  });

  it("shows the streak, and drops a stale cache after a missed day", async () => {
    const { device, user } = await learner();
    await completedPractice(t.db, user.id, t.clock.now());
    await recordActivity(t.db, user.id, t.clock.now());
    expect((await frame(device)).json.streak).toEqual({ current: 1, best: 1, activeToday: true });
    t.clock.advance(24 * 3600);
    expect((await frame(device)).json.streak).toEqual({ current: 1, best: 1, activeToday: false });
    t.clock.advance(24 * 3600);
    expect((await frame(device)).json.streak).toEqual({ current: 0, best: 1, activeToday: false });
  });

  it("derives the exam countdown in Tehran days", async () => {
    const { device, user } = await learner();
    const date = addDays(today(), 20);
    await profile(user, { exam_date: date, exam_date_precision: "exact" });
    expect((await frame(device)).json.examCountdown).toEqual({ days: 20, date, precision: "exact", past: false });
    t.clock.advance(21 * 24 * 3600); // stays inside the 30-day session
    expect((await frame(device)).json.examCountdown).toEqual({ days: null, date, precision: "exact", past: true });
  });

  it("reports an unknown exam date as unknown", async () => {
    const { device, user } = await learner();
    await profile(user, {});
    expect((await frame(device)).json.examCountdown).toEqual({ days: null, date: null, precision: "unknown", past: false });
  });

  it("summarises today's plan tasks (skipped ones do not count, other days and old plans are ignored)", async () => {
    const { device, user } = await learner();
    const old = await studyPlan(user, { status: "superseded" });
    const plan = await studyPlan(user);
    await task(old, today());
    await task(plan, today());
    await task(plan, today(), { status: "done", done_at: new Date() });
    await task(plan, today(), { status: "skipped" });
    await task(plan, addDays(today(), 1));
    expect((await frame(device)).json.planToday).toEqual({ total: 2, done: 1 });
  });

  it("never mixes in another learner's data", async () => {
    const a = await learner();
    const b = await learner();
    await insert(t.db, "notifications", { user_id: b.user.id, kind: "info", title: "a", body: "b" });
    await completedPractice(t.db, b.user.id, t.clock.now());
    await recordActivity(t.db, b.user.id, t.clock.now());
    const plan = await studyPlan(b.user);
    await task(plan, today());
    const res = await frame(a.device);
    expect(res.json).toMatchObject({ unreadCount: 0, streak: { current: 0 }, planToday: { total: 0, done: 0 } });
  });

  it("costs a single query on top of authentication (one round trip)", async () => {
    const { device } = await learner();
    await device.request("GET", "/api/me"); // warm up: a first request may also touch the session
    const original = t.db.query.bind(t.db);
    let calls = 0;
    t.db.query = (...args) => {
      calls += 1;
      return original(...args);
    };
    try {
      await device.request("GET", "/api/me");
      const meCalls = calls; // authentication + the one /api/me query
      calls = 0;
      await frame(device);
      expect(calls).toBe(meCalls);
    } finally {
      t.db.query = original;
    }
  });
});
