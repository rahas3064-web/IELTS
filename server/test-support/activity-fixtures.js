// Test fixtures for learner activity (completed practice / placement / mock sections)
// and learner profiles. Used by the streak, frame and study-reminder tests. Not a test file.
import { insert, newMock, newPlacementVersion, newUser } from "../../db/test-helpers.js";

let versionSeq = 1000;

/** A verified, active learner with a completed profile. */
export async function newLearner(db, { studyDays = [0, 1, 2, 3, 4, 5, 6], reminderTime = "19:00", reminderEnabled = true, ...user } = {}) {
  const row = await newUser(db, { phone_verified_at: new Date("2026-01-01T00:00:00Z"), ...user });
  await insert(db, "learner_profiles", {
    user_id: row.id,
    exam_type: "academic",
    exam_date_precision: "unknown",
    daily_minutes: 30,
    study_days: `{${studyDays.join(",")}}`,
    reminder_time: reminderTime,
    reminder_sms_enabled: reminderEnabled,
    onboarding_completed_at: new Date("2026-01-02T00:00:00Z"),
  });
  return row;
}

/** A finished practice attempt (a mock-scoring attempt needs no practice set). */
export const completedPractice = (db, userId, at) =>
  insert(db, "practice_attempts", {
    user_id: userId, kind: "mock_scoring", skill: "writing", status: "scored", started_at: at, completed_at: at,
  });

export async function completedPlacementSkill(db, userId, at) {
  const version = await newPlacementVersion(db, { version_no: (versionSeq += 1) });
  const attempt = await insert(db, "placement_attempts", {
    user_id: userId, version_id: version.id, status: "completed", started_at: at, completed_at: at,
  });
  return insert(db, "placement_skill_attempts", {
    attempt_id: attempt.id, skill: "reading", status: "completed", started_at: at, deadline_at: at, completed_at: at,
  });
}

export async function completedMockSection(db, userId, at) {
  const mock = await newMock(db);
  const attempt = await insert(db, "mock_attempts", { user_id: userId, mock_id: mock.id, mode: "full", started_at: at });
  return insert(db, "mock_section_attempts", {
    mock_attempt_id: attempt.id, skill: "listening", status: "completed", started_at: at, deadline_at: at, completed_at: at,
  });
}
