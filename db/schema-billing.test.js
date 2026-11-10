import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  count, createMigratedDb, expectViolation, insert, newPaymentAttempt, newPlan, newPlanPrice, newUser, unique,
} from "./test-helpers.js";

let db;
beforeAll(async () => { db = await createMigratedDb(); });
afterAll(async () => { await db.close(); });

const DAY = 86_400_000;
const subscription = async (fields = {}) => insert(db, "subscriptions", {
  user_id: fields.user_id ?? (await newUser(db)).id,
  plan_key: fields.plan_key ?? (await newPlan(db)).key,
  ends_at: new Date(Date.now() + 30 * DAY),
  ...fields,
});

describe("plans, prices and entitlements", () => {
  it("uses a stable text key and ties the duration to the tier", async () => {
    const free = await newPlan(db, { key: "t_free", tier: "free", duration_days: null });
    expect(free).toMatchObject({ key: "t_free", is_active: true, sort: 0 });
    await expectViolation(newPlan(db, { key: "t_free2", tier: "free", duration_days: 30 }), /plans_duration_matches_tier/);
    await expectViolation(newPlan(db, { tier: "premium", duration_days: null }), /plans_duration_matches_tier/);
    await expectViolation(newPlan(db, { duration_days: 0 }), /plans_duration_valid/);
    await expectViolation(newPlan(db, { tier: "gold" }), /plans_tier_valid/);
    await expectViolation(newPlan(db, { key: "Premium Monthly" }), /plans_key_format/);
    await expectViolation(newPlan(db, { key: "t_free" }), /plans_pkey/);
  });

  it("allows one active price per plan and only positive Rial amounts", async () => {
    const plan = await newPlan(db);
    const price = await newPlanPrice(db, { plan_key: plan.key, amount_rial: 5_900_000_000 });
    expect(Number(price.amount_rial)).toBe(5_900_000_000);
    await expectViolation(newPlanPrice(db, { plan_key: plan.key }), /plan_prices_one_active_per_plan/);
    await db.query("update plan_prices set is_active = false where id = $1", [price.id]);
    await newPlanPrice(db, { plan_key: plan.key });
    await expectViolation(newPlanPrice(db, { amount_rial: 0 }), /plan_prices_amount_positive/);
    await expectViolation(newPlanPrice(db, { plan_key: "no_such_plan" }), /plan_prices_plan_key_fkey/);
  });

  it("restricts deleting a plan that has prices", async () => {
    const price = await newPlanPrice(db);
    await expectViolation(db.query("delete from plans where key = $1", [price.plan_key]), /plan_prices_plan_key_fkey/);
  });

  it("keeps one entitlement per plan and feature, cascading with the plan", async () => {
    const plan = await newPlan(db);
    const row = await insert(db, "feature_entitlements", { plan_key: plan.key, feature_key: "exam_parts" });
    expect(row).toMatchObject({ enabled: true, limit_value: null });
    await expectViolation(insert(db, "feature_entitlements", { plan_key: plan.key, feature_key: "exam_parts" }), /feature_entitlements_plan_feature_key/);
    await expectViolation(insert(db, "feature_entitlements", { plan_key: plan.key, feature_key: "Bad Key" }), /feature_entitlements_feature_key_format/);
    await expectViolation(insert(db, "feature_entitlements", { plan_key: plan.key, feature_key: "mocks", limit_value: -1 }), /feature_entitlements_limit_valid/);
    await db.query("delete from plans where key = $1", [plan.key]);
    expect(await count(db, "feature_entitlements", "id = $1", [row.id])).toBe(0);
  });
});

