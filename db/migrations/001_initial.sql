-- Bandora initial schema. Apply only to a PostgreSQL database you control.
-- Rollback: drop the tables below in reverse order.

create table users (
  id uuid primary key,
  email text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table sessions (
  id uuid primary key,
  user_id uuid not null references users (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index sessions_user_id_idx on sessions (user_id);

create table profiles (
  user_id uuid primary key references users (id) on delete cascade,
  display_name text not null,
  exam_type text not null check (exam_type in ('academic', 'general')),
  target_overall numeric(2, 1) not null check (target_overall between 0 and 9),
  daily_minutes integer not null check (daily_minutes between 10 and 240),
  days_per_week integer not null check (days_per_week between 1 and 7),
  exam_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table placement_attempts (
  id uuid primary key,
  user_id uuid not null references users (id) on delete cascade,
  status text not null check (status in ('in_progress', 'submitted')),
  started_at timestamptz not null default now(),
  submitted_at timestamptz
);

create index placement_attempts_user_idx on placement_attempts (user_id, started_at desc);

create table placement_answers (
  attempt_id uuid not null references placement_attempts (id) on delete cascade,
  item_id text not null,
  skill text not null check (skill in ('listening', 'reading', 'writing', 'speaking')),
  response text not null default '',
  updated_at timestamptz not null default now(),
  primary key (attempt_id, item_id)
);

create table skill_results (
  attempt_id uuid not null references placement_attempts (id) on delete cascade,
  skill text not null check (skill in ('listening', 'reading', 'writing', 'speaking')),
  band numeric(2, 1) not null check (band between 0 and 9),
  confidence integer not null check (confidence between 0 and 100),
  simulated boolean not null default true,
  primary key (attempt_id, skill)
);
