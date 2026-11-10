-- 008_assistant: server-side history of the AI assistant chat. Token/cost accounting and the
-- monthly quota live in ai_usage_events / ai_usage_counters (007); `tokens` here is just the
-- size of the stored message. PostgreSQL 13+ and PGlite.

create table assistant_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index assistant_conversations_user_updated_idx on assistant_conversations (user_id, updated_at desc);
create trigger assistant_conversations_set_updated_at before update on assistant_conversations
  for each row execute function set_updated_at();

-- Messages are immutable once written, so there is no updated_at.
create table assistant_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references assistant_conversations (id) on delete cascade,
  role text not null,
  content text not null,
  tokens integer,
  created_at timestamptz not null default now(),
  constraint assistant_messages_role_valid check (role in ('user', 'assistant')),
  constraint assistant_messages_content_present check (btrim(content) <> ''),
  constraint assistant_messages_tokens_valid check (tokens is null or tokens >= 0)
);
create index assistant_messages_conversation_created_idx on assistant_messages (conversation_id, created_at);
