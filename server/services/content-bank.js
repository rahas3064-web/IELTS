// Content lifecycle (draft -> in_review -> published | rejected). Learner reads never
// include unpublished rows or answer keys.
import { audit } from "../core/audit.js";
import { ApiError } from "../core/errors.js";
import { hasPermission } from "../authz.js";

const ITEM_COLUMNS = `id, skill, exam_type, question_type, part_no, stem, explanation_fa, explanation_en,
  difficulty_band, passage_id, audio_id, status, is_free, revision, rejection_reason, created_at`;

export function publicItem(row, { includeKey = false } = {}) {
  return {
    id: row.id,
    skill: row.skill,
    examType: row.exam_type,
    questionType: row.question_type,
    partNo: row.part_no,
    stem: row.stem,
    explanationFa: includeKey ? row.explanation_fa : undefined,
    isFree: row.is_free,
    status: includeKey ? row.status : undefined,
    audioId: row.audio_id,
    passageId: row.passage_id,
    ...(includeKey ? { answerKey: row.answer_key, rejectionReason: row.rejection_reason } : {}),
  };
}

export function assertCan(user, permission) {
  if (!hasPermission(user.role, permission)) {
    throw new ApiError(403, "forbidden");
  }
}

/** @param {import("../db.js").Database} db */
export function createContentBank(db) {
  return {
    async list({ skill, status, examType, isFree, questionType }) {
      const where = ["not is_dev_fixture"];
      const params = [];
      const add = (sql, value) => {
        params.push(value);
        where.push(sql.replace("?", `$${params.length}`));
      };
      if (skill) add("skill = ?", skill);
      if (status) add("status = ?", status);
      if (examType) add("exam_type = ?", examType);
      if (questionType) add("question_type = ?", questionType);
      if (isFree === true || isFree === false) add("is_free = ?", isFree);
      const { rows } = await db.query(
        `select ${ITEM_COLUMNS}, answer_key from content_items where ${where.join(" and ")} order by created_at desc limit 100`,
        params,
      );
      return rows;
    },

    async get(id) {
      const { rows } = await db.query(`select ${ITEM_COLUMNS}, answer_key from content_items where id = $1`, [id]);
      return rows[0] ?? null;
    },

    async createDraft(user, body) {
      const { rows } = await db.query(
        `insert into content_items
           (skill, exam_type, question_type, part_no, stem, answer_key, explanation_fa, explanation_en,
            difficulty_band, is_free, source, status, created_by)
         values ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9, $10, 'human', 'draft', $11)
         returning ${ITEM_COLUMNS}, answer_key`,
        [
          body.skill, body.examType, body.questionType, body.partNo ?? null,
          JSON.stringify(body.stem), body.answerKey ? JSON.stringify(body.answerKey) : null,
          body.explanationFa ?? null, body.explanationEn ?? null, body.difficultyBand ?? null,
          Boolean(body.isFree), user.id,
        ],
      );
      return rows[0];
    },

    async edit(user, id, body) {
      const current = await this.get(id);
      if (!current) return null;
      if (current.status === "published") {
        throw new ApiError(409, "conflict", {
          fa: "آیتم منتشرشده را مستقیم عوض نکن. نسخه تازه بساز.",
          en: "A published item cannot be edited in place.",
        });
      }
      const { rows } = await db.query(
        `update content_items
         set stem = coalesce($2::jsonb, stem),
             answer_key = coalesce($3::jsonb, answer_key),
             explanation_fa = coalesce($4, explanation_fa),
             is_free = coalesce($5, is_free),
             status = case when status = 'rejected' then 'draft' else status end,
             rejection_reason = case when status = 'rejected' then null else rejection_reason end
         where id = $1
         returning ${ITEM_COLUMNS}, answer_key`,
        [
          id,
          body.stem ? JSON.stringify(body.stem) : null,
          body.answerKey ? JSON.stringify(body.answerKey) : null,
          body.explanationFa ?? null,
          body.isFree ?? null,
        ],
      );
      await db.query(
        `insert into content_reviews (target_type, target_id, reviewer_id, decision, diff)
         values ('content_item', $1, $2, 'edited', $3::jsonb)`,
        [id, user.id, JSON.stringify({ before: current.stem, after: rows[0].stem })],
      );
      return rows[0];
    },

    async sendToReview(id) {
      const { rows } = await db.query(
        `update content_items set status = 'in_review', rejection_reason = null
         where id = $1 and status in ('draft', 'rejected')
         returning ${ITEM_COLUMNS}, answer_key`,
        [id],
      );
      return rows[0] ?? null;
    },

    async decide(user, id, decision, reason) {
      if (decision === "rejected" && !String(reason ?? "").trim()) {
        throw new ApiError(400, "validation_failed", {
          fa: "برای رد کردن باید دلیل بنویسی.",
          en: "A rejection needs a reason.",
          details: { field: "reason" },
        });
      }
      return db.transaction(async (tx) => {
        const { rows } = await tx.query(
          `update content_items
           set status = $2,
               rejection_reason = $3,
               reviewed_by = $4,
               reviewed_at = case when $2 = 'published' then now() else reviewed_at end
           where id = $1 and status = 'in_review'
           returning ${ITEM_COLUMNS}, answer_key`,
          [id, decision === "approved" ? "published" : "rejected", decision === "rejected" ? reason.trim() : null, user.id],
        );
        const row = rows[0];
        if (!row) return null;
        await tx.query(
          `insert into content_reviews (target_type, target_id, reviewer_id, decision, reason)
           values ('content_item', $1, $2, $3, $4)`,
          [id, user.id, decision === "approved" ? "approved" : "rejected", reason ?? null],
        );
        await audit(tx, {
          actorId: user.id,
          actorRole: user.role,
          action: decision === "approved" ? "content_approved" : "content_rejected",
          targetType: "content_item",
          targetId: id,
        });
        return row;
      });
    },

    /**
     * Publish a practice set that is in review. Every item must already be published.
     * @returns {Promise<{id: string}>} @throws {ApiError} 409 when items are unpublished or the set is not in review
     */
    async approvePracticeSet(user, id) {
      const unpublished = await db.query(
        `select 1 from practice_set_items psi join content_items i on i.id = psi.item_id
         where psi.set_id = $1 and i.status <> 'published'`,
        [id],
      );
      if (unpublished.rows.length) {
        throw new ApiError(409, "conflict", { fa: "اول سؤال‌های این مجموعه را تأیید کن.", en: "Approve this set's items first." });
      }
      const { rows } = await db.query(
        `update practice_sets set status = 'published', reviewed_by = $2, reviewed_at = now()
         where id = $1 and status = 'in_review' returning id`,
        [id, user.id],
      );
      if (!rows[0]) throw new ApiError(409, "conflict");
      return rows[0];
    },

    /**
     * Publish a placement version that is in review. Every section item must already be published.
     * @returns {Promise<{id: string}>} @throws {ApiError} 409 when items are unpublished or the version is not in review
     */
    async approvePlacementVersion(user, id) {
      const unpublished = await db.query(
        `select 1 from placement_section_items psi
         join content_items i on i.id = psi.item_id
         join placement_sections s on s.id = psi.section_id
         where s.version_id = $1 and i.status <> 'published'`,
        [id],
      );
      if (unpublished.rows.length) {
        throw new ApiError(409, "conflict", { fa: "اول سؤال‌های تعیین سطح را تأیید کن.", en: "Approve the placement items first." });
      }
      const { rows } = await db.query(
        `update placement_versions set status = 'published', reviewed_by = $2, reviewed_at = now()
         where id = $1 and status = 'in_review' returning id`,
        [id, user.id],
      );
      if (!rows[0]) throw new ApiError(409, "conflict");
      return rows[0];
    },

    async publishedByIds(ids) {
      if (!ids.length) return [];
      const { rows } = await db.query(
        `select ${ITEM_COLUMNS} from content_items
         where id = any($1::uuid[]) and status = 'published' and not is_dev_fixture`,
        [ids],
      );
      return rows;
    },
  };
}
