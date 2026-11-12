/* global fetch, process, AbortSignal */
const ENDPOINT = "https://api.avalai.ir/v1/chat/completions";

export function parseBand(text) {
  const match = String(text ?? "").match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const body = JSON.parse(match[0]);
    const number = Number(body.band);
    if (!Number.isFinite(number)) return null;
    return Math.round(Math.min(9, Math.max(0, number)) * 2) / 2;
  } catch {
    return null;
  }
}

const CRITERIA = Object.freeze({
  writing: ["TA", "CC", "LR", "GRA"],
  speaking: ["FC", "LR", "GRA", "PR"],
});

function roundBand(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.round(Math.min(9, Math.max(0, number)) * 2) / 2;
}

/** Four official criteria plus an overall band. Null when the model reply is unusable. */
export function parseCriteria(text, skill) {
  const match = String(text ?? "").match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const body = JSON.parse(match[0]);
    const keys = CRITERIA[skill];
    if (!keys) return null;
    const criteria = {};
    for (const key of keys) {
      const band = roundBand(body.criteria?.[key]?.band);
      const reason = String(body.criteria?.[key]?.reasonFa ?? "").trim();
      if (band == null || !reason) return null;
      criteria[key] = { band, reasonFa: reason.slice(0, 240) };
    }
    const band = roundBand(body.band);
    if (band == null) return null;
    return { band, criteria, label: "AI estimate, not official" };
  } catch {
    return null;
  }
}

/**
 * S7-style score. Throws missing_ai when no key is configured.
 * Returns null on an empty answer or a failed/unparseable model call. Never invents a band.
 */
export async function scoreCriteria({ skill, prompt, answer, fetchImpl = fetch, env = process.env }) {
  const key = env.AVALAI_API_KEY;
  if (!key) {
    const error = new Error("missing_ai");
    error.code = "missing_ai";
    throw error;
  }
  if (!String(answer ?? "").trim()) return null;
  const keys = CRITERIA[skill];
  if (!keys) return null;
  let response;
  try {
    response = await fetchImpl(env.AVALAI_BASE_URL ? `${env.AVALAI_BASE_URL.replace(/\/$/, "")}/chat/completions` : ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: env.AVALAI_SCORING_MODEL || env.AVALAI_MODEL || "gpt-4o-mini",
        temperature: 0,
        messages: [
          {
            role: "system",
            content: `Score this IELTS ${skill} answer. Reply with JSON only: {"band": number, "criteria": {${keys.map((k) => `"${k}": {"band": number, "reasonFa": "short Persian"}`).join(", ")}}}. Bands are 0 to 9 in steps of 0.5. This is an estimate, not an official IELTS score. Use only the answer text.`,
          },
          { role: "user", content: `Task:\n${String(prompt).slice(0, 2000)}\n\nAnswer:\n${String(answer).slice(0, 6000)}` },
        ],
      }),
      signal: AbortSignal.timeout(30000),
    });
  } catch {
    return null;
  }
  if (!response.ok) return null;
  const body = await response.json().catch(() => null);
  return parseCriteria(body?.choices?.[0]?.message?.content, skill);
}

export async function scoreResponse({ skill, tasks, fetchImpl = fetch, env = process.env }) {
  const key = env.AVALAI_API_KEY;
  if (!key) {
    const error = new Error("missing_ai");
    error.code = "missing_ai";
    throw error;
  }
  const filled = tasks.filter((task) => String(task.answer ?? "").trim());
  if (!filled.length) return 1;
  const response = await fetchImpl(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.AVALAI_MODEL || "gpt-4o-mini",
      temperature: 0,
      messages: [
        {
          role: "system",
          content: "Score the learner's IELTS response. Reply with JSON only: {\"band\": number}. Use 0 to 9 in steps of 0.5. Use only the response text.",
        },
        {
          role: "user",
          content: filled.map((task, index) => `Skill: ${skill}\nTask ${index + 1}: ${task.prompt}\nResponse:\n${String(task.answer).slice(0, 6000)}`).join("\n\n"),
        },
      ],
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) {
    const error = new Error("ai_failed");
    error.code = "ai_failed";
    throw error;
  }
  const body = await response.json();
  const band = parseBand(body?.choices?.[0]?.message?.content);
  if (band == null) {
    const error = new Error("ai_failed");
    error.code = "ai_failed";
    throw error;
  }
  return band;
}

export const ASSISTANT_PROMPT_VERSION = "assistant-v1";

export const TASK_LABELS = Object.freeze({
  task1_academic: "Academic Writing Task 1 (report on a chart, table, map or process; at least 150 words)",
  task1_general: "General Training Writing Task 1 (letter; at least 150 words)",
  task2: "Writing Task 2 (essay; at least 250 words)",
});
const MIN_WORDS = Object.freeze({ task1_academic: 150, task1_general: 150, task2: 250 });

/** Words in a text, counted the way IELTS candidates count them (whitespace-separated tokens). */
export function countWords(text) {
  return String(text ?? "").trim().split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
}

/**
 * The assistant's standing instructions. It is a real general assistant that happens to be an
 * IELTS expert; it never invents official scores.
 * @param {{locale?: "fa"|"en", profile?: {examType?: string|null, targetBand?: number|null}}} [input]
 */
