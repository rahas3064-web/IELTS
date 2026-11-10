// One-time super-admin bootstrap (spec S1, steps 1-5). No HTTP route calls this;
// it is reachable only through the operator CLI (server/admin-bootstrap.js).
import { audit } from "../core/audit.js";
import { maskPhone, normalizePhone } from "../core/phone.js";

const ADVISORY_LOCK_KEY = "bandora:admin_bootstrap";
const REFUSAL_TEXT = Object.freeze({
  super_admin_exists: "a super_admin already exists; bootstrap is refused",
  invalid_phone: "the phone number is not a valid Iranian mobile number",
  user_not_found: "no account exists for this phone number; sign up in the app first",
  phone_unverified: "this account's phone number is not verified",
  user_not_active: "this account is not active",
  aborted: "aborted: confirmation was not exactly 'yes'",
});

export class BootstrapRefusal extends Error {
  /** @param {keyof typeof REFUSAL_TEXT} reason */
  constructor(reason) {
    super(REFUSAL_TEXT[reason]);
    this.name = "BootstrapRefusal";
    this.reason = reason;
  }
}

/**
 * Phone from `--phone <v>` / `--phone=<v>`, else ADMIN_BOOTSTRAP_PHONE (read when called).
 * @param {string[]} argv arguments after the script name
 * @param {Record<string, string|undefined>} env
 * @returns {{phone: string}}
 */
export function parseBootstrapArgs(argv, env) {
  let phone;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--phone") {
      phone = argv[(i += 1)];
    } else if (arg.startsWith("--phone=")) {
      phone = arg.slice("--phone=".length);
    } else {
      throw new Error(`unknown argument "${arg}"; usage: npm run admin:bootstrap -- --phone 09xxxxxxxxx`);
    }
    if (!phone) throw new Error("--phone needs a value; usage: npm run admin:bootstrap -- --phone 09xxxxxxxxx");
  }
  phone ??= (env.ADMIN_BOOTSTRAP_PHONE ?? "").trim();
  if (!phone) throw new Error("pass --phone 09xxxxxxxxx or set ADMIN_BOOTSTRAP_PHONE");
  return { phone };
}

/**
 * @param {import("../db.js").Database} db
 * @param {{
 *   phone: unknown,
 *   confirm: (summary: {maskedPhone: string, name: string}) => Promise<unknown>,
 *   now?: () => Date,
 * }} input `confirm` returns what the operator typed; only the exact string 'yes' proceeds
 * @returns {Promise<{ok: true, userId: string, maskedPhone: string}>}
 * @throws {BootstrapRefusal}
 */
export async function bootstrapSuperAdmin(db, { phone, confirm, now = () => new Date() }) {
  const normalized = normalizePhone(phone);
  const masked = normalized ? maskPhone(normalized) : null;

  async function refuse(reason, targetId = null) {
    await audit(db, {
      actorRole: "cli",
      action: "admin_bootstrap_refused",
      targetType: "user",
      targetId,
      meta: { reason, ...(normalized ? { phone: normalized } : {}) },
    });
    throw new BootstrapRefusal(reason);
  }

  const existing = await db.query("select 1 from users where role = 'super_admin' limit 1");
  if (existing.rows.length > 0) await refuse("super_admin_exists");
  if (!normalized) await refuse("invalid_phone");

  const found = await db.query(
    "select id, first_name, last_name, status, phone_verified_at from users where phone = $1",
    [normalized],
  );
  const user = found.rows[0];
  if (!user) await refuse("user_not_found");
  if (!user.phone_verified_at) await refuse("phone_unverified", user.id);
  if (user.status !== "active") await refuse("user_not_active", user.id);

  const answer = await confirm({ maskedPhone: masked, name: `${user.first_name} ${user.last_name}` });
  if (answer !== "yes") await refuse("aborted", user.id);

  const at = now();
  await db.transaction(async (tx) => {
    // Serialises racing bootstraps; the second one re-checks and finds the admin.
    await tx.query("select pg_advisory_xact_lock(hashtext($1))", [ADVISORY_LOCK_KEY]);
    const raced = await tx.query("select 1 from users where role = 'super_admin' limit 1");
    if (raced.rows.length > 0) throw new BootstrapRefusal("super_admin_exists");
    await tx.query("update users set role = 'super_admin' where id = $1", [user.id]);
    await tx.query(
      "update sessions set revoked_at = $2, revoked_reason = 'admin_force' where user_id = $1 and revoked_at is null",
      [user.id, at],
    );
    await audit(tx, {
      actorRole: "cli",
      action: "admin_bootstrap",
      targetType: "user",
      targetId: user.id,
      before: { role: "learner" },
      after: { role: "super_admin" },
      meta: { phone: normalized },
    });
  }).catch(async (error) => {
    if (error instanceof BootstrapRefusal) await refuse(error.reason, user.id);
    throw error;
  });
  return { ok: true, userId: user.id, maskedPhone: masked };
}
