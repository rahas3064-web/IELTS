// Exam countdown for the panel header (spec S2). Pure: dates are Tehran days 'YYYY-MM-DD'.
//
// Rulings: a passed exam date never yields a negative number: `days` is null and
// `past` is true. An approximate date is stored as the first day of its month, so
// inside that month there is no honest day count (days null, past false); it is
// "past" only once the whole month is over.
import { addDays, daysBetween } from "../core/tehran-time.js";

/** @typedef {{days: number|null, date: string|null, precision: 'exact'|'approx'|'unknown'|null, past: boolean}} ExamCountdown */

/** Last day of the month that `firstOfMonth` ('YYYY-MM-01') starts. */
function monthEnd(firstOfMonth) {
  const [year, month] = firstOfMonth.split("-").map(Number);
  const nextMonth = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
  return addDays(nextMonth, -1);
}

/**
 * @param {{examDate: string|null, precision: string|null}|null} goal
 * @param {string} today Tehran day
 * @returns {ExamCountdown}
 */
export function examCountdown(goal, today) {
  const precision = goal?.precision ?? null;
  const date = goal?.examDate ?? null;
  if (date === null || (precision !== "exact" && precision !== "approx")) {
    return { days: null, date: null, precision: precision === "unknown" ? "unknown" : null, past: false };
  }
  if (precision === "exact") {
    const days = daysBetween(today, date);
    return days < 0 ? { days: null, date, precision, past: true } : { days, date, precision, past: false };
  }
  if (today > monthEnd(date)) return { days: null, date, precision, past: true };
  return { days: date > today ? daysBetween(today, date) : null, date, precision, past: false };
}
