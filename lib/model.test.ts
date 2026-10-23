import { describe, expect, it } from "vitest";
import { assessWriting, overallBand, readinessIndex, roundBand, scoreMockPaper, scorePlacement } from "@/lib/model";
import { emptyPlacement } from "@/lib/store";
import { mockArchiveScope } from "@/lib/questions";

const base = { listening: 6, reading: 6, writing: 6, speaking: 6 };

describe("band rounding", () => {
  it("rounds the overall average to the nearest half band", () => {
    expect(roundBand(6.25)).toBe(6.5);
    expect(roundBand(6.24)).toBe(6);
    expect(overallBand({ listening: 6.5, reading: 6.5, writing: 6, speaking: 6 })).toBe(6.5);
  });

  it("does not present a short Task 2 as a high writing band", () => {
    expect(assessWriting("", "too short").band).toBeLessThanOrEqual(3.5);
    expect(assessWriting("", "too short").simulated).toBe(true);
  });
});

describe("placement gate", () => {
  it("does not score until all four skills are submitted", () => {
    const placement = emptyPlacement();
    placement.done.listening = "2026-01-01T00:00:00.000Z";
    expect(scorePlacement(placement)).toBeNull();
  });
});

describe("mock scoring", () => {
  it("changes the writing band from the writing-only paper", () => {
    const blank = scoreMockPaper({ scope: "writing", itemIds: ["M-W1", "W2"], answers: {}, base });
    const paragraph = "however therefore although moreover because for example on the other hand firstly secondly finally also";
    const long = `${Array.from({ length: 80 }, (_, index) => `idea${index}`).join(" ")} ${paragraph}`;
    const written = scoreMockPaper({
      scope: "writing",
      itemIds: ["M-W1", "W2"],
      answers: {
        "M-W1": long,
        W2: `${long}\n\n${long}\n\n${long}\n\n${long}`,
      },
      base,
    });
    expect(written.bands.writing).toBeGreaterThan(blank.bands.writing);
    expect(written.bands.listening).toBe(base.listening);
  });

  it("does not relabel a writing mock as listening in the archive", () => {
    expect(mockArchiveScope("mock-writing-1")).toBe("writing");
    expect(mockArchiveScope("mock-listening-1")).toBe("listening");
    expect(mockArchiveScope("mock-mini-1")).toBe("full");
    expect(mockArchiveScope("missing")).toBe("full");
  });
});

describe("readiness", () => {
  it("stays inside 0 to 100 and is not a pass probability", () => {
    const result = readinessIndex({
      bands: base,
      targets: { listening: 7.5, reading: 7.5, writing: 7, speaking: 7.5 },
      stability: 72,
      trend: 0.5,
      adherence: 78,
      confidence: 61,
    });
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.parts.reduce((sum, part) => sum + part.weight, 0)).toBeCloseTo(1);
  });
});
