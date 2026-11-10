/* global console */
import { runCli } from "./cli.js";
import { runSeed } from "./seed.js";

await runCli("db:seed", async (db, env) => {
  const result = await runSeed(db, { env });
  console.log(`seeded reference data: ${result.systemSettings} new system_settings row(s)`);
});
