/* global fetch */
// Integration-test harness: in-memory PGlite (all migrations), the real createApi
// behind a real HTTP listener, a controllable clock, a recording SMS stub, and
// cookie-jar clients that stand in for devices. Not a test file itself.
import express from "express";
import { createMigratedDb } from "../../db/test-helpers.js";
import { createApi } from "../api.js";
import { resetLimits } from "../rate-limit.js";

export const TEST_SECRETS = Object.freeze({ SESSION_SECRET: "s".repeat(48), OTP_PEPPER: "p".repeat(48) });

/** @param {{config?: Record<string, any>}} [options] */
export async function createTestApp({ config = {} } = {}) {
  const db = await createMigratedDb();
  let time = Date.now();
  const clock = {
    now: () => new Date(time),
    advance: (seconds) => {
      time += seconds * 1000;
    },
  };
  /** @type {Array<{phone: string, code: string}>} */
  const sent = [];
  const sms = {
    async sendVerify(phone, _template, params) {
      sent.push({ phone, code: params.CODE });
      return { providerMessageId: "test", mode: "console" };
    },
  };
  const app = express();
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  app.use(createApi(db, { config: { NODE_ENV: "test", ...TEST_SECRETS, ...config }, sms, now: clock.now }));
  app.use((_req, res) => res.status(200).send("spa-fallback"));

  /** A device: remembers cookies between requests. */
  function client() {
    const jar = new Map();
    return {
      jar,
      cookieHeader: () => [...jar].map(([k, v]) => `${k}=${v}`).join("; "),
      /**
       * @param {string} method @param {string} path
       * @param {{body?: unknown, headers?: Record<string, string>, origin?: string|null}} [options]
       */
      async request(method, path, { body, headers = {}, origin = base } = {}) {
        const finalHeaders = { ...headers };
        if (body !== undefined) finalHeaders["content-type"] = "application/json";
        if (origin !== null && method !== "GET") finalHeaders.origin = origin;
        const cookie = [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
        if (cookie) finalHeaders.cookie = cookie;
        const response = await fetch(`${base}${path}`, {
          method,
          headers: finalHeaders,
          body: body === undefined ? undefined : JSON.stringify(body),
          redirect: "manual",
        });
        const setCookies = response.headers.getSetCookie();
        for (const line of setCookies) {
          const [pair, ...attrs] = line.split(";");
          const eq = pair.indexOf("=");
          const name = pair.slice(0, eq).trim();
          const value = pair.slice(eq + 1).trim();
          const expired = attrs.some((a) => /^\s*max-age=0\s*$/i.test(a) || /^\s*expires=thu, 01 jan 1970/i.test(a));
          if (value === "" || expired) jar.delete(name);
          else jar.set(name, value);
        }
        const text = await response.text();
        let json = null;
        try {
          json = JSON.parse(text);
        } catch {
          // non-JSON body (e.g. SPA fallback)
        }
        return { status: response.status, json, text, headers: response.headers, setCookies };
      },
    };
  }

  /** Request + verify an OTP for `phone` on `device`; returns the verify response. */
  async function loginWithOtp(device, phone) {
    clock.advance(61);
    const requested = await device.request("POST", "/api/auth/otp/request", { body: { phone } });
    if (requested.status !== 200) throw new Error(`otp request failed: ${requested.status} ${requested.text}`);
    const { code } = sent.findLast((s) => s.phone === phone);
    return device.request("POST", "/api/auth/otp/verify", { body: { phone, code } });
  }

  /** Full sign-up of a new learner on `device`. */
  async function signUp(device, phone, { firstName = "Sara", lastName = "Ahmadi", referralCode } = {}) {
    const verified = await loginWithOtp(device, phone);
    if (!verified.json?.signupToken) throw new Error(`expected signupToken, got ${verified.text}`);
    return device.request("POST", "/api/auth/register", {
      body: { signupToken: verified.json.signupToken, firstName, lastName, ...(referralCode ? { referralCode } : {}) },
    });
  }

  return {
    db,
    base,
    clock,
    sent,
    client,
    loginWithOtp,
    signUp,
    lastCodeFor: (phone) => sent.findLast((s) => s.phone === phone)?.code,
    resetLimits: () => resetLimits(db),
    async close() {
      server.closeAllConnections?.();
      await new Promise((resolve) => server.close(resolve));
      await db.close();
    },
  };
}

let phoneSeq = 0;
/** A fresh, valid-looking Iranian mobile number. */
export const freshPhone = () => `0935${String(1000000 + (phoneSeq += 1))}`;
