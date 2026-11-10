import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  count, createMigratedDb, expectViolation, insert, newItem, newQuestionType, newUser, publishedItem, unique,
} from "./test-helpers.js";

let db;
beforeAll(async () => { db = await createMigratedDb(); });
afterAll(async () => { await db.close(); });

const REVIEWED = new Date("2026-01-01T00:00:00Z");

describe("question_types", () => {
  it("validates skill, exam type and key format; key is the primary key", async () => {
    await expectViolation(newQuestionType(db, { skill: "grammar" }), /question_types_skill_valid/);
    await expectViolation(newQuestionType(db, { exam_type: "ukvi" }), /question_types_exam_type_valid/);
    await expectViolation(newQuestionType(db, { key: "Bad Key" }), /question_types_key_format/);
    const type = await newQuestionType(db, { key: "reading_tfng", exam_type: null });
    expect(type).toMatchObject({ key: "reading_tfng", exam_type: null, sort: 0 });
    await expectViolation(newQuestionType(db, { key: "reading_tfng" }), /question_types_pkey/);
  });
});

describe("media_assets", () => {
  const asset = (fields = {}) => insert(db, "media_assets", {
    kind: "audio", storage_key: unique("audio"), mime: "audio/mpeg", duration_sec: 120, bytes: 2048, ...fields,
  });

  it("accepts audio with a transcript and an image without one", async () => {
    expect((await asset({ transcript: "Hello" })).transcript).toBe("Hello");
    const image = await asset({ kind: "image", mime: "image/png", duration_sec: null });
    expect(image.kind).toBe("image");
  });

  it("rejects bad kind, mime/kind mismatch, image duration/transcript, non-positive bytes, duplicate key", async () => {
    await expectViolation(asset({ kind: "video" }), /media_assets_kind_valid/);
    await expectViolation(asset({ mime: "image/png" }), /media_assets_mime_matches_kind/);
    await expectViolation(asset({ kind: "image", mime: "image/png" }), /media_assets_duration_audio_only/);
    await expectViolation(asset({ kind: "image", mime: "image/png", duration_sec: null, transcript: "x" }), /media_assets_transcript_audio_only/);
    await expectViolation(asset({ bytes: 0 }), /media_assets_bytes_positive/);
    const first = await asset();
    await expectViolation(asset({ storage_key: first.storage_key }), /media_assets_storage_key_key/);
  });

  it("keeps the asset when the uploader is deleted", async () => {
    const user = await newUser(db);
    const row = await asset({ uploaded_by: user.id });
    await db.query("delete from users where id = $1", [user.id]);
    const after = await db.query("select uploaded_by from media_assets where id = $1", [row.id]);
    expect(after.rows[0].uploaded_by).toBeNull();
  });
});

describe("content_passages", () => {
  const passage = (fields = {}) => insert(db, "content_passages", {
    skill: "reading", exam_type: "academic", title: "T", body: "Body text", word_count: 2, ...fields,
  });

  it("only allows reading/listening scripts, valid lifecycle and a non-negative word count", async () => {
    await expectViolation(passage({ skill: "writing" }), /content_passages_skill_valid/);
    await expectViolation(passage({ status: "live" }), /content_passages_status_valid/);
    await expectViolation(passage({ word_count: -1 }), /content_passages_word_count_valid/);
    await expectViolation(passage({ body: "  " }), /content_passages_body_present/);
    expect((await passage({ skill: "listening" })).status).toBe("draft");
  });

  it("requires a reason when rejected and a review timestamp when published", async () => {
    await expectViolation(passage({ status: "rejected" }), /content_passages_rejected_needs_reason/);
    await expectViolation(passage({ status: "rejected", rejection_reason: " " }), /content_passages_rejected_needs_reason/);
    await passage({ status: "rejected", rejection_reason: "too easy" });
    await expectViolation(passage({ status: "published" }), /content_passages_published_needs_review/);
    await passage({ status: "published", reviewed_at: REVIEWED });
  });
});

