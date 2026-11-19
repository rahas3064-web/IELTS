import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { convertToWav, ffmpegBinary, wavArgs } from "./speaking-wav.js";

describe("speaking wav conversion", () => {
  it("asks ffmpeg for 16 kHz mono pcm", () => {
    expect(wavArgs("in.webm", "out.wav")).toEqual(["-y", "-i", "in.webm", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", "out.wav"]);
  });

  it("uses the packaged binary and removes the temp file when conversion fails", async () => {
    await expect(convertToWav("in.webm", {
      binary: "ffmpeg-test",
      spawnImpl: () => {
        const handlers = {};
        return {
          on(event, fn) {
            handlers[event] = fn;
            if (event === "close") fn(1);
            return this;
          },
        };
      },
    })).rejects.toMatchObject({ code: "ffmpeg_failed" });
  });

  it("converts a short wav with the packaged ffmpeg when that binary is installed", async () => {
    let binary;
    try {
      binary = ffmpegBinary();
    } catch {
      return;
    }
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "bandora-wav-src-"));
    const input = path.join(dir, "silence.wav");
    const data = Buffer.alloc(3200);
    const header = Buffer.alloc(44);
    header.write("RIFF", 0);
    header.writeUInt32LE(36 + data.length, 4);
    header.write("WAVE", 8);
    header.write("fmt ", 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(1, 22);
    header.writeUInt32LE(16000, 24);
    header.writeUInt32LE(32000, 28);
    header.writeUInt16LE(2, 32);
    header.writeUInt16LE(16, 34);
    header.write("data", 36);
    header.writeUInt32LE(data.length, 40);
    await fs.writeFile(input, Buffer.concat([header, data]));
    const converted = await convertToWav(input, { binary });
    const out = await fs.readFile(converted.path);
    expect(out.subarray(0, 4).toString()).toBe("RIFF");
    await converted.cleanup();
    await fs.rm(dir, { recursive: true, force: true });
  });
});
