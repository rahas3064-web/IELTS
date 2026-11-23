import { describe, expect, it } from "vitest";
import {
  DEFAULT_DAILY_MINUTES,
  DEFAULT_STUDY_DAYS,
  PLACEMENT_TIMES,
  TARGET_BANDS,
  emptyGoal,
  minExactDate,
  placementStep,
  tehranToday,
  validateGoal,
} from "@/components/features/bandora/panel/onboarding/onboarding-rules";

const TODAY = "2026-11-10";

describe("option lists", () => {
  it("matches the placement intake spec", () => {
    expect(TARGET_BANDS).toEqual([5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9]);
    expect(DEFAULT_DAILY_MINUTES).toBe(10);
    expect(DEFAULT_STUDY_DAYS).toEqual([0, 1, 2, 3, 4]);
    expect(PLACEMENT_TIMES.quick).toEqual({ listening: 5, reading: 6, writing: 5, speaking: 4, total: 20 });
    expect(PLACEMENT_TIMES.full).toEqual({ listening: 12, reading: 16, writing: 15, speaking: 12, total: 55 });
  });
});

describe("tehranToday", () => {
  it("uses the Tehran calendar day, not UTC", () => {
    expect(tehranToday(new Date("2026-11-10T21:00:00Z"))).toBe("2026-11-11");
    expect(tehranToday(new Date("2026-11-10T12:00:00Z"))).toBe("2026-11-10");
  });

  it("derives the earliest allowed exact date", () => {
    expect(minExactDate(TODAY)).toBe("2026-11-11");
    expect(minExactDate("2026-12-31")).toBe("2027-01-01");
  });
});

describe("validateGoal", () => {
  it("builds an exact-date payload for a half-band from 5.0 to 9.0", () => {
    const result = validateGoal({ ...emptyGoal(), target: 5, precision: "exact", date: "2027-01-20" }, TODAY);
    expect(result).toEqual({
      ok: true,
      payload: { step: 2, targetBand: 5, examDatePrecision: "exact", examDate: "2027-01-20" },
    });
    expect(validateGoal({ ...emptyGoal(), target: 9, precision: "unknown", date: "" }, TODAY)).toMatchObject({
      ok: true,
      payload: { targetBand: 9, examDatePrecision: "unknown" },
    });
  });

  it("omits the date when the learner does not know it yet", () => {
    const result = validateGoal({ ...emptyGoal(), target: 6.5, precision: "unknown", date: "2027-02-01" }, TODAY);
    expect(result.ok).toBe(true);
    if (result.ok) expect("examDate" in result.payload).toBe(false);
  });

  it("requires a target band and a date choice", () => {
    expect(validateGoal({ ...emptyGoal(), precision: "unknown" }, TODAY)).toMatchObject({
      ok: false,
      errors: { target: "onboarding.error.target" },
    });
    expect(validateGoal({ ...emptyGoal(), target: 6 }, TODAY)).toMatchObject({
      ok: false,
      errors: { precision: "onboarding.error.precision" },
    });
    expect(validateGoal({ ...emptyGoal(), target: 6.25, precision: "unknown" }, TODAY)).toMatchObject({
      ok: false,
      errors: { target: "onboarding.error.target" },
    });
  });

  it("requires a future exact date", () => {
    const withBand = { ...emptyGoal(), target: 7 as const };
    expect(validateGoal({ ...withBand, precision: "exact", date: "" }, TODAY)).toMatchObject({
      ok: false,
      errors: { examDate: "onboarding.error.dateRequired" },
    });
    expect(validateGoal({ ...withBand, precision: "exact", date: TODAY }, TODAY)).toMatchObject({
      ok: false,
      errors: { examDate: "onboarding.error.datePast" },
    });
    expect(validateGoal({ ...withBand, precision: "exact", date: "soon" }, TODAY)).toMatchObject({
      ok: false,
      errors: { examDate: "onboarding.error.dateInvalid" },
    });
  });
});

describe("placementStep", () => {
  it("sends the mode when chosen and omits it when skipping", () => {
    expect(placementStep("quick")).toEqual({ step: 3, placementMode: "quick" });
    expect(placementStep("full")).toEqual({ step: 3, placementMode: "full" });
    expect(placementStep(null)).toEqual({ step: 3 });
  });
});
