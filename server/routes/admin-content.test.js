import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestApp, freshPhone } from "../test-support/http-app.js";

let t;
let mediaDir;
beforeAll(async () => {
  mediaDir = fs.mkdtempSync(path.join(os.tmpdir(), "bd-media-"));
  t = await createTestApp({ config: {}, mediaDir });
});
afterAll(() => t.close());

async function admin(role) {
  const phone = freshPhone();
  const signed = await t.signUp(t.client(), phone);
  await t.db.query("update users set role = $2 where id = $1", [signed.json.user.id, role]);
  await t.db.query(
    `insert into question_types (key, skill, name_fa, name_en, official_description)
     values ('reading_tfng', 'reading', 'درست/نادرست', 'True False Not Given', 'Match the statement to the passage.')
     on conflict (key) do nothing`,
  );
  const device = t.client();
  t.clock.advance(61);
  await device.request("POST", "/api/admin/auth/otp/request", { body: { phone } });
  const code = t.lastCodeFor(phone);
  const verified = await device.request("POST", "/api/admin/auth/otp/verify", { body: { phone, code } });
  await device.request("POST", "/api/admin/auth/password/setup", {
    body: { gate: verified.json.gate, password: "correct-horse" },
  });
  return device;
}

const draftBody = {
  skill: "reading",
  examType: "academic",
  questionType: "reading_tfng",
  stem: { prompt: "The library opens on Sundays.", options: ["True", "False", "Not Given"] },
  answerKey: { correct: "Not Given" },
  isFree: true,
};

describe("content review", () => {
  it("keeps a draft unpublished until a reviewer approves, and hides the key from learners", async () => {
    const manager = await admin("content_manager");
    const created = await manager.request("POST", "/api/admin/content", { body: draftBody });
    expect(created.status).toBe(201);
    expect(created.json.item.status).toBe("draft");
    const id = created.json.item.id;

    const learner = t.client();
    await t.signUp(learner, freshPhone());
    const hidden = await learner.request("GET", "/api/content/published");
    expect(hidden.status).toBe(200);
    expect(hidden.json.items.find((item) => item.id === id)).toBeUndefined();
    expect(JSON.stringify(hidden.json)).not.toContain("answerKey");

    expect((await manager.request("POST", `/api/admin/content/${id}/approve`)).status).toBe(403);
    const sent = await manager.request("POST", `/api/admin/content/${id}/review`);
    expect(sent.json.item.status).toBe("in_review");

    const reviewer = await admin("reviewer");
    const rejected = await reviewer.request("POST", `/api/admin/content/${id}/reject`, { body: {} });
    expect(rejected.status).toBe(400);
    const no = await reviewer.request("POST", `/api/admin/content/${id}/reject`, { body: { reason: "stem is ambiguous" } });
    expect(no.json.item.status).toBe("rejected");

    await manager.request("POST", `/api/admin/content/${id}/review`);
    const yes = await reviewer.request("POST", `/api/admin/content/${id}/approve`);
    expect(yes.json.item.status).toBe("published");
    const visible = await learner.request("GET", "/api/content/published");
    const item = visible.json.items.find((row) => row.id === id);
    expect(item.stem.prompt).toContain("library");
    expect(item.answerKey).toBeUndefined();
  });

  it("filters the bank by skill and free flag", async () => {
    const manager = await admin("content_manager");
    await manager.request("POST", "/api/admin/content", { body: draftBody });
    const list = await manager.request("GET", "/api/admin/content?skill=reading&isFree=true");
    expect(list.status).toBe(200);
    expect(list.json.items.every((item) => item.skill === "reading" && item.isFree === true)).toBe(true);
    expect((await manager.request("GET", "/api/admin/content?skill=speaking")).json.items).toEqual([]);
  });
});

describe("media backup", () => {
  async function insertAudio(name) {
    const id = crypto.randomUUID();
    const bytes = Buffer.from(name);
    fs.writeFileSync(path.join(mediaDir, `${id}.bin`), bytes);
    await t.db.query(
      `insert into media_assets (id, kind, storage_key, mime, duration_sec, bytes)
       values ($1, 'audio', $2, 'audio/wav', 3, $3)`,
      [id, `audio/${id}.bin`, bytes.length],
    );
    return { id, bytes };
  }

  it("gives the manifest and the file only to super_admin and writes an audit row", async () => {
    const { id, bytes } = await insertAudio("wav-bytes");
    const owner = await admin("super_admin");
    const manifest = await owner.request("GET", "/api/admin/media/export");
    expect(manifest.status).toBe(200);
    expect(manifest.headers.get("cache-control")).toBe("no-store");
    const file = manifest.json.files.find((row) => row.id === id);
    expect(file).toMatchObject({
      kind: "audio",
      storageKey: `audio/${id}.bin`,
      mime: "audio/wav",
      bytes: bytes.length,
      onDisk: true,
      downloadPath: `/api/admin/media/files/${id}`,
    });
    expect(JSON.stringify(manifest.json)).not.toContain("transcript");
    const downloaded = await owner.request("GET", `/api/admin/media/files/${id}`);
    expect(downloaded.status).toBe(200);
    expect(downloaded.text).toBe("wav-bytes");
    const audit = await t.db.query(
      "select actor_role from audit_logs where action = 'media_export' order by created_at desc limit 1",
    );
    expect(audit.rows[0].actor_role).toBe("super_admin");
  });

  it("refuses every other admin role and a learner", async () => {
    for (const role of ["content_manager", "reviewer", "support_agent"]) {
      const device = await admin(role);
      expect((await device.request("GET", "/api/admin/media/export")).status, role).toBe(403);
      expect((await device.request("GET", `/api/admin/media/files/${crypto.randomUUID()}`)).status, role).toBe(403);
    }
    const learner = t.client();
    await t.signUp(learner, freshPhone());
    expect((await learner.request("GET", "/api/admin/media/export")).status).toBe(401);
  });

  it("does not read a storage key that leaves the media directory", async () => {
    const id = crypto.randomUUID();
    const outside = path.resolve(mediaDir, "..", `outside-${id}.bin`);
    fs.writeFileSync(outside, "OUTSIDE_CANARY");
    await t.db.query(
      `insert into media_assets (id, kind, storage_key, mime, duration_sec, bytes)
       values ($1, 'audio', $2, 'audio/wav', 3, 15)`,
      [id, `../../outside-${id}.bin`],
    );
    const owner = await admin("super_admin");
    const manifest = await owner.request("GET", "/api/admin/media/export");
    const file = manifest.json.files.find((row) => row.id === id);
    expect(file.onDisk).toBe(false);
    const downloaded = await owner.request("GET", `/api/admin/media/files/${id}`);
    expect(downloaded.status).toBe(404);
    expect(downloaded.text).not.toContain("OUTSIDE_CANARY");
    fs.unlinkSync(outside);
  });
});
