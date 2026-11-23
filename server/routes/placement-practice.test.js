import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestApp, freshPhone } from "../test-support/http-app.js";
import { scaleRaw, bandForRaw, BAND_RANGES } from "../services/band-tables.js";
import { tehranMonthKey } from "../core/tehran-time.js";

let t;
beforeAll(async () => {
  t = await createTestApp();
});
afterAll(() => t.close());

async function learner(examType = "academic") {
  const phone = freshPhone();
  const device = t.client();
  const signed = await t.signUp(device, phone);
  await t.db.query(
    `insert into learner_profiles (user_id, exam_type, exam_date_precision, daily_minutes, study_days, onboarding_completed_at)
     values ($1, $2, 'unknown', 30, '{6}', now())`,
    [signed.json.user.id, examType],
  );
  return { device, userId: signed.json.user.id };
}

describe("objective scaling", () => {
  it("maps a short paper onto the 40-point table without inventing a gap", () => {
    expect(scaleRaw(2, 4)).toBe(20);
    expect(bandForRaw(BAND_RANGES.listening, 20)).toBe(5.5);
    expect(bandForRaw(BAND_RANGES.listening, 40)).toBe(9);
  });
});

describe("placement and practice gates", () => {
  it("seeds an original placement when the bank is empty", async () => {
    const { device } = await learner();
    const res = await device.request("POST", "/api/placement/attempts");
    expect(res.status).toBe(201);
    const id = res.json.attemptId;
    expect((await device.request("POST", `/api/placement/attempts/${id}/skills/listening/start`)).status).toBe(200);
    const paper = await device.request("GET", `/api/placement/attempts/${id}/skills/listening`);
    const text = JSON.stringify(paper.json);
    expect(text.toLowerCase()).not.toMatch(/cambridge|ielts\.org/);
    expect(text).toContain("quiet room");
    const view = await device.request("GET", `/api/placement/attempts/${id}`);
    expect(view.json.skills.map((row) => row.timeLimitSec)).toEqual([12 * 60, 16 * 60, 15 * 60, 12 * 60]);

    expect((await device.request("POST", `/api/placement/attempts/${id}/skills/reading/start`)).status).toBe(200);
    const reading = await device.request("GET", `/api/placement/attempts/${id}/skills/reading`);
    expect(reading.json.items).toHaveLength(2);
    for (const item of reading.json.items) {
      expect(item.stem.options.map((option) => option.toLowerCase())).toEqual(["true", "false", "not given"]);
    }
    const keys = await t.db.query(
      `select stem->>'prompt' as prompt, answer_key->>'correct' as correct
       from content_items where question_type = 'placement_tfng' and exam_type = 'academic'`,
    );
    expect(keys.rows.find((row) => /ball games/i.test(row.prompt)).correct.toLowerCase()).toBe("false");
    expect(keys.rows.some((row) => row.correct.toLowerCase() === "not given")).toBe(true);
    expect(JSON.stringify(reading.json).toLowerCase()).not.toMatch(/cambridge|ielts\.org/);

    expect((await device.request("POST", `/api/placement/attempts/${id}/skills/writing/start`)).status).toBe(200);
    const writing = await device.request("GET", `/api/placement/attempts/${id}/skills/writing`);
    const stem = writing.json.items[0].stem.prompt;
    expect(stem.toLowerCase()).toMatch(/table|chart|process/);
    expect(stem.toLowerCase()).not.toMatch(/routine|advice|evenings|opinion/);

    const general = await learner("general");
    const generalAttempt = await general.device.request("POST", "/api/placement/attempts");
    const generalId = generalAttempt.json.attemptId;
    expect((await general.device.request("POST", `/api/placement/attempts/${generalId}/skills/writing/start`)).status).toBe(200);
    const letter = await general.device.request("GET", `/api/placement/attempts/${generalId}/skills/writing`);
    expect(letter.json.items[0].stem.prompt.toLowerCase()).toMatch(/letter/);
  });

  it("locks a paid practice set and scores a published free listening set", async () => {
    const { device, userId } = await learner();
    await t.db.query(
      `insert into question_types (key, skill, name_fa, name_en, official_description)
       values ('listening_form', 'listening', 'فرم', 'Form', 'Complete the form from the recording.')
       on conflict (key) do nothing`,
    );
    const item = await t.db.query(
      `insert into content_items (skill, exam_type, question_type, stem, answer_key, status, is_free, reviewed_at, created_by)
       values ('listening', 'academic', 'listening_form', '{"prompt":"The meeting is in the ____."}'::jsonb,
               '{"correct":"hall"}'::jsonb, 'published', true, now(), $1) returning id`,
      [userId],
    );
    const paid = await t.db.query(
      `insert into practice_sets (kind, skill, exam_type, part_no, title_fa, title_en, time_limit_sec, est_minutes, is_free, status, reviewed_at)
       values ('exam_part', 'listening', 'academic', 2, 'بخش پولی', 'Paid part', 600, 10, false, 'published', now()) returning id`,
    );
    const free = await t.db.query(
      `insert into practice_sets (kind, skill, exam_type, question_type, title_fa, title_en, est_minutes, is_free, status, reviewed_at)
       values ('skill_set', 'listening', 'academic', 'listening_form', 'فرم رایگان', 'Free form', 12, true, 'published', now()) returning id`,
    );
    await t.db.query("insert into practice_set_items (set_id, item_id) values ($1, $2)", [free.rows[0].id, item.rows[0].id]);

    const list = await device.request("GET", "/api/practice/sets");
    const locked = list.json.sets.find((set) => set.id === paid.rows[0].id);
    expect(locked.locked).toBe(true);
    expect((await device.request("POST", `/api/practice/sets/${paid.rows[0].id}/attempts`)).status).toBe(403);

    const started = await device.request("POST", `/api/practice/sets/${free.rows[0].id}/attempts`);
    expect(started.status).toBe(201);
    expect(started.json.items[0].answerKey).toBeUndefined();
    const submitted = await device.request("POST", `/api/practice/attempts/${started.json.attemptId}/submit`, {
      body: { answers: [{ itemId: item.rows[0].id, value: "hall" }] },
    });
    expect(submitted.status).toBe(200);
    expect(submitted.json.raw).toBe(1);
    expect(submitted.json.band).toBe(9);
    expect(submitted.json.label).toBe("AI estimate, not official");
  });
});

