-- 001_core: accounts, sessions, OTP, learner profile, audit, notifications, SMS,
-- streaks, rate limits, settings and the job log. Final shapes; runs on PostgreSQL
-- 13+ and PGlite. Content, placement, practice and billing tables come in 002+.
-- No extensions: gen_random_uuid() is built in, e-mail uniqueness uses lower().

-- One trigger function keeps updated_at honest on every table that has one.
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ---------------------------------------------------------------- users
create table users (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  phone_verified_at timestamptz,
  first_name text not null,
  last_name text not null,
  email text,
  email_verified_at timestamptz,
  password_hash text,
  role text not null default 'learner',
  locale text not null default 'fa',
  status text not null default 'active',
  deletion_requested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_phone_format check (phone ~ '^09[0-9]{9}$'),
  constraint users_first_name_present check (btrim(first_name) <> ''),
  constraint users_last_name_present check (btrim(last_name) <> ''),
  constraint users_role_valid check (role in ('learner', 'super_admin', 'content_manager', 'reviewer', 'support_agent')),
  constraint users_locale_valid check (locale in ('fa', 'en')),
  constraint users_status_valid check (status in ('active', 'blocked', 'pending_deletion')),
  constraint users_email_present check (email is null or btrim(email) <> ''),
  constraint users_email_verified_needs_email check (email_verified_at is null or email is not null),
  constraint users_password_needs_email check (password_hash is null or email is not null),
  constraint users_deletion_matches_status check ((status = 'pending_deletion') = (deletion_requested_at is not null))
);
create unique index users_phone_key on users (phone);
create unique index users_email_lower_key on users (lower(email)) where email is not null;
create index users_role_idx on users (role) where role <> 'learner';
create index users_status_idx on users (status) where status <> 'active';
create index users_deletion_requested_idx on users (deletion_requested_at) where deletion_requested_at is not null;
create index users_created_at_idx on users (created_at);
create trigger users_set_updated_at before update on users
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------- OTP
create table otp_codes (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  purpose text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  consumed_at timestamptz,
  last_sent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint otp_codes_purpose_valid check (purpose in ('login', 'change_phone', 'delete_account', 'admin_login')),
  constraint otp_codes_attempts_nonnegative check (attempts >= 0)
);
create index otp_codes_lookup_idx on otp_codes (phone, purpose, created_at desc);
create index otp_codes_expires_at_idx on otp_codes (expires_at);

create table otp_locks (
  phone text not null,
  purpose text not null,
  locked_until timestamptz not null,
  primary key (phone, purpose),
  constraint otp_locks_purpose_valid check (purpose in ('login', 'change_phone', 'delete_account', 'admin_login'))
);
create index otp_locks_locked_until_idx on otp_locks (locked_until);

-- ---------------------------------------------------------------- sessions
create table sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  kind text not null default 'learner',
  token_hash text not null,
  user_agent text,
  ip_hash text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  revoked_reason text,
  constraint sessions_kind_valid check (kind in ('learner', 'admin')),
  constraint sessions_revoked_reason_valid check (revoked_reason in ('logout', 'replaced', 'admin_force', 'blocked', 'deleted')),
  constraint sessions_reason_needs_revocation check (revoked_reason is null or revoked_at is not null)
);
create unique index sessions_token_hash_key on sessions (token_hash);
-- Single active session per user and kind: logging in elsewhere revokes the old one.
create unique index sessions_one_active on sessions (user_id, kind) where revoked_at is null;
create index sessions_user_idx on sessions (user_id, kind);
create index sessions_expires_at_idx on sessions (expires_at);

