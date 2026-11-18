// Removes one learner account. The typed word is checked by the route.
// Financial rows stay, without the name or the phone.
import { createHmac } from "node:crypto";
import fs from "node:fs/promises";
import { audit } from "../core/audit.js";
import { speakingAudioPath } from "../jobs/speaking-audio-cleanup.js";

export const DELETE_CONFIRMATION = "حذف";

/**
 * @param {{
 *   db: {query: Function, transaction: Function},
 *   sessions: {revokeAll: Function},
 *   user: {id: string, phone: string, role?: string},
 *   secret: string,
 *   mediaDir?: string,
 *   now?: () => Date,
 *   ipHash?: string|null,
 *   unlink?: (path: string) => Promise<void>,
 * }} deps
 */
export async function deleteOwnAccount({
  db, sessions, user, secret, mediaDir, now = () => new Date(), ipHash = null, unlink = fs.unlink,
}) {
  const found = await db.query(
    "select storage_key from speaking_recordings where user_id = $1",
    [user.id],
  );
  for (const row of found.rows) {
    const full = speakingAudioPath(mediaDir, row.storage_key);
    if (!full) continue;
    try {
      await unlink(full);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }

  const phoneHash = createHmac("sha256", secret).update(user.phone).digest("hex");
  await db.transaction(async (tx) => {
    await tx.query(
      "insert into account_deletions (user_id, phone_hash, deleted_at) values ($1, $2, $3)",
      [user.id, phoneHash, now()],
    );
    await tx.query(
      "update payment_attempts set payload = 'deleted:' || id::text, raw = null where user_id = $1",
      [user.id],
    );
    await tx.query("delete from otp_codes where phone = $1", [user.phone]);
    await tx.query("delete from otp_locks where phone = $1", [user.phone]);
    await sessions.revokeAll(tx, user.id, "deleted");
    await audit(tx, {
      actorId: user.id,
      actorRole: user.role ?? null,
      action: "account_deleted",
      targetType: "user",
      targetId: user.id,
      ipHash,
      meta: { recordings: found.rows.length },
    });
    await tx.query("delete from users where id = $1", [user.id]);
  });
}