describe("content_generation_jobs", () => {
  const job = (fields = {}) => insert(db, "content_generation_jobs", {
    skill: "reading", exam_type: "academic", item_count: 5, ...fields,
  });

  it("stores typed generation parameters with sane defaults", async () => {
    const type = await newQuestionType(db, { skill: "reading" });
    const row = await job({ question_type: type.key, part_no: 2, difficulty_band: 6.5, topic: "urban planning" });
    expect(row).toMatchObject({ status: "queued", tokens_in: 0, tokens_out: 0, item_count: 5 });
    expect(Number(row.cost_rial)).toBe(0);
  });

  it("rejects bad status, counts, band, and a failed job without an error; question type must match skill", async () => {
    await expectViolation(job({ status: "done" }), /content_generation_jobs_status_valid/);
    await expectViolation(job({ item_count: 0 }), /content_generation_jobs_item_count_valid/);
    await expectViolation(job({ tokens_in: -1 }), /content_generation_jobs_usage_valid/);
    await expectViolation(job({ difficulty_band: 6.25 }), /content_generation_jobs_difficulty_valid/);
    await expectViolation(job({ status: "failed" }), /content_generation_jobs_failed_has_error/);
    await job({ status: "failed", error: "provider timeout" });
    const writing = await newQuestionType(db, { skill: "writing" });
    await expectViolation(job({ skill: "reading", question_type: writing.key }), /content_generation_jobs_question_type_skill_fkey/);
  });
});

