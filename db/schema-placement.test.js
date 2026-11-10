import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  count, createMigratedDb, expectViolation, insert, newItem, newPlacementVersion, newUser, publishedItem, unique,
} from "./test-helpers.js";

let db;
beforeAll(async () => { db = await createMigratedDb(); });
afterAll(async () => { await db.close(); });

const REVIEWED = new Date("2026-01-01T00:00:00Z");
const version = () => newPlacementVersion(db, { status: "published", reviewed_at: REVIEWED });
const attempt = async (fields = {}) => {
  const userId = fields.user_id ?? (await newUser(db)).id;
  const versionId = fields.version_id ?? (await version()).id;
  return insert(db, "placement_attempts", { user_id: userId, version_id: versionId, ...fields });
};
const skillAttempt = async (fields = {}) => {
  const attemptId = fields.attempt_id ?? (await attempt()).id;
  return insert(db, "placement_skill_attempts", { attempt_id: attemptId, skill: "listening", ...fields });
};

describe("placement_versions", () => {
  it("is unique per exam type and version number; academic or general only", async () => {
    await newPlacementVersion(db, { exam_type: "general", version_no: 1 });
    await expectViolation(newPlacementVersion(db, { exam_type: "general", version_no: 1 }), /placement_versions_exam_type_version_no_key/);
    await newPlacementVersion(db, { exam_type: "academic", version_no: 1 });
    await expectViolation(newPlacementVersion(db, { exam_type: "both" }), /placement_versions_exam_type_valid/);
    await expectViolation(newPlacementVersion(db, { version_no: 0 }), /placement_versions_version_no_valid/);
  });

  it("follows the review lifecycle: rejection needs a reason, publishing needs a review time", async () => {
    await expectViolation(newPlacementVersion(db, { status: "live" }), /placement_versions_status_valid/);
    await expectViolation(newPlacementVersion(db, { status: "rejected" }), /placement_versions_rejected_needs_reason/);
    await expectViolation(newPlacementVersion(db, { status: "published" }), /placement_versions_published_needs_review/);
    expect((await newPlacementVersion(db, { status: "rejected", rejection_reason: "too long" })).status).toBe("rejected");
    expect((await newPlacementVersion(db)).is_dev_fixture).toBe(false);
  });
});

describe("placement sections and items", () => {
  it("has one section per skill per version, with positive time limits", async () => {
    const v = await newPlacementVersion(db);
    await insert(db, "placement_sections", { version_id: v.id, skill: "reading", time_limit_sec: 780 });
    await expectViolation(insert(db, "placement_sections", { version_id: v.id, skill: "reading", time_limit_sec: 600 }), /placement_sections_version_skill_key/);
    await expectViolation(insert(db, "placement_sections", { version_id: v.id, skill: "grammar", time_limit_sec: 600 }), /placement_sections_skill_valid/);
    await expectViolation(insert(db, "placement_sections", { version_id: v.id, skill: "writing", time_limit_sec: 0 }), /placement_sections_time_limit_valid/);
  });

  it("lists an item once per section, cascades with the section, restricts deleting a used item", async () => {
    const v = await newPlacementVersion(db);
    const section = await insert(db, "placement_sections", { version_id: v.id, skill: "reading", time_limit_sec: 780 });
    const item = await newItem(db);
    await insert(db, "placement_section_items", { section_id: section.id, item_id: item.id, sort: 1 });
    await expectViolation(insert(db, "placement_section_items", { section_id: section.id, item_id: item.id, sort: 2 }), /placement_section_items_pkey/);
    await expectViolation(db.query("delete from content_items where id = $1", [item.id]), /placement_section_items_item_id_fkey/);
    await db.query("delete from placement_versions where id = $1", [v.id]);
    expect(await count(db, "placement_section_items", "section_id = $1", [section.id])).toBe(0);
    await db.query("delete from content_items where id = $1", [item.id]);
  });
});

