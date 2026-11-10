import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createMigratedDb, insert } from "../../db/test-helpers.js";
import {
  completedMockSection, completedPlacementSkill, completedPractice, newLearner,
} from "../test-support/activity-fixtures.js";
import { getStreak, recordActivity } from "./streak.js";

let db;
beforeAll(async () => {
  db = await createMigratedDb();
});
afterAll(() => db.close());

const at = (iso) => new Date(iso);
// 2026-11-10 is a Tuesday. Tehran is UTC+03:30 all year, so 20:30Z is local midnight.
const TUE_NOON = "2026-11-10T09:00:00Z";
const cacheRow = async (userId) =>
  (await db.query("select current, best, to_char(last_active_day, 'YYYY-MM-DD') as day from user_streaks where user_id = $1", [userId])).rows[0];
const setSkipRestDays = (value) =>
  db.query(
    `insert into system_settings (key, value) values ('streak_skip_rest_days', $1::jsonb)
     on conflict (key) do update set value = excluded.value`,
    [JSON.stringify(value)],
  );

describe("recordActivity", () => {
  it("writes the cache from the finished practice of today", async () => {
    const user = await newLearner(db);
    await completedPractice(db, user.id, at(TUE_NOON));
    const result = await recordActivity(db, user.id, at(TUE_NOON));
    expect(result).toEqual({ current: 1, best: 1, activeToday: true, lastActiveDay: "2026-11-10" });
    expect(await cacheRow(user.id)).toEqual({ current: 1, best: 1, day: "2026-11-10" });
  });

  it("is idempotent: calling twice leaves one identical row", async () => {
    const user = await newLearner(db);
    await completedPractice(db, user.id, at(TUE_NOON));
    await recordActivity(db, user.id, at(TUE_NOON));
    await recordActivity(db, user.id, at(TUE_NOON));
    const rows = await db.query("select * from user_streaks where user_id = $1", [user.id]);
    expect(rows.rows).toHaveLength(1);
    expect(await cacheRow(user.id)).toEqual({ current: 1, best: 1, day: "2026-11-10" });
  });

  it("splits days at Tehran midnight (20:29Z is still the old day, 20:31Z the new one)", async () => {
    const user = await newLearner(db);
    await completedPractice(db, user.id, at("2026-11-10T20:29:00Z")); // 23:59 Tehran, Nov 10
    expect((await recordActivity(db, user.id, at("2026-11-10T20:29:00Z"))).current).toBe(1);
    await completedPractice(db, user.id, at("2026-11-10T20:31:00Z")); // 00:01 Tehran, Nov 11
    expect(await recordActivity(db, user.id, at("2026-11-10T20:31:00Z"))).toMatchObject({
      current: 2, best: 2, activeToday: true, lastActiveDay: "2026-11-11",
    });
  });

  it("two attempts on the same Tehran day are one day, even across the UTC date change", async () => {
    const user = await newLearner(db);
    await completedPractice(db, user.id, at("2026-11-10T20:00:00Z")); // 23:30 Tehran, Nov 10
    await completedPractice(db, user.id, at("2026-11-10T20:20:00Z")); // 23:50 Tehran, Nov 10
    expect(await recordActivity(db, user.id, at("2026-11-10T20:20:00Z"))).toMatchObject({ current: 1, best: 1 });
  });

  it("keeps the run going from Friday into Saturday", async () => {
    const user = await newLearner(db);
    await completedPractice(db, user.id, at("2026-11-13T10:00:00Z")); // Friday
    await completedPractice(db, user.id, at("2026-11-14T10:00:00Z")); // Saturday
    expect(await recordActivity(db, user.id, at("2026-11-14T10:00:00Z"))).toMatchObject({ current: 2, best: 2 });
  });

  it("a gap resets current but best survives", async () => {
    const user = await newLearner(db);
    for (const d of ["02", "03", "04", "08"]) await completedPractice(db, user.id, at(`2026-11-${d}T10:00:00Z`));
    expect(await recordActivity(db, user.id, at("2026-11-08T10:00:00Z"))).toMatchObject({ current: 1, best: 3 });
  });

  it("counts finished placement skills and mock sections as activity", async () => {
    const user = await newLearner(db);
    await completedPlacementSkill(db, user.id, at("2026-11-08T10:00:00Z"));
    await completedMockSection(db, user.id, at("2026-11-09T10:00:00Z"));
    await completedPractice(db, user.id, at("2026-11-10T10:00:00Z"));
    expect(await recordActivity(db, user.id, at("2026-11-10T10:00:00Z"))).toMatchObject({ current: 3, best: 3 });
  });

  it("ignores unfinished attempts and other users' activity", async () => {
    const user = await newLearner(db);
    const other = await newLearner(db);
    await insert(db, "practice_attempts", { user_id: user.id, kind: "mock_scoring", skill: "writing", started_at: at(TUE_NOON) });
    await completedPractice(db, other.id, at(TUE_NOON));
    expect(await recordActivity(db, user.id, at(TUE_NOON))).toMatchObject({ current: 1, best: 1 });
    // Only the day being recorded counts for `user`; `other`'s streak is untouched.
    expect(await cacheRow(other.id)).toBeUndefined();
  });

  it("never lowers a best that was reached before (cache is monotonic)", async () => {
    const user = await newLearner(db);
    await insert(db, "user_streaks", { user_id: user.id, current: 10, best: 10, last_active_day: "2026-10-01" });
    await completedPractice(db, user.id, at(TUE_NOON));
    expect(await recordActivity(db, user.id, at(TUE_NOON))).toMatchObject({ current: 1, best: 10 });
  });

  describe("rest-day exemption (system_settings.streak_skip_rest_days)", () => {
    // Study days Saturday(0), Monday(2), Wednesday(4). Nov 7 = Sat, Nov 9 = Mon, Nov 11 = Wed.
    const record = async (flag) => {
      await setSkipRestDays(flag);
      const user = await newLearner(db, { studyDays: [0, 2, 4] });
      await completedPractice(db, user.id, at("2026-11-07T10:00:00Z"));
      await completedPractice(db, user.id, at("2026-11-09T10:00:00Z"));
      await completedPractice(db, user.id, at("2026-11-11T10:00:00Z"));
      return recordActivity(db, user.id, at("2026-11-11T10:00:00Z"));
    };

    it("off (default): rest days break the run", async () => {
      expect(await record(false)).toMatchObject({ current: 1, best: 1 });
    });

    it("on: rest days neither count nor break it", async () => {
      expect(await record(true)).toMatchObject({ current: 3, best: 3 });
      await setSkipRestDays(false);
    });

    it("defaults to off when the setting row is missing", async () => {
      await db.query("delete from system_settings where key = 'streak_skip_rest_days'");
      const user = await newLearner(db, { studyDays: [0, 2, 4] });
      await completedPractice(db, user.id, at("2026-11-07T10:00:00Z"));
      await completedPractice(db, user.id, at("2026-11-09T10:00:00Z"));
      expect(await recordActivity(db, user.id, at("2026-11-09T10:00:00Z"))).toMatchObject({ current: 1 });
    });
  });
});

