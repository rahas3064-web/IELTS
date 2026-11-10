import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  count, createMigratedDb, expectViolation, insert, newPaymentAttempt, newPlan, newUser, unique,
} from "./test-helpers.js";

let db;
beforeAll(async () => { db = await createMigratedDb(); });
afterAll(async () => { await db.close(); });

const HOUR = 3_600_000;
const verified = (fields = {}) => ({ status: "verified", verified_at: new Date(), provider_ref: unique("tx"), ...fields });

describe("payment_attempts", () => {
  it("starts as a created Bale attempt with Rial money and a raw provider payload", async () => {
    const row = await newPaymentAttempt(db, { raw: JSON.stringify({ ok: true }) });
    expect(row).toMatchObject({ status: "created", provider: "bale", flow: "bot_chat", provider_ref: null, verified_at: null, raw: { ok: true } });
    expect(Number(row.amount_rial)).toBe(1_000_000);
  });

  it("rejects a second verified payment with the same idempotency key", async () => {
    const key = unique("idem");
    await newPaymentAttempt(db, verified({ idempotency_key: key }));
    await expectViolation(newPaymentAttempt(db, verified({ idempotency_key: key })), /payment_attempts_idempotency_key_key/);
    await expectViolation(newPaymentAttempt(db, { idempotency_key: key }), /payment_attempts_idempotency_key_key/);
  });

  it("keeps the invoice payload and the provider reference unique", async () => {
    const first = await newPaymentAttempt(db, verified());
    await expectViolation(newPaymentAttempt(db, { payload: first.payload }), /payment_attempts_payload_key/);
    await expectViolation(newPaymentAttempt(db, verified({ provider_ref: first.provider_ref })), /payment_attempts_provider_ref_key/);
    await newPaymentAttempt(db, verified({ provider: "zarinpal", provider_ref: first.provider_ref }));
    await newPaymentAttempt(db);
    await newPaymentAttempt(db);
  });

  it("accepts every status and flow in the spec and rejects others", async () => {
    for (const status of ["created", "pending", "pre_checkout_ok", "paid_unverified", "failed", "expired"]) {
      await newPaymentAttempt(db, { status });
    }
    await newPaymentAttempt(db, verified({ status: "refunded" }));
    await newPaymentAttempt(db, { flow: "invoice_link" });
    await expectViolation(newPaymentAttempt(db, { status: "paid" }), /payment_attempts_status_valid/);
    await expectViolation(newPaymentAttempt(db, { flow: "redirect" }), /payment_attempts_flow_valid/);
    await expectViolation(newPaymentAttempt(db, { provider: "paypal" }), /payment_attempts_provider_valid/);
  });

  it("only verified or refunded attempts carry verified_at and a provider reference", async () => {
    await expectViolation(newPaymentAttempt(db, { status: "verified", provider_ref: unique("tx") }), /payment_attempts_verified_matches_status/);
    await expectViolation(newPaymentAttempt(db, { verified_at: new Date() }), /payment_attempts_verified_matches_status/);
    await expectViolation(newPaymentAttempt(db, { status: "verified", verified_at: new Date() }), /payment_attempts_verified_needs_ref/);
  });

  it("validates amount, expiry, raw shape and non-blank keys", async () => {
    await expectViolation(newPaymentAttempt(db, { amount_rial: 0 }), /payment_attempts_amount_positive/);
    await expectViolation(newPaymentAttempt(db, { expires_at: new Date(Date.now() - HOUR), created_at: new Date() }), /payment_attempts_expires_after_create/);
    await expectViolation(newPaymentAttempt(db, { raw: JSON.stringify([1]) }), /payment_attempts_raw_object/);
    await expectViolation(newPaymentAttempt(db, { idempotency_key: " " }), /payment_attempts_idempotency_key_present/);
    await expectViolation(newPaymentAttempt(db, { payload: "" }), /payment_attempts_payload_present/);
  });

  it("is kept, anonymised, when the user is purged, and restricts deleting its price", async () => {
    const user = await newUser(db);
    const row = await newPaymentAttempt(db, { user_id: user.id });
    await expectViolation(db.query("delete from plan_prices where id = $1", [row.plan_price_id]), /payment_attempts_plan_price_id_fkey/);
    await db.query("delete from users where id = $1", [user.id]);
    expect((await db.query("select user_id from payment_attempts where id = $1", [row.id])).rows[0].user_id).toBeNull();
  });
});

