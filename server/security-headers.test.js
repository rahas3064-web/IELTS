/* global fetch */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { describe, expect, it } from "vitest";
import { CONTENT_SECURITY_POLICY, securityHeaders } from "./security-headers.js";

const ENAMAD_IMG_ORIGIN = "https://trustseal.enamad.ir";

const PRODUCTION_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  `img-src 'self' data: blob: ${ENAMAD_IMG_ORIGIN}`,
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

function directive(policy, name) {
  return policy.split(";").map((part) => part.trim()).find((part) => part === name || part.startsWith(`${name} `)) ?? "";
}

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => {
      resolve({
        base: `http://127.0.0.1:${server.address().port}`,
        close: () => new Promise((done) => server.close(done)),
      });
    });
  });
}

describe("production content security policy", () => {
  it("allows the eNamad seal image and leaves every other directive unchanged", () => {
    expect(CONTENT_SECURITY_POLICY).toBe(PRODUCTION_CSP);
    expect(directive(CONTENT_SECURITY_POLICY, "img-src")).toBe(`img-src 'self' data: blob: ${ENAMAD_IMG_ORIGIN}`);
    expect(CONTENT_SECURITY_POLICY).not.toContain("*");
    expect(directive(CONTENT_SECURITY_POLICY, "script-src")).toBe("script-src 'self'");
    expect(directive(CONTENT_SECURITY_POLICY, "connect-src")).toBe("connect-src 'self'");
    expect(directive(CONTENT_SECURITY_POLICY, "default-src")).toBe("default-src 'self'");

    const serverSource = fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../server.js"), "utf8");
    expect(serverSource).toContain('from "./server/security-headers.js"');
    expect(serverSource).toContain("securityHeaders({ production: isProd })");
    expect(serverSource).not.toContain("Content-Security-Policy");
  });

  it("sends that policy only in production", async () => {
    const prod = express();
    prod.use(securityHeaders({ production: true }));
    prod.get("/", (_req, res) => res.send("ok"));
    const dev = express();
    dev.use(securityHeaders({ production: false }));
    dev.get("/", (_req, res) => res.send("ok"));

    const prodServer = await listen(prod);
    const devServer = await listen(dev);
    try {
      const prodResponse = await fetch(prodServer.base);
      expect(prodResponse.headers.get("content-security-policy")).toBe(PRODUCTION_CSP);
      expect(prodResponse.headers.get("x-content-type-options")).toBe("nosniff");
      expect(prodResponse.headers.get("x-frame-options")).toBe("DENY");
      expect(prodResponse.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
      expect(prodResponse.headers.get("permissions-policy")).toBe("camera=(), microphone=(self), geolocation=(), payment=()");
      expect(prodResponse.headers.get("strict-transport-security")).toBe("max-age=15552000; includeSubDomains");

      const devResponse = await fetch(devServer.base);
      expect(devResponse.headers.get("content-security-policy")).toBeNull();
      expect(devResponse.headers.get("strict-transport-security")).toBeNull();
      expect(devResponse.headers.get("x-frame-options")).toBe("DENY");
    } finally {
      await prodServer.close();
      await devServer.close();
    }
  });
});
