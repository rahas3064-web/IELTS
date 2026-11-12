import { describe, expect, it } from "vitest";
import { faDigits, formatClock, formatNumber, interpolate } from "@/src/i18n/format";

describe("faDigits", () => {
  it("converts Latin digits and keeps everything else", () => {
    expect(faDigits(42)).toBe("۴۲");
    expect(faDigits("0:59")).toBe("۰:۵۹");
    expect(faDigits("abc 7")).toBe("abc ۷");
  });

  it("uses the Persian decimal separator between digits", () => {
    expect(faDigits("6.5")).toBe("۶٫۵");
    expect(faDigits("end.")).toBe("end.");
  });
});

describe("formatNumber", () => {
  it("uses locale digits", () => {
    expect(formatNumber(42, "fa")).toBe("۴۲");
    expect(formatNumber(42, "en")).toBe("42");
    expect(formatNumber(1200, "en")).toBe("1,200");
  });
});

describe("formatClock", () => {
  it("formats m:ss", () => {
    expect(formatClock(59, "fa")).toBe("۰:۵۹");
    expect(formatClock(60, "en")).toBe("1:00");
    expect(formatClock(125, "en")).toBe("2:05");
  });

  it("never goes negative", () => {
    expect(formatClock(-3, "en")).toBe("0:00");
  });
});

describe("interpolate", () => {
  it("fills placeholders with locale-formatted numbers", () => {
    expect(interpolate("{n} روز", { n: 42 }, "fa")).toBe("۴۲ روز");
    expect(interpolate("{n} days", { n: 42 }, "en")).toBe("42 days");
  });

  it("inserts strings verbatim and keeps unknown placeholders visible", () => {
    expect(interpolate("Hi {name} {x}", { name: "Sara" }, "en")).toBe("Hi Sara {x}");
  });

  it("returns the template when no vars are given", () => {
    expect(interpolate("plain", undefined, "en")).toBe("plain");
  });
});
