# Subscription architecture

Bandora keeps one account database. A learner with no subscription row is Free. Premium exists only as a subscription row written by a server path.

The server classifies a question only when its bank tags name a section, part, or task. Listening `section-1` through `section-4` (or `part-1` through `part-4`) map to parts 1–4. Speaking `part-1` through `part-3` map to parts 1–3. Writing `task-1` and `task-2` map to tasks 1 and 2. Reading has no passage-number tag, so reading stays `unreviewed`. Unlabeled items stay `unreviewed`. Unreviewed content stays available. A classified section above 1 requires `premium_monthly`, `premium_quarterly`, or `trial`. Placement is not section-locked.

AI use is counted in `withQuota`. The monthly counter is spent first. A referral credit lot is spent only after that counter is full, earliest expiry first. A failed model call is refunded. Credits do not unlock a Premium section.

Checkout does not create a payment or a subscription. The payment provider setting is `unconfigured`. Automatic renewal stays off.

Quota numbers in migration 004 are provisional. The referral reward amount is JSON null, so a successful referral is recorded as held and is not granted until that setting is an integer.

Trial is stored as disabled. Grace is three days after a paid period end, applied when the plan is read. A second trial row is rejected by the unique trial record.
