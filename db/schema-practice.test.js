import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  count, createMigratedDb, expectViolation, insert, newItem, newPracticeSet, newQuestionType, newUser, publishedItem,
} from "./test-helpers.js";

let db;
beforeAll(async () => { db = await createMigratedDb(); });
afterAll(async () => { await db.close(); });

const REVIEWED = new Date("2026-01-01T00:00:00Z");
const skillSet = async (fields = {}) => {
  const skill = fields.skill ?? "reading";
  const type = fields.question_type ?? (await newQuestionType(db, { skill })).key;
  return newPracticeSet(db, { kind: "skill_set", skill, question_type: type, part_no: null, time_limit_sec: null, ...fields });
};
const practiceAttempt = async (fields = {}) => {
  const userId = fields.user_id ?? (await newUser(db)).id;
  const setId = fields.set_id === undefined && fields.kind !== "mock_scoring" ? (await skillSet()).id : fields.set_id ?? null;
  return insert(db, "practice_attempts", { user_id: userId, set_id: setId, kind: "skill_set", skill: "reading", ...fields });
};

describe("practice_sets", () => {
  it("accepts a skill set (type, no timer) and an exam part (part number, timer)", async () => {
    const set = await skillSet();
    expect(set).toMatchObject({ kind: "skill_set", status: "draft", is_free: false, is_dev_fixture: false, time_limit_sec: null });
    expect((await newPracticeSet(db)).kind).toBe("exam_part");
  });

  it("enforces the kind rules: skill sets need a question type and no timer; exam parts need a part and a timer", async () => {
    await expectViolation(newPracticeSet(db, { kind: "skill_set", time_limit_sec: null, part_no: null }), /practice_sets_skill_set_needs_type/);
    const type = (await newQuestionType(db)).key;
    await expectViolation(newPracticeSet(db, { kind: "skill_set", question_type: type, time_limit_sec: 600, part_no: null }), /practice_sets_timer_matches_kind/);
    await expectViolation(newPracticeSet(db, { part_no: null }), /practice_sets_exam_part_needs_part/);
    await expectViolation(newPracticeSet(db, { time_limit_sec: null }), /practice_sets_timer_matches_kind/);
    await expectViolation(newPracticeSet(db, { kind: "lesson" }), /practice_sets_kind_valid/);
  });

  it("validates skill, exam type, minutes, lifecycle, and ties the question type to the skill", async () => {
    await expectViolation(newPracticeSet(db, { skill: "grammar" }), /practice_sets_skill_valid/);
    await expectViolation(newPracticeSet(db, { exam_type: "ukvi" }), /practice_sets_exam_type_valid/);
    await expectViolation(newPracticeSet(db, { est_minutes: 0 }), /practice_sets_minutes_valid/);
    await expectViolation(newPracticeSet(db, { status: "rejected" }), /practice_sets_rejected_needs_reason/);
    await expectViolation(newPracticeSet(db, { status: "published" }), /practice_sets_published_needs_review/);
    const writing = (await newQuestionType(db, { skill: "writing" })).key;
    await expectViolation(skillSet({ skill: "reading", question_type: writing }), /practice_sets_question_type_skill_fkey/);
  });

  it("only skill sets can be free, and at most one real free set per question type and exam type", async () => {
    await expectViolation(newPracticeSet(db, { is_free: true }), /practice_sets_free_skill_set_only/);
    const type = (await newQuestionType(db)).key;
    await skillSet({ question_type: type, is_free: true });
    await expectViolation(skillSet({ question_type: type, is_free: true }), /practice_sets_one_free_per_type/);
    await skillSet({ question_type: type, is_free: true, exam_type: "general" });
    await skillSet({ question_type: type, is_free: true, status: "rejected", rejection_reason: "bad" });
    await skillSet({ question_type: type, is_free: true, is_dev_fixture: true });
    await skillSet({ question_type: type });
  });

  it("links items once per set and restricts deleting a used item", async () => {
    const set = await skillSet();
    const item = await newItem(db, { question_type: set.question_type });
    await insert(db, "practice_set_items", { set_id: set.id, item_id: item.id });
    await expectViolation(insert(db, "practice_set_items", { set_id: set.id, item_id: item.id }), /practice_set_items_pkey/);
    await expectViolation(db.query("delete from content_items where id = $1", [item.id]), /practice_set_items_item_id_fkey/);
    await db.query("delete from practice_sets where id = $1", [set.id]);
    expect(await count(db, "practice_set_items", "set_id = $1", [set.id])).toBe(0);
  });
});

