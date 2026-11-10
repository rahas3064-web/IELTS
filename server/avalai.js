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

export async function replyToLearner({ message, bands, fetchImpl = fetch, env = process.env }) {
  const key = env.AVALAI_API_KEY;
  if (!key) {
    const error = new Error("missing_ai");
    error.code = "missing_ai";
    throw error;
  }
  const response = await fetchImpl(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.AVALAI_MODEL || "gpt-4o-mini",
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content: `You are the learner's study assistant. Their latest bands are ${JSON.stringify(bands)}. Answer in the language of the question. Do not invent a new score. Keep the reply under 120 words.`,
        },
        { role: "user", content: String(message).slice(0, 2000) },
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
  const text = String(body?.choices?.[0]?.message?.content ?? "").trim();
  if (!text) {
    const error = new Error("ai_failed");
    error.code = "ai_failed";
    throw error;
  }
  return text;
}
