import { defineConfig } from "vitest/config";
import viteConfig from "./vite.config";

export default defineConfig({
  ...viteConfig,
  test: {
    environment: "node",
    testTimeout: 20000,
    include: ["{app,components,db,lib,server,src}/**/*.test.{ts,tsx,js}"],
    exclude: ["**/node_modules/**", ".cursor/**", "dist/**"],
  },
});
