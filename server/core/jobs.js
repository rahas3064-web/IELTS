/* global console */
import cron from "node-cron";

// Job runner (spec 4.2). In-process scheduler (node-cron) + Postgres advisory
// lock so that only one instance executes a job at a time; every run is logged
// in job_runs. Handlers must be idempotent. No handlers are registered here.
//
// Lock design notes:
//  - Advisory locks are session-level, so lock and unlock must hit the SAME
//    connection. When `db.connect()` exists (pg.Pool, or the PGlite pool shim in
//    server.js) a dedicated client is held for the run; otherwise `db.query` is
//    used directly (single-connection databases).
//  - PGlite supports pg_try_advisory_lock/pg_advisory_unlock, but it has ONE
//    session, and Postgres advisory locks are re-entrant inside a session, so a
//    second concurrent acquire succeeds. An in-process `running` guard therefore
//    covers same-process contention (always, and the only protection under
//    PGlite); the advisory lock covers cross-instance contention in production.

export const JOB_RUNS_DDL = `create table if not exists job_runs (
  id uuid primary key default gen_random_uuid(),
  job text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null check (status in ('running','ok','failed','skipped')),
  stats jsonb,
  error text
)`;

export const DEFAULT_JOB_TIMEZONE = "Asia/Tehran";

/** Spec 4.2 schedule table (Tehran time). */
export const JOB_SCHEDULES = Object.freeze({
  "weekly-plan-build": { schedule: "0 4 * * 6", description: "Saturday 04:00 - build the new week's plan for active learners (S5)" },
  "study-reminders": { schedule: "*/15 8-21 * * *", description: "Every 15 min, 08:00-21:45 - SMS study reminders (S2)" },
  "renewal-reminders": { schedule: "0 10 * * *", description: "Daily 10:00 - SMS + in-app reminder 3 days before subscription end (S11)" },
  "subscription-expiry": { schedule: "0 * * * *", description: "Hourly - grace start/end and downgrade (S11)" },
  "payment-reconcile": { schedule: "*/5 * * * *", description: "Every 5 min - re-verify pending Bale payments (S11)" },
  "account-purge": { schedule: "0 3 * * *", description: "Daily 03:00 - purge accounts 14 days after deletion request (S10)" },
  "otp-cleanup": { schedule: "0 * * * *", description: "Hourly - delete expired OTP rows/locks" },
});

const MAX_ERROR_LENGTH = 2000;
const LOCK_NAMESPACE = "bandora:job:";

/**
 * @typedef {{query: (sql: string, params?: unknown[]) => Promise<{rows: any[]}>, connect?: () => Promise<any>}} Db
 * @typedef {{status: 'ok'|'failed'|'skipped', skipped?: true, stats?: object, error?: string}} RunResult
 */

/** @param {unknown} err */
function errorMessage(err) {
  const text = err instanceof Error ? err.message : String(err);
  return text.slice(0, MAX_ERROR_LENGTH);
}

/**
 * @param {Db} db
 * @param {{now?: () => Date, logger?: Pick<Console, 'info'|'warn'|'error'>}} [options]
 */
export function createJobRunner({ db, now = () => new Date(), logger = console } = /** @type {any} */ ({})) {
  /** @type {Map<string, {schedule: string, handler: Function, timezone: string}>} */
  const jobs = new Map();
  const running = new Set();
  /** @type {any[]} */
  let tasks = [];

  /** Best-effort bookkeeping: a logging failure must never mask the real outcome. */
  async function safely(label, fn) {
    try {
      return await fn();
    } catch (err) {
      logger.error(`[jobs] ${label} failed: ${errorMessage(err)}`);
      return undefined;
    }
  }

  async function insertRun(name, status, finished) {
    const { rows } = await db.query(
      "insert into job_runs (job, started_at, finished_at, status) values ($1, $2, $3, $4) returning id",
      [name, now(), finished ? now() : null, status],
    );
    return rows[0].id;
  }

  async function finishRun(id, status, stats, error) {
    await db.query(
      "update job_runs set finished_at = $2, status = $3, stats = $4::jsonb, error = $5 where id = $1",
      [id, now(), status, JSON.stringify(stats ?? {}), error ?? null],
    );
  }

  const skipped = () => ({ skipped: true, status: "skipped" });

  /** @returns {Promise<RunResult>} never throws */
  async function runJob(name) {
    const job = jobs.get(name);
    if (!job) return { status: "failed", error: `Unknown job: ${name}` };

    if (running.has(name)) {
      await safely("record skipped run", () => insertRun(name, "skipped", true));
      return skipped();
    }
    running.add(name);

    let conn = null;
    let locked = false;
    let runId;
    try {
      conn = typeof db.connect === "function" ? await db.connect() : null;
      const lockDb = conn ?? db;
      const lock = await lockDb.query("select pg_try_advisory_lock(hashtext($1)) as locked", [`${LOCK_NAMESPACE}${name}`]);
      locked = lock.rows[0]?.locked === true;
      if (!locked) {
        await safely("record skipped run", () => insertRun(name, "skipped", true));
        return skipped();
      }

      runId = await insertRun(name, "running", false);
      const output = await job.handler({ db, now });
      const stats = output && typeof output === "object" ? output : {};
      await finishRun(runId, "ok", stats, null);
      return { status: "ok", stats };
    } catch (err) {
      const error = errorMessage(err);
      logger.error(`[jobs] ${name} failed: ${error}`);
      if (runId !== undefined) await safely("record failed run", () => finishRun(runId, "failed", {}, error));
      return { status: "failed", error };
    } finally {
      if (locked) {
        await safely("advisory unlock", () =>
          (conn ?? db).query("select pg_advisory_unlock(hashtext($1)) as unlocked", [`${LOCK_NAMESPACE}${name}`]));
      }
      if (conn && typeof conn.release === "function") conn.release();
      running.delete(name);
    }
  }

  function register(name, { schedule, handler, timezone = DEFAULT_JOB_TIMEZONE } = /** @type {any} */ ({})) {
    if (typeof name !== "string" || name === "") throw new TypeError("Job name must be a non-empty string");
    if (typeof handler !== "function") throw new TypeError(`Job ${name}: handler must be a function`);
    const expression = schedule ?? JOB_SCHEDULES[name]?.schedule;
    if (typeof expression !== "string") throw new TypeError(`Job ${name}: schedule is required`);
    if (jobs.has(name)) throw new Error(`Job already registered: ${name}`);
    jobs.set(name, { schedule: expression, handler, timezone });
  }

  function start() {
    if (tasks.length > 0) return;
    const invalid = [...jobs].filter(([, job]) => !cron.validate(job.schedule)).map(([name]) => name);
    if (invalid.length > 0) {
      throw new RangeError(`Invalid cron expression for job(s): ${invalid.join(", ")}`);
    }
    tasks = [...jobs].map(([name, job]) =>
      cron.schedule(job.schedule, () => runJob(name), { timezone: job.timezone }));
  }

  function stop() {
    for (const task of tasks) {
      task.stop();
      if (typeof task.destroy === "function") task.destroy();
    }
    tasks = [];
  }

  function list() {
    return [...jobs].map(([name, job]) => ({
      name,
      schedule: job.schedule,
      timezone: job.timezone,
      running: running.has(name),
    }));
  }

  return { register, runJob, start, stop, list };
}