describe("subscriptions", () => {
  it("allows a single active-or-grace subscription per user via a partial unique index", async () => {
    const user = await newUser(db);
    const first = await subscription({ user_id: user.id });
    expect(first).toMatchObject({ status: "active", source: "payment", grace_ends_at: null });
    await expectViolation(subscription({ user_id: user.id }), /subscriptions_one_active_per_user/);
    await db.query("update subscriptions set status = 'grace', grace_ends_at = ends_at + interval '3 days' where id = $1", [first.id]);
    await expectViolation(subscription({ user_id: user.id }), /subscriptions_one_active_per_user/);
    await db.query("update subscriptions set status = 'expired' where id = $1", [first.id]);
    await subscription({ user_id: user.id });
    await subscription({ user_id: (await newUser(db)).id });
  });

  it("validates status, source, period and grace window", async () => {
    await expectViolation(subscription({ status: "paused" }), /subscriptions_status_valid/);
    await expectViolation(subscription({ source: "gift" }), /subscriptions_source_valid/);
    await expectViolation(subscription({ started_at: new Date(), ends_at: new Date(Date.now() - DAY) }), /subscriptions_ends_after_start/);
    await expectViolation(subscription({ status: "grace" }), /subscriptions_grace_needs_deadline/);
    await expectViolation(subscription({ grace_ends_at: new Date(Date.now() - DAY) }), /subscriptions_grace_after_end/);
    await subscription({ status: "grace", grace_ends_at: new Date(Date.now() + 31 * DAY) });
  });

  it("ties cancelled_at to the cancelled status and requires a reason for manual grants", async () => {
    await expectViolation(subscription({ status: "cancelled" }), /subscriptions_cancelled_matches_status/);
    await expectViolation(subscription({ cancelled_at: new Date() }), /subscriptions_cancelled_matches_status/);
    await subscription({ status: "cancelled", cancelled_at: new Date() });
    await expectViolation(subscription({ source: "manual" }), /subscriptions_manual_needs_reason/);
    const admin = await newUser(db, { role: "super_admin" });
    const manual = await subscription({ source: "manual", reason: "support gift", granted_by: admin.id });
    await db.query("delete from users where id = $1", [admin.id]);
    expect((await db.query("select granted_by from subscriptions where id = $1", [manual.id])).rows[0].granted_by).toBeNull();
  });

  it("keeps the subscription when its price is removed, restricts removing its plan, cascades with the user", async () => {
    const price = await newPlanPrice(db);
    const sub = await subscription({ plan_key: price.plan_key, plan_price_id: price.id });
    await expectViolation(db.query("delete from plans where key = $1", [price.plan_key]), /subscriptions_plan_key_fkey|plan_prices_plan_key_fkey/);
    await db.query("delete from plan_prices where id = $1", [price.id]);
    expect((await db.query("select plan_price_id from subscriptions where id = $1", [sub.id])).rows[0].plan_price_id).toBeNull();
    await db.query("delete from users where id = $1", [sub.user_id]);
    expect(await count(db, "subscriptions", "id = $1", [sub.id])).toBe(0);
  });
});

describe("subscription_events and scheduled changes", () => {
  it("logs typed events, keeping them when the payment attempt goes away", async () => {
    const sub = await subscription();
    const attempt = await newPaymentAttempt(db);
    const event = await insert(db, "subscription_events", {
      subscription_id: sub.id, event_type: "created", new_ends_at: sub.ends_at, payment_attempt_id: attempt.id,
    });
    await expectViolation(insert(db, "subscription_events", { subscription_id: sub.id, event_type: "gifted" }), /subscription_events_event_type_valid/);
    await db.query("delete from payment_attempts where id = $1", [attempt.id]);
    expect((await db.query("select payment_attempt_id from subscription_events where id = $1", [event.id])).rows[0].payment_attempt_id).toBeNull();
    await db.query("delete from subscriptions where id = $1", [sub.id]);
    expect(await count(db, "subscription_events", "id = $1", [event.id])).toBe(0);
  });

  it("allows one pending change per subscription and validates the target", async () => {
    const sub = await subscription();
    const target = await newPlan(db);
    const change = (fields = {}) => insert(db, "scheduled_subscription_changes", {
      subscription_id: sub.id, change_type: "downgrade", target_plan_key: target.key, effective_at: new Date(Date.now() + DAY), ...fields,
    });
    const first = await change();
    expect(first.status).toBe("pending");
    await expectViolation(change(), /scheduled_subscription_changes_one_pending/);
    await expectViolation(change({ change_type: "swap" }), /scheduled_subscription_changes_change_type_valid/);
    await db.query("update scheduled_subscription_changes set status = 'cancelled' where id = $1", [first.id]);
    await expectViolation(change({ target_plan_key: null }), /scheduled_subscription_changes_target_needed/);
    await change({ change_type: "cancel", target_plan_key: null });
    await expectViolation(change({ status: "applied" }), /scheduled_subscription_changes_applied_matches_status|scheduled_subscription_changes_one_pending/);
  });

  it("limits trials to one per user", async () => {
    const user = await newUser(db);
    const plan = await newPlan(db);
    const trial = (fields = {}) => insert(db, "trial_records", { user_id: user.id, plan_key: plan.key, ends_at: new Date(Date.now() + 7 * DAY), ...fields });
    await trial();
    await expectViolation(trial(), /trial_records_user_key/);
    await expectViolation(insert(db, "trial_records", { user_id: (await newUser(db)).id, plan_key: plan.key, started_at: new Date(), ends_at: new Date(Date.now() - DAY) }), /trial_records_ends_after_start/);
  });
});

