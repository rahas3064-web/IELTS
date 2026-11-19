import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

const require = createRequire(import.meta.url);

/** ffmpeg-static ships a binary per OS, so the same dependency works on Railway's Linux image. */
export function ffmpegBinary() {
  const bin = require("ffmpeg-static");
  if (typeof bin !== "string" || bin === "") {
    const error = new Error("ffmpeg_missing");
    error.code = "ffmpeg_missing";
    throw error;
  }
  return bin;
}

export function wavArgs(input, output) {
  return ["-y", "-i", input, "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", output];
}

/**
 * Convert a stored webm or mp4 into 16 kHz mono wav for the pronunciation model.
 * The stored file is left as the browser recorded it.
 * @param {string} input
 * @param {{spawnImpl?: typeof spawn, binary?: string}} [options]
 */
export async function convertToWav(input, { spawnImpl = spawn, binary = ffmpegBinary() } = {}) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "bandora-wav-"));
  const output = path.join(dir, "answer.wav");
  const code = await new Promise((resolve, reject) => {
    const child = spawnImpl(binary, wavArgs(input, output), { stdio: "ignore" });
    child.on("error", reject);
    child.on("close", resolve);
  });
  if (code !== 0) {
    await rm(dir, { recursive: true, force: true });
    const error = new Error("ffmpeg_failed");
    error.code = "ffmpeg_failed";
    throw error;
  }
  return { path: output, cleanup: () => rm(dir, { recursive: true, force: true }) };
}
