# Payment integration

No payment provider is selected and no credentials are stored. Checkout is disabled.

The future adapter needs three server-only operations: create a pending attempt, confirm it from a provider callback, and mark it failed or refunded. Confirmation must be idempotent on `(provider, provider_ref)`. Only a confirmed attempt may insert a subscription and a discount redemption. The amount must be a whole toman integer. The subscription price is a snapshot of the price row used at confirmation.

The current `POST /api/billing/checkout` does none of that. It returns 503 `payment_unavailable` and inserts nothing. A discount quote can be calculated, and it is not redeemed. An admin grant can store price 0 when no price exists. That grant is an audit event, not a captured payment.

Automatic renewal remains `manual` until a real provider exists and production activation is approved separately from this architecture.
