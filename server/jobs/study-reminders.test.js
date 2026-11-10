import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createMigratedDb } from "../../db/test-helpers.js";
import { createSmsSender } from "../auth/sms.js";
import { ApiError } from "../core/errors.js";
import {
  completedMockSection, completedPlacementSkill, completedPractice, newLearner,
} from "../test-support/activity-fixtures.js";
import { runStudyReminders } from "./study-reminders.js";

let db;
beforeAll(async () => {
  db = await createMigratedDb();
});
afterAll(() => db.close());
beforeEach(async () => {
  await db.query("delete from sms_messages");
  await db.query("delete from system_settings");
  await db.query("delete from users");
});

// Tehran is UTC+03:30 all year. 2026-11-10 is a Tuesday (weekday index 3, Saturday = 0).
const TUE = "2026-11-10";
const tehran = (day, hhmm, seconds = "00") => new Date(`${day}T${hhmm}:${seconds}+03:30`);
const silent = () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() });
const okSms = () => ({ sendTemplate: vi.fn(async () => ({ providerMessageId: "msg-1", mode: "live" })) });
const run = (at, sms = okSms(), logger = silent()) => runStudyReminders({ db, now: at, sms, logger }).then((stats) => ({ stats, sms, logger }));
const rows = async () =>
  (await db.query("select *, to_char(sent_on_tehran_day, 'YYYY-MM-DD') as day from sms_messages order by created_at, id")).rows;
const sentTo = (sms) => sms.sendTemplate.mock.calls.map(([phone]) => phone);

describe("who gets a reminder", () => {
  it("sends the template to a learner whose reminder time is in the current window", async () => {
    const user = await newLearner(db, { reminderTime: "19:00" });
    const { stats, sms } = await run(tehran(TUE, "19:00"));
    expect(sms.sendTemplate).toHaveBeenCalledTimes(1);
    expect(sms.sendTemplate).toHaveBeenCalledWith(user.phone, "study_reminder", {}, { log: false });
    expect(stats).toMatchObject({ sent: 1, failed: 0 });
    const [row] = await rows();
    expect(row).toMatchObject({
      user_id: user.id, purpose: "study_reminder", template_key: "study_reminder", status: "sent",
      provider_message_id: "msg-1", phone_masked: `${user.phone.slice(0, 4)}***${user.phone.slice(-4)}`,
    });
    expect(row.day).toBe(TUE);
  });

  it("uses the 15-minute window [t, t+15): 19:00 and 19:14 yes, 18:59 and 19:15 no", async () => {
    const times = { in0: "19:00", in14: "19:14", early: "18:59", next: "19:15" };
    const users = {};
    for (const [key, time] of Object.entries(times)) users[key] = await newLearner(db, { reminderTime: time });
    const { sms } = await run(tehran(TUE, "19:00"));
    expect(sentTo(sms).sort()).toEqual([users.in0.phone, users.in14.phone].sort());
  });

  it("an off-grid run time still maps to its window (19:07 -> [19:00, 19:15))", async () => {
    const user = await newLearner(db, { reminderTime: "19:10" });
    expect(sentTo((await run(tehran(TUE, "19:07", "30"))).sms)).toEqual([user.phone]);
  });

  it("the next window picks up the learners the previous one skipped", async () => {
    const user = await newLearner(db, { reminderTime: "19:15" });
    expect(sentTo((await run(tehran(TUE, "19:00"))).sms)).toEqual([]);
    expect(sentTo((await run(tehran(TUE, "19:15"))).sms)).toEqual([user.phone]);
  });

  it("only on the learner's study days", async () => {
    const off = await newLearner(db, { studyDays: [0, 1, 2, 4, 5, 6] }); // not Tuesday (3)
    const on = await newLearner(db, { studyDays: [3] });
    expect(sentTo((await run(tehran(TUE, "19:00"))).sms)).toEqual([on.phone]);
    expect(off.id).toBeDefined();
  });

  it("never for disabled reminders, unfinished onboarding, unverified phones or non-active accounts", async () => {
    await newLearner(db, { reminderEnabled: false });
    const noOnboarding = await newLearner(db);
    await db.query("update learner_profiles set onboarding_completed_at = null where user_id = $1", [noOnboarding.id]);
    const unverified = await newLearner(db);
    await db.query("update users set phone_verified_at = null where id = $1", [unverified.id]);
    const blocked = await newLearner(db);
    await db.query("update users set status = 'blocked' where id = $1", [blocked.id]);
    const deleting = await newLearner(db);
    await db.query("update users set status = 'pending_deletion', deletion_requested_at = now() where id = $1", [deleting.id]);
    expect(sentTo((await run(tehran(TUE, "19:00"))).sms)).toEqual([]);
    expect(await rows()).toEqual([]);
  });
});