describe("content_items", () => {
  it("defaults to a draft, revision 1, paid, human-less, non-fixture item", async () => {
    const item = await newItem(db);
    expect(item).toMatchObject({ status: "draft", revision: 1, is_free: false, is_dev_fixture: false, source: "human", parent_item_id: null });
  });

  it("rejects rejected content without a reason (and accepts it with one)", async () => {
    await expectViolation(newItem(db, { status: "rejected" }), /content_items_rejected_needs_reason/);
    await expectViolation(newItem(db, { status: "rejected", rejection_reason: "" }), /content_items_rejected_needs_reason/);
    expect((await newItem(db, { status: "rejected", rejection_reason: "ambiguous key" })).status).toBe("rejected");
  });

  it("only lets reviewed items be published, and the published filter returns only those", async () => {
    await expectViolation(newItem(db, { status: "published" }), /content_items_published_needs_review/);
    const type = (await newQuestionType(db, { skill: "listening" })).key;
    await newItem(db, { skill: "listening", question_type: type, status: "in_review" });
    await newItem(db, { skill: "listening", question_type: type });
    const live = await publishedItem(db, { skill: "listening", question_type: type });
    const visible = await db.query("select id from content_items where status = 'published' and question_type = $1", [type]);
    expect(visible.rows.map((r) => r.id)).toEqual([live.id]);
  });

  it("validates enums, band, part number, stem shape and the answer key rule", async () => {
    await expectViolation(newItem(db, { status: "archived" }), /content_items_status_valid/);
    await expectViolation(newItem(db, { exam_type: "ukvi" }), /content_items_exam_type_valid/);
    await expectViolation(newItem(db, { source: "scraped" }), /content_items_source_valid/);
    await expectViolation(newItem(db, { difficulty_band: 9.5 }), /content_items_difficulty_valid/);
    await expectViolation(newItem(db, { part_no: 5 }), /content_items_part_no_valid/);
    await expectViolation(newItem(db, { stem: JSON.stringify(["not", "an", "object"]) }), /content_items_stem_object/);
    await expectViolation(newItem(db, { answer_key: null }), /content_items_objective_needs_key/);
    const writing = (await newQuestionType(db, { skill: "writing" })).key;
    expect((await newItem(db, { skill: "writing", question_type: writing, answer_key: null })).answer_key).toBeNull();
  });

  it("ties the question type to the item's skill and requires an existing type", async () => {
    const speaking = (await newQuestionType(db, { skill: "speaking" })).key;
    await expectViolation(newItem(db, { skill: "reading", question_type: speaking }), /content_items_question_type_skill_fkey/);
    await expectViolation(newItem(db, { question_type: "no_such_type" }), /content_items_question_type_skill_fkey/);
  });

  it("models revisions: parent link needs revision > 1, no self parent, one child per revision number", async () => {
    const parent = await publishedItem(db);
    await expectViolation(newItem(db, { parent_item_id: parent.id }), /content_items_parent_needs_revision/);
    await expectViolation(newItem(db, { question_type: parent.question_type, revision: 0 }), /content_items_revision_valid/);
    const child = await newItem(db, { question_type: parent.question_type, parent_item_id: parent.id, revision: 2 });
    await expectViolation(
      newItem(db, { question_type: parent.question_type, parent_item_id: parent.id, revision: 2 }),
      /content_items_parent_revision_key/,
    );
    await expectViolation(db.query("update content_items set parent_item_id = id where id = $1", [child.id]), /content_items_no_self_parent/);
    await db.query("delete from content_items where id = $1", [parent.id]);
    const orphan = await db.query("select parent_item_id, revision from content_items where id = $1", [child.id]);
    expect(orphan.rows[0]).toEqual({ parent_item_id: null, revision: 2 });
  });

  it("links generated items to their job and only ai_generated items may have one", async () => {
    const job = await insert(db, "content_generation_jobs", { skill: "reading", exam_type: "academic", item_count: 1 });
    await newItem(db, { source: "ai_generated", generation_job_id: job.id });
    await expectViolation(newItem(db, { source: "human", generation_job_id: job.id }), /content_items_generation_needs_ai/);
  });

  it("keeps items when their passage, audio or authors go away; restricts deleting a used question type", async () => {
    const passage = await insert(db, "content_passages", { skill: "reading", exam_type: "academic", title: "T", body: "b", word_count: 1 });
    const audio = await insert(db, "media_assets", { kind: "audio", storage_key: unique("a"), mime: "audio/mpeg", bytes: 1 });
    const author = await newUser(db);
    const item = await newItem(db, { passage_id: passage.id, audio_id: audio.id, created_by: author.id });
    await db.query("delete from content_passages where id = $1", [passage.id]);
    await db.query("delete from media_assets where id = $1", [audio.id]);
    await db.query("delete from users where id = $1", [author.id]);
    const after = await db.query("select passage_id, audio_id, created_by from content_items where id = $1", [item.id]);
    expect(after.rows[0]).toEqual({ passage_id: null, audio_id: null, created_by: null });
    await expectViolation(db.query("delete from question_types where key = $1", [item.question_type]), /content_items_question_type_skill_fkey/);
  });

  it("flags dev fixtures separately from real content", async () => {
    const fixture = await publishedItem(db, { is_dev_fixture: true });
    expect(await count(db, "content_items", "id = $1 and is_dev_fixture and status = 'published'", [fixture.id])).toBe(1);
  });
});

describe("content_reviews", () => {
  const review = (fields = {}) => insert(db, "content_reviews", {
    target_type: "content_item", target_id: "00000000-0000-4000-8000-000000000001", decision: "approved", ...fields,
  });

  it("requires a reason to reject and validates decision and target type", async () => {
    const reviewer = await newUser(db, { role: "reviewer" });
    await review({ reviewer_id: reviewer.id });
    await review({ decision: "edited", diff: JSON.stringify({ before: "a", after: "b" }) });
    await expectViolation(review({ decision: "rejected" }), /content_reviews_rejected_needs_reason/);
    await review({ decision: "rejected", reason: "wrong answer key" });
    await expectViolation(review({ decision: "maybe" }), /content_reviews_decision_valid/);
    await expectViolation(review({ target_type: "user" }), /content_reviews_target_type_valid/);
  });

  it("keeps the review when the reviewer account is deleted", async () => {
    const reviewer = await newUser(db, { role: "reviewer" });
    const row = await review({ reviewer_id: reviewer.id });
    await db.query("delete from users where id = $1", [reviewer.id]);
    expect((await db.query("select reviewer_id from content_reviews where id = $1", [row.id])).rows[0].reviewer_id).toBeNull();
  });
});

