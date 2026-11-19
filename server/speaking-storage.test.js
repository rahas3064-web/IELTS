import { describe, expect, it } from "vitest";
import { speakingAudioPath } from "./jobs/speaking-audio-cleanup.js";
import {
  MAX_SPEAKING_BYTES,
  VOLUME_FREE_FLOOR_BYTES,
  freeBytesFromStat,
  newSpeakingKey,
  storedMime,
  uploadBlocked,
} from "./speaking-storage.js";

const userId = "11111111-1111-4111-8111-111111111111";

describe("speaking storage", () => {
  it("caps a recording at 3 MB and keeps 64 MB free on the volume", () => {
    expect(MAX_SPEAKING_BYTES).toBe(3 * 1024 * 1024);
    expect(VOLUME_FREE_FLOOR_BYTES).toBe(64 * 1024 * 1024);
    expect(uploadBlocked(VOLUME_FREE_FLOOR_BYTES - 1, 1000)).toBe(true);
    expect(uploadBlocked(VOLUME_FREE_FLOOR_BYTES + MAX_SPEAKING_BYTES, 1000)).toBe(false);
    expect(freeBytesFromStat({ bavail: 2, bsize: 4096 })).toBe(8192);
    expect(freeBytesFromStat({ bavail: -1, bsize: 4096 })).toBeNull();
  });

  it("accepts webm and mp4 and builds a key inside speaking/", () => {
    expect(storedMime("audio/webm;codecs=opus")).toBe("audio/webm");
    expect(storedMime("audio/mp4")).toBe("audio/mp4");
    expect(storedMime("audio/wav")).toBeNull();
    const key = newSpeakingKey(userId, "audio/mp4");
    expect(key.startsWith(`speaking/${userId}/`)).toBe(true);
    expect(key.endsWith(".mp4")).toBe(true);
    const full = speakingAudioPath("C:\\media", key);
    expect(full.replaceAll("\\", "/")).toBe(`C:/media/${key}`);
  });

  it("refuses a key that leaves the media directory", () => {
    expect(speakingAudioPath("C:\\media", "../outside.webm")).toBeNull();
    expect(speakingAudioPath("C:\\media", "speaking/../outside.webm")).toBeNull();
  });
});
