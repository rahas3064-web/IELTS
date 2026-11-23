// Original paragraph-structure lesson. Apply is a mini task, not an official IELTS task.
import { countWords } from "../avalai.js";

export const STAGES = Object.freeze(["learn", "practice", "apply", "review"]);
export const APPLY_MIN = 40;
export const APPLY_MAX = 60;

/** 51 words. Used to show the mini-task range honestly. */
export const SAMPLE_APPLY = "I keep my writing practice short every evening. I choose one small topic and write a topic sentence first. Then I add one reason that supports it. After that I give a real example from the same day. For example I described my quiet walk home in four plain sentences today.";

const CHOICES = Object.freeze({
  topic: "Daily writing practice stays short on purpose.",
  example: "For example, I spend ten minutes describing the quiet walk home.",
});

export function lessonContent() {
  return {
    skill: "writing",
    titleFa: "ساختار پاراگراف",
    minuteMin: 5,
    minuteMax: 10,
    stages: STAGES,
    example: {
      topic: "Daily writing practice stays short on purpose.",
      support: "A small topic is easier to finish than a long essay.",
      example: "For example, I spend ten minutes describing the quiet walk home.",
    },
    choices: Object.entries(CHOICES).map(([id, text]) => ({ id, text })),
    applyMin: APPLY_MIN,
    applyMax: APPLY_MAX,
  };
}

/** Correct choice is the topic sentence. The example sentence is the near miss. */
export function gradePractice(choice) {
  if (choice === "topic") return { result: "correct", answer: "topic" };
  if (choice === "example") return { result: "almost", answer: "topic" };
  return null;
}

export function applyEstimate(words) {
  if (words >= APPLY_MIN && words <= APPLY_MAX) return "in_range";
  if (words < APPLY_MIN) return "short";
  return "long";
}

/** Move at most one stage forward. A refresh may save the same stage again. */
export function stageStep(from, to) {
  const start = STAGES.indexOf(from);
  const next = STAGES.indexOf(to);
  if (start < 0 || next < 0) return false;
  return next === start || next === start + 1;
}

export function lessonView(saved = {}) {
  const words = countWords(saved.applyText ?? "");
  const graded = saved.practice ? gradePractice(saved.practice) : null;
  return {
    ...lessonContent(),
    stage: saved.stage ?? "learn",
    practice: saved.practice ?? null,
    applyText: saved.applyText ?? "",
    words,
    estimate: applyEstimate(words),
    result: graded?.result ?? null,
    answer: graded?.answer ?? null,
  };
}
