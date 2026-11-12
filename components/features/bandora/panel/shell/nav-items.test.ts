import { describe, expect, it } from "vitest";
import {
  BOTTOM_NAV_ITEMS,
  MORE_ITEMS,
  NAV_ITEMS,
  SIDEBAR_BOTTOM,
  SIDEBAR_GROUPS,
  isNavActive,
  pageTitleKey,
} from "@/components/features/bandora/panel/shell/nav-items";

describe("sidebar structure (spec S2)", () => {
  it("has the two grouped sections in order", () => {
    expect(SIDEBAR_GROUPS.map((group) => group.labelKey)).toEqual(["nav.group.main", "nav.group.analysis"]);
    expect(SIDEBAR_GROUPS[0].items.map((item) => item.href)).toEqual(["/app", "/app/plan", "/app/practice", "/app/mock"]);
    expect(SIDEBAR_GROUPS[1].items.map((item) => item.href)).toEqual(["/app/progress", "/app/feedback", "/app/assistant"]);
  });

  it("puts profile and subscription in the bottom group", () => {
    expect(SIDEBAR_BOTTOM.map((item) => item.href)).toEqual(["/app/profile", "/app/subscription"]);
  });

  it("never lists placement in any menu", () => {
    const hrefs = [...NAV_ITEMS, ...MORE_ITEMS, ...BOTTOM_NAV_ITEMS].map((item) => item.href);
    expect(hrefs.some((href) => href.includes("placement"))).toBe(false);
  });
});

describe("mobile bottom navigation", () => {
  it("has three shortcuts (the fourth slot is the More button)", () => {
    expect(BOTTOM_NAV_ITEMS.map((item) => item.href)).toEqual(["/app", "/app/plan", "/app/practice"]);
  });

  it("More holds every remaining item exactly once", () => {
    const shown = new Set(BOTTOM_NAV_ITEMS.map((item) => item.id));
    expect(MORE_ITEMS.map((item) => item.href)).toEqual([
      "/app/mock",
      "/app/progress",
      "/app/feedback",
      "/app/assistant",
      "/app/profile",
      "/app/subscription",
    ]);
    expect(MORE_ITEMS.some((item) => shown.has(item.id))).toBe(false);
    expect(shown.size + MORE_ITEMS.length).toBe(NAV_ITEMS.length);
  });
});

describe("isNavActive", () => {
  it("matches the dashboard only on /app", () => {
    expect(isNavActive("/app", "/app")).toBe(true);
    expect(isNavActive("/app/", "/app")).toBe(true);
    expect(isNavActive("/app/plan", "/app")).toBe(false);
  });

  it("matches sections and their children", () => {
    expect(isNavActive("/app/practice", "/app/practice")).toBe(true);
    expect(isNavActive("/app/practice/set/1", "/app/practice")).toBe(true);
    expect(isNavActive("/app/practice-x", "/app/practice")).toBe(false);
  });
});

describe("pageTitleKey", () => {
  it("resolves nav pages and the notifications page", () => {
    expect(pageTitleKey("/app")).toBe("nav.dashboard");
    expect(pageTitleKey("/app/mock")).toBe("nav.mock");
    expect(pageTitleKey("/app/notifications")).toBe("nav.notifications");
  });

  it("falls back to the product name", () => {
    expect(pageTitleKey("/app/unknown")).toBe("app.name");
  });
});
