import { describe, expect, it } from "vitest";
import { countWords } from "../avalai.js";
import { SAMPLE_APPLY, applyEstimate, gradePractice, lessonView, stageStep } from "./lesson.js";

describe("paragraph lesson", () => {
  it("grades the topic sentence as correct and the example as almost", () => {
    expect(gradePractice("topic").result).toBe("correct");
    expect(gradePractice("example")).toEqual({ result: "almost", answer: "topic" });
    expect(gradePractice("other")).toBeNull();
  });

  it("counts the mini apply as 51 words inside 40 to 60", () => {
    const words = countWords(SAMPLE_APPLY);
    expect(words).toBe(51);
    expect(applyEstimate(words)).toBe("in_range");
    expect(applyEstimate(12)).toBe("short");
    expect(lessonView({ stage: "apply", practice: "topic", applyText: SAMPLE_APPLY }).words).toBe(51);
  });

  it("resumes the saved stage and refuses a skip ahead", () => {
    expect(stageStep("learn", "practice")).toBe(true);
    expect(stageStep("practice", "practice")).toBe(true);
    expect(stageStep("learn", "review")).toBe(false);
    expect(stageStep("review", "learn")).toBe(false);
  });
});
