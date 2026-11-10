import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applyMigrations, listMigrations } from "../server/migrate.js";
import { AUDIT_LOGS_DDL, audit } from "../server/core/audit.js";
import { JOB_RUNS_DDL, createJobRunner } from "../server/core/jobs.js";
import { consumeLimit } from "../server/rate-limit.js";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "migrations");
let db;

const TABLES = [
  "users", "otp_codes", "otp_locks", "sessions", "learner_profiles", "admin_credentials",
  "audit_logs", "notifications", "sms_messages", "user_streaks", "rate_limits",
  "system_settings", "job_runs", "schema_migrations",
];

async function expectViolation(promise, fragment) {
  await expect(promise).rejects.toThrow(fragment);
}

async function newUser(overrides = {}) {
  const row = {
    phone: `09${String(Math.floor(Math.random() * 1e9)).padStart(9, "0")}`,
    first_name: "Sara",
    last_name: "Ahmadi",
    ...overrides,
  };
  const keys = Object.keys(row);
  const result = await db.query(
    `insert into users (${keys.join(", ")}) values (${keys.map((_, i) => `$${i + 1}`).join(", ")}) returning *`,
    keys.map((key) => row[key]),
  );
  return result.rows[0];
}

async function columns(table) {
  const result = await db.query(
    `select column_name, data_type, is_nullable from information_schema.columns
     where table_schema = 'public' and table_name = $1 order by column_name`,
    [table],
  );
  return result.rows;
}

beforeAll(async () => {
  db = new PGlite();
  await db.waitReady;
  await applyMigrations(db, dir);
});

afterAll(async () => {
  await db.close();
});

describe("migration files", () => {
  it("are a clean ordered set starting at 001_core with valid names", async () => {
    const list = await listMigrations(dir);
    expect(list[0].version).toBe("001_core");
  });

  it("contain no ALTER TABLE patches, extensions or citext", async () => {
    for (const { path: file } of await listMigrations(dir)) {
      const sql = (await fs.readFile(file, "utf8")).replace(/--.*$/gm, "").toLowerCase();
      expect(sql).not.toMatch(/\balter table\b/);
      expect(sql).not.toMatch(/create extension/);
      expect(sql).not.toMatch(/citext/);
    }
  });

  it("are idempotent when applied again", async () => {
    const again = await applyMigrations(db, dir);
    expect(again.applied).toEqual([]);
  });
});

