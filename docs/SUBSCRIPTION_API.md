# Subscription API

All routes use the session cookie. The browser cannot set `users.role`.

- `GET /api/billing` returns the effective plan, provisional quota rows, referral code, `checkout: "unavailable"`, and notifications.
- `POST /api/billing/checkout` returns 503 `payment_unavailable` and writes no payment.
- `POST /api/billing/discount` quotes a whole-toman price. It requires a current price row. It does not redeem the code, because redemption waits for a confirmed payment.
- `POST /api/billing/trial` returns 409 `trial_disabled` while the setting is false, and `trial_used` after one trial.
- `POST /api/practice/:id` returns 403 `premium_required` when the saved classification blocks the plan. It does not store an attempt.
- `POST /api/mocks/:id` returns the same 403 before scoring when any item in the mock is blocked.
- Placement stays available to Free. Writing, speaking, and the assistant spend quota and return 429 `quota_exhausted` when both the monthly counter and credits are spent.
- `POST /api/notifications/:id/read` marks one notification for the signed-in user.
- `POST /api/admin/prices` and `POST /api/admin/grant` return 403 unless `users.role` is `system_admin`. A grant writes a manual subscription, an audit row, and a notification. It is not a payment. A new price does not change an existing subscription snapshot.

Signup accepts an optional `referralCode`. A missing code, a self-code, or a second code for the same new user does not block signup. The same phone number is stored as suspicious. A saved placement or mock can move a registered referral to successful. With a null reward setting, the reward row is `held` with zero credits.
