import { describe, expect, it } from "vitest";
import { daysBetween } from "../core/tehran-time.js";
import { examCountdown } from "./exam-countdown.js";

const TODAY = "2026-11-10";

describe("daysBetween", () => {
  it("is the signed whole-day difference between two Tehran days", () => {
    expect(daysBetween("2026-11-10", "2026-12-22")).toBe(42);
    expect(daysBetween("2026-11-10", "2026-11-10")).toBe(0);
    expect(daysBetween("2026-11-10", "2026-11-09")).toBe(-1);
    expect(daysBetween("2026-12-31", "2027-01-01")).toBe(1);
  });

  it("rejects malformed days", () => {
    expect(() => daysBetween("2026-11-10", "soon")).toThrow(TypeError);
  });
});

describe("examCountdown", () => {
  it("has nothing to show before the goal is set", () => {
    expect(examCountdown(null, TODAY)).toEqual({ days: null, date: null, precision: null, past: false });
    expect(examCountdown({ examDate: null, precision: null }, TODAY)).toEqual({ days: null, date: null, precision: null, past: false });
  });

  it("an unknown date stays unknown (precision is reported)", () => {
    expect(examCountdown({ examDate: null, precision: "unknown" }, TODAY)).toEqual({
      days: null, date: null, precision: "unknown", past: false,
    });
  });

  it("counts the Tehran days to an exact date", () => {
    expect(examCountdown({ examDate: "2026-12-22", precision: "exact" }, TODAY)).toEqual({
      days: 42, date: "2026-12-22", precision: "exact", past: false,
    });
  });

  it("the exam day itself is day 0, not past", () => {
    expect(examCountdown({ examDate: TODAY, precision: "exact" }, TODAY)).toMatchObject({ days: 0, past: false });
  });

  it("flags a passed exact date instead of a negative number", () => {
    expect(examCountdown({ examDate: "2026-11-09", precision: "exact" }, TODAY)).toEqual({
      days: null, date: "2026-11-09", precision: "exact", past: true,
    });
  });

  describe("approximate (stored as the first of the month)", () => {
    it("counts to the start of a future month", () => {
      expect(examCountdown({ examDate: "2027-01-01", precision: "approx" }, TODAY)).toEqual({
        days: 52, date: "2027-01-01", precision: "approx", past: false,
      });
    });

    it("inside the stated month there is no honest day count, and it is not past", () => {
      expect(examCountdown({ examDate: "2026-11-01", precision: "approx" }, TODAY)).toEqual({
        days: null, date: "2026-11-01", precision: "approx", past: false,
      });
      expect(examCountdown({ examDate: "2026-11-01", precision: "approx" }, "2026-11-30")).toMatchObject({ past: false });
    });

    it("is past only once the whole month is over", () => {
      expect(examCountdown({ examDate: "2026-10-01", precision: "approx" }, TODAY)).toEqual({
        days: null, date: "2026-10-01", precision: "approx", past: true,
      });
      expect(examCountdown({ examDate: "2026-11-01", precision: "approx" }, "2026-12-01")).toMatchObject({ past: true });
    });

    it("handles December -> January month ends", () => {
      expect(examCountdown({ examDate: "2026-12-01", precision: "approx" }, "2026-12-31")).toMatchObject({ past: false });
      expect(examCountdown({ examDate: "2026-12-01", precision: "approx" }, "2027-01-01")).toMatchObject({ past: true });
    });
  });
});
