import { describe, expect, it } from "vitest";
import { priceAfterPercent } from "./money.js";

describe("priceAfterPercent", () => {
  it("computes integer discounts with BigInt, rounding the discount down", () => {
    expect(priceAfterPercent(1000, 20)).toEqual({ original: 1000n, discount: 200n, final: 800n });
    expect(priceAfterPercent(999, 10)).toEqual({ original: 999n, discount: 99n, final: 900n });
  });

  it("handles amounts beyond Number.MAX_SAFE_INTEGER exactly", () => {
    const result = priceAfterPercent("9007199254740993", 50);
    expect(result.discount + result.final).toBe(result.original);
  });

  it("accepts 100% and rejects out-of-range percentages and negative amounts", () => {
    expect(priceAfterPercent(500, 100).final).toBe(0n);
    expect(() => priceAfterPercent(500, 0)).toThrow("invalid_price");
    expect(() => priceAfterPercent(500, 101)).toThrow("invalid_price");
    expect(() => priceAfterPercent(-1, 10)).toThrow("invalid_price");
  });
});
