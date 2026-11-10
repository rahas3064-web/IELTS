/* global URL */
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/**
 * The db CLIs (migrate, seed) read DATABASE_URL from the git-ignored `.env`, so a
 * developer could change a real database by running them. Refuse any PostgreSQL
 * that is not on this machine unless `DB_CLI_ALLOW_REMOTE=1` is set on purpose.
 * The message never contains the URL (it may hold a password) or the host.
 * @param {string | undefined} databaseUrl
 * @param {Record<string, string | undefined>} env
 */
export function assertSafeCliTarget(databaseUrl, env) {
  const url = (databaseUrl ?? "").trim();
  if (!/^postgres(ql)?:\/\//.test(url)) return;
  if (env.DB_CLI_ALLOW_REMOTE === "1") return;
  let hostname = "";
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    // An unparsable URL is treated as remote: fail closed.
  }
  if (LOCAL_HOSTS.has(hostname)) return;
  throw new Error(
    "refusing to run against a remote PostgreSQL database; set DB_CLI_ALLOW_REMOTE=1 to allow it, or use DATABASE_URL=pglite:<dir> for a local scratch database",
  );
}