describe("practice_attempts", () => {
  it("defaults to an in-progress attempt that does not count for the band", async () => {
    const row = await practiceAttempt();
    expect(row).toMatchObject({ status: "in_progress", counts_for_band: false, minutes_studied: 0, completed_at: null });
  });

  it("supports scoring_failed and the full status list; completion matches terminal statuses", async () => {
    await expectViolation(practiceAttempt({ status: "done" }), /practice_attempts_status_valid/);
    for (const status of ["submitted", "scoring", "scored", "scoring_failed"]) {
      await practiceAttempt({ status, completed_at: new Date() });
    }
    await practiceAttempt({ status: "abandoned" });
    await expectViolation(practiceAttempt({ status: "scored" }), /practice_attempts_completed_matches_status/);
    await expectViolation(practiceAttempt({ completed_at: new Date() }), /practice_attempts_completed_matches_status/);
  });

  it("only scored attempts carry a band, scores are consistent, minutes non-negative", async () => {
    await expectViolation(practiceAttempt({ status: "scoring_failed", completed_at: new Date(), band: 6 }), /practice_attempts_band_needs_scored/);
    await expectViolation(practiceAttempt({ status: "scored", completed_at: new Date(), band: 6.3 }), /practice_attempts_band_valid/);
    await expectViolation(practiceAttempt({ raw_score: 3 }), /practice_attempts_scores_paired/);
    await expectViolation(practiceAttempt({ raw_score: 5, max_score: 4 }), /practice_attempts_scores_valid/);
    await expectViolation(practiceAttempt({ minutes_studied: -1 }), /practice_attempts_minutes_valid/);
    await expectViolation(practiceAttempt({ duration_sec: -5 }), /practice_attempts_duration_valid/);
    const scored = await practiceAttempt({ status: "scored", completed_at: new Date(), band: 6.5, raw_score: 28, max_score: 40 });
    expect(scored.band).toBe("6.5");
  });

  it("never lets a skill set count for the band; exam parts may", async () => {
    await expectViolation(practiceAttempt({ counts_for_band: true }), /practice_attempts_skill_set_no_band/);
    const part = await newPracticeSet(db);
    expect((await practiceAttempt({ kind: "exam_part", set_id: part.id, counts_for_band: true })).counts_for_band).toBe(true);
  });

  it("has a set exactly when it is not a mock scoring attempt", async () => {
    await expectViolation(practiceAttempt({ kind: "mock_scoring", set_id: (await skillSet()).id }), /practice_attempts_set_matches_kind/);
    await practiceAttempt({ kind: "mock_scoring", set_id: null, skill: "writing" });
    await expectViolation(practiceAttempt({ kind: "skill_set", set_id: null }), /practice_attempts_set_matches_kind/);
    await expectViolation(practiceAttempt({ kind: "quiz" }), /practice_attempts_kind_valid/);
  });

  it("allows one in-progress attempt per user and set", async () => {
    const user = await newUser(db);
    const set = await skillSet();
    await practiceAttempt({ user_id: user.id, set_id: set.id });
    await expectViolation(practiceAttempt({ user_id: user.id, set_id: set.id }), /practice_attempts_one_in_progress_per_set/);
    await practiceAttempt({ user_id: user.id, set_id: (await skillSet()).id });
    await practiceAttempt({ user_id: (await newUser(db)).id, set_id: set.id });
    await db.query("update practice_attempts set status = 'abandoned' where user_id = $1 and set_id = $2", [user.id, set.id]);
    await practiceAttempt({ user_id: user.id, set_id: set.id });
  });

  it("restricts deleting a set with attempts; cascades answers with the attempt", async () => {
    const attempt = await practiceAttempt();
    await expectViolation(db.query("delete from practice_sets where id = $1", [attempt.set_id]), /practice_attempts_set_id_fkey/);
    const item = await publishedItem(db);
    const answer = { attempt_id: attempt.id, item_id: item.id, answer: JSON.stringify(["B", "D"]) };
    const row = await insert(db, "practice_answers", answer);
    expect(row.answer).toEqual(["B", "D"]);
    await expectViolation(insert(db, "practice_answers", answer), /practice_answers_attempt_item_key/);
    await db.query("delete from practice_attempts where id = $1", [attempt.id]);
    expect(await count(db, "practice_answers", "id = $1", [row.id])).toBe(0);
  });
});

describe("question_type_mastery", () => {
  it("is one cache row per user and question type with consistent counts", async () => {
    const user = await newUser(db);
    const type = (await newQuestionType(db)).key;
    const row = await insert(db, "question_type_mastery", { user_id: user.id, question_type: type, answered: 10, correct: 7 });
    expect(row.updated_at).toBeInstanceOf(Date);
    await expectViolation(insert(db, "question_type_mastery", { user_id: user.id, question_type: type, answered: 1, correct: 1 }), /question_type_mastery_pkey/);
    const other = (await newQuestionType(db)).key;
    await expectViolation(insert(db, "question_type_mastery", { user_id: user.id, question_type: other, answered: 3, correct: 4 }), /question_type_mastery_counts_valid/);
    await expectViolation(insert(db, "question_type_mastery", { user_id: user.id, question_type: other, answered: -1, correct: 0 }), /question_type_mastery_counts_valid/);
  });
});

