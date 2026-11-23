// Lesson stage progress. Locked and unpaid nodes stay closed. No model call.
import express from "express";
import { ApiError } from "../core/errors.js";
import { tehranDay } from "../core/tehran-time.js";
import { effectiveSubscription } from "../services/billing.js";
import { loadFrame } from "../services/frame.js";
import { lessonContent, lessonView, stageStep } from "../services/lesson.js";
import { completionStep, startDecision } from "../services/path.js";
import { dailyGoal, getStreak, recordActivity } from "../services/streak.js";
import { wrap } from "./util.js";

async function openNode(ctx, userId, nodeId) {
  const frame = await loadFrame(ctx.db, userId, ctx.now());
  for (const chapter of frame.path.chapters) {
    const node = chapter.nodes.find((item) => item.id === nodeId);
    if (!node) continue;
    const subscription = await effectiveSubscription(ctx.db, userId, ctx.now());
    const decision = startDecision({ node, chapter, premium: subscription.tier === "premium" });
    if (!decision.ok) throw new ApiError(403, "forbidden", { details: { reason: decision.reason } });
    return node;
  }
  throw new ApiError(404, "not_found");
}

/** @param {ReturnType<import("../auth/context.js").createAuthContext>} ctx */
export function lessonRoutes(ctx) {
  const router = express.Router();

  router.get(
    "/lessons/:id",
    ctx.requireUser(),
    wrap(async (req, res) => {
      await openNode(ctx, req.user.id, req.params.id);
      const { rows } = await ctx.db.query(
        "select stage, practice, apply_text from lesson_runs where user_id = $1 and node_id = $2",
        [req.user.id, req.params.id],
      );
      const row = rows[0];
      res.json(lessonView(row ? { stage: row.stage, practice: row.practice, applyText: row.apply_text } : {}));
    }),
  );

  router.put(
    "/lessons/:id",
    ctx.originGuard,
    ctx.requireUser(),
    wrap(async (req, res) => {
      await openNode(ctx, req.user.id, req.params.id);
      const stage = req.body?.stage;
      const practice = req.body?.practice ?? null;
      const applyText = typeof req.body?.applyText === "string" ? req.body.applyText.slice(0, 4000) : "";
      if (practice != null && practice !== "topic" && practice !== "example") throw new ApiError(400, "validation_failed");
      const { rows } = await ctx.db.query(
        "select stage from lesson_runs where user_id = $1 and node_id = $2",
        [req.user.id, req.params.id],
      );
      if (!stageStep(rows[0]?.stage ?? "learn", stage)) throw new ApiError(400, "validation_failed");
      if ((stage === "apply" || stage === "review") && !practice) throw new ApiError(400, "validation_failed");
      await ctx.db.query(
        `insert into lesson_runs (user_id, node_id, stage, practice, apply_text)
         values ($1, $2, $3, $4, $5)
         on conflict (user_id, node_id) do update
           set stage = excluded.stage, practice = excluded.practice, apply_text = excluded.apply_text, updated_at = now()`,
        [req.user.id, req.params.id, stage, practice, applyText],
      );
      res.json(lessonView({ stage, practice, applyText }));
    }),
  );

  router.post(
    "/lessons/:id/complete",
    ctx.originGuard,
    ctx.requireUser(),
    wrap(async (req, res) => {
      const frame = await loadFrame(ctx.db, req.user.id, ctx.now());
      let found = null;
      for (const chapter of frame.path.chapters) {
        const node = chapter.nodes.find((item) => item.id === req.params.id);
        if (node) found = { node, chapter };
      }
      if (!found) throw new ApiError(404, "not_found");
      const subscription = await effectiveSubscription(ctx.db, req.user.id, ctx.now());
      const premium = subscription.tier === "premium";
      const decision = startDecision({ ...found, premium });
      if (!decision.ok) throw new ApiError(403, "forbidden", { details: { reason: decision.reason } });
      const today = tehranDay(ctx.now());
      const body = await ctx.db.transaction(async (tx) => {
        const { rows } = await tx.query(
          "select stage, completed_at from lesson_runs where user_id = $1 and node_id = $2",
          [req.user.id, req.params.id],
        );
        const saved = rows[0];
        if (!saved || (saved.stage !== "review" && saved.completed_at == null)) throw new ApiError(400, "validation_failed");
        const already = saved.completed_at != null;
        const before = await getStreak(tx, req.user.id, ctx.now());
        if (!already) {
          await tx.query(
            "update lesson_runs set completed_at = $3 where user_id = $1 and node_id = $2 and completed_at is null",
            [req.user.id, req.params.id, ctx.now()],
          );
          const step = completionStep(found.chapter, found.node.id, premium);
          await tx.query(
            `insert into path_node_progress (user_id, node_id, state) values ($1, $2, 'done')
             on conflict (user_id, node_id) do update set state = 'done'`,
            [req.user.id, req.params.id],
          );
          if (step?.next?.startable) {
            await tx.query(
              `insert into path_node_progress (user_id, node_id, state) values ($1, $2, 'current')
               on conflict (user_id, node_id) do update set state = 'current'`,
              [req.user.id, step.next.id],
            );
          }
          await recordActivity(tx, req.user.id, ctx.now());
        }
        const after = await getStreak(tx, req.user.id, ctx.now());
        const goal = await tx.query(
          `select count(*)::int as done from lesson_runs
           where user_id = $1 and completed_at is not null
             and (completed_at at time zone 'Asia/Tehran')::date = $2::date`,
          [req.user.id, today],
        );
        const fresh = await loadFrame(tx, req.user.id, ctx.now());
        let next = null;
        for (const chapter of fresh.path.chapters) {
          const place = chapter.nodes.findIndex((item) => item.id === req.params.id);
          if (place < 0) continue;
          const step = completionStep(chapter, req.params.id, premium);
          next = step?.next ?? null;
        }
        const lesson = lessonContent();
        return {
          titleFa: lesson.titleFa,
          minuteMin: lesson.minuteMin,
          minuteMax: lesson.minuteMax,
          streak: after,
          continued: !already && after.current > before.current,
          goal: dailyGoal(goal.rows[0].done),
          next,
        };
      });
      res.json(body);
    }),
  );

  return router;
}
