// Pure helpers for the subscription page (GET /api/billing, GET /api/billing/plans).
import type { Locale } from "@/src/i18n";

export const QUOTA_KEYS = ["writing_scoring", "speaking_scoring", "assistant_messages", "full_mock"] as const;
export type QuotaKey = (typeof QUOTA_KEYS)[number];

export type PlanPrice = { amountRial: number; amountToman: number };
export type BillingPlan = {
  key: string;
  tier: "free" | "premium";
  nameFa: string;
  nameEn: string;
  durationDays: number | null;
  price: PlanPrice | null;
  quotas: Record<QuotaKey, number | null>;
};
export type PlansResponse = { plans: BillingPlan[]; quarterlySavingsPercent: number | null };

export type QuotaRow = { key: QuotaKey; limit: number | null; used: number; remaining: number | null };
export type BillingSummary = {
  subscription: {
    plan: string;
    tier: "free" | "premium";
    status: "free" | "active" | "grace";
    endsAt: string | null;
    graceEndsAt: string | null;
  };
  usage: { period: string; resetsAt: string; quotas: QuotaRow[] };
  checkout: { available: boolean; reason: null | "bale_not_configured" | "provider_not_wired" };
};

/** The two purchasable cards, monthly first; missing plans are skipped. */
export function premiumPlans(plans: BillingPlan[]): BillingPlan[] {
  const order = ["premium_monthly", "premium_quarterly"];
  return order.map((key) => plans.find((p) => p.key === key && p.tier === "premium")).filter((p): p is BillingPlan => Boolean(p));
}

export function planName(plan: Pick<BillingPlan, "nameFa" | "nameEn"> | undefined, locale: Locale): string | null {
  if (!plan) return null;
  return locale === "fa" ? plan.nameFa : plan.nameEn;
}

/** Bar fill 0..100. A zero limit (e.g. mocks on Free) shows as full: nothing is left. */
export function usagePercent(row: Pick<QuotaRow, "limit" | "used">): number {
  if (row.limit === null) return 0;
  if (row.limit <= 0) return 100;
  return Math.min(100, Math.max(0, Math.round((row.used / row.limit) * 100)));
}

/** A Tehran-time calendar date for an ISO instant (Persian calendar in fa). */
export function formatDate(isoValue: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "fa" ? "fa-IR" : "en-GB", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(isoValue));
}

/** i18n key for the checkout notice; null when checkout could work. */
export function checkoutNoticeKey(checkout: BillingSummary["checkout"] | undefined): string | null {
  if (!checkout || checkout.available) return null;
  return "subscription.note";
}
