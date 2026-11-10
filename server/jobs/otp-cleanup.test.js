import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createMigratedDb, insert } from "../../db/test-helpers.js";
import { runOtpCleanup } from "./otp-cleanup.js";

let db;
beforeAll(async () => {
  db = await createMigratedDb();
});
afterAll(() => db.close());
beforeEach(async () => {
  await db.query("delete from otp_codes");
  await db.query("delete from otp_locks");
});

const NOW = new Date("2026-11-10T12:00:00Z");
const ago = (hours) => new Date(NOW.getTime() - hours * 3600_000);
const code = (phone, fields) =>
  insert(db, "otp_codes", { phone, purpose: "login", code_hash: "h", expires_at: ago(0), last_sent_at: ago(0), created_at: ago(0), ...fields });
const phonesLeft = async () => (await db.query("select phone from otp_codes order by phone")).rows.map((r) => r.phone);

describe("runOtpCleanup", () => {
  it("deletes expired and consumed codes older than one day", async () => {
    await code("09000000001", { created_at: ago(30), expires_at: ago(30) }); // old + expired
    await code("09000000002", { created_at: ago(30), expires_at: ago(30), consumed_at: ago(30) }); // old + consumed
    await code("09000000003", { created_at: ago(30), expires_at: ago(-24), consumed_at: ago(29) }); // old, consumed, never expired
    const stats = await runOtpCleanup({ db, now: () => NOW });
    expect(stats).toMatchObject({ codes: 3 });
    expect(await phonesLeft()).toEqual([]);
  });

  it("keeps recent codes, even expired or consumed ones (rate limits and recent-OTP checks read them)", async () => {
    await code("09000000011", { created_at: ago(2), expires_at: ago(2) }); // recent + expired
    await code("09000000012", { created_at: ago(2), expires_at: ago(2), consumed_at: ago(2) }); // recent + consumed
    await code("09000000013", { created_at: ago(23), expires_at: ago(23) }); // just under a day
    await code("09000000014", { created_at: ago(30), expires_at: ago(-1) }); // old but still valid
    expect(await runOtpCleanup({ db, now: () => NOW })).toMatchObject({ codes: 0 });
    expect(await phonesLeft()).toEqual(["09000000011", "09000000012", "09000000013", "09000000014"]);
  });

  it("deletes only expired locks", async () => {
    await insert(db, "otp_locks", { phone: "09000000021", purpose: "login", locked_until: ago(1) });
    await insert(db, "otp_locks", { phone: "09000000022", purpose: "login", locked_until: ago(-1) });
    expect(await runOtpCleanup({ db, now: () => NOW })).toMatchObject({ locks: 1 });
    expect((await db.query("select phone from otp_locks")).rows).toEqual([{ phone: "09000000022" }]);
  });

  it("is idempotent", async () => {
    await code("09000000031", { created_at: ago(30), expires_at: ago(30) });
    await insert(db, "otp_locks", { phone: "09000000032", purpose: "login", locked_until: ago(5) });
    expect(await runOtpCleanup({ db, now: () => NOW })).toEqual({ codes: 1, locks: 1 });
    expect(await runOtpCleanup({ db, now: () => NOW })).toEqual({ codes: 0, locks: 0 });
  });

  it("accepts a fixed Date as well as a clock function", async () => {
    await code("09000000041", { created_at: ago(30), expires_at: ago(30) });
    expect(await runOtpCleanup({ db, now: NOW })).toMatchObject({ codes: 1 });
  });
});
