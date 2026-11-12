# Subscription database

Migration `004_subscription.sql` is additive. It adds `users.role` with default `learner` and the check `learner`, `content_manager`, `system_admin`, `support_agent`. It creates subscription, quota, credit, referral, discount, payment-attempt, notification, audit, settings, and classification tables. It does not drop, delete, or update users, sessions, profiles, placement attempts, answers, skill results, or mock attempts.

Money columns are `bigint` toman. Prices are new `plan_prices` rows. A subscription stores `price_toman` at the moment it is created.

Seeded rows:

- Feature entitlements for the free, monthly, and quarterly plans. Part, task, and passage 1 plus placement are available on Free. Higher numbered keys are locked on Free and available on both Premium plans. These keys describe the rule. They do not classify an unlabeled question.
- Provisional AI limits: Free writing 8, speaking 12, assistant 20; both Premium plans writing 40, speaking 40, assistant 80. `provisional` is true.
- Settings: trial off, trial length 7, grace 3, referral reward null, referral credit life 30 days, provider `unconfigured`, quota timezone `Asia/Tehran`.

No subscription, payment, credit lot, or referral reward is inserted by the migration. Existing users receive a referral code derived from their id. They remain Free because they have no subscription.

The quota month is PostgreSQL `age` from `users.created_at`, not a separate Tehran civil-calendar implementation. The timezone key records the intended zone.

`content_classifications` is filled on boot from the bank, with `on conflict do nothing`, so a later human review is kept.
