import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { insert, newItem, unique } from "../../db/test-helpers.js";
import { createTestApp, freshPhone } from "../test-support/http-app.js";

let t;
let mediaDir;

beforeAll(async () => {
  mediaDir = await fs.mkdtemp(path.join(os.tmpdir(), "bandora-delete-"));
  t = await createTestApp({ mediaDir });
});

afterAll(async () => {
  await fs.rm(mediaDir, { recursive: true, force: true });
  await t.close();
});

async function signedIn(phone) {
  const device = t.client();
  const created = await t.signUp(device, phone);
  expect(created.status).toBe(201);
  return { device, userId: created.json.user.id, phone };
}

async function addRecording(userId, storageKey) {
  const item = await newItem(t.db, { skill: "speaking" });
  return insert(t.db, "speaking_recordings", {
    user_id: userId,
    context_type: "practice",
    context_id: "00000000-0000-4000-8000-0000000000ab",
    question_item_id: item.id,
    storage_key: storageKey,
    mime: "audio/webm",
    bytes: 64,
    duration_sec: 8,
  });
}

async function addInvoice(userId, phone) {
  const price = (await t.db.query("select id, plan_key, amount_rial from plan_prices limit 1")).rows[0];
  const attempt = await insert(t.db, "payment_attempts", {
    user_id: userId,
    plan_price_id: price.id,
    amount_rial: price.amount_rial,
    provider: "bale",
    flow: "invoice_link",
    idempotency_key: unique("pay"),
    payload: `phone=${phone}`,
    raw: { phone },
    expires_at: new Date(Date.now() + 60_000),
  });
  const invoice = await insert(t.db, "invoices", {
    user_id: userId,
    payment_attempt_id: attempt.id,
    number: unique("inv"),
    amount_rial: price.amount_rial,
    plan_key: price.plan_key,
    period_start: new Date("2026-11-01T00:00:00Z"),
    period_end: new Date("2026-12-01T00:00:00Z"),
  });
  return { attempt, invoice };
}

describe("POST /api/account/delete", () => {
  it("requires the typed word حذف and then frees the phone", async () => {
    const phone = freshPhone();
    const owner = await signedIn(phone);
    const other = await signedIn(freshPhone());
    const bystander = await signedIn(freshPhone());
    const audioName = `${unique("mine")}.bin`;
    const nestedKey = `speaking/${owner.userId}/44444444-4444-4444-8444-444444444444.webm`;
    const otherName = `${unique("other")}.bin`;
    const bystanderName = `${unique("bystander")}.bin`;
    const examName = `${unique("exam")}.bin`;
    const outside = path.join(path.dirname(mediaDir), `${unique("outside")}.bin`);
    await fs.writeFile(path.join(mediaDir, audioName), "mine");
    await fs.mkdir(path.dirname(path.join(mediaDir, nestedKey)), { recursive: true });
    await fs.writeFile(path.join(mediaDir, nestedKey), "nested");
    await fs.writeFile(path.join(mediaDir, otherName), "other");
    await fs.writeFile(path.join(mediaDir, bystanderName), "bystander");
    await fs.writeFile(path.join(mediaDir, examName), "exam");
    await fs.writeFile(outside, "OUTSIDE_CANARY");
    await addRecording(owner.userId, audioName);
    await addRecording(owner.userId, nestedKey);
    await addRecording(owner.userId, `../../${path.basename(outside)}`);
    await addRecording(other.userId, otherName);
    await addRecording(bystander.userId, bystanderName);
    await insert(t.db, "media_assets", {
      kind: "audio",
      storage_key: `audio/${examName}`,
      mime: "audio/mpeg",
      bytes: 4,
    });
    const money = await addInvoice(owner.userId, phone);
    const oldCookie = owner.device.cookieHeader();

    const refused = await owner.device.request("POST", "/api/account/delete", { body: { confirmation: "نه" } });
    expect(refused.status).toBe(400);
    expect((await t.db.query("select id from users where phone = $1", [phone])).rows).toHaveLength(1);

    const stolen = await other.device.request("POST", "/api/account/delete", {
      body: { confirmation: "حذف", userId: owner.userId },
    });
    expect(stolen.status).toBe(200);
    expect((await t.db.query("select id from users where id = $1", [owner.userId])).rows).toHaveLength(1);
    expect(await fs.readFile(path.join(mediaDir, audioName), "utf8")).toBe("mine");

    const deleted = await owner.device.request("POST", "/api/account/delete", { body: { confirmation: "حذف" } });
    expect(deleted.status).toBe(200);
    const [cookieName, cookieValue] = oldCookie.split("=");
    owner.device.jar.set(cookieName, cookieValue);
    const again = await owner.device.request("GET", "/api/me");
    expect(again.status).toBe(401);

    expect((await t.db.query("select id from users where phone = $1", [phone])).rows).toHaveLength(0);
    expect((await t.db.query("select id from users where id = $1", [other.userId])).rows).toHaveLength(0);
    expect((await t.db.query("select id from users where id = $1", [bystander.userId])).rows).toHaveLength(1);
    await expect(fs.access(path.join(mediaDir, audioName))).rejects.toMatchObject({ code: "ENOENT" });
    await expect(fs.access(path.join(mediaDir, nestedKey))).rejects.toMatchObject({ code: "ENOENT" });
    expect(await fs.readFile(path.join(mediaDir, bystanderName), "utf8")).toBe("bystander");
    expect(await fs.readFile(path.join(mediaDir, examName), "utf8")).toBe("exam");
    expect(await fs.readFile(outside, "utf8")).toBe("OUTSIDE_CANARY");

    const invoice = (await t.db.query("select user_id, number from invoices where id = $1", [money.invoice.id])).rows[0];
    expect(invoice.user_id).toBeNull();
    expect(invoice.number).toBe(money.invoice.number);
    const attempt = (await t.db.query("select user_id, payload, raw from payment_attempts where id = $1", [money.attempt.id])).rows[0];
    expect(attempt.user_id).toBeNull();
    expect(JSON.stringify(attempt)).not.toContain(phone);

    const ledger = (await t.db.query("select phone_hash from account_deletions")).rows;
    expect(ledger.some((row) => row.phone_hash === phone)).toBe(false);
    expect(ledger.some((row) => typeof row.phone_hash === "string" && row.phone_hash.length >= 32)).toBe(true);
    const audits = await t.db.query("select meta::text as meta from audit_logs where action = 'account_deleted'");
    expect(audits.rows.length).toBeGreaterThan(0);
    expect(audits.rows.some((row) => String(row.meta).includes(phone))).toBe(false);
    expect((await t.db.query("select id from otp_codes where phone = $1", [phone])).rows).toHaveLength(0);

    const second = await t.signUp(t.client(), phone);
    expect(second.status).toBe(201);
    await fs.rm(outside, { force: true });
  });
});
