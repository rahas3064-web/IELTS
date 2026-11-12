// Monthly AI quota accounting (spec S10): reserve -> commit | release on ai_usage_counters /
// ai_usage_events (007). A reserved unit counts against the quota straight away, so two
// concurrent calls can never both take the last unit; a failed AI call releases it again.
// The limit comes from ai_quota_configs for the user's effective plan (009: free 10 and
// premium 150 assistant messages per Tehran calendar month).
import { ApiError } from "../core/errors.js";
import { tehranMonthBounds, tehranMonthKey } from "../core/tehran-time.js";

/**
 * The plan's monthly limit for one quota key. A plan without a configured limit gets 0:
 * nothing is granted that admin has not configured.
 * @param {{query: Function}} db @param {string} planKey @param {string} quotaKey
 */
export async function monthlyLimit(db, planKey, quotaKey) {
  const { rows } = await db.query(
    "select monthly_limit from ai_quota_configs where plan_key = $1 and quota_key = $2",
    [planKey, quotaKey],
  );
  return rows[0] ? Number(rows[0].monthly_limit) : 0;
}

/**
 * Used / limit / remaining for one quota key this Tehran month.
 * @param {{query: Function}} db
 * @param {{userId: string, planKey: string, quotaKey: string, now: Date}} input
 */
export async function quotaStatus(db, { userId, planKey, quotaKey, now }) {
  const period = tehranMonthKey(now);
  const limit = await monthlyLimit(db, planKey, quotaKey);
  const { rows } = await db.query(
    "select used from ai_usage_counters where user_id = $1 and quota_key = $2 and period = $3",
    [userId, quotaKey, period],
  );
  const used = rows[0] ? Number(rows[0].used) : 0;
  return { quotaKey, period, limit, used, remaining: Math.max(0, limit - used), resetsAt: tehranMonthBounds(now).end.toISOString() };
}

/**
 * Take one unit of `quotaKey` for an AI call, or throw 402 quota_exhausted.
 * @param {{transaction: Function}} db
 * @param {{userId: string, planKey: string, quotaKey: string, operation: string, now: Date}} input
 * @returns {Promise<{eventId: string, quotaKey: string, period: string, limit: number, used: number, remaining: number, resetsAt: string}>}
 */
export async function reserveQuota(db, { userId, planKey, quotaKey, operation, now }) {
  const period = tehranMonthKey(now);
  const resetsAt = tehranMonthBounds(now).end.toISOString();
  return db.transaction(async (tx) => {
    const limit = await monthlyLimit(tx, planKey, quotaKey);
    await tx.query(
      `insert into ai_usage_counters (user_id, quota_key, period) values ($1, $2, $3)
       on conflict (user_id, quota_key, period) do nothing`,
      [userId, quotaKey, period],
    );
    const { rows } = await tx.query(
      `select id, used from ai_usage_counters where user_id = $1 and quota_key = $2 and period = $3 for update`,
      [userId, quotaKey, period],
    );
    const used = Number(rows[0].used);
    if (used >= limit) {
      throw new ApiError(402, "quota_exhausted", {
        details: { quotaKey, limit, used, remaining: 0, period, resetsAt, upgrade: "/app/subscription" },
      });
    }
    await tx.query("update ai_usage_counters set used = used + 1 where id = $1", [rows[0].id]);
    const event = await tx.query(
      `insert into ai_usage_events (user_id, operation, quota_key, period, status)
       values ($1, $2, $3, $4, 'reserved') returning id`,
      [userId, operation, quotaKey, period],
    );
    return { eventId: event.rows[0].id, quotaKey, period, limit, used: used + 1, remaining: Math.max(0, limit - used - 1), resetsAt };
  });
}

/**
 * The AI call succeeded: the reserved unit stays used, with its token counts.
 * @param {{query: Function}} db @param {string} eventId
 * @param {{tokensIn?: number, tokensOut?: number, model?: string|null, promptVersion?: string|null, ref?: string|null, now: Date}} info
 */
export async function commitQuota(db, eventId, { tokensIn = 0, tokensOut = 0, model = null, promptVersion = null, ref = null, now }) {
  await db.query(
    `update ai_usage_events
     set status = 'committed', settled_at = $2, tokens_in = $3, tokens_out = $4, model = $5, prompt_version = $6, ref = $7
     where id = $1 and status = 'reserved'`,
    [eventId, now, Math.max(0, Math.round(tokensIn) || 0), Math.max(0, Math.round(tokensOut) || 0), model, promptVersion, ref],
  );
}

/**
 * The AI call failed: give the unit back. Safe to call twice.
 * @param {{transaction: Function}} db @param {string} eventId @param {Date} now
 */
export async function releaseQuota(db, eventId, now) {
  await db.transaction(async (tx) => {
    const { rows } = await tx.query(
      `update ai_usage_events set status = 'released', settled_at = $2
       where id = $1 and status = 'reserved' returning user_id, quota_key, period`,
      [eventId, now],
    );
    const event = rows[0];
    if (!event) return;
    await tx.query(
      `update ai_usage_counters set used = greatest(used - 1, 0)
       where user_id = $1 and quota_key = $2 and period = $3`,
      [event.user_id, event.quota_key, event.period],
    );
  });
}
