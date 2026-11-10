// Streak service (spec S2). A Tehran calendar day counts when the learner finished
// at least one practice attempt, placement skill or mock section that day. The
// streak is the run of counted days ending today (or yesterday while today is still
// empty). `user_streaks` is only a cache: it is always recomputable from the attempts.
//
// Rest-day exemption (system_settings 'streak_skip_rest_days', default false): days
// whose weekday (0 = Saturday) is not one of the learner's study days neither count
// nor break the run. Rulings: activity done on such a rest day is not counted either
// (the days are transparent, as specified), and `activeToday` means "today is a
// counted day", so it is false on a rest day.
import { addDays, tehranDay, weekdayIndex } from "../core/tehran-time.js";

/** @typedef {{skipRestDays?: boolean, studyDays?: ReadonlyArray<number>}} StreakOptions */
/** @typedef {{current: number, best: number, activeToday: boolean}} Streak */

const ZERO = Object.freeze({ current: 0, best: 0, activeToday: false });

/** @param {string} day @param {StreakOptions} opts */
const isRestDay = (day, { skipRestDays = false, studyDays = [] }) =>
  skipRestDays && !studyDays.includes(weekdayIndex(day));

/**
 * True when every day strictly between `earlier` and `later` is an exempt rest day
 * (so the two counted days belong to the same run).
 */
function connects(earlier, later, opts) {
  for (let d = addDays(earlier, 1); d < later; d = addDays(d, 1)) {
    if (!isRestDay(d, opts)) return false;
  }
  return true;
}

/**
 * Distinct, sorted, valid days that count toward the streak (not after today, not exempt).
 * @param {ReadonlyArray<string>} days @param {string} today @param {StreakOptions} opts
 * @returns {string[]}
 */
export function countedDays(days, today, opts) {
  addDays(today, 0); // validates the calendar day (TypeError otherwise)
  const valid = days.map((day) => {
    addDays(day, 0);
    return day;
  });
  return [...new Set(valid)].filter((day) => day <= today && !isRestDay(day, opts)).sort();
}

function longestRun(counted, opts) {
  let best = 0;
  let run = 0;
  counted.forEach((day, index) => {
    run = index > 0 && connects(counted[index - 1], day, opts) ? run + 1 : 1;
    best = Math.max(best, run);
  });
  return best;
}

function currentRun(counted, today, opts) {
  if (counted.length === 0) return 0;
  const counts = new Set(counted);
  const earliest = counted[0];
  let run = 0;
  for (let cursor = today; cursor >= earliest; cursor = addDays(cursor, -1)) {
    if (isRestDay(cursor, opts)) continue;
    if (counts.has(cursor)) run += 1;
    else if (cursor !== today) break; // today may still be empty; any other gap ends the run
  }
  return run;
}

/**
 * Pure streak computation.
 * @param {ReadonlyArray<string>} days distinct Tehran days 'YYYY-MM-DD' with activity
 * @param {string} today Tehran day 'YYYY-MM-DD'
 * @param {StreakOptions} [options]
 * @returns {Streak}
 */
export function computeStreak(days, today, { skipRestDays = false, studyDays = [] } = {}) {
  const opts = { skipRestDays, studyDays };
  const counted = countedDays(days, today, opts);
  return {
    current: currentRun(counted, today, opts),
    best: longestRun(counted, opts),
    activeToday: counted.includes(today),
  };
}

/**
 * Turn a cached user_streaks row into what should be shown today: a cache last
 * touched before yesterday (a missed day) no longer counts as a running streak.
 * @param {{current: number, best: number, lastActiveDay: string|null}|null} cache
 * @param {string} today
 * @param {StreakOptions} [options]
 * @returns {Streak}
 */
export function deriveCachedStreak(cache, today, { skipRestDays = false, studyDays = [] } = {}) {
  if (!cache) return { ...ZERO };
  const { current, best, lastActiveDay } = cache;
  if (lastActiveDay === null || lastActiveDay === undefined) return { current: 0, best, activeToday: false };
  if (lastActiveDay >= today) return { current, best, activeToday: true };
  const alive = connects(lastActiveDay, today, { skipRestDays, studyDays });
  return { current: alive ? current : 0, best, activeToday: false };
}