describe("001_core schema", () => {
  it("creates every core table", async () => {
    const result = await db.query("select table_name from information_schema.tables where table_schema = 'public'");
    const names = result.rows.map((row) => row.table_name);
    for (const table of TABLES) expect(names).toContain(table);
  });

  it("does not create old or out-of-scope tables", async () => {
    const result = await db.query("select table_name from information_schema.tables where table_schema = 'public'");
    const names = result.rows.map((row) => row.table_name);
    for (const gone of [
      "profiles", "learner_sheets", "admin_audit_logs", "content_classifications",
      "placement_attempts", "skill_results", "mock_attempts", "subscriptions", "content_items",
    ]) {
      expect(names).not.toContain(gone);
    }
  });

  it("has no duplicate or catch-all columns", async () => {
    const all = await db.query(
      "select table_name, column_name, data_type from information_schema.columns where table_schema = 'public'",
    );
    expect(all.rows.filter((row) => row.column_name === "display_name")).toEqual([]);
    expect(all.rows.filter((row) => row.column_name === "payload")).toEqual([]);
    expect(all.rows.filter((row) => row.column_name === "summary")).toEqual([]);
    const jsonb = all.rows.filter((row) => row.data_type === "jsonb").map((row) => `${row.table_name}.${row.column_name}`).sort();
    expect(jsonb).toEqual([
      "audit_logs.after", "audit_logs.before", "audit_logs.meta",
      "job_runs.stats", "system_settings.value",
    ]);
  });

  it("uses uuid primary keys with a default and timestamptz audit columns where present", async () => {
    for (const table of ["users", "otp_codes", "sessions", "audit_logs", "notifications", "sms_messages", "job_runs"]) {
      const cols = await columns(table);
      const id = cols.find((col) => col.column_name === "id");
      expect(id?.data_type, table).toBe("uuid");
    }
    for (const table of ["users", "learner_profiles", "system_settings"]) {
      const cols = Object.fromEntries((await columns(table)).map((col) => [col.column_name, col]));
      expect(cols.created_at.data_type, table).toBe("timestamp with time zone");
      expect(cols.updated_at.data_type, table).toBe("timestamp with time zone");
      expect(cols.updated_at.is_nullable, table).toBe("NO");
    }
  });

  it("indexes every foreign key column", async () => {
    const result = await db.query(`
      select c.conrelid::regclass::text as tbl, c.conname, c.conkey
      from pg_constraint c
      join pg_namespace n on n.oid = c.connamespace
      where c.contype = 'f' and n.nspname = 'public'`);
    expect(result.rows.length).toBeGreaterThan(0);
    for (const fk of result.rows) {
      const indexes = await db.query(
        `select i.indkey::int2[] as cols from pg_index i where i.indrelid = $1::regclass and i.indisvalid`,
        [fk.tbl],
      );
      const covered = indexes.rows.some((idx) => fk.conkey.every((col, pos) => idx.cols[pos] === col));
      expect(covered, `${fk.tbl} ${fk.conname} has no leading index`).toBe(true);
    }
  });

  it("keeps the audit_logs and job_runs columns identical to the core helper DDL", async () => {
    const scratch = new PGlite();
    await scratch.waitReady;
    try {
      await scratch.exec(AUDIT_LOGS_DDL);
      await scratch.exec(JOB_RUNS_DDL);
      for (const table of ["audit_logs", "job_runs"]) {
        const expected = await scratch.query(
          `select column_name, data_type, is_nullable from information_schema.columns
           where table_schema = 'public' and table_name = $1 order by column_name`,
          [table],
        );
        expect(await columns(table), table).toEqual(expected.rows);
      }
    } finally {
      await scratch.close();
    }
  });
});

describe("users constraints", () => {
  it("rejects malformed phones and duplicate phones", async () => {
    await expectViolation(newUser({ phone: "+989121234567" }), /users_phone_format/);
    await expectViolation(newUser({ phone: "0912123456" }), /users_phone_format/);
    const user = await newUser({ phone: "09120000001" });
    await expectViolation(newUser({ phone: user.phone }), /users_phone_key/);
  });

  it("limits role, locale and status to the spec values", async () => {
    await expectViolation(newUser({ role: "system_admin" }), /users_role_valid/);
    await expectViolation(newUser({ locale: "de" }), /users_locale_valid/);
    await expectViolation(newUser({ status: "suspended" }), /users_status_valid/);
    for (const role of ["learner", "super_admin", "content_manager", "reviewer", "support_agent"]) {
      expect((await newUser({ role })).role).toBe(role);
    }
  });

  it("defaults to an active Persian learner", async () => {
    const user = await newUser();
    expect(user).toMatchObject({ role: "learner", locale: "fa", status: "active", email: null });
  });

  it("makes e-mail unique case-insensitively but allows many null e-mails", async () => {
    await newUser({ email: "Sara@Example.com" });
    await expectViolation(newUser({ email: "sara@example.com" }), /users_email_lower_key/);
    await newUser();
    await newUser();
  });

  it("requires an e-mail before a password and ties deletion to status", async () => {
    await expectViolation(newUser({ password_hash: "x" }), /users_password_needs_email/);
    await expectViolation(newUser({ status: "pending_deletion" }), /users_deletion_matches_status/);
    await expectViolation(newUser({ deletion_requested_at: new Date() }), /users_deletion_matches_status/);
    const gone = await newUser({ status: "pending_deletion", deletion_requested_at: new Date() });
    expect(gone.status).toBe("pending_deletion");
  });

  it("bumps updated_at on update", async () => {
    const user = await newUser();
    await db.query("update users set updated_at = now() - interval '1 day' where id = $1", [user.id]);
    await db.query("update users set first_name = 'Nora' where id = $1", [user.id]);
    const after = await db.query("select updated_at from users where id = $1", [user.id]);
    expect(Date.now() - after.rows[0].updated_at.getTime()).toBeLessThan(60_000);
  });
});

