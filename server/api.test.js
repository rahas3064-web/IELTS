/* global fetch */
import express from "express";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApi } from "./api.js";

let server;
let base;

beforeAll(async () => {
  const app = express();
  app.use(createApi({ query: async () => ({ rows: [] }) }));
  app.use((_req, res) => res.status(200).send("spa-fallback"));
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

describe("createApi", () => {
  it("answers GET /api/health with ok and an ISO time", async () => {
    const response = await fetch(`${base}/api/health`);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(Object.keys(body).sort()).toEqual(["ok", "time"]);
    expect(body.ok).toBe(true);
    expect(new Date(body.time).toISOString()).toBe(body.time);
  });

  it("returns the uniform error shape for unknown API routes", async () => {
    const response = await fetch(`${base}/api/nope`);
    expect(response.status).toBe(404);
    const { error } = await response.json();
    expect(error.code).toBe("not_found");
    expect(error.message_fa).toBeTruthy();
    expect(error.message_en).toBeTruthy();
  });

  it("does not expose any of the old routes", async () => {
    for (const [method, route] of [
      ["GET", "/api/learner"],
      ["PUT", "/api/learner"],
      ["POST", "/api/auth/signup"],
      ["POST", "/api/auth/login"],
      ["POST", "/api/placement"],
      ["POST", "/api/mocks/m1"],
      ["POST", "/api/assistant"],
      ["GET", "/api/admin/users"],
    ]) {
      const response = await fetch(`${base}${route}`, { method, headers: { "content-type": "application/json" }, body: method === "GET" ? undefined : "{}" });
      expect(response.status, `${method} ${route}`).toBe(404);
    }
  });

  it("mounts the billing API behind a session (no anonymous access)", async () => {
    for (const [method, route] of [["GET", "/api/billing"], ["GET", "/api/billing/plans"]]) {
      const response = await fetch(`${base}${route}`, { method });
      expect(response.status, `${method} ${route}`).toBe(401);
    }
  });

  it("maps a malformed JSON body to validation_failed instead of leaking a stack", async () => {
    const response = await fetch(`${base}/api/health`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not json",
    });
    expect(response.status).toBe(400);
    const text = await response.text();
    expect(JSON.parse(text).error.code).toBe("validation_failed");
    expect(text).not.toMatch(/SyntaxError|at \w+ \(/);
  });

  it("leaves non-API paths to the next handler (SPA fallback)", async () => {
    const response = await fetch(`${base}/app/dashboard`);
    expect(await response.text()).toBe("spa-fallback");
  });
});
