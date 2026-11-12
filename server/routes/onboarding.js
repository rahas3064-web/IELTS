// PUT /api/onboarding: three validated steps (spec S1). Each step writes its own
// columns; step 3 also completes onboarding. Returns the refreshed /api/me payload.
import express from "express";
import { ApiError } from "../core/errors.js";
import { addDays, tehranDay, tehranMonthKey } from "../core/tehran-time.js";
import { parseBody, v } from "../core/validate.js";
import { loadMe } from "./me-payload.js";
import { fieldFailure, wrap } from "./util.js";

const TARGET_BANDS = [5.5, 6, 6.5, 7, 7.5, 8, 8.5];
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

const stepSchema = v.object({ step: v.oneOf([1, 2, 3]) });
const stepSchemas = {
  1: v.object({ step: v.oneOf([1]), examType: v.oneOf(["academic", "general"]) }),
  2: v.object({ step: v.oneOf([2]), targetBand: v.nullable(v.oneOf(TARGET_BANDS)) }),
  3: v.object({
    step: v.oneOf([3]),
    examDatePrecision: v.oneOf(["exact", "approx", "unknown"]),
    examDate: v.optional(v.string({ max: 10 })),
    dailyMinutes: v.integer({ min: 10, max: 240 }),
    studyDays: v.array(v.integer({ min: 0, max: 6 }), { min: 1, max: 7, unique: true }),
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
            "update learner_profiles set target_band = $2 where user_id = $1 and exam_type is not null returning user_id",
            [userId, body.targetBand],
          )
        : await db.query(
            `update learner_profiles
             set exam_date = $2::date, exam_date_precision = $3, daily_minutes = $4,
                 study_days = $5::smallint[],
                 onboarding_completed_at = coalesce(onboarding_completed_at, $6)
             where user_id = $1 and exam_type is not null returning user_id`,
            [userId, resolveExamDate(body, now()), body.examDatePrecision, body.dailyMinutes, pgIntArray(body.studyDays), now()],
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
