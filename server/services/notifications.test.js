import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createMigratedDb, newUser } from "../../db/test-helpers.js";
import { decodeCursor, encodeCursor, notify } from "./notifications.js";

let db;
beforeAll(async () => {
  db = await createMigratedDb();
});
afterAll(() => db.close());

const valid = { kind: "plan.ready", title: "برنامه هفته آماده شد", body: "برنامه جدیدت رو ببین.", link: "/app/plan" };

describe("notify", () => {
  it("creates an unread notification and returns its id", async () => {
    const user = await newUser(db);
    const id = await notify(db, user.id, valid);
    const { rows } = await db.query("select * from notifications where id = $1", [id]);
    expect(rows[0]).toMatchObject({ user_id: user.id, kind: "plan.ready", title: valid.title, body: valid.body, link: "/app/plan", read_at: null });
  });

  it("allows a missing link", async () => {
    const user = await newUser(db);
    const id = await notify(db, user.id, { kind: "info", title: "t", body: "b" });
    expect((await db.query("select link from notifications where id = $1", [id])).rows[0].link).toBeNull();
  });

  it("works inside a caller transaction (rolls back with it)", async () => {
    const user = await newUser(db);
    await expect(db.transaction(async (tx) => {
      await notify(tx, user.id, valid);
      throw new Error("boom");
    })).rejects.toThrow("boom");
    expect((await db.query("select count(*)::int as n from notifications where user_id = $1", [user.id])).rows[0].n).toBe(0);
  });

  it.each([
    ["empty kind", { kind: "" }],
    ["kind with spaces", { kind: "plan ready" }],
    ["kind too long", { kind: "k".repeat(41) }],
    ["empty title", { title: "  " }],
    ["title too long", { title: "t".repeat(121) }],
    ["empty body", { body: "" }],
    ["body too long", { body: "b".repeat(501) }],
    ["external link", { link: "https://evil.example/x" }],
    ["protocol-relative link", { link: "//evil.example" }],
    ["link too long", { link: `/${"a".repeat(200)}` }],
    ["non-string title", { title: 5 }],
  ])("rejects %s", async (_label, patch) => {
    const user = await newUser(db);
    await expect(notify(db, user.id, { ...valid, ...patch })).rejects.toThrow(TypeError);
    expect((await db.query("select count(*)::int as n from notifications where user_id = $1", [user.id])).rows[0].n).toBe(0);
  });

  it("requires a user id", async () => {
    await expect(notify(db, "", valid)).rejects.toThrow(TypeError);
  });
});

describe("cursor codec", () => {
  const id = "0b1a8f5e-6f2c-4a38-9d6b-3c1d2e4f5a6b";
  const ts = "2026-11-10T09:00:00.123456Z";

  it("round-trips, base64url encoded", () => {
    const cursor = encodeCursor({ ts, id });
    expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeCursor(cursor)).toEqual({ ts, id });
  });

  it("rejects garbage with a validation error", () => {
    for (const bad of ["", "!!!", "bm90LWEtY3Vyc29y", encodeCursor({ ts: "yesterday", id }), encodeCursor({ ts, id: "nope" })]) {
      expect(() => decodeCursor(bad), bad).toThrow(expect.objectContaining({ code: "validation_failed", status: 400 }));
    }
  });
});