-- ---------------------------------------------------------------- learner profile
-- exam_date holds the exact day, or the first day of the month when
-- exam_date_precision = 'approx'; it is null when precision is 'unknown'/unset.
create table learner_profiles (
  user_id uuid primary key references users (id) on delete cascade,
  exam_type text,
  target_band numeric(2, 1),
  exam_date date,
  exam_date_precision text,
  daily_minutes integer,
  study_days smallint[] not null default '{}',
  onboarding_completed_at timestamptz,
  plan_path text not null default 'auto',
  reminder_sms_enabled boolean not null default true,
  reminder_time time not null default '19:00',
  email_card_dismissed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint learner_profiles_exam_type_valid check (exam_type in ('academic', 'general')),
  constraint learner_profiles_target_band_valid check (
    target_band between 5.5 and 8.5 and target_band * 2 = floor(target_band * 2)
  ),
  constraint learner_profiles_precision_valid check (exam_date_precision in ('exact', 'approx', 'unknown')),
  constraint learner_profiles_date_matches_precision check (
    (exam_date is not null) = (coalesce(exam_date_precision, 'unknown') in ('exact', 'approx'))
  ),
  constraint learner_profiles_daily_minutes_valid check (daily_minutes between 10 and 240),
  constraint learner_profiles_study_days_valid check (
    study_days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[] and cardinality(study_days) <= 7
  ),
  constraint learner_profiles_plan_path_valid check (plan_path in ('auto', 'balanced', 'bottleneck', 'sprint')),
  constraint learner_profiles_onboarding_complete check (
    onboarding_completed_at is null
    or (exam_type is not null and exam_date_precision is not null and daily_minutes is not null and cardinality(study_days) >= 1)
  )
);
create index learner_profiles_reminders_idx on learner_profiles (reminder_time) where reminder_sms_enabled;
create trigger learner_profiles_set_updated_at before update on learner_profiles
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------- admin credentials
create table admin_credentials (
  user_id uuid primary key references users (id) on delete cascade,
  password_hash text not null,
  set_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- audit log
-- Same columns as AUDIT_LOGS_DDL in server/core/audit.js (a test keeps them equal).
-- actor_id deliberately has no foreign key: the trail outlives purged accounts.
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid null,
  actor_role text,
  action text not null,
  target_type text,
  target_id text,
  before jsonb,
  after jsonb,
  ip_hash text,
  meta jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_actor_idx on audit_logs (actor_id, created_at);
create index audit_logs_action_idx on audit_logs (action, created_at);
create index audit_logs_target_idx on audit_logs (target_type, target_id);
create index audit_logs_created_at_idx on audit_logs (created_at);

-- ---------------------------------------------------------------- notifications
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_read_idx on notifications (user_id, read_at);
create index notifications_user_created_idx on notifications (user_id, created_at desc);

-- ---------------------------------------------------------------- SMS log
-- user_id is set null (not cascaded) when an account is purged; phone_masked only.
create table sms_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users (id) on delete set null,
  phone_masked text not null,
  template_key text not null,
  provider_message_id text,
  status text not null default 'queued',
  error text,
  purpose text not null,
  sent_on_tehran_day date,
  created_at timestamptz not null default now(),
  constraint sms_messages_status_valid check (status in ('queued', 'sent', 'failed'))
);
-- At most one study reminder per user per Tehran day (spec S2).
create unique index sms_one_study_reminder_per_day
  on sms_messages (user_id, purpose, sent_on_tehran_day) where purpose = 'study_reminder';
create index sms_messages_user_idx on sms_messages (user_id);
create index sms_messages_created_at_idx on sms_messages (created_at);
create index sms_messages_status_idx on sms_messages (status) where status <> 'sent';

-- ---------------------------------------------------------------- streaks (cache)
create table user_streaks (
  user_id uuid primary key references users (id) on delete cascade,
  current integer not null default 0,
  best integer not null default 0,
  last_active_day date,
  updated_at timestamptz not null default now(),
  constraint user_streaks_values_valid check (current >= 0 and best >= current)
);
create trigger user_streaks_set_updated_at before update on user_streaks
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------- rate limits
-- Columns are exactly what server/rate-limit.js reads and writes.
create table rate_limits (
  bucket text not null,
  window_start timestamptz not null,
  hits integer not null check (hits >= 0),
  primary key (bucket, window_start)
);
create index rate_limits_window_start_idx on rate_limits (window_start);

-- ---------------------------------------------------------------- settings
create table system_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint system_settings_key_present check (btrim(key) <> '')
);
create index system_settings_updated_by_idx on system_settings (updated_by);
create trigger system_settings_set_updated_at before update on system_settings
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------- job log
-- Same columns as JOB_RUNS_DDL in server/core/jobs.js (a test keeps them equal).
create table job_runs (
  id uuid primary key default gen_random_uuid(),
  job text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null check (status in ('running','ok','failed','skipped')),
  stats jsonb,
  error text
);
create index job_runs_job_started_idx on job_runs (job, started_at desc);
create index job_runs_status_idx on job_runs (status) where status = 'running';
