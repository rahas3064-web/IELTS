import fs from "node:fs/promises";
import path from "node:path";
import { countWords, isAvalaiConnectionError } from "./avalai.js";
import { commitQuota, recordModelCall, releaseQuota, reserveQuota } from "./services/ai-quota.js";
import { costRial } from "./speaking-cost.js";

export const MAX_PRONUNCIATION_TRIES = 4;
export const SPEAKING_AUDIO_PROMPT = "speaking-audio-v1";
export const PRONUNCIATION_MISSING = "تلفظ سنجیده نشد";
const OFFICIAL = "AI estimate, not official";

function rates(env) {
  return {
    usdToRial: env.AI_USD_TO_RIAL,
    inputPer1k: env.AI_COST_PER_1K_INPUT_RIAL,
    outputPer1k: env.AI_COST_PER_1K_OUTPUT_RIAL,
  };
}

function taskPrompt(stem) {
  if (stem && typeof stem === "object") return String(stem.prompt ?? stem.text ?? "");
  return String(stem ?? "");
}

export function meanBand(values) {
  const bands = values.map(Number).filter((value) => Number.isFinite(value));
  if (!bands.length) return null;
  return Math.round((bands.reduce((sum, value) => sum + value, 0) / bands.length) * 2) / 2;
}

function publicBody(row, { status, criteria, band, tries, transcript }) {
  const used = tries ?? Number(row.pronunciation_tries ?? 0);
  return {
    status,
    band: status === "scored" ? band : null,
    criteria,
    transcript: transcript ?? row.transcript ?? null,
    pronunciationPending: status === "partial",
    label: status === "partial" ? PRONUNCIATION_MISSING : status === "scored" ? OFFICIAL : null,
    pronunciationRetriesLeft: Math.max(0, MAX_PRONUNCIATION_TRIES - used),
  };
}

/**
 * Score one stored recording. A partial row retries pronunciation only and
 * does not reserve another speaking_scoring unit.
 */