describe("band_descriptors", () => {
  const descriptor = (fields = {}) => insert(db, "band_descriptors", {
    skill: "writing", task: "task2", criterion_key: "TR", band: 6, text_en: "text", source: "ielts.org public", version: "2026-01", ...fields,
  });

  it("is unique per skill/task/criterion/band/version, treating a null task as a value", async () => {
    await descriptor();
    await expectViolation(descriptor(), /band_descriptors_natural_key/);
    await descriptor({ version: "2026-02" });
    await descriptor({ skill: "speaking", task: null, criterion_key: "FC" });
    await expectViolation(descriptor({ skill: "speaking", task: null, criterion_key: "FC" }), /band_descriptors_natural_key/);
  });

  it("validates skill, task, criterion, band and the skill/task pairing", async () => {
    await expectViolation(descriptor({ skill: "reading" }), /band_descriptors_skill_valid/);
    await expectViolation(descriptor({ task: "task3" }), /band_descriptors_task_valid/);
    await expectViolation(descriptor({ task: null }), /band_descriptors_task_matches_skill/);
    await expectViolation(descriptor({ skill: "speaking", task: "task2", criterion_key: "FC" }), /band_descriptors_task_matches_skill/);
    await expectViolation(descriptor({ criterion_key: "FC", band: 5 }), /band_descriptors_criterion_valid/);
    await expectViolation(descriptor({ skill: "speaking", task: null, criterion_key: "TR" }), /band_descriptors_criterion_valid/);
    await expectViolation(descriptor({ band: 10, criterion_key: "CC" }), /band_descriptors_band_valid/);
    await expectViolation(descriptor({ text_en: " ", criterion_key: "LR" }), /band_descriptors_text_present/);
  });
});

describe("band_conversion_tables", () => {
  const row = (fields = {}) => insert(db, "band_conversion_tables", {
    skill: "listening", raw_min: 30, raw_max: 31, band: 7, source: "ielts.org", version: "v-test", ...fields,
  });

  it("is unique per skill/band/version and stores half bands", async () => {
    const first = await row({ version: "v1" });
    expect(first.band).toBe("7.0");
    await expectViolation(row({ version: "v1", raw_min: 5, raw_max: 6 }), /band_conversion_tables_skill_band_version_key/);
    await row({ version: "v1", band: 6.5, raw_min: 26, raw_max: 29 });
  });

  it("validates skill, band, raw range and verified date", async () => {
    await expectViolation(row({ skill: "writing" }), /band_conversion_tables_skill_valid/);
    await expectViolation(row({ band: 7.25 }), /band_conversion_tables_band_valid/);
    await expectViolation(row({ raw_min: 31, raw_max: 30 }), /band_conversion_tables_raw_range_valid/);
    await expectViolation(row({ raw_max: 41 }), /band_conversion_tables_raw_range_valid/);
    expect((await row({ version: "v2", verified_on: "2026-11-10" })).verified_on).toBeInstanceOf(Date);
  });

  it("refuses overlapping raw ranges within a skill and version", async () => {
    await row({ skill: "reading_academic", version: "ov", band: 7, raw_min: 30, raw_max: 32 });
    await expectViolation(row({ skill: "reading_academic", version: "ov", band: 6.5, raw_min: 32, raw_max: 34 }), /band_conversion_tables_overlap/);
    await row({ skill: "reading_academic", version: "ov", band: 6.5, raw_min: 27, raw_max: 29 });
    await row({ skill: "reading_general", version: "ov", band: 6.5, raw_min: 31, raw_max: 33 });
    await expectViolation(
      db.query("update band_conversion_tables set raw_min = 28 where skill = 'reading_academic' and version = 'ov' and band = 7"),
      /band_conversion_tables_overlap/,
    );
  });
});
