# Admin RBAC

Privileged API access requires `users.role = system_admin` on the session's user row. The browser role is not consulted.

The admin home still links to the existing pages. Analytics, experiments, feedback, roadmap, and the sample settings text remain labeled as sample or fictional. The user list is no longer a sample: `GET /api/admin/users` returns id, name, email, role, plan code, and suspended state. It does not return a password hash, session token, or phone number.

Server routes, all behind the admin gate:

- Search users and suspend or reactivate another account.
- Change another account's role.
- List subscriptions and mark renewal to end at the period boundary.
- Grant complimentary Premium. This writes an audit row and is not a payment.
- Insert a new price row. Older subscriptions keep their snapshotted amount.
- Set a provisional AI quota. The row stays marked provisional.
- Read usage counts, referral rows, discount codes, payment attempts, and audit entries.
- Create a percentage discount code.
- Change trial, grace, and referral settings from an allowlist. The payment provider setting is not writable here.

Approving a referral while `referral_reward_credits` is null returns `reward_unset` and does not invent a credit amount. Checkout stays unavailable.

There is no public admin registration. The first `system_admin` must already have a normal account. From a shell that already has `DATABASE_URL` set, and only after this build is approved for production, the operator runs:

```
ADMIN_EMAIL=existing-user@example.com node server/provision-admin.js
```

On PowerShell the equivalent is `$env:ADMIN_EMAIL = 'existing-user@example.com'` before the same node command. The script updates that existing row to `system_admin` and writes an audit row with action `provision_admin`. It does not create a user, does not set a password, and does not print a credential. This command was not run against production.
