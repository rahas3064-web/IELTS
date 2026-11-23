// Pure rules for placement intake. They mirror server/routes/onboarding.js;
// the server stays the authority and its field errors are shown if it disagrees.

export const TARGET_BANDS = [5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9] as const;
/** Saved on step 3 so onboarding can finish without a habits form. Saturday–Wednesday. */
export const DEFAULT_DAILY_MINUTES = 10;
export const DEFAULT_STUDY_DAYS = [0, 1, 2, 3, 4] as const;

export const PLACEMENT_TIMES = {
  quick: { listening: 5, reading: 6, writing: 5, speaking: 4, total: 20 },
  full: { listening: 12, reading: 16, writing: 15, speaking: 12, total: 55 },
} as const;

export type ExamType = "academic" | "general";
export type PlacementMode = keyof typeof PLACEMENT_TIMES;
export type DatePrecision = "exact" | "unknown";

export type GoalDraft = {
  target: number | null;
  precision: DatePrecision | null;
  /** `YYYY-MM-DD` when precision is exact. */
  date: string;
};

export type GoalPayload = {
  step: 2;
  targetBand: number;
  examDatePrecision: DatePrecision;
  examDate?: string;
};

export type GoalErrors = Partial<Record<"target" | "precision" | "examDate", string>>;
export type GoalResult = { ok: true; payload: GoalPayload } | { ok: false; errors: GoalErrors };

export const emptyGoal = (): GoalDraft => ({ target: null, precision: null, date: "" });

/** The Tehran calendar day (`YYYY-MM-DD`) for an instant. */
export function tehranToday(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Tomorrow's day: exact exam dates must be after today (server rule). */
export function minExactDate(today: string): string {
  const [year, month, day] = today.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return next.toISOString().slice(0, 10);
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function isTargetBand(value: number | null): value is (typeof TARGET_BANDS)[number] {
  return value !== null && (TARGET_BANDS as readonly number[]).includes(value);
}

export function validateGoal(draft: GoalDraft, today: string): GoalResult {
  const errors: GoalErrors = {};
  if (!isTargetBand(draft.target)) errors.target = "onboarding.error.target";
  if (draft.precision === null) errors.precision = "onboarding.error.precision";
  else if (draft.precision === "exact") {
    if (draft.date === "") errors.examDate = "onboarding.error.dateRequired";
    else if (!DAY_RE.test(draft.date)) errors.examDate = "onboarding.error.dateInvalid";
    else if (draft.date < minExactDate(today)) errors.examDate = "onboarding.error.datePast";
  }
  if (Object.keys(errors).length > 0 || draft.precision === null || !isTargetBand(draft.target)) return { ok: false, errors };
  return {
    ok: true,
    payload: {
      step: 2,
      targetBand: draft.target,
      examDatePrecision: draft.precision,
      ...(draft.precision === "exact" ? { examDate: draft.date } : {}),
    },
  };
}

/** Step 3 finishes onboarding. Mode is omitted when the learner skips. */
export function placementStep(mode: PlacementMode | null): { step: 3; placementMode?: PlacementMode } {
  return mode ? { step: 3, placementMode: mode } : { step: 3 };
}
