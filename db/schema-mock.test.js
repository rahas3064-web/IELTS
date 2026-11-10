import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  count, createMigratedDb, expectViolation, insert, newItem, newMock, newUser, publishedItem,
} from "./test-helpers.js";

let db;
beforeAll(async () => { db = await createMigratedDb(); });
afterAll(async () => { await db.close(); });

const REVIEWED = new Date("2026-01-01T00:00:00Z");
const section = async (fields = {}) => insert(db, "mock_sections", {
  mock_id: fields.mock_id ?? (await newMock(db)).id, skill: "listening", time_limit_sec: 1800, ...fields,
});
const mockAttempt = async (fields = {}) => insert(db, "mock_attempts", {
  user_id: fields.user_id ?? (await newUser(db)).id, mock_id: fields.mock_id ?? (await newMock(db)).id, mode: "full", ...fields,
});
const sectionAttempt = async (fields = {}) => insert(db, "mock_section_attempts", {
  mock_attempt_id: fields.mock_attempt_id ?? (await mockAttempt()).id, skill: "listening", ...fields,
});

describe("mocks", () => {
  it("defaults to a paid draft and follows the review lifecycle", async () => {
    expect(await newMock(db)).toMatchObject({ status: "draft", is_free: false, is_dev_fixture: false });
    await expectViolation(newMock(db, { exam_type: "both" }), /mocks_exam_type_valid/);
    await expectViolation(newMock(db, { status: "live" }), /mocks_status_valid/);
    await expectViolation(newMock(db, { status: "rejected" }), /mocks_rejected_needs_reason/);
    await expectViolation(newMock(db, { status: "published" }), /mocks_published_needs_review/);
    expect((await newMock(db, { status: "published", reviewed_at: REVIEWED })).status).toBe("published");
  });
});

describe("mock sections and items", () => {
  it("has one section per skill per mock; only listening has transfer time", async () => {
    const mock = await newMock(db);
    await section({ mock_id: mock.id, transfer_time_sec: 120 });
    await expectViolation(section({ mock_id: mock.id }), /mock_sections_mock_skill_key/);
    await expectViolation(section({ mock_id: mock.id, skill: "reading", transfer_time_sec: 60 }), /mock_sections_transfer_listening_only/);
    await expectViolation(section({ mock_id: mock.id, skill: "writing", time_limit_sec: 0 }), /mock_sections_time_limit_valid/);
    await expectViolation(section({ skill: "listening", transfer_time_sec: -1 }), /mock_sections_transfer_valid/);
    await expectViolation(section({ skill: "grammar" }), /mock_sections_skill_valid/);
  });

  it("lists an item once per section with a part number 1-4", async () => {
    const s = await section();
    const item = await newItem(db);
    await insert(db, "mock_section_items", { section_id: s.id, item_id: item.id, part_no: 1 });
    await expectViolation(insert(db, "mock_section_items", { section_id: s.id, item_id: item.id, part_no: 2 }), /mock_section_items_pkey/);
    const other = await newItem(db);
    await expectViolation(insert(db, "mock_section_items", { section_id: s.id, item_id: other.id, part_no: 5 }), /mock_section_items_part_no_valid/);
    await expectViolation(db.query("delete from content_items where id = $1", [item.id]), /mock_section_items_item_id_fkey/);
  });
});

describe("mock_attempts", () => {
  it("allows a mock to be taken only once per user", async () => {
    const user = await newUser(db);
    const mock = await newMock(db);
    await mockAttempt({ user_id: user.id, mock_id: mock.id });
    await expectViolation(mockAttempt({ user_id: user.id, mock_id: mock.id }), /mock_attempts_user_mock_key/);
    await expectViolation(mockAttempt({ user_id: user.id, mock_id: mock.id, mode: "single_skill", skill: "reading" }), /mock_attempts_user_mock_key/);
    await mockAttempt({ user_id: user.id });
    await mockAttempt({ mock_id: mock.id });
  });

  it("ties skill to single-skill mode and validates mode and status", async () => {
    await expectViolation(mockAttempt({ mode: "half" }), /mock_attempts_mode_valid/);
    await expectViolation(mockAttempt({ mode: "single_skill" }), /mock_attempts_skill_matches_mode/);
    await expectViolation(mockAttempt({ skill: "reading" }), /mock_attempts_skill_matches_mode/);
    await expectViolation(mockAttempt({ mode: "single_skill", skill: "grammar" }), /mock_attempts_skill_valid/);
    await expectViolation(mockAttempt({ status: "paused" }), /mock_attempts_status_valid/);
    await expectViolation(mockAttempt({ mode: "single_skill", skill: "reading", status: "awaiting_speaking" }), /mock_attempts_awaiting_speaking_full_only/);
    expect((await mockAttempt({ status: "awaiting_speaking" })).status).toBe("awaiting_speaking");
  });

  it("ties completed_at to completion and the overall band to completed full mocks", async () => {
    await expectViolation(mockAttempt({ status: "completed" }), /mock_attempts_completed_matches_status/);
    await expectViolation(mockAttempt({ completed_at: new Date() }), /mock_attempts_completed_matches_status/);
    await expectViolation(mockAttempt({ overall_band: 7 }), /mock_attempts_band_needs_completion/);
    await expectViolation(mockAttempt({ status: "completed", completed_at: new Date(), overall_band: 7.3 }), /mock_attempts_band_valid/);
    await expectViolation(
      mockAttempt({ mode: "single_skill", skill: "reading", status: "completed", completed_at: new Date(), overall_band: 7 }),
      /mock_attempts_band_full_only/,
    );
    const done = await mockAttempt({ status: "completed", completed_at: new Date(), overall_band: 7 });
    expect(done.overall_band).toBe("7.0");
  });

  it("restricts deleting a mock that was taken and cascades with the user", async () => {
    const row = await mockAttempt();
    await expectViolation(db.query("delete from mocks where id = $1", [row.mock_id]), /mock_attempts_mock_id_fkey/);
    await db.query("delete from users where id = $1", [row.user_id]);
    expect(await count(db, "mock_attempts", "id = $1", [row.id])).toBe(0);
  });
});

