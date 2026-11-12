import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { createAuthContext } from "./auth/context.js";
import { errorHandler, notFoundHandler } from "./core/errors.js";
import { adminAuthRoutes, adminGuardRoutes } from "./routes/admin-auth.js";
import { assistantRoutes } from "./routes/assistant.js";
import { adminContentRoutes, learnerContentRoutes, mediaRoutes } from "./routes/admin-content.js";
import { accountRoutes } from "./routes/account.js";
import { authRoutes } from "./routes/auth.js";
import { billingRoutes } from "./routes/billing.js";
import { frameRoutes } from "./routes/frame.js";
import { meRoutes } from "./routes/me.js";
import { mockRoutes } from "./routes/mocks.js";
import { notificationRoutes } from "./routes/notifications.js";
import { onboardingRoutes } from "./routes/onboarding.js";
import { placementRoutes } from "./routes/placement.js";
import { practiceRoutes } from "./routes/practice.js";

/**
 * API router (kept thin: route handlers live in server/routes/*). Unknown /api
 * paths return the uniform error shape; every other path falls through to the SPA.
 * @param {import("./db.js").Database} db
 * @param {{config?: Record<string, any>, sms?: {sendVerify: Function}, now?: () => Date, logger?: any,
 *          paymentProvider?: {createCheckout: Function}, assistant?: {reply?: Function, env?: Record<string, any>}, mocks?: {score?: Function}}} [options]
 *   config is the validated environment (validateEnv().config); the rest is for tests.
 *   Checkout refuses with payment_unavailable until options.paymentProvider is set.
 */
export function createApi(db, options = {}) {
  const router = express.Router();
  const auth = createAuthContext(db, options);

  router.use(express.json({ limit: "1mb" }));

  router.get("/api/health", (_req, res) => {
    res.json({ ok: true, time: new Date().toISOString() });
  });

  router.use("/api/auth", authRoutes(auth));
  router.use("/api/admin/auth", adminAuthRoutes(auth));
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  router.use("/api/admin", adminContentRoutes(auth, {
    mediaDir: options.mediaDir ?? path.join(root, "data", "content-media"),
  }));
  router.use("/api/admin", adminGuardRoutes(auth));
  router.use("/api", learnerContentRoutes(auth));
  router.use("/api", mediaRoutes(auth, { mediaDir: options.mediaDir ?? path.join(root, "data", "content-media") }));
  router.use("/api", placementRoutes(auth));
  router.use("/api", practiceRoutes(auth));
  router.use("/api", mockRoutes(auth, options.mocks));
  router.use("/api/account", accountRoutes(auth));
  router.use("/api", meRoutes(auth));
  router.use("/api", onboardingRoutes(auth));
  router.use("/api", frameRoutes(auth));
  router.use("/api", notificationRoutes(auth));
  router.use("/api/assistant", assistantRoutes(auth, options.assistant));
  router.use("/api/billing", billingRoutes(auth, { config: options.config, paymentProvider: options.paymentProvider }));

  router.use("/api", notFoundHandler);
  router.use(errorHandler());

  return router;
}