export function assistantSystemPrompt({ locale = "fa", profile = {} } = {}) {
  const context = [
    profile.examType ? `IELTS ${profile.examType === "general" ? "General Training" : "Academic"}` : "exam type not set",
    profile.targetBand ? `target band ${profile.targetBand}` : "target band not set",
    `app language ${locale === "en" ? "English" : "Persian"}`,
  ].join("; ");
  return [
    "You are Bandora's AI assistant inside an IELTS preparation app used mostly by Persian-speaking learners.",
    "You are a capable general-purpose AI assistant: answer whatever the learner asks (IELTS, English grammar and vocabulary, study planning, or any general question) clearly, directly and accurately. Lead with the answer, then give only the explanation that actually helps. If a question is ambiguous, state your assumption and answer it.",
    "For IELTS questions, be an experienced IELTS teacher: base advice on the public IELTS band descriptors and official test format, give concrete examples, and be honest about weaknesses.",
    "Never invent facts, sources, statistics or official IELTS rules; say so when you are unsure. Any band you give is an AI estimate, not an official IELTS score, and you are not an official examiner.",
    "Reply in the language the learner writes in. If they write Persian (or Finglish), reply in natural, clear Persian, but keep English examples, quotes, corrections and model sentences in English.",
    "Format with light Markdown only: short paragraphs, ### headings when useful, - bullet or 1. numbered lists, **bold** for key points, `code` for short English fragments. No tables, no HTML.",
    "Do not reproduce copyrighted Cambridge IELTS test material verbatim; write your own examples instead.",
    `Learner context: ${context}.`,
  ].join("\n");
}

/**
 * The model-facing turn for a writing review. Only the latest submission gets the full
 * instructions; earlier ones are replayed with {@link reviewHistoryTurn}.
 * @param {{taskType: string, taskPrompt?: string|null, text: string, locale?: "fa"|"en"}} input
 */
export function reviewInstruction({ taskType, taskPrompt, text, locale = "fa" }) {
  const words = countWords(text);
  const min = MIN_WORDS[taskType] ?? 250;
  const language = locale === "en" ? "English" : "Persian";
  return [
    `Review this IELTS ${TASK_LABELS[taskType] ?? TASK_LABELS.task2} submission as an experienced IELTS writing teacher, using the public IELTS Writing band descriptors (${taskType === "task2" ? "Task Response" : "Task Achievement"}, Coherence and Cohesion, Lexical Resource, Grammatical Range and Accuracy).`,
    `Write all explanations in ${language}. Keep every quote from the text, every correction and every rewritten sentence in English.`,
    "Use exactly these sections, in this order:",
    "### Estimated band\nAn overall band and a band for each of the four criteria (half bands), each with a one-line reason tied to the text. State clearly that this is an AI estimate, not an official IELTS score.",
    `### Mistakes and corrections\nA numbered list of the most important real errors in the text (grammar, vocabulary/collocation, spelling, punctuation, cohesion, register). For each: the original fragment quoted exactly, then → the corrected version, then a short reason. Only list errors that actually appear in the text; never invent errors. At most 15, most serious first. If there are none, say so.`,
    "### Task response and organisation\nHow fully it answers the task, position/overview, paragraphing, progression and linking, with specific references to the text.",
    "### Corrected version\nThe learner's full text with the errors fixed, keeping their ideas, structure and voice (minimal edits, not a new essay).",
    "### How to reach a higher band\n3 to 5 concrete, specific actions, each with an improved example sentence built from their own text.",
    `Word count: ${words} (minimum ${min} for this task${words < min ? "; it is under length, so say how that limits the band" : ""}).`,
    `Task question given by the learner: ${taskPrompt && taskPrompt.trim() ? taskPrompt.trim().slice(0, 2000) : "(not provided; infer the task from the text and say that you did)"}`,
    "Learner's text:",
    "<<<",
    String(text).slice(0, 8000),
    ">>>",
  ].join("\n");
}

/** How an earlier review request is replayed as context for later questions. */
export function reviewHistoryTurn({ taskType, taskPrompt, text }) {
  return `[Writing submitted for review: ${TASK_LABELS[taskType] ?? taskType}${taskPrompt ? `\nTask: ${String(taskPrompt).slice(0, 600)}` : ""}]\n${String(text).slice(0, 6000)}`;
}

function aiError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

/**
 * One assistant reply from AvalAI (OpenAI-compatible chat completions).
 * Throws `missing_ai` when no key is configured and `ai_failed` on any failed or empty call;
 * never fabricates a reply.
 * @param {{messages: Array<{role: "user"|"assistant", content: string}>, mode?: "chat"|"writing_review",
 *          locale?: "fa"|"en", profile?: object, fetchImpl?: typeof fetch, env?: Record<string, string|undefined>}} input
 * @returns {Promise<{text: string, tokensIn: number, tokensOut: number, model: string}>}
 */
export async function assistantReply({ messages, mode = "chat", locale = "fa", profile = {}, fetchImpl = fetch, env = process.env }) {
  const key = env.AVALAI_API_KEY;
  if (!key) throw aiError("missing_ai");
  const model = env.AVALAI_MODEL || "gpt-4o-mini";
  const base = (env.AVALAI_BASE_URL || "https://api.avalai.ir/v1").replace(/\/$/, "");
  let response;
  try {
    response = await fetchImpl(`${base}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        temperature: mode === "writing_review" ? 0.2 : 0.5,
        max_tokens: mode === "writing_review" ? 3000 : 1500,
        messages: [{ role: "system", content: assistantSystemPrompt({ locale, profile }) }, ...messages],
      }),
      signal: AbortSignal.timeout(mode === "writing_review" ? 120000 : 60000),
    });
  } catch {
    throw aiError("ai_failed");
  }
  if (!response?.ok) throw aiError("ai_failed");
  const body = await response.json().catch(() => null);
  const text = String(body?.choices?.[0]?.message?.content ?? "").trim();
  if (!text) throw aiError("ai_failed");
  return {
    text,
    tokensIn: Number(body?.usage?.prompt_tokens) || 0,
    tokensOut: Number(body?.usage?.completion_tokens) || 0,
    model: String(body?.model || model),
  };
}
