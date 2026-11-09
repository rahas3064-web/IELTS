import { describe, expect, it } from "vitest";
import {
  CTA,
  FAQ,
  FEATURES,
  FREE_FEATURES,
  HERO,
  NAV,
  PREMIUM_FEATURES,
  SKILLS,
  STEPS,
  TASKS,
  TRUST,
  faqView,
  langColors,
  menuIcon,
  nextFaq,
  skillDash,
  stepViews,
  timelineFromCenters,
  timelineKey,
  toFa,
  trustViews,
} from "@/components/features/bandora/content";

describe("bandora landing content", () => {
  it("converts digits to Persian and keeps the ring math", () => {
    expect(toFa(1)).toBe("۱");
    expect(toFa("04")).toBe("۰۴");
    expect(skillDash(72)).toBe("99.5 138.2");
    expect(skillDash(64)).toBe("88.4 138.2");
    expect(skillDash(52)).toBe("71.9 138.2");
    expect(skillDash(48)).toBe("66.3 138.2");
    expect(SKILLS.map((skill) => skill.dash)).toEqual([
      "99.5 138.2",
      "88.4 138.2",
      "71.9 138.2",
      "66.3 138.2",
    ]);
    expect(SKILLS.map((skill) => skill.band)).toEqual(["6.5", "6.0", "5.5", "5.5"]);
  });

  it("keeps the reference copy, placeholders, and routes", () => {
    expect(HERO.title).toBe("برای آیلتس آماده شو، اما هوشمندانه‌تر!");
    expect(HERO.kicker).toBe("IELTS Preparation, in one place");
    expect(NAV.map((item) => item.label)).toEqual(["امکانات", "نحوه کار", "تعرفه‌ها", "سؤالات متداول"]);
    expect(NAV.map((item) => item.href)).toEqual(["#features", "#how-it-works", "#pricing", "#faq"]);
    expect(FREE_FEATURES).toEqual(["Listening، بخش ۱", "Reading، متن ۱", "Writing، تسک ۱", "Speaking، بخش ۱"]);
    expect(PREMIUM_FEATURES).toEqual(["دسترسی به تمرین‌های بیشتر", "دسترسی گسترده‌تر به مهارت‌ها", "امکانات تکمیلی"]);
    expect(FEATURES.map((item) => item.n)).toEqual(["۰۱", "۰۲", "۰۳", "۰۴"]);
    expect(FEATURES.map((item) => item.en)).toEqual(["Placement Test", "Study Plan", "IELTS Practice", "AI Feedback"]);
    expect(TASKS.map((task) => task.label)).toEqual([
      "Listening Part 1 · ۲۰ دقیقه",
      "Vocabulary Review · ۱۰ دقیقه",
      "Writing Task 1 · ۳۰ دقیقه",
    ]);
    expect(TASKS[0]?.td).toBe("line-through");
    expect(TASKS[2]?.td).toBe("none");
    expect(TASKS[0]?.fg).toBe("#6B6757");
    expect(TASKS[2]?.ic).toBe("transparent");
    expect(FAQ).toHaveLength(7);
    expect(FAQ[0]?.q.startsWith("از کجا بدونم")).toBe(true);
    expect(CTA).toEqual({
      signup: "/signup",
      login: "/login",
      philosophy: "#philosophy",
      how: "#how-it-works",
      pricing: "#pricing",
    });
    expect(HERO.body.includes("[قیمت]")).toBe(false);
    expect(PREMIUM_FEATURES.join(" ")).not.toContain("تومان");
  });

  it("switches only the toggle colors", () => {
    expect(langColors("FA")).toEqual({
      faBg: "#1F2E54",
      faFg: "#F6F1E7",
      enBg: "transparent",
      enFg: "#1A2238",
    });
    expect(langColors("EN")).toEqual({
      faBg: "transparent",
      faFg: "#1A2238",
      enBg: "#1F2E54",
      enFg: "#F6F1E7",
    });
    expect(FEATURES[0]?.title).toBe("از سطح فعلیت شروع کن.");
  });

  it("draws trust dividers from the 900px breakpoint", () => {
    const desktop = trustViews(false);
    const mobile = trustViews(true);
    expect(desktop.map((item) => [item.bt, item.bs])).toEqual([
      ["0", "0"],
      ["0", "1px solid #D9CFBB"],
      ["0", "1px solid #D9CFBB"],
    ]);
    expect(mobile.map((item) => [item.bt, item.bs])).toEqual([
      ["0", "0"],
      ["1px solid #D9CFBB", "0"],
      ["1px solid #D9CFBB", "0"],
    ]);
    expect(TRUST[2]?.title).toBe("بازخورد بگیر");
  });

  it("activates only the first step before the timeline exists", () => {
    const steps = stepViews(null);
    expect(steps.map((step) => step.bg)).toEqual(["#B08D4A", "#F6F1E7", "#F6F1E7", "#F6F1E7", "#F6F1E7"]);
    expect(steps.map((step) => step.fg)).toEqual(["#1A2238", "#7A5C1E", "#7A5C1E", "#7A5C1E", "#7A5C1E"]);
    expect(steps.map((step) => step.sc)).toEqual(["scale(1)", "scale(.88)", "scale(.88)", "scale(.88)", "scale(.88)"]);
    expect(steps.map((step) => step.op)).toEqual([1, 0.5, 0.5, 0.5, 0.5]);
    expect(steps.map((step) => step.n)).toEqual(["۱", "۲", "۳", "۴", "۵"]);
    expect(steps[0]?.fill).toBe("0.0%");
    expect(steps[3]?.pb).toBe("44px");
    expect(steps[4]?.pb).toBe("0");
    expect(steps[4]?.line).toBe("transparent");
    expect(steps[0]?.line).toBe("#E1D8C2");
    expect(STEPS[4]?.en).toBe("Get Feedback & Track Progress");
  });

  it("fills connectors from the viewport line", () => {
    const centers = [100, 200, 400];
    expect(timelineFromCenters(centers, 100)).toEqual({
      fill: [0, 0, 0],
      active: [true, false, false],
    });
    expect(timelineFromCenters(centers, 150)).toEqual({
      fill: [0.5, 0, 0],
      active: [true, false, false],
    });
    expect(timelineFromCenters(centers, 99).active[0]).toBe(false);
    const tl = timelineFromCenters(centers, 250);
    expect(tl.fill[1]).toBeCloseTo(0.25);
    expect(stepViews(tl)[1]?.fill).toBe("25.0%");
    expect(stepViews(tl)[1]?.bg).toBe("#B08D4A");
    expect(timelineKey(tl)).toBe(timelineKey({ fill: [...tl.fill], active: [...tl.active] }));
    expect(timelineKey(tl)).not.toBe(timelineKey(timelineFromCenters(centers, 100)));
  });

  it("opens one question at a time and lets the open one close", () => {
    expect(nextFaq(0, 0)).toBe(-1);
    expect(nextFaq(0, 3)).toBe(3);
    expect(nextFaq(-1, 3)).toBe(3);
    const first = faqView(0);
    expect(first.map((item) => item.open)).toEqual([true, false, false, false, false, false, false]);
    expect(first[0]?.rows).toBe("1fr");
    expect(first[0]?.rot).toBe("rotate(180deg)");
    expect(first[1]?.rows).toBe("0fr");
    expect(first[1]?.rot).toBe("none");
    expect(faqView(-1).every((item) => item.open === false)).toBe(true);
  });

  it("swaps the menu icon", () => {
    expect(menuIcon(false)).toBe("M4 6h16M4 12h16M4 18h16");
    expect(menuIcon(true)).toBe("M18 6L6 18M6 6l12 12");
  });
});
