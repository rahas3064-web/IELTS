import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { applyMigrations } from "./migrate.js";
import { runSeed } from "./seed.js";
import { DevSeedBlockedError, runDevSeed } from "./seed-dev.js";

const migrations = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "db", "migrations");
let db;

async function counts() {
  const tables = (await db.query("select table_name from information_schema.tables where table_schema = 'public' order by table_name")).rows;
  const out = {};
  for (const { table_name: name } of tables) {
    out[name] = (await db.query(`select count(*)::int as n from "${name}"`)).rows[0].n;
  }
  return out;
}

async function setting(key) {
  const found = await db.query("select value from system_settings where key = $1", [key]);
  return found.rows[0]?.value;
}

beforeAll(async () => {
  db = new PGlite();
  await db.waitReady;
  await applyMigrations(db, migrations);
});

beforeEach(async () => {
  await db.exec("truncate system_settings, users cascade");
});

afterAll(async () => {
  await db.close();
});

describe("runSeed", () => {
  it("seeds the default system settings from the spec", async () => {
    await runSeed(db, { env: {} });
    expect(await setting("streak_skip_rest_days")).toBe(false);
    expect(await setting("reminder_window")).toEqual({ start: "08:00", end: "22:00" });
    expect(await setting("otp")).toEqual({ length: 5, ttlSec: 120, resendSec: 60, maxAttempts: 5, lockMinutes: 15 });
  });

  it("is idempotent: running twice leaves every table's row count unchanged", async () => {
    await runSeed(db, { env: {} });
    const first = await counts();
    await runSeed(db, { env: {} });
    expect(await counts()).toEqual(first);
    expect(first.system_settings).toBe(3);
  });

  it("does not overwrite a value an admin changed", async () => {
    await runSeed(db, { env: {} });
    await db.query("update system_settings set value = 'true'::jsonb where key = 'streak_skip_rest_days'");
    await runSeed(db, { env: {} });
    expect(await setting("streak_skip_rest_days")).toBe(true);
  });

  it("restores a missing default on the next run", async () => {
    await runSeed(db, { env: {} });
    await db.query("delete from system_settings where key = 'otp'");
    await runSeed(db, { env: {} });
    expect(await setting("otp")).toMatchObject({ length: 5 });
  });

  it("seeds only reference data: no users, content or learner rows", async () => {
    await runSeed(db, { env: {} });
    const after = await counts();
    for (const [table, n] of Object.entries(after)) {
      // plans / ai_quota_configs / plan_prices / feature_entitlements hold the catalogue inserted by migrations 009, 010 and 012, not by runSeed.
      if (!["system_settings", "schema_migrations", "plans", "ai_quota_configs", "plan_prices", "feature_entitlements"].includes(table)) expect(n, table).toBe(0);
    }
  });

  it("runs in a transaction: a failure leaves nothing half-seeded", async () => {
    const broken = {
      query: (sql, params) => db.query(sql, params),
      transaction: (fn) =>
        db.transaction(async (tx) => {
          let calls = 0;
          return fn({
            query: (sql, params) => {
              calls += 1;
              if (calls === 2) throw new Error("disk full");
              return tx.query(sql, params);
            },
          });
        }),
    };
    await expect(runSeed(broken, { env: {} })).rejects.toThrow("disk full");
    expect((await db.query("select count(*)::int as n from system_settings")).rows[0].n).toBe(0);
  });
});

describe("runDevSeed", () => {
  it("refuses to run when NODE_ENV is production", async () => {
    await expect(runDevSeed(db, { env: { NODE_ENV: "production" } })).rejects.toBeInstanceOf(DevSeedBlockedError);
    await expect(runDevSeed(db, { env: { NODE_ENV: " Production " } })).rejects.toThrow(/production/i);
  });

  it("seeds no fixtures yet and writes nothing", async () => {
    const before = await counts();
    const result = await runDevSeed(db, { env: { NODE_ENV: "development" } });
    expect(result).toEqual({ fixtures: 0 });
    expect(await counts()).toEqual(before);
  });
});

describe("seed CLIs", () => {
  it("db:seed:dev exits non-zero with a clear message in production", async () => {
    const { spawnSync } = await import("node:child_process");
    const cli = path.join(path.dirname(fileURLToPath(import.meta.url)), "seed-dev-cli.js");
    const result = spawnSync(process.execPath, [cli], {
      env: { ...process.env, NODE_ENV: "production", DATABASE_URL: "postgresql://nobody@127.0.0.1:1/none" },
      encoding: "utf8",
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/production/i);
    expect(result.stderr).toMatch(/refus/i);
    expect(result.stderr).not.toContain("nobody");
  });

  it("package.json exposes the db scripts", async () => {
    const pkg = JSON.parse(await fs.readFile(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "package.json"), "utf8"));
    expect(pkg.scripts["db:migrate"]).toBe("node server/migrate-cli.js");
    expect(pkg.scripts["db:seed"]).toBe("node server/seed-cli.js");
    expect(pkg.scripts["db:seed:dev"]).toBe("node server/seed-dev-cli.js");
  });
});
