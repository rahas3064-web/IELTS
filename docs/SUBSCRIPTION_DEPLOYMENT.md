# Subscription deployment

Do not deploy this build yet. Production is still on migrations `001_initial`, `002_account_fields`, and `003_plans_access`. The next boot that has `DATABASE_URL` set will apply `004_subscription` because that version is not recorded.

Before that boot:

1. Take a new database backup. The backup taken before 003 is not a backup of the database after 003.
2. Confirm the owner has approved this migration.
3. Deploy from this project with the existing Liara app, port 3000, and without setting `NODE_ENV` in the panel.
4. Read `/api/health`. It should list `004_subscription` and the same preserved counts as before the boot.
5. Confirm no subscription, payment, or credit lot was created for the existing accounts.
6. Set `users.role = 'system_admin'` for one real account in the database console. Do not put that account in a migration.
7. Leave `payment_provider` as `unconfigured` and `referral_reward_credits` null until the owner chooses a provider and a reward amount.
8. Leave `trial_enabled` false unless a trial is an explicit decision.

A full restore from the Liara panel replaces the database. A narrow undo that has not been needed is to drop only the tables created by 004, drop the `users.role` column, and delete the `004_subscription` version. That undo is not part of this build and must not be run against production without a fresh backup.

Local development must not be started with the production `DATABASE_URL` while 004 is unreleased.