describe("quiet hours (Tehran 22:00-08:00)", () => {
  it.each(["22:00", "22:15", "23:45", "00:00", "03:00", "07:45"])("never sends in the window starting %s", async (time) => {
    await newLearner(db, { reminderTime: time });
    const { sms, stats } = await run(tehran(TUE, time));
    expect(sms.sendTemplate).not.toHaveBeenCalled();
    expect(stats.sent).toBe(0);
  });

  it.each([
    ["08:00", "08:00"],
    ["08:14", "08:00"],
    ["21:45", "21:45"],
    ["21:59", "21:45"],
  ])("still sends at the edge of the allowed range (reminder %s, run %s)", async (reminderTime, runTime) => {
    const user = await newLearner(db, { reminderTime });
    expect(sentTo((await run(tehran(TUE, runTime))).sms)).toEqual([user.phone]);
  });

  it("a reminder time inside quiet hours is not sent even when the job runs at an allowed time", async () => {
    await newLearner(db, { reminderTime: "22:10" });
    await newLearner(db, { reminderTime: "07:50" });
    expect(sentTo((await run(tehran(TUE, "21:45"))).sms)).toEqual([]);
    expect(sentTo((await run(tehran(TUE, "08:00"))).sms)).toEqual([]);
  });

  it("the window comes from system_settings 'reminder_window' (default 08:00-22:00)", async () => {
    const early = await newLearner(db, { reminderTime: "07:00" });
    const late = await newLearner(db, { reminderTime: "21:00" });
    expect(sentTo((await run(tehran(TUE, "07:00"))).sms)).toEqual([]);
    await db.query(`insert into system_settings (key, value) values ('reminder_window', '{"start":"06:00","end":"21:00"}'::jsonb)`);
    expect(sentTo((await run(tehran(TUE, "07:00"))).sms)).toEqual([early.phone]);
    expect(sentTo((await run(tehran(TUE, "21:00"))).sms)).toEqual([]); // the end is exclusive
    expect(late.id).toBeDefined();
  });

  it("falls back to the default window when the setting is malformed", async () => {
    await newLearner(db, { reminderTime: "03:00" });
    await db.query(`insert into system_settings (key, value) values ('reminder_window', '"always"'::jsonb)`);
    expect(sentTo((await run(tehran(TUE, "03:00"))).sms)).toEqual([]);
  });
});

describe("already studied today (Tehran day)", () => {
  it.each([
    ["a practice", completedPractice],
    ["a placement skill", completedPlacementSkill],
    ["a mock section", completedMockSection],
  ])("skips a learner who finished %s today", async (_label, finish) => {
    const user = await newLearner(db);
    await finish(db, user.id, tehran(TUE, "07:00"));
    const { sms, stats } = await run(tehran(TUE, "19:00"));
    expect(sms.sendTemplate).not.toHaveBeenCalled();
    expect(stats.sent).toBe(0);
  });

  it("yesterday's study, other learners' study and unfinished attempts do not count", async () => {
    const user = await newLearner(db);
    const other = await newLearner(db, { reminderTime: "10:00" });
    await completedPractice(db, user.id, tehran("2026-11-09", "19:30"));
    await completedPractice(db, other.id, tehran(TUE, "07:00"));
    await db.query(
      "insert into practice_attempts (user_id, kind, skill, started_at) values ($1, 'mock_scoring', 'writing', $2)",
      [user.id, tehran(TUE, "06:00")],
    );
    expect(sentTo((await run(tehran(TUE, "19:00"))).sms)).toEqual([user.phone]);
  });

  it("splits the day at Tehran midnight, not at UTC midnight", async () => {
    await db.query(`insert into system_settings (key, value) values ('reminder_window', '{"start":"00:00","end":"24:00"}'::jsonb)`);
    const night = await newLearner(db, { reminderTime: "00:00", studyDays: [4] }); // Wednesday only
    const other = await newLearner(db, { reminderTime: "00:00", studyDays: [3] }); // Tuesday only
    // 20:29:30Z on Nov 10 is 23:59:00 Tehran Tuesday; 20:31Z is 00:01 Wednesday.
    await completedPractice(db, night.id, new Date("2026-11-10T20:29:30Z")); // yesterday for the Wednesday run
    const { sms } = await run(new Date("2026-11-10T20:31:00Z"));
    expect(sentTo(sms)).toEqual([night.phone]);
    expect(other.id).toBeDefined();
    const [row] = await rows();
    expect(row.day).toBe("2026-11-11");
  });

  it("study finished just after Tehran midnight counts for the new day", async () => {
    await db.query(`insert into system_settings (key, value) values ('reminder_window', '{"start":"00:00","end":"24:00"}'::jsonb)`);
    const user = await newLearner(db, { reminderTime: "00:00" });
    await completedPractice(db, user.id, new Date("2026-11-10T20:30:30Z")); // 00:00:30 Wednesday
    expect(sentTo((await run(new Date("2026-11-10T20:31:00Z"))).sms)).toEqual([]);
  });
});