describe("mock_section_attempts", () => {
  it("is unique per attempt and skill and validates status", async () => {
    const a = await mockAttempt();
    await sectionAttempt({ mock_attempt_id: a.id });
    await expectViolation(sectionAttempt({ mock_attempt_id: a.id }), /mock_section_attempts_attempt_skill_key/);
    await expectViolation(sectionAttempt({ skill: "grammar" }), /mock_section_attempts_skill_valid/);
    await expectViolation(sectionAttempt({ status: "skipped" }), /mock_section_attempts_status_valid/);
    expect((await sectionAttempt({ skill: "speaking", status: "not_assessed" })).status).toBe("not_assessed");
  });

  it("keeps timing, scores and band consistent; audio start is listening-only", async () => {
    await expectViolation(sectionAttempt({ started_at: new Date() }), /mock_section_attempts_deadline_paired/);
    await expectViolation(sectionAttempt({ status: "in_progress", started_at: "2026-01-01T10:00:00Z", deadline_at: "2026-01-01T09:00:00Z" }), /mock_section_attempts_deadline_after_start/);
    await expectViolation(sectionAttempt({ status: "completed" }), /mock_section_attempts_completed_matches_status/);
    await expectViolation(sectionAttempt({ raw_score: 9, max_score: 8 }), /mock_section_attempts_scores_valid/);
    await expectViolation(sectionAttempt({ raw_score: 9 }), /mock_section_attempts_scores_paired/);
    await expectViolation(sectionAttempt({ band: 7 }), /mock_section_attempts_band_needs_completion/);
    await expectViolation(sectionAttempt({ skill: "reading", audio_started_at: new Date() }), /mock_section_attempts_audio_listening_only/);
    const done = await sectionAttempt({
      status: "completed", started_at: "2026-01-01T10:00:00Z", deadline_at: "2026-01-01T10:30:00Z",
      completed_at: "2026-01-01T10:29:00Z", raw_score: 33, max_score: 40, band: 7.5, audio_started_at: "2026-01-01T10:00:05Z",
    });
    expect(done.band).toBe("7.5");
  });

  it("links W/S scoring practice attempts to the section once and cascades both ways", async () => {
    const sa = await sectionAttempt({ skill: "writing" });
    const user = await newUser(db);
    const pa = await insert(db, "practice_attempts", { user_id: user.id, kind: "mock_scoring", skill: "writing" });
    await insert(db, "mock_scoring_attempts", { practice_attempt_id: pa.id, mock_section_attempt_id: sa.id });
    await expectViolation(insert(db, "mock_scoring_attempts", { practice_attempt_id: pa.id, mock_section_attempt_id: sa.id }), /mock_scoring_attempts_pkey/);
    await db.query("delete from mock_section_attempts where id = $1", [sa.id]);
    expect(await count(db, "mock_scoring_attempts", "practice_attempt_id = $1", [pa.id])).toBe(0);
  });
});

describe("mock_answers", () => {
  it("allows one answer per section attempt and item, with a flag defaulting to false", async () => {
    const sa = await sectionAttempt();
    const item = await publishedItem(db);
    const row = await insert(db, "mock_answers", { section_attempt_id: sa.id, item_id: item.id, answer: JSON.stringify("A") });
    expect(row).toMatchObject({ flagged: false, is_correct: null, answer: "A" });
    await expectViolation(insert(db, "mock_answers", { section_attempt_id: sa.id, item_id: item.id, answer: JSON.stringify("B") }), /mock_answers_section_attempt_item_key/);
    await db.query("delete from mock_section_attempts where id = $1", [sa.id]);
    expect(await count(db, "mock_answers", "id = $1", [row.id])).toBe(0);
  });
});

describe("mock_annotations", () => {
  const annotation = async (fields = {}) => {
    const passage = await insert(db, "content_passages", { skill: "reading", exam_type: "academic", title: "T", body: "Passage body", word_count: 2 });
    return insert(db, "mock_annotations", {
      section_attempt_id: (await sectionAttempt({ skill: "reading" })).id, passage_id: passage.id, kind: "highlight", start_offset: 0, end_offset: 7, ...fields,
    });
  };

  it("anchors a highlight or note to exactly one passage or item", async () => {
    expect((await annotation()).note).toBeNull();
    expect((await annotation({ kind: "note", note: "check this" })).kind).toBe("note");
    const item = await newItem(db);
    await annotation({ passage_id: null, item_id: item.id });
    await expectViolation(annotation({ passage_id: null }), /mock_annotations_one_target/);
    await expectViolation(annotation({ item_id: item.id }), /mock_annotations_one_target/);
  });

  it("validates kind, range and note rules", async () => {
    await expectViolation(annotation({ kind: "underline" }), /mock_annotations_kind_valid/);
    await expectViolation(annotation({ start_offset: 5, end_offset: 5 }), /mock_annotations_range_valid/);
    await expectViolation(annotation({ start_offset: -1 }), /mock_annotations_range_valid/);
    await expectViolation(annotation({ kind: "note" }), /mock_annotations_note_rules/);
    await expectViolation(annotation({ kind: "highlight", note: "x" }), /mock_annotations_note_rules/);
  });

  it("restricts deleting an annotated passage", async () => {
    const row = await annotation();
    await expectViolation(db.query("delete from content_passages where id = $1", [row.passage_id]), /mock_annotations_passage_id_fkey/);
  });
});