/* global console, process */
import { loadDotEnv } from "./env-file.js";
import { runCli } from "./cli.js";
import { isProduction, runDevSeed } from "./seed-dev.js";

// Check before touching the database: production must never even connect.
loadDotEnv();
if (isProduction(process.env)) {
  console.error("[db:seed:dev] Refusing to run: NODE_ENV is production. Dev fixtures are never seeded in production.");
  process.exitCode = 1;
} else {
  await runCli("db:seed:dev", async (db, env) => {
    const result = await runDevSeed(db, { env });
    console.log(`seeded dev fixtures: ${result.fixtures}`);
  });
}
