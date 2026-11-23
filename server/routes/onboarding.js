// PUT /api/onboarding: type, goal, then placement mode. Step 3 completes onboarding
// with the default study week. Mode is optional so skip can finish without one.
import express from "express";
import { ApiError } from "../core/errors.js";
import { addDays, tehranDay, tehranMonthKey } from "../core/tehran-time.js";
import { parseBody, v } from "../core/validate.js";
import { loadMe } from "./me-payload.js";
import { fieldFailure, wrap } from "./util.js";

const TARGET_BANDS = [5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9];
const DEFAULT_STUDY_DAYS = [0, 1, 2, 3, 4];
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

const stepSchema = v.object({ step: v.oneOf([1, 2, 3]) });
const stepSchemas = {
  1: v.object({ step: v.oneOf([1]), examType: v.oneOf(["academic", "general"]) }),
  2: v.object({
    step: v.oneOf([2]),
    targetBand: v.oneOf(TARGET_BANDS),
    examDatePrecision: v.oneOf(["exact", "unknown"]),
    examDate: v.optional(v.string({ max: 10 })),
  }),
  3: v.object({
    step: v.oneOf([3]),
    placementMode: v.optional(v.oneOf(["quick", "full"])),
  }),
};

const previousStepRequired = () =>
  new ApiError(400, "validation_failed", {
    fa: "اول مرحله‌های قبلی رو کامل کن.",
    en: "Complete the previous steps first.",
    details: { field: "step", reason: "previous_step_required" },
  });

/** @returns {string|null} the stored date for a precision, throws on invalid input */
function resolveExamDate({ examDatePrecision, examDate }, at) {
  if (examDatePrecision === "unknown") return null;
  if (examDate === undefined) throw fieldFailure("examDate", "required");
  const today = tehranDay(at);
  if (examDatePrecision === "exact") {
    if (!DAY_RE.test(examDate)) throw fieldFailure("examDate", "invalid_format");
    try {
      addDays(examDate, 0); // validates the calendar day
    } catch {
      throw fieldFailure("examDate", "invalid_format");
    }
    if (examDate <= today) throw fieldFailure("examDate", "too_small");
    return examDate;
  }
  if (!MONTH_RE.test(examDate)) throw fieldFailure("examDate", "invalid_format");
  if (examDate < tehranMonthKey(at)) throw fieldFailure("examDate", "too_small");
  return `${examDate}-01`;
}

/** Days are validated integers 0-6, so a literal array string is safe on pg and PGlite alike. */
const pgIntArray = (values) => `{${values.join(",")}}`;

/** @param {ReturnType<import("../auth/context.js").createAuthContext>} ctx */
export function onboardingRoutes(ctx) {
  const router = express.Router();
  const { db, now } = ctx;

  async function saveStep(userId, body) {
    if (body.step === 1) {
      await db.query(
        `insert into learner_profiles (user_id, exam_type) values ($1, $2)
         on conflict (user_id) do update set exam_type = excluded.exam_type`,
        [userId, body.examType],
      );
      return;
    }
    const result =
      body.step === 2
        ? await db.query(
            `update learner_profiles
             set target_band = $2, exam_date = $3::date, exam_date_precision = $4
             where user_id = $1 and exam_type is not null returning user_id`,
            [userId, body.targetBand, resolveExamDate(body, now()), body.examDatePrecision],
          )
        : await db.query(
            `update learner_profiles
             set placement_mode = coalesce($2, placement_mode),
                 daily_minutes = 10,
                 study_days = $3::smallint[],
                 onboarding_completed_at = coalesce(onboarding_completed_at, $4)
             where user_id = $1 and exam_type is not null and exam_date_precision is not null
             returning user_id`,
            [userId, body.placementMode ?? null, pgIntArray(DEFAULT_STUDY_DAYS), now()],
          );
    if (result.rows.length === 0) throw previousStepRequired();
  }

  router.put(
    "/onboarding",
    ctx.originGuard,
    ctx.requireUser(),
    wrap(async (req, res) => {
      const { step } = parseBody(stepSchema, req.body);
      const body = parseBody(stepSchemas[step], req.body);
      await saveStep(req.user.id, body);
      res.json(await loadMe(db, req.user.id, ctx.now()));
    }),
  );

  return router;
}
