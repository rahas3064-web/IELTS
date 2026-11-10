export class DevSeedBlockedError extends Error {
  constructor() {
    super("Refusing to seed dev fixtures: NODE_ENV is production.");
    this.name = "DevSeedBlockedError";
  }
}

/** @param {Record<string, string|undefined>} env */
export function isProduction(env) {
  return String(env?.NODE_ENV ?? "").trim().toLowerCase() === "production";
}

/**
 * Local-development fixtures (clearly flagged rows, later `is_dev_fixture = true`).
 * Blocked in production. No fixtures exist yet; later tasks add them together
 * with the tables they need.
 * @param {{query: Function}} _db
 * @param {{env?: Record<string, string|undefined>}} [options]
 * @returns {Promise<{fixtures: number}>}
 */
export async function runDevSeed(_db, { env = process.env } = {}) {
  if (isProduction(env)) throw new DevSeedBlockedError();
  return { fixtures: 0 };
}
