import { describe, expect, it } from "vitest";
import { assertSafeCliTarget } from "./cli-guard.js";

describe("assertSafeCliTarget", () => {
  it("allows PGlite and an unset url", () => {
    expect(() => assertSafeCliTarget("pglite:./data/x", {})).not.toThrow();
    expect(() => assertSafeCliTarget("", {})).not.toThrow();
    expect(() => assertSafeCliTarget(undefined, {})).not.toThrow();
  });

  it("allows a local PostgreSQL", () => {
    expect(() => assertSafeCliTarget("postgres://u:p@localhost:5432/db", {})).not.toThrow();
    expect(() => assertSafeCliTarget("postgresql://u:p@127.0.0.1/db", {})).not.toThrow();
  });

  it("refuses a remote PostgreSQL unless explicitly allowed", () => {
    const url = "postgres://user:secret@db.example.com:5432/app";
    expect(() => assertSafeCliTarget(url, {})).toThrow(/DB_CLI_ALLOW_REMOTE/);
    expect(() => assertSafeCliTarget(url, { DB_CLI_ALLOW_REMOTE: "1" })).not.toThrow();
  });

  it("never puts the url or password in the message", () => {
    const url = "postgres://user:topsecret@db.example.com/app";
    try {
      assertSafeCliTarget(url, {});
      throw new Error("should have thrown");
    } catch (error) {
      expect(String(error.message)).not.toContain("topsecret");
      expect(String(error.message)).not.toContain("db.example.com");
    }
  });
});