describe("placement runner", () => {
  async function publishedPlacement(userId) {
    await t.db.query(
      `insert into question_types (key, skill, name_fa, name_en, official_description)
       values ('listening_note', 'listening', 'یادداشت', 'Note', 'Complete the notes.'),
              ('reading_tfng', 'reading', 'درست/نادرست', 'TFNG', 'True, false or not given.')
       on conflict (key) do nothing`,
    );
    const version = await t.db.query(
      `insert into placement_versions (exam_type, version_no, status, reviewed_at)
       values ('academic', (select coalesce(max(version_no), 0) + 1 from placement_versions), 'published', now()) returning id`,
    );
    const items = [];
    for (const [skill, qt, correct] of [["listening", "listening_note", "hall"], ["listening", "listening_note", "monday"], ["reading", "reading_tfng", "true"]]) {
      items.push({ skill, id: (await t.db.query(
        `insert into content_items (skill, exam_type, question_type, stem, answer_key, status, is_free, reviewed_at, created_by)
         values ($1, 'academic', $2, '{"prompt":"Q"}'::jsonb, $3::jsonb, 'published', true, now(), $4) returning id`,
        [skill, qt, JSON.stringify({ correct }), userId],
      )).rows[0].id });
    }
    for (const [sort, skill] of ["listening", "reading"].entries()) {
      const section = await t.db.query(
        "insert into placement_sections (version_id, skill, time_limit_sec, sort) values ($1, $2, 600, $3) returning id",
        [version.rows[0].id, skill, sort],
      );
      for (const item of items.filter((i) => i.skill === skill)) {
        await t.db.query("insert into placement_section_items (section_id, item_id) values ($1, $2)", [section.rows[0].id, item.id]);
      }
    }
    return { versionId: version.rows[0].id, items };
  }

  it("reloads an attempt and finishes listening even when no answer was saved", async () => {
    const { device, userId } = await learner();
    const { versionId, items } = await publishedPlacement(userId);
    try {
      const started = await device.request("POST", "/api/placement/attempts");
      expect(started.status).toBe(201);
      const id = started.json.attemptId;

      const reload = await device.request("GET", `/api/placement/attempts/${id}`);
      expect(reload.status).toBe(200);
      expect(reload.json.skills.map((s) => s.skill)).toEqual(["listening", "reading"]);
      expect(reload.json.skills[0].timeLimitSec).toBe(600);

      expect((await device.request("POST", `/api/placement/attempts/${id}/skills/listening/start`)).status).toBe(200);
      const done = await device.request("POST", `/api/placement/attempts/${id}/skills/listening/complete`);
      expect(done.status).toBe(200);
      const after = await device.request("GET", `/api/placement/attempts/${id}`);
      expect(after.json.skills[0]).toMatchObject({ status: "completed", rawScore: 0, maxScore: 2 });

      expect((await device.request("POST", `/api/placement/attempts/${id}/skills/reading/start`)).status).toBe(200);
      const readingItem = items.find((i) => i.skill === "reading").id;
      await device.request("PUT", `/api/placement/attempts/${id}/skills/reading/answers`, { body: { itemId: readingItem, value: "TRUE" } });
      expect((await device.request("POST", `/api/placement/attempts/${id}/skills/reading/complete`)).status).toBe(200);
      const final = await device.request("GET", `/api/placement/attempts/${id}`);
      expect(final.json.status).toBe("completed");
      expect(final.json.skills[1]).toMatchObject({ rawScore: 1, maxScore: 1 });
    } finally {
      await t.db.query("update placement_versions set status = 'draft' where id = $1", [versionId]);
    }
  });

  it("uses Quick and Full clocks, plays listening once, and resumes the open attempt", async () => {
    const quick = await learner();
    const full = await learner();
    await t.db.query("update learner_profiles set placement_mode = 'quick' where user_id = $1", [quick.userId]);
    await t.db.query("update learner_profiles set placement_mode = 'full' where user_id = $1", [full.userId]);
    const { versionId } = await publishedPlacement(quick.userId);
    try {
      const started = await quick.device.request("POST", "/api/placement/attempts");
      const id = started.json.attemptId;
      const view = await quick.device.request("GET", `/api/placement/attempts/${id}`);
      expect(view.json.mode).toBe("quick");
      expect(view.json.skills.map((row) => row.timeLimitSec)).toEqual([5 * 60, 6 * 60]);
      const began = await quick.device.request("POST", `/api/placement/attempts/${id}/skills/listening/start`);
      const deadline = new Date(began.json.deadlineAt).getTime();
      expect(Math.abs(deadline - (t.clock.now().getTime() + 5 * 60 * 1000))).toBeLessThan(2000);

      const fullStart = await full.device.request("POST", "/api/placement/attempts");
      const fullView = await full.device.request("GET", `/api/placement/attempts/${fullStart.json.attemptId}`);
      expect(fullView.json.mode).toBe("full");
      expect(fullView.json.skills.map((row) => row.timeLimitSec)).toEqual([12 * 60, 16 * 60]);

      expect((await quick.device.request("POST", `/api/placement/attempts/${id}/listening/audio`)).status).toBe(200);
      const again = await quick.device.request("POST", `/api/placement/attempts/${id}/listening/audio`);
      expect(again.json.started).toBe(true);
      const hidden = await quick.device.request("GET", `/api/placement/attempts/${id}/skills/listening`);
      expect(hidden.json.items.every((item) => item.audioId == null)).toBe(true);
      const current = await quick.device.request("GET", "/api/placement/current");
      expect(current.json.attempt.id).toBe(id);
    } finally {
      await t.db.query("update placement_versions set status = 'draft' where id = $1", [versionId]);
    }
  });
});