export async function scoreStoredRecording({
  db, now, userId, planKey, row, filePath, env = process.env,
  transcribe, scoreText, scoreAudio, toWav,
}) {
  if (row.score_state === "scored") {
    return { http: 200, body: publicBody(row, {
      status: "scored", criteria: row.criteria, band: Number(row.band), transcript: row.transcript,
    }) };
  }
  const triesSoFar = Number(row.pronunciation_tries ?? 0);
  if (row.score_state === "partial" && triesSoFar >= MAX_PRONUNCIATION_TRIES) {
    return { http: 409, body: null };
  }

  const partial = row.score_state === "partial" && row.criteria;
  let reservation = null;
  if (!partial) {
    reservation = await reserveQuota(db, {
      userId,
      planKey,
      quotaKey: "speaking_scoring",
      operation: "speaking_scoring",
      now: now(),
    });
  }

  try {
    let transcript = row.transcript ? String(row.transcript) : "";
    let criteria = row.criteria ?? null;
    let injection = Boolean(row.injection);
    let textUsage = { tokensIn: 0, tokensOut: 0, seconds: 0 };
    let textModel = null;
    const prompt = taskPrompt(row.stem);

    if (!transcript.trim()) {
      const audio = await fs.readFile(filePath);
      const heard = await transcribe({
        bytes: audio,
        mime: row.mime,
        filename: path.basename(filePath),
        env,
      });
      await recordModelCall(db, {
        userId,
        operation: "speech_to_text",
        tokensIn: heard.usage?.tokensIn ?? 0,
        tokensOut: heard.usage?.tokensOut ?? 0,
        costRial: costRial({ model: heard.model, ...heard.usage, ...rates(env) }),
        model: heard.model,
        promptVersion: SPEAKING_AUDIO_PROMPT,
        ref: `${row.id}:stt:${triesSoFar + 1}`,
        now: now(),
      });
      transcript = String(heard.text ?? "").trim();
      if (!transcript) {
        if (reservation) await releaseQuota(db, reservation.eventId, now());
        return { http: 200, body: publicBody(row, { status: "scoring_failed", criteria: null, band: null, tries: triesSoFar, transcript: null }) };
      }
      const words = countWords(transcript);
      const duration = Number(row.duration_sec);
      const wpm = duration > 0 ? Math.round((words / duration) * 600) / 10 : null;
      await db.query(
        "update speaking_recordings set transcript = $2, wpm = $3 where id = $1",
        [row.id, transcript, wpm],
      );
    }

    if (!criteria) {
      const scored = await scoreText({ skill: "speaking", prompt, answer: transcript, speakingMode: "typed", env });
      textUsage = scored?.usage ?? textUsage;
      textModel = scored?.model ?? null;
      if (!scored?.criteria) {
        if (reservation) await releaseQuota(db, reservation.eventId, now());
        return { http: 200, body: publicBody(row, { status: "scoring_failed", criteria: null, band: null, tries: triesSoFar, transcript }) };
      }
      criteria = scored.criteria;
      injection = scored.injection === true;
      const textCost = costRial({ model: textModel, ...textUsage, ...rates(env) });
      if (reservation) {
        await commitQuota(db, reservation.eventId, {
          tokensIn: textUsage.tokensIn,
          tokensOut: textUsage.tokensOut,
          costRial: textCost,
          model: textModel,
          promptVersion: SPEAKING_AUDIO_PROMPT,
          ref: row.id,
          now: now(),
        });
        reservation = null;
      }
      await db.query(
        `update speaking_recordings
         set score_state = 'partial', criteria = $2::jsonb, band = null, injection = $3
         where id = $1`,
        [row.id, JSON.stringify(criteria), injection],
      );
    }

    const tries = triesSoFar + 1;
    let wav = null;
    let audioScore = { pr: null, usage: { tokensIn: 0, tokensOut: 0, seconds: 0 }, model: env.AVALAI_SPEAKING_AUDIO_MODEL || "gemini-2.5-flash-lite" };
    try {
      wav = await toWav(filePath);
      const wavBytes = await fs.readFile(wav.path);
      audioScore = await scoreAudio({ wavBytes, prompt, env });
    } catch {
      audioScore = { ...audioScore, pr: null };
    } finally {
      if (wav?.cleanup) await wav.cleanup();
    }
    await recordModelCall(db, {
      userId,
      operation: "speaking_scoring",
      tokensIn: audioScore.usage?.tokensIn ?? 0,
      tokensOut: audioScore.usage?.tokensOut ?? 0,
      costRial: costRial({ model: audioScore.model, ...audioScore.usage, ...rates(env) }),
      model: audioScore.model,
      promptVersion: SPEAKING_AUDIO_PROMPT,
      ref: `${row.id}:pr:${tries}`,
      now: now(),
    });
    await db.query("update speaking_recordings set pronunciation_tries = $2 where id = $1", [row.id, tries]);

    const pr = audioScore.pr;
    if (!pr) {
      return { http: 200, body: publicBody(row, { status: "partial", criteria, band: null, tries, transcript }) };
    }
    let pronunciation = { band: pr.band, reasonFa: pr.reasonFa };
    if (injection && pronunciation.band > 4) {
      pronunciation = {
        band: 4,
        reasonFa: `${pronunciation.reasonFa} این پاسخ دستور نمره‌دهی را عوض کرد، پس تلفظ از ۴ بالاتر نرفت.`.slice(0, 240),
      };
    }
    const band = meanBand([criteria.FC?.band, criteria.LR?.band, criteria.GRA?.band, pronunciation.band]);
    const merged = { ...criteria, PR: pronunciation };
    await db.query(
      `update speaking_recordings
       set score_state = 'scored', criteria = $2::jsonb, band = $3
       where id = $1`,
      [row.id, JSON.stringify(merged), band],
    );
    return { http: 200, body: publicBody(row, { status: "scored", criteria: merged, band, tries, transcript }) };
  } catch (error) {
    if (reservation) await releaseQuota(db, reservation.eventId, now());
    if (isAvalaiConnectionError(error)) {
      return {
        http: 200,
        body: publicBody(row, {
          status: "scoring_failed",
          criteria: null,
          band: null,
          tries: Number(row.pronunciation_tries ?? 0),
          transcript: row.transcript ?? null,
        }),
      };
    }
    throw error;
  }
}
