import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  count, createMigratedDb, expectViolation, insert, newItem, newPracticeSet, newQuestionType, newUser, unique,
} from "./test-helpers.js";

let db;
beforeAll(async () => { db = await createMigratedDb(); });
afterAll(async () => { await db.close(); });

const STEPS = ["قدم ۱", "قدم ۲", "قدم ۳"];
const writingAttempt = async (userId) => {
  const type = (await newQuestionType(db, { skill: "writing" })).key;
  const set = await newPracticeSet(db, { kind: "skill_set", skill: "writing", question_type: type, part_no: null, time_limit_sec: null });
  return insert(db, "practice_attempts", { user_id: userId, set_id: set.id, kind: "skill_set", skill: "writing" });
};
const feedback = async (fields = {}) => {
  const userId = fields.user_id ?? (await newUser(db)).id;
  const attemptId = fields.attempt_id ?? (await writingAttempt(userId)).id;
  return insert(db, "ai_feedback", {
    user_id: userId, attempt_id: attemptId, skill: "writing", task: "task2", overall_band: 6.5,
    criteria: JSON.stringify([{ key: "TR", band: 6, reason_fa: "دلیل" }]),
    next_steps_fa: STEPS, summary_fa: "خلاصه", model: "gpt-test", prompt_version: "writing-v1", ...fields,
  });
};
const category = (key = unique("grammar").replace(/-/g, "_")) =>
  insert(db, "feedback_issue_categories", { key, name_fa: "دسته", name_en: "Category" });

describe("feedback_issue_categories", () => {
  it("links optionally to a question type and a practice set, nulling them when removed", async () => {
    const type = await newQuestionType(db, { skill: "writing" });
    const set = await newPracticeSet(db, { kind: "skill_set", skill: "writing", question_type: type.key, part_no: null, time_limit_sec: null });
    const row = await category();
    await db.query("update feedback_issue_categories set related_question_type = $1, related_set_id = $2 where key = $3", [type.key, set.id, row.key]);
    await db.query("delete from practice_sets where id = $1", [set.id]);
    const after = await db.query("select related_question_type, related_set_id from feedback_issue_categories where key = $1", [row.key]);
    expect(after.rows[0]).toEqual({ related_question_type: type.key, related_set_id: null });
  });

  it("accepts dotted keys (grammar.article) and rejects malformed ones", async () => {
    await category("grammar.article");
    await expectViolation(category("Grammar Article"), /feedback_issue_categories_key_format/);
    await expectViolation(category("grammar.article"), /feedback_issue_categories_pkey/);
  });
});

describe("ai_feedback", () => {
  it("stores a writing report with typed next steps and jsonb criteria", async () => {
    const row = await feedback();
    expect(row).toMatchObject({ skill: "writing", task: "task2", next_steps_fa: STEPS, transcript: null, recording_id: null });
    expect(row.criteria).toEqual([{ key: "TR", band: 6, reason_fa: "دلیل" }]);
    expect(row.overall_band).toBe("6.5");
  });

  it("requires exactly 3 next steps and an array of criteria", async () => {
    await expectViolation(feedback({ next_steps_fa: ["a", "b"] }), /ai_feedback_next_steps_exactly_three/);
    await expectViolation(feedback({ next_steps_fa: ["a", "b", "c", "d"] }), /ai_feedback_next_steps_exactly_three/);
    await expectViolation(feedback({ criteria: JSON.stringify({ TR: 6 }) }), /ai_feedback_criteria_array/);
  });

  it("validates skill, task per skill, band and the honesty-relevant model metadata", async () => {
    await expectViolation(feedback({ skill: "reading" }), /ai_feedback_skill_valid/);
    await expectViolation(feedback({ task: null }), /ai_feedback_task_matches_skill/);
    await expectViolation(feedback({ task: "task9" }), /ai_feedback_task_matches_skill/);
    await expectViolation(feedback({ overall_band: 6.2 }), /ai_feedback_band_valid/);
    await expectViolation(feedback({ overall_band: null }), /not-null|null value/);
    await expectViolation(feedback({ model: " " }), /ai_feedback_model_present/);
  });

  it("allows transcript and recording only for speaking", async () => {
    await expectViolation(feedback({ transcript: "hello" }), /ai_feedback_speaking_only_columns/);
    const user = await newUser(db);
    const item = await newItem(db, { skill: "speaking", question_type: (await newQuestionType(db, { skill: "speaking" })).key });
    const recording = await insert(db, "speaking_recordings", {
      user_id: user.id, context_type: "practice", context_id: "00000000-0000-4000-8000-000000000009",
      question_item_id: item.id, storage_key: unique("rec"), mime: "audio/webm", bytes: 10, duration_sec: 5,
    });
    const type = (await newQuestionType(db, { skill: "speaking" })).key;
    const set = await newPracticeSet(db, { kind: "skill_set", skill: "speaking", question_type: type, part_no: null, time_limit_sec: null });
    const attempt = await insert(db, "practice_attempts", { user_id: user.id, set_id: set.id, kind: "skill_set", skill: "speaking" });
    const row = await feedback({ user_id: user.id, attempt_id: attempt.id, skill: "speaking", task: "part2", transcript: "um hello", recording_id: recording.id });
    await db.query("delete from speaking_recordings where id = $1", [recording.id]);
    expect((await db.query("select recording_id from ai_feedback where id = $1", [row.id])).rows[0].recording_id).toBeNull();
  });

  it("allows one report per attempt and task", async () => {
    const user = await newUser(db);
    const attempt = await writingAttempt(user.id);
    await feedback({ user_id: user.id, attempt_id: attempt.id, task: "task1_academic" });
    await expectViolation(feedback({ user_id: user.id, attempt_id: attempt.id, task: "task1_academic" }), /ai_feedback_attempt_task_key/);
    await feedback({ user_id: user.id, attempt_id: attempt.id, task: "task2" });
  });

  it("cascades with the user and the attempt", async () => {
    const row = await feedback();
    await db.query("delete from practice_attempts where id = $1", [row.attempt_id]);
    expect(await count(db, "ai_feedback", "id = $1", [row.id])).toBe(0);
  });
});

