// Admin content bank and review queue. No public publish path.
import fs from "node:fs/promises";
import path from "node:path";
import express from "express";
import { ApiError } from "../core/errors.js";
import { parseBody, v } from "../core/validate.js";
import { audit } from "../core/audit.js";
import { hasPermission } from "../authz.js";
import { createContentBank, publicItem } from "../services/content-bank.js";
import { practiceAccess } from "../services/entitlements.js";
import { wrap } from "./util.js";

const SKILLS = ["listening", "reading", "writing", "speaking"];
const itemSchema = v.object({
  skill: v.oneOf(SKILLS),
  examType: v.oneOf(["academic", "general", "both"]),
  questionType: v.string({ min: 1, max: 64 }),
  partNo: v.optional(v.integer({ min: 1, max: 4 })),
  stem: v.object({
    prompt: v.string({ min: 1, max: 8000 }),
    options: v.optional(v.array(v.string({ min: 1, max: 400 }), { max: 8 })),
  }),
  answerKey: v.optional(v.object({ correct: v.string({ min: 1, max: 2000 }) })),
  explanationFa: v.optional(v.string({ max: 2000 })),
  isFree: v.optional(v.oneOf([true, false])),
  difficultyBand: v.optional(v.oneOf([5, 5.5, 6, 6.5, 7, 7.5, 8])),
});
const editSchema = v.object({
  stem: v.optional(v.object({
    prompt: v.string({ min: 1, max: 8000 }),
    options: v.optional(v.array(v.string({ min: 1, max: 400 }), { max: 8 })),
  })),
  answerKey: v.optional(v.object({ correct: v.string({ min: 1, max: 2000 }) })),
  explanationFa: v.optional(v.string({ max: 2000 })),
  isFree: v.optional(v.oneOf([true, false])),
});
const rejectSchema = v.object({ reason: v.string({ min: 1, max: 500 }) });
const audioSchema = v.object({
  mime: v.string({ min: 6, max: 40 }),
  durationSec: v.integer({ min: 1, max: 3600 }),
  bytesBase64: v.string({ min: 8, max: 900_000 }),
  transcript: v.optional(v.string({ max: 8000 })),
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function gate(ctx, permission) {
  return (req, res, next) => {
    ctx.requireAdmin()(req, res, (error) => {
      if (error) {
        next(error);
        return;
      }
      if (!hasPermission(req.user.role, permission)) {
        next(new ApiError(403, "forbidden"));
        return;
      }
      next();
    });
  };
}

/** @param {ReturnType<import("../auth/context.js").createAuthContext>} ctx */
export function adminContentRoutes(ctx, { mediaDir }) {
  const router = express.Router();
  const bank = createContentBank(ctx.db);
  const manage = gate(ctx, "content.manage");
  const review = gate(ctx, "content.review");
  const either = (req, res, next) => {
    ctx.requireAdmin()(req, res, (error) => {
      if (error) {
        next(error);
        return;
      }
      if (!hasPermission(req.user.role, "content.manage") && !hasPermission(req.user.role, "content.review")) {
        next(new ApiError(403, "forbidden"));
        return;
      }
      next();
    });
  };

  router.get(
    "/content",
    either,
    wrap(async (req, res) => {
      const isFree = req.query.isFree === "true" ? true : req.query.isFree === "false" ? false : undefined;
      const rows = await bank.list({
        skill: typeof req.query.skill === "string" ? req.query.skill : undefined,
        status: typeof req.query.status === "string" ? req.query.status : undefined,
        examType: typeof req.query.examType === "string" ? req.query.examType : undefined,
        questionType: typeof req.query.questionType === "string" ? req.query.questionType : undefined,
        isFree,
      });
      res.json({ items: rows.map((row) => publicItem(row, { includeKey: true })) });
    }),
  );

  router.get(
    "/content/:id",
    either,
    wrap(async (req, res) => {
      if (!UUID.test(req.params.id)) throw new ApiError(404, "not_found");
      const row = await bank.get(req.params.id);
      if (!row) throw new ApiError(404, "not_found");
      const passage = row.passage_id
        ? (await ctx.db.query("select id, title, body, status from content_passages where id = $1", [row.passage_id])).rows[0]
        : null;
      res.json({ item: publicItem(row, { includeKey: true }), passage });
    }),
  );

  router.post(
    "/content",
    ctx.originGuard,
    manage,
    wrap(async (req, res) => {
      const body = parseBody(itemSchema, req.body);
      if (!["writing", "speaking"].includes(body.skill) && !body.answerKey) {
        throw new ApiError(400, "validation_failed", { details: { field: "answerKey" } });
      }
      let row;
      try {
        row = await bank.createDraft(req.user, body);
      } catch (error) {
        if (error?.code === "23503") throw new ApiError(400, "validation_failed", { details: { field: "questionType" } });
        throw error;
      }
      await audit(ctx.db, {
        actorId: req.user.id, actorRole: req.user.role, action: "content_draft_created",
        targetType: "content_item", targetId: row.id, ipHash: ctx.ipHash(req),
      });
      res.status(201).json({ item: publicItem(row, { includeKey: true }) });
    }),
  );

  router.put(
    "/content/:id",
    ctx.originGuard,
    either,
    wrap(async (req, res) => {
      const body = parseBody(editSchema, req.body);
      const row = await bank.edit(req.user, req.params.id, body);
      if (!row) throw new ApiError(404, "not_found");
      res.json({ item: publicItem(row, { includeKey: true }) });
    }),
  );

  router.post(
    "/content/:id/review",
    ctx.originGuard,
    manage,
    wrap(async (req, res) => {
      const row = await bank.sendToReview(req.params.id);
      if (!row) throw new ApiError(409, "conflict", { fa: "فقط پیش‌نویس را می‌توان برای بازبینی فرستاد.", en: "Only a draft can be sent to review." });
      res.json({ item: publicItem(row, { includeKey: true }) });
    }),
  );

  router.post(
    "/content/:id/approve",
    ctx.originGuard,
    review,
    wrap(async (req, res) => {
      const row = await bank.decide(req.user, req.params.id, "approved");
      if (!row) throw new ApiError(409, "conflict", { fa: "این آیتم در صف بازبینی نیست.", en: "This item is not in review." });
      res.json({ item: publicItem(row, { includeKey: true }) });
    }),
  );

  router.post(
    "/content/:id/reject",
    ctx.originGuard,
    review,
    wrap(async (req, res) => {
      const { reason } = parseBody(rejectSchema, req.body);
      const row = await bank.decide(req.user, req.params.id, "rejected", reason);
      if (!row) throw new ApiError(409, "conflict", { fa: "این آیتم در صف بازبینی نیست.", en: "This item is not in review." });
      res.json({ item: publicItem(row, { includeKey: true }) });
    }),
  );

  router.get(
    "/review",
    review,
    wrap(async (req, res) => {
      const items = await bank.list({ status: "in_review" });
      const sets = await ctx.db.query(
        `select id, skill, title_fa, is_free, status from practice_sets where status = 'in_review' and not is_dev_fixture order by created_at`,
      );
      const versions = await ctx.db.query(
        `select id, exam_type, version_no, status from placement_versions where status = 'in_review' and not is_dev_fixture order by created_at`,
      );
      res.json({
        items: items.map((row) => publicItem(row, { includeKey: true })),
        sets: sets.rows,
        versions: versions.rows,
      });
    }),
  );

  router.post(
    "/practice-sets/:id/approve",
    ctx.originGuard,
    review,
    wrap(async (req, res) => {
      await bank.approvePracticeSet(req.user, req.params.id);
      res.json({ ok: true });
    }),
  );

  router.post(
    "/placement-versions/:id/approve",
    ctx.originGuard,
    review,
    wrap(async (req, res) => {
      await bank.approvePlacementVersion(req.user, req.params.id);
      res.json({ ok: true });
    }),
  );

  router.post(
    "/content/:id/audio",
    ctx.originGuard,
    manage,
    wrap(async (req, res) => {
      const body = parseBody(audioSchema, req.body);
      if (!body.mime.startsWith("audio/")) throw new ApiError(400, "validation_failed", { details: { field: "mime" } });
      const item = await bank.get(req.params.id);
      if (!item || item.skill !== "listening") throw new ApiError(404, "not_found");
      const bytes = Buffer.from(body.bytesBase64, "base64");
      if (bytes.length < 8) throw new ApiError(400, "validation_failed", { details: { field: "bytesBase64" } });
      const storageKey = `audio/${item.id}.bin`;
      await fs.mkdir(mediaDir, { recursive: true });
      await fs.writeFile(path.join(mediaDir, `${item.id}.bin`), bytes);
      const inserted = await ctx.db.query(
        `insert into media_assets (kind, storage_key, mime, duration_sec, bytes, transcript, uploaded_by)
         values ('audio', $1, $2, $3, $4, $5, $6)
         on conflict (storage_key) do update set mime = excluded.mime, duration_sec = excluded.duration_sec,
           bytes = excluded.bytes, transcript = excluded.transcript
         returning id`,
        [storageKey, body.mime, body.durationSec, bytes.length, body.transcript ?? null, req.user.id],
      );
      await ctx.db.query("update content_items set audio_id = $2 where id = $1", [item.id, inserted.rows[0].id]);
      res.json({ audioId: inserted.rows[0].id });
    }),
  );

  return router;
}

/** Published listening audio only. The file name is the storage key's basename. */
export function mediaRoutes(ctx, { mediaDir }) {
  const router = express.Router();
  router.get(
    "/media/:id",
    ctx.requireUser(),
    wrap(async (req, res) => {
      if (!UUID.test(req.params.id)) throw new ApiError(404, "not_found");
      const { rows } = await ctx.db.query(
        `select m.storage_key, m.mime from media_assets m
         join content_items i on i.audio_id = m.id
         where m.id = $1 and i.status = 'published' and not i.is_dev_fixture
         limit 1`,
        [req.params.id],
      );
      if (!rows[0]) throw new ApiError(404, "not_found");
      const file = path.join(mediaDir, path.basename(rows[0].storage_key));
      res.type(rows[0].mime);
      res.sendFile(file);
    }),
  );
  return router;
}

/** Learner read: published stems only, never answer keys. */
export function learnerContentRoutes(ctx) {
  const router = express.Router();
  const bank = createContentBank(ctx.db);
  router.get(
    "/content/published",
    ctx.requireUser(),
    wrap(async (req, res) => {
      const rows = await bank.list({
        skill: typeof req.query.skill === "string" ? req.query.skill : undefined,
        status: "published",
        isFree: req.query.isFree === "true" ? true : undefined,
      });
      // Free plans see only the parts they may open (feature_entitlements.practice_parts).
      const { maxPart } = await practiceAccess(ctx.db, req.user.id, ctx.now());
      res.json({
        items: rows
          .filter((row) => row.status === "published")
          .filter((row) => maxPart == null || row.part_no == null || Number(row.part_no) <= maxPart)
          .map((row) => publicItem(row)),
      });
    }),
  );
  return router;
}
