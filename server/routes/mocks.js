/* global process */
// Full IELTS mock exams (spec: premium "mock AI"). Published mocks only. Starting a mock needs
// the plan's mock_ai entitlement and one unit of its monthly full_mock quota (free: none;
// premium: 4 per Tehran month, ai_quota_configs). Listening and Reading are marked against the
// answer key and converted with the band tables; Writing and Speaking are scored by AvalAI on
// the four official criteria. A section the AI could not score keeps band null: nothing is
// invented, and the overall band is only given when all four section bands exist.
import express from "express";
import { ApiError } from "../core/errors.js";
import { parseBody, v } from "../core/validate.js";
import { scoreCriteria } from "../avalai.js";
import { ensureBandTables, lookupBand, scaleRaw } from "../services/band-tables.js";
import { publicItem } from "../services/content-bank.js";
import { commitQuota, quotaStatus, releaseQuota, reserveQuota } from "../services/ai-quota.js";
import { entitlement } from "../services/entitlements.js";
import { effectiveSubscription } from "../services/billing.js";
import { wrap } from "./util.js";

const SKILLS = ["listening", "reading", "writing", "speaking"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const answerSchema = v.object({ itemId: v.string({ min: 36, max: 36 }), value: v.string({ min: 0, max: 8000 }) });
/** Answers saved this long after the deadline still count (network lag, auto-submit). */
const LATE_GRACE_MS = 60_000;

/** IELTS overall: mean of the four bands rounded to the nearest half band (.25 up, .75 up). */
export function overallBand(bands) {
  if (bands.length !== 4 || bands.some((b) => b == null)) return null;
  return Math.round((bands.reduce((sum, b) => sum + Number(b), 0) / 4) * 2) / 2;
}

/** Writing: Task 2 counts twice as much as Task 1 (official weighting). */
export function writingBand(scores) {
  const t1 = scores.find((s) => s.partNo === 1)?.band;
  const t2 = scores.find((s) => s.partNo === 2)?.band;
  if (t1 != null && t2 != null) return Math.round(((t1 + 2 * t2) / 3) * 2) / 2;
  const only = scores.filter((s) => s.band != null);
  if (only.length !== scores.length || !only.length) return null;
  return Math.round((only.reduce((sum, s) => sum + s.band, 0) / only.length) * 2) / 2;
}

const lockedMock = () => new ApiError(403, "forbidden", {
  fa: "آزمون ماک کامل آیلتس با نمره‌دهی هوش مصنوعی فقط در اشتراک پریمیوم است.",
  en: "Full IELTS mock tests with AI scoring are part of Premium.",
  details: { upgrade: "/app/subscription", reason: "premium_mock" },
});

/** @param {ReturnType<import("../auth/context.js").createAuthContext>} ctx */
export function mockRoutes(ctx, { score = scoreCriteria } = {}) {
  const router = express.Router();
  const auth = ctx.requireUser();
  const { db } = ctx;

  async function access(userId) {
    const now = ctx.now();
    const subscription = await effectiveSubscription(db, userId, now);
    const row = await entitlement(db, subscription.plan, "mock_ai");
    const enabled = row ? row.enabled : subscription.tier === "premium";
    const quota = await quotaStatus(db, { userId, planKey: subscription.plan, quotaKey: "full_mock", now });
    return { subscription, enabled, quota };
  }

  async function loadAttempt(userId, id) {
    if (!UUID.test(String(id))) return null;
    const { rows } = await db.query(
      `select a.*, m.title_fa, m.title_en from mock_attempts a join mocks m on m.id = a.mock_id
       where a.id = $1 and a.user_id = $2`,
      [id, userId],
    );
    return rows[0] ?? null;
  }

  async function sectionRow(attempt, skill) {
    if (!SKILLS.includes(skill)) throw new ApiError(404, "not_found");
    const { rows } = await db.query(
      `select sa.*, s.id as section_id, s.time_limit_sec, s.transfer_time_sec
       from mock_section_attempts sa
       join mock_sections s on s.mock_id = $2 and s.skill = sa.skill
       where sa.mock_attempt_id = $1 and sa.skill = $3`,
      [attempt.id, attempt.mock_id, skill],
    );
    if (!rows[0]) throw new ApiError(404, "not_found");
    return rows[0];
  }

  async function summary(attempt) {
    const sections = await db.query(
      `select sa.skill, sa.status, sa.band, sa.raw_score, sa.max_score, sa.deadline_at, sa.audio_started_at, s.time_limit_sec,
              (select count(*)::int from mock_section_items si join content_items i on i.id = si.item_id
               where si.section_id = s.id and i.status = 'published') as item_count
       from mock_section_attempts sa join mock_sections s on s.mock_id = $2 and s.skill = sa.skill
       where sa.mock_attempt_id = $1 order by s.sort`,
      [attempt.id, attempt.mock_id],
    );
    return {
      id: attempt.id,
      mockId: attempt.mock_id,
      title: attempt.title_fa,
      titleEn: attempt.title_en,
      status: attempt.status,
      overallBand: attempt.overall_band == null ? null : Number(attempt.overall_band),
      label: "AI estimate, not an official IELTS score",
      sections: sections.rows.map((row) => ({
        skill: row.skill,
        status: row.status,
        band: row.band == null ? null : Number(row.band),
        rawScore: row.raw_score,
        maxScore: row.max_score,
        timeLimitSec: row.time_limit_sec,
        deadlineAt: row.deadline_at ? new Date(row.deadline_at).toISOString() : null,
        itemCount: row.item_count,
      })),
    };
  }

  router.get(
    "/mocks",
    auth,
    wrap(async (req, res) => {
      const info = await access(req.user.id);
      const { rows } = await db.query(
        `select m.id, m.exam_type, m.title_fa, m.title_en,
                (select count(*)::int from mock_sections s where s.mock_id = m.id) as section_count,
                a.id as attempt_id, a.status as attempt_status, a.overall_band
         from mocks m left join mock_attempts a on a.mock_id = m.id and a.user_id = $1
         where m.status = 'published' and not m.is_dev_fixture
         order by m.created_at desc`,
        [req.user.id],
      );
      res.json({
        tier: info.subscription.tier,
        enabled: info.enabled,
        quota: info.quota,
        aiReady: Boolean(process.env.AVALAI_API_KEY) || score !== scoreCriteria,
        mocks: rows.map((row) => ({
          id: row.id,
          examType: row.exam_type,
          title: row.title_fa,
          titleEn: row.title_en,
          sectionCount: row.section_count,
          locked: !info.enabled,
          attempt: row.attempt_id
            ? { id: row.attempt_id, status: row.attempt_status, overallBand: row.overall_band == null ? null : Number(row.overall_band) }
            : null,
        })),
      });
    }),
  );

  router.post(
    "/mocks/:id/attempts",
    ctx.originGuard,
    auth,
    wrap(async (req, res) => {
      if (!UUID.test(req.params.id)) throw new ApiError(404, "not_found");
      const { rows } = await db.query(
        "select id from mocks where id = $1 and status = 'published' and not is_dev_fixture",
        [req.params.id],
      );
      const mock = rows[0];
      if (!mock) throw new ApiError(404, "not_found");
      const existing = await db.query("select id from mock_attempts where user_id = $1 and mock_id = $2", [req.user.id, mock.id]);
      if (existing.rows[0]) {
        res.json({ attemptId: existing.rows[0].id, resumed: true });
        return;
      }
      const info = await access(req.user.id);
      if (!info.enabled) throw lockedMock();
      const now = ctx.now();
      const reservation = await reserveQuota(db, {
        // 007 has no separate "mock" operation; a mock is mostly writing/speaking AI scoring.
        userId: req.user.id, planKey: info.subscription.plan, quotaKey: "full_mock", operation: "writing_scoring", now,
      });
      let attemptId;
      try {
        attemptId = await db.transaction(async (tx) => {
          const attempt = await tx.query(
            "insert into mock_attempts (user_id, mock_id, mode) values ($1, $2, 'full') returning id",
            [req.user.id, mock.id],
          );
          const sections = await tx.query("select skill from mock_sections where mock_id = $1", [mock.id]);
          for (const section of sections.rows) {
            await tx.query(
              "insert into mock_section_attempts (mock_attempt_id, skill) values ($1, $2)",
              [attempt.rows[0].id, section.skill],
            );
          }
          return attempt.rows[0].id;
        });
      } catch (error) {
        await releaseQuota(db, reservation.eventId, ctx.now());
        throw error;
      }
      await commitQuota(db, reservation.eventId, { ref: attemptId, promptVersion: "mock-v1", now: ctx.now() });
      res.status(201).json({ attemptId, resumed: false });
    }),
  );

  router.get(
    "/mock-attempts/:id",
    auth,
    wrap(async (req, res) => {
      const attempt = await loadAttempt(req.user.id, req.params.id);
      if (!attempt) throw new ApiError(404, "not_found");
      res.json(await summary(attempt));
    }),
  );

  router.post(
    "/mock-attempts/:id/sections/:skill/start",
    ctx.originGuard,
    auth,
    wrap(async (req, res) => {
      const attempt = await loadAttempt(req.user.id, req.params.id);
      if (!attempt || attempt.status !== "in_progress") throw new ApiError(404, "not_found");
      const section = await sectionRow(attempt, req.params.skill);
      if (section.status === "completed") throw new ApiError(409, "conflict");
      const at = ctx.now();
      const deadline = new Date(at.getTime() + (section.time_limit_sec + section.transfer_time_sec) * 1000);
      const { rows } = await db.query(
        `update mock_section_attempts
         set status = 'in_progress', started_at = coalesce(started_at, $2), deadline_at = coalesce(deadline_at, $3)
         where id = $1 returning deadline_at`,
        [section.id, at, deadline],
      );
      res.json({ deadlineAt: new Date(rows[0].deadline_at).toISOString() });
    }),
  );

  router.get(
    "/mock-attempts/:id/sections/:skill",
    auth,
    wrap(async (req, res) => {
      const attempt = await loadAttempt(req.user.id, req.params.id);
      if (!attempt) throw new ApiError(404, "not_found");
      const section = await sectionRow(attempt, req.params.skill);
      if (section.status === "not_started") {
        throw new ApiError(409, "conflict", { fa: "اول این بخش را شروع کن.", en: "Start this section first." });
      }
      const items = await db.query(
        `select i.id, i.skill, i.exam_type, i.question_type, si.part_no, i.stem, i.is_free, i.audio_id, i.passage_id,
                i.answer_key, a.answer, a.is_correct, p.title as passage_title, p.body as passage_body
         from mock_section_items si
         join content_items i on i.id = si.item_id
         left join content_passages p on p.id = i.passage_id
         left join mock_answers a on a.section_attempt_id = $2 and a.item_id = i.id
         where si.section_id = $1 and i.status = 'published'
         order by si.part_no, si.sort`,
        [section.section_id, section.id],
      );
      const done = section.status === "completed";
      res.json({
        status: section.status,
        deadlineAt: section.deadline_at ? new Date(section.deadline_at).toISOString() : null,
        items: items.rows.map((row) => ({
          ...publicItem(row),
          partNo: row.part_no,
          passage: row.passage_id ? { title: row.passage_title, body: row.passage_body } : null,
          // Listening audio plays once: after it has started the id is withheld.
          audioId: req.params.skill === "listening" && section.audio_started_at ? null : row.audio_id,
          answer: row.answer?.value ?? "",
          ...(done ? { correct: row.is_correct, answerKey: row.answer_key } : {}),
        })),
      });
    }),
  );

  router.post(
    "/mock-attempts/:id/listening/audio",
    ctx.originGuard,
    auth,
    wrap(async (req, res) => {
      const attempt = await loadAttempt(req.user.id, req.params.id);
      if (!attempt) throw new ApiError(404, "not_found");
      await db.query(
        `update mock_section_attempts set audio_started_at = coalesce(audio_started_at, $2)
         where mock_attempt_id = $1 and skill = 'listening' and status = 'in_progress'`,
        [attempt.id, ctx.now()],
      );
      res.json({ started: true });
    }),
  );

  router.put(
    "/mock-attempts/:id/sections/:skill/answers",
    ctx.originGuard,
    auth,
    wrap(async (req, res) => {
      const body = parseBody(answerSchema, req.body);
      const attempt = await loadAttempt(req.user.id, req.params.id);
      if (!attempt) throw new ApiError(404, "not_found");
      const section = await sectionRow(attempt, req.params.skill);
      if (section.status !== "in_progress") throw new ApiError(409, "conflict");
      if (ctx.now().getTime() > new Date(section.deadline_at).getTime() + LATE_GRACE_MS) {
        throw new ApiError(409, "conflict", { fa: "زمان این بخش تمام شده است.", en: "Time for this section is up." });
      }
      const member = await db.query("select 1 from mock_section_items where section_id = $1 and item_id = $2", [section.section_id, body.itemId]);
      if (!member.rows[0]) throw new ApiError(404, "not_found");
      await db.query(
        `insert into mock_answers (section_attempt_id, item_id, answer) values ($1, $2, $3::jsonb)
         on conflict (section_attempt_id, item_id) do update set answer = excluded.answer, answered_at = now()`,
        [section.id, body.itemId, JSON.stringify({ value: body.value })],
      );
      res.json({ ok: true });
    }),
  );

  router.post(
    "/mock-attempts/:id/sections/:skill/complete",
    ctx.originGuard,
    auth,
    wrap(async (req, res) => {
      const attempt = await loadAttempt(req.user.id, req.params.id);
      if (!attempt) throw new ApiError(404, "not_found");
      const section = await sectionRow(attempt, req.params.skill);
      if (section.status !== "in_progress") throw new ApiError(409, "conflict");
      const items = await db.query(
        `select i.id, i.stem, i.answer_key, si.part_no, a.id as answer_id, a.answer
         from mock_section_items si join content_items i on i.id = si.item_id
         left join mock_answers a on a.section_attempt_id = $2 and a.item_id = i.id
         where si.section_id = $1 and i.status = 'published' order by si.part_no, si.sort`,
        [section.section_id, section.id],
      );
      let raw = null;
      let max = null;
      let band = null;
      let scoredParts = [];
      if (req.params.skill === "listening" || req.params.skill === "reading") {
        await ensureBandTables(db);
        raw = 0;
        for (const item of items.rows) {
          const expected = String(item.answer_key?.correct ?? "").trim().toLowerCase();
          const given = String(item.answer?.value ?? "").trim().toLowerCase();
          const correct = expected !== "" && expected === given;
          if (correct) raw += 1;
          if (item.answer_id) await db.query("update mock_answers set is_correct = $2 where id = $1", [item.answer_id, correct]);
        }
        max = items.rows.length || null;
        if (max) band = await lookupBand(db, req.params.skill, scaleRaw(raw, max));
        else raw = null;
      } else {
        for (const item of items.rows) {
          let scored = null;
          try {
            scored = await score({ skill: req.params.skill, prompt: item.stem?.prompt ?? "", answer: item.answer?.value ?? "" });
          } catch (error) {
            if (error?.code !== "missing_ai") throw error;
          }
          scoredParts.push({ partNo: item.part_no, band: scored?.band ?? null, criteria: scored?.criteria ?? null });
        }
        band = req.params.skill === "writing"
          ? writingBand(scoredParts)
          : scoredParts.length && scoredParts.every((s) => s.band != null)
            ? Math.round((scoredParts.reduce((sum, s) => sum + s.band, 0) / scoredParts.length) * 2) / 2
            : null;
      }
      await db.query(
        `update mock_section_attempts set status = 'completed', completed_at = $2, raw_score = $3, max_score = $4, band = $5
         where id = $1`,
        [section.id, ctx.now(), raw, max, band],
      );
      const all = await db.query("select status, band from mock_section_attempts where mock_attempt_id = $1", [attempt.id]);
      if (all.rows.every((row) => row.status === "completed")) {
        const overall = overallBand(all.rows.map((row) => (row.band == null ? null : Number(row.band))));
        await db.query(
          "update mock_attempts set status = 'completed', completed_at = $2, overall_band = $3 where id = $1",
          [attempt.id, ctx.now(), overall],
        );
      }
      res.json({
        band,
        raw,
        max,
        parts: scoredParts.map((part) => ({ partNo: part.partNo, band: part.band, criteria: part.criteria })),
        scored: band != null,
        label: "AI estimate, not an official IELTS score",
      });
    }),
  );

  return router;
}
