import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import cron from "node-cron";
import { JOB_RUNS_DDL, JOB_SCHEDULES, createJobRunner } from "./jobs.js";

const silent = { info: () => {}, warn: () => {}, error: () => {} };
const FIXED_NOW = new Date("2026-11-10T12:00:00Z");

function adapter(pg) {
  return { async query(sql, params) { return pg.query(sql, params); } };
}

/**
 * Fake pool emulating Postgres session-level advisory locks shared across
 * "instances": locks are keyed by name and owned by a dedicated client.
 */
function fakeLockPool(inner, locks) {
  const events = [];
  return {
    events,
    query: (sql, params) => inner.query(sql, params),
    async connect() {
      const id = Symbol("client");
      return {
        async query(sql, params) {
          if (sql.includes("pg_try_advisory_lock")) {
            const free = !locks.has(params[0]);
            if (free) locks.set(params[0], id);
            events.push(free ? "lock" : "lock-denied");
            return { rows: [{ locked: free }] };
          }
          if (sql.includes("pg_advisory_unlock")) {
            const mine = locks.get(params[0]) === id;
            if (mine) locks.delete(params[0]);
            events.push(mine ? "unlock" : "unlock-foreign");
            return { rows: [{ unlocked: mine }] };
          }
          return inner.query(sql, params);
        },
        release() { events.push("release"); },
      };
    },
  };
}