describe("sessions", () => {
  async function session(userId, kind, token, revoked = null) {
    return db.query(
      `insert into sessions (user_id, kind, token_hash, expires_at, revoked_at, revoked_reason)
       values ($1, $2, $3, now() + interval '1 day', $4, $5)`,
      [userId, kind, token, revoked ? new Date() : null, revoked],
    );
  }

  it("allows one active session per user and kind", async () => {
    const user = await newUser();
    await session(user.id, "learner", `t-${user.id}-1`);
    await expectViolation(session(user.id, "learner", `t-${user.id}-2`), /sessions_one_active/);
    await session(user.id, "admin", `t-${user.id}-3`);
    await expectViolation(session(user.id, "admin", `t-${user.id}-4`), /sessions_one_active/);
  });

  it("lets a replaced session coexist with the new active one", async () => {
    const user = await newUser();
    await session(user.id, "learner", `t-${user.id}-old`, "replaced");
    await session(user.id, "learner", `t-${user.id}-new`);
    const rows = await db.query("select count(*)::int as n from sessions where user_id = $1", [user.id]);
    expect(rows.rows[0].n).toBe(2);
  });

  it("validates kind, revoke reason and token uniqueness", async () => {
    const user = await newUser();
    await expectViolation(session(user.id, "superuser", `t-${user.id}-a`), /sessions_kind_valid/);
    await expectViolation(session(user.id, "learner", `t-${user.id}-b`, "because"), /sessions_revoked_reason_valid/);
    for (const [i, reason] of ["logout", "replaced", "admin_force", "blocked", "deleted"].entries()) {
      await session(user.id, "learner", `t-${user.id}-r${i}`, reason);
    }
    await expectViolation(session(user.id, "learner", `t-${user.id}-r0`, "logout"), /sessions_token_hash_key/);
  });

  it("is removed with its user", async () => {
    const user = await newUser();
    await session(user.id, "learner", `t-${user.id}-c`);
    await db.query("delete from users where id = $1", [user.id]);
    const rows = await db.query("select count(*)::int as n from sessions where user_id = $1", [user.id]);
    expect(rows.rows[0].n).toBe(0);
  });
});

describe("otp tables", () => {
  it("restricts purposes and attempts", async () => {
    const insert = (purpose, attempts = 0) => db.query(
      "insert into otp_codes (phone, purpose, code_hash, expires_at) values ('09120000009', $1, 'h', now() + interval '2 minutes')",
      [purpose],
    ).then(() => attempts);
    for (const purpose of ["login", "change_phone", "delete_account", "admin_login"]) await insert(purpose);
    await expectViolation(insert("signup"), /otp_codes_purpose_valid/);
    await expectViolation(
      db.query("insert into otp_codes (phone, purpose, code_hash, expires_at, attempts) values ('09120000009', 'login', 'h', now(), -1)"),
      /otp_codes_attempts_nonnegative/,
    );
  });

  it("keeps a single lock per phone and purpose", async () => {
    await db.query("insert into otp_locks (phone, purpose, locked_until) values ('09120000010', 'login', now())");
    await expectViolation(
      db.query("insert into otp_locks (phone, purpose, locked_until) values ('09120000010', 'login', now())"),
      /otp_locks_pkey/,
    );
  });
});