describe("free vs premium practice", () => {
  async function writingSet(partNo, userId) {
    await t.db.query(
      `insert into question_types (key, skill, name_fa, name_en, official_description)
       values ('writing_task', 'writing', 'رایتینگ', 'Writing', 'Write a response.') on conflict (key) do nothing`,
    );
    const item = await t.db.query(
      `insert into content_items (skill, exam_type, question_type, part_no, stem, status, is_free, reviewed_at, created_by)
       values ('writing', 'academic', 'writing_task', $1, '{"prompt":"Describe the chart."}'::jsonb, 'published', true, now(), $2) returning id`,
      [partNo, userId],
    );
    const set = await t.db.query(
      `insert into practice_sets (kind, skill, exam_type, part_no, title_fa, title_en, time_limit_sec, est_minutes, is_free, status, reviewed_at)
       values ('exam_part', 'writing', 'academic', $1, 'رایتینگ', 'Writing', 1200, 20, false, 'published', now()) returning id`,
      [partNo],
    );
    await t.db.query("insert into practice_set_items (set_id, item_id) values ($1, $2)", [set.rows[0].id, item.rows[0].id]);
    return { setId: set.rows[0].id, itemId: item.rows[0].id };
  }

  async function makePremium(userId) {
    await t.db.query(
      `insert into subscriptions (user_id, plan_key, status, source, reason, started_at, ends_at)
       values ($1, 'premium_monthly', 'active', 'manual', 'test', now(), now() + interval '30 days')`,
      [userId],
    );
  }

  it("opens part 1 to free learners, locks later parts with an upgrade hint, and opens all for premium", async () => {
    const { device, userId } = await learner();
    const task1 = await writingSet(1, userId);
    const task2 = await writingSet(2, userId);
    const list = await device.request("GET", "/api/practice/sets");
    expect(list.json.maxPart).toBe(1);
    expect(list.json.sets.find((s) => s.id === task1.setId).locked).toBe(false);
    expect(list.json.sets.find((s) => s.id === task2.setId).locked).toBe(true);
    const refused = await device.request("POST", `/api/practice/sets/${task2.setId}/attempts`);
    expect(refused.status).toBe(403);
    expect(refused.json.error.details).toMatchObject({ upgrade: "/app/subscription", reason: "premium_part" });

    const premium = await learner();
    await makePremium(premium.userId);
    const premiumList = await premium.device.request("GET", "/api/practice/sets");
    expect(premiumList.json.maxPart).toBeNull();
    expect(premiumList.json.sets.find((s) => s.id === task2.setId).locked).toBe(false);
    expect((await premium.device.request("POST", `/api/practice/sets/${task2.setId}/attempts`)).status).toBe(201);
  });

  it("stops AI writing scoring at the free monthly quota before saving anything", async () => {
    const { device, userId } = await learner();
    const { setId, itemId } = await writingSet(1, userId);
    await t.db.query(
      `insert into ai_usage_counters (user_id, quota_key, period, used)
       values ($1, 'writing_scoring', $2, 2)`,
      [userId, tehranMonthKey(t.clock.now())],
    );
    const started = await device.request("POST", `/api/practice/sets/${setId}/attempts`);
    // A configured key makes the route reserve quota; the 402 comes before any network call.
    const previous = process.env.AVALAI_API_KEY;
    process.env.AVALAI_API_KEY = "test-key";
    let submitted;
    try {
      submitted = await device.request("POST", `/api/practice/attempts/${started.json.attemptId}/submit`, {
        body: { answers: [{ itemId, value: "The chart shows a steady rise in sales." }] },
      });
    } finally {
      if (previous === undefined) delete process.env.AVALAI_API_KEY;
      else process.env.AVALAI_API_KEY = previous;
    }
    expect(submitted.status).toBe(402);
    expect(submitted.json.error.code).toBe("quota_exhausted");
    expect(submitted.json.error.details).toMatchObject({ quotaKey: "writing_scoring", limit: 2 });
    const saved = await t.db.query("select count(*)::int as n from practice_answers where attempt_id = $1", [started.json.attemptId]);
    expect(saved.rows[0].n).toBe(0);
  });
});

