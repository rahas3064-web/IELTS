-- 003_placement: placement versions (reviewed content bundles), a learner's attempt and its
-- per-skill progress, answers, and the speaking recordings used by placement, practice and
-- mocks. Summaries are never duplicated: skill results live in placement_skill_attempts,
-- the overall band is one typed column on the attempt. PostgreSQL 13+ and PGlite.

-- ---------------------------------------------------------------- versions
create table placement_versions (
  id uuid primary key default gen_random_uuid(),
  exam_type text not null,
  version_no integer not null,
  status text not null default 'draft',
  reviewed_by uuid references users (id) on delete set null,
  reviewed_at timestamptz,
  rejection_reason text,
  created_by uuid references users (id) on delete set null,
  is_dev_fixture boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint placement_versions_exam_type_valid check (exam_type in ('academic', 'general')),
  constraint placement_versions_version_no_valid check (version_no > 0),
  constraint placement_versions_status_valid check (status in ('draft', 'in_review', 'published', 'rejected')),
  constraint placement_versions_rejected_needs_reason check (
    status <> 'rejected' or (rejection_reason is not null and btrim(rejection_reason) <> '')
  ),
  constraint placement_versions_published_needs_review check (status <> 'published' or reviewed_at is not null)
);
create unique index placement_versions_exam_type_version_no_key on placement_versions (exam_type, version_no);
create index placement_versions_reviewed_by_idx on placement_versions (reviewed_by);
create index placement_versions_created_by_idx on placement_versions (created_by);
create index placement_versions_published_idx on placement_versions (exam_type, version_no)
  where status = 'published' and not is_dev_fixture;
create trigger placement_versions_set_updated_at before update on placement_versions
  for each row execute function set_updated_at();

create table placement_sections (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references placement_versions (id) on delete cascade,
  skill text not null,
  time_limit_sec integer not null,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint placement_sections_skill_valid check (skill in ('listening', 'reading', 'writing', 'speaking')),
  constraint placement_sections_time_limit_valid check (time_limit_sec > 0)
);
-- One section per skill in a version; also serves the version_id foreign key.
create unique index placement_sections_version_skill_key on placement_sections (version_id, skill);
create trigger placement_sections_set_updated_at before update on placement_sections
  for each row execute function set_updated_at();

create table placement_section_items (
  section_id uuid not null references placement_sections (id) on delete cascade,
  item_id uuid not null references content_items (id) on delete restrict,
  sort integer not null default 0,
  primary key (section_id, item_id)
);
create index placement_section_items_item_idx on placement_section_items (item_id);

-- ---------------------------------------------------------------- attempts
create table placement_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  version_id uuid not null references placement_versions (id) on delete restrict,
  status text not null default 'in_progress',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  overall_band numeric(2, 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint placement_attempts_status_valid check (status in ('in_progress', 'completed', 'abandoned')),
  constraint placement_attempts_completed_matches_status check ((status = 'completed') = (completed_at is not null)),
  constraint placement_attempts_band_needs_completion check (overall_band is null or status = 'completed'),
  constraint placement_attempts_band_valid check (
    overall_band is null or (overall_band between 0 and 9 and overall_band * 2 = floor(overall_band * 2))
  )
);
-- A learner can only have one placement running at a time.
create unique index placement_attempts_one_in_progress on placement_attempts (user_id) where status = 'in_progress';
create index placement_attempts_user_started_idx on placement_attempts (user_id, started_at desc);
-- Retake rule: next attempt allowed 15 days after the last completed one.
create index placement_attempts_user_completed_idx on placement_attempts (user_id, completed_at desc)
  where status = 'completed';
create index placement_attempts_version_idx on placement_attempts (version_id);
create trigger placement_attempts_set_updated_at before update on placement_attempts
  for each row execute function set_updated_at();

