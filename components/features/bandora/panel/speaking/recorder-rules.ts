export type SpeakingPart = 1 | 2 | 3;

/** Compressed types the next upload step must accept. Safari records mp4. */
export const UPLOAD_AUDIO_TYPES = ["audio/webm", "audio/mp4"] as const;

const MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/aac"] as const;

export function recordingLimitSec(part: SpeakingPart): number {
  return part === 2 ? 120 : 60;
}

export function elapsedSec(startedAtMs: number, nowMs: number, limitSec: number): number {
  const seconds = Math.floor((nowMs - startedAtMs) / 1000);
  return Math.min(limitSec, Math.max(0, seconds));
}

export function pickRecordingMime(isSupported: (mime: string) => boolean): string | null {
  return MIME_CANDIDATES.find((mime) => isSupported(mime)) ?? null;
}
