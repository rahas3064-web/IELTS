-- 007_billing: plans, prices, subscriptions, AI quotas, credit wallet, referrals, discount
-- codes and payments. PostgreSQL 13+ and PGlite.
-- All money is integer Rials in bigint columns. Payment, invoice and AI-cost rows outlive
-- a purged account (user_id is set null): only the legally required, anonymised record
-- stays (spec S10). Subscription access is only ever granted after server-side payment
-- verification; these constraints make the verified state consistent, they do not replace
-- that check.

-- ---------------------------------------------------------------- plans
-- Closed catalogue keyed by a stable text key ('free', 'premium_monthly', ...); plans are
-- deactivated, never deleted. A free plan has no duration or price.
create table plans (
  key text primary key,
  tier text not null,
  name_fa text not null,
  name_en text not null,
  duration_days integer,
  is_active boolean not null default true,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plans_key_format check (key ~ '^[a-z][a-z0-9_]*$'),
  constraint plans_tier_valid check (tier in ('free', 'premium')),
  constraint plans_duration_valid check (duration_days is null or duration_days > 0),
  constraint plans_duration_matches_tier check ((tier = 'free') = (duration_days is null)),
  constraint plans_names_present check (btrim(name_fa) <> '' and btrim(name_en) <> '')
);
create trigger plans_set_updated_at before update on plans
  for each row execute function set_updated_at();

-- Prices are set in admin; old prices stay (payment attempts reference them).
create table plan_prices (
  id uuid primary key default gen_random_uuid(),
  plan_key text not null references plans (key) on delete restrict,
  amount_rial bigint not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plan_prices_amount_positive check (amount_rial > 0)
);
create unique index plan_prices_one_active_per_plan on plan_prices (plan_key) where is_active;
create trigger plan_prices_set_updated_at before update on plan_prices
  for each row execute function set_updated_at();

-- feature_key is a free-form identifier owned by the app (e.g. 'exam_parts'); limit_value
-- null means unlimited when enabled.
create table feature_entitlements (
  id uuid primary key default gen_random_uuid(),
  plan_key text not null references plans (key) on delete cascade,
  feature_key text not null,
  enabled boolean not null default true,
  limit_value integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint feature_entitlements_feature_key_format check (feature_key ~ '^[a-z][a-z0-9_]*$'),
  constraint feature_entitlements_limit_valid check (limit_value is null or limit_value >= 0)
);
create unique index feature_entitlements_plan_feature_key on feature_entitlements (plan_key, feature_key);
create trigger feature_entitlements_set_updated_at before update on feature_entitlements
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------- AI quotas
-- Monthly limits per plan (editable in admin). The period is the calendar month in
-- Tehran time, written 'YYYY-MM'.
create table ai_quota_configs (
  id uuid primary key default gen_random_uuid(),
  plan_key text not null references plans (key) on delete cascade,
  quota_key text not null,
  monthly_limit integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_quota_configs_quota_key_valid check (
    quota_key in ('writing_scoring', 'speaking_scoring', 'assistant_messages', 'full_mock')
  ),
  constraint ai_quota_configs_limit_valid check (monthly_limit >= 0)
);
create unique index ai_quota_configs_plan_quota_key on ai_quota_configs (plan_key, quota_key);
create trigger ai_quota_configs_set_updated_at before update on ai_quota_configs
  for each row execute function set_updated_at();

-- used counts reserved + committed units; reserve() locks this row (select ... for update).
create table ai_usage_counters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  quota_key text not null,
  period text not null,
  used integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_usage_counters_quota_key_valid check (
    quota_key in ('writing_scoring', 'speaking_scoring', 'assistant_messages', 'full_mock')
  ),
  constraint ai_usage_counters_period_format check (period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  constraint ai_usage_counters_used_valid check (used >= 0)
);
create unique index ai_usage_counters_user_quota_period_key on ai_usage_counters (user_id, quota_key, period);
create trigger ai_usage_counters_set_updated_at before update on ai_usage_counters
  for each row execute function set_updated_at();

