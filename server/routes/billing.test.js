import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { tehranMonthKey } from "../core/tehran-time.js";
import { createTestApp, freshPhone } from "../test-support/http-app.js";

const BALE = { BALE_BOT_TOKEN: "test-bot-token", BALE_PAYMENT_PROVIDER_TOKEN: "WALLET-TEST-1111111111111111" };
const DAY = 24 * 60 * 60 * 1000;

let t;
beforeAll(async () => {
  t = await createTestApp();
});
afterAll(() => t.close());
beforeEach(async () => {
  await t.resetLimits();
  await t.db.query("update plan_prices set is_active = false");
});

async function learner(app = t) {
  const device = app.client();
  const res = await app.signUp(device, freshPhone());
  return { device, user: res.json.user };
}
const count = async (db, table, where = "true", params = []) =>
  (await db.query(`select count(*)::int as n from ${table} where ${where}`, params)).rows[0].n;
const setPrice = async (planKey, amountRial, db = t.db) => {
  await db.query("update plan_prices set is_active = false where plan_key = $1", [planKey]);
  return db.query("insert into plan_prices (plan_key, amount_rial) values ($1, $2) returning id", [planKey, amountRial]);
};
async function grant(userId, { planKey = "premium_monthly", status = "active", startedAt, endsAt, graceEndsAt = null }) {
  const now = t.clock.now().getTime();
  await t.db.query(
    `insert into subscriptions (user_id, plan_key, status, source, reason, started_at, ends_at, grace_ends_at)
     values ($1, $2, $3, 'manual', 'test fixture', $4, $5, $6)`,
    [userId, planKey, status, startedAt ?? new Date(now - 10 * DAY), endsAt, graceEndsAt],
  );
}

describe("plan catalogue (migration 009)", () => {
  it("seeds free / premium_monthly / premium_quarterly with the agreed monthly quotas and no prices", async () => {
    const plans = await t.db.query("select key, tier, duration_days from plans order by sort");
    expect(plans.rows.map((r) => r.key)).toEqual(["free", "premium_monthly", "premium_quarterly"]);
    expect(plans.rows.map((r) => r.tier)).toEqual(["free", "premium", "premium"]);
    const quotas = await t.db.query("select plan_key, quota_key, monthly_limit from ai_quota_configs");
    const byPlan = {};
    for (const q of quotas.rows) (byPlan[q.plan_key] ??= {})[q.quota_key] = q.monthly_limit;
    expect(byPlan.free).toEqual({ writing_scoring: 2, speaking_scoring: 2, assistant_messages: 10, full_mock: 0 });
    const premium = { writing_scoring: 30, speaking_scoring: 30, assistant_messages: 150, full_mock: 4 };
    expect(byPlan.premium_monthly).toEqual(premium);
    expect(byPlan.premium_quarterly).toEqual(premium);
    expect(await count(t.db, "plan_prices", "is_active")).toBe(0);
  });

  it("GET /api/billing/plans returns price null until an admin sets one", async () => {
    const { device } = await learner();
    const res = await device.request("GET", "/api/billing/plans");
    expect(res.status).toBe(200);
    expect(res.json.plans.map((p) => [p.key, p.price])).toEqual([
      ["free", null], ["premium_monthly", null], ["premium_quarterly", null],
    ]);
    expect(res.json.plans[1].quotas).toEqual({ writing_scoring: 30, speaking_scoring: 30, assistant_messages: 150, full_mock: 4 });
    expect(res.json.quarterlySavingsPercent).toBeNull();
  });

  it("shows an active price in rials and whole tomans, and the real quarterly saving", async () => {
    await setPrice("premium_monthly", 1_000_000);
    await setPrice("premium_quarterly", 2_400_000);
    const { device } = await learner();
    const res = await device.request("GET", "/api/billing/plans");
    const monthly = res.json.plans.find((p) => p.key === "premium_monthly");
    expect(monthly.price).toEqual({ amountRial: 1_000_000, amountToman: 100_000 });
    expect(res.json.quarterlySavingsPercent).toBe(20);
  });

  it("needs a session", async () => {
    expect((await t.client().request("GET", "/api/billing/plans")).status).toBe(401);
    expect((await t.client().request("GET", "/api/billing")).status).toBe(401);
  });
});