describe("placement_attempts", () => {
  it("allows only one in-progress attempt per user", async () => {
    const user = await newUser(db);
    const first = await attempt({ user_id: user.id });
    expect(first).toMatchObject({ status: "in_progress", completed_at: null, overall_band: null });
    await expectViolation(attempt({ user_id: user.id }), /placement_attempts_one_in_progress/);
    await db.query("update placement_attempts set status = 'abandoned' where id = $1", [first.id]);
    await attempt({ user_id: user.id });
    await attempt({ user_id: (await newUser(db)).id });
  });

  it("keeps any number of completed attempts per user", async () => {
    const user = await newUser(db);
    for (const day of ["2026-01-01", "2026-02-01"]) {
      await attempt({ user_id: user.id, status: "completed", completed_at: `${day}T10:00:00Z`, overall_band: 6.5 });
    }
    expect(await count(db, "placement_attempts", "user_id = $1", [user.id])).toBe(2);
  });

  it("ties completed_at and overall_band to the completed status and validates the band", async () => {
    await expectViolation(attempt({ status: "completed" }), /placement_attempts_completed_matches_status/);
    await expectViolation(attempt({ completed_at: new Date() }), /placement_attempts_completed_matches_status/);
    await expectViolation(attempt({ overall_band: 6.5 }), /placement_attempts_band_needs_completion/);
    await expectViolation(attempt({ status: "completed", completed_at: new Date(), overall_band: 6.3 }), /placement_attempts_band_valid/);
    await expectViolation(attempt({ status: "finished" }), /placement_attempts_status_valid/);
  });

  it("has no summary column and is removed with the user", async () => {
    const cols = await db.query("select column_name from information_schema.columns where table_name = 'placement_attempts'");
    expect(cols.rows.map((r) => r.column_name)).not.toContain("summary");
    const row = await attempt();
    await db.query("delete from users where id = $1", [row.user_id]);
    expect(await count(db, "placement_attempts", "id = $1", [row.id])).toBe(0);
  });

  it("restricts deleting a version that has attempts", async () => {
    const row = await attempt();
    await expectViolation(db.query("delete from placement_versions where id = $1", [row.version_id]), /placement_attempts_version_id_fkey/);
  });
});

describe("placement_skill_attempts", () => {
  it("is unique per attempt and skill", async () => {
    const a = await attempt();
    await skillAttempt({ attempt_id: a.id, skill: "listening" });
    await expectViolation(skillAttempt({ attempt_id: a.id, skill: "listening" }), /placement_skill_attempts_attempt_skill_key/);
    await skillAttempt({ attempt_id: a.id, skill: "reading" });
  });

  it("validates status, scores and band", async () => {
    await expectViolation(skillAttempt({ status: "skipped" }), /placement_skill_attempts_status_valid/);
    await expectViolation(skillAttempt({ raw_score: 5 }), /placement_skill_attempts_scores_paired/);
    await expectViolation(skillAttempt({ raw_score: 9, max_score: 8 }), /placement_skill_attempts_scores_valid/);
    await expectViolation(skillAttempt({ raw_score: -1, max_score: 8 }), /placement_skill_attempts_scores_valid/);
    await expectViolation(skillAttempt({ band: 6.5 }), /placement_skill_attempts_band_needs_completion/);
    const done = await skillAttempt({
      status: "completed", started_at: "2026-01-01T10:00:00Z", deadline_at: "2026-01-01T10:10:00Z",
      completed_at: "2026-01-01T10:09:00Z", raw_score: 7, max_score: 8, band: 7.5,
    });
    expect(done.band).toBe("7.5");
  });

  it("keeps timing consistent: deadline with start, no start for not_started, completed_at only when completed", async () => {
    await expectViolation(skillAttempt({ started_at: new Date() }), /placement_skill_attempts_deadline_paired/);
    await expectViolation(
      skillAttempt({ status: "in_progress", started_at: "2026-01-01T10:00:00Z", deadline_at: "2026-01-01T09:00:00Z" }),
      /placement_skill_attempts_deadline_after_start/,
    );
    await expectViolation(skillAttempt({ status: "in_progress" }), /placement_skill_attempts_started_matches_status/);
    await expectViolation(
      skillAttempt({ started_at: new Date(), deadline_at: new Date(Date.now() + 1000) }),
      /placement_skill_attempts_started_matches_status/,
    );
    await expectViolation(skillAttempt({ status: "completed" }), /placement_skill_attempts_completed_matches_status/);
    await skillAttempt({ skill: "speaking", status: "not_assessed" });
  });

  it("records audio start only for listening", async () => {
    await skillAttempt({ audio_started_at: new Date() });
    await expectViolation(skillAttempt({ skill: "reading", audio_started_at: new Date() }), /placement_skill_attempts_audio_listening_only/);
  });
});

