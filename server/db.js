import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_PGLITE_DIR = path.join("data", "pglite");

/**
 * @typedef {{query: (sql: string, params?: unknown[]) => Promise<{rows: any[]}>,
 *            exec: (sql: string) => Promise<unknown>}} Queryable
 * @typedef {Queryable & {
 *   kind: 'postgres'|'pglite',
 *   connect: () => Promise<Queryable & {release: () => void}>,
 *   transaction: <T>(fn: (tx: Queryable) => Promise<T>) => Promise<T>,
 *   close: () => Promise<void>,
 * }} Database
 */

/**
 * Decide which database to open. Never echoes the URL in errors (it may hold a
 * password).
 * - `postgres://` / `postgresql://` -> PostgreSQL
 * - `pglite:<dir>` -> PGlite in <dir> (relative paths resolve against the project root)
 * - empty -> PGlite in `env.PGLITE_DIR`, else `data/pglite`
 * @param {{databaseUrl?: string, env?: Record<string, string|undefined>}} options
 * @returns {{kind: 'postgres', url: string} | {kind: 'pglite', dir: string}}
 */
export function resolveDatabaseTarget({ databaseUrl, env = process.env } = {}) {
  const url = (databaseUrl ?? "").trim();
  if (url === "") {
    const dir = (env.PGLITE_DIR ?? "").trim() || DEFAULT_PGLITE_DIR;
    return { kind: "pglite", dir: path.resolve(root, dir) };
  }
  if (url.startsWith("pglite:")) {
    return { kind: "pglite", dir: path.resolve(root, url.slice("pglite:".length)) };
  }
  if (/^postgres(ql)?:\/\//.test(url)) return { kind: "postgres", url };
  throw new Error("DATABASE_URL must be a postgres:// URL or pglite:<dir>");
}

/** @param {string} dir @returns {Promise<Database>} */
async function openPglite(dir) {
  const { PGlite } = await import("@electric-sql/pglite");
  const pg = new PGlite(dir);
  await pg.waitReady;
  const query = (sql, params) => pg.query(sql, params);
  let closed = false;
  return {
    kind: "pglite",
    query,
    exec: (sql) => pg.exec(sql),
    // PGlite has a single session: a "client" is the database itself.
    async connect() {
      return { query, exec: (sql) => pg.exec(sql), release() {} };
    },
    transaction: (fn) => pg.transaction(fn),
    async close() {
      if (closed) return;
      closed = true;
      await pg.close();
    },
  };
}

/** @param {string} url @returns {Promise<Database>} */
async function openPostgres(url) {
  const { default: pg } = await import("pg");
  const pool = new pg.Pool({ connectionString: url, connectionTimeoutMillis: 5000 });
  let closed = false;
  return {
    kind: "postgres",
    query: (sql, params) => pool.query(sql, params),
    // Simple protocol: allows several statements in one string.
    exec: (sql) => pool.query(sql),
    connect: () => pool.connect(),
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query("begin");
        const result = await fn({
          query: (sql, params) => client.query(sql, params),
          exec: (sql) => client.query(sql),
        });
        await client.query("commit");
        return result;
      } catch (error) {
        await client.query("rollback").catch(() => {});
        throw error;
      } finally {
        client.release();
      }
    },
    async close() {
      if (closed) return;
      closed = true;
      await pool.end();
    },
  };
}

/**
 * Open the project database behind one interface for server, CLIs and tests.
 * @param {{databaseUrl?: string, env?: Record<string, string|undefined>}} [options]
 * @returns {Promise<Database>}
 */
export async function openDb(options = {}) {
  const target = resolveDatabaseTarget(options);
  return target.kind === "pglite" ? openPglite(target.dir) : openPostgres(target.url);
}
