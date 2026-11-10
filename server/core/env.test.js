import { describe, expect, it } from "vitest";
import { ENV_SPEC, assertEnv, featureStatus, redactEnv, validateEnv } from "./env.js";

const LONG = "x".repeat(32);
const prodEnv = {
  NODE_ENV: "production",
  DATABASE_URL: "postgres://user:pw@host/db",
  SESSION_SECRET: LONG,
  OTP_PEPPER: LONG.replace(/x/g, "y"),
  APP_BASE_URL: "https://bandora.ir",
};

describe("ENV_SPEC", () => {
  it("covers every variable in the spec with the right flags", () => {
    const names = ENV_SPEC.map((e) => e.name);
    for (const n of [
      "NODE_ENV", "PORT", "APP_BASE_URL", "DATABASE_URL", "SESSION_SECRET", "OTP_PEPPER", "TZ",
      "AVALAI_API_KEY", "AVALAI_BASE_URL", "AVALAI_MODEL", "AVALAI_SCORING_MODEL", "AVALAI_STT_MODEL",
      "AI_COST_PER_1K_INPUT_RIAL", "AI_COST_PER_1K_OUTPUT_RIAL",
      "SMSIR_API_KEY", "SMSIR_LINE_NUMBER", "SMSIR_TEMPLATE_OTP", "SMSIR_TEMPLATE_STUDY_REMINDER",
      "SMSIR_TEMPLATE_RENEWAL_REMINDER", "SMS_DEV_CONSOLE",
      "BALE_BOT_TOKEN", "BALE_BOT_USERNAME", "BALE_PAYMENT_PROVIDER_TOKEN", "BALE_PAYMENT_MODE",
      "BALE_PAYMENT_FLOW", "BALE_WEBHOOK_SECRET",
      "STORAGE_ENDPOINT", "STORAGE_BUCKET", "STORAGE_ACCESS_KEY", "STORAGE_SECRET_KEY",
      "ADMIN_BOOTSTRAP_PHONE",
    ]) {
      expect(names).toContain(n);
    }
    const required = ENV_SPEC.filter((e) => e.requiredInProduction).map((e) => e.name).sort();
    expect(required).toEqual(["APP_BASE_URL", "DATABASE_URL", "OTP_PEPPER", "SESSION_SECRET"]);
    const secrets = ENV_SPEC.filter((e) => e.secret).map((e) => e.name);
    for (const n of ["SESSION_SECRET", "OTP_PEPPER", "DATABASE_URL", "AVALAI_API_KEY", "SMSIR_API_KEY",
      "BALE_BOT_TOKEN", "BALE_PAYMENT_PROVIDER_TOKEN", "BALE_WEBHOOK_SECRET", "STORAGE_ACCESS_KEY",
      "STORAGE_SECRET_KEY"]) {
      expect(secrets).toContain(n);
    }
  });
});

describe("validateEnv (development)", () => {
  it("accepts an empty env and fills safe defaults", () => {
    const res = validateEnv({});
    expect(res.ok).toBe(true);
    expect(res.errors).toEqual([]);
    expect(res.config).toMatchObject({
      NODE_ENV: "development",
      PORT: 3000,
      TZ: "Asia/Tehran",
      AVALAI_BASE_URL: "https://api.avalai.ir/v1",
      AVALAI_STT_MODEL: "whisper-1",
      BALE_PAYMENT_MODE: "test",
      BALE_PAYMENT_FLOW: "bot_chat",
      SMS_DEV_CONSOLE: true,
    });
  });

  it("does not require secrets or enforce length in development", () => {
    expect(validateEnv({ SESSION_SECRET: "short" }).ok).toBe(true);
  });

  it("still rejects an invalid PORT", () => {
    const res = validateEnv({ PORT: "abc" });
    expect(res.ok).toBe(false);
    expect(res.errors.join(" ")).toContain("PORT");
  });

  it("parses SMS_DEV_CONSOLE booleans", () => {
    expect(validateEnv({ SMS_DEV_CONSOLE: "false" }).config.SMS_DEV_CONSOLE).toBe(false);
    expect(validateEnv({ SMS_DEV_CONSOLE: "true" }).config.SMS_DEV_CONSOLE).toBe(true);
  });

  it("treats blank values as unset", () => {
    expect(validateEnv({ PORT: "", AVALAI_BASE_URL: "  " }).config.AVALAI_BASE_URL)
      .toBe("https://api.avalai.ir/v1");
  });
});

