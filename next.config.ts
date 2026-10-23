import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The prototype reads the clock and localStorage while rendering.
  // Cache Components treats `new Date()` as a blocking prerender, which fights
  // that model. Turn it off until a server owns the exam clock.
  // Browsers open 127.0.0.1. Next treats that host as cross-origin unless it
  // is listed, and then blocks the dev scripts the page needs to hydrate.
  allowedDevOrigins: ["127.0.0.1"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