describe("feedback_issues", () => {
  const issue = async (fields = {}) => {
    const report = fields.feedback_id ? null : await feedback();
    return insert(db, "feedback_issues", {
      feedback_id: report?.id, user_id: report?.user_id, category: (await category()).key,
      start_offset: 10, end_offset: 20, original: "a apple", correction: "an apple", explanation_fa: "توضیح", ...fields,
    });
  };

  it("stores an inline issue against a known category", async () => {
    expect(await issue()).toMatchObject({ start_offset: 10, end_offset: 20, correction: "an apple" });
    await expectViolation(issue({ category: "unknown.category" }), /feedback_issues_category_fkey/);
  });

  it("validates offsets", async () => {
    await expectViolation(issue({ start_offset: -1 }), /feedback_issues_offsets_valid/);
    await expectViolation(issue({ start_offset: 20, end_offset: 10 }), /feedback_issues_offsets_valid/);
  });

  it("is removed with its report and restricts deleting a used category", async () => {
    const row = await issue();
    await expectViolation(db.query("delete from feedback_issue_categories where key = $1", [row.category]), /feedback_issues_category_fkey/);
    await db.query("delete from ai_feedback where id = $1", [row.feedback_id]);
    expect(await count(db, "feedback_issues", "id = $1", [row.id])).toBe(0);
  });
});

describe("band_snapshots", () => {
  const snapshot = async (fields = {}) => insert(db, "band_snapshots", {
    user_id: (await newUser(db)).id, source_type: "placement", source_id: crypto.randomUUID(),
    skill: "overall", band: 6.5, measured_at: "2026-11-01T10:00:00Z", ...fields,
  });

  it("validates source type, skill and half-band", async () => {
    await snapshot();
    for (const source_type of ["mock", "exam_part"]) await snapshot({ source_type });
    await expectViolation(snapshot({ source_type: "skill_set" }), /band_snapshots_source_type_valid/);
    await expectViolation(snapshot({ skill: "grammar" }), /band_snapshots_skill_valid/);
    await expectViolation(snapshot({ band: 6.7 }), /band_snapshots_band_valid/);
  });

  it("writes each (source, skill) once so snapshots are idempotent", async () => {
    const user = await newUser(db);
    const source = crypto.randomUUID();
    await snapshot({ user_id: user.id, source_id: source, skill: "listening" });
    await expectViolation(snapshot({ user_id: user.id, source_id: source, skill: "listening" }), /band_snapshots_source_skill_key/);
    await snapshot({ user_id: user.id, source_id: source, skill: "reading" });
  });

  it("has the (user_id, skill, measured_at) index and cascades with the user", async () => {
    const idx = await db.query("select indexdef from pg_indexes where tablename = 'band_snapshots'");
    expect(idx.rows.some((r) => /\(user_id, skill, measured_at\)/.test(r.indexdef))).toBe(true);
    const row = await snapshot();
    await db.query("delete from users where id = $1", [row.user_id]);
    expect(await count(db, "band_snapshots", "id = $1", [row.id])).toBe(0);
  });
});

describe("assistant tables", () => {
  it("keeps conversations and messages per user in order, cascading down", async () => {
    const user = await newUser(db);
    const conv = await insert(db, "assistant_conversations", { user_id: user.id });
    expect(conv.title).toBeNull();
    await insert(db, "assistant_messages", { conversation_id: conv.id, role: "user", content: "How is Part 2 scored?" });
    const reply = await insert(db, "assistant_messages", { conversation_id: conv.id, role: "assistant", content: "…", tokens: 120 });
    expect(reply.tokens).toBe(120);
    await db.query("delete from users where id = $1", [user.id]);
    expect(await count(db, "assistant_messages", "conversation_id = $1", [conv.id])).toBe(0);
  });

  it("validates role, content and tokens", async () => {
    const conv = await insert(db, "assistant_conversations", { user_id: (await newUser(db)).id });
    await expectViolation(insert(db, "assistant_messages", { conversation_id: conv.id, role: "tool", content: "x" }), /assistant_messages_role_valid/);
    await expectViolation(insert(db, "assistant_messages", { conversation_id: conv.id, role: "user", content: "  " }), /assistant_messages_content_present/);
    await expectViolation(insert(db, "assistant_messages", { conversation_id: conv.id, role: "assistant", content: "x", tokens: -1 }), /assistant_messages_tokens_valid/);
  });
});