describe("recordActivity inside a caller transaction", () => {
  it("sees the attempt completed in the same transaction and rolls back with it", async () => {
    const user = await newLearner(db);
    await expect(
      db.transaction(async (tx) => {
        await completedPractice(tx, user.id, at(TUE_NOON));
        const inside = await recordActivity(tx, user.id, at(TUE_NOON));
        expect(inside).toMatchObject({ current: 1, activeToday: true });
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(await cacheRow(user.id)).toBeUndefined();
    const attempts = await db.query("select count(*)::int as n from practice_attempts where user_id = $1", [user.id]);
    expect(attempts.rows[0].n).toBe(0);
  });

  it("commits together with the caller's transaction", async () => {
    const user = await newLearner(db);
    await db.transaction(async (tx) => {
      await completedPractice(tx, user.id, at(TUE_NOON));
      await recordActivity(tx, user.id, at(TUE_NOON));
    });
    expect(await cacheRow(user.id)).toEqual({ current: 1, best: 1, day: "2026-11-10" });
  });
});

describe("getStreak", () => {
  const seed = (userId, day, current = 4, best = 6) =>
    insert(db, "user_streaks", { user_id: userId, current, best, last_active_day: day });

  it("returns zeros for a learner without a cache row", async () => {
    const user = await newLearner(db);
    expect(await getStreak(db, user.id, at(TUE_NOON))).toEqual({ current: 0, best: 0, activeToday: false });
  });

  it("reads the cache: active today / alive since yesterday", async () => {
    const today = await newLearner(db);
    await seed(today.id, "2026-11-10");
    expect(await getStreak(db, today.id, at(TUE_NOON))).toEqual({ current: 4, best: 6, activeToday: true });
    const yesterday = await newLearner(db);
    await seed(yesterday.id, "2026-11-09");
    expect(await getStreak(db, yesterday.id, at(TUE_NOON))).toEqual({ current: 4, best: 6, activeToday: false });
  });

  it("a stale cache from before yesterday shows 0, not a phantom streak", async () => {
    const user = await newLearner(db);
    await seed(user.id, "2026-11-08");
    expect(await getStreak(db, user.id, at(TUE_NOON))).toEqual({ current: 0, best: 6, activeToday: false });
  });

  it("uses the Tehran day: 20:31Z of Nov 9 is already Nov 10 locally", async () => {
    const user = await newLearner(db);
    await seed(user.id, "2026-11-08");
    expect((await getStreak(db, user.id, at("2026-11-09T20:29:00Z"))).current).toBe(4); // still Nov 9: yesterday = Nov 8
    expect((await getStreak(db, user.id, at("2026-11-09T20:31:00Z"))).current).toBe(0); // Nov 10: Nov 9 was missed
  });
});
