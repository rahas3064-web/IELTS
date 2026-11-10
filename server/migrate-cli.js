/* global console */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runCli } from "./cli.js";
import { applyMigrations } from "./migrate.js";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "db", "migrations");

await runCli("db:migrate", async (db) => {
  const { applied, versions } = await applyMigrations(db, dir);
  console.log(applied.length > 0 ? `applied: ${applied.join(", ")}` : "no pending migrations");
  console.log(`schema version: ${versions.at(-1) ?? "(none)"}`);
});