describe("invoices", () => {
  const invoice = async (fields = {}) => {
    const attempt = fields.payment_attempt_id ? null : await newPaymentAttempt(db, verified());
    const price = attempt ? await db.query("select plan_key from plan_prices where id = $1", [attempt.plan_price_id]) : null;
    return insert(db, "invoices", {
      user_id: attempt?.user_id, payment_attempt_id: attempt?.id, number: unique("INV"), amount_rial: 800_000,
      discount_rial: 200_000, plan_key: price?.rows[0].plan_key, period_start: "2026-11-10T00:00:00Z", period_end: "2026-12-10T00:00:00Z", ...fields,
    });
  };

  it("issues one invoice per payment attempt with a unique number", async () => {
    const first = await invoice();
    expect(first.issued_at).toBeInstanceOf(Date);
    await expectViolation(invoice({ payment_attempt_id: first.payment_attempt_id, user_id: first.user_id, plan_key: first.plan_key }), /invoices_payment_attempt_key/);
    await expectViolation(invoice({ number: first.number }), /invoices_number_key/);
  });

  it("validates amounts, period and number", async () => {
    await expectViolation(invoice({ amount_rial: -1 }), /invoices_amounts_valid/);
    await expectViolation(invoice({ discount_rial: -1 }), /invoices_amounts_valid/);
    await expectViolation(invoice({ period_end: "2026-11-09T00:00:00Z" }), /invoices_period_valid/);
    await expectViolation(invoice({ number: " " }), /invoices_number_present/);
  });

  it("survives user purge (anonymised) and blocks deleting its payment attempt", async () => {
    const row = await invoice();
    await expectViolation(db.query("delete from payment_attempts where id = $1", [row.payment_attempt_id]), /invoices_payment_attempt_id_fkey/);
    await db.query("delete from users where id = $1", [row.user_id]);
    expect((await db.query("select user_id from invoices where id = $1", [row.id])).rows[0].user_id).toBeNull();
  });
});

describe("payment_provider_events", () => {
  const event = (fields = {}) => insert(db, "payment_provider_events", {
    provider: "bale", event_type: "successful_payment", provider_event_id: unique("upd"), payload: JSON.stringify({ update_id: 1 }), ...fields,
  });

  it("dedupes provider events per provider", async () => {
    const first = await event();
    expect(first.received_at).toBeInstanceOf(Date);
    await expectViolation(event({ provider_event_id: first.provider_event_id }), /payment_provider_events_provider_event_key/);
    await event({ provider: "zibal", provider_event_id: first.provider_event_id });
  });

  it("validates provider and payload shape, and keeps events when the attempt is deleted", async () => {
    await expectViolation(event({ provider: "paypal" }), /payment_provider_events_provider_valid/);
    await expectViolation(event({ payload: JSON.stringify("x") }), /payment_provider_events_payload_object/);
    const attempt = await newPaymentAttempt(db);
    const row = await event({ payment_attempt_id: attempt.id });
    await db.query("delete from payment_attempts where id = $1", [attempt.id]);
    expect((await db.query("select payment_attempt_id from payment_provider_events where id = $1", [row.id])).rows[0].payment_attempt_id).toBeNull();
  });
});

