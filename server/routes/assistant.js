/* global process */
// AI assistant (spec S9): one chat per conversation that answers any question and reviews
// IELTS writing. Every reply is a real AvalAI call; nothing is canned. Each reply uses one
// `assistant_messages` unit of the monthly quota (ai_quota_configs per plan), reserved before
// the call and released if the call fails, so a failure never costs the learner anything.
import express from "express";
import { enforceLimit } from "../auth/limits.js";
import { ApiError } from "../core/errors.js";
import { parseBody, v } from "../core/validate.js";
import {
  ASSISTANT_PROMPT_VERSION, assistantReply, countWords, reviewHistoryTurn, reviewInstruction,
} from "../avalai.js";
import { effectiveSubscription } from "../services/billing.js";
import { commitQuota, quotaStatus, releaseQuota, reserveQuota } from "../services/ai-quota.js";
import { wrap } from "./util.js";

const QUOTA_KEY = "assistant_messages";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TASK_TYPES = ["task1_academic", "task1_general", "task2"];
/** Replies keep this many earlier messages as context. */
const HISTORY_LIMIT = 16;
const MIN_REVIEW_WORDS = 30;

const messageSchema = v.object({
  conversationId: v.optional(v.string({ min: 36, max: 36, pattern: UUID })),
  kind: v.optional(v.oneOf(["chat", "writing_review"])),
  content: v.string({ min: 1, max: 8000 }),
  taskType: v.optional(v.oneOf(TASK_TYPES)),
  taskPrompt: v.optional(v.string({ min: 0, max: 2000 })),
});

const reviewFieldError = (field, fa, en) => new ApiError(400, "validation_failed", {
  fa, en, details: { field, fields: { [field]: { code: "invalid_value", message_fa: fa, message_en: en } } },
});

function publicMessage(row) {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    createdAt: new Date(row.created_at).toISOString(),
    kind: row.task_type ? "writing_review" : "chat",
    review: row.task_type ? { taskType: row.task_type, taskPrompt: row.task_prompt ?? null, wordCount: Number(row.word_count) } : null,
  };
}

function publicConversation(row) {
  return { id: row.id, title: row.title ?? "", updatedAt: new Date(row.updated_at).toISOString() };
}

const MESSAGE_SQL = `select m.id, m.role, m.content, m.created_at, r.task_type, r.task_prompt, r.word_count
  from assistant_messages m left join assistant_writing_reviews r on r.message_id = m.id
  where m.conversation_id = $1`;

/**
 * @param {ReturnType<import("../auth/context.js").createAuthContext>} ctx
 * @param {{reply?: typeof assistantReply, env?: Record<string, string|undefined>}} [options]
 *   `reply` and `env` are for tests; production uses AvalAI with process.env.
 */
