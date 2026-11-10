import fs from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applyMigrations, listMigrations } from "../server/migrate.js";
import { createMigratedDb, findUnindexedForeignKeys, migrationsDir } from "./test-helpers.js";

const NEW_TABLES = {
  "002_content": [
    "question_types", "media_assets", "content_passages", "content_generation_jobs",
    "content_items", "content_reviews", "band_descriptors", "band_conversion_tables",
  ],
  "003_placement": [
    "placement_versions", "placement_sections", "placement_section_items", "placement_attempts",
    "placement_skill_attempts", "placement_answers", "speaking_recordings",
  ],
  "004_practice_plan": [
    "practice_sets", "practice_set_items", "practice_attempts", "practice_answers",
    "question_type_mastery", "study_plans", "plan_tasks",
  ],
  "005_feedback_progress": ["ai_feedback", "feedback_issues", "feedback_issue_categories", "band_snapshots"],
  "006_mock": [
    "mocks", "mock_sections", "mock_section_items", "mock_attempts", "mock_section_attempts",
    "mock_scoring_attempts", "mock_answers", "mock_annotations",
  ],
  "007_billing": [
    "plans", "plan_prices", "feature_entitlements", "subscriptions", "subscription_events",
    "scheduled_subscription_changes", "trial_records", "ai_quota_configs", "ai_usage_counters",
    "ai_usage_events", "credit_wallets", "credit_lots", "credit_ledger", "referral_codes",
    "referral_attributions", "referral_rewards", "discount_codes", "discount_redemptions",
    "payment_attempts", "invoices", "payment_provider_events",
  ],
  "008_assistant": ["assistant_conversations", "assistant_messages"],
};
const CORE = [
  "users", "otp_codes", "otp_locks", "sessions", "learner_profiles", "admin_credentials", "audit_logs",
  "notifications", "sms_messages", "user_streaks", "rate_limits", "system_settings", "job_runs",
];
// jsonb is only for structured payloads; everything else is a typed column.
const JSONB_ALLOWED = [
  "ai_feedback.criteria", "audit_logs.after", "audit_logs.before", "audit_logs.meta",
  "content_items.answer_key", "content_items.stem", "content_reviews.diff", "job_runs.stats",
  "mock_answers.answer", "payment_attempts.raw", "payment_provider_events.payload",
  "placement_answers.answer", "practice_answers.answer", "speaking_recordings.words",
  "study_plans.inputs", "system_settings.value",
];

let db;
beforeAll(async () => { db = await createMigratedDb(); });
afterAll(async () => { await db.close(); });

describe("migration set", () => {
  it("has 001..008 in order", async () => {
    const versions = (await listMigrations(migrationsDir)).map((m) => m.version);
    expect(versions).toEqual(["001_core", ...Object.keys(NEW_TABLES)]);
  });

  it("creates exactly the expected tables, no more", async () => {
    const result = await db.query("select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'");
    const expected = [...CORE, "schema_migrations", ...Object.values(NEW_TABLES).flat()].sort();
    expect(result.rows.map((r) => r.table_name).sort()).toEqual(expected);
    expect(expected.length).toBe(71);
  });

  it.each(Object.entries(NEW_TABLES))("%s creates its tables", async (version, tables) => {
    const result = await db.query("select table_name from information_schema.tables where table_schema = 'public'");
    const names = result.rows.map((r) => r.table_name);
    for (const table of tables) expect(names, `${version}: ${table}`).toContain(table);
  });

  it("applies cleanly twice on a fresh in-memory database and records every version", async () => {
    const fresh = new PGlite();
    await fresh.waitReady;
    try {
      const first = await applyMigrations(fresh, migrationsDir);
      expect(first.applied).toEqual(["001_core", ...Object.keys(NEW_TABLES)]);
      const second = await applyMigrations(fresh, migrationsDir);
      expect(second.applied).toEqual([]);
      expect(second.versions).toEqual(first.versions);
    } finally {
      await fresh.close();
    }
  });

  it("contains no ALTER TABLE, extension, citext or inline partial unique constraints", async () => {
    for (const { path: file, version } of await listMigrations(migrationsDir)) {
      const sql = (await fs.readFile(file, "utf8")).replace(/--.*$/gm, "").toLowerCase();
      expect(sql, version).not.toMatch(/\balter table\b/);
      expect(sql, version).not.toMatch(/create extension|citext|btree_gist/);
      expect(sql, version).not.toMatch(/nulls not distinct/);
      expect(sql, version).not.toMatch(/unique\s*\([^)]*\)\s*where/);
    }
  });

  it("does not redefine the reference tables from 001", async () => {
    for (const { path: file, version } of (await listMigrations(migrationsDir)).slice(1)) {
      const sql = (await fs.readFile(file, "utf8")).replace(/--.*$/gm, "").toLowerCase();
      for (const table of CORE) {
        expect(sql, `${version} ${table}`).not.toMatch(new RegExp(`create table (if not exists )?${table}\\b`));
      }
    }
  });
});