-- One row per AI call. Quota-counted calls (scoring, assistant, mocks) go reserved ->
-- committed | released; calls outside a quota (speech-to-text, content generation) have
-- no quota_key and are recorded as committed for cost reports. The row survives a purged
-- account (user_id set null); it holds no personal content.
create table ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users (id) on delete set null,
  operation text not null,
  quota_key text,
  period text,
  status text not null,
  tokens_in integer not null default 0,
  tokens_out integer not null default 0,
  cost_rial bigint not null default 0,
  model text,
  prompt_version text,
  -- Caller reference (attempt id, message id, job id ...), used to make reserve() idempotent.
  ref text,
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_usage_events_operation_valid check (
    operation in ('writing_scoring', 'speaking_scoring', 'speech_to_text', 'assistant_message', 'content_generation')
  ),
  constraint ai_usage_events_quota_key_valid check (
    quota_key is null or quota_key in ('writing_scoring', 'speaking_scoring', 'assistant_messages', 'full_mock')
  ),
  constraint ai_usage_events_period_format check (period is null or period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  constraint ai_usage_events_period_matches_quota check ((quota_key is null) = (period is null)),
  constraint ai_usage_events_status_valid check (status in ('reserved', 'committed', 'released')),
  constraint ai_usage_events_reserved_needs_quota check (status <> 'reserved' or quota_key is not null),
  constraint ai_usage_events_settled_matches_status check (
    status not in ('reserved', 'committed', 'released') or (status = 'reserved') = (settled_at is null)
  ),
  constraint ai_usage_events_tokens_valid check (tokens_in >= 0 and tokens_out >= 0),
  constraint ai_usage_events_cost_valid check (cost_rial >= 0)
);
create unique index ai_usage_events_one_open_per_ref on ai_usage_events (user_id, quota_key, ref)
  where ref is not null and status <> 'released';
create index ai_usage_events_user_created_idx on ai_usage_events (user_id, created_at desc);
create index ai_usage_events_created_idx on ai_usage_events (created_at);
create index ai_usage_events_reserved_idx on ai_usage_events (created_at) where status = 'reserved';
create trigger ai_usage_events_set_updated_at before update on ai_usage_events
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------- discount codes
create table discount_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  -- Exactly one of percent_off / amount_off_rial.
  percent_off smallint,
  amount_off_rial bigint,
  -- Restrict the code to one plan; null = any plan.
  plan_key text references plans (key) on delete restrict,
  max_redemptions integer,
  per_user_limit integer not null default 1,
  valid_from timestamptz,
  valid_until timestamptz,
  is_active boolean not null default true,
  created_by uuid references users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint discount_codes_code_format check (code ~ '^[A-Z0-9_-]{3,32}$'),
  constraint discount_codes_one_discount_kind check (num_nonnulls(percent_off, amount_off_rial) = 1),
  constraint discount_codes_percent_valid check (percent_off is null or percent_off between 1 and 100),
  constraint discount_codes_amount_valid check (amount_off_rial is null or amount_off_rial > 0),
  constraint discount_codes_limits_valid check ((max_redemptions is null or max_redemptions > 0) and per_user_limit > 0),
  constraint discount_codes_window_valid check (valid_from is null or valid_until is null or valid_until > valid_from)
);
create unique index discount_codes_code_key on discount_codes (code);
create index discount_codes_plan_idx on discount_codes (plan_key);
create index discount_codes_created_by_idx on discount_codes (created_by);
create trigger discount_codes_set_updated_at before update on discount_codes
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------- payments
-- One checkout. status: created -> pending -> pre_checkout_ok -> paid_unverified ->
-- verified (or failed / expired; refunded after verified). A verified or refunded attempt
-- always carries verified_at and the provider's transaction reference. payload is our own
-- invoice payload (unique); idempotency_key de-duplicates client retries.
create table payment_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users (id) on delete set null,
  plan_price_id uuid not null references plan_prices (id) on delete restrict,
  amount_rial bigint not null,
  discount_code_id uuid references discount_codes (id) on delete set null,
  provider text not null,
  flow text not null,
  status text not null default 'created',
  provider_ref text,
  idempotency_key text not null,
  payload text not null,
  raw jsonb,
  verified_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_attempts_provider_valid check (provider in ('bale', 'zarinpal', 'zibal')),
  constraint payment_attempts_flow_valid check (flow in ('invoice_link', 'bot_chat')),
  constraint payment_attempts_status_valid check (
    status in ('created', 'pending', 'pre_checkout_ok', 'paid_unverified', 'verified', 'failed', 'refunded', 'expired')
  ),
  constraint payment_attempts_amount_positive check (amount_rial > 0),
  constraint payment_attempts_idempotency_key_present check (btrim(idempotency_key) <> ''),
  constraint payment_attempts_payload_present check (btrim(payload) <> ''),
  constraint payment_attempts_raw_object check (raw is null or jsonb_typeof(raw) = 'object'),
  constraint payment_attempts_verified_matches_status check (
    (status in ('verified', 'refunded')) = (verified_at is not null)
  ),
  constraint payment_attempts_verified_needs_ref check (
    status not in ('verified', 'refunded') or provider_ref is not null
  ),
  constraint payment_attempts_expires_after_create check (expires_at > created_at)
);
create unique index payment_attempts_idempotency_key_key on payment_attempts (idempotency_key);
create unique index payment_attempts_payload_key on payment_attempts (payload);
-- A provider transaction can activate at most one attempt (duplicate callbacks are no-ops).
create unique index payment_attempts_provider_ref_key on payment_attempts (provider, provider_ref)
  where provider_ref is not null;
