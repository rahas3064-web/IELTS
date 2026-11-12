// Turns a server-verified Bale charge into one subscription period.
// A second delivery of the same charge is a no-op. Two charges for one user
// extend the live row instead of inserting a second active subscription.
const DAY_MS = 24 * 60 * 60 * 1000;
const GRANTABLE = new Set(["created", "pending", "pre_checkout_ok", "paid_unverified"]);

/**
 * @param {unknown} error
 */
function isActiveSubscriptionRace(error) {
  const text = `${error?.constraint ?? ""} ${error?.message ?? ""}`;
  return text.includes("subscriptions_one_active_per_user");
}

/**
 * @param {{query: Function, transaction: Function}} db
 * @param {{attemptId: string, providerRef: string, amountRial: number, raw: unknown, now: Date}} input
 * @returns {Promise<{ok: boolean, already?: boolean, reason?: string, endsAt?: string, planKey?: string}>}
 */
export async function activateVerifiedPayment(db, input) {
  try {
    return await grant(db, input);
  } catch (error) {
    if (!isActiveSubscriptionRace(error)) throw error;
    return grant(db, input);
  }
}

/**
 * @param {{query: Function, transaction: Function}} db
 * @param {{attemptId: string, providerRef: string, amountRial: number, raw: unknown, now: Date}} input
 */
async function grant(db, { attemptId, providerRef, amountRial, raw, now }) {
  return db.transaction(async (tx) => {
    const attempt = (await tx.query(
      `select id, user_id, amount_rial::text as amount_rial, status, plan_price_id
       from payment_attempts where id = $1 for update`,
      [attemptId],
    )).rows[0];
    if (!attempt) return { ok: false, reason: "missing" };
    if (attempt.status === "verified" || attempt.status === "refunded") return { ok: true, already: true };
    if (!GRANTABLE.has(attempt.status) || !attempt.user_id || !providerRef) {
      return { ok: false, reason: "status" };
    }
    if (Number(attempt.amount_rial) !== amountRial) return { ok: false, reason: "amount" };

    const plan = (await tx.query(
      `select p.key, p.duration_days
       from plan_prices pp join plans p on p.key = pp.plan_key
       where pp.id = $1`,
      [attempt.plan_price_id],
    )).rows[0];
    if (!plan?.duration_days) return { ok: false, reason: "plan" };

    const locked = await tx.query(
      `update payment_attempts
       set status = 'verified', provider_ref = $2, verified_at = $3, raw = $4::jsonb
       where id = $1 and status = $5
       returning id`,
      [attemptId, providerRef, now, JSON.stringify(raw ?? {}), attempt.status],
    );
    if (!locked.rows[0]) return { ok: true, already: true };

    const live = (await tx.query(
      `select id, plan_key, ends_at from subscriptions
       where user_id = $1 and status in ('active', 'grace')
       for update`,
      [attempt.user_id],
    )).rows[0];
    const endsAt = await writeSubscription(tx, {
      live, userId: attempt.user_id, planKey: plan.key, planPriceId: attempt.plan_price_id,
      durationDays: plan.duration_days, now, attemptId,
    });
    const periodStart = live && new Date(live.ends_at) > now ? new Date(live.ends_at) : now;
    await tx.query(
      `insert into invoices (user_id, payment_attempt_id, number, amount_rial, discount_rial, plan_key, period_start, period_end)
       values ($1, $2, $3, $4, 0, $5, $6, $7)`,
      [attempt.user_id, attemptId, `BD-${attemptId.replace(/-/g, "")}`, amountRial, plan.key, periodStart, endsAt],
    );
    return { ok: true, endsAt: endsAt.toISOString(), planKey: plan.key };
  });
}

/**
 * @param {{query: Function}} tx
 * @param {{live?: {id: string, plan_key: string, ends_at: string}, userId: string, planKey: string,
 *          planPriceId: string, durationDays: number, now: Date, attemptId: string}} input
 * @returns {Promise<Date>}
 */
async function writeSubscription(tx, { live, userId, planKey, planPriceId, durationDays, now, attemptId }) {
  const liveEnds = live ? new Date(live.ends_at) : null;
  const periodStart = liveEnds && liveEnds > now ? liveEnds : now;
  const endsAt = new Date(periodStart.getTime() + durationDays * DAY_MS);
  if (live) {
    await tx.query(
      `update subscriptions
       set plan_key = $2, plan_price_id = $3, status = 'active', ends_at = $4, grace_ends_at = null
       where id = $1`,
      [live.id, planKey, planPriceId, endsAt],
    );
    await tx.query(
      `insert into subscription_events (subscription_id, event_type, old_ends_at, new_ends_at, payment_attempt_id)
       values ($1, $2, $3, $4, $5)`,
      [live.id, live.plan_key === planKey ? "extended" : "upgraded", live.ends_at, endsAt, attemptId],
    );
    return endsAt;
  }
  const created = await tx.query(
    `insert into subscriptions (user_id, plan_key, plan_price_id, status, source, started_at, ends_at)
     values ($1, $2, $3, 'active', 'payment', $4, $5)
     returning id`,
    [userId, planKey, planPriceId, now, endsAt],
  );
  await tx.query(
    `insert into subscription_events (subscription_id, event_type, new_ends_at, payment_attempt_id)
     values ($1, 'created', $2, $3)`,
    [created.rows[0].id, endsAt, attemptId],
  );
  return endsAt;
}
