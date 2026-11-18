import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { describe, expect, it } from "vitest";
import { clientPage, isClientRoute } from "./client-page.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("client routes", () => {
  it("allows the public pages and the panels, and refuses an unknown path", () => {
    for (const route of ["/", "/login", "/signup", "/terms", "/privacy", "/refund", "/app", "/app/practice", "/admin", "/admin/review"]) {
      expect(isClientRoute(route)).toBe(true);
    }
    expect(isClientRoute("/nope")).toBe(false);
    expect(isClientRoute("/application")).toBe(false);
    expect(isClientRoute("/api/health")).toBe(false);
  });
});

describe("client page", () => {
  async function start(assetPassthrough = false) {
    const app = express();
    app.use(clientPage({
      assetPassthrough,
      sendIndex: (_req, res) => {
        res.status(200).type("html").send("page");
      },
    }));
    app.use((_req, res) => {
      res.status(200).type("text/plain").send("asset");
    });
    const server = await new Promise((resolve) => {
      const listening = app.listen(0, "127.0.0.1", () => resolve(listening));
    });
    return {
      base: `http://127.0.0.1:${server.address().port}`,
      close: () => new Promise((resolve) => server.close(resolve)),
    };
  }

  it("returns 404 for an unknown path and noindex only on the panels", async () => {
    const app = await start();
    try {
      const nope = await fetch(`${app.base}/nope`);
      expect(nope.status).toBe(404);

      const home = await fetch(`${app.base}/`);
      expect(home.status).toBe(200);
      expect(home.headers.get("x-robots-tag")).toBeNull();

      const panel = await fetch(`${app.base}/app/practice`);
      expect(panel.status).toBe(200);
      expect(panel.headers.get("x-robots-tag")).toBe("noindex");

      const admin = await fetch(`${app.base}/admin`);
      expect(admin.headers.get("x-robots-tag")).toBe("noindex");

      const legal = await fetch(`${app.base}/terms`);
      expect(legal.status).toBe(200);
      expect(legal.headers.get("x-robots-tag")).toBeNull();
    } finally {
      await app.close();
    }
  });

  it("lets asset paths through when the dev server still has to serve them", async () => {
    const app = await start(true);
    try {
      const source = await fetch(`${app.base}/src/main.tsx`);
      expect(source.status).toBe(200);
      expect(await source.text()).toBe("asset");
    } finally {
      await app.close();
    }
  });
});

describe("public seo files", () => {
  it("serves robots.txt as text and lists only the public pages", async () => {
    const app = express();
    app.use(express.static(path.join(root, "public")));
    const server = await new Promise((resolve) => {
      const listening = app.listen(0, "127.0.0.1", () => resolve(listening));
    });
    try {
      const base = `http://127.0.0.1:${server.address().port}`;
      const robots = await fetch(`${base}/robots.txt`);
      expect(robots.status).toBe(200);
      expect(robots.headers.get("content-type")).toMatch(/text\/plain/);
      expect(await robots.text()).toContain("https://bandoraacademy.ir/sitemap.xml");

      const sitemap = await fetch(`${base}/sitemap.xml`);
      const xml = await sitemap.text();
      for (const loc of [
        "https://bandoraacademy.ir/",
        "https://bandoraacademy.ir/terms",
        "https://bandoraacademy.ir/privacy",
        "https://bandoraacademy.ir/refund",
      ]) {
        expect(xml).toContain(`<loc>${loc}</loc>`);
      }
      expect(xml).not.toContain("/app");
      expect(xml).not.toContain("/admin");
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it("drops the prototype word and adds canonical plus open graph", () => {
    const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
    expect(html).not.toContain("پروتوتایپ");
    expect(html).toContain('rel="canonical" href="https://bandoraacademy.ir/"');
    expect(html).toContain('property="og:title"');
    expect(html).toContain('property="og:description"');
    expect(html).toContain('property="og:url" content="https://bandoraacademy.ir/"');
    expect(html).not.toMatch(/<body[\s\S]*پروتوتایپ/);
  });
});
