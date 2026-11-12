// Placement runner. Only published versions and items. Writing/speaking do not use the monthly quota.
import express from "express";
import { ApiError } from "../core/errors.js";
import { parseBody, v } from "../core/validate.js";
import { scoreCriteria } from "../avalai.js";
import { ensureBandTables, lookupBand, scaleRaw } from "../services/band-tables.js";
import { publicItem } from "../services/content-bank.js";
import { wrap } from "./util.js";

const SKILLS = ["listening", "reading", "writing", "speaking"];
const answerSchema = v.object({ itemId: v.string({ min: 36, max: 36 }), value: v.string({ min: 0, max: 8000 }) });

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
      const profile = await ctx.db.query("select exam_type from learner_profiles where user_id = $1", [req.user.id]);
      const examType = profile.rows[0]?.exam_type;
      if (!examType) throw new ApiError(409, "conflict", { fa: "اول آنبوردینگ را تمام کن.", en: "Finish onboarding first." });
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
          `insert into placement_attempts (user_id, version_id) values ($1, $2) returning id`,
          [req.user.id, version.id],
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
        `select sa.skill, sa.status, sa.band, sa.raw_score, sa.max_score, sa.audio_started_at, s.time_limit_sec
         from placement_skill_attempts sa
         join placement_sections s on s.version_id = $2 and s.skill = sa.skill
         where sa.attempt_id = $1 order by s.sort`,
        [attempt.id, attempt.version_id],
      );
      res.json({
        id: attempt.id,
        status: attempt.status,
        overallBand: attempt.overall_band,
        label: attempt.status === "completed" ? "estimate, not an official IELTS score" : null,
        skills: skills.rows.map((row) => ({
          skill: row.skill,
          status: row.status,
          band: row.band == null ? null : Number(row.band),
          rawScore: row.raw_score,
          maxScore: row.max_score,
          timeLimitSec: row.time_limit_sec,
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
                i.answer_key, a.is_correct
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
      const deadline = new Date(at.getTime() + section.rows[0].time_limit_sec * 1000);
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
        `select a.id, a.answer, i.answer_key, i.stem, i.skill
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
        const overall = values.length && values.every((n) => n != null)
          ? Math.round((values.reduce((sum, n) => sum + n, 0) / values.length) * 2) / 2
          : null;
        await ctx.db.query(
          "update placement_attempts set status = 'completed', completed_at = $2, overall_band = $3 where id = $1",
          [attempt.id, ctx.now(), overall],
        );
      }
      res.json({ band, estimate: true, official: false });
    }),
  );

  return router;
}
