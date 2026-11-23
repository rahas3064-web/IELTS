// Placement runner. Only published versions and items. Writing/speaking do not use the monthly quota.
import express from "express";
import { ApiError } from "../core/errors.js";
import { parseBody, v } from "../core/validate.js";
import { scoreCriteria } from "../avalai.js";
import { addDays, daysBetween, tehranDay, tehranWeekStart } from "../core/tehran-time.js";
import { ensureBandTables, lookupBand, scaleRaw } from "../services/band-tables.js";
import { publicItem } from "../services/content-bank.js";
import { overallBand } from "./mocks.js";
import { wrap } from "./util.js";

const SKILLS = ["listening", "reading", "writing", "speaking"];
const answerSchema = v.object({ itemId: v.string({ min: 36, max: 36 }), value: v.string({ min: 0, max: 8000 }) });
const modeSchema = v.object({ mode: v.oneOf(["quick", "full"]) });

/** Bandora placement clocks in seconds. Not official IELTS timings. */
export const PLACEMENT_LIMITS_SEC = {
  quick: { listening: 5 * 60, reading: 6 * 60, writing: 5 * 60, speaking: 4 * 60 },
  full: { listening: 12 * 60, reading: 16 * 60, writing: 15 * 60, speaking: 12 * 60 },
};

function limitFor(mode, skill, sectionSec) {
  const table = PLACEMENT_LIMITS_SEC[mode];
  return table?.[skill] ?? sectionSec;
}

/** Original catalogue used only when that exam type has no published placement. */
async function ensureOriginalPlacement(db, examType) {
  const existing = await db.query(
    `select id from placement_versions
     where exam_type = $1 and status = 'published' and not is_dev_fixture limit 1`,
    [examType],
  );
  if (existing.rows[0]) return;
  await db.query(
    `insert into question_types (key, skill, name_fa, name_en, official_description) values
       ('placement_note', 'listening', 'یادداشت', 'Note', 'Bandora placement note.'),
       ('placement_tfng', 'reading', 'درست یا نادرست', 'True or false', 'Bandora placement statement.'),
       ('placement_write', 'writing', 'نوشتن', 'Writing', 'Bandora placement writing task.'),
       ('placement_cue', 'speaking', 'کارت موضوع', 'Cue', 'Bandora placement speaking cue.')
     on conflict (key) do nothing`,
  );
  const writingPrompt = examType === "general"
    ? "Write a letter to your building manager about a stair light that has been out since Monday. Say what you need them to do."
    : "The table below is invented for this placement. Desk A lent 12 books on Monday and 30 on Friday. Desk B lent 8 books on Monday and 8 on Friday. Describe the main numbers in the table.";
  const passage = "The north courtyard garden opened last spring. Residents water it on Fridays. The benches are free, but ball games are not allowed.";
  const script = "Neda works at a small city library. She tells a visitor that the quiet room closes at seven, and that laptops are welcome after three.";
  const tfng = ["True", "False", "Not Given"];
  const skills = [
    ["listening", "placement_note", null, [{
      stem: {
        prompt: "When does the quiet room close?",
        promptEn: "When does the quiet room close?",
        script,
        options: ["at three", "at seven", "at nine"],
      },
      answerKey: { correct: "at seven" },
    }]],
    ["reading", "placement_tfng", null, [
      {
        stem: {
          prompt: "Ball games are allowed in the garden.",
          promptEn: "Ball games are allowed in the garden.",
          passage,
          options: tfng,
        },
        answerKey: { correct: "False" },
      },
      {
        stem: {
          prompt: "The garden has a pond.",
          promptEn: "The garden has a pond.",
          passage,
          options: tfng,
        },
        answerKey: { correct: "Not Given" },
      },
    ]],
    ["writing", "placement_write", 1, [{ stem: { prompt: writingPrompt, promptEn: writingPrompt }, answerKey: null }]],
    ["speaking", "placement_cue", 2, [{
      stem: {
        prompt: "Describe a quiet place in your neighbourhood where you study.",
        promptEn: "Describe a quiet place in your neighbourhood where you study.",
        cue: "Say where it is, when you go there, and why you like it.",
      },
      answerKey: null,
    }]],
  ];
  const version = await db.query(
    `insert into placement_versions (exam_type, version_no, status, reviewed_at)
     values ($1, (select coalesce(max(version_no), 0) + 1 from placement_versions where exam_type = $1), 'published', now())
     returning id`,
    [examType],
  );
  let sort = 0;
  for (const [skill, questionType, partNo, items] of skills) {
    const section = await db.query(
      `insert into placement_sections (version_id, skill, time_limit_sec, sort)
       values ($1, $2, $3, $4) returning id`,
      [version.rows[0].id, skill, PLACEMENT_LIMITS_SEC.full[skill], sort],
    );
    sort += 1;
    for (const [itemSort, item] of items.entries()) {
      const saved = await db.query(
        `insert into content_items (skill, exam_type, question_type, part_no, stem, answer_key, status, is_free, reviewed_at)
         values ($1, $2, $3, $4, $5::jsonb, $6::jsonb, 'published', true, now()) returning id`,
        [skill, examType, questionType, partNo, JSON.stringify(item.stem), item.answerKey ? JSON.stringify(item.answerKey) : null],
      );
      await db.query(
        "insert into placement_section_items (section_id, item_id, sort) values ($1, $2, $3)",
        [section.rows[0].id, saved.rows[0].id, itemSort],
      );
    }
  }
}

