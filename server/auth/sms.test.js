import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createMigratedDb } from "../../db/test-helpers.js";
import { createSmsSender } from "./sms.js";

const PROD_ENV = {
  NODE_ENV: "production",
  SMSIR_API_KEY: "key-should-never-leak",
  SMSIR_TEMPLATE_OTP: "123456",
};

let db;
beforeAll(async () => {
  db = await createMigratedDb();
});
afterAll(async () => {
  await db.close();
});
beforeEach(async () => {
  await db.query("delete from sms_messages");
});

const jsonResponse = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const makeLogger = () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() });
const rows = async () => (await db.query("select * from sms_messages order by created_at")).rows;

describe("dev console mode", () => {
  it("prints a masked phone and the code instead of sending, outside production", async () => {
    const fetchImpl = vi.fn();
    const logger = makeLogger();
    const sender = createSmsSender({ env: { NODE_ENV: "development" }, db, fetchImpl, logger });
    await sender.sendVerify("09121234567", "otp", { CODE: "48213" });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith("[dev-sms] 0912***4567 code=48213");
    const [row] = await rows();
    expect(row.phone_masked).toBe("0912***4567");
    expect(row.status).toBe("sent");
    expect(row.purpose).toBe("otp");
    expect(JSON.stringify(row)).not.toContain("48213");
  });

  it("also prints when SMS_DEV_CONSOLE is true in production (explicit opt-in)", async () => {
    const fetchImpl = vi.fn();
    const logger = makeLogger();
    const sender = createSmsSender({ env: { ...PROD_ENV, SMS_DEV_CONSOLE: true }, db, fetchImpl, logger });
    await sender.sendVerify("09121234567", "otp", { CODE: "11111" });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith("[dev-sms] 0912***4567 code=11111");
  });

  it("never prints the code in production live mode", async () => {
    const logger = makeLogger();
    const fetchImpl = vi.fn(async () => jsonResponse(200, { status: 1, data: { messageId: 77 } }));
    const sender = createSmsSender({ env: { ...PROD_ENV, SMS_DEV_CONSOLE: false }, db, fetchImpl, logger });
    await sender.sendVerify("09121234567", "otp", { CODE: "99999" });
    const logged = JSON.stringify([...logger.info.mock.calls, ...logger.warn.mock.calls, ...logger.error.mock.calls]);
    expect(logged).not.toContain("99999");
  });

  it("sends via SMS.ir in development when SMS_DEV_CONSOLE is false and does not print the code", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, { status: 1, data: { messageId: 88 } }));
    const logger = makeLogger();
    const sender = createSmsSender({
      env: { NODE_ENV: "development", SMS_DEV_CONSOLE: false, SMSIR_API_KEY: "key-should-never-leak", SMSIR_TEMPLATE_OTP: "123456" },
      db,
      fetchImpl,
      logger,
    });
    const result = await sender.sendVerify("09121234567", "otp", { CODE: "48213" });
    expect(result).toEqual({ providerMessageId: "88", mode: "live" });
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body).parameters).toEqual([{ name: "CODE", value: "48213" }]);
    const logged = JSON.stringify([...logger.info.mock.calls, ...logger.warn.mock.calls, ...logger.error.mock.calls]);
    expect(logged).not.toContain("48213");
    expect(logged).not.toContain("key-should-never-leak");
  });

  it("treats the string false the same way, and does not print a code when SMS is not configured", async () => {
    const fetchImpl = vi.fn();
    const logger = makeLogger();
    const sender = createSmsSender({ env: { NODE_ENV: "development", SMS_DEV_CONSOLE: "false" }, db, fetchImpl, logger });
    await expect(sender.sendVerify("09121234567", "otp", { CODE: "48213" })).rejects.toMatchObject({ code: "sms_failed" });
    expect(fetchImpl).not.toHaveBeenCalled();
    const logged = JSON.stringify([...logger.info.mock.calls, ...logger.warn.mock.calls, ...logger.error.mock.calls]);
    expect(logged).not.toContain("48213");
    expect((await rows())[0].error).toBe("not_configured");
  });
});

