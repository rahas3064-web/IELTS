import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const script = path.resolve("scripts/backup-db.ps1");
const secret = "super-secret-db-password";
const user = "backup_user";
const host = "db.example.test";

async function runWhatIf(backupDir, envFile) {
  return execFileAsync("powershell.exe", [
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-File", script,
    "-WhatIf",
    "-EnvFile", envFile,
    "-BackupDir", backupDir,
  ], { windowsHide: true });
}

describe("backup-db.ps1 -WhatIf", () => {
  it("prints the dump path and does not print the database URL", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "bandora-backup-"));
    const envFile = path.join(dir, ".env");
    const url = `postgresql://${user}:${secret}@${host}:5432/postgres?sslmode=no-verify`;
    await fs.writeFile(envFile, `DATABASE_URL=${url}\nSESSION_SECRET=also-secret\n`, "utf8");
    const backupDir = path.join(dir, "out");
    const { stdout, stderr } = await runWhatIf(backupDir, envFile);
    const output = `${stdout}\n${stderr}`;
    expect(output).toMatch(/db-\d{4}-\d{2}-\d{2}-\d{4}\.dump/);
    expect(output).toContain(backupDir);
    expect(output).toContain("database-url: present");
    expect(output).toContain("public");
    expect(output).toContain("liara_archive");
    expect(output).not.toContain(secret);
    expect(output).not.toContain(user);
    expect(output).not.toContain(host);
    expect(output).not.toContain("postgresql://");
    expect(output).not.toContain("also-secret");
    expect(output).not.toContain("no-verify");
    await expect(fs.readdir(backupDir)).rejects.toThrow();
  });

  it("names dumps it would delete and leaves them on disk", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "bandora-backup-"));
    const envFile = path.join(dir, ".env");
    await fs.writeFile(envFile, "DATABASE_URL=postgresql://backup_user:super-secret-db-password@db.example.test:5432/postgres\n", "utf8");
    const backupDir = path.join(dir, "out");
    await fs.mkdir(backupDir);
    const oldest = path.join(backupDir, "db-2020-01-01-0000.dump");
    await fs.writeFile(oldest, "old");
    await fs.utimes(oldest, new Date("2020-01-01T00:00:00Z"), new Date("2020-01-01T00:00:00Z"));
    for (let i = 1; i <= 8; i += 1) {
      const name = path.join(backupDir, `db-2024-01-0${i}-0000.dump`);
      await fs.writeFile(name, "keep");
      const when = new Date(`2024-06-0${i}T00:00:00Z`);
      await fs.utimes(name, when, when);
    }
    const { stdout } = await runWhatIf(backupDir, envFile);
    expect(stdout).toContain(oldest);
    expect(stdout).not.toContain("super-secret-db-password");
    const left = await fs.readdir(backupDir);
    expect(left).toContain("db-2020-01-01-0000.dump");
    expect(left).toHaveLength(9);
  });

  it("refuses a local PGlite URL without printing it", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "bandora-backup-"));
    const envFile = path.join(dir, ".env");
    await fs.writeFile(envFile, "DATABASE_URL=pglite:./data/pglite\n", "utf8");
    const backupDir = path.join(dir, "out");
    const { stdout } = await runWhatIf(backupDir, envFile);
    expect(stdout).toContain("database-url: not-postgres");
    expect(stdout).not.toContain("pglite:");
    expect(stdout).not.toContain("data/pglite");
  });
});
