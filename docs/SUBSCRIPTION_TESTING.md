# Subscription testing

Command: `npx vitest run` on 6 Nov 2026. Result: 15 files, 52 tests, all passed. `npx tsc --noEmit` passed after that run.

`server/classify.test.js` reads the real bank. L1 is section 1, L4 is section 2, W1 is task 1, W2 is task 2, S3 is part 2, and R1 and M-L1 stay unreviewed. Every classified item's source tag is present on that item. Free is denied section 2. `premium_monthly` is allowed. Unreviewed stays allowed. `priceAfterPercent(1000, 15)` is 150 off, and `priceAfterPercent(10, 15)` discounts 1 toman.

`server/migrate.test.js` checks that 003 does not touch the original tables and that 004 does not drop, delete, or update those tables. 004 may add `users.role`. It must not insert subscriptions, payments, or credit lots.

`server/subscription-db.test.js` uses PGlite, not the production database. It applies 001–003, inserts one user, session, profile, placement, answer, skill result, and mock, then applies 004 twice. Counts stay the same. The role is `learner`. There is no subscription or payment before a grant. Eight free writing uses succeed, the ninth is exhausted, and the next use spends the earlier credit lot. A price change from 1000 to 2000 leaves the granted subscription at 1000. Trial is disabled, then a second trial is rejected. Self-referral is rejected. A normal referral settles as held with zero credits. Checkout returns `payment_unavailable` and the payment table stays empty.

These tests do not call AvalAI and do not open the production database.