describe("GET /api/billing", () => {
  it("free learner: free plan, free quotas for this Tehran month, checkout unavailable without Bale", async () => {
    const { device, user } = await learner();
    const period = tehranMonthKey(t.clock.now());
    await t.db.query(
      "insert into ai_usage_counters (user_id, quota_key, period, used) values ($1, 'writing_scoring', $2, 1)",
      [user.id, period],
    );
    const res = await device.request("GET", "/api/billing");
    expect(res.status).toBe(200);
    expect(res.json.subscription).toMatchObject({ plan: "free", status: "free", endsAt: null });
    expect(res.json.usage.period).toBe(period);
    expect(res.json.usage.quotas).toEqual([
      { key: "writing_scoring", limit: 2, used: 1, remaining: 1 },
      { key: "speaking_scoring", limit: 2, used: 0, remaining: 2 },
      { key: "assistant_messages", limit: 10, used: 0, remaining: 10 },
      { key: "full_mock", limit: 0, used: 0, remaining: 0 },
    ]);
    expect(res.json.checkout).toEqual({ available: false, reason: "bale_not_configured" });
  });

  it("premium learner gets premium quotas", async () => {
    const { device, user } = await learner();
    await grant(user.id, { endsAt: new Date(t.clock.now().getTime() + 20 * DAY) });
    const res = await device.request("GET", "/api/billing");
    expect(res.json.subscription).toMatchObject({ plan: "premium_monthly", tier: "premium", status: "active" });
    expect(res.json.usage.quotas.map((q) => q.limit)).toEqual([30, 30, 150, 4]);
  });
});

describe("GET /api/me subscription", () => {
  it("is free + null when the user has no subscription row", async () => {
    const { device } = await learner();
    expect((await device.request("GET", "/api/me")).json.subscription).toEqual({ plan: "free", endsAt: null });
  });

  it("comes from the live active row", async () => {
    const { device, user } = await learner();
    const endsAt = new Date(t.clock.now().getTime() + 20 * DAY);
    await grant(user.id, { planKey: "premium_quarterly", endsAt });
    expect((await device.request("GET", "/api/me")).json.subscription).toEqual({
      plan: "premium_quarterly", endsAt: endsAt.toISOString(),
    });
  });

  it("keeps premium inside the 3-day grace window, then falls back to free", async () => {
    const { device, user } = await learner();
    const endsAt = new Date(t.clock.now().getTime() - DAY);
    await grant(user.id, { endsAt });
    expect((await device.request("GET", "/api/me")).json.subscription.plan).toBe("premium_monthly");
    expect((await device.request("GET", "/api/billing")).json.subscription.status).toBe("grace");
    t.clock.advance(3 * 24 * 60 * 60);
    expect((await device.request("GET", "/api/me")).json.subscription).toEqual({ plan: "free", endsAt: null });
  });

  it("respects an explicit grace row and ignores expired/cancelled history", async () => {
    const { device, user } = await learner();
    const now = t.clock.now().getTime();
    await t.db.query(
      `insert into subscriptions (user_id, plan_key, status, source, reason, started_at, ends_at)
       values ($1, 'premium_monthly', 'expired', 'manual', 'old', $2, $3)`,
      [user.id, new Date(now - 90 * DAY), new Date(now - 60 * DAY)],
    );
    await grant(user.id, { status: "grace", endsAt: new Date(now - DAY), graceEndsAt: new Date(now + DAY) });
    expect((await device.request("GET", "/api/me")).json.subscription.plan).toBe("premium_monthly");
  });
});

