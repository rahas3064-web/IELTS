// Billing reads (spec S10/S11): plan catalogue, effective subscription, monthly AI quotas,
// discount quotes. Nothing here grants access: a subscription row is only ever written by
// a server-verified Bale payment, or a separate audited admin grant.
import { featureStatus } from "../core/env.js";
import { tehranMonthBounds, tehranMonthKey } from "../core/tehran-time.js";

export const QUOTA_KEYS = Object.freeze(["writing_scoring", "speaking_scoring", "assistant_messages", "full_mock"]);
/** Approved rule: a lapsed subscription keeps access for 3 days unless grace_ends_at says otherwise. */
export const GRACE_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

const toNumber = (value) => (value === null || value === undefined ? null : Number(value));

/**
 * Resolve a live subscriptions row (or none) to the access it gives at `now`. Respects
 * the active/grace states even before an expiry job has flipped the row's status.
 * @param {{plan_key: string, status: string, ends_at: any, grace_ends_at: any, tier: string}|null|undefined} row
 * @param {Date} now
 * @returns {{plan: string, tier: "free"|"premium", status: "free"|"active"|"grace", endsAt: string|null, graceEndsAt: string|null}}
 */
export function resolveSubscription(row, now) {
  const free = { plan: "free", tier: "free", status: "free", endsAt: null, graceEndsAt: null };
  if (!row || !row.plan_key) return free;
  const endsAt = new Date(row.ends_at);
  const graceEndsAt = row.grace_ends_at ? new Date(row.grace_ends_at) : new Date(endsAt.getTime() + GRACE_DAYS * DAY_MS);
  const t = now.getTime();
  let status;
  if (row.status === "active" && endsAt.getTime() > t) status = "active";
  else if (graceEndsAt.getTime() > t) status = "grace";
  else return free;
  return { plan: row.plan_key, tier: row.tier, status, endsAt: endsAt.toISOString(), graceEndsAt: graceEndsAt.toISOString() };
}

/** SQL for the user's newest active/grace row; `$1` is the user id. */
export const LIVE_SUBSCRIPTION_SQL = `select s.plan_key, s.status, s.ends_at, s.grace_ends_at, p.tier
     from subscriptions s join plans p on p.key = s.plan_key
     where s.user_id = $1 and s.status in ('active', 'grace')
     order by s.started_at desc
     limit 1`;

/**
 * The subscription that gives access right now, or the free plan.
 * @param {{query: Function}} db @param {string} userId @param {Date} [now]
 */
export async function effectiveSubscription(db, userId, now = new Date()) {
  const { rows } = await db.query(LIVE_SUBSCRIPTION_SQL, [userId]);
  return resolveSubscription(rows[0], now);
}

/** Rials to whole tomans (prices are shown and charged in whole tomans). */
export const rialToToman = (rial) => Math.floor(Number(rial) / 10);

/**
 * Active plans with their current price (null while an admin has not set one) and quotas.
 * @param {{query: Function}} db
 */
export async function listPlans(db) {
  const plans = await db.query(
    `select p.key, p.tier, p.name_fa, p.name_en, p.duration_days, p.sort,
            pp.id as price_id, pp.amount_rial::text as amount_rial
     from plans p left join plan_prices pp on pp.plan_key = p.key and pp.is_active
     where p.is_active
     order by p.sort, p.key`,
  );
  const quotas = await db.query("select plan_key, quota_key, monthly_limit from ai_quota_configs");
  const byPlan = new Map();
  for (const q of quotas.rows) {
    if (!byPlan.has(q.plan_key)) byPlan.set(q.plan_key, {});
    byPlan.get(q.plan_key)[q.quota_key] = Number(q.monthly_limit);
  }
  const list = plans.rows.map((row) => ({
    key: row.key,
    tier: row.tier,
    nameFa: row.name_fa,
    nameEn: row.name_en,
    durationDays: toNumber(row.duration_days),
    price: row.amount_rial === null ? null : { amountRial: Number(row.amount_rial), amountToman: rialToToman(row.amount_rial) },
    quotas: Object.fromEntries(QUOTA_KEYS.map((key) => [key, byPlan.get(row.key)?.[key] ?? null])),
  }));
  return { plans: list, quarterlySavingsPercent: quarterlySavings(list) };
}

