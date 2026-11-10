import fs from "node:fs/promises";
import path from "node:path";

export const MIGRATION_FILE = /^\d{3}_[a-z0-9_]+\.sql$/;

/**
 * @typedef {{query: (sql: string, params?: unknown[]) => Promise<{rows: any[]}>,
 *            exec?: (sql: string) => Promise<unknown>,
 *            transaction?: (fn: (tx: any) => Promise<void>) => Promise<unknown>}} MigrationDb
 */

/**
 * Multi-statement SQL needs the simple protocol: PGlite `exec`, or pg `query`
 * without parameters.
 * @param {MigrationDb} db
 * @param {string} sql
 */
async function run(db, sql) {
  if (typeof db.exec === "function") return db.exec(sql);
  return db.query(sql);
}

/**
 * List every `NNN_name.sql` file in `dir`, sorted by filename. Non-.sql files
 * are ignored; a .sql file that does not match the naming rule, or a repeated
 * number, is an error so a typo can never be skipped silently.
 * @param {string} dir
 * @returns {Promise<Array<{version: string, file: string, path: string}>>}
 */
export async function listMigrations(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".sql"))
    .map((entry) => entry.name)
    .sort();
  const seen = new Map();
  return files.map((file) => {
    if (!MIGRATION_FILE.test(file)) {
      throw new Error(`Invalid migration file name "${file}": must match ${MIGRATION_FILE}`);
    }
    const number = file.slice(0, 3);
    if (seen.has(number)) {
      throw new Error(`Duplicate migration number ${number}: ${seen.get(number)} and ${file}`);
    }
    seen.set(number, file);
    return { version: file.slice(0, -".sql".length), file, path: path.join(dir, file) };
  });
}

// Serialises concurrent boots (two instances starting together on PostgreSQL).
const MIGRATION_LOCK_KEY = 7283641;

/**
 * Run `work(tx)` atomically. Uses the driver's transaction when it has one
 * (PGlite, openDb), otherwise explicit BEGIN/COMMIT/ROLLBACK on the single
 * connection. Resolves with whatever `work` returns.
 * @template T
 * @param {MigrationDb} db
 * @param {(tx: MigrationDb) => Promise<T>} work
 * @returns {Promise<T>}
 */
async function inTransaction(db, work) {
  if (typeof db.transaction === "function") {
    return db.transaction(work);
  }
  await db.query("begin");
  try {
    const result = await work(db);
    await db.query("commit");
    return result;
  } catch (error) {
    await db.query("rollback").catch(() => {});
    throw error;
  }
}

/** @param {MigrationDb} tx */
async function lock(tx) {
  await tx.query("select pg_advisory_xact_lock($1)", [MIGRATION_LOCK_KEY]);
}

/**
 * Apply every pending migration in `dir`, each in its own transaction together
 * with its `schema_migrations` row. Idempotent. Stops at the first failure
 * (that migration is rolled back and not recorded).
 * @param {MigrationDb} db
 * @param {string} dir
 * @returns {Promise<{applied: string[], versions: string[]}>} newly applied
 *   versions and every recorded version, both in order
 */
export async function applyMigrations(db, dir) {
  const migrations = await listMigrations(dir);
  await inTransaction(db, async (tx) => {
    await lock(tx);
    await run(tx, `create table if not exists schema_migrations (
      version text primary key,
      applied_at timestamptz default now()
    )`);
  });

  const applied = [];
  for (const migration of migrations) {
    const sql = await fs.readFile(migration.path, "utf8");
    const didApply = await inTransaction(db, async (tx) => {
      await lock(tx);
      // Re-check under the lock: another instance may have applied it meanwhile.
      const seen = await tx.query("select 1 from schema_migrations where version = $1", [migration.version]);
      if (seen.rows.length > 0) return false;
      await run(tx, sql);
      await tx.query("insert into schema_migrations (version) values ($1)", [migration.version]);
      return true;
    });
    if (didApply) applied.push(migration.version);
  }

  const all = await db.query("select version from schema_migrations order by version asc");
  return { applied, versions: all.rows.map((row) => row.version) };
}