describe("validateEnv (production)", () => {
  it("passes with all required vars", () => {
    const res = validateEnv(prodEnv);
    expect(res.ok).toBe(true);
    expect(res.config.PORT).toBe(3000);
  });

  it("reports missing required vars by name", () => {
    const res = validateEnv({ NODE_ENV: "production" });
    expect(res.ok).toBe(false);
    for (const n of ["DATABASE_URL", "SESSION_SECRET", "OTP_PEPPER", "APP_BASE_URL"]) {
      expect(res.errors.some((e) => e.includes(n))).toBe(true);
    }
  });

  it("rejects short SESSION_SECRET and OTP_PEPPER", () => {
    const res = validateEnv({ ...prodEnv, SESSION_SECRET: "short", OTP_PEPPER: "also-short" });
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => e.includes("SESSION_SECRET"))).toBe(true);
    expect(res.errors.some((e) => e.includes("OTP_PEPPER"))).toBe(true);
  });

  it("rejects SMS_DEV_CONSOLE=true in production (it would print OTP codes to the logs)", () => {
    const result = validateEnv({ ...prodEnv, SMS_DEV_CONSOLE: "true" });
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toMatch(/SMS_DEV_CONSOLE/);
    expect(validateEnv({ ...prodEnv, SMS_DEV_CONSOLE: "false" }).ok).toBe(true);
    expect(validateEnv({ SMS_DEV_CONSOLE: "true" }).ok).toBe(true);
  });

  it("treats ADMIN_BOOTSTRAP_PHONE as a secret in redactEnv", () => {
    const out = redactEnv({ ADMIN_BOOTSTRAP_PHONE: "09123456789" });
    expect(out.ADMIN_BOOTSTRAP_PHONE).toBe("***");
  });

  it("defaults SMS_DEV_CONSOLE to false so OTPs are never printed in production", () => {
    expect(validateEnv(prodEnv).config.SMS_DEV_CONSOLE).toBe(false);
  });

  it("rejects invalid PORT values", () => {
    for (const PORT of ["0", "70000", "-1", "3.5", "abc"]) {
      expect(validateEnv({ ...prodEnv, PORT }).ok).toBe(false);
    }
    expect(validateEnv({ ...prodEnv, PORT: "8080" }).config.PORT).toBe(8080);
  });

  it("never puts values in error strings", () => {
    const res = validateEnv({ ...prodEnv, SESSION_SECRET: "tiny-secret-value" });
    expect(res.errors.join(" ")).not.toContain("tiny-secret-value");
  });

  it("does not mutate the input env", () => {
    const env = Object.freeze({ ...prodEnv });
    expect(() => validateEnv(env)).not.toThrow();
  });
});

describe("assertEnv", () => {
  it("returns the config when valid", () => {
    expect(assertEnv(prodEnv).NODE_ENV).toBe("production");
  });

  it("throws listing names only, never values", () => {
    let error;
    try {
      assertEnv({ NODE_ENV: "production", SESSION_SECRET: "leaky-short-value" });
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toContain("DATABASE_URL");
    expect(error.message).toContain("SESSION_SECRET");
    expect(error.message).not.toContain("leaky-short-value");
  });
});

describe("redactEnv", () => {
  it("replaces secret values and keeps non-secret ones", () => {
    const out = redactEnv({
      NODE_ENV: "production",
      PORT: "3000",
      SESSION_SECRET: "abc",
      DATABASE_URL: "postgres://u:p@h/d",
      AVALAI_API_KEY: "k",
      UNRELATED_TOKEN: "t",
    });
    expect(out.SESSION_SECRET).toBe("***");
    expect(out.DATABASE_URL).toBe("***");
    expect(out.AVALAI_API_KEY).toBe("***");
    expect(out.NODE_ENV).toBe("production");
    expect(out.PORT).toBe("3000");
    expect(out.UNRELATED_TOKEN).toBeUndefined();
  });

  it("leaves unset secrets unset and does not mutate input", () => {
    const env = { SESSION_SECRET: "abc" };
    const out = redactEnv(env);
    expect(env.SESSION_SECRET).toBe("abc");
    expect(out).not.toBe(env);
    expect(redactEnv({}).SESSION_SECRET).toBeUndefined();
  });
});

describe("featureStatus", () => {
  it("reports each feature from its credentials", () => {
    expect(featureStatus(validateEnv({}).config)).toEqual({
      sms: true, // dev console mode
      ai: false,
      bale: false,
      storage: false,
    });
  });

  it("is true when the full credential sets are present", () => {
    const { config } = validateEnv({
      ...prodEnv,
      SMS_DEV_CONSOLE: "false",
      SMSIR_API_KEY: "a", SMSIR_LINE_NUMBER: "1", SMSIR_TEMPLATE_OTP: "2",
      AVALAI_API_KEY: "k", AVALAI_MODEL: "m",
      BALE_BOT_TOKEN: "t", BALE_PAYMENT_PROVIDER_TOKEN: "p",
      STORAGE_ENDPOINT: "e", STORAGE_BUCKET: "b", STORAGE_ACCESS_KEY: "a", STORAGE_SECRET_KEY: "s",
    });
    expect(featureStatus(config)).toEqual({ sms: true, ai: true, bale: true, storage: true });
  });

  it("sms is false in production without SMS.ir credentials", () => {
    const { config } = validateEnv({ ...prodEnv, SMS_DEV_CONSOLE: "false" });
    expect(featureStatus(config).sms).toBe(false);
  });
});
