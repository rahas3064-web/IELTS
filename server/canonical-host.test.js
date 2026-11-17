import http from "node:http";
import { describe, expect, it } from "vitest";
import { createTestApp, freshPhone } from "./test-support/http-app.js";

const CANONICAL = "https://bandoraacademy.ir";
const RAILWAY = "ielts-production-41002be0.up.railway.app";

function request(base, { method = "GET", path = "/", host, headers = {} }) {
  const url = new URL(base);
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      method,
      path,
      headers: { host, ...headers },
    }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString();
        let json = null;
        try {
          json = JSON.parse(text);
        } catch {
          json = null;
        }
        resolve({ status: res.statusCode, location: res.headers.location, json, text });
      });
    });
    req.on("error", reject);
    req.end();
  });
}

describe("canonical host", () => {
  it("redirects the Railway host and www to APP_BASE_URL, and leaves health and the canonical host alone", async () => {
    const app = await createTestApp({ config: { NODE_ENV: "production", APP_BASE_URL: CANONICAL } });
    try {
      const page = await request(app.base, { path: "/app?from=old", host: RAILWAY });
      expect(page.status).toBe(301);
      expect(page.location).toBe(`${CANONICAL}/app?from=old`);

      const www = await request(app.base, { path: "/plans", host: "www.bandoraacademy.ir" });
      expect(www.status).toBe(301);
      expect(www.location).toBe(`${CANONICAL}/plans`);

      const health = await request(app.base, { path: "/api/health", host: RAILWAY });
      expect(health.status).toBe(200);
      expect(health.json.ok).toBe(true);

      const home = await request(app.base, { path: "/app", host: "bandoraacademy.ir" });
      expect(home.status).toBe(200);
    } finally {
      await app.close();
    }
  });

  it("does not redirect a POST, and a foreign Origin on the canonical host is still forbidden", async () => {
    const app = await createTestApp({ config: { NODE_ENV: "production", APP_BASE_URL: CANONICAL } });
    try {
      const posted = await request(app.base, {
        method: "POST",
        path: "/api/auth/otp/request",
        host: RAILWAY,
        headers: { origin: CANONICAL, "content-type": "application/json" },
      });
      expect(posted.status).toBe(421);
      expect(posted.location).toBeUndefined();

      const foreign = await app.client().request("POST", "/api/auth/otp/request", {
        body: { phone: freshPhone() },
        origin: "https://evil.example",
      });
      expect(foreign.status).toBe(403);
    } finally {
      await app.close();
    }
  });

  it("stays on the current host outside production", async () => {
    const app = await createTestApp({ config: { APP_BASE_URL: CANONICAL } });
    try {
      const page = await request(app.base, { path: "/app", host: RAILWAY });
      expect(page.status).toBe(200);
    } finally {
      await app.close();
    }
  });
});
