// Shared helpers for the schema tests (not a test file itself). Every helper takes
// the PGlite instance first and returns the inserted row.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { expect } from "vitest";
import { applyMigrations } from "../server/migrate.js";

export const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "migrations");

/** In-memory PGlite with every migration applied. */
export async function createMigratedDb() {
  const db = new PGlite();
  await db.waitReady;
  await applyMigrations(db, migrationsDir);
  return db;
}

export async function expectViolation(promise, fragment) {
  await expect(promise).rejects.toThrow(fragment);
}

let counter = 0;
export const unique = (prefix = "x") => `${prefix}-${Date.now().toString(36)}-${(counter += 1)}`;

/** insert into <table> (cols) values (...) returning *  — identifiers come from test code only. */
export async function insert(db, table, row) {
  const keys = Object.keys(row);
  const sql = keys.length === 0
    ? `insert into ${table} default values returning *`
    : `insert into ${table} (${keys.join(", ")}) values (${keys.map((_, i) => `$${i + 1}`).join(", ")}) returning *`;
  const result = await db.query(sql, keys.map((key) => row[key]));
  return result.rows[0];
}

export async function count(db, table, where = "true", params = []) {
  const result = await db.query(`select count(*)::int as n from ${table} where ${where}`, params);
  return result.rows[0].n;
}

/** Foreign keys with no index that starts with the FK columns (in order). */
export async function findUnindexedForeignKeys(db) {
  const fks = await db.query(`
    select c.conrelid::regclass::text as tbl, c.conname, c.conkey
    from pg_constraint c join pg_namespace n on n.oid = c.connamespace
    where c.contype = 'f' and n.nspname = 'public'`);
  const missing = [];
  for (const fk of fks.rows) {
    const indexes = await db.query(
      "select i.indkey::int2[] as cols from pg_index i where i.indrelid = $1::regclass and i.indisvalid",
      [fk.tbl],
    );
    const covered = indexes.rows.some((idx) => fk.conkey.every((col, pos) => idx.cols[pos] === col));
    if (!covered) missing.push(`${fk.tbl}.${fk.conname}`);
  }
  return { checked: fks.rows.length, missing };
}

// ---------------------------------------------------------------- fixtures
const REVIEWED = { reviewed_at: new Date("2026-01-01T00:00:00Z") };

export const newUser = (db, overrides = {}) => insert(db, "users", {
  phone: `09${String(Math.floor(Math.random() * 1e9)).padStart(9, "0")}`,
  first_name: "Sara",
  last_name: "Ahmadi",
  ...overrides,
});

export async function newQuestionType(db, overrides = {}) {
  const key = overrides.key ?? unique("qt").replace(/-/g, "_");
  return insert(db, "question_types", {
    key, skill: "reading", name_fa: "نوع", name_en: "Type", official_description: "desc", ...overrides,
  });
}

export async function newItem(db, overrides = {}) {
  const skill = overrides.skill ?? "reading";
  const questionType = overrides.question_type ?? (await newQuestionType(db, { skill })).key;
  return insert(db, "content_items", {
    skill,
    exam_type: "academic",
    question_type: questionType,
    stem: JSON.stringify({ prompt: "Q" }),
    answer_key: JSON.stringify({ correct: "A" }),
    ...overrides,
  });
}

export const publishedItem = (db, overrides = {}) =>
  newItem(db, { status: "published", ...REVIEWED, ...overrides });

export const newPlacementVersion = (db, overrides = {}) => insert(db, "placement_versions", {
  exam_type: "academic", version_no: Math.floor(Math.random() * 1e6), ...overrides,
});

export const newPracticeSet = (db, overrides = {}) => insert(db, "practice_sets", {
  kind: "exam_part", skill: "reading", exam_type: "academic", part_no: 1,
  title_fa: "عنوان", title_en: "Title", time_limit_sec: 1200, est_minutes: 20, ...overrides,
});

export const newMock = (db, overrides = {}) => insert(db, "mocks", {
  exam_type: "academic", title_fa: "آزمون", title_en: "Mock", ...overrides,
});

export const newPlan = (db, overrides = {}) => insert(db, "plans", {
  key: unique("plan").replace(/-/g, "_"), tier: "premium", name_fa: "پلن", name_en: "Plan", duration_days: 30, ...overrides,
});

export async function newPlanPrice(db, overrides = {}) {
  const planKey = overrides.plan_key ?? (await newPlan(db)).key;
  return insert(db, "plan_prices", { plan_key: planKey, amount_rial: 1_000_000, ...overrides });
}

export async function newPaymentAttempt(db, overrides = {}) {
  const userId = overrides.user_id === undefined ? (await newUser(db)).id : overrides.user_id;
  const priceId = overrides.plan_price_id ?? (await newPlanPrice(db)).id;
  return insert(db, "payment_attempts", {
    user_id: userId,
    plan_price_id: priceId,
    amount_rial: 1_000_000,
    provider: "bale",
    flow: "bot_chat",
    idempotency_key: unique("idem"),
    payload: unique("payload"),
    expires_at: new Date(Date.now() + 3_600_000),
    ...overrides,
  });
}