describe("POST /api/billing/checkout", () => {
  it("needs a session and a same-origin request", async () => {
    const anon = await t.client().request("POST", "/api/billing/checkout", { body: { planKey: "premium_monthly" } });
    expect(anon.status).toBe(401);
    const { device } = await learner();
    const crossSite = await device.request("POST", "/api/billing/checkout", {
      body: { planKey: "premium_monthly" }, origin: "https://evil.example",
    });
    expect(crossSite.status).toBe(403);
  });

  it("rejects bad bodies and non-purchasable plans", async () => {
    const { device } = await learner();
    expect((await device.request("POST", "/api/billing/checkout", { body: {} })).status).toBe(400);
    expect((await device.request("POST", "/api/billing/checkout", { body: { planKey: "free" } })).status).toBe(404);
    expect((await device.request("POST", "/api/billing/checkout", { body: { planKey: "no_such_plan" } })).status).toBe(404);
  });

  it("refuses with price_not_set when the plan has no active price", async () => {
    const { device, user } = await learner();
    const res = await device.request("POST", "/api/billing/checkout", { body: { planKey: "premium_monthly" } });
    expect(res.status).toBe(409);
    expect(res.json.error.code).toBe("price_not_set");
    expect(res.json.error.message_fa).toMatch(/\S/);
    expect(await count(t.db, "subscriptions", "user_id = $1", [user.id])).toBe(0);
    expect(await count(t.db, "payment_attempts", "user_id = $1", [user.id])).toBe(0);
  });

  it("refuses with 503 payment_unavailable when Bale is not configured, and writes nothing", async () => {
    await setPrice("premium_monthly", 1_000_000);
    const { device, user } = await learner();
    const res = await device.request("POST", "/api/billing/checkout", { body: { planKey: "premium_monthly" } });
    expect(res.status).toBe(503);
    expect(res.json.error).toMatchObject({ code: "payment_unavailable", details: { reason: "bale_not_configured" } });
    expect(await count(t.db, "subscriptions", "user_id = $1", [user.id])).toBe(0);
    expect(await count(t.db, "payment_attempts", "user_id = $1", [user.id])).toBe(0);
    expect((await device.request("GET", "/api/me")).json.subscription.plan).toBe("free");
  });

  it("still refuses when Bale tokens exist but no provider adapter is wired", async () => {
    const app = await createTestApp({ config: BALE });
    try {
      await setPrice("premium_quarterly", 2_400_000, app.db);
      const { device, user } = await learner(app);
      const status = await device.request("GET", "/api/billing");
      expect(status.json.checkout).toEqual({ available: false, reason: "provider_not_wired" });
      const res = await device.request("POST", "/api/billing/checkout", { body: { planKey: "premium_quarterly" } });
      expect(res.status).toBe(503);
      expect(res.json.error.details).toEqual({ reason: "provider_not_wired" });
      expect(await count(app.db, "subscriptions", "user_id = $1", [user.id])).toBe(0);
    } finally {
      await app.close();
    }
  });
});

describe("POST /api/billing/discount", () => {
  it("quotes a valid code in whole tomans without redeeming it", async () => {
    await setPrice("premium_monthly", 1_000_000);
    await t.db.query("insert into discount_codes (code, percent_off) values ('WELCOME10', 10) on conflict do nothing");
    const { device } = await learner();
    const res = await device.request("POST", "/api/billing/discount", { body: { planKey: "premium_monthly", code: "welcome10" } });
    expect(res.status).toBe(200);
    expect(res.json).toEqual({
      planKey: "premium_monthly", code: "WELCOME10", originalToman: 100_000, discountToman: 10_000, finalToman: 90_000, redeemed: false,
    });
    expect(await count(t.db, "discount_redemptions")).toBe(0);
  });

  it("rejects unknown, inactive or other-plan codes, and needs a price", async () => {
    const { device } = await learner();
    const noPrice = await device.request("POST", "/api/billing/discount", { body: { planKey: "premium_monthly", code: "WELCOME10" } });
    expect(noPrice.json.error.code).toBe("price_not_set");
    await setPrice("premium_monthly", 1_000_000);
    await t.db.query("insert into discount_codes (code, percent_off, plan_key) values ('QONLY', 15, 'premium_quarterly') on conflict do nothing");
    for (const code of ["NOPE1", "QONLY"]) {
      const res = await device.request("POST", "/api/billing/discount", { body: { planKey: "premium_monthly", code } });
      expect(res.status).toBe(400);
      expect(res.json.error.code).toBe("discount_invalid");
    }
  });
});
