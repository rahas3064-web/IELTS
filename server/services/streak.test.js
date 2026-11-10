import { describe, expect, it } from "vitest";
import { addDays } from "../core/tehran-time.js";
import { computeStreak, deriveCachedStreak } from "./streak.js";

// 2026-11-07 is a Saturday (weekday index 0) in the Iranian week.
const SAT = "2026-11-07";
const day = (offset, from = SAT) => addDays(from, offset);
const run = (from, length) => Array.from({ length }, (_, i) => day(i, from));

describe("computeStreak (plain consecutive days)", () => {
  it("is all zeros without activity", () => {
    expect(computeStreak([], SAT)).toEqual({ current: 0, best: 0, activeToday: false });
  });

  it("counts a single day of activity today", () => {
    expect(computeStreak([SAT], SAT)).toEqual({ current: 1, best: 1, activeToday: true });
  });

  it("keeps yesterday's run alive while today is still empty (activeToday=false)", () => {
    expect(computeStreak(run(day(-3), 3), SAT)).toEqual({ current: 3, best: 3, activeToday: false });
  });

  it("counts consecutive days ending today", () => {
    expect(computeStreak(run(day(-2), 3), SAT)).toEqual({ current: 3, best: 3, activeToday: true });
  });

  it("resets current to 0 after a missed day but remembers the best run", () => {
    const days = run(day(-6), 4); // -6..-3, then nothing since
    expect(computeStreak(days, SAT)).toEqual({ current: 0, best: 4, activeToday: false });
  });

  it("a gap splits runs: current is the latest run, best the longest", () => {
    const days = [day(-9), day(-8), day(-7), day(-1), SAT];
    expect(computeStreak(days, SAT)).toEqual({ current: 2, best: 3, activeToday: true });
  });

  it("keeps counting across the Friday -> Saturday week boundary", () => {
    const friday = "2026-11-13";
    const nextSaturday = "2026-11-14";
    expect(computeStreak([day(0, friday), nextSaturday], nextSaturday)).toMatchObject({ current: 2, best: 2 });
  });

  it("ignores duplicates, order and activity dated after today", () => {
    const days = [SAT, day(-1), SAT, day(-2), day(3)];
    expect(computeStreak(days, SAT)).toEqual({ current: 3, best: 3, activeToday: true });
  });

  it("does not mutate its input", () => {
    const days = Object.freeze([SAT, day(-1)]);
    expect(() => computeStreak(days, SAT)).not.toThrow();
  });

  it("rejects malformed days", () => {
    expect(() => computeStreak(["2026-13-40"], SAT)).toThrow(TypeError);
    expect(() => computeStreak([], "today")).toThrow(TypeError);
  });
});

describe("computeStreak with the rest-day exemption", () => {
  // Study days Saturday(0), Monday(2), Wednesday(4); Sunday(1), Tuesday(3) are rest days.
  const studyDays = [0, 2, 4];
  const on = { skipRestDays: true, studyDays };
  const MON = day(2);
  const WED = day(4);

  it("is off by default: a rest day with no activity breaks the run", () => {
    expect(computeStreak([SAT, MON], MON, { studyDays })).toEqual({ current: 1, best: 1, activeToday: true });
  });

  it("rest days neither count nor break the run when on", () => {
    expect(computeStreak([SAT, MON, WED], WED, on)).toEqual({ current: 3, best: 3, activeToday: true });
  });

  it("a missed study day still breaks the run", () => {
    expect(computeStreak([SAT, WED], WED, on)).toEqual({ current: 1, best: 1, activeToday: true });
  });

  it("on a rest day today the run stays alive, activeToday is false", () => {
    const tuesday = day(3);
    expect(computeStreak([SAT, MON], tuesday, on)).toEqual({ current: 2, best: 2, activeToday: false });
  });

  it("does not count activity done on a rest day", () => {
    const sunday = day(1);
    expect(computeStreak([SAT, sunday, MON], MON, on)).toEqual({ current: 2, best: 2, activeToday: true });
  });

  it("the today-grace still applies on a study day with the exemption on", () => {
    const tuesday = day(3);
    expect(computeStreak([SAT, MON], WED, on)).toEqual({ current: 2, best: 2, activeToday: false });
    expect(computeStreak([SAT, MON], tuesday, on).current).toBe(2);
  });

  it("with no study days every day is a rest day and nothing counts", () => {
    expect(computeStreak([SAT, MON], MON, { skipRestDays: true, studyDays: [] })).toEqual({
      current: 0, best: 0, activeToday: false,
    });
  });
});

describe("deriveCachedStreak (cache re-derived against today)", () => {
  const cache = (lastActiveDay, current = 5, best = 9) => ({ current, best, lastActiveDay });

  it("shows nothing when no cache row exists", () => {
    expect(deriveCachedStreak(null, SAT)).toEqual({ current: 0, best: 0, activeToday: false });
  });

  it("active today: keeps the cached current", () => {
    expect(deriveCachedStreak(cache(SAT), SAT)).toEqual({ current: 5, best: 9, activeToday: true });
  });

  it("last active yesterday: still alive, not active today", () => {
    expect(deriveCachedStreak(cache(day(-1)), SAT)).toEqual({ current: 5, best: 9, activeToday: false });
  });

  it("a stale cache from before yesterday reads as 0 (best survives)", () => {
    expect(deriveCachedStreak(cache(day(-2)), SAT)).toEqual({ current: 0, best: 9, activeToday: false });
  });

  it("rest days between the last active day and today keep it alive when the exemption is on", () => {
    // Monday (study day) was the last counted day; Tuesday is a rest day; today is Wednesday.
    const on = { skipRestDays: true, studyDays: [0, 2, 4] };
    expect(deriveCachedStreak(cache(day(2)), day(4), on)).toEqual({ current: 5, best: 9, activeToday: false });
    expect(deriveCachedStreak(cache(day(2)), day(4)).current).toBe(0); // off: Tuesday was missed
  });

  it("the exemption does not rescue a missed study day", () => {
    const on = { skipRestDays: true, studyDays: [0, 2, 4] };
    // Last counted Saturday; Monday (study day) was missed; today is Tuesday.
    expect(deriveCachedStreak(cache(day(0)), day(3), on).current).toBe(0);
  });
});
