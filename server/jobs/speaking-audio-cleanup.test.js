import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createMigratedDb, insert, newItem, newUser, unique } from "../../db/test-helpers.js";
import { runSpeakingAudioCleanup } from "./speaking-audio-cleanup.js";

const NOW = new Date("2026-11-18T12:00:00Z");
const daysAgo = (days) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);

let db;
let mediaDir;
beforeAll(async () => {
  db = await createMigratedDb();
  mediaDir = await fs.mkdtemp(path.join(os.tmpdir(), "bandora-audio-"));
});
afterAll(async () => {
  await fs.rm(mediaDir, { recursive: true, force: true });
  await db.close();
});

async function recording(createdAt, storageKey) {
  const user = await newUser(db);
  const item = await newItem(db, { skill: "speaking" });
  return insert(db, "speaking_recordings", {
    user_id: user.id,
    context_type: "practice",
    context_id: "00000000-0000-4000-8000-0000000000aa",
    question_item_id: item.id,
    storage_key: storageKey,
    mime: "audio/webm",
    bytes: 128,
    duration_sec: 12,
    created_at: createdAt,
  });
}

describe("runSpeakingAudioCleanup", () => {
  it("deletes speaking files older than 90 days and leaves exam audio and newer recordings", async () => {
    const oldKey = `${unique("old")}.bin`;
    const freshKey = `${unique("fresh")}.bin`;
    const examKey = `${unique("exam")}.bin`;
    const outside = path.join(path.dirname(mediaDir), `${unique("outside")}.bin`);
    await fs.writeFile(path.join(mediaDir, oldKey), "old-audio");
    await fs.writeFile(path.join(mediaDir, freshKey), "fresh-audio");
    await fs.writeFile(path.join(mediaDir, examKey), "exam-audio");
    await fs.writeFile(outside, "OUTSIDE_CANARY");
    const old = await recording(daysAgo(90), oldKey);
    const nestedKey = `speaking/22222222-2222-4222-8222-222222222222/33333333-3333-4333-8333-333333333333.webm`;
    await fs.mkdir(path.dirname(path.join(mediaDir, nestedKey)), { recursive: true });
    await fs.writeFile(path.join(mediaDir, nestedKey), "nested-audio");
    const nested = await recording(daysAgo(100), nestedKey);
    const fresh = await recording(daysAgo(89), freshKey);
    await recording(daysAgo(120), `../../${path.basename(outside)}`);
    await insert(db, "media_assets", {
      kind: "audio",
      storage_key: `audio/${examKey}`,
      mime: "audio/mpeg",
      bytes: 10,
      created_at: daysAgo(400),
    });

    const stats = await runSpeakingAudioCleanup({ db, now: NOW, mediaDir });
    expect(stats.recordings).toBe(3);
    expect(stats.files).toBe(2);
    await expect(fs.access(path.join(mediaDir, oldKey))).rejects.toMatchObject({ code: "ENOENT" });
    await expect(fs.access(path.join(mediaDir, nestedKey))).rejects.toMatchObject({ code: "ENOENT" });
    expect(await fs.readFile(path.join(mediaDir, freshKey), "utf8")).toBe("fresh-audio");
    expect(await fs.readFile(path.join(mediaDir, examKey), "utf8")).toBe("exam-audio");
    expect(await fs.readFile(outside, "utf8")).toBe("OUTSIDE_CANARY");
    const left = await db.query("select id from speaking_recordings where id = any($1::uuid[])", [[old.id, fresh.id, nested.id]]);
    expect(left.rows.map((row) => row.id)).toEqual([fresh.id]);
    expect((await db.query("select count(*)::int as n from media_assets where storage_key = $1", [`audio/${examKey}`])).rows[0].n).toBe(1);
    await fs.rm(outside, { force: true });
  });
});
