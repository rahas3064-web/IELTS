import { describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { clientAddress, consumeLimit } from "./rate-limit.js";

function adapter(pg) {
  return {
    async query(sql, params) {
      return pg.query(sql, params);
    },
  };
}

describe("shared rate limit", () => {
  it("uses the database for two callers and fails closed when storage fails", async () => {
    const pg = new PGlite();
    const db = adapter(pg);
    await db.query(`create table rate_limits (
      bucket text not null,
      window_start timestamptz not null,
      hits integer not null check (hits >= 0),
      primary key (bucket, window_start)
    )`);
    const other = adapter(pg);
    expect((await consumeLimit(db, "login:email:one@example.com", 2, 900)).ok).toBe(true);
    expect((await consumeLimit(other, "login:email:one@example.com", 2, 900)).ok).toBe(true);
    expect((await consumeLimit(db, "login:email:one@example.com", 2, 900)).ok).toBe(false);
    const failed = await consumeLimit({ query: async () => { throw new Error("down"); } }, "login:email:one@example.com", 2, 900);
    expect(failed).toEqual({ ok: false, unavailable: true });
  });

  it("does not read a caller-supplied forwarding header", () => {
    const req = {
      app: { get: () => false },
      ip: "203.0.113.5",
      socket: { remoteAddress: "10.0.0.8" },
      headers: { "x-forwarded-for": "203.0.113.5" },
    };
    expect(clientAddress(req)).toBe("10.0.0.8");
  });
});
