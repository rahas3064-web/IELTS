import { describe, expect, it } from "vitest";
import { elapsedSec, pickRecordingMime, RECORDING_BITS_PER_SECOND, recordingLimitSec, UPLOAD_AUDIO_TYPES } from "./recorder-rules";

describe("recording limits", () => {
  it("caps part 1 and part 3 at 60 seconds and part 2 at 120", () => {
    expect(recordingLimitSec(1)).toBe(60);
    expect(recordingLimitSec(3)).toBe(60);
    expect(recordingLimitSec(2)).toBe(120);
  });

  it("counts whole seconds and stops on the cap", () => {
    expect(elapsedSec(1_000, 1_400, 60)).toBe(0);
    expect(elapsedSec(1_000, 4_200, 60)).toBe(3);
    expect(elapsedSec(0, 121_000, 120)).toBe(120);
  });
});

describe("recording mime", () => {
  it("prefers webm opus, then plain webm, then mp4", () => {
    expect(pickRecordingMime(() => false)).toBeNull();
    expect(pickRecordingMime((type) => type === "audio/mp4")).toBe("audio/mp4");
    expect(pickRecordingMime((type) => type.startsWith("audio/webm"))).toBe("audio/webm;codecs=opus");
  });

  it("names webm and mp4 as the types the next upload must accept", () => {
    expect([...UPLOAD_AUDIO_TYPES]).toEqual(["audio/webm", "audio/mp4"]);
    expect(RECORDING_BITS_PER_SECOND).toBe(48_000);
  });
});