function learnerItem(row, reveal) {
  const item = publicItem(row);
  if (!reveal) return item;
  return { ...item, answerKey: row.answer_key, correct: row.is_correct };
}

/** @param {ReturnType<import("../auth/context.js").createAuthContext>} ctx */
export function placementRoutes(ctx, { score = scoreCriteria } = {}) {
  const router = express.Router();
  const auth = ctx.requireUser();

  async function publishedVersion(examType) {
    const { rows } = await ctx.db.query(
      `select id, exam_type from placement_versions
       where status = 'published' and not is_dev_fixture and exam_type = $1
       order by version_no desc limit 1`,
      [examType],
    );
    return rows[0] ?? null;
  }

  async function loadAttempt(userId, id) {
    const { rows } = await ctx.db.query(
      `select a.*, v.exam_type from placement_attempts a
       join placement_versions v on v.id = a.version_id
       where a.id = $1 and a.user_id = $2 and v.status = 'published'`,
      [id, userId],
    );
    return rows[0] ?? null;
  }

  router.get(
    "/placement/current",
    auth,
    wrap(async (req, res) => {
      const { rows } = await ctx.db.query(
        `select id, status, overall_band from placement_attempts
         where user_id = $1 and status = 'in_progress' limit 1`,
        [req.user.id],
      );
      res.json({ attempt: rows[0] ?? null });
    }),
  );

  router.post(
    "/placement/attempts",
    ctx.originGuard,
    auth,
    wrap(async (req, res) => {
      const profile = await ctx.db.query(
        "select exam_type, placement_mode from learner_profiles where user_id = $1",
        [req.user.id],
      );
      const examType = profile.rows[0]?.exam_type;
      if (!examType) throw new ApiError(409, "conflict", { fa: "اول آنبوردینگ را تمام کن.", en: "Finish onboarding first." });
      const requested = req.body && typeof req.body.mode === "string" ? parseBody(modeSchema, { mode: req.body.mode }).mode : null;
      const mode = requested ?? profile.rows[0]?.placement_mode ?? null;
      await ensureOriginalPlacement(ctx.db, examType);
      const version = await publishedVersion(examType);
      if (!version) {
        throw new ApiError(404, "not_found", {
          fa: "تعیین سطح منتشرشده‌ای وجود ندارد.",
          en: "No published placement is available.",
        });
      }
      const open = await ctx.db.query(
        "select id from placement_attempts where user_id = $1 and status = 'in_progress'",
        [req.user.id],
      );
      if (open.rows[0]) {
        res.json({ attemptId: open.rows[0].id, resumed: true });
        return;
      }
      const created = await ctx.db.transaction(async (tx) => {
        const attempt = await tx.query(
          `insert into placement_attempts (user_id, version_id, placement_mode) values ($1, $2, $3) returning id`,
          [req.user.id, version.id, mode],
        );
        const sections = await tx.query(
          "select skill from placement_sections where version_id = $1",
          [version.id],
        );
        for (const section of sections.rows) {
          await tx.query(
            "insert into placement_skill_attempts (attempt_id, skill) values ($1, $2)",
            [attempt.rows[0].id, section.skill],
          );
        }
        return attempt.rows[0].id;
      });
      res.status(201).json({ attemptId: created, resumed: false });
    }),
  );

  router.get(
    "/placement/attempts/:id",
    auth,
    wrap(async (req, res) => {
      const attempt = await loadAttempt(req.user.id, req.params.id);
      if (!attempt) throw new ApiError(404, "not_found");
      const skills = await ctx.db.query(
        `select sa.skill, sa.status, sa.band, sa.raw_score, sa.max_score, sa.audio_started_at, sa.deadline_at, s.time_limit_sec
         from placement_skill_attempts sa
         join placement_sections s on s.version_id = $2 and s.skill = sa.skill
         where sa.attempt_id = $1 order by s.sort`,
        [attempt.id, attempt.version_id],
      );
      res.json({
        id: attempt.id,
        status: attempt.status,
        mode: attempt.placement_mode ?? null,
        overallBand: attempt.overall_band,
        label: attempt.status === "completed" ? "estimate, not an official IELTS score" : null,
        skills: skills.rows.map((row) => ({
          skill: row.skill,
          status: row.status,
          band: row.band == null ? null : Number(row.band),
          rawScore: row.raw_score,
          maxScore: row.max_score,
          timeLimitSec: limitFor(attempt.placement_mode, row.skill, row.time_limit_sec),
          deadlineAt: row.deadline_at,
          audioStarted: Boolean(row.audio_started_at),
        })),
      });
    }),
  );

  router.get(
    "/placement/attempts/:id/skills/:skill",
    auth,
    wrap(async (req, res) => {
      if (!SKILLS.includes(req.params.skill)) throw new ApiError(404, "not_found");
      const attempt = await loadAttempt(req.user.id, req.params.id);
      if (!attempt) throw new ApiError(404, "not_found");
      const skill = await ctx.db.query(
        "select id, status, audio_started_at from placement_skill_attempts where attempt_id = $1 and skill = $2",
        [attempt.id, req.params.skill],
      );
      const row = skill.rows[0];
      if (!row || row.status === "not_started") {
        throw new ApiError(409, "conflict", { fa: "اول این مهارت را شروع کن.", en: "Start this skill first." });
      }
      const items = await ctx.db.query(
        `select i.id, i.skill, i.exam_type, i.question_type, i.part_no, i.stem, i.is_free, i.audio_id, i.passage_id,
                i.answer_key, a.answer, a.is_correct
         from placement_section_items psi
         join placement_sections s on s.id = psi.section_id
         join content_items i on i.id = psi.item_id
         left join placement_answers a on a.skill_attempt_id = $2 and a.item_id = i.id
         where s.version_id = $1 and s.skill = $3 and i.status = 'published' and not i.is_dev_fixture
         order by psi.sort`,
        [attempt.version_id, row.id, req.params.skill],
      );
      const reveal = row.status === "completed";
      res.json({
        items: items.rows.map((item) => {
          const shown = learnerItem(item, reveal);
          shown.savedValue = item.answer?.value ?? "";
          if (req.params.skill === "listening" && row.audio_started_at) shown.audioId = null;
          return shown;
        }),
      });
    }),
  );

  router.post(
    "/placement/attempts/:id/skills/:skill/start",
    ctx.originGuard,
    auth,
    wrap(async (req, res) => {
      const attempt = await loadAttempt(req.user.id, req.params.id);
      if (!attempt || attempt.status !== "in_progress") throw new ApiError(404, "not_found");
      const section = await ctx.db.query(
        "select time_limit_sec from placement_sections where version_id = $1 and skill = $2",
        [attempt.version_id, req.params.skill],
      );
      if (!section.rows[0]) throw new ApiError(404, "not_found");
      const at = ctx.now();
      const seconds = limitFor(attempt.placement_mode, req.params.skill, section.rows[0].time_limit_sec);
      const deadline = new Date(at.getTime() + seconds * 1000);
      const { rows } = await ctx.db.query(
        `update placement_skill_attempts
         set status = 'in_progress', started_at = coalesce(started_at, $3), deadline_at = coalesce(deadline_at, $4)
         where attempt_id = $1 and skill = $2 and status in ('not_started', 'in_progress')
         returning id, deadline_at`,
        [attempt.id, req.params.skill, at, deadline],
      );
      if (!rows[0]) throw new ApiError(409, "conflict");
      res.json({ deadlineAt: rows[0].deadline_at });
    }),
  );

  router.post(
    "/placement/attempts/:id/listening/audio",
    ctx.originGuard,
    auth,
    wrap(async (req, res) => {
      const attempt = await loadAttempt(req.user.id, req.params.id);
      if (!attempt) throw new ApiError(404, "not_found");
      const { rows } = await ctx.db.query(
        `update placement_skill_attempts set audio_started_at = coalesce(audio_started_at, $2)
         where attempt_id = $1 and skill = 'listening' returning audio_started_at`,
        [attempt.id, ctx.now()],
      );
      res.json({ started: true, at: rows[0]?.audio_started_at ?? null });
    }),
  );

  router.put(
    "/placement/attempts/:id/skills/:skill/answers",
    ctx.originGuard,
    auth,
    wrap(async (req, res) => {
      const body = parseBody(answerSchema, req.body);
      const attempt = await loadAttempt(req.user.id, req.params.id);
      if (!attempt) throw new ApiError(404, "not_found");
      const skill = await ctx.db.query(
        "select id, status from placement_skill_attempts where attempt_id = $1 and skill = $2",
        [attempt.id, req.params.skill],
      );
      if (skill.rows[0]?.status !== "in_progress") throw new ApiError(409, "conflict");
      await ctx.db.query(
        `insert into placement_answers (skill_attempt_id, item_id, answer)
         values ($1, $2, $3::jsonb)
         on conflict (skill_attempt_id, item_id) do update set answer = excluded.answer, answered_at = now()`,
        [skill.rows[0].id, body.itemId, JSON.stringify({ value: body.value })],
      );
      res.json({ ok: true });
    }),
  );

  router.post(
    "/placement/attempts/:id/skills/:skill/complete",
    ctx.originGuard,
    auth,
    wrap(async (req, res) => {
      const attempt = await loadAttempt(req.user.id, req.params.id);
      if (!attempt) throw new ApiError(404, "not_found");
      const skillRow = await ctx.db.query(
        "select id, status from placement_skill_attempts where attempt_id = $1 and skill = $2",
        [attempt.id, req.params.skill],
      );
      if (skillRow.rows[0]?.status !== "in_progress") throw new ApiError(409, "conflict");
      const answers = await ctx.db.query(
        `select a.id, a.answer, i.answer_key, i.stem, i.skill, i.part_no
         from placement_answers a join content_items i on i.id = a.item_id
         where a.skill_attempt_id = $1`,
        [skillRow.rows[0].id],
      );
      let band = null;
      let raw = null;
      let max = null;
      if (req.params.skill === "listening" || req.params.skill === "reading") {
        await ensureBandTables(ctx.db);
        // The paper is every published item of the section; an unanswered item counts as wrong.
        // (Counting only saved answers gave max_score = 0 when nothing was saved, which the
        // placement_skill_attempts_scores_valid check rejects, so the skill could never finish.)
        const paper = await ctx.db.query(
          `select count(*)::int as n
           from placement_section_items psi
           join placement_sections s on s.id = psi.section_id
           join content_items i on i.id = psi.item_id
           where s.version_id = $1 and s.skill = $2 and i.status = 'published' and not i.is_dev_fixture`,
          [attempt.version_id, req.params.skill],
        );
        let correctCount = 0;
        for (const answer of answers.rows) {
          const expected = String(answer.answer_key?.correct ?? "").trim().toLowerCase();
          const given = String(answer.answer?.value ?? "").trim().toLowerCase();
          const correct = expected !== "" && expected === given;
          if (correct) correctCount += 1;
          await ctx.db.query("update placement_answers set is_correct = $2 where id = $1", [answer.id, correct]);
        }
        const total = Math.max(Number(paper.rows[0]?.n ?? 0), answers.rows.length);
        if (total > 0) {
          max = total;
          raw = Math.min(correctCount, total);
          band = await lookupBand(ctx.db, req.params.skill, scaleRaw(raw, max));
        }
      } else {
        const answer = answers.rows[0];
        let scored = null;
        try {
          scored = await score({
            skill: req.params.skill,
            prompt: answer?.stem?.prompt ?? "",
            answer: answer?.answer?.value ?? "",
            partNo: answer?.part_no ?? null,
          });
        } catch (error) {
          if (error?.code !== "missing_ai") throw error;
          scored = null;
        }
        band = scored?.band ?? null;
      }
      await ctx.db.query(
        `update placement_skill_attempts
         set status = 'completed', completed_at = $2, raw_score = $3, max_score = $4, band = $5
         where id = $1`,
        [skillRow.rows[0].id, ctx.now(), raw, max, band],
      );
      const pending = await ctx.db.query(
        "select 1 from placement_skill_attempts where attempt_id = $1 and status <> 'completed'",
        [attempt.id],
      );
      if (pending.rows.length === 0) {
        const bands = await ctx.db.query(
          "select band from placement_skill_attempts where attempt_id = $1",
          [attempt.id],
        );
        const values = bands.rows.map((row) => (row.band == null ? null : Number(row.band)));
        const overall = overallBand(values);
        await ctx.db.query(
          "update placement_attempts set status = 'completed', completed_at = $2, overall_band = $3 where id = $1",
          [attempt.id, ctx.now(), overall],
        );
      }
      res.json({ band, estimate: true, official: false });
    }),
  );

  const SKILL_ORDER = ["listening", "reading", "writing", "speaking"];

  async function latestResult(userId, now) {
    const attempt = await ctx.db.query(
      `select a.id, a.overall_band from placement_attempts a
       where a.user_id = $1 and a.status = 'completed'
       order by a.completed_at desc limit 1`,
      [userId],
    );
    if (!attempt.rows[0]) return null;
    const skills = await ctx.db.query(
      "select skill, band from placement_skill_attempts where attempt_id = $1",
      [attempt.rows[0].id],
    );
    const bySkill = new Map(skills.rows.map((row) => [row.skill, row.band == null ? null : Number(row.band)]));
    const ordered = SKILL_ORDER.map((skill) => ({ skill, band: bySkill.has(skill) ? bySkill.get(skill) : null }));
    const overall = overallBand(ordered.map((row) => row.band));
    const known = ordered.filter((row) => row.band != null).map((row) => row.band);
    const top = known.length ? Math.max(...known) : null;
    const low = known.length ? Math.min(...known) : null;
    const profile = await ctx.db.query(
      `select target_band, to_char(exam_date, 'YYYY-MM-DD') as exam_date, exam_date_precision
       from learner_profiles where user_id = $1`,
      [userId],
    );
    const row = profile.rows[0] ?? {};
    const target = row.target_band == null ? null : Number(row.target_band);
    const dated = row.exam_date_precision === "exact" && row.exam_date ? row.exam_date : null;
    return {
      attemptId: attempt.rows[0].id,
      estimate: true,
      official: false,
      overall,
      target,
      gap: overall == null || target == null ? null : Math.round((target - overall) * 2) / 2,
      examDate: dated,
      daysLeft: dated ? daysBetween(tehranDay(now), dated) : null,
      skills: ordered.map((item) => ({
        ...item,
        note: item.band == null ? "missing" : top !== low && item.band === top ? "strength" : top !== low && item.band === low ? "weak" : "steady",
      })),
    };
  }

  function planBody(result) {
    const ranked = [...result.skills].sort((a, b) => (a.band ?? 9) - (b.band ?? 9) || SKILL_ORDER.indexOf(a.skill) - SKILL_ORDER.indexOf(b.skill));
    return {
      chapterFrom: result.overall,
      chapterTo: result.overall == null ? null : Math.min(9, result.overall + 0.5),
      lessons: 3,
      minuteMin: 5,
      minuteMax: 10,
      days: 5,
      activeDays: [0, 1, 2, 3, 4],
      priority: ranked.map((row) => row.skill),
      bands: Object.fromEntries(result.skills.map((row) => [row.skill, row.band])),
    };
  }

  router.get(
    "/placement/result",
    auth,
    wrap(async (req, res) => {
      const result = await latestResult(req.user.id, ctx.now());
      if (!result) throw new ApiError(404, "not_found");
      res.json(result);
    }),
  );

  router.post(
    "/placement/plan",
    ctx.originGuard,
    auth,
    wrap(async (req, res) => {
      const result = await latestResult(req.user.id, ctx.now());
      if (!result) throw new ApiError(404, "not_found");
      const body = planBody(result);
      const week = tehranWeekStart(ctx.now());
      const id = await ctx.db.transaction(async (tx) => {
        await tx.query("update study_plans set status = 'superseded' where user_id = $1 and status = 'active'", [req.user.id]);
        const plan = await tx.query(
          `insert into study_plans (user_id, week_start, path, phase, inputs) values ($1, $2, 'auto', 1, $3::jsonb) returning id`,
          [req.user.id, week, JSON.stringify(body)],
        );
        const titles = { listening: "شنیدن", reading: "خواندن", writing: "نوشتن", speaking: "صحبت کردن" };
        for (const [index, skill] of body.priority.slice(0, 3).entries()) {
          const day = addDays(week, index);
          await tx.query(
            `insert into plan_tasks (plan_id, day, sort, skill, kind, title_fa, title_en, minutes, original_day, match_rule)
             values ($1, $2, $3, $4, 'review', $5, $6, 10, $2, 'skill')`,
            [plan.rows[0].id, day, index, skill, titles[skill], skill],
          );
        }
        return plan.rows[0].id;
      });
      res.status(201).json({ id, ...body });
    }),
  );

  router.get(
    "/plan",
    auth,
    wrap(async (req, res) => {
      const { rows } = await ctx.db.query(
        `select id, inputs from study_plans where user_id = $1 and status = 'active' order by week_start desc limit 1`,
        [req.user.id],
      );
      res.json({ plan: rows[0] ? { id: rows[0].id, ...rows[0].inputs } : null });
    }),
  );

  return router;
}
