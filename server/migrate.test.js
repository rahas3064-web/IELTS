import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { applyMigrations, listMigrations } from "./migrate.js";

let dir;
let db;

async function write(name, sql) {
  await fs.writeFile(path.join(dir, name), sql, "utf8");
}

async function tableExists(name) {
  const found = await db.query("select to_regclass($1) as name", [`public.${name}`]);
  return Boolean(found.rows[0].name);
}

beforeAll(async () => {
  db = new PGlite();
  await db.waitReady;
});

afterAll(async () => {
  await db.close();
});

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "bandora-migrate-"));
  await db.exec("drop schema public cascade; create schema public;");
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

describe("listMigrations", () => {
  it("returns NNN_*.sql files sorted by filename and ignores other files", async () => {
    await write("010_late.sql", "select 1;");
    await write("002_second.sql", "select 1;");
    await write("001_first.sql", "select 1;");
    await write("README.md", "notes");
    const list = await listMigrations(dir);
    expect(list.map((entry) => entry.file)).toEqual(["001_first.sql", "002_second.sql", "010_late.sql"]);
    expect(list.map((entry) => entry.version)).toEqual(["001_first", "002_second", "010_late"]);
  });

  it.each([
    ["1_short.sql"],
    ["0001_long.sql"],
    ["001_Upper.sql"],
    ["001-dash.sql"],
    ["001_.sql"],
    ["abc_name.sql"],
    ["001_name.SQL.sql"],
  ])("rejects the badly named file %s", async (name) => {
    await write("001_ok.sql", "select 1;");
    await write(name, "select 1;");
    await expect(listMigrations(dir)).rejects.toThrow(/\^\\d\{3\}_/);
  });

  it("rejects two files that share a number", async () => {
    await write("001_a.sql", "select 1;");
    await write("001_b.sql", "select 1;");
    await expect(listMigrations(dir)).rejects.toThrow(/duplicate/i);
  });

  it("returns an empty list for an empty directory", async () => {
    expect(await listMigrations(dir)).toEqual([]);
  });
});

describe("applyMigrations", () => {
  it("applies every file in filename order on a fresh database", async () => {
    await write("002_b.sql", "create table b (id int primary key, a_id int references a(id));");
    await write("001_a.sql", "create table a (id int primary key);");
    const result = await applyMigrations(db, dir);
    expect(result.applied).toEqual(["001_a", "002_b"]);
    expect(await tableExists("a")).toBe(true);
    expect(await tableExists("b")).toBe(true);
    const recorded = await db.query("select version, applied_at from schema_migrations order by version");
    expect(recorded.rows.map((row) => row.version)).toEqual(["001_a", "002_b"]);
    expect(recorded.rows.every((row) => row.applied_at instanceof Date)).toBe(true);
  });

  it("supports multi-statement files", async () => {
    await write("001_multi.sql", "create table m (id int); insert into m values (1); insert into m values (2);");
    await applyMigrations(db, dir);
    const count = await db.query("select count(*)::int as n from m");
    expect(count.rows[0].n).toBe(2);
  });

  it("is idempotent: a second run applies nothing and changes nothing", async () => {
    await write("001_a.sql", "create table a (id int primary key); insert into a values (1);");
    await applyMigrations(db, dir);
    const second = await applyMigrations(db, dir);
    expect(second.applied).toEqual([]);
    expect(second.versions).toEqual(["001_a"]);
    const count = await db.query("select count(*)::int as n from a");
    expect(count.rows[0].n).toBe(1);
  });

  it("applies only the new files on a later run", async () => {
    await write("001_a.sql", "create table a (id int);");
    await applyMigrations(db, dir);
    await write("002_b.sql", "create table b (id int);");
    const result = await applyMigrations(db, dir);
    expect(result.applied).toEqual(["002_b"]);
    expect(result.versions).toEqual(["001_a", "002_b"]);
  });

  it("rolls a failing migration back completely, does not record it, and stops", async () => {
    await write("001_a.sql", "create table a (id int);");
    await write("002_bad.sql", "create table half_done (id int); insert into missing_table values (1);");
    await write("003_c.sql", "create table c (id int);");
    await expect(applyMigrations(db, dir)).rejects.toThrow();
    expect(await tableExists("a")).toBe(true);
    expect(await tableExists("half_done")).toBe(false);
    expect(await tableExists("c")).toBe(false);
    const recorded = await db.query("select version from schema_migrations order by version");
    expect(recorded.rows.map((row) => row.version)).toEqual(["001_a"]);
  });

  it("applies a corrected migration on the next run", async () => {
    await write("001_bad.sql", "create table t (id int); select * from nope;");
    await expect(applyMigrations(db, dir)).rejects.toThrow();
    await write("001_bad.sql", "create table t (id int);");
    const result = await applyMigrations(db, dir);
    expect(result.applied).toEqual(["001_bad"]);
    expect(await tableExists("t")).toBe(true);
  });

  it("rejects a badly named file before applying anything", async () => {
    await write("001_a.sql", "create table a (id int);");
    await write("bad.sql", "create table z (id int);");
    await expect(applyMigrations(db, dir)).rejects.toThrow();
    expect(await tableExists("a")).toBe(false);
  });

  it("works with a plain query-only client (no exec/transaction)", async () => {
    await write("001_a.sql", "create table a (id int);");
    const calls = [];
    const plain = {
      async query(sql, params) {
        calls.push(sql.trim().split(/\s+/)[0].toLowerCase());
        return db.query(sql, params);
      },
    };
    await applyMigrations(plain, dir);
    expect(await tableExists("a")).toBe(true);
    expect(calls).toContain("begin");
    expect(calls).toContain("commit");
  });
});
