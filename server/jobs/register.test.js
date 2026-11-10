import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createMigratedDb, insert } from "../../db/test-helpers.js";
import { JOB_SCHEDULES, createJobRunner } from "../core/jobs.js";
import { newLearner } from "../test-support/activity-fixtures.js";
import { registerJobs, shouldStartJobs } from "./register.js";

let db;
beforeAll(async () => {
  db = await createMigratedDb();
});
afterAll(() => db.close());

const silent = () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() });

describe("shouldStartJobs", () => {
  it("runs in production or when ENABLE_JOBS=1, never otherwise", () => {
    expect(shouldStartJobs({ NODE_ENV: "production" })).toBe(true);
    expect(shouldStartJobs({ NODE_ENV: "development", ENABLE_JOBS: "1" })).toBe(true);
    expect(shouldStartJobs({ NODE_ENV: "development" })).toBe(false);
    expect(shouldStartJobs({ NODE_ENV: "development", ENABLE_JOBS: "0" })).toBe(false);
    expect(shouldStartJobs({ NODE_ENV: "test", ENABLE_JOBS: "true" })).toBe(false);
    expect(shouldStartJobs({})).toBe(false);
  });
});

describe("registerJobs", () => {
  const sms = { sendTemplate: vi.fn(async () => ({ providerMessageId: "x", mode: "console" })) };

  it("registers study-reminders and otp-cleanup on the spec schedules, in Tehran time", () => {
    const runner = createJobRunner({ db, logger: silent() });
    registerJobs(runner, { sms, logger: silent() });
    const jobs = Object.fromEntries(runner.list().map((job) => [job.name, job]));
    expect(Object.keys(jobs).sort()).toEqual(["otp-cleanup", "study-reminders"]);
    expect(jobs["study-reminders"]).toMatchObject({ schedule: JOB_SCHEDULES["study-reminders"].schedule, timezone: "Asia/Tehran" });
    expect(jobs["otp-cleanup"]).toMatchObject({ schedule: JOB_SCHEDULES["otp-cleanup"].schedule, timezone: "Asia/Tehran" });
  });

  it("runs otp-cleanup through the runner and logs the run", async () => {
    const old = new Date("2026-01-01T00:00:00Z");
    await insert(db, "otp_codes", { phone: "09000000099", purpose: "login", code_hash: "h", expires_at: old, last_sent_at: old, created_at: old });
    const runner = createJobRunner({ db, logger: silent() });
    registerJobs(runner, { sms, logger: silent() });
    const result = await runner.runJob("otp-cleanup");
    expect(result).toMatchObject({ status: "ok", stats: { codes: 1 } });
    const { rows } = await db.query("select status from job_runs where job = 'otp-cleanup'");
    expect(rows).toEqual([{ status: "ok" }]);
  });

  it("runs study-reminders through the runner with the injected sender", async () => {
    await newLearner(db, { reminderTime: "19:00" });
    const at = new Date("2026-11-10T15:30:00Z"); // 19:00 Tehran, a Tuesday
    const runner = createJobRunner({ db, now: () => at, logger: silent() });
    registerJobs(runner, { sms, logger: silent() });
    const result = await runner.runJob("study-reminders");
    expect(result).toMatchObject({ status: "ok", stats: { sent: 1, failed: 0 } });
    expect(sms.sendTemplate).toHaveBeenCalledTimes(1);
  });
});