describe("discount_codes and redemptions", () => {
  const code = (fields = {}) => insert(db, "discount_codes", { code: unique("OFF").toUpperCase(), percent_off: 20, ...fields });

  it("needs exactly one of percent or fixed amount, within range", async () => {
    expect((await code({ percent_off: 100 })).per_user_limit).toBe(1);
    await code({ percent_off: null, amount_off_rial: 500_000 });
    await expectViolation(code({ percent_off: null }), /discount_codes_one_discount_kind/);
    await expectViolation(code({ amount_off_rial: 1000 }), /discount_codes_one_discount_kind/);
    await expectViolation(code({ percent_off: 101 }), /discount_codes_percent_valid/);
    await expectViolation(code({ percent_off: 0 }), /discount_codes_percent_valid/);
    await expectViolation(code({ percent_off: null, amount_off_rial: 0 }), /discount_codes_amount_valid/);
  });

  it("keeps codes unique and well-formed with sane limits and window", async () => {
    const first = await code();
    await expectViolation(code({ code: first.code }), /discount_codes_code_key/);
    await expectViolation(code({ code: "bad code" }), /discount_codes_code_format/);
    await expectViolation(code({ max_redemptions: 0 }), /discount_codes_limits_valid/);
    await expectViolation(code({ per_user_limit: 0 }), /discount_codes_limits_valid/);
    await expectViolation(code({ valid_from: "2026-12-01T00:00:00Z", valid_until: "2026-11-01T00:00:00Z" }), /discount_codes_window_valid/);
    const plan = await newPlan(db);
    const scoped = await code({ plan_key: plan.key });
    await expectViolation(db.query("delete from plans where key = $1", [plan.key]), /discount_codes_plan_key_fkey/);
    expect(scoped.plan_key).toBe(plan.key);
  });

  it("records one redemption per payment attempt and restricts deleting a redeemed code", async () => {
    const discount = await code();
    const user = await newUser(db);
    const attempt = await newPaymentAttempt(db, { user_id: user.id, discount_code_id: discount.id });
    const redeem = (fields = {}) => insert(db, "discount_redemptions", {
      discount_code_id: discount.id, user_id: user.id, payment_attempt_id: attempt.id, discount_rial: 200_000, ...fields,
    });
    await redeem();
    await expectViolation(redeem(), /discount_redemptions_attempt_key/);
    await expectViolation(redeem({ discount_rial: -5, payment_attempt_id: (await newPaymentAttempt(db)).id }), /discount_redemptions_amount_valid/);
    await expectViolation(db.query("delete from discount_codes where id = $1", [discount.id]), /discount_redemptions_discount_code_id_fkey/);
    await db.query("delete from users where id = $1", [user.id]);
    expect(await count(db, "discount_redemptions", "payment_attempt_id = $1", [attempt.id])).toBe(0);
  });
});

describe("credit wallet, lots and ledger", () => {
  it("has one wallet per user with a non-negative balance", async () => {
    const user = await newUser(db);
    expect(Number((await insert(db, "credit_wallets", { user_id: user.id })).balance_rial)).toBe(0);
    await expectViolation(insert(db, "credit_wallets", { user_id: user.id }), /credit_wallets_pkey/);
    await expectViolation(insert(db, "credit_wallets", { user_id: (await newUser(db)).id, balance_rial: -1 }), /credit_wallets_balance_valid/);
  });

  it("keeps lots consistent: positive initial, remaining within initial, known source", async () => {
    const user = await newUser(db);
    const lot = (fields = {}) => insert(db, "credit_lots", { user_id: user.id, source: "referral_reward", initial_rial: 500_000, remaining_rial: 500_000, ...fields });
    await lot();
    await expectViolation(lot({ source: "gift" }), /credit_lots_source_valid/);
    await expectViolation(lot({ initial_rial: 0, remaining_rial: 0 }), /credit_lots_amounts_valid/);
    await expectViolation(lot({ remaining_rial: 600_000 }), /credit_lots_amounts_valid/);
    await expectViolation(lot({ remaining_rial: -1 }), /credit_lots_amounts_valid/);
  });

  it("signs ledger entries by kind and never lets a balance go negative", async () => {
    const user = await newUser(db);
    const entry = (fields = {}) => insert(db, "credit_ledger", { user_id: user.id, kind: "grant", amount_rial: 500_000, balance_after_rial: 500_000, ...fields });
    await entry();
    await entry({ kind: "spend", amount_rial: -200_000, balance_after_rial: 300_000 });
    await entry({ kind: "adjust", amount_rial: -1, balance_after_rial: 299_999 });
    await expectViolation(entry({ kind: "grant", amount_rial: -5 }), /credit_ledger_sign_matches_kind/);
    await expectViolation(entry({ kind: "spend", amount_rial: 5 }), /credit_ledger_sign_matches_kind/);
    await expectViolation(entry({ kind: "adjust", amount_rial: 0 }), /credit_ledger_amount_nonzero/);
    await expectViolation(entry({ kind: "refund", amount_rial: 5, balance_after_rial: -1 }), /credit_ledger_balance_valid/);
    await expectViolation(entry({ kind: "sale" }), /credit_ledger_kind_valid/);
  });

  it("links ledger entries to lots and payment attempts without blocking their deletion", async () => {
    const user = await newUser(db);
    const lot = await insert(db, "credit_lots", { user_id: user.id, source: "admin_grant", initial_rial: 10, remaining_rial: 10 });
    const attempt = await newPaymentAttempt(db, { user_id: user.id });
    const row = await insert(db, "credit_ledger", { user_id: user.id, lot_id: lot.id, payment_attempt_id: attempt.id, kind: "grant", amount_rial: 10, balance_after_rial: 10 });
    await db.query("delete from credit_lots where id = $1", [lot.id]);
    await db.query("delete from payment_attempts where id = $1", [attempt.id]);
    const after = await db.query("select lot_id, payment_attempt_id from credit_ledger where id = $1", [row.id]);
    expect(after.rows[0]).toEqual({ lot_id: null, payment_attempt_id: null });
  });
});