/** How much cheaper quarterly is than three monthly payments, from real prices only. */
export function quarterlySavings(plans) {
  const monthly = plans.find((p) => p.key === "premium_monthly")?.price?.amountRial;
  const quarterly = plans.find((p) => p.key === "premium_quarterly")?.price?.amountRial;
  if (!monthly || !quarterly) return null;
  const percent = Math.round((1 - quarterly / (3 * monthly)) * 100);
  return percent > 0 ? percent : null;
}

/** One plan with its active price row, or null. @param {{query: Function}} db @param {string} planKey */
export async function planWithPrice(db, planKey) {
  const { rows } = await db.query(
    `select p.key, p.tier, p.duration_days, p.is_active, pp.id as price_id, pp.amount_rial::text as amount_rial
     from plans p left join plan_prices pp on pp.plan_key = p.key and pp.is_active
     where p.key = $1`,
    [planKey],
  );
  return rows[0] ?? null;
}

/**
 * This Tehran month's quota usage for the user's effective plan.
 * @param {{query: Function}} db @param {string} userId @param {string} planKey @param {Date} [now]
 */
export async function quotaUsage(db, userId, planKey, now = new Date()) {
  const period = tehranMonthKey(now);
  const limits = await db.query("select quota_key, monthly_limit from ai_quota_configs where plan_key = $1", [planKey]);
  const used = await db.query(
    "select quota_key, used from ai_usage_counters where user_id = $1 and period = $2",
    [userId, period],
  );
  const limitOf = new Map(limits.rows.map((r) => [r.quota_key, Number(r.monthly_limit)]));
  const usedOf = new Map(used.rows.map((r) => [r.quota_key, Number(r.used)]));
  return {
    period,
    resetsAt: tehranMonthBounds(now).end.toISOString(),
    quotas: QUOTA_KEYS.map((key) => {
      const limit = limitOf.has(key) ? limitOf.get(key) : null;
      const u = usedOf.get(key) ?? 0;
      return { key, limit, used: u, remaining: limit === null ? null : Math.max(0, limit - u) };
    }),
  };
}

/**
 * Whether a checkout could reach a payment provider. Bale needs both tokens and a
 * provider whose createCheckout the process actually wired (server.js).
 * @param {Record<string, any>} config @param {unknown} [provider]
 * @returns {{available: boolean, reason: null|"bale_not_configured"|"provider_not_wired"}}
 */
export function checkoutStatus(config, provider) {
  if (!featureStatus(config ?? {}).bale) return { available: false, reason: "bale_not_configured" };
  if (!provider || typeof provider.createCheckout !== "function") return { available: false, reason: "provider_not_wired" };
  return { available: true, reason: null };
}

/**
 * Price a plan with a discount code without redeeming it (redemption waits for a verified
 * payment). Returns null when the code does not apply.
 * @param {{query: Function}} db
 * @param {{userId: string, amountRial: number, planKey: string, code: string, now?: Date}} input
 */
export async function quoteDiscount(db, { userId, amountRial, planKey, code, now = new Date() }) {
  const { rows } = await db.query(
    `select d.id, d.percent_off, d.amount_off_rial::text as amount_off_rial, d.plan_key, d.max_redemptions,
            d.per_user_limit, d.valid_from, d.valid_until, d.is_active,
            (select count(*)::int from discount_redemptions r where r.discount_code_id = d.id) as total_used,
            (select count(*)::int from discount_redemptions r where r.discount_code_id = d.id and r.user_id = $2) as user_used
     from discount_codes d where d.code = $1`,
    [code, userId],
  );
  const d = rows[0];
  const t = now.getTime();
  if (!d || !d.is_active) return null;
  if (d.plan_key && d.plan_key !== planKey) return null;
  if (d.valid_from && new Date(d.valid_from).getTime() > t) return null;
  if (d.valid_until && new Date(d.valid_until).getTime() <= t) return null;
  if (d.max_redemptions !== null && d.total_used >= d.max_redemptions) return null;
  if (d.user_used >= d.per_user_limit) return null;
  const originalToman = rialToToman(amountRial);
  const discountToman = d.percent_off !== null
    ? Math.floor((originalToman * Number(d.percent_off)) / 100)
    : Math.min(originalToman, rialToToman(d.amount_off_rial));
  return { code, originalToman, discountToman, finalToman: originalToman - discountToman };
}
