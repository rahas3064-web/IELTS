import fs from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ENV_SPEC } from "./env.js";

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", ".env.example");
const text = fs.readFileSync(file, "utf8");
const parsed = parseEnv(text);

describe(".env.example", () => {
  it("lists every variable of the env contract", () => {
    for (const { name } of ENV_SPEC) expect(Object.hasOwn(parsed, name), name).toBe(true);
  });

  it("holds no real secret values and no inline comment leaks into a value", () => {
    for (const { name, secret } of ENV_SPEC) {
      if (secret) expect(parsed[name], name).toBe("");
      expect(parsed[name], name).not.toContain("#");
    }
    expect(parsed.BALE_PAYMENT_PROVIDER_TOKEN).toBe("");
  });

  it("documents the Bale test token only as a comment", () => {
    const lines = text.split(/\r?\n/).filter((line) => line.includes("WALLET-TEST-1111111111111111"));
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) expect(line.slice(0, line.indexOf("WALLET")).includes("#")).toBe(true);
  });

  it("keeps safe dev defaults for non-secret settings", () => {
    expect(parsed).toMatchObject({
      NODE_ENV: "development",
      PORT: "3000",
      TZ: "Asia/Tehran",
      AVALAI_BASE_URL: "https://api.avalai.ir/v1",
      AVALAI_STT_MODEL: "whisper-1",
      BALE_PAYMENT_MODE: "test",
      BALE_PAYMENT_FLOW: "bot_chat",
    });
  });
});
