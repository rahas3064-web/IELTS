import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { insert, newItem, newPracticeSet } from "../../db/test-helpers.js";
import { tehranMonthKey } from "../core/tehran-time.js";
import { createTestApp, freshPhone } from "../test-support/http-app.js";

let mediaDir;
let t;
let low;
let once;
let scored;
let wavFile;
let transcriptText;
let pronunciation;
let connectionFailure;
const audioCalls = { n: 0 };

beforeAll(async () => {
  mediaDir = await fs.mkdtemp(path.join(os.tmpdir(), "bandora-speak-"));
  const plenty = async () => ({ bavail: 1024 * 1024, bsize: 4096 });
  t = await createTestApp({ mediaDir, speakingStatfs: plenty });
  low = await createTestApp({
    mediaDir,
    speakingStatfs: async () => ({ bavail: 10, bsize: 1024 }),
  });
  once = await createTestApp({ mediaDir, speakingStatfs: plenty, speakingUploadMax: 1 });
  wavFile = path.join(mediaDir, "sample.wav");
  await fs.writeFile(wavFile, "RIFF");
  transcriptText = "I live in a quiet city";
  pronunciation = { band: 6, reasonFa: "تلفظ روشن است." };
  scored = await createTestApp({
    mediaDir,
    speakingStatfs: plenty,
    speakingScore: {
      env: {
        AVALAI_API_KEY: "test-key",
        AI_USD_TO_RIAL: "1000000",
        AI_COST_PER_1K_INPUT_RIAL: "1000",
        AI_COST_PER_1K_OUTPUT_RIAL: "2000",
      },
      transcribe: async () => {
        if (connectionFailure) {
          const error = new Error("connect");
          error.code = "UND_ERR_CONNECT_TIMEOUT";
          throw error;
        }
        return {
          text: transcriptText,
          usage: { tokensIn: 20, tokensOut: 8, seconds: 3 },
          model: "gpt-transcribe",
        };
      },
      scoreText: async () => ({
        band: 6,
        injection: false,
        criteria: {
          FC: { band: 6, reasonFa: "روان است." },
          LR: { band: 6, reasonFa: "واژه کافی است." },
          GRA: { band: 6, reasonFa: "جمله درست است." },
        },
        usage: { tokensIn: 100, tokensOut: 40, seconds: 0 },
        model: "gpt-4o-mini",
      }),
      scoreAudio: async () => {
        audioCalls.n += 1;
        return {
          pr: pronunciation ? { ...pronunciation } : null,
          usage: { tokensIn: 1500, tokensOut: 30, seconds: 0 },
          model: "gpt-audio-mini",
        };
      },
      toWav: async () => ({ path: wavFile, cleanup: async () => {} }),
    },
  });
});

afterAll(async () => {
  await t.close();
  await low.close();
  await once.close();
  await scored.close();
  await fs.rm(mediaDir, { recursive: true, force: true });
});

async function attemptFor(app, phone) {
  const device = app.client();
  const created = await app.signUp(device, phone);
  expect(created.status).toBe(201);
  const userId = created.json.user.id;
  const item = await newItem(app.db, { skill: "speaking" });
  const set = await newPracticeSet(app.db, { skill: "speaking", part_no: 2 });
  await insert(app.db, "practice_set_items", { set_id: set.id, item_id: item.id });
  const attempt = await insert(app.db, "practice_attempts", {
    user_id: userId,
    set_id: set.id,
    kind: "exam_part",
    skill: "speaking",
    status: "in_progress",
  });
  return { device, userId, itemId: item.id, attemptId: attempt.id };
}

async function send(app, device, { mime = "audio/webm", bytes = Buffer.from("audio"), attemptId, itemId, duration = "12", origin }) {
  const response = await fetch(
    `${app.base}/api/speaking/recordings?context=practice&contextId=${attemptId}&itemId=${itemId}`,
    {
      method: "POST",
      headers: {
        "content-type": mime,
        cookie: device.cookieHeader(),
        origin: origin === undefined ? app.base : origin,
        "x-duration-sec": duration,
      },
      body: bytes,
    },
  );
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: response.status, json };
}