describe("production live mode", () => {
  const env = { ...PROD_ENV, SMS_DEV_CONSOLE: false };

  it("calls the SMS.ir verify API and logs the provider message id", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, { status: 1, message: "ok", data: { messageId: 4242, cost: 1 } }));
    const sender = createSmsSender({ env, db, fetchImpl, logger: makeLogger() });
    const result = await sender.sendVerify("09121234567", "otp", { CODE: "12345" });
    expect(result.providerMessageId).toBe("4242");
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.sms.ir/v1/send/verify");
    expect(init.method).toBe("POST");
    expect(init.headers["x-api-key"]).toBe("key-should-never-leak");
    expect(JSON.parse(init.body)).toEqual({
      mobile: "09121234567",
      templateId: 123456,
      parameters: [{ name: "CODE", value: "12345" }],
    });
    const [row] = await rows();
    expect(row).toMatchObject({ status: "sent", provider_message_id: "4242", phone_masked: "0912***4567", template_key: "otp" });
  });

  it("retries once on a server error and succeeds", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(503, {}))
      .mockResolvedValueOnce(jsonResponse(200, { status: 1, data: { messageId: 1 } }));
    const sleep = vi.fn(async () => {});
    const sender = createSmsSender({ env, db, fetchImpl, logger: makeLogger(), sleep });
    await sender.sendVerify("09121234567", "otp", { CODE: "12345" });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect((await rows()).map((r) => r.status)).toEqual(["sent"]);
  });

  it("fails with sms_failed after two tries, without leaking the key or the code", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("connect failed key-should-never-leak 12345");
    });
    const logger = makeLogger();
    const sender = createSmsSender({ env, db, fetchImpl, logger, sleep: async () => {} });
    const error = await sender.sendVerify("09121234567", "otp", { CODE: "12345" }).catch((e) => e);
    expect(error.code).toBe("sms_failed");
    expect(error.status).toBe(502);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const [row] = await rows();
    expect(row.status).toBe("failed");
    const everything = JSON.stringify([row, error.message, error.details, logger.warn.mock.calls, logger.error.mock.calls]);
    expect(everything).not.toContain("key-should-never-leak");
    expect(everything).not.toContain("12345");
  });

  it("does not retry a 4xx client error", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(401, { message: "bad key" }));
    const sender = createSmsSender({ env, db, fetchImpl, logger: makeLogger(), sleep: async () => {} });
    await expect(sender.sendVerify("09121234567", "otp", { CODE: "12345" })).rejects.toMatchObject({ code: "sms_failed" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect((await rows())[0].error).toBe("http_401");
  });

  it("treats a provider body with status != 1 as a failure", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, { status: 0, message: "template missing" }));
    const sender = createSmsSender({ env, db, fetchImpl, logger: makeLogger(), sleep: async () => {} });
    await expect(sender.sendVerify("09121234567", "otp", { CODE: "12345" })).rejects.toMatchObject({ code: "sms_failed" });
  });

  it("refuses to send when production credentials are missing", async () => {
    const fetchImpl = vi.fn();
    const sender = createSmsSender({ env: { NODE_ENV: "production", SMS_DEV_CONSOLE: false }, db, fetchImpl, logger: makeLogger() });
    await expect(sender.sendVerify("09121234567", "otp", { CODE: "12345" })).rejects.toMatchObject({ code: "sms_failed" });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect((await rows())[0].error).toBe("not_configured");
  });
});

describe("sendTemplate (non-OTP templates)", () => {
  const live = { ...PROD_ENV, SMS_DEV_CONSOLE: false, SMSIR_TEMPLATE_STUDY_REMINDER: "777" };

  it("dev console prints a masked line without any code", async () => {
    const logger = makeLogger();
    const sender = createSmsSender({ env: { NODE_ENV: "development" }, db, fetchImpl: vi.fn(), logger });
    const result = await sender.sendTemplate("09121234567", "study_reminder", {});
    expect(result.mode).toBe("console");
    expect(logger.info).toHaveBeenCalledWith("[dev-sms] 0912***4567 template=study_reminder");
    expect(JSON.stringify(logger.info.mock.calls)).not.toContain("code=");
  });

  it("logs a row by default and skips the log when the caller owns the row", async () => {
    const sender = createSmsSender({ env: { NODE_ENV: "development" }, db, logger: makeLogger() });
    await sender.sendTemplate("09121234567", "study_reminder", {});
    expect((await rows()).map((r) => r.purpose)).toEqual(["study_reminder"]);
    await db.query("delete from sms_messages");
    await sender.sendTemplate("09121234567", "study_reminder", {}, { log: false });
    expect(await rows()).toEqual([]);
  });

  it("calls SMS.ir with the template id of the key and the given parameters", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, { status: 1, data: { messageId: 9 } }));
    const sender = createSmsSender({ env: live, db, fetchImpl, logger: makeLogger() });
    const result = await sender.sendTemplate("09121234567", "study_reminder", { NAME: "Sara" }, { log: false });
    expect(result).toEqual({ providerMessageId: "9", mode: "live" });
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({
      mobile: "09121234567",
      templateId: 777,
      parameters: [{ name: "NAME", value: "Sara" }],
    });
  });

  it("a failed send throws sms_failed and, with log:false, writes no row", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(401, {}));
    const sender = createSmsSender({ env: live, db, fetchImpl, logger: makeLogger(), sleep: async () => {} });
    await expect(sender.sendTemplate("09121234567", "study_reminder", {}, { log: false })).rejects.toMatchObject({ code: "sms_failed" });
    expect(await rows()).toEqual([]);
  });

  it("rejects unknown template keys and keeps sendVerify working as the OTP entry point", async () => {
    const sender = createSmsSender({ env: { NODE_ENV: "development" }, db, logger: makeLogger() });
    await expect(sender.sendTemplate("09121234567", "nope", {})).rejects.toThrow(TypeError);
    await sender.sendVerify("09121234567", "otp", { CODE: "12345" });
    expect((await rows()).map((r) => r.purpose)).toEqual(["otp"]);
  });
});
