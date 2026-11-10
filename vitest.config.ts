import { defineConfig } from "vitest/config";
import viteConfig from "./vite.config";

export default defineConfig({
  ...viteConfig,
  test: {
    environment: "node",
    testTimeout: 20000,
    // Each PGlite suite boots and migrates its own in-memory database; under parallel load that exceeds the 10 s default.
    hookTimeout: 60000,
    include: ["{app,components,db,lib,server,src}/**/*.test.{ts,tsx,js}"],
    exclude: ["**/node_modules/**", ".cursor/**", "dist/**"],
  },
});