create index payment_attempts_user_created_idx on payment_attempts (user_id, created_at desc);
create index payment_attempts_plan_price_idx on payment_attempts (plan_price_id);
create index payment_attempts_discount_code_idx on payment_attempts (discount_code_id);
-- Reconciliation job: re-inquire attempts that are still open.
create index payment_attempts_open_idx on payment_attempts (created_at)
  where status in ('created', 'pending', 'pre_checkout_ok', 'paid_unverified');
create trigger payment_attempts_set_updated_at before update on payment_attempts
  for each row execute function set_updated_at();

-- Every webhook/callback received, deduplicated per provider event id.
create table payment_provider_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_type text not null,
  provider_event_id text not null,
  payload jsonb not null,
  payment_attempt_id uuid references payment_attempts (id) on delete set null,
  received_at timestamptz not null default now(),
  constraint payment_provider_events_provider_valid check (provider in ('bale', 'zarinpal', 'zibal')),
  constraint payment_provider_events_event_id_present check (btrim(provider_event_id) <> '' and btrim(event_type) <> ''),
  constraint payment_provider_events_payload_object check (jsonb_typeof(payload) = 'object')
);
create unique index payment_provider_events_provider_event_key on payment_provider_events (provider, provider_event_id);
create index payment_provider_events_attempt_idx on payment_provider_events (payment_attempt_id);
create index payment_provider_events_received_idx on payment_provider_events (received_at);

-- amount_rial is what was charged (after discount); discount_rial what was taken off.
create table invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users (id) on delete set null,
  payment_attempt_id uuid not null references payment_attempts (id) on delete restrict,
  number text not null,
  amount_rial bigint not null,
  discount_rial bigint not null default 0,
  plan_key text not null references plans (key) on delete restrict,
  period_start timestamptz not null,
  period_end timestamptz not null,
  issued_at timestamptz not null default now(),
  constraint invoices_number_present check (btrim(number) <> ''),
  constraint invoices_amounts_valid check (amount_rial >= 0 and discount_rial >= 0),
  constraint invoices_period_valid check (period_end > period_start)
);
create unique index invoices_payment_attempt_key on invoices (payment_attempt_id);
create unique index invoices_number_key on invoices (number);
create index invoices_user_issued_idx on invoices (user_id, issued_at desc);
create index invoices_plan_idx on invoices (plan_key);

create table discount_redemptions (
  id uuid primary key default gen_random_uuid(),
  discount_code_id uuid not null references discount_codes (id) on delete restrict,
  user_id uuid not null references users (id) on delete cascade,
  payment_attempt_id uuid not null references payment_attempts (id) on delete cascade,
  discount_rial bigint not null,
  created_at timestamptz not null default now(),
  constraint discount_redemptions_amount_valid check (discount_rial > 0)
);
create unique index discount_redemptions_attempt_key on discount_redemptions (payment_attempt_id);
create index discount_redemptions_code_user_idx on discount_redemptions (discount_code_id, user_id);
create index discount_redemptions_user_idx on discount_redemptions (user_id);

