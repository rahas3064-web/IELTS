import express from "express";
import { errorHandler, notFoundHandler } from "./core/errors.js";

/**
 * API router. Phase 0 exposes only the health check; OTP auth (Phase 1) and the
 * rest are added against the new schema. Unknown /api paths return the uniform
 * error shape; every other path falls through to the SPA.
 * @param {{query: Function}} _db database handle for the routes added later
 */
export function createApi(_db) {
  const router = express.Router();

  router.use(express.json({ limit: "1mb" }));

  router.get("/api/health", (_req, res) => {
    res.json({ ok: true, time: new Date().toISOString() });
  });

  router.use("/api", notFoundHandler);
  router.use(errorHandler());

  return router;
}
