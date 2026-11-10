-- 005_feedback_progress: AI feedback reports for Writing/Speaking, their marked-up issues,
-- the issue-category catalogue and band snapshots (the data points behind the progress
-- chart). PostgreSQL 13+ and PGlite.
-- Every report is an AI estimate, never an official IELTS score. A failed AI scoring
-- creates no ai_feedback row at all (practice_attempts.status = 'scoring_failed').

-- ---------------------------------------------------------------- issue categories
-- Catalogue of mistake categories (e.g. 'grammar.article'), managed in admin. Issues must
-- use a known category, so the scorer maps unknown AI categories to a seeded fallback.
create table feedback_issue_categories (
  key text primary key,
  name_fa text not null,
  name_en text not null,
  -- Where "your frequent mistakes" sends the learner to practise.
  related_question_type text references question_types (key) on delete set null,
  related_set_id uuid references practice_sets (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint feedback_issue_categories_key_format check (key ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$'),
  constraint feedback_issue_categories_names_present check (btrim(name_fa) <> '' and btrim(name_en) <> '')
);
create index feedback_issue_categories_question_type_idx on feedback_issue_categories (related_question_type);
create index feedback_issue_categories_set_idx on feedback_issue_categories (related_set_id);
create trigger feedback_issue_categories_set_updated_at before update on feedback_issue_categories
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------- reports
-- criteria is the structured per-criterion list (key, band, Persian reason, descriptor
-- reference); next_steps_fa is exactly the three "steps to your target band".
create table ai_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  attempt_id uuid not null references practice_attempts (id) on delete cascade,
  skill text not null,
  task text,
  overall_band numeric(2, 1) not null,
  criteria jsonb not null,
  next_steps_fa text[] not null,
  improved_version text,
  summary_fa text not null,
  transcript text,
  recording_id uuid references speaking_recordings (id) on delete set null,
  model text not null,
  prompt_version text not null,
  created_at timestamptz not null default now(),
  constraint ai_feedback_skill_valid check (skill in ('writing', 'speaking')),
  -- Writing reports name the task; speaking reports may name the part.
  constraint ai_feedback_task_matches_skill check (
    (skill = 'writing' and task is not null and task in ('task1_academic', 'task1_general', 'task2'))
    or (skill = 'speaking' and (task is null or task in ('part1', 'part2', 'part3')))
  ),
  constraint ai_feedback_band_valid check (overall_band between 0 and 9 and overall_band * 2 = floor(overall_band * 2)),
  constraint ai_feedback_criteria_array check (jsonb_typeof(criteria) = 'array'),
  constraint ai_feedback_next_steps_exactly_three check (cardinality(next_steps_fa) = 3),
  constraint ai_feedback_speaking_only_columns check (skill = 'speaking' or (transcript is null and recording_id is null)),
  constraint ai_feedback_model_present check (btrim(model) <> '' and btrim(prompt_version) <> '')
);
-- One report per attempt and task (also serves the attempt_id foreign key).
create unique index ai_feedback_attempt_task_key on ai_feedback (attempt_id, coalesce(task, ''));
create index ai_feedback_user_created_idx on ai_feedback (user_id, created_at desc);
create index ai_feedback_user_skill_created_idx on ai_feedback (user_id, skill, created_at desc);
create index ai_feedback_recording_idx on ai_feedback (recording_id);

create table feedback_issues (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references ai_feedback (id) on delete cascade,
  user_id uuid not null references users (id) on delete cascade,
  category text not null references feedback_issue_categories (key) on delete restrict,
  -- Character offsets into the learner's text (writing) or the transcript (speaking).
  start_offset integer not null,
  end_offset integer not null,
  original text not null,
  correction text not null,
  explanation_fa text not null,
  created_at timestamptz not null default now(),
  constraint feedback_issues_offsets_valid check (start_offset >= 0 and end_offset > start_offset)
);
create index feedback_issues_feedback_idx on feedback_issues (feedback_id);
create index feedback_issues_user_category_idx on feedback_issues (user_id, category);
create index feedback_issues_category_idx on feedback_issues (category);

-- ---------------------------------------------------------------- band snapshots
-- Band data points come only from placement, mocks and exam parts. source_id is
-- polymorphic (placement_attempts, mock_attempts or practice_attempts), so no foreign
-- key; the unique index makes writing a snapshot idempotent.
create table band_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  source_type text not null,
  source_id uuid not null,
  skill text not null,
  band numeric(2, 1) not null,
  measured_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint band_snapshots_source_type_valid check (source_type in ('placement', 'mock', 'exam_part')),
  constraint band_snapshots_skill_valid check (skill in ('overall', 'listening', 'reading', 'writing', 'speaking')),
  constraint band_snapshots_band_valid check (band between 0 and 9 and band * 2 = floor(band * 2))
);
create index band_snapshots_user_skill_measured_idx on band_snapshots (user_id, skill, measured_at);
create unique index band_snapshots_source_skill_key on band_snapshots (source_type, source_id, skill);
