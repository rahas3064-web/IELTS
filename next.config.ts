import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The prototype reads the clock and localStorage while rendering.
  // Cache Components treats `new Date()` as a blocking prerender, which fights
  // that model. Turn it off until a server owns the exam clock.
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
