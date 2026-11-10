import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertEnv, validateEnv } from "./server/core/env.js";

const root = path.dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === "production";

// Production fails fast on a missing or weak variable (names only, never values);
// development prints the problems and keeps going.
let config;
if (isProd) {
  config = assertEnv(process.env);
} else {
  const checked = validateEnv(process.env);
  for (const problem of checked.errors) console.warn(`[env] warning: ${problem}`);
  config = checked.config;
}
const port = config.PORT;
const host = "localhost";

const { openDb } = await import("./server/db.js");
const { applyMigrations } = await import("./server/migrate.js");
const { createApi } = await import("./server/api.js");

// A fresh or stale schema is migrated at boot; any failure aborts the start.
const db = await openDb({ databaseUrl: process.env.DATABASE_URL, env: process.env });
try {
  const { applied, versions } = await applyMigrations(db, path.join(root, "db", "migrations"));
  console.info(`database ready (schema ${versions.at(-1) ?? "empty"}${applied.length ? `, applied ${applied.length}` : ""})`);
} catch (error) {
  await db.close().catch(() => {});
  throw error;
}

if (!isProd) {
  for (const name of ["SESSION_SECRET", "OTP_PEPPER"]) {
    if (!config[name]) console.warn(`[env] ${name} is not set: using a random per-process value (sessions reset on restart)`);
  }
}

const app = express();
app.disable("x-powered-by");
if (isProd) app.set("trust proxy", 1);
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), geolocation=(), payment=()");
  if (isProd) {
    res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
    );
  }
  next();
});

app.use(createApi(db, { config }));

if (isProd) {
  const dist = path.join(root, "dist");
  app.use(express.static(dist));
  app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      next();
      return;
    }
    res.sendFile(path.join(dist, "index.html"), (error) => {
      if (error) next(error);
    });
  });
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({
    root,
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
}

const server = app.listen(port, host, () => {
  console.log(`Bandora listening on http://localhost:${port}`);
});

let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  server.close();
  await db.close().catch(() => {});
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
