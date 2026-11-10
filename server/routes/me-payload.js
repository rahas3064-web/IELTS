// The /api/me payload, shared by GET /api/me and PUT /api/onboarding.

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

/** @param {{query: Function}} db @param {string} userId @returns {Promise<object|null>} */
export async function loadMe(db, userId) {
  const { rows } = await db.query(
    `select u.id, u.phone, u.first_name, u.last_name, u.email, u.role, u.locale, u.status,
            (u.password_hash is not null) as has_password,
            p.exam_type, p.target_band, to_char(p.exam_date, 'YYYY-MM-DD') as exam_date,
            p.exam_date_precision, p.daily_minutes, p.study_days, p.plan_path,
            p.reminder_sms_enabled, to_char(p.reminder_time, 'HH24:MI') as reminder_time,
            p.onboarding_completed_at, p.email_card_dismissed_at
     from users u left join learner_profiles p on p.user_id = u.id
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
  return {
    user: toPublicUser(row),
    profile,
    onboarding: { completed: Boolean(row.onboarding_completed_at), step: nextStep(row) },
    // Billing is wired in S11; until then everyone is on the free plan.
    subscription: { plan: "free", endsAt: null },
    emailCardDismissed: Boolean(row.email_card_dismissed_at),
  };
}
