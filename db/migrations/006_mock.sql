-- 006_mock: full-length and single-skill mock exams, a learner's attempt at one, its section
-- attempts, answers and reading annotations. PostgreSQL 13+ and PGlite.
-- Each mock can be taken once per user (unique index) so results stay genuine; an
-- abandoned attempt therefore also uses up the mock.

create table mocks (
  id uuid primary key default gen_random_uuid(),
  exam_type text not null,
  title_fa text not null,
  title_en text not null,
  status text not null default 'draft',
  -- Mocks are paid by default; an admin may flag a free sample mock.
  is_free boolean not null default false,
  reviewed_by uuid references users (id) on delete set null,
  reviewed_at timestamptz,
  rejection_reason text,
  created_by uuid references users (id) on delete set null,
  is_dev_fixture boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mocks_exam_type_valid check (exam_type in ('academic', 'general')),
  constraint mocks_titles_present check (btrim(title_fa) <> '' and btrim(title_en) <> ''),
  constraint mocks_status_valid check (status in ('draft', 'in_review', 'published', 'rejected')),
  constraint mocks_rejected_needs_reason check (
    status <> 'rejected' or (rejection_reason is not null and btrim(rejection_reason) <> '')
  ),
  constraint mocks_published_needs_review check (status <> 'published' or reviewed_at is not null)
);
create index mocks_reviewed_by_idx on mocks (reviewed_by);
create index mocks_created_by_idx on mocks (created_by);
create index mocks_published_idx on mocks (exam_type) where status = 'published' and not is_dev_fixture;
create trigger mocks_set_updated_at before update on mocks
  for each row execute function set_updated_at();

-- transfer_time_sec is the extra time to check/transfer answers (listening: 2 minutes).
create table mock_sections (
  id uuid primary key default gen_random_uuid(),
  mock_id uuid not null references mocks (id) on delete cascade,
  skill text not null,
  time_limit_sec integer not null,
  transfer_time_sec integer not null default 0,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mock_sections_skill_valid check (skill in ('listening', 'reading', 'writing', 'speaking')),
  constraint mock_sections_time_limit_valid check (time_limit_sec > 0),
  constraint mock_sections_transfer_valid check (transfer_time_sec >= 0),
  constraint mock_sections_transfer_listening_only check (transfer_time_sec = 0 or skill = 'listening')
);
create unique index mock_sections_mock_skill_key on mock_sections (mock_id, skill);
create trigger mock_sections_set_updated_at before update on mock_sections
  for each row execute function set_updated_at();

create table mock_section_items (
  section_id uuid not null references mock_sections (id) on delete cascade,
  item_id uuid not null references content_items (id) on delete restrict,
  part_no smallint not null,
  sort integer not null default 0,
  primary key (section_id, item_id),
  constraint mock_section_items_part_no_valid check (part_no between 1 and 4)
);
create index mock_section_items_item_idx on mock_section_items (item_id);

-- ---------------------------------------------------------------- attempts
-- Only a completed full mock has an overall band; single-skill mocks report that skill's
-- band on the section attempt.
create table mock_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  mock_id uuid not null references mocks (id) on delete restrict,
  mode text not null,
  skill text,
  status text not null default 'in_progress',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  overall_band numeric(2, 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mock_attempts_mode_valid check (mode in ('full', 'single_skill')),
  constraint mock_attempts_skill_valid check (skill is null or skill in ('listening', 'reading', 'writing', 'speaking')),
  constraint mock_attempts_skill_matches_mode check ((mode = 'single_skill') = (skill is not null)),
  constraint mock_attempts_status_valid check (
    status in ('in_progress', 'awaiting_speaking', 'scoring', 'completed', 'abandoned')
  ),
  constraint mock_attempts_awaiting_speaking_full_only check (status <> 'awaiting_speaking' or mode = 'full'),
  constraint mock_attempts_completed_matches_status check ((status = 'completed') = (completed_at is not null)),
  constraint mock_attempts_band_full_only check (overall_band is null or mode = 'full'),
  constraint mock_attempts_band_needs_completion check (overall_band is null or status = 'completed'),
  constraint mock_attempts_band_valid check (
    overall_band is null or (overall_band between 0 and 9 and overall_band * 2 = floor(overall_band * 2))
  )
);
create unique index mock_attempts_user_mock_key on mock_attempts (user_id, mock_id);
create index mock_attempts_mock_idx on mock_attempts (mock_id);
-- Monthly full-mock quota and the history list read by (user, started_at).
create index mock_attempts_user_started_idx on mock_attempts (user_id, started_at desc);
create index mock_attempts_open_idx on mock_attempts (status) where status in ('in_progress', 'awaiting_speaking', 'scoring');
create trigger mock_attempts_set_updated_at before update on mock_attempts
  for each row execute function set_updated_at();