// ------------------------------------------------------------------ database

const SETTINGS_COLUMNS = `
  coalesce((select value = 'true'::jsonb from system_settings where key = 'streak_skip_rest_days'), false) as skip_rest_days,
  (select study_days from learner_profiles where user_id = $1) as study_days`;

/** Every Tehran day with finished activity (practice, placement skill, mock section). */
const ACTIVITY_DAYS_SQL = `
  select to_char(d, 'YYYY-MM-DD') as day from (
    select (completed_at at time zone 'Asia/Tehran')::date as d
      from practice_attempts where user_id = $1 and completed_at is not null
    union
    select (s.completed_at at time zone 'Asia/Tehran')::date
      from placement_skill_attempts s join placement_attempts a on a.id = s.attempt_id
      where a.user_id = $1 and s.status = 'completed'
    union
    select (s.completed_at at time zone 'Asia/Tehran')::date
      from mock_section_attempts s join mock_attempts a on a.id = s.mock_attempt_id
      where a.user_id = $1 and s.status = 'completed'
  ) days order by 1`;

/** @param {{skip_rest_days?: boolean, study_days?: unknown[]|null}} row @returns {StreakOptions} */
export const optionsFromRow = (row) => ({
  skipRestDays: row.skip_rest_days === true,
  studyDays: (row.study_days ?? []).map(Number),
});

/**
 * Recompute and upsert the streak cache for a learner. Call it INSIDE the transaction
 * that completes a practice attempt / placement skill / mock section, so the cache
 * commits or rolls back together with the completion. Idempotent; the recorded day
 * itself always counts, even when the caller has not stamped the attempt yet.
 * @param {{query: Function}} tx a transaction (or any queryable)
 * @param {string} userId
 * @param {Date|string|number} completedAt
 * @returns {Promise<Streak & {lastActiveDay: string|null}>}
 */
export async function recordActivity(tx, userId, completedAt) {
  const recordedDay = tehranDay(completedAt);
  const { rows: dayRows } = await tx.query(ACTIVITY_DAYS_SQL, [userId]);
  const { rows: settingRows } = await tx.query(`select ${SETTINGS_COLUMNS}`, [userId]);
  const opts = optionsFromRow(settingRows[0] ?? {});

  const days = [...dayRows.map((row) => row.day), recordedDay];
  const today = days.reduce((latest, day) => (day > latest ? day : latest), recordedDay);
  const counted = countedDays(days, today, opts);
  const streak = computeStreak(days, today, opts);
  const lastActiveDay = counted.at(-1) ?? null;

  const { rows } = await tx.query(
    `insert into user_streaks (user_id, current, best, last_active_day)
     values ($1, $2, $3, $4::date)
     on conflict (user_id) do update
       set current = excluded.current,
           best = greatest(user_streaks.best, excluded.best),
           last_active_day = excluded.last_active_day
     returning current, best`,
    [userId, streak.current, streak.best, lastActiveDay],
  );
  return { current: rows[0].current, best: rows[0].best, activeToday: streak.activeToday, lastActiveDay };
}

/**
 * The streak to display now: the cached row, re-derived against today's Tehran day.
 * @param {{query: Function}} db
 * @param {string} userId
 * @param {Date} now
 * @returns {Promise<Streak>}
 */
export async function getStreak(db, userId, now) {
  const { rows } = await db.query(
    `select s.current, s.best, to_char(s.last_active_day, 'YYYY-MM-DD') as last_active_day, ${SETTINGS_COLUMNS}
     from (select $1::uuid as id) q left join user_streaks s on s.user_id = q.id`,
    [userId],
  );
  const row = rows[0];
  const cache = row.current === null
    ? null
    : { current: row.current, best: row.best, lastActiveDay: row.last_active_day };
  return deriveCachedStreak(cache, tehranDay(now), optionsFromRow(row));
}
