import { describe, expect, it } from "vitest";
import { loginHref, safeNext } from "@/src/lib/safe-next";

describe("safeNext", () => {
  it("keeps same-origin app paths", () => {
    expect(safeNext("/app/plan")).toBe("/app/plan");
    expect(safeNext("/app/profile#exam-goal")).toBe("/app/profile#exam-goal");
    expect(safeNext("/app?tab=1")).toBe("/app?tab=1");
  });

  it("falls back to /app for anything that could leave the app", () => {
    for (const bad of [null, undefined, "", "https://evil.example", "//evil.example", "/\\evil.example", "app/plan", "/login", "javascript:alert(1)"]) {
      expect(safeNext(bad)).toBe("/app");
    }
  });
});

describe("loginHref", () => {
  it("encodes the next path", () => {
    expect(loginHref("/app/plan?x=1")).toBe("/login?next=%2Fapp%2Fplan%3Fx%3D1");
  });

  it("omits next when there is nothing worth coming back to", () => {
    expect(loginHref(null)).toBe("/login");
    expect(loginHref("/login")).toBe("/login");
    expect(loginHref("/")).toBe("/login");
  });
});
