import { describe, expect, it } from "vitest";
import { formatModelReport, modelReport, readEnvText } from "./avalai-models.mjs";

const secret = "sk-test-key-must-not-print";

describe("avalai model report", () => {
  it("says whether the two speaking models are listed and prints nothing else", () => {
    const report = formatModelReport(modelReport({
      data: [
        { id: "gpt-transcribe" },
        { id: secret },
        { id: "scribe_v2" },
      ],
    }));
    expect(report).toBe("gpt-transcribe: present\ngpt-audio-mini: missing");
    expect(report).not.toContain(secret);
    expect(report).not.toContain("scribe_v2");
  });

  it("reads the key name from an env file without returning other secrets in the report", () => {
    const env = readEnvText(`AVALAI_API_KEY=${secret}\nAVALAI_BASE_URL=https://api.avalai.ir/v1\n`);
    expect(env.AVALAI_API_KEY).toBe(secret);
    expect(env.AVALAI_BASE_URL).toBe("https://api.avalai.ir/v1");
    const report = formatModelReport(modelReport({ data: [{ id: "gpt-audio-mini" }] }));
    expect(report).not.toContain(secret);
  });
});