describe("conventions on every table", () => {
  it("indexes every foreign key column (leading index)", async () => {
    const { checked, missing } = await findUnindexedForeignKeys(db);
    expect(checked).toBeGreaterThan(60);
    expect(missing).toEqual([]);
  });

  it("detects an unindexed foreign key (guards the generic test itself)", async () => {
    await db.exec("create table zz_parent (id int primary key); create table zz_child (id int primary key, p int references zz_parent (id));");
    try {
      expect((await findUnindexedForeignKeys(db)).missing).toEqual(["zz_child.zz_child_p_fkey"]);
    } finally {
      await db.exec("drop table zz_child; drop table zz_parent;");
    }
  });

  it("gives every foreign key an explicit ON DELETE action", async () => {
    const result = await db.query(`
      select conrelid::regclass::text as tbl, conname, confdeltype
      from pg_constraint where contype = 'f' and connamespace = 'public'::regnamespace`);
    expect(result.rows.length).toBeGreaterThan(60);
    // 'a' = NO ACTION is what an omitted clause produces; none are allowed.
    expect(result.rows.filter((r) => r.confdeltype === "a").map((r) => `${r.tbl}.${r.conname}`)).toEqual([]);
  });

  it("uses uuid primary keys with gen_random_uuid() defaults wherever there is an id column", async () => {
    const result = await db.query(`
      select table_name, data_type, column_default from information_schema.columns
      where table_schema = 'public' and column_name = 'id'`);
    expect(result.rows.length).toBeGreaterThan(40);
    for (const row of result.rows) {
      expect(row.data_type, row.table_name).toBe("uuid");
      expect(row.column_default, row.table_name).toContain("gen_random_uuid()");
    }
  });

  it("makes every created_at/updated_at a not-null timestamptz defaulting to now()", async () => {
    const result = await db.query(`
      select table_name, column_name, data_type, is_nullable, column_default from information_schema.columns
      where table_schema = 'public' and column_name in ('created_at', 'updated_at')`);
    for (const row of result.rows) {
      const label = `${row.table_name}.${row.column_name}`;
      expect(row.data_type, label).toBe("timestamp with time zone");
      expect(row.is_nullable, label).toBe("NO");
      expect(row.column_default, label).toContain("now()");
    }
  });

  it("has a set_updated_at trigger on every table with updated_at", async () => {
    const cols = await db.query("select table_name from information_schema.columns where table_schema = 'public' and column_name = 'updated_at'");
    const triggers = await db.query(`
      select c.relname as tbl from pg_trigger t join pg_class c on c.oid = t.tgrelid
      where not t.tgisinternal and t.tgfoid = 'set_updated_at'::regproc`);
    const have = new Set(triggers.rows.map((r) => r.tbl));
    expect(cols.rows.map((r) => r.table_name).filter((t) => !have.has(t))).toEqual([]);
  });

  it("stores money as bigint Rials", async () => {
    const result = await db.query(`
      select table_name, column_name, data_type from information_schema.columns
      where table_schema = 'public' and (column_name like '%\\_rial' escape '\\' or column_name like 'amount%')`);
    expect(result.rows.length).toBeGreaterThan(10);
    for (const row of result.rows.filter((r) => r.column_name !== "amount")) {
      expect(row.data_type, `${row.table_name}.${row.column_name}`).toBe("bigint");
    }
  });

  it("uses jsonb only for the whitelisted structured payloads", async () => {
    const result = await db.query("select table_name, column_name from information_schema.columns where table_schema = 'public' and data_type = 'jsonb'");
    expect(result.rows.map((r) => `${r.table_name}.${r.column_name}`).sort()).toEqual([...JSONB_ALLOWED].sort());
  });

  it("has no display_name or summary columns and no payload except on the payment tables", async () => {
    const result = await db.query("select table_name, column_name from information_schema.columns where table_schema = 'public'");
    const names = result.rows.map((r) => `${r.table_name}.${r.column_name}`);
    expect(names.filter((n) => /\.(display_name|summary)$/.test(n))).toEqual([]);
    expect(names.filter((n) => n.endsWith(".payload")).sort()).toEqual(["payment_attempts.payload", "payment_provider_events.payload"]);
  });

  it("names its CHECK constraints", async () => {
    const result = await db.query(`
      select conrelid::regclass::text as tbl, conname from pg_constraint
      where contype = 'c' and connamespace = 'public'::regnamespace and conname ~ '_check$'`);
    expect(result.rows.filter((r) => r.tbl !== "rate_limits" && r.tbl !== "job_runs")).toEqual([]);
  });
});
