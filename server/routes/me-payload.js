// The /api/me payload, shared by GET /api/me and PUT /api/onboarding.
import { resolveSubscription } from "../services/billing.js";

/** Public view of a users row (full phone: this is the owner's own data). */
export function toPublicUser(row) {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    email: row.email ?? null,
    hasPassword: Boolean(row.has_password),
    role: row.role,
    locale: row.locale,
    status: row.status,
  };
}

/**
 * Where the onboarding wizard should resume. Step 2 may legitimately be "unknown"
 * (null band), which has no column of its own, so an empty step 2 resumes at 2.
 */
function nextStep(row) {
  if (row.onboarding_completed_at) return null;
  if (!row.exam_type) return 1;
  if (row.target_band === null && row.exam_date_precision === null) return 2;
  return 3;
}

/** @param {{query: Function}} db @param {string} userId @param {Date} [now] @returns {Promise<object|null>} */
export async function loadMe(db, userId, now = new Date()) {
  const { rows } = await db.query(
    `select u.id, u.phone, u.first_name, u.last_name, u.email, u.role, u.locale, u.status,
            (u.password_hash is not null) as has_password,
            p.exam_type, p.target_band, to_char(p.exam_date, 'YYYY-MM-DD') as exam_date,
            p.exam_date_precision, p.daily_minutes, p.study_days, p.plan_path,
            p.reminder_sms_enabled, to_char(p.reminder_time, 'HH24:MI') as reminder_time,
            p.onboarding_completed_at, p.email_card_dismissed_at,
            sub.plan_key as sub_plan_key, sub.status as sub_status, sub.ends_at as sub_ends_at,
            sub.grace_ends_at as sub_grace_ends_at, sub.tier as sub_tier
     from users u left join learner_profiles p on p.user_id = u.id
     -- The live subscription rides on the same round trip (one query per /api/me).
     left join lateral (
       select s.plan_key, s.status, s.ends_at, s.grace_ends_at, pl.tier
       from subscriptions s join plans pl on pl.key = s.plan_key
       where s.user_id = u.id and s.status in ('active', 'grace')
       order by s.started_at desc
       limit 1
     ) sub on true
     where u.id = $1`,
    [userId],
  );
  const row = rows[0];
  if (!row) return null;
  const profile = row.exam_type
    ? {
        examType: row.exam_type,
        targetBand: row.target_band === null ? null : Number(row.target_band),
        examDate: row.exam_date ?? null,
        examDatePrecision: row.exam_date_precision ?? null,
        dailyMinutes: row.daily_minutes ?? null,
        studyDays: (row.study_days ?? []).map(Number),
        planPath: row.plan_path,
        reminderSmsEnabled: row.reminder_sms_enabled,
        reminderTime: row.reminder_time,
      }
    : null;
  const live = resolveSubscription(
    {
      plan_key: row.sub_plan_key, status: row.sub_status, ends_at: row.sub_ends_at, grace_ends_at: row.sub_grace_ends_at, tier: row.sub_tier,
    },
    now,
  );
  return {
    user: toPublicUser(row),
    profile,
    onboarding: { completed: Boolean(row.onboarding_completed_at), step: nextStep(row) },
    // From the live subscriptions row (active, or inside the grace window); free + null otherwise.
    subscription: { plan: live.plan, endsAt: live.endsAt },
    emailCardDismissed: Boolean(row.email_card_dismissed_at),
  };
}
