create table legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  document text not null,
  version text not null,
  accepted_at timestamptz not null default now(),
  constraint legal_acceptances_document_valid check (document in ('terms', 'privacy', 'refund')),
  constraint legal_acceptances_version_present check (btrim(version) <> '')
);

create unique index legal_acceptances_user_document_version_key
  on legal_acceptances (user_id, document, version);

alter table legal_acceptances enable row level security;
