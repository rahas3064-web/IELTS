// Checks that the configured Speaking models accept a real request on their
// endpoint. Being present in GET /models is not enough.
// The API key stays in .env and is never written to stdout or stderr.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

export const DEFAULT_STT_MODEL = "gpt-4o-mini-transcribe";
export const DEFAULT_AUDIO_MODEL = "gemini-2.5-flash-lite";

const require = createRequire(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "package.json"));

export function readEnvText(text) {
  const values = {};
  for (const line of String(text).split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const name = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[name] = value;
  }
  return values;
}

export function speakingModelTargets(env = {}) {
  return {
    stt: env.AVALAI_STT_MODEL || DEFAULT_STT_MODEL,
    audio: env.AVALAI_SPEAKING_AUDIO_MODEL || DEFAULT_AUDIO_MODEL,
  };
}

export function classifyProbe(status) {
  return { ok: Number(status) === 200, status: Number(status) || 0 };
}

export function formatProbeReport({ sttModel, audioModel, webm, mp4, audio }) {
  const line = (label, model, probe) => `${label} ${model}: ${probe.ok ? "works" : "failed"} ${probe.status}`;
  return [
    line("transcription-webm", sttModel, webm),
    line("transcription-mp4", sttModel, mp4),
    line("pronunciation", audioModel, audio),
  ].join("\n");
}

function silenceWav() {
  const samples = 16000;
  const data = Buffer.alloc(samples * 2);
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
  return Buffer.concat([header, data]);
}

function encodeClip(ffmpeg, wavPath, dir) {
  const webm = path.join(dir, "clip.webm");
  const mp4 = path.join(dir, "clip.mp4");
  const webmRun = spawnSync(ffmpeg, ["-y", "-i", wavPath, "-c:a", "libopus", "-b:a", "48k", webm], { stdio: "ignore" });
  const mp4Run = spawnSync(ffmpeg, ["-y", "-i", wavPath, "-c:a", "aac", "-b:a", "48k", mp4], { stdio: "ignore" });
  if (webmRun.status !== 0 || mp4Run.status !== 0) return null;
  return { webm, mp4, wav: wavPath };
}

async function postJson(fetchImpl, url, key, body) {
  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(90000),
    });
    return classifyProbe(response.status);
  } catch {
    return classifyProbe(0);
  }
}

async function postTranscription(fetchImpl, url, key, model, file, mime) {
  const form = new FormData();
  form.append("file", new Blob([fs.readFileSync(file)], { type: mime }), path.basename(file));
  form.append("model", model);
  form.append("language", "en");
  form.append("response_format", "json");
  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: { authorization: `Bearer ${key}` },
      body: form,
      signal: AbortSignal.timeout(60000),
    });
    return classifyProbe(response.status);
  } catch {
    return classifyProbe(0);
  }
}

async function main() {
  const envPath = path.resolve(process.cwd(), ".env");
  let text = "";
  try {
    text = fs.readFileSync(envPath, "utf8");
  } catch {
    console.error("AVALAI_API_KEY: missing");
    process.exitCode = 1;
    return;
  }
  const env = readEnvText(text);
  const key = env.AVALAI_API_KEY;
  if (!key) {
    console.error("AVALAI_API_KEY: missing");
    process.exitCode = 1;
    return;
  }
  const ffmpeg = require("ffmpeg-static");
  if (typeof ffmpeg !== "string" || ffmpeg === "") {
    console.error("ffmpeg: missing");
    process.exitCode = 1;
    return;
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bandora-model-check-"));
  const wavPath = path.join(dir, "clip.wav");
  fs.writeFileSync(wavPath, silenceWav());
  const clips = encodeClip(ffmpeg, wavPath, dir);
  if (!clips) {
    console.error("ffmpeg: failed");
    process.exitCode = 1;
    return;
  }
  const base = (env.AVALAI_BASE_URL || "https://api.avalai.ir/v1").replace(/\/+$/, "");
  const targets = speakingModelTargets(env);
  const webm = await postTranscription(fetch, `${base}/audio/transcriptions`, key, targets.stt, clips.webm, "audio/webm");
  const mp4 = await postTranscription(fetch, `${base}/audio/transcriptions`, key, targets.stt, clips.mp4, "audio/mp4");
  const wav = fs.readFileSync(clips.wav).toString("base64");
  const audio = await postJson(fetch, `${base}/chat/completions`, key, {
    model: targets.audio,
    temperature: 0,
    modalities: ["text"],
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: "Reply with JSON only: {\"ok\":true}." },
      {
        role: "user",
        content: [
          { type: "text", text: "ping" },
          { type: "input_audio", input_audio: { data: wav, format: "wav" } },
        ],
      },
    ],
  });
  fs.rmSync(dir, { recursive: true, force: true });
  const report = formatProbeReport({ sttModel: targets.stt, audioModel: targets.audio, webm, mp4, audio });
  console.log(report);
  if (!webm.ok || !mp4.ok || !audio.ok) process.exitCode = 1;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) await main();