describe("AI quota tables", () => {
  it("keeps one quota per plan and key, with the four known keys and non-negative limits", async () => {
    const plan = await newPlan(db);
    for (const quota_key of ["writing_scoring", "speaking_scoring", "assistant_messages", "full_mock"]) {
      await insert(db, "ai_quota_configs", { plan_key: plan.key, quota_key, monthly_limit: 2 });
    }
    await expectViolation(insert(db, "ai_quota_configs", { plan_key: plan.key, quota_key: "full_mock", monthly_limit: 4 }), /ai_quota_configs_plan_quota_key/);
    const other = await newPlan(db);
    await expectViolation(insert(db, "ai_quota_configs", { plan_key: other.key, quota_key: "tokens", monthly_limit: 1 }), /ai_quota_configs_quota_key_valid/);
    await expectViolation(insert(db, "ai_quota_configs", { plan_key: other.key, quota_key: "full_mock", monthly_limit: -1 }), /ai_quota_configs_limit_valid/);
  });

  it("keeps one counter per user, key and Tehran month, with a YYYY-MM period", async () => {
    const user = await newUser(db);
    const counter = (fields = {}) => insert(db, "ai_usage_counters", { user_id: user.id, quota_key: "writing_scoring", period: "2026-11", ...fields });
    expect((await counter()).used).toBe(0);
    await expectViolation(counter(), /ai_usage_counters_user_quota_period_key/);
    await counter({ period: "2026-12" });
    for (const period of ["2026-13", "2026-1", "26-11", "2026-00"]) {
      await expectViolation(counter({ period }), /ai_usage_counters_period_format/);
    }
    await expectViolation(counter({ quota_key: "x", period: "2027-01" }), /ai_usage_counters_quota_key_valid/);
    await expectViolation(counter({ used: -1, period: "2027-02" }), /ai_usage_counters_used_valid/);
  });

  describe("ai_usage_events", () => {
    const usage = (fields = {}) => insert(db, "ai_usage_events", {
      operation: "writing_scoring", quota_key: "writing_scoring", period: "2026-11", status: "reserved", ...fields,
    });

    it("tracks reserved, committed and released with a settle time and cost fields", async () => {
      const user = await newUser(db);
      const reserved = await usage({ user_id: user.id, ref: "attempt-1" });
      expect(reserved).toMatchObject({ tokens_in: 0, tokens_out: 0, settled_at: null });
      expect(Number(reserved.cost_rial)).toBe(0);
      const done = await usage({ user_id: user.id, ref: "attempt-2", status: "committed", settled_at: new Date(), tokens_in: 900, tokens_out: 400, cost_rial: 31_000, model: "gpt-4o-mini", prompt_version: "writing-v1" });
      expect(done.model).toBe("gpt-4o-mini");
      await usage({ user_id: user.id, ref: "attempt-3", status: "released", settled_at: new Date() });
    });

    it("validates status, operation, quota, period, tokens and cost", async () => {
      await expectViolation(usage({ status: "pending" }), /ai_usage_events_status_valid/);
      await expectViolation(usage({ operation: "dream" }), /ai_usage_events_operation_valid/);
      await expectViolation(usage({ quota_key: "x" }), /ai_usage_events_quota_key_valid/);
      await expectViolation(usage({ period: "2026-13" }), /ai_usage_events_period_format/);
      await expectViolation(usage({ tokens_out: -1 }), /ai_usage_events_tokens_valid/);
      await expectViolation(usage({ cost_rial: -1 }), /ai_usage_events_cost_valid/);
    });

    it("ties settle time to non-reserved status and requires a quota for reservations", async () => {
      await expectViolation(usage({ status: "committed" }), /ai_usage_events_settled_matches_status/);
      await expectViolation(usage({ settled_at: new Date() }), /ai_usage_events_settled_matches_status/);
      await expectViolation(usage({ quota_key: null, period: null }), /ai_usage_events_reserved_needs_quota/);
      await expectViolation(usage({ period: null }), /ai_usage_events_period_matches_quota/);
      const stt = await usage({ operation: "speech_to_text", quota_key: null, period: null, status: "committed", settled_at: new Date(), tokens_in: 60 });
      expect(stt.quota_key).toBeNull();
    });

    it("blocks a second open event for the same user, quota and ref (idempotent reserve)", async () => {
      const user = await newUser(db);
      const ref = unique("ref");
      const first = await usage({ user_id: user.id, ref });
      await expectViolation(usage({ user_id: user.id, ref }), /ai_usage_events_one_open_per_ref/);
      await db.query("update ai_usage_events set status = 'released', settled_at = now() where id = $1", [first.id]);
      await usage({ user_id: user.id, ref });
    });

    it("keeps the cost record when the user is deleted", async () => {
      const user = await newUser(db);
      const row = await usage({ user_id: user.id, status: "committed", settled_at: new Date(), cost_rial: 100 });
      await db.query("delete from users where id = $1", [user.id]);
      expect((await db.query("select user_id from ai_usage_events where id = $1", [row.id])).rows[0].user_id).toBeNull();
    });
  });
});