describe("referrals", () => {
  const referral = async () => {
    const owner = await newUser(db);
    const code = await insert(db, "referral_codes", { user_id: owner.id, code: unique("REF").replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(-10).padStart(6, "A") });
    return { owner, code };
  };

  it("gives each user one uppercase alphanumeric code", async () => {
    const { owner, code } = await referral();
    expect(code.is_active).toBe(true);
    await expectViolation(insert(db, "referral_codes", { user_id: owner.id, code: "OTHER123" }), /referral_codes_user_key/);
    await expectViolation(insert(db, "referral_codes", { user_id: (await newUser(db)).id, code: code.code }), /referral_codes_code_key/);
    await expectViolation(insert(db, "referral_codes", { user_id: (await newUser(db)).id, code: "lower1" }), /referral_codes_code_format/);
    await expectViolation(insert(db, "referral_codes", { user_id: (await newUser(db)).id, code: "AB" }), /referral_codes_code_format/);
  });

  it("attributes a user to at most one referrer and cascades with the code", async () => {
    const { code } = await referral();
    const second = await referral();
    const referred = await newUser(db);
    const attribution = await insert(db, "referral_attributions", { code_id: code.id, referred_user_id: referred.id });
    expect(attribution.qualified_at).toBeNull();
    await expectViolation(insert(db, "referral_attributions", { code_id: second.code.id, referred_user_id: referred.id }), /referral_attributions_referred_key/);
    await db.query("delete from users where id = $1", [code.user_id]);
    expect(await count(db, "referral_attributions", "id = $1", [attribution.id])).toBe(0);
  });

  it("grants at most one reward per party with a positive amount and a consistent status", async () => {
    const { code } = await referral();
    const referred = await newUser(db);
    const attribution = await insert(db, "referral_attributions", { code_id: code.id, referred_user_id: referred.id });
    const reward = (fields = {}) => insert(db, "referral_rewards", { attribution_id: attribution.id, beneficiary_user_id: code.user_id, amount_rial: 300_000, ...fields });
    expect((await reward()).status).toBe("pending");
    await expectViolation(reward(), /referral_rewards_attribution_beneficiary_key/);
    await reward({ beneficiary_user_id: referred.id, status: "granted", granted_at: new Date() });
    const other = (await newUser(db)).id;
    await expectViolation(reward({ beneficiary_user_id: other, amount_rial: 0 }), /referral_rewards_amount_positive/);
    await expectViolation(reward({ beneficiary_user_id: other, status: "paid" }), /referral_rewards_status_valid/);
    await expectViolation(reward({ beneficiary_user_id: other, status: "granted" }), /referral_rewards_granted_matches_status/);
    await expectViolation(reward({ beneficiary_user_id: other, granted_at: new Date() }), /referral_rewards_granted_matches_status/);
  });

  it("links a reward to its credit lot, nulling the link when the lot goes", async () => {
    const { code } = await referral();
    const attribution = await insert(db, "referral_attributions", { code_id: code.id, referred_user_id: (await newUser(db)).id });
    const lot = await insert(db, "credit_lots", { user_id: code.user_id, source: "referral_reward", initial_rial: 10, remaining_rial: 10 });
    const row = await insert(db, "referral_rewards", { attribution_id: attribution.id, beneficiary_user_id: code.user_id, amount_rial: 10, credit_lot_id: lot.id });
    await db.query("delete from credit_lots where id = $1", [lot.id]);
    expect((await db.query("select credit_lot_id from referral_rewards where id = $1", [row.id])).rows[0].credit_lot_id).toBeNull();
  });
});
