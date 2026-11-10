import { describe, expect, it } from "vitest";
import { hashPassword, needsRehash, verifyPassword } from "./passwords.js";
import { scrypt } from "node:crypto";
import { promisify } from "node:util";

describe("passwords", () => {
  it("accepts the password that was hashed and rejects a different one", async () => {
    const stored = await hashPassword("demo-pass-1");
    expect(stored.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("demo-pass-1", stored)).toBe(true);
    expect(await verifyPassword("demo-pass-2", stored)).toBe(false);
    expect(await verifyPassword("demo-pass-1", "plain")).toBe(false);
    expect(needsRehash(stored)).toBe(false);
  });

  it("keeps an older hash valid and marks it for a later rehash", async () => {
    const salt = "aabbccddeeff00112233445566778899";
    const derived = await promisify(scrypt)("demo-pass-1", salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
    const legacy = `scrypt$${salt}$${Buffer.from(derived).toString("hex")}`;
    expect(await verifyPassword("demo-pass-1", legacy)).toBe(true);
    expect(needsRehash(legacy)).toBe(true);
    expect(await verifyPassword("other-pass-1", legacy)).toBe(false);
  });
});
