import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { insert, newItem, newPracticeSet } from "../../db/test-helpers.js";
import { createTestApp, freshPhone } from "../test-support/http-app.js";

let mediaDir;
let t;
let low;
let once;

beforeAll(async () => {
  mediaDir = await fs.mkdtemp(path.join(os.tmpdir(), "bandora-speak-"));
  const plenty = async () => ({ bavail: 1024 * 1024, bsize: 4096 });
  t = await createTestApp({ mediaDir, speakingStatfs: plenty });
  low = await createTestApp({
    mediaDir,
    speakingStatfs: async () => ({ bavail: 10, bsize: 1024 }),
  });
  once = await createTestApp({ mediaDir, speakingStatfs: plenty, speakingUploadMax: 1 });
});

afterAll(async () => {
  await t.close();
  await low.close();
  await once.close();
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
