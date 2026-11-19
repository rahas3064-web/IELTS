/** Published AvalAI rates used only to turn token counts into rial. Not a measured invoice. */
const TOKEN_USD = Object.freeze({
  "gpt-audio-mini": { in: 10, out: 2.4 },
  "gpt-audio-mini-2025-10-06": { in: 10, out: 2.4 },
  "gpt-audio": { in: 32, out: 10 },
  "gpt-audio-1.5": { in: 32, out: 10 },
  "gemini-2.5-flash-lite": { in: 0.1, out: 0.4 },
  "gpt-4o-mini-transcribe": { in: 3, out: 5 },
  "gpt-4o-transcribe": { in: 6, out: 10 },
});

const SECOND_USD = Object.freeze({
  "gpt-transcribe": 0.00005,
  "gpt-4o-mini-transcribe": 0.00005,
  "gpt-4o-transcribe": 0.0001,
  "groq.whisper-large-v3": 0.000031,
});

export function usageCounts(body) {
  const usage = body?.usage ?? {};
  const tokensIn = Number(usage.prompt_tokens ?? usage.input_tokens ?? 0);
  const tokensOut = Number(usage.completion_tokens ?? usage.output_tokens ?? 0);
  const seconds = Number(usage.seconds ?? usage.input_audio_seconds ?? 0);
  return {
    tokensIn: Number.isFinite(tokensIn) ? Math.max(0, Math.round(tokensIn)) : 0,
    tokensOut: Number.isFinite(tokensOut) ? Math.max(0, Math.round(tokensOut)) : 0,
    seconds: Number.isFinite(seconds) ? Math.max(0, seconds) : 0,
  };
}

/**
 * Rial for one model call. Known audio and transcription models use the USD
 * rate when `usdToRial` is set. A per-second rate wins when the response
 * reports seconds. Otherwise text calls use the per-1k rial env rates.
 * @returns {number}
 */
export function costRial({ model, tokensIn = 0, tokensOut = 0, seconds = 0, usdToRial, inputPer1k = 0, outputPer1k = 0 }) {
  const rate = Number(usdToRial);
  const perSecond = SECOND_USD[model];
  const tokens = TOKEN_USD[model];
  if (Number.isFinite(rate) && rate > 0 && (perSecond || tokens)) {
    const usd = perSecond && seconds > 0
      ? seconds * perSecond
      : ((tokensIn * (tokens?.in ?? 0)) + (tokensOut * (tokens?.out ?? 0))) / 1_000_000;
    return Math.max(0, Math.round(usd * rate));
  }
  const inRial = Number(inputPer1k) || 0;
  const outRial = Number(outputPer1k) || 0;
  return Math.max(0, Math.round((tokensIn / 1000) * inRial + (tokensOut / 1000) * outRial));
}