describe("learner_profiles", () => {
  async function profile(fields = {}) {
    const user = await newUser();
    const row = { user_id: user.id, ...fields };
    const keys = Object.keys(row);
    return db.query(
      `insert into learner_profiles (${keys.join(", ")}) values (${keys.map((_, i) => `$${i + 1}`).join(", ")}) returning *`,
      keys.map((key) => row[key]),
    );
  }

  it("defaults: auto path, reminders on at 19:00, no study days, not onboarded", async () => {
    const { rows } = await profile();
    expect(rows[0]).toMatchObject({ plan_path: "auto", reminder_sms_enabled: true, reminder_time: "19:00:00", study_days: [] });
    expect(rows[0].onboarding_completed_at).toBeNull();
  });

  it("accepts only half-band targets between 5.5 and 8.5 (or null)", async () => {
    for (const band of [5.5, 6, 6.5, 7, 7.5, 8, 8.5]) expect((await profile({ target_band: band })).rows[0].target_band).toBe(String(band.toFixed(1)));
    for (const band of [5, 9, 6.25, 8.6]) {
      await expectViolation(profile({ target_band: band }), /learner_profiles_target_band_valid/);
    }
    expect((await profile({ target_band: null })).rows[0].target_band).toBeNull();
  });

  it("validates exam type, precision, minutes, study days and path", async () => {
    await expectViolation(profile({ exam_type: "ukvi" }), /learner_profiles_exam_type_valid/);
    await expectViolation(profile({ exam_date_precision: "soon" }), /learner_profiles_precision_valid/);
    await expectViolation(profile({ daily_minutes: 5 }), /learner_profiles_daily_minutes_valid/);
    await expectViolation(profile({ daily_minutes: 300 }), /learner_profiles_daily_minutes_valid/);
    await expectViolation(profile({ study_days: [0, 7] }), /learner_profiles_study_days_valid/);
    await expectViolation(profile({ plan_path: "turbo" }), /learner_profiles_plan_path_valid/);
    expect((await profile({ study_days: [0, 2, 4], daily_minutes: 45, plan_path: "sprint" })).rows[0].study_days).toEqual([0, 2, 4]);
  });

  it("keeps exam_date consistent with its precision", async () => {
    await expectViolation(profile({ exam_date: "2027-03-01" }), /learner_profiles_date_matches_precision/);
    await expectViolation(profile({ exam_date_precision: "exact" }), /learner_profiles_date_matches_precision/);
    await expectViolation(profile({ exam_date_precision: "unknown", exam_date: "2027-03-01" }), /learner_profiles_date_matches_precision/);
    await profile({ exam_date_precision: "exact", exam_date: "2027-03-14" });
    await profile({ exam_date_precision: "approx", exam_date: "2027-03-01" });
    await profile({ exam_date_precision: "unknown" });
  });

  it("only allows completing onboarding when every required step is filled", async () => {
    await expectViolation(profile({ onboarding_completed_at: new Date() }), /learner_profiles_onboarding_complete/);
    const complete = await profile({
      exam_type: "academic", target_band: null, exam_date_precision: "unknown",
      daily_minutes: 30, study_days: [0, 1], onboarding_completed_at: new Date(),
    });
    expect(complete.rows[0].onboarding_completed_at).toBeInstanceOf(Date);
    await expectViolation(
      profile({ exam_type: "academic", exam_date_precision: "unknown", daily_minutes: 30, onboarding_completed_at: new Date() }),
      /learner_profiles_onboarding_complete/,
    );
  });

  it("is removed with its user", async () => {
    const { rows } = await profile();
    await db.query("delete from users where id = $1", [rows[0].user_id]);
    const left = await db.query("select count(*)::int as n from learner_profiles where user_id = $1", [rows[0].user_id]);
    expect(left.rows[0].n).toBe(0);
  });
});