create table mock_section_attempts (
  id uuid primary key default gen_random_uuid(),
  mock_attempt_id uuid not null references mock_attempts (id) on delete cascade,
  skill text not null,
  status text not null default 'not_started',
  started_at timestamptz,
  deadline_at timestamptz,
  audio_started_at timestamptz,
  completed_at timestamptz,
  raw_score integer,
  max_score integer,
  band numeric(2, 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mock_section_attempts_skill_valid check (skill in ('listening', 'reading', 'writing', 'speaking')),
  constraint mock_section_attempts_status_valid check (
    status in ('not_started', 'in_progress', 'completed', 'not_assessed')
  ),
  constraint mock_section_attempts_deadline_paired check ((started_at is null) = (deadline_at is null)),
  constraint mock_section_attempts_deadline_after_start check (deadline_at is null or deadline_at >= started_at),
  constraint mock_section_attempts_started_matches_status check (
    (status in ('in_progress', 'completed') and started_at is not null)
    or (status = 'not_started' and started_at is null)
    or status not in ('not_started', 'in_progress', 'completed')
  ),
  constraint mock_section_attempts_completed_matches_status check ((status = 'completed') = (completed_at is not null)),
  constraint mock_section_attempts_scores_paired check ((raw_score is null) = (max_score is null)),
  constraint mock_section_attempts_scores_valid check (
    raw_score is null or (raw_score >= 0 and max_score > 0 and raw_score <= max_score)
  ),
  constraint mock_section_attempts_band_needs_completion check (band is null or status = 'completed'),
  constraint mock_section_attempts_band_valid check (
    band is null or (band between 0 and 9 and band * 2 = floor(band * 2))
  ),
  constraint mock_section_attempts_audio_listening_only check (audio_started_at is null or skill = 'listening')
);
create unique index mock_section_attempts_attempt_skill_key on mock_section_attempts (mock_attempt_id, skill);
create trigger mock_section_attempts_set_updated_at before update on mock_section_attempts
  for each row execute function set_updated_at();

-- Writing/Speaking sections are AI-scored through practice_attempts of kind
-- 'mock_scoring' (so ai_feedback keeps one attempt model). A Writing section has one per
-- task. The link lives here, on the later table, because practice_attempts (004) is
-- created before the mock tables exist.
create table mock_scoring_attempts (
  practice_attempt_id uuid primary key references practice_attempts (id) on delete cascade,
  mock_section_attempt_id uuid not null references mock_section_attempts (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index mock_scoring_attempts_section_idx on mock_scoring_attempts (mock_section_attempt_id);

create table mock_answers (
  id uuid primary key default gen_random_uuid(),
  section_attempt_id uuid not null references mock_section_attempts (id) on delete cascade,
  item_id uuid not null references content_items (id) on delete restrict,
  answer jsonb not null,
  is_correct boolean,
  flagged boolean not null default false,
  answered_at timestamptz not null default now()
);
create unique index mock_answers_section_attempt_item_key on mock_answers (section_attempt_id, item_id);
create index mock_answers_item_idx on mock_answers (item_id);

-- Reading highlights and notes: anchored to a passage (offsets into its body) or to an
-- item, never both.
create table mock_annotations (
  id uuid primary key default gen_random_uuid(),
  section_attempt_id uuid not null references mock_section_attempts (id) on delete cascade,
  passage_id uuid references content_passages (id) on delete restrict,
  item_id uuid references content_items (id) on delete restrict,
  kind text not null,
  start_offset integer not null,
  end_offset integer not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mock_annotations_one_target check (num_nonnulls(passage_id, item_id) = 1),
  constraint mock_annotations_kind_valid check (kind in ('highlight', 'note')),
  constraint mock_annotations_range_valid check (start_offset >= 0 and end_offset > start_offset),
  -- A note carries text; a highlight does not.
  constraint mock_annotations_note_rules check (
    (kind = 'note' and note is not null and btrim(note) <> '') or (kind <> 'note' and note is null)
  )
);
create index mock_annotations_section_attempt_idx on mock_annotations (section_attempt_id);
create index mock_annotations_passage_idx on mock_annotations (passage_id);
create index mock_annotations_item_idx on mock_annotations (item_id);
create trigger mock_annotations_set_updated_at before update on mock_annotations
  for each row execute function set_updated_at();
