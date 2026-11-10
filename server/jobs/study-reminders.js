/* global console */
// Study-reminder SMS job (spec S2, 4.2). Runs every 15 minutes (Tehran) and texts the
// learners whose reminder time falls in the current 15-minute window [t, t+15).
//
// Hard rules, all enforced here or by the database:
//  - only inside the reminder window, default 08:00-22:00 Tehran (system_settings 'reminder_window'),
//  - only on the learner's study days (0 = Saturday), only for active, onboarded, phone-verified learners
//    with reminders on, and only if nothing was finished today (practice, placement skill, mock section),
//  - at most ONE per learner per Tehran day: the unique index on sms_messages
//    (user_id, purpose, sent_on_tehran_day) is the guarantee, and the row is claimed BEFORE sending.
//
// Rulings: (1) a failed send keeps its row as 'failed' and is NOT retried the same day (the claim is
// the day's single attempt; the next window would not match the learner's time anyway). (2) A crash
// between claiming and sending leaves a 'queued' row: at-most-once, never twice. (3) A missed run is
// not made up later (no catch-up). (4) The template carries no parameters; the text lives in SMS.ir.
import { maskPhone } from "../core/phone.js";
import { ApiError } from "../core/errors.js";
import { addDays, tehranNow, weekdayIndex } from "../core/tehran-time.js";
import { resolveNow } from "./util.js";

const WINDOW_MINUTES = 15;
const MINUTES_PER_DAY = 24 * 60;
const DEFAULT_WINDOW = Object.freeze({ start: "08:00", end: "22:00" });
const HHMM_RE = /^(?:([01]\d|2[0-3]):([0-5]\d)|(24):(00))$/;
const TEHRAN_OFFSET = "+03:30"; // fixed: Iran has no DST (see core/tehran-time.js)

const EMPTY_STATS = Object.freeze({ window: null, candidates: 0, sent: 0, failed: 0, skipped: 0 });

/** @param {string} hhmm 'HH:MM' (24:00 allowed as an end) @returns {number|null} minutes since midnight */
function toMinutes(hhmm) {
  const match = typeof hhmm === "string" ? HHMM_RE.exec(hhmm) : null;
  if (!match) return null;
  return match[3] ? MINUTES_PER_DAY : Number(match[1]) * 60 + Number(match[2]);
}

const toHhmm = (minutes) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

/** @returns {Promise<{startMin: number, endMin: number}>} the configured window, or the default if absent/malformed */
async function readWindow(db) {
  const { rows } = await db.query("select value from system_settings where key = 'reminder_window'");
  const raw = rows[0]?.value;
  const startMin = toMinutes(raw?.start);
  const endMin = toMinutes(raw?.end);
  if (startMin !== null && endMin !== null && startMin < endMin) return { startMin, endMin };
  return { startMin: toMinutes(DEFAULT_WINDOW.start), endMin: toMinutes(DEFAULT_WINDOW.end) };
}

const dayStart = (day) => new Date(`${day}T00:00:00${TEHRAN_OFFSET}`);

const CANDIDATES_SQL = `
  select u.id, u.phone
  from learner_profiles p
  join users u on u.id = p.user_id
  where p.reminder_sms_enabled
    and u.status = 'active'
    and u.phone_verified_at is not null
    and p.onboarding_completed_at is not null
    and $1::smallint = any(p.study_days)
    and p.reminder_time >= $2::time and p.reminder_time < $3::time
    and not exists (select 1 from practice_attempts a
                    where a.user_id = u.id and a.completed_at >= $4::timestamptz and a.completed_at < $5::timestamptz)
    and not exists (select 1 from placement_attempts pa
                    join placement_skill_attempts ps on ps.attempt_id = pa.id
                    where pa.user_id = u.id and ps.status = 'completed'
                      and ps.completed_at >= $4::timestamptz and ps.completed_at < $5::timestamptz)
    and not exists (select 1 from mock_attempts ma
                    join mock_section_attempts ms on ms.mock_attempt_id = ma.id
                    where ma.user_id = u.id and ms.status = 'completed'
                      and ms.completed_at >= $4::timestamptz and ms.completed_at < $5::timestamptz)
    and not exists (select 1 from sms_messages m
                    where m.user_id = u.id and m.purpose = 'study_reminder' and m.sent_on_tehran_day = $6::date)
  order by p.reminder_time, u.id`;

/** Claim today's slot; false when another run (or an earlier send) already holds it. */
async function claim(db, candidate, day) {
  const { rows } = await db.query(
    `insert into sms_messages (user_id, phone_masked, template_key, status, purpose, sent_on_tehran_day)
     values ($1, $2, 'study_reminder', 'queued', 'study_reminder', $3::date)
     on conflict do nothing
     returning id`,
    [candidate.id, maskPhone(candidate.phone), day],
  );
  return rows[0]?.id ?? null;
}

/**
 * @param {{
 *   db: {query: Function},
 *   now?: Date|(() => Date),
 *   sms: {sendTemplate: (phone: string, key: string, params: object, options?: object) => Promise<{providerMessageId: string|null}>},
 *   logger?: {info: Function, warn: Function, error: Function},
 * }} deps
 * @returns {Promise<{window: string|null, candidates: number, sent: number, failed: number, skipped: number, outsideWindow?: true}>}
 */
export async function runStudyReminders({ db, now = () => new Date(), sms, logger = console }) {
  const at = resolveNow(now);
  const { day, hour, minute } = tehranNow(at);
  const minuteOfDay = hour * 60 + minute;
  const windowStart = minuteOfDay - (minuteOfDay % WINDOW_MINUTES);
  const { startMin, endMin } = await readWindow(db);

  // Never outside the allowed hours: neither the clock nor the window being served may leave them.
  if (minuteOfDay < startMin || minuteOfDay >= endMin || windowStart < startMin || windowStart >= endMin) {
    return { ...EMPTY_STATS, outsideWindow: true };
  }

  const lower = Math.max(windowStart, startMin);
  const upper = Math.min(windowStart + WINDOW_MINUTES, endMin);
  const { rows: candidates } = await db.query(CANDIDATES_SQL, [
    weekdayIndex(day), toHhmm(lower), toHhmm(upper), dayStart(day), dayStart(addDays(day, 1)), day,
  ]);

  const stats = { window: toHhmm(windowStart), candidates: candidates.length, sent: 0, failed: 0, skipped: 0 };
  for (const candidate of candidates) {
    const claimId = await claim(db, candidate, day);
    if (claimId === null) {
      stats.skipped += 1;
      continue;
    }
    try {
      const result = await sms.sendTemplate(candidate.phone, "study_reminder", {}, { log: false });
      await db.query("update sms_messages set status = 'sent', provider_message_id = $2 where id = $1", [
        claimId, result?.providerMessageId ?? null,
      ]);
      stats.sent += 1;
    } catch (error) {
      const reason = error instanceof ApiError ? error.code : "unexpected";
      await db.query("update sms_messages set status = 'failed', error = $2 where id = $1", [claimId, reason]);
      logger.warn(`[study-reminders] send failed for ${maskPhone(candidate.phone)}: ${reason}`);
      stats.failed += 1;
    }
  }
  logger.info(
    `[study-reminders] window ${stats.window}: ${stats.candidates} due, ${stats.sent} sent, ${stats.failed} failed, ${stats.skipped} skipped`,
  );
  return stats;
}
