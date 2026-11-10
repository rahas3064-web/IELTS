// GET /api/frame: the panel header/menu summary in one round trip (spec S2).
import express from "express";
import { loadFrame } from "../services/frame.js";
import { wrap } from "./util.js";

/** @param {ReturnType<import("../auth/context.js").createAuthContext>} ctx */
export function frameRoutes(ctx) {
  const router = express.Router();

  router.get(
    "/frame",
    ctx.requireUser(),
    wrap(async (req, res) => {
      res.json(await loadFrame(ctx.db, req.user.id, ctx.now()));
    }),
  );

  return router;
}
