import { describe, expect, it } from "vitest";
import { matchesAccepted, normalizeAnswer, scoreObjective } from "./objective.js";

describe("normalizeAnswer", () => {
  it("is case-insensitive, trims and collapses whitespace", () => {
    expect(normalizeAnswer("  Climate   CHANGE ")).toBe("climate change");
    expect(normalizeAnswer("a\t\nb")).toBe("a b");
  });

  it("strips trailing punctuation only", () => {
    expect(normalizeAnswer("Library.")).toBe("library");
    expect(normalizeAnswer("library ?!")).toBe("library");
    expect(normalizeAnswer("well-known")).toBe("well-known");
    expect(normalizeAnswer("3.5")).toBe("3.5");
  });

  it("treats null, undefined and blank as empty and stringifies numbers", () => {
    expect(normalizeAnswer(null)).toBe("");
    expect(normalizeAnswer(undefined)).toBe("");
    expect(normalizeAnswer("   ")).toBe("");
    expect(normalizeAnswer(42)).toBe("42");
  });
});

describe("matchesAccepted", () => {
  it("matches any accepted variant after normalisation", () => {
    expect(matchesAccepted(" Six. ", ["six", "6"])).toBe(true);
    expect(matchesAccepted("6", ["six", "6"])).toBe(true);
    expect(matchesAccepted("seven", ["six", "6"])).toBe(false);
  });

  it("never matches an empty answer, even against an empty variant", () => {
    expect(matchesAccepted("", [""])).toBe(false);
    expect(matchesAccepted(" . ", ["."])).toBe(false);
    expect(matchesAccepted("x", [])).toBe(false);
  });
});

describe("scoreObjective", () => {
  const items = [
    { id: "q1", answer_key: { correct: "TRUE" } },
    { id: "q2", answer_key: { correct: "railway station", accepted: ["train station", "the railway station"] } },
    { id: "q3", answer_key: { correct: ["A", "C"] } },
    { id: "q4", answer_key: { correct: "B" } },
  ];

  it("scores single, gap-fill and multi-select items", () => {
    const result = scoreObjective(items, {
      q1: "true",
      q2: "Train station.",
      q3: ["c", "a"],
      q4: "A",
    });
    expect(result.raw).toBe(3);
    expect(result.max).toBe(4);
    expect(result.perItem).toEqual([
      { id: "q1", answered: true, correct: true },
      { id: "q2", answered: true, correct: true },
      { id: "q3", answered: true, correct: true },
      { id: "q4", answered: true, correct: false },
    ]);
  });

  it("requires set equality for multi-select (no partial credit, no extras)", () => {
    const only = (answer) => scoreObjective([items[2]], { q3: answer }).raw;
    expect(only(["A"])).toBe(0);
    expect(only(["A", "B", "C"])).toBe(0);
    expect(only(["A", "A"])).toBe(0);
    expect(only(["A", "C", "C"])).toBe(1);
    expect(only("A")).toBe(0);
    expect(only([])).toBe(0);
  });

  it("counts unanswered items in max but not in raw, and flags them", () => {
    const result = scoreObjective(items, { q1: "TRUE" });
    expect(result.raw).toBe(1);
    expect(result.max).toBe(4);
    expect(result.perItem.map((item) => item.answered)).toEqual([true, false, false, false]);
  });

  it("returns an empty score for no items and does not guess a band", () => {
    const result = scoreObjective([], {});
    expect(result).toEqual({ raw: 0, max: 0, perItem: [] });
    expect(Object.keys(scoreObjective(items, {}))).toEqual(["raw", "max", "perItem"]);
  });

  it("does not mutate its inputs", () => {
    const answers = { q3: ["c", "a"] };
    const snapshot = JSON.stringify({ items, answers });
    scoreObjective(items, answers);
    expect(JSON.stringify({ items, answers })).toBe(snapshot);
  });

  it("fails loudly on a malformed answer key instead of silently scoring 0", () => {
    expect(() => scoreObjective([{ id: "bad" }], {})).toThrow(TypeError);
    expect(() => scoreObjective([{ id: "bad", answer_key: { correct: 5 } }], {})).toThrow(TypeError);
    expect(() => scoreObjective([{ id: "bad", answer_key: { correct: [] } }], {})).toThrow(TypeError);
  });
});
