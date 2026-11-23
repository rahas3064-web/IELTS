// Panel frame summary (spec S2): everything the header and menu need in ONE query:
// unread count, streak, exam countdown and today's plan progress. Every sub-select
// is an index lookup (notifications (user_id, read_at), user_streaks pk, learner_profiles pk,
// study_plans (user_id, week_start) + plan_tasks (plan_id, day)).
import { tehranDay, tehranWeekStart } from "../core/tehran-time.js";
import { examCountdown } from "./exam-countdown.js";
import { buildPath, groupNodes } from "./path.js";
import { dailyGoal, deriveCachedStreak, optionsFromRow } from "./streak.js";

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
    plan.done as plan_done,
    exists (
      select 1 from placement_attempts a where a.user_id = q.id and a.status = 'completed'
    ) as placement_done,
    (
      select sp.inputs from study_plans sp
      where sp.user_id = q.id and sp.status = 'active'
      order by sp.week_start desc limit 1
    ) as plan_inputs,
    (
      select coalesce(json_agg(json_build_object(
        'chapter_key', c.key, 'title_fa', c.title_fa, 'band_from', c.band_from, 'band_to', c.band_to,
        'id', n.id, 'kind', n.kind, 'node_title_fa', n.title_fa, 'premium', n.premium, 'demo_state', n.demo_state
      ) order by c.sort, n.sort), '[]'::json)
      from path_chapters c join path_nodes n on n.chapter_key = c.key
    ) as catalogue,
    (
      select coalesce(json_object_agg(pr.node_id, pr.state), '{}'::json)
      from path_node_progress pr where pr.user_id = q.id
    ) as progress,
    (
      select count(*)::int from lesson_runs lr
      where lr.user_id = q.id and lr.completed_at is not null
        and (lr.completed_at at time zone 'Asia/Tehran')::date = $2::date
    ) as goal_done
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
    dailyGoal: dailyGoal(row.goal_done),
    path: pathFrom(row),
  };
}

function pathFrom(row) {
  const inputs = row.plan_inputs ?? null;
  const chapterFrom = inputs?.chapterFrom ?? null;
  const progress = row.progress ?? {};
  return buildPath({
    placementCompleted: Boolean(row.placement_done),
    plan: chapterFrom == null ? null : { chapterFrom: Number(chapterFrom), chapterTo: Number(inputs.chapterTo) },
    chapters: groupNodes(row.catalogue ?? []),
    progress,
  });
}