describe("jobs", () => {
  let pg;
  let db;

  beforeAll(async () => {
    pg = new PGlite();
    db = adapter(pg);
    await db.query(JOB_RUNS_DDL);
  });

  afterAll(async () => {
    await pg.close();
  });

  beforeEach(async () => {
    await db.query("truncate job_runs");
  });

  const runs = async () => (await db.query("select * from job_runs order by started_at, id")).rows;

  describe("JOB_SCHEDULES", () => {
    it("documents the spec 4.2 table and every expression is valid", () => {
      expect(Object.fromEntries(Object.entries(JOB_SCHEDULES).map(([k, v]) => [k, v.schedule]))).toEqual({
        "weekly-plan-build": "0 4 * * 6",
        "study-reminders": "*/15 8-21 * * *",
        "renewal-reminders": "0 10 * * *",
        "subscription-expiry": "0 * * * *",
        "payment-reconcile": "*/5 * * * *",
        "account-purge": "0 3 * * *",
        "otp-cleanup": "0 * * * *",
      });
      for (const { schedule } of Object.values(JOB_SCHEDULES)) {
        expect(cron.validate(schedule)).toBe(true);
      }
    });
  });

  describe("PGlite advisory lock support", () => {
    it("supports pg_try_advisory_lock/unlock but locks are re-entrant within one session", async () => {
      const first = await db.query("select pg_try_advisory_lock(hashtext($1)) as locked", ["probe"]);
      const second = await db.query("select pg_try_advisory_lock(hashtext($1)) as locked", ["probe"]);
      expect(first.rows[0].locked).toBe(true);
      expect(second.rows[0].locked).toBe(true); // same session => no contention in PGlite
      await db.query("select pg_advisory_unlock(hashtext($1))", ["probe"]);
      await db.query("select pg_advisory_unlock(hashtext($1))", ["probe"]);
    });
  });

  describe("runJob", () => {
    it("records success with stats and passes {db, now} to the handler", async () => {
      const handler = vi.fn(async () => ({ built: 3 }));
      const runner = createJobRunner({ db, now: () => FIXED_NOW, logger: silent });
      runner.register("demo", { schedule: "0 4 * * 6", handler });

      const result = await runner.runJob("demo");

      expect(result).toEqual({ status: "ok", stats: { built: 3 } });
      const arg = handler.mock.calls[0][0];
      expect(arg.db).toBe(db);
      expect(arg.now()).toEqual(FIXED_NOW);
      const [row] = await runs();
      expect(row).toMatchObject({ job: "demo", status: "ok", stats: { built: 3 }, error: null });
      expect(row.started_at).toEqual(FIXED_NOW);
      expect(row.finished_at).toBeInstanceOf(Date);
    });

    it("stores empty stats as an empty object when the handler returns nothing", async () => {
      const runner = createJobRunner({ db, logger: silent });
      runner.register("quiet", { schedule: "0 4 * * 6", handler: async () => {} });
      expect(await runner.runJob("quiet")).toEqual({ status: "ok", stats: {} });
    });

    it("records failures as failed without throwing", async () => {
      const runner = createJobRunner({ db, logger: silent });
      runner.register("boom", { schedule: "0 4 * * 6", handler: async () => { throw new Error("kaboom"); } });

      const result = await runner.runJob("boom");

      expect(result.status).toBe("failed");
      expect(result.error).toBe("kaboom");
      const [row] = await runs();
      expect(row).toMatchObject({ job: "boom", status: "failed", error: "kaboom" });
      expect(row.finished_at).toBeInstanceOf(Date);
    });

    it("handles synchronous throws and non-Error rejections", async () => {
      const runner = createJobRunner({ db, logger: silent });
      runner.register("sync", { schedule: "0 4 * * 6", handler: () => { throw new Error("sync fail"); } });
      runner.register("str", { schedule: "0 4 * * 6", handler: async () => { throw "plain"; } });      expect((await runner.runJob("sync")).error).toBe("sync fail");
      expect((await runner.runJob("str")).error).toBe("plain");
    });

    it("skips a concurrent run of the same job in the same process, then runs again afterwards", async () => {
      let release;
      const gate = new Promise((resolve) => { release = resolve; });
      const handler = vi.fn(async () => { await gate; return { n: 1 }; });
      const runner = createJobRunner({ db, logger: silent });
      runner.register("slow", { schedule: "0 4 * * 6", handler });

      const first = runner.runJob("slow");
      await vi.waitFor(() => expect(handler).toHaveBeenCalledTimes(1));
      const second = await runner.runJob("slow");
      expect(second).toEqual({ skipped: true, status: "skipped" });
      release();
      expect(await first).toEqual({ status: "ok", stats: { n: 1 } });

      const third = await runner.runJob("slow");
      expect(third.status).toBe("ok");
      expect(handler).toHaveBeenCalledTimes(2);
      const statuses = (await runs()).map((r) => r.status).sort();
      expect(statuses).toEqual(["ok", "ok", "skipped"]);
    });

    it("skips when another instance holds the advisory lock, and always unlocks on the same connection", async () => {
      const locks = new Map();
      const poolA = fakeLockPool(db, locks);
      const poolB = fakeLockPool(db, locks);
      let release;
      const gate = new Promise((resolve) => { release = resolve; });
      const handlerA = vi.fn(async () => { await gate; });
      const handlerB = vi.fn(async () => {});
      const a = createJobRunner({ db: poolA, logger: silent });
      const b = createJobRunner({ db: poolB, logger: silent });
      a.register("shared", { schedule: "0 4 * * 6", handler: handlerA });
      b.register("shared", { schedule: "0 4 * * 6", handler: handlerB });

      const first = a.runJob("shared");
      await vi.waitFor(() => expect(handlerA).toHaveBeenCalled());
      const second = await b.runJob("shared");
      expect(second.skipped).toBe(true);
      expect(handlerB).not.toHaveBeenCalled();
      expect(poolB.events).toEqual(["lock-denied", "release"]);

      release();
      await first;
      expect(poolA.events).toEqual(["lock", "unlock", "release"]);
      expect(locks.size).toBe(0);
    });

    it("unlocks even when the handler fails", async () => {
      const locks = new Map();
      const pool = fakeLockPool(db, locks);
      const runner = createJobRunner({ db: pool, logger: silent });
      runner.register("failing", { schedule: "0 4 * * 6", handler: async () => { throw new Error("x"); } });
      expect((await runner.runJob("failing")).status).toBe("failed");
      expect(pool.events).toEqual(["lock", "unlock", "release"]);
      expect(locks.size).toBe(0);
    });

    it("never throws when the database is down", async () => {
      const broken = { query: async () => { throw new Error("db down"); } };
      const runner = createJobRunner({ db: broken, logger: silent });
      runner.register("demo", { schedule: "0 4 * * 6", handler: async () => ({}) });
      const result = await runner.runJob("demo");
      expect(result.status).toBe("failed");
      expect(result.error).toContain("db down");
    });

    it("returns failed for an unknown job", async () => {
      const runner = createJobRunner({ db, logger: silent });
      const result = await runner.runJob("missing");
      expect(result.status).toBe("failed");
      expect(result.error).toMatch(/unknown job/i);
    });
  });

  describe("register / list", () => {
    it("lists jobs with schedule and timezone, defaulting to Asia/Tehran", () => {
      const runner = createJobRunner({ db, logger: silent });
      runner.register("otp-cleanup", { handler: async () => {} }); // schedule falls back to JOB_SCHEDULES
      runner.register("custom", { schedule: "*/5 * * * *", handler: async () => {}, timezone: "UTC" });
      expect(runner.list()).toEqual([
        { name: "otp-cleanup", schedule: "0 * * * *", timezone: "Asia/Tehran", running: false },
        { name: "custom", schedule: "*/5 * * * *", timezone: "UTC", running: false },
      ]);
    });

    it("validates its arguments and rejects duplicates", () => {
      const runner = createJobRunner({ db, logger: silent });
      const handler = async () => {};
      expect(() => runner.register("", { schedule: "0 4 * * 6", handler })).toThrow(TypeError);
      expect(() => runner.register("x", { schedule: "0 4 * * 6" })).toThrow(TypeError);
      expect(() => runner.register("nosched", { handler })).toThrow(TypeError);
      runner.register("dup", { schedule: "0 4 * * 6", handler });
      expect(() => runner.register("dup", { schedule: "0 4 * * 6", handler })).toThrow(/already registered/);
    });
  });

  describe("start / stop", () => {
    let runner;
    afterEach(() => {
      runner?.stop();
      vi.restoreAllMocks();
    });

    it("rejects an invalid cron expression and schedules nothing", () => {
      const spy = vi.spyOn(cron, "schedule");
      runner = createJobRunner({ db, logger: silent });
      runner.register("good", { schedule: "0 4 * * 6", handler: async () => {} });
      runner.register("bad", { schedule: "not a cron", handler: async () => {} });
      expect(() => runner.start()).toThrow(/bad/);
      expect(spy).not.toHaveBeenCalled();
    });

    it("schedules every job with its timezone, is idempotent and stops cleanly", () => {
      const spy = vi.spyOn(cron, "schedule");
      runner = createJobRunner({ db, logger: silent });
      runner.register("a", { schedule: "0 4 * * 6", handler: async () => {} });
      runner.register("b", { schedule: "*/15 8-21 * * *", handler: async () => {}, timezone: "UTC" });
      runner.start();
      runner.start();
      expect(spy).toHaveBeenCalledTimes(2);
      expect(spy.mock.calls[0][0]).toBe("0 4 * * 6");
      expect(spy.mock.calls[0][2]).toMatchObject({ timezone: "Asia/Tehran" });
      expect(spy.mock.calls[1][2]).toMatchObject({ timezone: "UTC" });
      runner.stop();
      runner.stop();
      runner.start();
      expect(spy).toHaveBeenCalledTimes(4);
    });

    it("runs the job through runJob when the cron callback fires", async () => {
      const spy = vi.spyOn(cron, "schedule");
      const handler = vi.fn(async () => ({ ok: 1 }));
      runner = createJobRunner({ db, logger: silent });
      runner.register("tick", { schedule: "0 4 * * 6", handler });
      runner.start();
      await spy.mock.calls[0][1]();
      expect(handler).toHaveBeenCalledTimes(1);
      expect((await runs())[0]).toMatchObject({ job: "tick", status: "ok" });
    });
  });
});