describe("at most one reminder per Tehran day", () => {
  it("a second run in the same window sends nothing (idempotent)", async () => {
    await newLearner(db);
    const first = await run(tehran(TUE, "19:00"));
    const second = await run(tehran(TUE, "19:05"), okSms());
    expect(first.sms.sendTemplate).toHaveBeenCalledTimes(1);
    expect(second.sms.sendTemplate).not.toHaveBeenCalled();
    expect(await rows()).toHaveLength(1);
  });

  it("two concurrent runs send exactly once", async () => {
    await newLearner(db);
    const sms = okSms();
    const [a, b] = await Promise.all([run(tehran(TUE, "19:00"), sms), run(tehran(TUE, "19:00"), sms)]);
    expect(sms.sendTemplate).toHaveBeenCalledTimes(1);
    expect(a.stats.sent + b.stats.sent).toBe(1);
    expect(await rows()).toHaveLength(1);
  });

  it("changing the reminder time later the same day does not trigger a second one", async () => {
    const user = await newLearner(db, { reminderTime: "19:00" });
    await run(tehran(TUE, "19:00"));
    await db.query("update learner_profiles set reminder_time = '20:00' where user_id = $1", [user.id]);
    expect(sentTo((await run(tehran(TUE, "20:00"))).sms)).toEqual([]);
  });

  it("sends again on the next Tehran day", async () => {
    const user = await newLearner(db);
    await run(tehran(TUE, "19:00"));
    expect(sentTo((await run(tehran("2026-11-11", "19:00"))).sms)).toEqual([user.phone]);
    expect(await rows()).toHaveLength(2);
  });

  it("the database itself refuses a second row for the same day", async () => {
    const user = await newLearner(db);
    await run(tehran(TUE, "19:00"));
    await expect(
      db.query(
        `insert into sms_messages (user_id, phone_masked, template_key, purpose, sent_on_tehran_day)
         values ($1, 'x', 'study_reminder', 'study_reminder', $2::date)`,
        [user.id, TUE],
      ),
    ).rejects.toThrow(/sms_one_study_reminder_per_day/);
  });
});

describe("failures", () => {
  it("a failed send keeps the row as failed, does not retry the same day, and does not stop other learners", async () => {
    const bad = await newLearner(db, { reminderTime: "19:00" });
    const good = await newLearner(db, { reminderTime: "19:01" });
    const sms = {
      sendTemplate: vi.fn(async (phone) => {
        if (phone === bad.phone) throw new ApiError(502, "sms_failed");
        return { providerMessageId: "ok", mode: "live" };
      }),
    };
    const { stats } = await run(tehran(TUE, "19:00"), sms);
    expect(stats).toMatchObject({ sent: 1, failed: 1 });
    const byUser = Object.fromEntries((await rows()).map((r) => [r.user_id, r]));
    expect(byUser[bad.id]).toMatchObject({ status: "failed", error: "sms_failed", provider_message_id: null });
    expect(byUser[good.id].status).toBe("sent");
    const retry = await run(tehran(TUE, "19:05"), okSms());
    expect(retry.sms.sendTemplate).not.toHaveBeenCalled();
    expect(await rows()).toHaveLength(2);
  });

  it("an unexpected sender error is recorded without leaking its message", async () => {
    await newLearner(db);
    const sms = { sendTemplate: vi.fn(async () => { throw new Error("secret-token-xyz exploded"); }) };
    const { stats, logger } = await run(tehran(TUE, "19:00"), sms);
    expect(stats.failed).toBe(1);
    const [row] = await rows();
    expect(row).toMatchObject({ status: "failed", error: "unexpected" });
    expect(JSON.stringify([row, logger.info.mock.calls, logger.warn.mock.calls, logger.error.mock.calls])).not.toContain("secret-token-xyz");
  });

  it("never logs a full phone number", async () => {
    const user = await newLearner(db);
    const { logger } = await run(tehran(TUE, "19:00"));
    const everything = JSON.stringify([logger.info.mock.calls, logger.warn.mock.calls, logger.error.mock.calls]);
    expect(everything).not.toContain(user.phone);
  });
});

describe("integration with the real SMS adapter (dev console mode)", () => {
  it("records exactly one sent row and prints a masked line", async () => {
    const user = await newLearner(db);
    const logger = silent();
    const sms = createSmsSender({ env: { NODE_ENV: "development" }, db, logger });
    await runStudyReminders({ db, now: () => tehran(TUE, "19:00"), sms, logger });
    const all = await rows();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ status: "sent", provider_message_id: "dev-console", user_id: user.id });
    expect(logger.info).toHaveBeenCalledWith(`[dev-sms] ${user.phone.slice(0, 4)}***${user.phone.slice(-4)} template=study_reminder`);
  });
});
