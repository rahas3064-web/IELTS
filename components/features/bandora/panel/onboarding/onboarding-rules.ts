// Pure rules for the three onboarding steps. They mirror server/routes/onboarding.js;
// the server stays the authority and its field errors are shown if it disagrees.

export const TARGET_BANDS = [5.5, 6, 6.5, 7, 7.5, 8, 8.5] as const;
export const DAILY_MINUTES = [15, 30, 45, 60, 90] as const;
/** 0 = Saturday ... 6 = Friday (the Iranian week). */
export const WEEKDAY_IDS = [0, 1, 2, 3, 4, 5, 6] as const;

export type ExamType = "academic" | "general";
export type DatePrecision = "exact" | "approx" | "unknown";

export type HabitsDraft = {
  precision: DatePrecision | null;
  /** `YYYY-MM-DD` for exact, `YYYY-MM` for approx. */
  date: string;
  dailyMinutes: number | null;
  studyDays: number[];
};

export type HabitsPayload = {
  step: 3;
  examDatePrecision: DatePrecision;
  examDate?: string;
  dailyMinutes: number;
  studyDays: number[];
};

export type HabitsErrors = Partial<Record<"precision" | "examDate" | "dailyMinutes" | "studyDays", string>>;

export type HabitsResult = { ok: true; payload: HabitsPayload } | { ok: false; errors: HabitsErrors };

export const emptyHabits = (): HabitsDraft => ({ precision: null, date: "", dailyMinutes: null, studyDays: [] });

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

/** Approximate exam months may start with the current one. */
export function minApproxMonth(today: string): string {
  return today.slice(0, 7);
}

export function toggleDay(days: readonly number[], day: number): number[] {
  const next = days.includes(day) ? days.filter((entry) => entry !== day) : [...days, day];
  return next.sort((a, b) => a - b);
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function dateError(draft: HabitsDraft, today: string): string | null {
  if (draft.precision === "unknown") return null;
  if (draft.date === "") return "onboarding.error.dateRequired";
  if (draft.precision === "exact") {
    if (!DAY_RE.test(draft.date)) return "onboarding.error.dateInvalid";
    return draft.date < minExactDate(today) ? "onboarding.error.datePast" : null;
  }
  if (!MONTH_RE.test(draft.date)) return "onboarding.error.dateInvalid";
  return draft.date < minApproxMonth(today) ? "onboarding.error.datePast" : null;
}

export function validateHabits(draft: HabitsDraft, today: string): HabitsResult {
  const errors: HabitsErrors = {};
  if (draft.precision === null) errors.precision = "onboarding.error.precision";
  else {
    const problem = dateError(draft, today);
    if (problem) errors.examDate = problem;
  }
  if (draft.dailyMinutes === null) errors.dailyMinutes = "onboarding.error.minutes";
  if (draft.studyDays.length === 0) errors.studyDays = "onboarding.error.days";
  if (Object.keys(errors).length > 0 || draft.precision === null || draft.dailyMinutes === null) return { ok: false, errors };
  return {
    ok: true,
    payload: {
      step: 3,
      examDatePrecision: draft.precision,
      ...(draft.precision === "unknown" ? {} : { examDate: draft.date }),
      dailyMinutes: draft.dailyMinutes,
      studyDays: [...draft.studyDays],
    },
  };
}
