import { describe, expect, it } from "vitest";
import { overallBand, roundHalf } from "./band.js";

describe("roundHalf", () => {
  it.each([
    [6.25, 6.5],
    [6.75, 7.0],
    [6.125, 6.0],
    [6.625, 6.5],
    [7, 7],
    [6.5, 6.5],
    [0, 0],
  ])("roundHalf(%s) = %s", (input, expected) => {
    expect(roundHalf(input)).toBe(expected);
  });
});

describe("overallBand", () => {
  it("rounds the mean per the official rule", () => {
    expect(overallBand([6, 6, 6.5, 6.5])).toBe(6.5); // 6.25
    expect(overallBand([7, 7, 7, 6])).toBe(7.0); // 6.75
    expect(overallBand([6, 6, 6, 6.5])).toBe(6.0); // 6.125
    expect(overallBand([6.5, 6.5, 6.5, 6.5])).toBe(6.5);
    expect(overallBand([7, 7, 7, 7])).toBe(7.0);
    expect(overallBand([6.5, 6.5, 6.5, 6])).toBe(6.5); // 6.375
    expect(overallBand([6.5, 6.5, 6.5, 7])).toBe(6.5); // 6.625
  });

  it("returns null for invalid input", () => {
    expect(overallBand([6, 6, 6])).toBeNull();
    expect(overallBand([6, 6, 6, 6, 6])).toBeNull();
    expect(overallBand([6, 6, 6, null])).toBeNull();
    expect(overallBand([6, 6, 6, undefined])).toBeNull();
    expect(overallBand([6, 6, 6, NaN])).toBeNull();
    expect(overallBand([6, 6, 6, "6"])).toBeNull();
    expect(overallBand(null)).toBeNull();
    expect(overallBand(undefined)).toBeNull();
    expect(overallBand("6666")).toBeNull();
  });

  it("does not mutate its input", () => {
    const bands = Object.freeze([6, 6, 6.5, 6.5]);
    expect(() => overallBand(bands)).not.toThrow();
  });
});
