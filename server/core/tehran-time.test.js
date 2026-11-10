import { describe, expect, it } from "vitest";
import {
  TEHRAN_TZ,
  addDays,
  tehranDay,
  tehranMonthBounds,
  tehranMonthKey,
  tehranNow,
  tehranWeekStart,
  weekdayIndex,
} from "./tehran-time.js";

describe("tehran-time", () => {
  it("exposes the zone name", () => {
    expect(TEHRAN_TZ).toBe("Asia/Tehran");
  });

  describe("tehranDay", () => {
    it("flips at 20:30Z (Tehran midnight, fixed +03:30)", () => {
      expect(tehranDay("2026-11-10T20:29:59Z")).toBe("2026-11-10");
      expect(tehranDay("2026-11-10T20:30:00Z")).toBe("2026-11-11");
      expect(tehranDay("2026-11-10T20:31:00Z")).toBe("2026-11-11");
      expect(tehranDay("2026-11-10T20:29:00Z")).toBe("2026-11-10");
    });

    it("accepts Date, ISO string and epoch number", () => {
      const iso = "2026-07-01T21:00:00Z";
      expect(tehranDay(new Date(iso))).toBe("2026-07-02");
      expect(tehranDay(iso)).toBe("2026-07-02");
      expect(tehranDay(Date.parse(iso))).toBe("2026-07-02");
    });

    it("handles the year boundary", () => {
      expect(tehranDay("2026-12-31T20:29:00Z")).toBe("2026-12-31");
      expect(tehranDay("2026-12-31T20:30:00Z")).toBe("2027-01-01");
    });

    it("throws TypeError on invalid input", () => {
      expect(() => tehranDay("nope")).toThrow(TypeError);
      expect(() => tehranDay(new Date("x"))).toThrow(TypeError);
      expect(() => tehranDay(undefined)).toThrow(TypeError);
      expect(() => tehranDay(null)).toThrow(TypeError);
      expect(() => tehranDay(NaN)).toThrow(TypeError);
      expect(() => tehranDay({})).toThrow(TypeError);
    });
  });

  describe("addDays", () => {
    it("adds and subtracts across month and year boundaries", () => {
      expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
      expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
      expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
      expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
      expect(addDays("2026-11-10", 0)).toBe("2026-11-10");
      expect(addDays("2026-11-10", 30)).toBe("2026-12-10");
    });

    it("rejects malformed days and non-integer n", () => {
      expect(() => addDays("2026-13-01", 1)).toThrow(TypeError);
      expect(() => addDays("2026-02-30", 1)).toThrow(TypeError);
      expect(() => addDays("20261110", 1)).toThrow(TypeError);
      expect(() => addDays("2026-11-10", 1.5)).toThrow(TypeError);
    });
  });

  describe("weekdayIndex", () => {
    it("maps Saturday=0 ... Friday=6", () => {
      expect(weekdayIndex("2026-11-14")).toBe(0); // Saturday
      expect(weekdayIndex("2026-11-15")).toBe(1); // Sunday
      expect(weekdayIndex("2026-11-10")).toBe(3); // Tuesday
      expect(weekdayIndex("2026-11-13")).toBe(6); // Friday
    });
  });

  describe("tehranWeekStart", () => {
    it("returns the Saturday of the containing week", () => {
      expect(tehranWeekStart("2026-11-10T08:00:00Z")).toBe("2026-11-07"); // Tue
      expect(tehranWeekStart("2026-11-07T10:00:00Z")).toBe("2026-11-07"); // Sat itself
    });

    it("rolls Friday to Saturday at Tehran midnight", () => {
      // Friday 2026-11-13 in Tehran until 20:30Z; Saturday after.
      expect(tehranWeekStart("2026-11-13T20:29:00Z")).toBe("2026-11-07");
      expect(tehranWeekStart("2026-11-13T20:30:00Z")).toBe("2026-11-14");
    });

    it("crosses month and year boundaries", () => {
      expect(tehranWeekStart("2027-01-01T10:00:00Z")).toBe("2026-12-26");
    });
  });

  describe("tehranMonthKey", () => {
    it("uses Tehran time at month boundary", () => {
      expect(tehranMonthKey("2026-11-30T20:29:00Z")).toBe("2026-11");
      expect(tehranMonthKey("2026-11-30T20:45:00Z")).toBe("2026-12");
    });

    it("handles year boundary", () => {
      expect(tehranMonthKey("2026-12-31T20:45:00Z")).toBe("2027-01");
    });
  });

  describe("tehranMonthBounds", () => {
    it("returns UTC instants of month start (incl.) and next month start (excl.)", () => {
      const { start, end } = tehranMonthBounds("2026-11-10T12:00:00Z");
      expect(start.toISOString()).toBe("2026-10-31T20:30:00.000Z");
      expect(end.toISOString()).toBe("2026-11-30T20:30:00.000Z");
    });

    it("covers the year boundary", () => {
      const { start, end } = tehranMonthBounds("2026-12-15T00:00:00Z");
      expect(start.toISOString()).toBe("2026-11-30T20:30:00.000Z");
      expect(end.toISOString()).toBe("2026-12-31T20:30:00.000Z");
    });

    it("places an instant just after Tehran month rollover in the next month", () => {
      const { start } = tehranMonthBounds("2026-11-30T20:45:00Z");
      expect(start.toISOString()).toBe("2026-11-30T20:30:00.000Z");
    });
  });

  describe("tehranNow", () => {
    it("returns Tehran day, hour and minute", () => {
      expect(tehranNow("2026-11-10T20:29:00Z")).toEqual({ day: "2026-11-10", hour: 23, minute: 59 });
      expect(tehranNow("2026-11-10T20:31:00Z")).toEqual({ day: "2026-11-11", hour: 0, minute: 1 });
      expect(tehranNow("2026-11-10T04:45:00Z")).toEqual({ day: "2026-11-10", hour: 8, minute: 15 });
    });

    it("throws TypeError on invalid input", () => {
      expect(() => tehranNow("bad")).toThrow(TypeError);
    });
  });
});
