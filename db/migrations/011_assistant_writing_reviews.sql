-- 011_assistant_writing_reviews: the assistant also reviews a learner's IELTS writing. A user
-- message that was sent for review gets one row here with its task; the review itself is the
-- assistant reply that follows it in assistant_messages. PostgreSQL 13+ and PGlite.

create table assistant_writing_reviews (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references assistant_messages (id) on delete cascade,
  task_type text not null,
  task_prompt text,
  word_count integer not null,
  created_at timestamptz not null default now(),
  constraint assistant_writing_reviews_task_type_valid check (task_type in ('task1_academic', 'task1_general', 'task2')),
  constraint assistant_writing_reviews_word_count_valid check (word_count >= 0)
);
create unique index assistant_writing_reviews_message_key on assistant_writing_reviews (message_id);