-- ---------------------------------------------------------------- subscriptions
-- Free users have no row. A row is the one live subscription (active, or in the 3-day
-- grace window) or history; extending a subscription moves ends_at on the same row and
-- is recorded in subscription_events.
create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  plan_key text not null references plans (key) on delete restrict,
  plan_price_id uuid references plan_prices (id) on delete set null,
  status text not null default 'active',
  source text not null default 'payment',
  started_at timestamptz not null default now(),
  ends_at timestamptz not null,
  grace_ends_at timestamptz,
  cancelled_at timestamptz,
  granted_by uuid references users (id) on delete set null,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscriptions_status_valid check (status in ('active', 'grace', 'expired', 'cancelled')),
  constraint subscriptions_source_valid check (source in ('payment', 'manual', 'trial', 'referral', 'credit')),
  constraint subscriptions_ends_after_start check (ends_at > started_at),
  constraint subscriptions_grace_after_end check (grace_ends_at is null or grace_ends_at >= ends_at),
  constraint subscriptions_grace_needs_deadline check (status <> 'grace' or grace_ends_at is not null),
  constraint subscriptions_cancelled_matches_status check ((status = 'cancelled') = (cancelled_at is not null)),
  constraint subscriptions_manual_needs_reason check (source <> 'manual' or (reason is not null and btrim(reason) <> ''))
);
create unique index subscriptions_one_active_per_user on subscriptions (user_id) where status in ('active', 'grace');
create index subscriptions_user_idx on subscriptions (user_id, started_at desc);
create index subscriptions_plan_idx on subscriptions (plan_key);
create index subscriptions_plan_price_idx on subscriptions (plan_price_id);
create index subscriptions_granted_by_idx on subscriptions (granted_by);
-- Expiry/renewal jobs scan live subscriptions by end date.
create index subscriptions_ends_at_idx on subscriptions (ends_at) where status in ('active', 'grace');
create trigger subscriptions_set_updated_at before update on subscriptions
  for each row execute function set_updated_at();

create table subscription_events (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references subscriptions (id) on delete cascade,
  event_type text not null,
  old_ends_at timestamptz,
  new_ends_at timestamptz,
  payment_attempt_id uuid references payment_attempts (id) on delete set null,
  actor_id uuid references users (id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  constraint subscription_events_event_type_valid check (
    event_type in ('created', 'extended', 'grace_started', 'expired', 'cancelled', 'upgraded', 'downgraded',
                   'manual_grant', 'refunded', 'reminder_sent')
  )
);
create index subscription_events_subscription_idx on subscription_events (subscription_id, created_at);
create index subscription_events_payment_attempt_idx on subscription_events (payment_attempt_id);
create index subscription_events_actor_idx on subscription_events (actor_id);

-- A change that takes effect later (e.g. a downgrade at period end); one pending at a time.
create table scheduled_subscription_changes (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references subscriptions (id) on delete cascade,
  change_type text not null,
  target_plan_key text references plans (key) on delete restrict,
  effective_at timestamptz not null,
  status text not null default 'pending',
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint scheduled_subscription_changes_change_type_valid check (change_type in ('upgrade', 'downgrade', 'cancel')),
  constraint scheduled_subscription_changes_target_needed check (change_type = 'cancel' or target_plan_key is not null),
  constraint scheduled_subscription_changes_status_valid check (status in ('pending', 'applied', 'cancelled')),
  constraint scheduled_subscription_changes_applied_matches_status check ((status = 'applied') = (applied_at is not null))
);
create unique index scheduled_subscription_changes_one_pending on scheduled_subscription_changes (subscription_id)
  where status = 'pending';
create index scheduled_subscription_changes_target_idx on scheduled_subscription_changes (target_plan_key);
create index scheduled_subscription_changes_due_idx on scheduled_subscription_changes (effective_at)
  where status = 'pending';
create trigger scheduled_subscription_changes_set_updated_at before update on scheduled_subscription_changes
  for each row execute function set_updated_at();

create table trial_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  plan_key text not null references plans (key) on delete restrict,
  started_at timestamptz not null default now(),
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint trial_records_ends_after_start check (ends_at > started_at)
);
create unique index trial_records_user_key on trial_records (user_id);
create index trial_records_plan_idx on trial_records (plan_key);

