import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb, resolveDatabaseTarget } from "./db.js";

let dir;
const opened = [];

async function open(options) {
  const db = await openDb(options);
  opened.push(db);
  return db;
}

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "bandora-db-"));
});

afterEach(async () => {
  while (opened.length) await opened.pop().close();
  await fs.rm(dir, { recursive: true, force: true });
});

describe("resolveDatabaseTarget", () => {
  it("uses Postgres for a postgres URL", () => {
    expect(resolveDatabaseTarget({ databaseUrl: "postgresql://u:p@h:5432/d" })).toEqual({
      kind: "postgres",
      url: "postgresql://u:p@h:5432/d",
    });
  });

  it("resolves a pglite: URL against the project root unless absolute", () => {
    const relative = resolveDatabaseTarget({ databaseUrl: "pglite:./data/x", env: {} });
    expect(relative.kind).toBe("pglite");
    expect(path.isAbsolute(relative.dir)).toBe(true);
    expect(relative.dir.endsWith(path.join("data", "x"))).toBe(true);
    expect(resolveDatabaseTarget({ databaseUrl: `pglite:${dir}` }).dir).toBe(dir);
  });

  it("falls back to PGLITE_DIR, then data/pglite, when no URL is given", () => {
    expect(resolveDatabaseTarget({ databaseUrl: "", env: { PGLITE_DIR: dir } })).toEqual({ kind: "pglite", dir });
    const fallback = resolveDatabaseTarget({ databaseUrl: undefined, env: {} });
    expect(fallback.dir.endsWith(path.join("data", "pglite"))).toBe(true);
  });

  it("rejects an unsupported URL scheme without echoing it", () => {
    expect(() => resolveDatabaseTarget({ databaseUrl: "mysql://user:secret@h/d" })).toThrow(/postgres/i);
    try {
      resolveDatabaseTarget({ databaseUrl: "mysql://user:secret@h/d" });
    } catch (error) {
      expect(String(error.message)).not.toContain("secret");
    }
  });
});

describe("openDb on PGlite", () => {
  it("runs parameterised queries and multi-statement exec", async () => {
    const db = await open({ databaseUrl: `pglite:${dir}` });
    expect(db.kind).toBe("pglite");
    await db.exec("create table t (id int primary key, v text); insert into t values (1, 'a'), (2, 'b');");
    const found = await db.query("select v from t where id = $1", [2]);
    expect(found.rows).toEqual([{ v: "b" }]);
  });

  it("commits a transaction and rolls it back on error", async () => {
    const db = await open({ databaseUrl: `pglite:${dir}` });
    await db.exec("create table t (id int primary key)");
    await db.transaction(async (tx) => {
      await tx.query("insert into t values (1)");
    });
    await expect(
      db.transaction(async (tx) => {
        await tx.query("insert into t values (2)");
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    const rows = await db.query("select id from t order by id");
    expect(rows.rows).toEqual([{ id: 1 }]);
  });

  it("offers connect() with release() for the job runner", async () => {
    const db = await open({ databaseUrl: `pglite:${dir}` });
    const client = await db.connect();
    expect((await client.query("select 1 as one")).rows).toEqual([{ one: 1 }]);
    expect(() => client.release()).not.toThrow();
  });

  it("persists data across reopen of the same directory", async () => {
    const first = await openDb({ databaseUrl: `pglite:${dir}` });
    await first.exec("create table t (id int); insert into t values (7)");
    await first.close();
    const second = await open({ databaseUrl: `pglite:${dir}` });
    expect((await second.query("select id from t")).rows).toEqual([{ id: 7 }]);
  });

  it("close() is idempotent", async () => {
    const db = await openDb({ databaseUrl: `pglite:${dir}` });
    await db.close();
    await expect(db.close()).resolves.toBeUndefined();
  });
});
