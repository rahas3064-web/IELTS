import fs from "node:fs/promises";
import path from "node:path";
import express from "express";
import { audit } from "../core/audit.js";
import { ApiError } from "../core/errors.js";
import { enforceLimit } from "../auth/limits.js";
import { speakingAudioPath } from "../jobs/speaking-audio-cleanup.js";
import {
  MAX_SPEAKING_BYTES,
  freeBytesFromStat,
  newSpeakingKey,
  parseDurationSec,
  storedMime,
  uploadBlocked,
} from "../speaking-storage.js";
import { scoreCriteria, scoreSpeakingAudio, transcribeAudio } from "../avalai.js";
import { practiceAccess } from "../services/entitlements.js";
import { scoreStoredRecording } from "../speaking-score.js";
import { convertToWav } from "../speaking-wav.js";
import { wrap } from "./util.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VOLUME_MESSAGE = {
  fa: "فضای ذخیرهٔ صدا رو به پایان است. الان نمی‌توانی صدای تازه بفرستی.",
  en: "Audio storage is nearly full, so a new recording can't be saved.",
};

async function ownsPracticeAttempt(db, userId, attemptId, itemId) {
  const { rows } = await db.query(
    `select a.id
     from practice_attempts a
     join practice_set_items psi on psi.set_id = a.set_id
     join content_items i on i.id = psi.item_id
     where a.id = $1 and a.user_id = $2 and a.status = 'in_progress'
       and a.skill = 'speaking' and i.id = $3 and i.skill = 'speaking'`,
    [attemptId, userId, itemId],
  );
  return rows.length === 1;
}

/**
 * @param {ReturnType<import("../auth/context.js").createAuthContext>} ctx
 * @param {{mediaDir: string, statfs?: Function, uploadMax?: number}} options
 */
export function speakingRoutes(ctx, {
  mediaDir,
  statfs = fs.statfs,
  uploadMax = 30,
  transcribe = transcribeAudio,
  scoreText = scoreCriteria,
  scoreAudio = scoreSpeakingAudio,
  toWav = convertToWav,
  env = process.env,
} = {}) {
  const router = express.Router();
  const auth = ctx.requireUser();

  router.post(
    "/recordings",
    ctx.originGuard,
    auth,
    express.raw({ limit: MAX_SPEAKING_BYTES, type: () => true }),
    wrap(async (req, res) => {
      const mime = storedMime(req.headers["content-type"]);
      const duration = parseDurationSec(req.headers["x-duration-sec"]);
      const contextId = String(req.query.contextId || "");
      const itemId = String(req.query.itemId || "");
      const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
      if (req.query.context !== "practice" || !UUID.test(contextId) || !UUID.test(itemId) || !mime || !duration || body.length === 0) {
        throw new ApiError(400, "validation_failed", {
          fa: "فایل صدا باید webm یا mp4 باشد و به یک تمرین باز وصل باشد.",
          en: "The audio must be webm or mp4 and belong to an open practice attempt.",
        });
      }
      if (body.length > MAX_SPEAKING_BYTES) {
        throw new ApiError(413, "validation_failed", {
          fa: "فایل صدا بزرگ‌تر از ۳ مگابایت است.",
          en: "The audio file is larger than 3 MB.",
        });
      }
      await enforceLimit(ctx.db, `speak:${req.user.id}`, uploadMax, 3600);
      const owned = await ownsPracticeAttempt(ctx.db, req.user.id, contextId, itemId);
      if (!owned) throw new ApiError(404, "not_found");

      let free = null;
      try {
        free = freeBytesFromStat(await statfs(mediaDir));
      } catch {
        free = null;
      }
      if (uploadBlocked(free, body.length)) {
        await audit(ctx.db, {
          actorId: req.user.id,
          actorRole: req.user.role ?? "learner",
          action: "speaking_volume_low",
          targetType: "volume",
          ipHash: ctx.ipHash(req),
          meta: { freeBytes: free },
        });
        throw new ApiError(507, "validation_failed", { ...VOLUME_MESSAGE, details: { reason: "volume_low" } });
      }

      const storageKey = newSpeakingKey(req.user.id, mime);
      const full = speakingAudioPath(mediaDir, storageKey);
      if (!full) throw new ApiError(500, "internal");
      await fs.mkdir(path.dirname(full), { recursive: true });
      await fs.writeFile(full, body);
      try {
        const { rows } = await ctx.db.query(
          `insert into speaking_recordings
             (user_id, context_type, context_id, question_item_id, storage_key, mime, bytes, duration_sec)
           values ($1, 'practice', $2, $3, $4, $5, $6, $7)
           returning id`,
          [req.user.id, contextId, itemId, storageKey, mime, body.length, duration],
        );
        res.status(201).json({ id: rows[0].id, storageKey, mime, bytes: body.length });
      } catch (error) {
        await fs.unlink(full).catch(() => {});
        throw error;
      }
    }),
  );

  router.post(
    "/recordings/:id/score",
    ctx.originGuard,
    auth,
    wrap(async (req, res) => {
      if (!UUID.test(String(req.params.id || ""))) throw new ApiError(400, "validation_failed");
      const { rows } = await ctx.db.query(
        `select r.id, r.user_id, r.storage_key, r.mime, r.duration_sec, r.transcript,
                r.score_state, r.criteria, r.band, r.pronunciation_tries, r.injection, i.stem
         from speaking_recordings r
         join content_items i on i.id = r.question_item_id
         where r.id = $1 and r.user_id = $2`,
        [req.params.id, req.user.id],
      );
      const row = rows[0];
      if (!row) throw new ApiError(404, "not_found");
      const filePath = speakingAudioPath(mediaDir, row.storage_key);
      if (!filePath) throw new ApiError(404, "not_found");
      const access = await practiceAccess(ctx.db, req.user.id, ctx.now());
      let outcome;
      try {
        outcome = await scoreStoredRecording({
          db: ctx.db,
          now: ctx.now,
          userId: req.user.id,
          planKey: access.subscription.plan,
          row,
          filePath,
          env,
          transcribe,
          scoreText,
          scoreAudio,
          toWav,
        });
      } catch (error) {
        if (error?.status === 402) throw error;
        if (error?.code === "missing_ai") {
          res.json({ status: "scoring_failed", band: null, criteria: null, pronunciationPending: false, label: null });
          return;
        }
        throw error;
      }
      if (outcome.http === 409) {
        throw new ApiError(409, "validation_failed", {
          fa: "تلاش دوبارهٔ تلفظ برای این فایل تمام شد.",
          en: "Pronunciation retries for this recording are used up.",
        });
      }
      res.status(outcome.http).json(outcome.body);
    }),
  );

  return router;
}
