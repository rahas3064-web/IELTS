// Billing API (spec S11): plan catalogue, current plan + monthly usage, discount quote and
// checkout. Checkout only stores a pending attempt and returns the Bale bot link.
// Premium is granted later, after inquireTransaction says the charge was paid.
import express from "express";
import { enforceLimit } from "../auth/limits.js";
import { ApiError } from "../core/errors.js";
import { parseBody, v } from "../core/validate.js";
import {
  checkoutStatus, effectiveSubscription, listPlans, planWithPrice, quotaUsage, quoteDiscount,
} from "../services/billing.js";
import { wrap } from "./util.js";

const PLAN_KEY = /^[a-z][a-z0-9_]*$/;
const checkoutSchema = v.object({ planKey: v.string({ min: 1, max: 64, pattern: PLAN_KEY }) });
const discountSchema = v.object({
  planKey: v.string({ min: 1, max: 64, pattern: PLAN_KEY }),
  code: v.string({ min: 3, max: 32, transform: (s) => s.toUpperCase(), pattern: /^[A-Z0-9_-]{3,32}$/ }),
});

/** A purchasable plan with an active price, or the matching ApiError. */
async function purchasablePlan(db, planKey) {
  const plan = await planWithPrice(db, planKey);
  if (!plan || !plan.is_active || plan.tier !== "premium") throw new ApiError(404, "not_found");
  if (plan.amount_rial === null) throw new ApiError(409, "price_not_set", { details: { planKey } });
  return plan;
}

/**
 * @param {ReturnType<import("../auth/context.js").createAuthContext>} ctx
 * @param {{config?: Record<string, any>, paymentProvider?: {createCheckout: Function}}} [options]
 */
export function billingRoutes(ctx, { config = {}, paymentProvider } = {}) {
  const router = express.Router();
  const auth = ctx.requireUser();
  const { db } = ctx;

  router.get(
    "/plans",
    auth,
    wrap(async (_req, res) => {
      res.json(await listPlans(db));
    }),
  );

  router.get(
    "/",
    auth,
    wrap(async (req, res) => {
      const now = ctx.now();
      const subscription = await effectiveSubscription(db, req.user.id, now);
      const usage = await quotaUsage(db, req.user.id, subscription.plan, now);
      res.json({ subscription, usage, checkout: checkoutStatus(config, paymentProvider) });
    }),
  );

  router.post(
    "/discount",
    ctx.originGuard,
    auth,
    wrap(async (req, res) => {
      const { planKey, code } = parseBody(discountSchema, req.body);
      const plan = await purchasablePlan(db, planKey);
      const quote = await quoteDiscount(db, {
        userId: req.user.id, amountRial: Number(plan.amount_rial), planKey, code, now: ctx.now(),
      });
      if (!quote) throw new ApiError(400, "discount_invalid", { details: { field: "code" } });
      res.json({ planKey, ...quote, redeemed: false });
    }),
  );

  router.post(
    "/checkout",
    ctx.originGuard,
    auth,
    wrap(async (req, res) => {
      const { planKey } = parseBody(checkoutSchema, req.body);
      const plan = await purchasablePlan(db, planKey);
      const status = checkoutStatus(config, paymentProvider);
      if (!status.available) throw new ApiError(503, "payment_unavailable", { details: { reason: status.reason } });
      await enforceLimit(db, `checkout:${req.user.id}`, 8, 600);
      const started = await paymentProvider.createCheckout({
        userId: req.user.id, planKey, planPriceId: plan.price_id, amountRial: Number(plan.amount_rial),
      });
      if (typeof started?.url !== "string" || !started.url.startsWith("https://")) {
        throw new ApiError(503, "payment_unavailable", { details: { reason: "bad_checkout_url" } });
      }
      res.status(201).json(started);
    }),
  );

  return router;
}
