import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createBalePayment, paymentModeProblem } from "./bale-payment.js";
import { BaleApiError, createBaleClient } from "./bale-client.js";
import { createTestApp, freshPhone } from "../test-support/http-app.js";

const CONFIG = {
  BALE_BOT_TOKEN: "test-bot-token",
  BALE_PAYMENT_PROVIDER_TOKEN: "WALLET-TEST-1111111111111111",
  BALE_BOT_USERNAME: "Paymentbandorabot",
  BALE_PAYMENT_MODE: "test",
  PORT: "3000",
};
const AMOUNT = 1_000_000;

let t;
let payment;
/** @type {{invoices: any[], answers: any[], messages: string[], inquire: any}} */
let bale;

beforeAll(async () => {
  bale = { invoices: [], answers: [], messages: [], inquire: { status: "paid", amount: AMOUNT, userID: 42, createdAt: 1 } };
  const client = {
    async sendInvoice(body) {
      bale.invoices.push(body);
      return { message_id: bale.invoices.length };
    },
    async sendMessage(_chatId, text) {
      bale.messages.push(text);
      return true;
    },
    async answerPreCheckoutQuery(body) {
      bale.answers.push(body);
      return true;
    },
    async inquireTransaction(id) {
      return { ...bale.inquire, id };
    },
  };
  t = await createTestApp({
    config: CONFIG,
    paymentProvider: ({ db, now }) => {
      payment = createBalePayment({ db, config: CONFIG, client, now });
      return payment;
    },
  });
});
afterAll(() => t.close());

beforeEach(async () => {
  bale.invoices = [];
  bale.answers = [];
  bale.messages = [];
  bale.inquire = { status: "paid", amount: AMOUNT, userID: 42, createdAt: 1 };
  await t.db.query("delete from subscription_events");
  await t.db.query("delete from invoices");
  await t.db.query("delete from subscriptions");
  await t.db.query("delete from payment_provider_events");
  await t.db.query("delete from payment_attempts");
  await t.db.query("update plan_prices set is_active = false");
  await t.db.query("insert into plan_prices (plan_key, amount_rial) values ('premium_monthly', $1)", [AMOUNT]);
});

async function buyer() {
  const device = t.client();
  const signed = await t.signUp(device, freshPhone());
  return { device, user: signed.json.user };
}

describe("paymentModeProblem", () => {
  it("refuses a live wallet token while mode is still test", () => {
    expect(paymentModeProblem({ ...CONFIG, BALE_PAYMENT_PROVIDER_TOKEN: "WALLET-live", BALE_PAYMENT_MODE: "test" }))
      .toBe("live_token_in_test_mode");
    expect(paymentModeProblem(CONFIG)).toBeNull();
    expect(paymentModeProblem({ ...CONFIG, BALE_PAYMENT_MODE: "live", BALE_PAYMENT_PROVIDER_TOKEN: "WALLET-live" })).toBeNull();
  });
});

describe("Bale client errors", () => {
  it("does not put the bot token in a failed request error", async () => {
    const token = "1:secret-token-value";
    const client = createBaleClient({
      token,
      fetchImpl: async (url) => {
        expect(String(url)).toContain(token);
        return { json: async () => ({ ok: false, description: "nope" }), status: 401 };
      },
    });
    const error = await client.sendMessage(1, "hi").catch((caught) => caught);
    expect(error).toBeInstanceOf(BaleApiError);
    expect(String(error.message)).not.toContain(token);
    expect(String(error.stack)).not.toContain("secret-token-value");
  });
});