describe("study_plans", () => {
  // 2026-11-07 is a Saturday, 2026-11-08 a Sunday.
  const plan = async (fields = {}) => insert(db, "study_plans", {
    user_id: (await newUser(db)).id, week_start: "2026-11-07", path: "auto", phase: 1, inputs: JSON.stringify({ target: 7 }), ...fields,
  });

  it("allows one active plan per user and week; superseded plans stay", async () => {
    const user = await newUser(db);
    const first = await plan({ user_id: user.id });
    expect(first.status).toBe("active");
    await expectViolation(plan({ user_id: user.id }), /study_plans_one_active_per_week/);
    await db.query("update study_plans set status = 'superseded' where id = $1", [first.id]);
    await plan({ user_id: user.id });
    await plan({ user_id: user.id, week_start: "2026-11-14" });
    await plan({ user_id: (await newUser(db)).id });
    expect(await count(db, "study_plans", "user_id = $1", [user.id])).toBe(3);
  });

  it("starts weeks on Saturday and validates path, phase, status and inputs", async () => {
    await expectViolation(plan({ week_start: "2026-11-08" }), /study_plans_week_start_saturday/);
    await expectViolation(plan({ path: "turbo" }), /study_plans_path_valid/);
    await expectViolation(plan({ phase: 5 }), /study_plans_phase_valid/);
    await expectViolation(plan({ status: "deleted" }), /study_plans_status_valid/);
    await expectViolation(plan({ inputs: JSON.stringify([1]) }), /study_plans_inputs_object/);
  });

  describe("plan_tasks", () => {
    const task = async (fields = {}) => insert(db, "plan_tasks", {
      plan_id: fields.plan_id ?? (await plan()).id, day: "2026-11-09", skill: "reading", kind: "skill_set",
      title_fa: "عنوان", title_en: "Title", minutes: 20, original_day: "2026-11-09", ...fields,
    });

    it("defaults to a pending, unshortened task", async () => {
      expect(await task()).toMatchObject({ status: "pending", shortened: false, done_at: null, done_attempt_id: null, match_rule: "none", sort: 0 });
    });

    it("validates status, kind, skill, minutes and reference pairing", async () => {
      await expectViolation(task({ status: "later" }), /plan_tasks_status_valid/);
      await expectViolation(task({ kind: "video" }), /plan_tasks_kind_valid/);
      await expectViolation(task({ skill: "grammar" }), /plan_tasks_skill_valid/);
      await expectViolation(task({ minutes: 0 }), /plan_tasks_minutes_valid/);
      await expectViolation(task({ ref_type: "practice_set" }), /plan_tasks_ref_paired/);
      await expectViolation(task({ ref_type: "exam", ref_id: "00000000-0000-4000-8000-000000000003" }), /plan_tasks_ref_type_valid/);
      await expectViolation(task({ skill: null }), /plan_tasks_skill_needed/);
      await task({ skill: null, kind: "mock", ref_type: "mock", ref_id: "00000000-0000-4000-8000-000000000003" });
    });

    it("validates the auto-tick match rule against the data it needs", async () => {
      await expectViolation(task({ match_rule: "magic" }), /plan_tasks_match_rule_valid/);
      await expectViolation(task({ match_rule: "set" }), /plan_tasks_match_rule_needs_data/);
      await expectViolation(task({ match_rule: "skill_type" }), /plan_tasks_match_rule_needs_data/);
      const set = await skillSet();
      await task({ match_rule: "set", ref_type: "practice_set", ref_id: set.id });
      await task({ match_rule: "skill_type", question_type: set.question_type });
    });

    it("ties done_at to done, links the finishing attempt, and nulls it when the attempt is deleted", async () => {
      await expectViolation(task({ status: "done" }), /plan_tasks_done_matches_status/);
      await expectViolation(task({ done_at: new Date() }), /plan_tasks_done_matches_status/);
      const attempt = await practiceAttempt();
      await expectViolation(task({ done_attempt_id: attempt.id }), /plan_tasks_attempt_needs_done/);
      const done = await task({ status: "done", done_at: new Date(), done_attempt_id: attempt.id });
      await db.query("delete from practice_attempts where id = $1", [attempt.id]);
      const after = await db.query("select status, done_attempt_id from plan_tasks where id = $1", [done.id]);
      expect(after.rows[0]).toEqual({ status: "done", done_attempt_id: null });
      await task({ status: "skipped" });
    });

    it("is removed with its plan", async () => {
      const row = await task();
      await db.query("delete from study_plans where id = $1", [row.plan_id]);
      expect(await count(db, "plan_tasks", "id = $1", [row.id])).toBe(0);
    });
  });
});
