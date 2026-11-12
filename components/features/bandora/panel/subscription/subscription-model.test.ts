import { describe, expect, it } from "vitest";
import { checkoutNoticeKey, formatDate, planName, premiumPlans, usagePercent, type BillingPlan } from "./subscription-model";

const quotas = { writing_scoring: 30, speaking_scoring: 30, assistant_messages: 150, full_mock: 4 };
const plan = (key: string, tier: "free" | "premium" = "premium"): BillingPlan => ({
  key, tier, nameFa: `fa-${key}`, nameEn: `en-${key}`, durationDays: tier === "free" ? null : 30, price: null, quotas,
});

describe("subscription model", () => {
  it("orders the premium cards monthly then quarterly and drops free/unknown plans", () => {
    const list = [plan("premium_quarterly"), plan("free", "free"), plan("premium_monthly"), plan("legacy")];
    expect(premiumPlans(list).map((p) => p.key)).toEqual(["premium_monthly", "premium_quarterly"]);
    expect(premiumPlans([plan("free", "free")])).toEqual([]);
  });

  it("picks the plan name for the locale", () => {
    expect(planName(plan("premium_monthly"), "fa")).toBe("fa-premium_monthly");
    expect(planName(plan("premium_monthly"), "en")).toBe("en-premium_monthly");
    expect(planName(undefined, "en")).toBeNull();
  });

  it("computes bar fill, clamped, with a zero limit shown as used up", () => {
    expect(usagePercent({ limit: 2, used: 1 })).toBe(50);
    expect(usagePercent({ limit: 2, used: 5 })).toBe(100);
    expect(usagePercent({ limit: 0, used: 0 })).toBe(100);
    expect(usagePercent({ limit: null, used: 3 })).toBe(0);
  });

  it("formats dates in Tehran time", () => {
    // 2026-03-20T21:00Z is already 21 March (00:30) in Tehran.
    expect(formatDate("2026-03-20T21:00:00.000Z", "en")).toBe("21 March 2026");
    expect(formatDate("2026-03-20T21:00:00.000Z", "fa")).toMatch(/[۰-۹]/);
  });

  it("shows the not-connected notice only when checkout is unavailable", () => {
    expect(checkoutNoticeKey({ available: false, reason: "bale_not_configured" })).toBe("subscription.note");
    expect(checkoutNoticeKey({ available: true, reason: null })).toBeNull();
    expect(checkoutNoticeKey(undefined)).toBeNull();
  });
});
