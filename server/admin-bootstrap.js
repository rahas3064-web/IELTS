/* global console, process */
// Operator CLI: npm run admin:bootstrap -- --phone 09xxxxxxxxx
// (or ADMIN_BOOTSTRAP_PHONE in the environment). Runs through runCli, which applies
// the remote-database safety guard and never prints the connection URL.
import { createInterface } from "node:readline/promises";
import { bootstrapSuperAdmin, parseBootstrapArgs } from "./auth/admin-bootstrap-core.js";
import { runCli } from "./cli.js";

/** Ask on the terminal; resolves with the typed line minus its line ending. */
async function askOnTerminal({ maskedPhone, name }) {
  console.log(`About to make ${name} (${maskedPhone}) the super admin.`);
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question("Type yes to continue: ");
    return answer.replace(/[\r\n]+$/, "");
  } finally {
    rl.close();
  }
}

await runCli("admin:bootstrap", async (db, env) => {
  const { phone } = parseBootstrapArgs(process.argv.slice(2), env);
  const result = await bootstrapSuperAdmin(db, { phone, confirm: askOnTerminal });
  console.log(`done: ${result.maskedPhone} is now super_admin; its sessions were revoked.`);
});
