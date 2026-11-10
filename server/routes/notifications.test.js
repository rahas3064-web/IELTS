import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { insert } from "../../db/test-helpers.js";
import { createTestApp, freshPhone } from "../test-support/http-app.js";

let t;
beforeAll(async () => {
  t = await createTestApp();
});
afterAll(() => t.close());
beforeEach(() => t.resetLimits());

async function learner() {
  const device = t.client();
  const res = await t.signUp(device, freshPhone());
  return { device, user: res.json.user };
}
const post = (user, fields = {}) =>
  insert(t.db, "notifications", { user_id: user.id, kind: "info", title: "عنوان", body: "متن", ...fields });
const at = (n) => new Date(Date.UTC(2026, 10, 1, 8, 0, n));
const list = (device, query = "") => device.request("GET", `/api/notifications${query}`);

describe("GET /api/notifications", () => {
  it("needs a session", async () => {
    expect((await list(t.client())).status).toBe(401);
  });

  it("returns an empty page for a learner without notifications", async () => {
    const { device } = await learner();
    const res = await list(device);
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ items: [], nextCursor: null, unreadCount: 0 });
  });

  it("returns the documented item shape, newest first, and the unread count", async () => {
    const { device, user } = await learner();
    const older = await post(user, { kind: "plan.ready", title: "قدیمی", body: "b1", link: "/app/plan", created_at: at(1), read_at: at(5) });
    const newer = await post(user, { title: "جدید", body: "b2", created_at: at(2) });
    const res = await list(device);
    expect(res.json.unreadCount).toBe(1);
    expect(res.json.nextCursor).toBeNull();
    expect(res.json.items).toEqual([
      { id: newer.id, kind: "info", title: "جدید", body: "b2", link: null, readAt: null, createdAt: at(2).toISOString() },
      { id: older.id, kind: "plan.ready", title: "قدیمی", body: "b1", link: "/app/plan", readAt: at(5).toISOString(), createdAt: at(1).toISOString() },
    ]);
    expect(res.text).not.toMatch(/user_id|userId/);
  });

  it("never shows another learner's notifications", async () => {
    const a = await learner();
    const b = await learner();
    await post(b.user, { title: "برای دیگری" });
    expect((await list(a.device)).json.items).toEqual([]);
  });

  it("pages with a keyset cursor without gaps or repeats, including identical timestamps", async () => {
    const { device, user } = await learner();
    const ids = [];
    for (let i = 0; i < 7; i += 1) ids.push((await post(user, { title: `n${i}`, created_at: at(i < 4 ? 10 : i) })).id);
    const seen = [];
    let cursor = null;
    let pages = 0;
    do {
      const res = await list(device, `?limit=3${cursor ? `&cursor=${cursor}` : ""}`);
      expect(res.status).toBe(200);
      seen.push(...res.json.items.map((i) => i.id));
      cursor = res.json.nextCursor;
      pages += 1;
    } while (cursor);
    expect(pages).toBe(3);
    expect(new Set(seen).size).toBe(7);
    expect([...seen].sort()).toEqual([...ids].sort());
  });

  it("keeps microsecond precision in the cursor", async () => {
    const { device, user } = await learner();
    for (const us of ["123100", "123200", "123300"]) {
      await t.db.query(
        "insert into notifications (user_id, kind, title, body, created_at) values ($1, 'info', $2, 'b', $3::timestamptz)",
        [user.id, `us${us}`, `2026-11-01T08:00:00.${us}Z`],
      );
    }
    const first = await list(device, "?limit=1");
    const second = await list(device, `?limit=1&cursor=${first.json.nextCursor}`);
    const third = await list(device, `?limit=1&cursor=${second.json.nextCursor}`);
    expect([first, second, third].map((r) => r.json.items[0].title)).toEqual(["us123300", "us123200", "us123100"]);
    expect(third.json.nextCursor).toBeNull();
  });

  it("defaults to 20 items and caps limit at 50", async () => {
    const { device, user } = await learner();
    for (let i = 0; i < 55; i += 1) await post(user, { created_at: at(i) });
    const byDefault = await list(device);
    expect(byDefault.json.items).toHaveLength(20);
    expect(byDefault.json.nextCursor).toEqual(expect.any(String));
    expect((await list(device, "?limit=500")).json.items).toHaveLength(50);
    expect((await list(device, "?limit=1")).json.items).toHaveLength(1);
  });

  it("rejects bad limit and bad cursor with 400", async () => {
    const { device } = await learner();
    for (const q of ["?limit=0", "?limit=-3", "?limit=abc", "?limit=2.5", "?cursor=!!!", "?cursor=bm90LWEtY3Vyc29y"]) {
      const res = await list(device, q);
      expect(res.status, q).toBe(400);
      expect(res.json.error.code).toBe("validation_failed");
    }
  });
});

