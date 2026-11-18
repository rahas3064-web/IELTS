-- A record that an account was deleted. The phone is stored only as a hash.
-- Deleting the user sets user_id null; invoices and payment rows are untouched here.
create table account_deletions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users (id) on delete set null,
  phone_hash text not null,
  deleted_at timestamptz not null default now(),
  constraint account_deletions_phone_hash_present check (btrim(phone_hash) <> '')
);

create index account_deletions_user_idx on account_deletions (user_id);

alter table account_deletions enable row level security;
