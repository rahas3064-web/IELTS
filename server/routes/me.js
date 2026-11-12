// GET /api/me and PUT /api/me/locale (spec S1, S2).
import express from "express";
import { ApiError } from "../core/errors.js";
import { parseBody, v } from "../core/validate.js";
import { loadMe } from "./me-payload.js";
import { wrap } from "./util.js";

const localeSchema = v.object({ locale: v.oneOf(["fa", "en"]) });

/** @param {ReturnType<import("../auth/context.js").createAuthContext>} ctx */
export function meRoutes(ctx) {
  const router = express.Router();
  const auth = ctx.requireUser();

  router.get(
    "/me",
    auth,
    wrap(async (req, res) => {
      const me = await loadMe(ctx.db, req.user.id, ctx.now());
      if (!me) throw new ApiError(401, "unauthenticated");
      res.json(me);
    }),
  );

  router.put(
    "/me/locale",
    ctx.originGuard,
    auth,
    wrap(async (req, res) => {
      const { locale } = parseBody(localeSchema, req.body);
      await ctx.db.query("update users set locale = $2 where id = $1", [req.user.id, locale]);
      res.json({ locale });
    }),
  );

  return router;
}