describe("POST /api/notifications/:id/read", () => {
  const read = (device, id, options) => device.request("POST", `/api/notifications/${id}/read`, options);

  it("marks an own notification read and returns the new unread count", async () => {
    const { device, user } = await learner();
    const target = await post(user);
    await post(user);
    const res = await read(device, target.id);
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ ok: true, unreadCount: 1 });
    const page = await list(device);
    expect(page.json.items.find((i) => i.id === target.id).readAt).toEqual(expect.any(String));
  });

  it("is idempotent and keeps the first read time", async () => {
    const { device, user } = await learner();
    const target = await post(user);
    await read(device, target.id);
    const first = (await list(device)).json.items[0].readAt;
    t.clock.advance(3600);
    const again = await read(device, target.id);
    expect(again.json).toEqual({ ok: true, unreadCount: 0 });
    expect((await list(device)).json.items[0].readAt).toBe(first);
  });

  it("answers 404 for someone else's notification and leaves it unread", async () => {
    const a = await learner();
    const b = await learner();
    const theirs = await post(b.user);
    const res = await read(a.device, theirs.id);
    expect(res.status).toBe(404);
    expect(res.json.error.code).toBe("not_found");
    expect((await list(b.device)).json.unreadCount).toBe(1);
  });

  it("answers 404 for unknown or malformed ids", async () => {
    const { device } = await learner();
    expect((await read(device, "00000000-0000-4000-8000-000000000000")).status).toBe(404);
    expect((await read(device, "not-a-uuid")).status).toBe(404);
  });

  it("enforces the origin check and the session", async () => {
    const { device, user } = await learner();
    const target = await post(user);
    expect((await read(device, target.id, { origin: "https://evil.example" })).status).toBe(403);
    expect((await read(device, target.id, { origin: null })).status).toBe(403);
    expect((await read(t.client(), target.id)).status).toBe(401);
    expect((await list(device)).json.unreadCount).toBe(1);
  });
});

describe("POST /api/notifications/read-all", () => {
  const readAll = (device, options) => device.request("POST", "/api/notifications/read-all", options);

  it("marks only the caller's notifications read", async () => {
    const a = await learner();
    const b = await learner();
    await post(a.user);
    await post(a.user);
    await post(b.user);
    const res = await readAll(a.device);
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ ok: true, unreadCount: 0 });
    expect((await list(b.device)).json.unreadCount).toBe(1);
  });

  it("is idempotent and does not touch earlier read times", async () => {
    const { device, user } = await learner();
    await post(user, { read_at: at(9) });
    await post(user);
    await readAll(device);
    const before = (await list(device)).json.items.map((i) => i.readAt);
    t.clock.advance(60);
    expect((await readAll(device)).json).toEqual({ ok: true, unreadCount: 0 });
    expect((await list(device)).json.items.map((i) => i.readAt)).toEqual(before);
    expect(before).toContain(at(9).toISOString());
  });

  it("enforces the origin check and the session", async () => {
    const { device } = await learner();
    expect((await readAll(device, { origin: "https://evil.example" })).status).toBe(403);
    expect((await readAll(t.client())).status).toBe(401);
  });
});