describe("placement_answers", () => {
  it("allows one answer per skill attempt and item and cascades with the attempt", async () => {
    const sa = await skillAttempt({ skill: "reading" });
    const item = await publishedItem(db);
    const answer = { skill_attempt_id: sa.id, item_id: item.id, answer: JSON.stringify({ value: "B" }) };
    const row = await insert(db, "placement_answers", answer);
    expect(row).toMatchObject({ is_correct: null, answer: { value: "B" } });
    await expectViolation(insert(db, "placement_answers", answer), /placement_answers_skill_attempt_item_key/);
    await db.query("delete from placement_skill_attempts where id = $1", [sa.id]);
    expect(await count(db, "placement_answers", "id = $1", [row.id])).toBe(0);
  });
});

describe("speaking_recordings", () => {
  const recording = async (fields = {}) => insert(db, "speaking_recordings", {
    user_id: (await newUser(db)).id,
    context_type: "placement",
    context_id: "00000000-0000-4000-8000-000000000002",
    question_item_id: (await newItem(db, { skill: "speaking" })).id,
    storage_key: unique("rec"),
    mime: "audio/webm",
    bytes: 4096,
    duration_sec: 62.4,
    ...fields,
  });

  it("stores transcript, word timestamps and fluency metrics", async () => {
    const row = await recording({
      transcript: "hello world", words: JSON.stringify([{ word: "hello", start: 0, end: 0.4 }]),
      wpm: 120.5, pause_count: 3, long_pause_count: 1, mean_pause_ms: 640,
    });
    expect(row.words).toEqual([{ word: "hello", start: 0, end: 0.4 }]);
    expect(Number(row.wpm)).toBe(120.5);
  });

  it("validates context, mime, size limit, metrics and word array shape; storage key is unique", async () => {
    await expectViolation(recording({ context_type: "lesson" }), /speaking_recordings_context_type_valid/);
    await expectViolation(recording({ mime: "video/webm" }), /speaking_recordings_mime_audio/);
    await expectViolation(recording({ bytes: 26_214_401 }), /speaking_recordings_bytes_valid/);
    await expectViolation(recording({ duration_sec: 0 }), /speaking_recordings_duration_valid/);
    await expectViolation(recording({ pause_count: -1 }), /speaking_recordings_metrics_valid/);
    await expectViolation(recording({ pause_count: 1, long_pause_count: 2 }), /speaking_recordings_metrics_valid/);
    await expectViolation(recording({ words: JSON.stringify({ not: "array" }) }), /speaking_recordings_words_array/);
    const first = await recording();
    await expectViolation(recording({ storage_key: first.storage_key }), /speaking_recordings_storage_key_key/);
  });

  it("is removed with the user but restricts deleting its question item", async () => {
    const row = await recording();
    await expectViolation(db.query("delete from content_items where id = $1", [row.question_item_id]), /speaking_recordings_question_item_id_fkey/);
    await db.query("delete from users where id = $1", [row.user_id]);
    expect(await count(db, "speaking_recordings", "id = $1", [row.id])).toBe(0);
  });
});
