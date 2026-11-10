import { loadDotEnv } from "./env-file.js";

loadDotEnv();

if (!process.env.PORT) process.env.PORT = "3000";
// Local PGlite unless DATABASE_URL points elsewhere; PGLITE_DIR relocates it (tests, scratch runs).
if (!process.env.DATABASE_URL) process.env.DATABASE_URL = `pglite:${process.env.PGLITE_DIR || "./data/pglite"}`;

await import("../server.js");
