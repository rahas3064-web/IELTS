import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Load the git-ignored `.env` into `process.env` without overriding variables
 * that are already set (so the shell and Liara win). Never prints values.
 * @returns {boolean} whether a file was loaded
 */
export function loadDotEnv() {
  const file = path.join(root, ".env");
  if (!fs.existsSync(file)) return false;
  process.loadEnvFile(file);
  return true;
}