-- ---------------------------------------------------------------- credit wallet
-- balance_rial is the cache of the lots' remaining amounts; credit_ledger is the audit
-- trail (signed amounts, balance after each entry).
create table credit_wallets (
  user_id uuid primary key references users (id) on delete cascade,
  balance_rial bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint credit_wallets_balance_valid check (balance_rial >= 0)
);
create trigger credit_wallets_set_updated_at before update on credit_wallets
  for each row execute function set_updated_at();

create table credit_lots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  source text not null,
  initial_rial bigint not null,
  remaining_rial bigint not null,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint credit_lots_source_valid check (source in ('referral_reward', 'admin_grant', 'refund', 'promo')),
  constraint credit_lots_amounts_valid check (initial_rial > 0 and remaining_rial >= 0 and remaining_rial <= initial_rial)
);
-- Spending takes from the lot that expires first.
create index credit_lots_spendable_idx on credit_lots (user_id, expires_at) where remaining_rial > 0;
create trigger credit_lots_set_updated_at before update on credit_lots
  for each row execute function set_updated_at();

create table credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  lot_id uuid references credit_lots (id) on delete set null,
  payment_attempt_id uuid references payment_attempts (id) on delete set null,
  actor_id uuid references users (id) on delete set null,
  kind text not null,
  amount_rial bigint not null,
  balance_after_rial bigint not null,
  note text,
  created_at timestamptz not null default now(),
  constraint credit_ledger_amount_nonzero check (amount_rial <> 0),
  constraint credit_ledger_balance_valid check (balance_after_rial >= 0),
  constraint credit_ledger_kind_valid check (kind in ('grant', 'spend', 'expire', 'refund', 'adjust')),
  -- grants and refunds add credit, spends and expiries remove it, adjustments go either way.
  constraint credit_ledger_sign_matches_kind check (
    kind = 'adjust'
    or (kind in ('grant', 'refund') and amount_rial > 0)
    or (kind in ('spend', 'expire') and amount_rial < 0)
    or kind not in ('grant', 'spend', 'expire', 'refund', 'adjust')
  )
);
create index credit_ledger_user_created_idx on credit_ledger (user_id, created_at desc);
create index credit_ledger_lot_idx on credit_ledger (lot_id);
create index credit_ledger_payment_attempt_idx on credit_ledger (payment_attempt_id);
create index credit_ledger_actor_idx on credit_ledger (actor_id);

-- ---------------------------------------------------------------- referrals
-- One uppercase alphanumeric code per user. Self-referral (referred user = code owner) is
-- rejected by the application, which can see both sides.
create table referral_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  code text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint referral_codes_code_format check (code ~ '^[A-Z0-9]{5,12}$')
);
create unique index referral_codes_user_key on referral_codes (user_id);
create unique index referral_codes_code_key on referral_codes (code);
create trigger referral_codes_set_updated_at before update on referral_codes
  for each row execute function set_updated_at();

create table referral_attributions (
  id uuid primary key default gen_random_uuid(),
  code_id uuid not null references referral_codes (id) on delete cascade,
  referred_user_id uuid not null references users (id) on delete cascade,
  -- Set when the referred user first pays (the reward trigger).
  qualified_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index referral_attributions_referred_key on referral_attributions (referred_user_id);
create index referral_attributions_code_idx on referral_attributions (code_id);

-- Rewards are wallet credit in Rials, for the referrer and/or the referred user.
create table referral_rewards (
  id uuid primary key default gen_random_uuid(),
  attribution_id uuid not null references referral_attributions (id) on delete cascade,
  beneficiary_user_id uuid not null references users (id) on delete cascade,
  amount_rial bigint not null,
  status text not null default 'pending',
  credit_lot_id uuid references credit_lots (id) on delete set null,
  granted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint referral_rewards_amount_positive check (amount_rial > 0),
  constraint referral_rewards_status_valid check (status in ('pending', 'granted', 'revoked')),
  constraint referral_rewards_granted_matches_status check (
    (status <> 'granted' or granted_at is not null) and (status in ('granted', 'revoked') or granted_at is null)
  )
);
create unique index referral_rewards_attribution_beneficiary_key on referral_rewards (attribution_id, beneficiary_user_id);
create index referral_rewards_beneficiary_idx on referral_rewards (beneficiary_user_id);
create index referral_rewards_credit_lot_idx on referral_rewards (credit_lot_id);
create trigger referral_rewards_set_updated_at before update on referral_rewards
  for each row execute function set_updated_at();