describe("sms_messages", () => {
  function sms(userId, purpose, day, status = "sent") {
    return db.query(
      `insert into sms_messages (user_id, phone_masked, template_key, status, purpose, sent_on_tehran_day)
       values ($1, '0912***4567', 'tpl', $2, $3, $4)`,
      [userId, status, purpose, day],
    );
  }

  it("allows one study reminder per user per Tehran day only", async () => {
    const user = await newUser();
    const other = await newUser();
    await sms(user.id, "study_reminder", "2026-11-10");
    await expectViolation(sms(user.id, "study_reminder", "2026-11-10"), /sms_one_study_reminder_per_day/);
    await sms(user.id, "study_reminder", "2026-11-11");
    await sms(other.id, "study_reminder", "2026-11-10");
  });

  it("does not limit other purposes", async () => {
    const user = await newUser();
    await sms(user.id, "otp", "2026-11-10");
    await sms(user.id, "otp", "2026-11-10");
    await sms(user.id, "renewal_reminder", "2026-11-10");
  });

  it("validates status and keeps the log when the user is deleted", async () => {
    const user = await newUser();
    await expectViolation(sms(user.id, "otp", "2026-11-10", "delivered"), /sms_messages_status_valid/);
    await sms(user.id, "otp", "2026-11-10");
    await db.query("delete from users where id = $1", [user.id]);
    const rows = await db.query("select user_id from sms_messages where phone_masked = '0912***4567' and user_id is null");
    expect(rows.rows.length).toBeGreaterThan(0);
  });
});

describe("notifications, streaks, settings", () => {
  it("cascades notifications and streaks with the user", async () => {
    const user = await newUser();
    await db.query("insert into notifications (user_id, kind, title, body) values ($1, 'info', 't', 'b')", [user.id]);
    await db.query("insert into user_streaks (user_id, current, best, last_active_day) values ($1, 3, 5, '2026-11-10')", [user.id]);
    await db.query("delete from users where id = $1", [user.id]);
    const n = await db.query("select count(*)::int as n from notifications where user_id = $1", [user.id]);
    const s = await db.query("select count(*)::int as n from user_streaks where user_id = $1", [user.id]);
    expect([n.rows[0].n, s.rows[0].n]).toEqual([0, 0]);
  });

  it("rejects an inconsistent streak", async () => {
    const user = await newUser();
    await expectViolation(
      db.query("insert into user_streaks (user_id, current, best) values ($1, 5, 3)", [user.id]),
      /user_streaks_values_valid/,
    );
  });

  it("stores jsonb settings and keeps the setting when its editor is deleted", async () => {
    const user = await newUser();
    await db.query("insert into system_settings (key, value, updated_by) values ('t.flag', '{\"a\":1}'::jsonb, $1)", [user.id]);
    await db.query("delete from users where id = $1", [user.id]);
    const row = await db.query("select value, updated_by from system_settings where key = 't.flag'");
    expect(row.rows[0]).toEqual({ value: { a: 1 }, updated_by: null });
  });
});

describe("integration with the core helpers", () => {
  it("writes audit rows through audit()", async () => {
    const id = await audit(db, { action: "t.created", actorRole: "super_admin", meta: { phone: "09121234567", otp: "12345" } });
    const row = await db.query("select meta from audit_logs where id = $1", [id]);
    expect(row.rows[0].meta).toEqual({ phone: "0912***4567", otp: "[redacted]" });
  });

  it("records job runs through the job runner", async () => {
    const runner = createJobRunner({ db, logger: { info() {}, warn() {}, error() {} } });
    runner.register("otp-cleanup", { handler: async () => ({ deleted: 0 }) });
    expect((await runner.runJob("otp-cleanup")).status).toBe("ok");
    const rows = await db.query("select status from job_runs where job = 'otp-cleanup'");
    expect(rows.rows.map((r) => r.status)).toEqual(["ok"]);
  });

  it("counts hits through consumeLimit on the rate_limits table", async () => {
    expect((await consumeLimit(db, "t:rl", 2, 60)).ok).toBe(true);
    expect((await consumeLimit(db, "t:rl", 2, 60)).ok).toBe(true);
    expect((await consumeLimit(db, "t:rl", 2, 60)).ok).toBe(false);
  });
});
