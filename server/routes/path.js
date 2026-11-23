// Starting a path node. The same rules as the home sheet: locked, unpaid premium,
// and an early checkpoint are refused. A current free node returns the stub lesson URL.
import express from "express";
import { ApiError } from "../core/errors.js";
import { effectiveSubscription } from "../services/billing.js";
import { loadFrame } from "../services/frame.js";
import { startDecision } from "../services/path.js";
import { wrap } from "./util.js";

const COPY = {
  chapter: ["اول فصل قبلی را تمام کن.", "Finish the previous chapter first."],
  checkpoint: ["آزمون فصل وقتی باز می‌شود که درس‌های همین فصل را تمام کرده باشی.", "The chapter test opens after the lessons in this chapter are done."],
  previous: ["این گره هنوز قفل است. اول گره قبلی را تمام کن.", "This node is still locked. Finish the previous one first."],
  premium: ["این گره برای اشتراک پریمیوم است.", "This node is part of Premium."],
  missing: ["این گره پیدا نشد.", "This node was not found."],
  locked: ["این گره هنوز باز نیست.", "This node is not open yet."],
};

/** @param {ReturnType<import("../auth/context.js").createAuthContext>} ctx */
export function pathRoutes(ctx) {
  const router = express.Router();
  router.post(
    "/path/nodes/:id/start",
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
      const decision = startDecision({ ...found, premium: subscription.tier === "premium" });
      if (!decision.ok) {
        const [fa, en] = COPY[decision.reason] ?? COPY.locked;
        throw new ApiError(403, "forbidden", { fa, en, details: { reason: decision.reason } });
      }
      res.json({ lessonUrl: decision.lessonUrl, skill: decision.skill });
    }),
  );
  return router;
}
