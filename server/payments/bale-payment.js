// Website checkout opens the Bale bot. The bot sends a wallet invoice.
// Premium is written only after inquireTransaction says the charge is paid
// for the exact amount on the payment attempt.
import crypto from "node:crypto";
import { ApiError } from "../core/errors.js";
import { activateVerifiedPayment } from "./activate-subscription.js";

const TEST_PROVIDER_TOKEN = "WALLET-TEST-1111111111111111";
const OPEN_STATUSES = ["created", "pending", "pre_checkout_ok"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CHECKOUT_TTL_MS = 24 * 60 * 60 * 1000;

const COPY = Object.freeze({
  buyOnSite: "برای خرید اشتراک، از داخل سایت روی خرید بزن.",
  linkDead: "این لینک پرداخت معتبر نیست یا مهلتش تمام شده. از صفحه اشتراک دوباره خرید را بزن.",
  notFound: "این صورتحساب پیدا نشد یا دیگر معتبر نیست.",
  amount: "مبلغ صورتحساب با طرح انتخاب‌شده یکی نیست.",
  expired: "مهلت این صورتحساب تمام شده. از سایت دوباره خرید را بزن.",
  unavailable: "الان نمی‌توانیم پرداخت را تأیید کنیم. کمی بعد دوباره تلاش کن.",
  invoiceFailed: "ارسال صورتحساب نشد. یک بار دیگر روی لینک خرید بزن.",
});

/**
 * A live wallet token must not run while the app still says it is in test mode.
 * @param {Record<string, any>} config
 * @returns {null|"bad_mode"|"live_token_in_test_mode"|"missing_bot_username"}
 */
export function paymentModeProblem(config) {
  const mode = config.BALE_PAYMENT_MODE ?? "test";
  if (mode !== "test" && mode !== "live") return "bad_mode";
  const token = config.BALE_PAYMENT_PROVIDER_TOKEN ?? "";
  if (mode === "test" && token !== TEST_PROVIDER_TOKEN) return "live_token_in_test_mode";
  const username = String(config.BALE_BOT_USERNAME ?? "").replace(/^@/, "");
  if (!/^[A-Za-z][A-Za-z0-9_]{3,31}$/.test(username)) return "missing_bot_username";
  return null;
}

/**
 * @param {Record<string, any>} config
 * @returns {string|null}
 */
function siteBase(config) {
  const raw = typeof config.APP_BASE_URL === "string" ? config.APP_BASE_URL.trim().replace(/\/$/, "") : "";
  if (/^https:\/\/\S+$/.test(raw)) return raw;
  if (config.NODE_ENV !== "production") return `http://localhost:${config.PORT || 3000}`;
  return null;
}

/** @param {string} text @param {number} max */
function clip(text, max) {
  const value = String(text ?? "").trim();
  if (value.length <= max) return value;
  return value.slice(0, max);
}

/**
 * @param {{query: Function, transaction: Function}} db
 * @param {Record<string, any>} config
 * @param {ReturnType<import("./bale-client.js").createBaleClient>} client
 * @param {() => Date} [now]
 */
export function createBalePayment({ db, config, client, now = () => new Date() }) {
  const username = String(config.BALE_BOT_USERNAME ?? "").replace(/^@/, "");
  const providerToken = config.BALE_PAYMENT_PROVIDER_TOKEN;

  return {
    /**
     * Pending attempt plus the bot deep link. Does not grant premium.
     * @param {{userId: string, planKey: string, planPriceId: string, amountRial: number}} input
     */
    async createCheckout({ userId, planKey, planPriceId, amountRial }) {
      if (paymentModeProblem(config)) {
        throw new ApiError(503, "payment_unavailable", { details: { reason: paymentModeProblem(config) } });
      }
      const at = now();
      const open = await db.query(
        `select payload from payment_attempts
         where user_id = $1 and plan_price_id = $2 and amount_rial = $3
           and provider = 'bale' and status in ('created', 'pending', 'pre_checkout_ok') and expires_at > $4
         order by created_at desc limit 1`,
        [userId, planPriceId, amountRial, at],
      );
      const payload = open.rows[0]?.payload ?? await insertAttempt({
        db, userId, planPriceId, amountRial, at,
      });
      return {
        url: `https://ble.ir/${username}?start=${payload}`,
        attemptId: payload,
        planKey,
      };
    },

    /** @param {any} update */
    handleUpdate(update) {
      return handleUpdate({ db, config, client, now, providerToken, update });
    },

    reconcile() {
      return reconcile({ db, client, now });
    },
  };
}

/**
 * @param {{db: {query: Function}, userId: string, planPriceId: string, amountRial: number, at: Date}} input
 */
async function insertAttempt({ db, userId, planPriceId, amountRial, at }) {
  const id = crypto.randomUUID();
  await db.query(
    `insert into payment_attempts (
       id, user_id, plan_price_id, amount_rial, provider, flow, status,
       idempotency_key, payload, expires_at
     ) values ($1::uuid, $2, $3, $4, 'bale', 'bot_chat', 'pending', $5, $6, $7)`,
    [id, userId, planPriceId, amountRial, crypto.randomUUID(), id, new Date(at.getTime() + CHECKOUT_TTL_MS)],
  );
  return id;
}

/**
 * @param {{db: {query: Function}, config: Record<string, any>, client: any, now: () => Date,
 *          providerToken: string, update: any}} ctx
 */
async function handleUpdate({ db, config, client, now, providerToken, update }) {
  if (update?.pre_checkout_query) {
    await answerPreCheckout({ db, client, now, query: update.pre_checkout_query });
    return;
  }
  const message = update?.message;
  if (!message) return;
  if (message.successful_payment) {
    await onPaid({ db, config, client, now, message });
    return;
  }
  if (typeof message.text === "string") {
    await onStart({ db, client, now, providerToken, message });
  }
}

/**
 * @param {{db: {query: Function}, client: any, now: () => Date, providerToken: string, message: any}} ctx
 */
async function onStart({ db, client, now, providerToken, message }) {
  const match = message.text.match(/^\/start(?:@\w+)?(?:\s+(\S+))?$/);
  if (!match) return;
  const chatId = message.chat?.id;
  if (chatId === undefined || chatId === null) return;
  const payload = match[1];
  if (!payload || !UUID.test(payload)) {
    await client.sendMessage(chatId, COPY.buyOnSite);
    return;
  }
  const attempt = await findAttempt(db, payload);
  if (!attempt || !OPEN_STATUSES.includes(attempt.status) || new Date(attempt.expires_at) <= now()) {
    await client.sendMessage(chatId, COPY.linkDead);
    return;
  }
  const plan = (await db.query("select name_fa from plans where key = $1", [attempt.plan_key])).rows[0];
  const title = clip(plan?.name_fa, 32) || "پریمیوم";
  try {
    await client.sendInvoice({
      chat_id: chatId,
      title,
      description: clip(`اشتراک ${title} باندورا`, 255),
      payload: attempt.payload,
      provider_token: providerToken,
      prices: [{ label: title, amount: Number(attempt.amount_rial) }],
    });
  } catch {
    await client.sendMessage(chatId, COPY.invoiceFailed);
  }
}

/**
 * @param {{db: {query: Function}, client: any, now: () => Date, query: any}} ctx
 */
async function answerPreCheckout({ db, client, now, query }) {
  const id = String(query?.id ?? "");
  try {
    const decision = await preCheckoutDecision(db, query, now());
    if (decision.ok && decision.attemptId) {
      await db.query(
        `update payment_attempts set status = 'pre_checkout_ok'
         where id = $1 and status in ('created', 'pending', 'pre_checkout_ok')`,
        [decision.attemptId],
      );
    }
    await client.answerPreCheckoutQuery({
      pre_checkout_query_id: id,
      ok: decision.ok,
      ...(decision.ok ? {} : { error_message: decision.error }),
    });
  } catch {
    await client.answerPreCheckoutQuery({
      pre_checkout_query_id: id, ok: false, error_message: COPY.unavailable,
    });
  }
}

/**
 * @param {{query: Function}} db
 * @param {any} query
 * @param {Date} at
 */
async function preCheckoutDecision(db, query, at) {
  const payload = String(query?.invoice_payload ?? "");
  if (!UUID.test(payload)) return { ok: false, error: COPY.notFound };
  const attempt = await findAttempt(db, payload);
  if (!attempt || !attempt.user_id || !OPEN_STATUSES.includes(attempt.status)) {
    return { ok: false, error: COPY.notFound };
  }
  if (new Date(attempt.expires_at) <= at) return { ok: false, error: COPY.expired };
  if (query.currency !== "IRR" || Number(query.total_amount) !== Number(attempt.amount_rial)) {
    return { ok: false, error: COPY.amount };
  }
  return { ok: true, attemptId: attempt.id };
}

/**
 * @param {{db: {query: Function, transaction: Function}, config: Record<string, any>, client: any,
 *          now: () => Date, message: any}} ctx
 */
async function onPaid({ db, config, client, now, message }) {
  const payment = message.successful_payment;
  const payload = String(payment?.invoice_payload ?? "");
  const chargeId = String(payment?.telegram_payment_charge_id ?? "");
  if (!UUID.test(payload) || !chargeId || payment.currency !== "IRR") return;
  const marked = await db.query(
    `update payment_attempts
     set status = 'paid_unverified', provider_ref = $2, raw = $3::jsonb
     where payload = $1 and provider = 'bale'
       and status in ('created', 'pending', 'pre_checkout_ok', 'paid_unverified')
       and (provider_ref is null or provider_ref = $2)
     returning id`,
    [payload, chargeId, JSON.stringify({ successfulPayment: payment })],
  );
  if (!marked.rows[0]) return;
  const result = await confirmAttempt(db, client, marked.rows[0].id, now());
  if (!result.ok) return;
  const base = siteBase(config);
  const text = base
    ? `پرداخت ثبت شد و اشتراک پریمیوم فعال شد.\n${base}/app/subscription`
    : "پرداخت ثبت شد و اشتراک پریمیوم فعال شد. به سایت برگرد و صفحه اشتراک را تازه کن.";
  await client.sendMessage(message.chat.id, text).catch(() => {});
}

/**
 * Re-check charges that were reported paid but not yet verified (inquire failed mid-flight).
 * @param {{db: {query: Function, transaction: Function}, client: any, now: () => Date}} ctx
 */
async function reconcile({ db, client, now }) {
  const open = await db.query(
    `select id from payment_attempts
     where provider = 'bale' and status = 'paid_unverified' and provider_ref is not null
       and (raw is null or raw->>'mismatch' is distinct from 'true')
     order by created_at limit 20`,
  );
  for (const row of open.rows) {
    try {
      await confirmAttempt(db, client, row.id, now());
    } catch {
      // The next poll tries again. Nothing is granted without a paid inquire.
    }
  }
}

/**
 * @param {{query: Function, transaction: Function}} db
 * @param {{inquireTransaction: Function}} client
 * @param {string} attemptId
 * @param {Date} at
 */
async function confirmAttempt(db, client, attemptId, at) {
  const row = (await db.query(
    `select id, status, provider_ref, amount_rial::text as amount_rial
     from payment_attempts where id = $1 and provider = 'bale'`,
    [attemptId],
  )).rows[0];
  if (!row?.provider_ref) return { ok: false, reason: "no_ref" };
  if (row.status === "verified") return { ok: true, already: true };
  const info = await client.inquireTransaction(row.provider_ref);
  if (!info || info.status !== "paid") {
    if (info && (info.status === "failed" || info.status === "rejected")) {
      await db.query(
        `update payment_attempts set status = 'failed', raw = $2::jsonb
         where id = $1 and status = 'paid_unverified'`,
        [attemptId, JSON.stringify({ inquire: publicTransaction(info) })],
      );
    }
    return { ok: false, reason: info?.status ?? "unknown" };
  }
  if (Number(info.amount) !== Number(row.amount_rial)) {
    await db.query(
      "update payment_attempts set raw = $2::jsonb where id = $1",
      [attemptId, JSON.stringify({ inquire: publicTransaction(info), mismatch: true })],
    );
    return { ok: false, reason: "amount" };
  }
  return activateVerifiedPayment(db, {
    attemptId,
    providerRef: row.provider_ref,
    amountRial: Number(info.amount),
    raw: { inquire: publicTransaction(info) },
    now: at,
  });
}

/** Drop anything the wallet object might carry beyond the fields we act on. */
function publicTransaction(info) {
  return {
    id: info.id ?? null,
    status: info.status ?? null,
    userID: info.userID ?? null,
    amount: info.amount ?? null,
    createdAt: info.createdAt ?? null,
  };
}

/**
 * @param {{query: Function}} db
 * @param {string} payload
 */
async function findAttempt(db, payload) {
  const { rows } = await db.query(
    `select a.id, a.user_id, a.payload, a.status, a.expires_at, a.amount_rial::text as amount_rial, p.key as plan_key
     from payment_attempts a
     join plan_prices pp on pp.id = a.plan_price_id
     join plans p on p.key = pp.plan_key
     where a.provider = 'bale' and a.payload = $1`,
    [payload],
  );
  return rows[0] ?? null;
}
