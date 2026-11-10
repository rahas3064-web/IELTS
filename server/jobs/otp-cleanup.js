// Hourly housekeeping (spec 4.2 'otp-cleanup'): drop OTP rows nobody can need any more.
// Codes live 2 minutes, so anything expired or consumed more than a day ago is dead
// weight; recent rows stay because the resend limit and the "recent OTP" check read them.
import { resolveNow } from "./util.js";

const RETENTION_MS = 24 * 60 * 60 * 1000;

/**
 * @param {{db: {query: Function}, now?: Date|(() => Date)}} deps
 * @returns {Promise<{codes: number, locks: number}>}
 */
export async function runOtpCleanup({ db, now = () => new Date() }) {
  const at = resolveNow(now);
  const cutoff = new Date(at.getTime() - RETENTION_MS);
  const codes = await db.query(
    `delete from otp_codes
     where created_at < $1 and (expires_at < $2 or consumed_at is not null)
     returning id`,
    [cutoff, at],
  );
  const locks = await db.query("delete from otp_locks where locked_until < $1 returning phone", [at]);
  return { codes: codes.rows.length, locks: locks.rows.length };
}
