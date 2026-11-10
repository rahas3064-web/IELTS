/* global console, process */
import { assertSafeCliTarget } from "./cli-guard.js";
import { openDb } from "./db.js";
import { loadDotEnv } from "./env-file.js";

/**
 * Shared shell for the db CLIs: load .env, open the database (DATABASE_URL, else
 * PGlite in PGLITE_DIR or data/pglite), run, always close, exit non-zero with a
 * one-line message on failure. Messages never include the connection URL.
 * @param {string} name used as the log prefix
 * @param {(db: import("./db.js").Database, env: NodeJS.ProcessEnv) => Promise<void>} main
 */
export async function runCli(name, main) {
  let db = null;
  try {
    loadDotEnv();
    assertSafeCliTarget(process.env.DATABASE_URL, process.env);
    db = await openDb({ databaseUrl: process.env.DATABASE_URL, env: process.env });
    await main(db, process.env);
  } catch (error) {
    const missingTable = error && typeof error === "object" && error.code === "42P01";
    const message = missingTable
      ? "database schema is missing; run `npm run db:migrate` first"
      : error instanceof Error ? error.message : "unknown error";
    console.error(`[${name}] failed: ${message}`);
    process.exitCode = 1;
  } finally {
    if (db) await db.close().catch(() => {});
  }
}
