import { SYSTEM_SETTINGS } from "../db/seeds/system-settings.js";

/**
 * @typedef {{query: (sql: string, params?: unknown[]) => Promise<{rows: any[]}>,
 *            transaction?: <T>(fn: (tx: any) => Promise<T>) => Promise<T>}} SeedDb
 */

/**
 * Seed reference/config data only (never learner-facing questions, spec 2.2).
 * Idempotent: every row is inserted only if its key is missing, so running it
 * again changes nothing and never overwrites an admin's edit. All-or-nothing.
 * `env` is accepted for the later seeds that read ids from the environment
 * (SMS templates); nothing in it is used yet.
 * @param {SeedDb} db
 * @param {{env?: Record<string, string|undefined>}} [options]
 * @returns {Promise<{systemSettings: number}>} rows inserted by this run
 */
export async function runSeed(db, { env = process.env } = {}) {
  void env;
  const work = async (tx) => {
    let inserted = 0;
    for (const { key, value } of SYSTEM_SETTINGS) {
      const result = await tx.query(
        `insert into system_settings (key, value) values ($1, $2::jsonb)
         on conflict (key) do nothing returning key`,
        [key, JSON.stringify(value)],
      );
      inserted += result.rows.length;
    }
    return { systemSettings: inserted };
  };
  return typeof db.transaction === "function" ? db.transaction(work) : work(db);
}
