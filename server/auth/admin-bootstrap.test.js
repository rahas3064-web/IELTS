import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createMigratedDb, insert } from "../../db/test-helpers.js";
import { bootstrapSuperAdmin, parseBootstrapArgs } from "./admin-bootstrap-core.js";

let db;
let seq = 0;
const nextPhone = () => `0936${String(2000000 + (seq += 1))}`;
const yes = vi.fn(async () => "yes");

async function makeUser(overrides = {}) {
  return insert(db, "users", {
    phone: nextPhone(),
    phone_verified_at: new Date(),
    first_name: "Mina",
    last_name: "Rahimi",
    ...overrides,
  });
}
const auditRows = async (action) => (await db.query("select * from audit_logs where action = $1 order by created_at", [action])).rows;
const roleOf = async (id) => (await db.query("select role from users where id = $1", [id])).rows[0].role;

beforeAll(async () => {
  db = await createMigratedDb();
});
afterAll(async () => {
  await db.close();
});
beforeEach(async () => {
  yes.mockClear();
  await db.query("delete from audit_logs");
  await db.query("update users set role = 'learner'");
});

async function refusal(promise) {
  const error = await promise.then(() => null, (e) => e);
  expect(error, "expected a refusal").not.toBeNull();
  return error;
}

describe("bootstrapSuperAdmin", () => {
  it("promotes a verified account after an exact 'yes', revokes sessions and audits with a masked phone", async () => {
    const user = await makeUser();
    await insert(db, "sessions", { user_id: user.id, token_hash: `h-${user.id}`, expires_at: new Date(Date.now() + 3_600_000) });
    const result = await bootstrapSuperAdmin(db, { phone: user.phone, confirm: yes });
    expect(result).toMatchObject({ ok: true, userId: user.id });
    expect(result.maskedPhone).toBe(`${user.phone.slice(0, 4)}***${user.phone.slice(-4)}`);
    expect(yes).toHaveBeenCalledWith({ maskedPhone: result.maskedPhone, name: "Mina Rahimi" });
    expect(await roleOf(user.id)).toBe("super_admin");

    const sessions = await db.query("select revoked_at, revoked_reason from sessions where user_id = $1", [user.id]);
    expect(sessions.rows[0].revoked_reason).toBe("admin_force");
    expect(sessions.rows[0].revoked_at).not.toBeNull();

    const [row] = await auditRows("admin_bootstrap");
    expect(row.target_id).toBe(user.id);
    expect(JSON.stringify(row)).not.toContain(user.phone);
    expect(JSON.stringify(row)).toContain(result.maskedPhone);
  });

  it("accepts a phone typed with +98 or Persian digits", async () => {
    const user = await makeUser();
    const result = await bootstrapSuperAdmin(db, { phone: `+98${user.phone.slice(1)}`, confirm: yes });
    expect(result.userId).toBe(user.id);
  });

  it("refuses entirely when a super_admin already exists, audits it, and never asks", async () => {
    const existing = await makeUser({ role: "super_admin" });
    const candidate = await makeUser();
    const error = await refusal(bootstrapSuperAdmin(db, { phone: candidate.phone, confirm: yes }));
    expect(error.reason).toBe("super_admin_exists");
    expect(yes).not.toHaveBeenCalled();
    expect(await roleOf(candidate.id)).toBe("learner");
    expect(await roleOf(existing.id)).toBe("super_admin");
    const [row] = await auditRows("admin_bootstrap_refused");
    expect(row.meta.reason).toBe("super_admin_exists");
    expect(JSON.stringify(row)).not.toContain(candidate.phone);
    expect(JSON.stringify(row)).toContain(`${candidate.phone.slice(0, 4)}***`);
    expect(await auditRows("admin_bootstrap")).toHaveLength(0);
  });

  it("refuses an unknown phone", async () => {
    const error = await refusal(bootstrapSuperAdmin(db, { phone: nextPhone(), confirm: yes }));
    expect(error.reason).toBe("user_not_found");
    expect(yes).not.toHaveBeenCalled();
    expect(await auditRows("admin_bootstrap_refused")).toHaveLength(1);
  });

  it("refuses an account whose phone is not verified", async () => {
    const user = await makeUser({ phone_verified_at: null });
    const error = await refusal(bootstrapSuperAdmin(db, { phone: user.phone, confirm: yes }));
    expect(error.reason).toBe("phone_unverified");
    expect(await roleOf(user.id)).toBe("learner");
  });

  it("refuses blocked accounts and malformed phones", async () => {
    const blocked = await makeUser({ status: "blocked" });
    expect((await refusal(bootstrapSuperAdmin(db, { phone: blocked.phone, confirm: yes }))).reason).toBe("user_not_active");
    expect((await refusal(bootstrapSuperAdmin(db, { phone: "12345", confirm: yes }))).reason).toBe("invalid_phone");
    expect((await refusal(bootstrapSuperAdmin(db, { phone: undefined, confirm: yes }))).reason).toBe("invalid_phone");
  });

  it.each(["Yes", "y", "yes ", " yes", "YES", "no", "", undefined, null])("aborts on %j (only an exact 'yes' proceeds)", async (answer) => {
    const user = await makeUser();
    const error = await refusal(bootstrapSuperAdmin(db, { phone: user.phone, confirm: async () => answer }));
    expect(error.reason).toBe("aborted");
    expect(await roleOf(user.id)).toBe("learner");
    expect(await auditRows("admin_bootstrap")).toHaveLength(0);
  });

  it("lets only one of two simultaneous bootstraps win", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const results = await Promise.allSettled([
      bootstrapSuperAdmin(db, { phone: a.phone, confirm: yes }),
      bootstrapSuperAdmin(db, { phone: b.phone, confirm: yes }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const admins = await db.query("select count(*)::int as n from users where role = 'super_admin'");
    expect(admins.rows[0].n).toBe(1);
  });
});

describe("parseBootstrapArgs", () => {
  it("reads --phone <v>, --phone=<v> and falls back to ADMIN_BOOTSTRAP_PHONE at call time", () => {
    expect(parseBootstrapArgs(["--phone", "09121234567"], {})).toEqual({ phone: "09121234567" });
    expect(parseBootstrapArgs(["--phone=09121234567"], {})).toEqual({ phone: "09121234567" });
    expect(parseBootstrapArgs([], { ADMIN_BOOTSTRAP_PHONE: "09129999999" })).toEqual({ phone: "09129999999" });
    expect(parseBootstrapArgs(["--phone", "09121234567"], { ADMIN_BOOTSTRAP_PHONE: "09129999999" })).toEqual({ phone: "09121234567" });
  });

  it("throws a clear message when no phone is supplied or an unknown flag is used", () => {
    expect(() => parseBootstrapArgs([], {})).toThrow(/--phone/);
    expect(() => parseBootstrapArgs(["--phone"], {})).toThrow(/--phone/);
    expect(() => parseBootstrapArgs(["--force"], { ADMIN_BOOTSTRAP_PHONE: "09121234567" })).toThrow(/unknown/i);
  });
});
