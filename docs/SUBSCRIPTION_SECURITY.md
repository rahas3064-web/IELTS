# Subscription security

Premium is not granted by the client. `setRole` no longer changes the stored account. Admin price and grant routes check the role loaded from the session's user row.

Checkout cannot write `confirmed`. There is no provider secret in the repository. The provider name is the setting `unconfigured`.

Quota reservation takes a transaction advisory lock on the user and feature, refuses a negative balance, and refunds a reserved use when the model call fails. Credits never change section access.

Referral codes are accepted only at signup. The first stored attribution wins. Self-referral is rejected. The reward is not paid while `referral_reward_credits` is null.

No migration promotes an account to `system_admin`. Until the owner sets that role on a real account, admin routes answer 403.

The classification sync does not overwrite a reviewed row. It does not invent a reading passage number or a listening part for an unlabeled item.

This build has not been deployed. Applying migration 004 to production still needs a new backup and an explicit approval.