describe("POST /api/speaking/recordings", () => {
  it("stores webm and mp4 for the owner and refuses another learner", async () => {
    const owner = await attemptFor(t, freshPhone());
    const other = await attemptFor(t, freshPhone());
    const saved = await send(t, owner.device, { attemptId: owner.attemptId, itemId: owner.itemId });
    expect(saved.status).toBe(201);
    expect(saved.json.storageKey.startsWith(`speaking/${owner.userId}/`)).toBe(true);
    expect(saved.json.mime).toBe("audio/webm");
    const file = path.join(mediaDir, ...saved.json.storageKey.split("/"));
    expect(await fs.readFile(file, "utf8")).toBe("audio");

    const mp4 = await send(t, owner.device, {
      mime: "audio/mp4",
      bytes: Buffer.from("mp4"),
      attemptId: owner.attemptId,
      itemId: owner.itemId,
    });
    expect(mp4.status).toBe(201);
    expect(mp4.json.storageKey.endsWith(".mp4")).toBe(true);

    const stolen = await send(t, other.device, { attemptId: owner.attemptId, itemId: owner.itemId });
    expect(stolen.status).toBe(404);
    const wav = await send(t, owner.device, { mime: "audio/wav", attemptId: owner.attemptId, itemId: owner.itemId });
    expect(wav.status).toBe(400);
    const foreign = await send(t, owner.device, {
      attemptId: owner.attemptId,
      itemId: owner.itemId,
      origin: "https://evil.example",
    });
    expect(foreign.status).toBe(403);
  });

  it("stops the upload when the volume is nearly full and writes an admin warning", async () => {
    const owner = await attemptFor(low, freshPhone());
    const blocked = await send(low, owner.device, { attemptId: owner.attemptId, itemId: owner.itemId });
    expect(blocked.status).toBe(507);
    expect(blocked.json.error.message_fa).toContain("فضای ذخیره");
    const rows = await low.db.query(
      "select meta::text as meta from audit_logs where action = 'speaking_volume_low' and actor_id = $1",
      [owner.userId],
    );
    expect(rows.rows.length).toBe(1);
    expect(rows.rows[0].meta).not.toMatch(/09\d{9}/);
    const files = await fs.readdir(path.join(mediaDir, "speaking", owner.userId)).catch(() => []);
    expect(files).toEqual([]);
  });

  it("rate-limits a second upload", async () => {
    const owner = await attemptFor(once, freshPhone());
    const first = await send(once, owner.device, { attemptId: owner.attemptId, itemId: owner.itemId });
    expect(first.status).toBe(201);
    const second = await send(once, owner.device, { attemptId: owner.attemptId, itemId: owner.itemId });
    expect(second.status).toBe(429);
  });
});

async function score(app, device, id) {
  const response = await fetch(`${app.base}/api/speaking/recordings/${id}/score`, {
    method: "POST",
    headers: { cookie: device.cookieHeader(), origin: app.base },
  });
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: response.status, json };
}

