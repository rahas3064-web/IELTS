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
