import { randomUUID } from "node:crypto";

export const MAX_SPEAKING_BYTES = 3 * 1024 * 1024;
export const VOLUME_FREE_FLOOR_BYTES = 64 * 1024 * 1024;
export const MAX_DURATION_SEC = 125;

export function storedMime(contentType) {
  const mime = String(contentType || "").split(";")[0].trim().toLowerCase();
  if (mime === "audio/webm" || mime === "audio/mp4") return mime;
  return null;
}

export function newSpeakingKey(userId, mime) {
  const ext = mime === "audio/mp4" ? "mp4" : "webm";
  return `speaking/${userId}/${randomUUID()}.${ext}`;
}

export function freeBytesFromStat(stat) {
  const available = Number(stat?.bavail);
  const block = Number(stat?.bsize);
  if (!Number.isFinite(available) || !Number.isFinite(block) || available < 0 || block <= 0) return null;
  return available * block;
}

export function uploadBlocked(freeBytes, incomingBytes) {
  if (freeBytes == null || incomingBytes > freeBytes) return true;
  return freeBytes < VOLUME_FREE_FLOOR_BYTES;
}

export function parseDurationSec(raw) {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0 || value > MAX_DURATION_SEC) return null;
  return Math.round(value * 100) / 100;
}
