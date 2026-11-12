import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  PANEL_NAV,
  greeting,
  isNavActive,
  levelProgress,
  overallBand,
  pageMeta,
  quickActions,
  taskLabel,
  taskSummary,
  readAccount,
  roundBand,
  todayLabel,
  toggleTask,
  unreadCount,
  type StudyTask,
} from "@/components/features/bandora/panel/model";

describe("bandora panel model", () => {
  it("lists the nine panel destinations with a dashboard index", () => {
    expect(PANEL_NAV.map((item) => item.href)).toEqual([
      "/app",
      "/app/placement",
      "/app/plan",
      "/app/practice",
      "/app/feedback",
      "/app/progress",
      "/app/mock",
      "/app/profile",
      "/app/subscription",
    ]);
    expect(PANEL_NAV.map((item) => item.en)).toEqual([
      "Dashboard",
      "Placement",
      "Study Plan",
      "Practice",
      "AI Feedback",
      "Progress",
      "Mock Exam",
      "Profile & Settings",
      "Subscription",
    ]);
  });

  it("marks only the matching route active", () => {
    expect(isNavActive("/app", "/app")).toBe(true);
    expect(isNavActive("/app/", "/app")).toBe(true);
    expect(isNavActive("/app/practice", "/app")).toBe(false);
    expect(isNavActive("/app/practice", "/app/practice")).toBe(true);
    expect(isNavActive("/app/practice/part-1", "/app/practice")).toBe(true);
    expect(isNavActive("/app/placement", "/app/practice")).toBe(false);
  });

  it("names the current page in the active language", () => {
    expect(pageMeta("/app", "fa")).toEqual({ title: "داشبورد", en: "Dashboard", ready: true });
    expect(pageMeta("/app/mock", "en")).toEqual({ title: "Mock Exam", en: "Mock Exam", ready: false });
    expect(pageMeta("/app/feedback", "fa").ready).toBe(false);
    expect(pageMeta("/missing", "fa").title).toBe("باندورا");
  });

  it("greets by time of day without mutating the learner", () => {
    expect(greeting("fa", "نگار", 8)).toBe("صبح بخیر نگار");
    expect(greeting("fa", "نگار", 14)).toBe("روز بخیر نگار");
    expect(greeting("en", "Negar", 20)).toBe("Good evening, Negar");
  });

  it("measures the band journey from the current score to the target", () => {
    expect(levelProgress(5, 7)).toBe(71);
    expect(levelProgress(7, 7)).toBe(100);
    expect(levelProgress(8, 7)).toBe(100);
    expect(levelProgress(0, 7)).toBe(0);
  });

  it("toggles a study task immutably and summarizes the day", () => {
    const tasks: StudyTask[] = [
      { id: "a", title: "شنیدن", minutes: 20, done: true },
      { id: "b", title: "Writing Task 1", minutes: 30, done: false },
    ];
    const next = toggleTask(tasks, "b");
    expect(tasks[1]?.done).toBe(false);
    expect(next[1]?.done).toBe(true);
    expect(next).not.toBe(tasks);
    expect(taskSummary(tasks)).toEqual({ done: 1, total: 2 });
    expect(taskLabel(tasks[0], "fa")).toContain("شنیدن");
    expect(taskLabel(tasks[1], "en")).toContain("Writing Task 1");
  });

  it("offers placement only before it is done and keeps mock exam closed", () => {
    expect(quickActions(false).map((item) => item.id)).toEqual(["start", "practice", "placement", "mock"]);
    expect(quickActions(true).map((item) => item.id)).toEqual(["start", "practice", "mock"]);
    expect(quickActions(false).find((item) => item.id === "mock")).toEqual({ id: "mock", disabled: true });
    expect(quickActions(false).find((item) => item.id === "placement")?.href).toBe("/app/placement");
  });

  it("counts unread notes from the list it is given", () => {
    expect(unreadCount([{ unread: true }, { unread: false }])).toBe(1);
    expect(unreadCount([])).toBe(0);
  });

  it("shows only the account the person saved, with no score until the test", () => {
    expect(readAccount(null)).toBeNull();
    const saved = readAccount({
      account: { name: "  سارا  ", email: "sara@example.com", phone: "09120000000", age: 25 },
      profile: { selfBand: 5 },
    });
    expect(saved?.name).toBe("سارا");
    expect(saved?.bands).toBeNull();
    expect(saved?.overall).toBeNull();
    expect(saved?.facts.map((fact) => fact.id)).toEqual(["email", "phone", "age"]);
  });

  it("takes the level from the placement and the target from the saved goal", () => {
    const saved = readAccount({
      account: { name: "سارا", email: "sara@example.com", phone: "", age: 25 },
      profile: { examType: "academic", targetOverall: "7", dailyMinutes: 45, daysPerWeek: 5, selfBand: 4 },
      placement: {
        bands: { listening: 6, reading: 5.5, writing: 5, speaking: 6.5 },
        objectiveCorrect: { listening: 8, reading: 6, listeningTotal: 10, readingTotal: 10 },
      },
      mocks: [{ correct: 3, total: 4 }],
    });
    expect(saved?.bands).toEqual({ listening: 6, reading: 5.5, writing: 5, speaking: 6.5 });
    expect(saved?.overall).toBe(6);
    expect(saved?.target).toBe(7);
    expect(saved?.stats).toEqual({
      listening: { correct: 8, total: 10 },
      reading: { correct: 6, total: 10 },
      mockCount: 1,
      lastMock: { correct: 3, total: 4 },
    });
  });

  it("formats the visible day without dropping the month", () => {
    expect(todayLabel("en", new Date("2026-11-09T12:00:00Z"))).toMatch(/November/);
    expect(todayLabel("fa", new Date("2026-11-09T12:00:00Z")).length).toBeGreaterThan(3);
  });
});

describe("bandora panel tokens", () => {
  const tokens = readFileSync(new URL("./tokens.css", import.meta.url), "utf8");
  const base = readFileSync(new URL("./base.css", import.meta.url), "utf8");

  it("keeps the landing palette and a visible focus ring", () => {
    for (const token of ["#F6F1E7", "#1A2238", "#1F2E54", "#B08D4A", "#7A5C1E", "#D9CFBB", "#E1D8C2", "#FBF8F1"]) {
      expect(tokens).toContain(token);
    }
    expect(base).toContain(":focus-visible");
  });
});

describe("band rounding", () => {
  it("rounds to the nearest half band and clamps to 0-9", () => {
    expect(roundBand(6.25)).toBe(6.5);
    expect(roundBand(6.24)).toBe(6);
    expect(roundBand(12)).toBe(9);
    expect(roundBand(-1)).toBe(0);
  });

  it("rounds the overall average to the nearest half band", () => {
    expect(overallBand({ listening: 6.5, reading: 6.5, writing: 6, speaking: 6 })).toBe(6.5);
    expect(overallBand({ listening: 6, reading: 6, writing: 6, speaking: 6 })).toBe(6);
  });
});
