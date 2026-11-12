import { describe, expect, it } from "vitest";
import {
  DAILY_MINUTES,
  TARGET_BANDS,
  WEEKDAY_IDS,
  emptyHabits,
  minExactDate,
  minApproxMonth,
  tehranToday,
  toggleDay,
  validateHabits,
} from "@/components/features/bandora/panel/onboarding/onboarding-rules";

const TODAY = "2026-11-10";

describe("option lists", () => {
  it("match the spec", () => {
    expect(TARGET_BANDS).toEqual([5.5, 6, 6.5, 7, 7.5, 8, 8.5]);
    expect(DAILY_MINUTES).toEqual([15, 30, 45, 60, 90]);
    expect(WEEKDAY_IDS).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
});

describe("tehranToday", () => {
  it("uses the Tehran calendar day, not UTC", () => {
    // 21:00 UTC on the 10th is already 00:30 on the 11th in Tehran (UTC+3:30).
    expect(tehranToday(new Date("2026-11-10T21:00:00Z"))).toBe("2026-11-11");
    expect(tehranToday(new Date("2026-11-10T12:00:00Z"))).toBe("2026-11-10");
  });

  it("derives the earliest allowed dates", () => {
    expect(minExactDate(TODAY)).toBe("2026-11-11");
    expect(minExactDate("2026-12-31")).toBe("2027-01-01");
    expect(minApproxMonth(TODAY)).toBe("2026-11");
  });
});

describe("toggleDay", () => {
  it("adds and removes days without mutating the input, keeping order", () => {
    const start = [0, 2];
    expect(toggleDay(start, 1)).toEqual([0, 1, 2]);
    expect(toggleDay(start, 2)).toEqual([0]);
    expect(start).toEqual([0, 2]);
  });
});

describe("validateHabits", () => {
  const ready = { ...emptyHabits(), dailyMinutes: 45, studyDays: [0, 2, 4] };

  it("builds an exact-date payload", () => {
    const result = validateHabits({ ...ready, precision: "exact", date: "2027-01-20" }, TODAY);
    expect(result).toEqual({
      ok: true,
      payload: { step: 3, examDatePrecision: "exact", examDate: "2027-01-20", dailyMinutes: 45, studyDays: [0, 2, 4] },
    });
  });

  it("builds an approximate-month payload", () => {
    const result = validateHabits({ ...ready, precision: "approx", date: "2027-02" }, TODAY);
    expect(result).toMatchObject({ ok: true, payload: { examDatePrecision: "approx", examDate: "2027-02" } });
  });

  it("omits the date when unknown", () => {
    const result = validateHabits({ ...ready, precision: "unknown", date: "2027-02" }, TODAY);
    expect(result.ok).toBe(true);
    if (result.ok) expect("examDate" in result.payload).toBe(false);
  });

  it("requires a date precision choice", () => {
    expect(validateHabits({ ...ready, precision: null }, TODAY)).toMatchObject({
      ok: false,
      errors: { precision: "onboarding.error.precision" },
    });
  });

  it("requires a date for exact and approximate, and it must be in the future", () => {
    expect(validateHabits({ ...ready, precision: "exact", date: "" }, TODAY)).toMatchObject({
      ok: false,
      errors: { examDate: "onboarding.error.dateRequired" },
    });
    expect(validateHabits({ ...ready, precision: "exact", date: TODAY }, TODAY)).toMatchObject({
      ok: false,
      errors: { examDate: "onboarding.error.datePast" },
    });
    expect(validateHabits({ ...ready, precision: "approx", date: "2026-10" }, TODAY)).toMatchObject({
      ok: false,
      errors: { examDate: "onboarding.error.datePast" },
    });
  });

  it("requires daily minutes and at least one study day", () => {
    const result = validateHabits({ ...emptyHabits(), precision: "unknown" }, TODAY);
    expect(result).toMatchObject({
      ok: false,
      errors: { dailyMinutes: "onboarding.error.minutes", studyDays: "onboarding.error.days" },
    });
  });
});