describe("placement result and plan", () => {
  it("rounds the demo bands to 5.5 and writes a plan only when asked", async () => {
    const { device, userId } = await learner();
    await t.db.query(
      `update learner_profiles set target_band = 6.5, exam_date = '2027-03-06', exam_date_precision = 'exact' where user_id = $1`,
      [userId],
    );
    const version = await t.db.query(
      `insert into placement_versions (exam_type, version_no, status, reviewed_at)
       values ('academic', (select coalesce(max(version_no), 0) + 1 from placement_versions), 'published', now()) returning id`,
    );
    const attempt = await t.db.query(
      `insert into placement_attempts (user_id, version_id, status, completed_at, overall_band, placement_mode)
       values ($1, $2, 'completed', now(), 9, 'full') returning id`,
      [userId, version.rows[0].id],
    );
    for (const [skill, band] of [["listening", 6], ["reading", 5.5], ["writing", 5], ["speaking", 5.5]]) {
      await t.db.query(
        `insert into placement_skill_attempts (attempt_id, skill, status, started_at, deadline_at, completed_at, band)
         values ($1, $2, 'completed', now(), now(), now(), $3)`,
        [attempt.rows[0].id, skill, band],
      );
    }
    const before = await t.db.query("select count(*)::int as n from study_plans where user_id = $1", [userId]);
    const result = await device.request("GET", "/api/placement/result");
    expect(result.status).toBe(200);
    expect(result.json.overall).toBe(5.5);
    expect(result.json.gap).toBe(1);
    expect(result.json.estimate).toBe(true);
    expect(result.json.official).toBe(false);
    expect(result.json.skills.find((row) => row.skill === "writing").note).toBe("weak");
    expect(result.json.skills.find((row) => row.skill === "listening").note).toBe("strength");
    const idle = await device.request("GET", "/api/plan");
    expect(idle.json.plan).toBeNull();
    expect((await t.db.query("select count(*)::int as n from study_plans where user_id = $1", [userId])).rows[0].n).toBe(before.rows[0].n);

    const saved = await device.request("POST", "/api/placement/plan");
    expect(saved.status).toBe(201);
    expect(saved.json).toMatchObject({ chapterFrom: 5.5, chapterTo: 6, lessons: 3, days: 5, priority: ["writing", "reading", "speaking", "listening"] });
    const again = await device.request("GET", "/api/placement/result");
    const current = await device.request("GET", "/api/plan");
    expect(current.json.plan.id).toBe(saved.json.id);
    expect(again.json.overall).toBe(5.5);
    expect((await t.db.query("select count(*)::int as n from study_plans where user_id = $1 and status = 'active'", [userId])).rows[0].n).toBe(1);
  });
});