create table placement_skill_attempts (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references placement_attempts (id) on delete cascade,
  skill text not null,
  status text not null default 'not_started',
  started_at timestamptz,
  deadline_at timestamptz,
  completed_at timestamptz,
  raw_score integer,
  max_score integer,
  band numeric(2, 1),
  -- Listening audio plays once; the server remembers when playback began.
  audio_started_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint placement_skill_attempts_skill_valid check (skill in ('listening', 'reading', 'writing', 'speaking')),
  constraint placement_skill_attempts_status_valid check (
    status in ('not_started', 'in_progress', 'completed', 'not_assessed')
  ),
  constraint placement_skill_attempts_deadline_paired check ((started_at is null) = (deadline_at is null)),
  constraint placement_skill_attempts_deadline_after_start check (deadline_at is null or deadline_at >= started_at),
  -- not_assessed may or may not have started (mic denied before/after the timer began).
  constraint placement_skill_attempts_started_matches_status check (
    (status in ('in_progress', 'completed') and started_at is not null)
    or (status = 'not_started' and started_at is null)
    or status not in ('not_started', 'in_progress', 'completed')
  ),
  constraint placement_skill_attempts_completed_matches_status check ((status = 'completed') = (completed_at is not null)),
  constraint placement_skill_attempts_scores_paired check ((raw_score is null) = (max_score is null)),
  constraint placement_skill_attempts_scores_valid check (
    raw_score is null or (raw_score >= 0 and max_score > 0 and raw_score <= max_score)
  ),
  constraint placement_skill_attempts_band_needs_completion check (band is null or status = 'completed'),
  constraint placement_skill_attempts_band_valid check (
    band is null or (band between 0 and 9 and band * 2 = floor(band * 2))
  ),
  constraint placement_skill_attempts_audio_listening_only check (audio_started_at is null or skill = 'listening')
);
create unique index placement_skill_attempts_attempt_skill_key on placement_skill_attempts (attempt_id, skill);
create trigger placement_skill_attempts_set_updated_at before update on placement_skill_attempts
  for each row execute function set_updated_at();

-- answered_at is the only timestamp: autosave rewrites the row and bumps it.
create table placement_answers (
  id uuid primary key default gen_random_uuid(),
  skill_attempt_id uuid not null references placement_skill_attempts (id) on delete cascade,
  item_id uuid not null references content_items (id) on delete restrict,
  answer jsonb not null,
  is_correct boolean,
  answered_at timestamptz not null default now()
);
create unique index placement_answers_skill_attempt_item_key on placement_answers (skill_attempt_id, item_id);
create index placement_answers_item_idx on placement_answers (item_id);

-- ---------------------------------------------------------------- speaking recordings
-- Shared by placement, practice and mocks. context_id points at the matching attempt row
-- (placement_skill_attempts, practice_attempts or mock_section_attempts depending on
-- context_type), so it has no foreign key. Pause metrics are evidence for the scorer.
create table speaking_recordings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  context_type text not null,
  context_id uuid not null,
  question_item_id uuid not null references content_items (id) on delete restrict,
  storage_key text not null,
  mime text not null,
  bytes integer not null,
  duration_sec numeric(7, 2) not null,
  transcript text,
  words jsonb,
  wpm numeric(5, 1),
  pause_count integer,
  long_pause_count integer,
  mean_pause_ms integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint speaking_recordings_context_type_valid check (context_type in ('placement', 'practice', 'mock')),
  constraint speaking_recordings_mime_audio check (mime like 'audio/%'),
  -- 25 MB upload limit (spec S3).
  constraint speaking_recordings_bytes_valid check (bytes > 0 and bytes <= 26214400),
  constraint speaking_recordings_duration_valid check (duration_sec > 0),
  constraint speaking_recordings_words_array check (words is null or jsonb_typeof(words) = 'array'),
  constraint speaking_recordings_metrics_valid check (
    (wpm is null or wpm >= 0)
    and (pause_count is null or pause_count >= 0)
    and (long_pause_count is null or long_pause_count >= 0)
    and (mean_pause_ms is null or mean_pause_ms >= 0)
    and (long_pause_count is null or pause_count is null or long_pause_count <= pause_count)
  )
);
create unique index speaking_recordings_storage_key_key on speaking_recordings (storage_key);
create index speaking_recordings_user_idx on speaking_recordings (user_id, created_at desc);
create index speaking_recordings_question_item_idx on speaking_recordings (question_item_id);
create index speaking_recordings_context_idx on speaking_recordings (context_type, context_id);
create trigger speaking_recordings_set_updated_at before update on speaking_recordings
  for each row execute function set_updated_at();
