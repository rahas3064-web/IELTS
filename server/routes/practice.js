/* global process */
// Skill practice. Published sets only. Free learners open part 1 of each skill (Listening
// Part 1, Reading Passage 1, Writing Task 1, Speaking Part 1); premium opens every part. The
// cap is data (feature_entitlements.practice_parts, 012). AI scoring of writing/speaking uses
// the monthly writing_scoring / speaking_scoring quota of the learner's plan.
import express from "express";
import { ApiError } from "../core/errors.js";
import { parseBody, v } from "../core/validate.js";
import { commitQuota, releaseQuota, reserveQuota } from "../services/ai-quota.js";
import { practiceAccess, setIsOpen } from "../services/entitlements.js";
import { ensureBandTables, lookupBand, scaleRaw } from "../services/band-tables.js";
import { publicItem } from "../services/content-bank.js";
import { scoreCriteria } from "../avalai.js";
import { wrap } from "./util.js";

const answerSchema = v.object({
  answers: v.array(v.object({
    itemId: v.string({ min: 36, max: 36 }),
    value: v.string({ min: 0, max: 8000 }),
  }), { min: 1, max: 40 }),
});

const lockedError = (maxPart) => new ApiError(403, "forbidden", {
  fa: `در طرح رایگان فقط بخش ${maxPart ?? 1} هر مهارت باز است (پارت ۱ لیسنینگ و اسپیکینگ، پسیج ۱ ریدینگ، تسک ۱ رایتینگ). برای بقیهٔ بخش‌ها اشتراک پریمیوم لازم است.`,
  en: `The free plan opens part ${maxPart ?? 1} of each skill only (Listening/Speaking Part 1, Reading Passage 1, Writing Task 1). Premium opens every part.`,
  details: { upgrade: "/app/subscription", reason: "premium_part", maxPart },
});

