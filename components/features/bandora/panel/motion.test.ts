import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { streakStep } from "@/components/features/bandora/use-bandora-motion";

const css = readFileSync(new URL("./motion.css", import.meta.url), "utf8");
const path = readFileSync(new URL("./home-page.tsx", import.meta.url), "utf8");
const check = readFileSync(new URL("./icons/check.svg", import.meta.url), "utf8");
const reduced = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));

describe("panel motion", () => {
  it("keeps the approved timings and fills the real segment", () => {
    expect(css).toContain("cubic-bezier(.22, 1, .36, 1)");
    expect(css).toContain("bd-ring 700ms");
    expect(css).toContain("bd-float 700ms");
    expect(css).toContain("stroke-dasharray: 100");
    expect(path).toContain('pathLength="100"');
    expect(check).toContain('pathLength="100"');
  });

  it("drops loops under reduced motion and fades the rest", () => {
    expect(reduced).toContain(".bd-node--current");
    expect(reduced).toContain(".bd-path__go");
    expect(reduced).toContain(".bd-lesson__almost");
    expect(reduced).toContain("animation: none !important");
    expect(reduced).toContain("animation: bd-fade 200ms ease-out !important");
  });

  it("steps the streak once and skips the step when motion is reduced", () => {
    expect(streakStep(8, true, false)).toEqual({ from: 7, to: 8 });
    expect(streakStep(1, true, true)).toEqual({ from: 1, to: 1 });
    expect(streakStep(1, false, false)).toEqual({ from: 1, to: 1 });
  });
});