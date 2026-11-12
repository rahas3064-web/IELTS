// Plan entitlements (feature_entitlements, 012): what a free or premium learner may open.
// Missing rows fall back by tier so a new plan never opens more than its tier implies.
import { effectiveSubscription } from "./billing.js";

/**
 * @param {{query: Function}} db @param {string} planKey @param {string} featureKey
 * @returns {Promise<{enabled: boolean, limit: number|null}|null>}
 */
export async function entitlement(db, planKey, featureKey) {
  const { rows } = await db.query(
    "select enabled, limit_value from feature_entitlements where plan_key = $1 and feature_key = $2",
    [planKey, featureKey],
  );
  if (!rows[0]) return null;
  return { enabled: rows[0].enabled, limit: rows[0].limit_value == null ? null : Number(rows[0].limit_value) };
}

/**
 * The learner's plan and practice access. `maxPart` null = every part.
 * @param {{query: Function}} db @param {string} userId @param {Date} now
 */
export async function practiceAccess(db, userId, now) {
  const subscription = await effectiveSubscription(db, userId, now);
  const row = await entitlement(db, subscription.plan, "practice_parts");
  const fallback = subscription.tier === "premium" ? null : 1;
  const maxPart = row ? (row.enabled ? row.limit : 0) : fallback;
  return { subscription, premium: subscription.tier === "premium", maxPart };
}

/**
 * Whether a practice set is open under `maxPart`. Exam parts and part-numbered drills go by
 * part number; a drill without a part number is open on a capped plan only when admin marked
 * it free.
 * @param {{part_no: number|null, is_free: boolean}} set @param {number|null} maxPart
 */
export function setIsOpen(set, maxPart) {
  if (maxPart == null) return true;
  if (set.part_no != null) return Number(set.part_no) <= maxPart;
  return Boolean(set.is_free) && maxPart > 0;
}
