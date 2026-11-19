import { describe, expect, it } from "vitest";
import { costRial, usageCounts } from "./speaking-cost.js";

describe("speaking cost", () => {
  it("reads token counts from either OpenAI usage shape", () => {
    expect(usageCounts({ usage: { prompt_tokens: 12, completion_tokens: 3 } })).toEqual({
      tokensIn: 12, tokensOut: 3, seconds: 0,
    });
    expect(usageCounts({ usage: { input_tokens: 8, output_tokens: 2, seconds: 1.5 } })).toMatchObject({
      tokensIn: 8, tokensOut: 2, seconds: 1.5,
    });
  });

  it("prices pronunciation from the published audio rate and a rial exchange rate", () => {
    const rial = costRial({
      model: "gpt-audio-mini",
      tokensIn: 1_000_000,
      tokensOut: 1_000_000,
      usdToRial: 1_000_000,
    });
    expect(rial).toBe(12_400_000);
  });

  it("prices the selected speaking models from the published rates", () => {
    expect(costRial({
      model: "gemini-2.5-flash-lite",
      tokensIn: 1_000_000,
      tokensOut: 1_000_000,
      usdToRial: 1_000_000,
    })).toBe(500_000);
    expect(costRial({
      model: "gpt-4o-mini-transcribe",
      tokensIn: 20,
      tokensOut: 9,
      usdToRial: 1_000_000,
    })).toBe(105);
  });

  it("uses the text rial rates when no exchange rate is set", () => {
    expect(costRial({ model: "gpt-4o-mini", tokensIn: 2000, tokensOut: 500, inputPer1k: 1000, outputPer1k: 2000 })).toBe(3000);
    expect(costRial({ model: "gpt-audio-mini", tokensIn: 100, tokensOut: 10 })).toBe(0);
  });
});
