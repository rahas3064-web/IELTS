import { describe, expect, it } from "vitest";
import { classifyProbe, formatProbeReport, readEnvText, speakingModelTargets } from "./avalai-models.mjs";

const secret = "sk-test-key-must-not-print";

describe("avalai endpoint probe", () => {
  it("uses the env model names and otherwise the working defaults", () => {
    expect(speakingModelTargets({})).toEqual({
      stt: "gpt-4o-mini-transcribe",
      audio: "gemini-2.5-flash-lite",
    });
    expect(speakingModelTargets({
      AVALAI_STT_MODEL: "groq.whisper-large-v3",
      AVALAI_SPEAKING_AUDIO_MODEL: "gemini-2.5-flash",
      AVALAI_API_KEY: secret,
    })).toEqual({ stt: "groq.whisper-large-v3", audio: "gemini-2.5-flash" });
  });

  it("counts only HTTP 200 as a working endpoint", () => {
    expect(classifyProbe(200)).toEqual({ ok: true, status: 200 });
    expect(classifyProbe(404)).toEqual({ ok: false, status: 404 });
    expect(classifyProbe(0)).toEqual({ ok: false, status: 0 });
  });

  it("prints the endpoint result and not the key or the response body", () => {
    const report = formatProbeReport({
      sttModel: "gpt-4o-mini-transcribe",
      audioModel: "gemini-2.5-flash-lite",
      webm: classifyProbe(200),
      mp4: classifyProbe(400),
      audio: classifyProbe(200),
    });
    expect(report).toBe([
      "transcription-webm gpt-4o-mini-transcribe: works 200",
      "transcription-mp4 gpt-4o-mini-transcribe: failed 400",
      "pronunciation gemini-2.5-flash-lite: works 200",
    ].join("\n"));
    expect(report).not.toContain(secret);
  });

  it("reads the key name from an env file", () => {
    const env = readEnvText(`AVALAI_API_KEY=${secret}\nAVALAI_BASE_URL=https://api.avalai.ir/v1\n`);
    expect(env.AVALAI_API_KEY).toBe(secret);
    const report = formatProbeReport({
      sttModel: speakingModelTargets(env).stt,
      audioModel: speakingModelTargets(env).audio,
      webm: classifyProbe(200),
      mp4: classifyProbe(200),
      audio: classifyProbe(200),
    });
    expect(report).not.toContain(secret);
  });
});