describe("POST /api/speaking/recordings/:id/score", () => {
  it("scores with one quota unit and logs tokens and rial for each model call", async () => {
    transcriptText = "I live in a quiet city";
    pronunciation = { band: 6, reasonFa: "تلفظ روشن است." };
    const owner = await attemptFor(scored, freshPhone());
    const saved = await send(scored, owner.device, { attemptId: owner.attemptId, itemId: owner.itemId });
    const result = await score(scored, owner.device, saved.json.id);
    expect(result.status).toBe(200);
    expect(result.json.status).toBe("scored");
    expect(result.json.band).toBe(6);
    expect(result.json.criteria.PR.band).toBe(6);
    expect(result.json.transcript).toBe("I live in a quiet city");
    const events = await scored.db.query(
      `select operation, quota_key, status, tokens_in, tokens_out, cost_rial, model, ref
       from ai_usage_events where user_id = $1`,
      [owner.userId],
    );
    const stt = events.rows.find((row) => row.operation === "speech_to_text");
    const quota = events.rows.find((row) => row.quota_key === "speaking_scoring");
    const pronunciationRow = events.rows.find((row) => String(row.ref).includes(":pr:"));
    expect(stt).toMatchObject({ tokens_in: 20, model: "gpt-transcribe" });
    expect(Number(stt.cost_rial)).toBe(150);
    expect(Number(quota.cost_rial)).toBe(180);
    expect(Number(pronunciationRow.cost_rial)).toBe(15072);
    expect(pronunciationRow.quota_key).toBeNull();
    expect(JSON.stringify(events.rows)).not.toContain("quiet city");
    const used = await scored.db.query(
      "select used from ai_usage_counters where user_id = $1 and quota_key = 'speaking_scoring'",
      [owner.userId],
    );
    expect(Number(used.rows[0].used)).toBe(1);
  });

  it("retries pronunciation without a second quota unit", async () => {
    transcriptText = "I live in a quiet city";
    pronunciation = null;
    const before = audioCalls.n;
    const owner = await attemptFor(scored, freshPhone());
    const saved = await send(scored, owner.device, { attemptId: owner.attemptId, itemId: owner.itemId });
    const partial = await score(scored, owner.device, saved.json.id);
    expect(partial.json.status).toBe("partial");
    expect(partial.json.band).toBeNull();
    expect(partial.json.pronunciationPending).toBe(true);
    expect(partial.json.criteria.PR).toBeUndefined();
    expect(partial.json.label).toContain("تلفظ");
    pronunciation = { band: 7, reasonFa: "تلفظ بهتر شد." };
    const again = await score(scored, owner.device, saved.json.id);
    expect(again.json.status).toBe("scored");
    expect(again.json.band).toBe(6.5);
    expect(again.json.criteria.PR.band).toBe(7);
    expect(audioCalls.n).toBe(before + 2);
    const used = await scored.db.query(
      "select used from ai_usage_counters where user_id = $1 and quota_key = 'speaking_scoring'",
      [owner.userId],
    );
    expect(Number(used.rows[0].used)).toBe(1);
    const quotaRows = await scored.db.query(
      "select count(*)::int as n from ai_usage_events where user_id = $1 and quota_key = 'speaking_scoring'",
      [owner.userId],
    );
    expect(quotaRows.rows[0].n).toBe(1);
  });

  it("releases the quota when transcription fails and invents no band", async () => {
    transcriptText = "";
    pronunciation = { band: 6, reasonFa: "تلفظ روشن است." };
    const owner = await attemptFor(scored, freshPhone());
    const saved = await send(scored, owner.device, { attemptId: owner.attemptId, itemId: owner.itemId });
    const result = await score(scored, owner.device, saved.json.id);
    expect(result.json.status).toBe("scoring_failed");
    expect(result.json.band).toBeNull();
    const used = await scored.db.query(
      "select used from ai_usage_counters where user_id = $1 and quota_key = 'speaking_scoring'",
      [owner.userId],
    );
    expect(Number(used.rows[0].used)).toBe(0);
  });

  it("releases the quota when AvalAI times out and invents no band", async () => {
    connectionFailure = true;
    const owner = await attemptFor(scored, freshPhone());
    const saved = await send(scored, owner.device, { attemptId: owner.attemptId, itemId: owner.itemId });
    const result = await score(scored, owner.device, saved.json.id);
    connectionFailure = false;
    expect(result.json.status).toBe("scoring_failed");
    expect(result.json.band).toBeNull();
    const used = await scored.db.query(
      "select used from ai_usage_counters where user_id = $1 and quota_key = 'speaking_scoring'",
      [owner.userId],
    );
    expect(Number(used.rows[0]?.used ?? 0)).toBe(0);
  });

  it("stops pronunciation retries at four and does not call the model again", async () => {
    const owner = await attemptFor(scored, freshPhone());
    const saved = await send(scored, owner.device, { attemptId: owner.attemptId, itemId: owner.itemId });
    await scored.db.query(
      `update speaking_recordings
       set transcript = 'hello there', score_state = 'partial', pronunciation_tries = 4,
           criteria = $2::jsonb
       where id = $1`,
      [saved.json.id, JSON.stringify({
        FC: { band: 6, reasonFa: "روان است." },
        LR: { band: 6, reasonFa: "واژه کافی است." },
        GRA: { band: 6, reasonFa: "جمله درست است." },
      })],
    );
    const before = audioCalls.n;
    const result = await score(scored, owner.device, saved.json.id);
    expect(result.status).toBe(409);
    expect(audioCalls.n).toBe(before);
  });

  it("refuses another learner and an exhausted free quota", async () => {
    transcriptText = "I live in a quiet city";
    pronunciation = { band: 6, reasonFa: "تلفظ روشن است." };
    const owner = await attemptFor(scored, freshPhone());
    const other = await attemptFor(scored, freshPhone());
    const saved = await send(scored, owner.device, { attemptId: owner.attemptId, itemId: owner.itemId });
    const stolen = await score(scored, other.device, saved.json.id);
    expect(stolen.status).toBe(404);
    await scored.db.query(
      "insert into ai_usage_counters (user_id, quota_key, period, used) values ($1, 'speaking_scoring', $2, 2)",
      [owner.userId, tehranMonthKey(new Date())],
    );
    const blocked = await score(scored, owner.device, saved.json.id);
    expect(blocked.status).toBe(402);
  });
});
