import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const script = path.resolve("scripts/restore-test.ps1");
const secret = "local-pg-secret";

async function runScript(args) {
  return execFileAsync("powershell.exe", [
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-File", script,
    ...args,
  ], { windowsHide: true });
}

describe("restore-test.ps1", () => {
  it("stays on localhost and never reads the production database URL", async () => {
    const source = await fs.readFile(script, "utf8");
    expect(source).not.toMatch(/DATABASE_URL/);
    expect(source).not.toMatch(/supabase/i);
    expect(source).toContain("127.0.0.1");
    expect(source).toContain("bandora_restore_test");
  });

  it("prints the dump path on -WhatIf and hides the local password", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "bandora-restore-"));
    const dump = path.join(dir, "db-2026-11-17-2200.dump");
    await fs.writeFile(dump, "not-a-real-dump");
    const envFile = path.join(dir, ".env.backup");
    await fs.writeFile(envFile, `LOCAL_PG_PASSWORD=${secret}\nDATABASE_URL=postgresql://user:${secret}@db.example.test:5432/postgres\n`, "utf8");
    const { stdout, stderr } = await runScript([
      "-WhatIf",
      "-BackupDir", dir,
      "-EnvFile", envFile,
    ]);
    const output = `${stdout}\n${stderr}`;
    expect(output).toContain(dump);
    expect(output).toContain("target-host: 127.0.0.1");
    expect(output).toContain("target-db: bandora_restore_test");
    expect(output).not.toContain(secret);
    expect(output).not.toContain("postgresql://");
    expect(output).not.toContain("db.example.test");
  });

  it("fails closed when local Postgres is not listening and does not print the password", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "bandora-restore-"));
    await fs.writeFile(path.join(dir, "db-2026-11-17-2200.dump"), "not-a-real-dump");
    const envFile = path.join(dir, ".env.backup");
    await fs.writeFile(envFile, `LOCAL_PG_PASSWORD=${secret}\n`, "utf8");
    await expect(runScript([
      "-BackupDir", dir,
      "-EnvFile", envFile,
      "-Port", "1",
    ])).rejects.toThrow();
    try {
      await runScript(["-BackupDir", dir, "-EnvFile", envFile, "-Port", "1"]);
    } catch (error) {
      const output = `${error.stdout ?? ""}\n${error.stderr ?? ""}`;
      expect(output).not.toContain(secret);
      expect(output).not.toContain("postgresql://");
    }
  });
});
