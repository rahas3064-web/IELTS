// Panel frame summary (spec S2): everything the header and menu need in ONE query:
// unread count, streak, exam countdown and today's plan progress. Every sub-select
// is an index lookup (notifications (user_id, read_at), user_streaks pk, learner_profiles pk,
// study_plans (user_id, week_start) + plan_tasks (plan_id, day)).
import { tehranDay, tehranWeekStart } from "../core/tehran-time.js";
import { examCountdown } from "./exam-countdown.js";
import { deriveCachedStreak, optionsFromRow } from "./streak.js";

const FRAME_SQL = `
  select
    (select count(*)::int from notifications where user_id = $1 and read_at is null) as unread_count,
    s.current as streak_current,
    s.best as streak_best,
    to_char(s.last_active_day, 'YYYY-MM-DD') as streak_last_day,
    coalesce((select value = 'true'::jsonb from system_settings where key = 'streak_skip_rest_days'), false) as skip_rest_days,
    p.study_days,
    to_char(p.exam_date, 'YYYY-MM-DD') as exam_date,
    p.exam_date_precision,
    plan.total as plan_total,
    plan.done as plan_done
  from (select $1::uuid as id) q
  left join learner_profiles p on p.user_id = q.id
  left join user_streaks s on s.user_id = q.id
  cross join lateral (
    select count(*) filter (where t.status <> 'skipped')::int as total,
           count(*) filter (where t.status = 'done')::int as done
    from study_plans sp
    join plan_tasks t on t.plan_id = sp.id
    where sp.user_id = q.id and sp.status = 'active' and sp.week_start = $3::date and t.day = $2::date
  ) plan`;

/**
 * @param {{query: Function}} db
 * @param {string} userId
 * @param {Date} now
 */
export async function loadFrame(db, userId, now) {
  const today = tehranDay(now);
  const { rows } = await db.query(FRAME_SQL, [userId, today, tehranWeekStart(now)]);
  const row = rows[0];
  const cache = row.streak_current === null
    ? null
    : { current: row.streak_current, best: row.streak_best, lastActiveDay: row.streak_last_day };
  return {
    unreadCount: row.unread_count,
    streak: deriveCachedStreak(cache, today, optionsFromRow(row)),
    examCountdown: examCountdown({ examDate: row.exam_date, precision: row.exam_date_precision }, today),
    planToday: { total: row.plan_total, done: row.plan_done },
  };
}
