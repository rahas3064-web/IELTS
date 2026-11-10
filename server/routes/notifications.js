// In-app notifications API (spec S2): list, mark one read, mark all read.
import express from "express";
import { ApiError } from "../core/errors.js";
import {
  DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, listNotifications, markAllRead, markRead, unreadCount,
} from "../services/notifications.js";
import { fieldFailure, wrap } from "./util.js";

/** Absent -> default, digits >= 1 -> clamped to the maximum, anything else -> 400. */
function parseLimit(raw) {
  if (raw === undefined || raw === "") return DEFAULT_PAGE_SIZE;
  if (typeof raw !== "string" || !/^\d+$/.test(raw) || Number(raw) < 1) throw fieldFailure("limit", "invalid_value");
  return Math.min(Number(raw), MAX_PAGE_SIZE);
}

/** @param {ReturnType<import("../auth/context.js").createAuthContext>} ctx */
export function notificationRoutes(ctx) {
  const router = express.Router();
  const auth = ctx.requireUser();
  const { db } = ctx;

  router.get(
    "/notifications",
    auth,
    wrap(async (req, res) => {
      const cursor = typeof req.query.cursor === "string" && req.query.cursor !== "" ? req.query.cursor : null;
      if (req.query.cursor !== undefined && typeof req.query.cursor !== "string") throw fieldFailure("cursor", "invalid_type");
      res.json(await listNotifications(db, req.user.id, { cursor, limit: parseLimit(req.query.limit) }));
    }),
  );

  router.post(
    "/notifications/read-all",
    ctx.originGuard,
    auth,
    wrap(async (req, res) => {
      await markAllRead(db, req.user.id, ctx.now());
      res.json({ ok: true, unreadCount: await unreadCount(db, req.user.id) });
    }),
  );

  router.post(
    "/notifications/:id/read",
    ctx.originGuard,
    auth,
    wrap(async (req, res) => {
      if (!(await markRead(db, req.user.id, req.params.id, ctx.now()))) throw new ApiError(404, "not_found");
      res.json({ ok: true, unreadCount: await unreadCount(db, req.user.id) });
    }),
  );

  return router;
}
