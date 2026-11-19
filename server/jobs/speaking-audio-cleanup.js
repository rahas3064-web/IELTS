// Daily housekeeping: a learner's speaking recording is kept for 90 days, then
// the file and the row go. Exam audio in media_assets is not touched.
import fs from "node:fs/promises";
import path from "node:path";
import { resolveNow } from "./util.js";

export const SPEAKING_AUDIO_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

/** A file inside mediaDir, or null when the key would leave that directory. */
export function speakingAudioPath(mediaDir, storageKey) {
  if (typeof mediaDir !== "string" || mediaDir === "") return null;
  if (typeof storageKey !== "string" || storageKey.includes("\0") || storageKey.includes("\\")) return null;
  const legacy = /^[A-Za-z0-9._-]+$/;
  const nested = /^speaking\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(webm|mp4)$/i;
  if (!legacy.test(storageKey) && !nested.test(storageKey)) return null;
  const root = path.resolve(mediaDir);
  const full = path.resolve(root, ...storageKey.split("/"));
  const rel = path.relative(root, full);
  if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
  return full;
}

/**
 * @param {{db: {query: Function}, now?: Date|(() => Date), mediaDir?: string, unlink?: (path: string) => Promise<void>}} deps
 * @returns {Promise<{recordings: number, files: number}>}
 */
export async function runSpeakingAudioCleanup({ db, now = () => new Date(), mediaDir, unlink = fs.unlink }) {
  const cutoff = new Date(resolveNow(now).getTime() - SPEAKING_AUDIO_RETENTION_MS);
  const found = await db.query(
    "select id, storage_key from speaking_recordings where created_at <= $1",
    [cutoff],
  );
  const removed = [];
  let files = 0;
  for (const row of found.rows) {
    const full = speakingAudioPath(mediaDir, row.storage_key);
    if (full) {
      try {
        await unlink(full);
        files += 1;
      } catch (error) {
        if (error?.code !== "ENOENT") continue;
      }
    }
    removed.push(row.id);
  }
  if (removed.length > 0) {
    await db.query("delete from speaking_recordings where id = any($1::uuid[])", [removed]);
  }
  return { recordings: removed.length, files };
}
