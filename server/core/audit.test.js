import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { AUDIT_LOGS_DDL, audit, sanitizeAuditValue } from "./audit.js";

function adapter(pg) {
  return {
    async query(sql, params) {
      return pg.query(sql, params);
    },
  };
}

const ACTOR = "11111111-1111-4111-8111-111111111111";

describe("sanitizeAuditValue", () => {
  it("masks phone-like keys", () => {
    expect(sanitizeAuditValue({ phone: "09123456789", new_phone: "09351112233" })).toEqual({
      phone: "0912***6789",
      new_phone: "0935***2233",
    });
  });

  it("redacts sensitive keys case-insensitively, at any depth, including in arrays", () => {
    const out = sanitizeAuditValue({
      password: "p",
      Password_Hash: "h",
      otp: "123456",
      verificationCode: "1",
      access_token: "t",
      client_secret: "s",
      prompt: "my essay about Ali",
      nested: { deep: [{ token: "x", keep: 1 }] },
      keep: "yes",
    });
    expect(out).toEqual({
      password: "[redacted]",
      Password_Hash: "[redacted]",
      otp: "[redacted]",
      verificationCode: "[redacted]",
      access_token: "[redacted]",
      client_secret: "[redacted]",
      prompt: "[redacted]",
      nested: { deep: [{ token: "[redacted]", keep: 1 }] },
      keep: "yes",
    });
  });

  it("redacts before masking so code-like phone keys never leak digits", () => {
    expect(sanitizeAuditValue({ phone_verification_code: "123456" })).toEqual({
      phone_verification_code: "[redacted]",
    });
  });

  it("keeps ip_hash (already a one-way hash)", () => {
    expect(sanitizeAuditValue({ ip_hash: "abc" })).toEqual({ ip_hash: "abc" });
  });

  it("passes primitives, null and undefined through and survives cycles", () => {
    expect(sanitizeAuditValue(null)).toBeNull();
    expect(sanitizeAuditValue(undefined)).toBeUndefined();
    expect(sanitizeAuditValue(5)).toBe(5);
    const a = { name: "a" };
    a.self = a;
    expect(sanitizeAuditValue(a)).toEqual({ name: "a", self: "[circular]" });
  });

  it("does not mutate its input", () => {
    const input = Object.freeze({ phone: "09123456789", inner: Object.freeze({ otp: "1" }) });
    const out = sanitizeAuditValue(input);
    expect(input.phone).toBe("09123456789");
    expect(input.inner.otp).toBe("1");
    expect(out).not.toBe(input);
  });
});

describe("audit()", () => {
  let pg;
  let db;

  beforeAll(async () => {
    pg = new PGlite();
    db = adapter(pg);
    await db.query(AUDIT_LOGS_DDL);
  });

  afterAll(async () => {
    await pg.close();
  });

  beforeEach(async () => {
    await db.query("truncate audit_logs");
  });

  it("inserts a row and returns its id", async () => {
    const id = await audit(db, {
      actorId: ACTOR,
      actorRole: "admin",
      action: "user.block",
      targetType: "user",
      targetId: "42",
      before: { status: "active" },
      after: { status: "blocked" },
      ipHash: "iphash123",
      meta: { reason: "abuse" },
    });
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    const { rows } = await db.query("select * from audit_logs where id = $1", [id]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      actor_id: ACTOR,
      actor_role: "admin",
      action: "user.block",
      target_type: "user",
      target_id: "42",
      before: { status: "active" },
      after: { status: "blocked" },
      ip_hash: "iphash123",
      meta: { reason: "abuse" },
    });
    expect(rows[0].created_at).toBeInstanceOf(Date);
  });

  it("sanitizes before/after/meta before storing", async () => {
    const id = await audit(db, {
      action: "user.phone_change",
      before: { phone: "09123456789" },
      after: { phone: "09351112233", otp: "999999" },
      meta: { sms_code: "5555", prompt: "full essay text" },
    });
    const { rows } = await db.query("select before, after, meta, actor_id from audit_logs where id = $1", [id]);
    expect(rows[0].before).toEqual({ phone: "0912***6789" });
    expect(rows[0].after).toEqual({ phone: "0935***2233", otp: "[redacted]" });
    expect(rows[0].meta).toEqual({ sms_code: "[redacted]", prompt: "[redacted]" });
    expect(rows[0].actor_id).toBeNull();
    expect(JSON.stringify(rows[0])).not.toContain("09123456789");
  });

  it("stores null for omitted json fields", async () => {
    const id = await audit(db, { action: "system.boot" });
    const { rows } = await db.query("select before, after, meta, ip_hash from audit_logs where id = $1", [id]);
    expect(rows[0]).toEqual({ before: null, after: null, meta: null, ip_hash: null });
  });

  it("does not mutate the event or its payloads", async () => {
    const before = Object.freeze({ phone: "09123456789" });
    const event = Object.freeze({ action: "x", before, meta: Object.freeze({ token: "t" }) });
    await audit(db, event);
    expect(before.phone).toBe("09123456789");
    expect(event.meta.token).toBe("t");
  });

  it("requires an action", async () => {
    await expect(audit(db, {})).rejects.toThrow(TypeError);
    await expect(audit(db, { action: "" })).rejects.toThrow(TypeError);
  });

  it("propagates database failures", async () => {
    const broken = { query: async () => { throw new Error("db down"); } };
    await expect(audit(broken, { action: "x" })).rejects.toThrow("db down");
  });
});
