import express from "express";
import { createAuthContext } from "./auth/context.js";
import { errorHandler, notFoundHandler } from "./core/errors.js";
import { accountRoutes } from "./routes/account.js";
import { authRoutes } from "./routes/auth.js";
import { meRoutes } from "./routes/me.js";
import { onboardingRoutes } from "./routes/onboarding.js";

/**
 * API router (kept thin: route handlers live in server/routes/*). Unknown /api
 * paths return the uniform error shape; every other path falls through to the SPA.
 * @param {import("./db.js").Database} db
 * @param {{config?: Record<string, any>, sms?: {sendVerify: Function}, now?: () => Date, logger?: any}} [options]
 *   config is the validated environment (validateEnv().config); the rest is for tests.
 */
export function createApi(db, options = {}) {
  const router = express.Router();
  const auth = createAuthContext(db, options);

  router.use(express.json({ limit: "1mb" }));

  router.get("/api/health", (_req, res) => {
    res.json({ ok: true, time: new Date().toISOString() });
  });

  router.use("/api/auth", authRoutes(auth));
  router.use("/api/account", accountRoutes(auth));
  router.use("/api", meRoutes(auth));
  router.use("/api", onboardingRoutes(auth));

  router.use("/api", notFoundHandler);
  router.use(errorHandler());

  return router;
}
