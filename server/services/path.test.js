import { describe, expect, it } from "vitest";
import { dailyGoal } from "./streak.js";
import { buildPath, startDecision } from "./path.js";

const node = (id, kind, state, premium = false) => ({ id, kind, premium, state });
const chapters = [
  {
    key: "c1", titleFa: "فصل ۱: از ۵ به ۵٫۵", from: 5, to: 5.5,
    nodes: ["lesson", "practice", "challenge", "review", "checkpoint"].map((kind, index) => node(`a${index}`, kind, index === 0 ? "current" : "locked", kind === "challenge")),
  },
  {
    key: "c2", titleFa: "فصل ۲: از ۵ به ۵٫۵", from: 5, to: 5.5,
    nodes: [
      node("b0", "lesson", "done"), node("b1", "practice", "done"), node("b2", "challenge", "current"),
      node("b3", "review", "locked"), node("b4", "checkpoint", "locked", true),
    ],
  },
  {
    key: "c3", titleFa: "فصل ۳: از ۵٫۵ به ۶", from: 5.5, to: 6,
    nodes: ["lesson", "practice", "challenge", "review", "checkpoint"].map((kind, index) => node(`c${index}`, kind, "locked")),
  },
];

describe("daily goal", () => {
  it("stays inside 0 to 3", () => {
    expect(dailyGoal(0)).toEqual({ done: 0, total: 3 });
    expect(dailyGoal(2)).toEqual({ done: 2, total: 3 });
    expect(dailyGoal(9)).toEqual({ done: 3, total: 3 });
    expect(dailyGoal(undefined)).toEqual({ done: 0, total: 3 });
  });
});

describe("home path", () => {
  it("starts a learner with no placement on chapter 1 and the first node", () => {
    const path = buildPath({ placementCompleted: false, plan: null, chapters });
    expect(path.mode).toBe("start");
    expect(path.chapters).toHaveLength(1);
    expect(path.chapters[0].titleFa).toBe("فصل ۱: از ۵ به ۵٫۵");
    expect(path.chapters[0].nodes[0].state).toBe("current");
    expect(path.chapters[0].nodes.slice(1).every((item) => item.state === "locked")).toBe(true);
  });

  it("follows the saved plan for the first open chapter and locks the next", () => {
    const path = buildPath({ placementCompleted: true, plan: { chapterFrom: 5.5, chapterTo: 6 }, chapters });
    expect(path.mode).toBe("plan");
    expect(path.chapters[0]).toMatchObject({ from: 5.5, to: 6, locked: false });
    expect(path.chapters[0].nodes[0].state).toBe("current");
    expect(path.chapters[1]).toMatchObject({ titleFa: "فصل ۳: از ۵٫۵ به ۶", locked: true });
  });

  it("shows the mid-journey chapter and a locked following chapter", () => {
    const path = buildPath({ placementCompleted: true, plan: null, chapters });
    expect(path.mode).toBe("mid");
    expect(path.chapters[0].titleFa).toBe("فصل ۲: از ۵ به ۵٫۵");
    expect(path.chapters[0].nodes.map((item) => item.state)).toEqual(["done", "done", "current", "locked", "locked"]);
    expect(path.chapters[1].locked).toBe(true);
    expect(path.chapters[1].titleFa).toBe("فصل ۳: از ۵٫۵ به ۶");
  });
});

describe("starting a node", () => {
  const chapter = {
    locked: false,
    nodes: [
      { id: "a", kind: "lesson", state: "done", premium: false },
      { id: "b", kind: "practice", state: "current", premium: false },
      { id: "c", kind: "challenge", state: "locked", premium: true },
      { id: "d", kind: "checkpoint", state: "locked", premium: false },
    ],
  };
  const node = (id) => chapter.nodes.find((item) => item.id === id);

  it("starts the current free node and refuses a locked or unpaid premium node", () => {
    expect(startDecision({ node: node("b"), chapter, premium: false }).ok).toBe(true);
    expect(startDecision({ node: node("b"), chapter, premium: false }).lessonUrl).toBe("/app/lessons/b");
    expect(startDecision({ node: node("c"), chapter, premium: false }).reason).toBe("previous");
    const openPremium = { ...chapter, nodes: chapter.nodes.map((item) => item.id === "c" ? { ...item, state: "current" } : item) };
    expect(startDecision({ node: openPremium.nodes[2], chapter: openPremium, premium: false }).reason).toBe("premium");
    expect(startDecision({ node: openPremium.nodes[2], chapter: openPremium, premium: true }).ok).toBe(true);
  });

  it("keeps the checkpoint locked until the chapter nodes are done", () => {
    expect(startDecision({ node: node("d"), chapter, premium: true }).reason).toBe("checkpoint");
    const finished = { ...chapter, nodes: chapter.nodes.map((item) => item.kind === "checkpoint" ? { ...item, state: "current" } : { ...item, state: "done" }) };
    expect(startDecision({ node: finished.nodes[3], chapter: finished, premium: false }).ok).toBe(true);
    expect(startDecision({ node: node("b"), chapter: { ...chapter, locked: true }, premium: true }).reason).toBe("chapter");
  });
});
