# Security operations

Do not deploy this build until the owner approves it. Production is still on migrations `001` through `003`. The next boot with `DATABASE_URL` would apply `004_subscription`, `005_account_status`, and `006_rate_limits`.

`006_rate_limits` creates only the shared counter table. It does not read account rows. A storage error on that table fails the limited request with 503.

Before that boot:

1. Take a new database backup. The backup from before `003` does not include the current production rows.
2. Apply the build only after explicit approval.
3. Read `/api/health` and compare preserved counts with the pre-boot report.
4. Run the provisioning command in `docs/ADMIN_RBAC.md` for one real, already registered account. Do not invent an admin password.
5. Leave `payment_provider` as `unconfigured` and do not configure SMTP until a provider is chosen.
6. Do not rotate the database password or the AvalAI key unless a separate approval says a value was exposed. This audit did not print or copy those values.

`005_account_status` adds `users.suspended` with default false. An isolated database test applied it twice after a `content_manager` user and a live session already existed. The role, email, session hash, and preserved counts stayed the same, and `suspended` was false. That test then copied those rows into a second empty database and read them back. `pg_restore` is not installed on this machine, so the Liara dump at `C:\Users\mjh\Backups\bandora\production-db-before-003.dump.tar.gz` was not restored. That file's existence is not evidence of a successful restore.

`005_account_status` does not rewrite accounts. A narrow undo is to drop that column and delete the `005_account_status` migration version. Do not run that undo on production without a fresh backup. The same caution applies to dropping `rate_limits` and deleting `006_rate_limits`.

Rate-limit counters and the session list are not an intrusion-detection system. Failed admin attempts are in `admin_audit_logs`. Application logs must keep using error codes rather than request bodies, passwords, tokens, or reset material. No reset token is created today.

Vitest `3.2.7` is a development dependency. `vite build` does not load it. Do not expose `vitest --ui` or pass untrusted worker options to Vitest. tinypool `1.1.1` remains on the test path until a later major Vitest upgrade is tested on its own.

Backup restoration of production was not completed in this pass. A restore from the Liara panel replaces the whole database.