describe("Bale premium checkout", () => {
  it("opens the bot and grants premium only after inquire says paid", async () => {
    const { device, user } = await buyer();
    const checkout = await device.request("POST", "/api/billing/checkout", { body: { planKey: "premium_monthly" } });
    expect(checkout.status).toBe(201);
    expect(checkout.json.url).toMatch(/^https:\/\/ble\.ir\/Paymentbandorabot\?start=[0-9a-f-]{36}$/);
    expect((await device.request("GET", "/api/me")).json.subscription.plan).toBe("free");

    const payload = checkout.json.url.split("start=")[1];
    await payment.handleUpdate({ update_id: 1, message: { chat: { id: 99 }, text: `/start ${payload}` } });
    expect(bale.invoices).toHaveLength(1);
    expect(bale.invoices[0]).toMatchObject({
      chat_id: 99,
      payload,
      provider_token: CONFIG.BALE_PAYMENT_PROVIDER_TOKEN,
      prices: [{ amount: AMOUNT }],
    });
    expect(JSON.stringify(bale.invoices[0])).not.toContain(CONFIG.BALE_BOT_TOKEN);

    await payment.handleUpdate({
      update_id: 2,
      pre_checkout_query: { id: "pq1", currency: "IRR", total_amount: 1, invoice_payload: payload, from: { id: 99 } },
    });
    expect(bale.answers.at(-1)).toMatchObject({ ok: false });
    expect((await device.request("GET", "/api/me")).json.subscription.plan).toBe("free");

    await payment.handleUpdate({
      update_id: 3,
      pre_checkout_query: { id: "pq2", currency: "IRR", total_amount: AMOUNT, invoice_payload: payload, from: { id: 99 } },
    });
    expect(bale.answers.at(-1)).toMatchObject({ pre_checkout_query_id: "pq2", ok: true });

    const paid = {
      update_id: 4,
      message: {
        chat: { id: 99 },
        successful_payment: {
          currency: "IRR", total_amount: AMOUNT, invoice_payload: payload, telegram_payment_charge_id: "chg-1",
        },
      },
    };
    await payment.handleUpdate(paid);
    await payment.handleUpdate(paid);
    const me = await device.request("GET", "/api/me");
    expect(me.json.subscription.plan).toBe("premium_monthly");
    const ends = new Date(me.json.subscription.endsAt).getTime();
    expect(ends - t.clock.now().getTime()).toBe(30 * 24 * 60 * 60 * 1000);
    expect((await t.db.query("select count(*)::int as n from invoices where user_id = $1", [user.id])).rows[0].n).toBe(1);
    expect((await t.db.query("select status from payment_attempts where payload = $1", [payload])).rows[0].status).toBe("verified");
    expect(bale.messages.some((text) => text.includes("/app/subscription"))).toBe(true);
  });

  it("does not grant premium when the wallet says the charge is not paid", async () => {
    const { device } = await buyer();
    bale.inquire = { status: "pending", amount: AMOUNT, userID: 42, createdAt: 1 };
    const checkout = await device.request("POST", "/api/billing/checkout", { body: { planKey: "premium_monthly" } });
    const payload = checkout.json.url.split("start=")[1];
    await payment.handleUpdate({
      update_id: 10,
      message: {
        chat: { id: 7 },
        successful_payment: {
          currency: "IRR", total_amount: AMOUNT, invoice_payload: payload, telegram_payment_charge_id: "chg-pending",
        },
      },
    });
    expect((await device.request("GET", "/api/me")).json.subscription.plan).toBe("free");
    expect((await t.db.query("select status from payment_attempts where payload = $1", [payload])).rows[0].status).toBe("paid_unverified");
  });

  it("extends a live subscription from its current end, once", async () => {
    const { device, user } = await buyer();
    const currentEnd = new Date(t.clock.now().getTime() + 10 * 24 * 60 * 60 * 1000);
    await t.db.query(
      `insert into subscriptions (user_id, plan_key, status, source, reason, started_at, ends_at)
       values ($1, 'premium_monthly', 'active', 'manual', 'fixture', $2, $3)`,
      [user.id, new Date(t.clock.now().getTime() - 20 * 24 * 60 * 60 * 1000), currentEnd],
    );
    const checkout = await device.request("POST", "/api/billing/checkout", { body: { planKey: "premium_monthly" } });
    const payload = checkout.json.url.split("start=")[1];
    await payment.handleUpdate({
      update_id: 11,
      message: {
        chat: { id: 7 },
        successful_payment: {
          currency: "IRR", total_amount: AMOUNT, invoice_payload: payload, telegram_payment_charge_id: "chg-extend",
        },
      },
    });
    const endsAt = (await device.request("GET", "/api/me")).json.subscription.endsAt;
    expect(new Date(endsAt).getTime() - currentEnd.getTime()).toBe(30 * 24 * 60 * 60 * 1000);
    expect((await t.db.query("select count(*)::int as n from subscriptions where user_id = $1", [user.id])).rows[0].n).toBe(1);
  });
});
