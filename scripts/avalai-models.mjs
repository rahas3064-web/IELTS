// Local check: are the two Speaking models listed? Prints only those names.
// The API key stays in .env and is never written to stdout or stderr.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const SPEAKING_MODELS = Object.freeze(["gpt-transcribe", "gpt-audio-mini"]);

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

export function modelReport(payload, targets = SPEAKING_MODELS) {
  const listed = new Set();
  const rows = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
  for (const row of rows) {
    if (row && typeof row.id === "string") listed.add(row.id);
  }
  return targets.map((id) => ({ id, present: listed.has(id) }));
}

export function formatModelReport(rows) {
  return rows.map((row) => `${row.id}: ${row.present ? "present" : "missing"}`).join("\n");
}

function modelsUrl(base) {
  const trimmed = (base || "https://api.avalai.ir/v1").replace(/\/+$/, "");
  return `${trimmed}/models`;
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
  let response;
  try {
    response = await fetch(modelsUrl(env.AVALAI_BASE_URL), {
      headers: { authorization: `Bearer ${key}` },
    });
  } catch {
    console.error("models request failed: network");
    process.exitCode = 1;
    return;
  }
  if (!response.ok) {
    console.error(`models request failed: ${response.status}`);
    process.exitCode = 1;
    return;
  }
  let payload;
  try {
    payload = await response.json();
  } catch {
    console.error("models request failed: bad response");
    process.exitCode = 1;
    return;
  }
  console.log(formatModelReport(modelReport(payload)));
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  await main();
}