export function assistantRoutes(ctx, { reply = assistantReply, env = process.env } = {}) {
  const router = express.Router();
  const auth = ctx.requireUser();
  const { db } = ctx;

  async function ownConversation(userId, id) {
    if (!UUID.test(String(id))) throw new ApiError(404, "not_found");
    const { rows } = await db.query(
      "select id, title, updated_at from assistant_conversations where id = $1 and user_id = $2",
      [id, userId],
    );
    if (!rows[0]) throw new ApiError(404, "not_found");
    return rows[0];
  }

  async function usageFor(userId, now) {
    const subscription = await effectiveSubscription(db, userId, now);
    const usage = await quotaStatus(db, { userId, planKey: subscription.plan, quotaKey: QUOTA_KEY, now });
    return { subscription, usage };
  }

  router.get(
    "/usage",
    auth,
    wrap(async (req, res) => {
      const { subscription, usage } = await usageFor(req.user.id, ctx.now());
      res.json({ tier: subscription.tier, plan: subscription.plan, usage, aiReady: Boolean(env.AVALAI_API_KEY) });
    }),
  );

  router.get(
    "/conversations",
    auth,
    wrap(async (req, res) => {
      const { rows } = await db.query(
        `select id, title, updated_at from assistant_conversations where user_id = $1
         order by updated_at desc limit 30`,
        [req.user.id],
      );
      res.json({ conversations: rows.map(publicConversation) });
    }),
  );

  router.get(
    "/conversations/:id",
    auth,
    wrap(async (req, res) => {
      const conversation = await ownConversation(req.user.id, req.params.id);
      const { rows } = await db.query(`${MESSAGE_SQL} order by m.created_at, m.role desc`, [conversation.id]);
      res.json({ conversation: publicConversation(conversation), messages: rows.map(publicMessage) });
    }),
  );

  router.delete(
    "/conversations/:id",
    ctx.originGuard,
    auth,
    wrap(async (req, res) => {
      const conversation = await ownConversation(req.user.id, req.params.id);
      await db.query("delete from assistant_conversations where id = $1", [conversation.id]);
      res.json({ ok: true });
    }),
  );

  router.post(
    "/messages",
    ctx.originGuard,
    auth,
    wrap(async (req, res) => {
      const body = parseBody(messageSchema, req.body);
      const kind = body.kind ?? "chat";
      const userId = req.user.id;
      const locale = req.user.locale === "en" ? "en" : "fa";
      let wordCount = null;
      if (kind === "writing_review") {
        if (!body.taskType) {
          throw reviewFieldError("taskType", "نوع تسک رایتینگ را انتخاب کن.", "Choose the writing task type.");
        }
        wordCount = countWords(body.content);
        if (wordCount < MIN_REVIEW_WORDS) {
          throw reviewFieldError(
            "content",
            `برای بررسی، حداقل ${MIN_REVIEW_WORDS} کلمه از متن رایتینگت را بفرست.`,
            `Send at least ${MIN_REVIEW_WORDS} words of your writing for review.`,
          );
        }
      }
      const conversation = body.conversationId ? await ownConversation(userId, body.conversationId) : null;
      if (!env.AVALAI_API_KEY) {
        throw new ApiError(503, "assistant_unavailable", {
          fa: "دستیار هوش مصنوعی هنوز روی این سرور فعال نشده (کلید سرویس هوش مصنوعی تنظیم نشده). چیزی از سهمیه‌ات کم نشد.",
          en: "The AI assistant isn't switched on for this server yet (the AI service key is not configured). Nothing was taken from your quota.",
          details: { reason: "not_configured" },
        });
      }
      await enforceLimit(db, `assistant:${userId}`, 30, 600);

      const now = ctx.now();
      const subscription = await effectiveSubscription(db, userId, now);
      const profile = (await db.query(
        "select exam_type, target_band from learner_profiles where user_id = $1",
        [userId],
      )).rows[0];

      const history = conversation
        ? (await db.query(`${MESSAGE_SQL} order by m.created_at desc, m.role asc limit ${HISTORY_LIMIT}`, [conversation.id])).rows.reverse()
        : [];
      const modelMessages = history.map((row) => ({
        role: row.role,
        content: row.task_type
          ? reviewHistoryTurn({ taskType: row.task_type, taskPrompt: row.task_prompt, text: row.content })
          : row.content,
      }));
      modelMessages.push({
        role: "user",
        content: kind === "writing_review"
          ? reviewInstruction({ taskType: body.taskType, taskPrompt: body.taskPrompt, text: body.content, locale })
          : body.content,
      });

      const reservation = await reserveQuota(db, {
        userId, planKey: subscription.plan, quotaKey: QUOTA_KEY, operation: "assistant_message", now,
      });
      let answer;
      try {
        answer = await reply({
          messages: modelMessages,
          mode: kind,
          locale,
          profile: { examType: profile?.exam_type ?? null, targetBand: profile?.target_band == null ? null : Number(profile.target_band) },
          env,
        });
      } catch (error) {
        await releaseQuota(db, reservation.eventId, ctx.now());
        if (error?.code === "missing_ai" || error?.code === "ai_failed") {
          throw new ApiError(503, "assistant_unavailable", { details: { reason: error.code } });
        }
        throw error;
      }

      let saved;
      try {
        saved = await db.transaction(async (tx) => {
          let conv = conversation;
          if (!conv) {
            const title = body.content.replace(/\s+/g, " ").trim().slice(0, 80);
            conv = (await tx.query(
              "insert into assistant_conversations (user_id, title) values ($1, $2) returning id, title, updated_at",
              [userId, title],
            )).rows[0];
          }
          const userRow = (await tx.query(
            `insert into assistant_messages (conversation_id, role, content, tokens, created_at)
             values ($1, 'user', $2, $3, $4) returning id, role, content, created_at`,
            [conv.id, body.content, answer.tokensIn || null, now],
          )).rows[0];
          let review = null;
          if (kind === "writing_review") {
            review = (await tx.query(
              `insert into assistant_writing_reviews (message_id, task_type, task_prompt, word_count)
               values ($1, $2, $3, $4) returning task_type, task_prompt, word_count`,
              [userRow.id, body.taskType, body.taskPrompt?.trim() || null, wordCount],
            )).rows[0];
          }
          const replyRow = (await tx.query(
            `insert into assistant_messages (conversation_id, role, content, tokens, created_at)
             values ($1, 'assistant', $2, $3, $4) returning id, role, content, created_at`,
            [conv.id, answer.text, answer.tokensOut || null, new Date(now.getTime() + 1)],
          )).rows[0];
          const touched = (await tx.query(
            "update assistant_conversations set updated_at = now() where id = $1 returning id, title, updated_at",
            [conv.id],
          )).rows[0];
          return { conversation: touched, userRow: { ...userRow, ...(review ?? {}) }, replyRow };
        });
      } catch (error) {
        await releaseQuota(db, reservation.eventId, ctx.now());
        throw error;
      }
      await commitQuota(db, reservation.eventId, {
        tokensIn: answer.tokensIn, tokensOut: answer.tokensOut, model: answer.model,
        promptVersion: ASSISTANT_PROMPT_VERSION, ref: saved.replyRow.id, now: ctx.now(),
      });
      const usage = { ...reservation };
      delete usage.eventId;
      res.status(201).json({
        conversation: publicConversation(saved.conversation),
        messages: [publicMessage(saved.userRow), publicMessage(saved.replyRow)],
        usage,
      });
    }),
  );

  return router;
}