/** @param {ReturnType<import("../auth/context.js").createAuthContext>} ctx */
export function practiceRoutes(ctx, { score = scoreCriteria } = {}) {
  const router = express.Router();
  const auth = ctx.requireUser();

  router.get(
    "/practice/sets",
    auth,
    wrap(async (req, res) => {
      const access = await practiceAccess(ctx.db, req.user.id, ctx.now());
      const { rows } = await ctx.db.query(
        `select id, skill, kind, title_fa, title_en, is_free, question_type, part_no, est_minutes
         from practice_sets
         where status = 'published' and not is_dev_fixture
         order by skill, title_fa`,
      );
      res.json({
        tier: access.subscription.tier,
        maxPart: access.maxPart,
        sets: rows.map((row) => {
          const open = setIsOpen(row, access.maxPart);
          return {
            id: row.id,
            skill: row.skill,
            kind: row.kind,
            title: row.title_fa,
            titleEn: row.title_en,
            partNo: row.part_no,
            isFree: setIsOpen(row, 1),
            locked: !open,
            estMinutes: row.est_minutes,
          };
        }),
      });
    }),
  );

  router.post(
    "/practice/sets/:id/attempts",
    ctx.originGuard,
    auth,
    wrap(async (req, res) => {
      const { rows } = await ctx.db.query(
        `select id, skill, kind, question_type, is_free, part_no, status from practice_sets
         where id = $1 and status = 'published' and not is_dev_fixture`,
        [req.params.id],
      );
      const set = rows[0];
      if (!set) throw new ApiError(404, "not_found");
      const access = await practiceAccess(ctx.db, req.user.id, ctx.now());
      if (!setIsOpen(set, access.maxPart)) throw lockedError(access.maxPart);
      const open = await ctx.db.query(
        `select id from practice_attempts where user_id = $1 and set_id = $2 and status = 'in_progress'`,
        [req.user.id, set.id],
      );
      if (open.rows[0]) {
        res.json({ attemptId: open.rows[0].id });
        return;
      }
      const created = await ctx.db.query(
        `insert into practice_attempts (user_id, set_id, kind, skill, question_type)
         values ($1, $2, $3, $4, $5) returning id`,
        [req.user.id, set.id, set.kind, set.skill, set.question_type],
      );
      const items = await ctx.db.query(
        `select i.id, i.skill, i.exam_type, i.question_type, i.part_no, i.stem, i.is_free, i.audio_id, i.passage_id
         from practice_set_items psi join content_items i on i.id = psi.item_id
         where psi.set_id = $1 and i.status = 'published' and not i.is_dev_fixture
         order by psi.sort`,
        [set.id],
      );
      res.status(201).json({ attemptId: created.rows[0].id, items: items.rows.map((row) => publicItem(row)) });
    }),
  );

  /**
   * One unit of the plan's writing/speaking scoring quota, taken before the answers are saved
   * so an exhausted quota (402) leaves the attempt open and the learner's text in the form.
   * Null when there is nothing to score or no AI key (nothing is charged then).
   */
  async function reserveScoring(userId, skill, answer) {
    if (!String(answer ?? "").trim()) return null;
    if (score === scoreCriteria && !process.env.AVALAI_API_KEY) return null;
    const access = await practiceAccess(ctx.db, userId, ctx.now());
    return reserveQuota(ctx.db, {
      userId,
      planKey: access.subscription.plan,
      quotaKey: skill === "speaking" ? "speaking_scoring" : "writing_scoring",
      operation: skill === "speaking" ? "speaking_scoring" : "writing_scoring",
      now: ctx.now(),
    });
  }

  router.post(
    "/practice/attempts/:id/submit",
    ctx.originGuard,
    auth,
    wrap(async (req, res) => {
      const body = parseBody(answerSchema, req.body);
      const { rows } = await ctx.db.query(
        `select a.id, a.skill, a.kind, a.status from practice_attempts a
         where a.id = $1 and a.user_id = $2`,
        [req.params.id, req.user.id],
      );
      const attempt = rows[0];
      if (!attempt || attempt.status !== "in_progress") throw new ApiError(404, "not_found");
      const items = await ctx.db.query(
        `select i.id, i.stem, i.answer_key, i.skill from practice_set_items psi
         join practice_attempts a on a.set_id = psi.set_id
         join content_items i on i.id = psi.item_id
         where a.id = $1 and i.status = 'published'`,
        [attempt.id],
      );
      const byId = new Map(items.rows.map((row) => [row.id, row]));
      const subjective = attempt.skill === "writing" || attempt.skill === "speaking";
      // Quota first: a 402 must not leave half-saved answers behind.
      const reservation = subjective ? await reserveScoring(req.user.id, attempt.skill, body.answers[0]?.value) : null;
      let raw = 0;
      for (const answer of body.answers) {
        const item = byId.get(answer.itemId);
        if (!item) continue;
        const expected = String(item.answer_key?.correct ?? "").trim().toLowerCase();
        const correct = expected !== "" && expected === answer.value.trim().toLowerCase();
        if (correct) raw += 1;
        await ctx.db.query(
          `insert into practice_answers (attempt_id, item_id, answer, is_correct)
           values ($1, $2, $3::jsonb, $4)
           on conflict (attempt_id, item_id) do update set answer = excluded.answer, is_correct = excluded.is_correct`,
          [attempt.id, answer.itemId, JSON.stringify({ value: answer.value }), item.answer_key ? correct : null],
        );
      }
      let band = null;
      let status = "scored";
      let criteria = null;
      if (attempt.skill === "listening" || attempt.skill === "reading") {
        await ensureBandTables(ctx.db);
        band = await lookupBand(ctx.db, attempt.skill, scaleRaw(raw, items.rows.length));
      } else {
        const first = body.answers[0];
        const item = first ? byId.get(first.itemId) : null;
        try {
          const scored = reservation
            ? await score({ skill: attempt.skill, prompt: item?.stem?.prompt ?? "", answer: first?.value ?? "" })
            : null;
          if (!scored) status = "scoring_failed";
          else {
            band = scored.band;
            criteria = scored.criteria;
          }
        } catch (error) {
          if (reservation) await releaseQuota(ctx.db, reservation.eventId, ctx.now());
          if (error?.code !== "missing_ai") throw error;
          status = "scoring_failed";
        }
        if (reservation) {
          if (status === "scored") {
            await commitQuota(ctx.db, reservation.eventId, { ref: attempt.id, promptVersion: "practice-criteria-v1", now: ctx.now() });
          } else {
            await releaseQuota(ctx.db, reservation.eventId, ctx.now());
          }
        }
      }
      const objective = attempt.skill === "listening" || attempt.skill === "reading";
      await ctx.db.query(
        `update practice_attempts
         set status = $2, completed_at = $3, raw_score = $4, max_score = $5, band = $6, counts_for_band = false, minutes_studied = 1
         where id = $1`,
        [attempt.id, status, ctx.now(), objective ? raw : null, objective ? items.rows.length : null, status === "scored" ? band : null],
      );
      res.json({
        status,
        band: status === "scored" ? band : null,
        raw: objective ? raw : null,
        max: objective ? items.rows.length : null,
        criteria,
        label: status === "scored" ? "AI estimate, not official" : null,
      });
    }),
  );

  return router;
}
