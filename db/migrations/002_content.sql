-- 002_content: the question catalogue and the shared content store used by placement,
-- practice and mocks, plus the official reference data (band descriptors and the
-- raw-score -> band conversion tables). Final shapes; PostgreSQL 13+ and PGlite.
-- Lifecycle (spec rule B): draft -> in_review -> published | rejected. Rejection needs a
-- reason and publishing needs a review time, both enforced here, not only in the UI.
-- Learner queries must always filter status = 'published' and is_dev_fixture = false.

-- ---------------------------------------------------------------- question types
-- Closed catalogue keyed by a stable text key (e.g. 'reading_tfng').
create table question_types (
  key text primary key,
  skill text not null,
  exam_type text,
  name_fa text not null,
  name_en text not null,
  official_description text not null,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint question_types_key_format check (key ~ '^[a-z][a-z0-9_]*$'),
  constraint question_types_skill_valid check (skill in ('listening', 'reading', 'writing', 'speaking')),
  -- null = applies to both Academic and General Training.
  constraint question_types_exam_type_valid check (exam_type is null or exam_type in ('academic', 'general')),
  constraint question_types_names_present check (btrim(name_fa) <> '' and btrim(name_en) <> '')
);
-- Target of the (question_type, skill) composite foreign keys that keep a content
-- row's skill in step with its question type.
create unique index question_types_key_skill_key on question_types (key, skill);
create index question_types_skill_sort_idx on question_types (skill, sort);
create trigger question_types_set_updated_at before update on question_types
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------- media assets
create table media_assets (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  storage_key text not null,
  mime text not null,
  duration_sec integer,
  bytes integer not null,
  -- Never sent to learners during a test (spec S3); shown on review pages afterwards.
  transcript text,
  uploaded_by uuid references users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint media_assets_kind_valid check (kind in ('audio', 'image')),
  constraint media_assets_mime_matches_kind check (mime like kind || '/%'),
  constraint media_assets_duration_audio_only check (kind <> 'image' or duration_sec is null),
  constraint media_assets_duration_valid check (duration_sec is null or duration_sec > 0),
  constraint media_assets_transcript_audio_only check (kind <> 'image' or transcript is null),
  constraint media_assets_bytes_positive check (bytes > 0),
  constraint media_assets_storage_key_present check (btrim(storage_key) <> '')
);
create unique index media_assets_storage_key_key on media_assets (storage_key);
create index media_assets_uploaded_by_idx on media_assets (uploaded_by);
create index media_assets_kind_idx on media_assets (kind);
create trigger media_assets_set_updated_at before update on media_assets
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------- passages
-- Reading passages and listening scripts. A listening script is the text the audio is
-- recorded from; the audio itself is a media_asset on the item.
create table content_passages (
  id uuid primary key default gen_random_uuid(),
  skill text not null,
  exam_type text not null,
  title text not null,
  body text not null,
  word_count integer not null,
  status text not null default 'draft',
  reviewed_by uuid references users (id) on delete set null,
  reviewed_at timestamptz,
  rejection_reason text,
  created_by uuid references users (id) on delete set null,
  is_dev_fixture boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint content_passages_skill_valid check (skill in ('listening', 'reading')),
  constraint content_passages_exam_type_valid check (exam_type in ('academic', 'general', 'both')),
  constraint content_passages_title_present check (btrim(title) <> ''),
  constraint content_passages_body_present check (btrim(body) <> ''),
  constraint content_passages_word_count_valid check (word_count >= 0),
  constraint content_passages_status_valid check (status in ('draft', 'in_review', 'published', 'rejected')),
  constraint content_passages_rejected_needs_reason check (
    status <> 'rejected' or (rejection_reason is not null and btrim(rejection_reason) <> '')
  ),
  constraint content_passages_published_needs_review check (status <> 'published' or reviewed_at is not null)
);
create index content_passages_reviewed_by_idx on content_passages (reviewed_by);
create index content_passages_created_by_idx on content_passages (created_by);
create index content_passages_published_idx on content_passages (skill, exam_type)
  where status = 'published' and not is_dev_fixture;
create index content_passages_status_idx on content_passages (status, created_at);
create trigger content_passages_set_updated_at before update on content_passages
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------- generation jobs
-- One AI generation request. Parameters are typed columns, not a json blob.
create table content_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid references users (id) on delete set null,
  skill text not null,
  exam_type text not null,
  part_no smallint,
  question_type text,
  difficulty_band numeric(2, 1),
  item_count integer not null default 1,
  topic text,
  status text not null default 'queued',
  model text,
  prompt_version text,
  tokens_in integer not null default 0,
  tokens_out integer not null default 0,
  cost_rial bigint not null default 0,
  error text,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint content_generation_jobs_skill_valid check (skill in ('listening', 'reading', 'writing', 'speaking')),
  constraint content_generation_jobs_exam_type_valid check (exam_type in ('academic', 'general', 'both')),
  constraint content_generation_jobs_part_no_valid check (part_no is null or part_no between 1 and 4),
  constraint content_generation_jobs_difficulty_valid check (
    difficulty_band is null or (difficulty_band between 0 and 9 and difficulty_band * 2 = floor(difficulty_band * 2))
  ),
  constraint content_generation_jobs_item_count_valid check (item_count between 1 and 100),
  constraint content_generation_jobs_status_valid check (status in ('queued', 'running', 'succeeded', 'failed')),
  constraint content_generation_jobs_usage_valid check (tokens_in >= 0 and tokens_out >= 0 and cost_rial >= 0),
  constraint content_generation_jobs_failed_has_error check (
    status <> 'failed' or (error is not null and btrim(error) <> '')
  ),
  constraint content_generation_jobs_question_type_skill_fkey
    foreign key (question_type, skill) references question_types (key, skill) on delete restrict
);
create index content_generation_jobs_requested_by_idx on content_generation_jobs (requested_by);
create index content_generation_jobs_question_type_idx on content_generation_jobs (question_type, skill);
create index content_generation_jobs_status_idx on content_generation_jobs (status, created_at);
create trigger content_generation_jobs_set_updated_at before update on content_generation_jobs
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------- items
-- The shared question store (spec S12). stem/answer_key are genuinely structured per
-- question type; everything else is a typed column. Writing and speaking prompts have
-- no answer key (they are AI-scored against band descriptors).
create table content_items (
  id uuid primary key default gen_random_uuid(),
  skill text not null,
  exam_type text not null,
  question_type text not null,
  part_no smallint,
  stem jsonb not null,
  answer_key jsonb,
  explanation_fa text,
  explanation_en text,
  difficulty_band numeric(2, 1),
  passage_id uuid references content_passages (id) on delete set null,
  audio_id uuid references media_assets (id) on delete set null,
  status text not null default 'draft',
  is_free boolean not null default false,
  revision integer not null default 1,
  parent_item_id uuid references content_items (id) on delete set null,
  source text not null default 'human',
  generation_job_id uuid references content_generation_jobs (id) on delete set null,
  created_by uuid references users (id) on delete set null,
  reviewed_by uuid references users (id) on delete set null,
  reviewed_at timestamptz,
  rejection_reason text,
  -- Dev-only fixtures: blocked in production and filtered out of learner queries.
  is_dev_fixture boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint content_items_skill_valid check (skill in ('listening', 'reading', 'writing', 'speaking')),
  constraint content_items_exam_type_valid check (exam_type in ('academic', 'general', 'both')),
  constraint content_items_part_no_valid check (part_no is null or part_no between 1 and 4),
  constraint content_items_stem_object check (jsonb_typeof(stem) = 'object'),
  constraint content_items_answer_key_object check (answer_key is null or jsonb_typeof(answer_key) = 'object'),
  constraint content_items_objective_needs_key check (skill in ('writing', 'speaking') or answer_key is not null),
  constraint content_items_difficulty_valid check (
    difficulty_band is null or (difficulty_band between 0 and 9 and difficulty_band * 2 = floor(difficulty_band * 2))
  ),
  constraint content_items_status_valid check (status in ('draft', 'in_review', 'published', 'rejected')),
  constraint content_items_rejected_needs_reason check (
    status <> 'rejected' or (rejection_reason is not null and btrim(rejection_reason) <> '')
  ),
  constraint content_items_published_needs_review check (status <> 'published' or reviewed_at is not null),
  constraint content_items_revision_valid check (revision >= 1),
  -- Editing a published item creates a new revision row pointing at its parent.
  constraint content_items_parent_needs_revision check (parent_item_id is null or revision > 1),
  constraint content_items_no_self_parent check (parent_item_id is null or parent_item_id <> id),
  constraint content_items_source_valid check (source in ('ai_generated', 'human')),
  constraint content_items_generation_needs_ai check (generation_job_id is null or source = 'ai_generated'),
  constraint content_items_question_type_skill_fkey
    foreign key (question_type, skill) references question_types (key, skill) on delete restrict
);
create index content_items_question_type_idx on content_items (question_type, skill);
create index content_items_passage_idx on content_items (passage_id);
create index content_items_audio_idx on content_items (audio_id);
create unique index content_items_parent_revision_key on content_items (parent_item_id, revision)
  where parent_item_id is not null;
create index content_items_generation_job_idx on content_items (generation_job_id);
create index content_items_created_by_idx on content_items (created_by);
create index content_items_reviewed_by_idx on content_items (reviewed_by);
-- The learner-facing read path: published, real (non-fixture) content by skill and type.
create index content_items_published_idx on content_items (skill, question_type, exam_type)
  where status = 'published' and not is_dev_fixture;
create index content_items_status_idx on content_items (status, created_at);
create index content_items_dev_fixture_idx on content_items (id) where is_dev_fixture;
create trigger content_items_set_updated_at before update on content_items
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------- reviews
-- Append-only log of teacher decisions. target_id is polymorphic (several target
-- tables), so it has no foreign key; the index serves the review history lookup.
create table content_reviews (
  id uuid primary key default gen_random_uuid(),
  target_type text not null,
  target_id uuid not null,
  reviewer_id uuid references users (id) on delete set null,
  decision text not null,
  reason text,
  -- Before/after of an edit, same family as audit_logs.before/after.
  diff jsonb,
  created_at timestamptz not null default now(),
  constraint content_reviews_target_type_valid check (
    target_type in ('content_item', 'content_passage', 'placement_version', 'practice_set', 'mock')
  ),
  constraint content_reviews_decision_valid check (decision in ('approved', 'rejected', 'edited')),
  constraint content_reviews_rejected_needs_reason check (
    decision <> 'rejected' or (reason is not null and btrim(reason) <> '')
  )
);
create index content_reviews_target_idx on content_reviews (target_type, target_id, created_at);
create index content_reviews_reviewer_idx on content_reviews (reviewer_id, created_at);

-- ---------------------------------------------------------------- band descriptors
-- Official public IELTS descriptors, verbatim, with source and version. task is null for
-- speaking; Writing Task 1 has separate Academic and General Training descriptors.
create table band_descriptors (
  id uuid primary key default gen_random_uuid(),
  skill text not null,
  task text,
  criterion_key text not null,
  band smallint not null,
  text_en text not null,
  source text not null,
  version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint band_descriptors_skill_valid check (skill in ('writing', 'speaking')),
  constraint band_descriptors_task_valid check (task is null or task in ('task1_academic', 'task1_general', 'task2')),
  constraint band_descriptors_task_matches_skill check ((skill = 'speaking') = (task is null)),
  -- Writing: Task Achievement/Response, Coherence, Lexical, Grammar. Speaking: Fluency,
  -- Lexical, Grammar, Pronunciation. (Unknown skills are caught by band_descriptors_skill_valid.)
  constraint band_descriptors_criterion_valid check (
    skill not in ('writing', 'speaking')
    or (skill = 'writing' and criterion_key in ('TA', 'TR', 'CC', 'LR', 'GRA'))
    or (skill = 'speaking' and criterion_key in ('FC', 'LR', 'GRA', 'PR'))
  ),
  constraint band_descriptors_band_valid check (band between 0 and 9),
  constraint band_descriptors_text_present check (btrim(text_en) <> ''),
  constraint band_descriptors_source_present check (btrim(source) <> '' and btrim(version) <> '')
);
-- Nulls are distinct in a plain unique index, so the task is coalesced.
create unique index band_descriptors_natural_key
  on band_descriptors (skill, coalesce(task, ''), criterion_key, band, version);
create trigger band_descriptors_set_updated_at before update on band_descriptors
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------- band conversion tables
-- Raw score (out of 40) -> band, one row per band. Official tables vary slightly between
-- test versions, so values are stored with source, version and an optional verified date.
create table band_conversion_tables (
  id uuid primary key default gen_random_uuid(),
  skill text not null,
  raw_min smallint not null,
  raw_max smallint not null,
  band numeric(2, 1) not null,
  source text not null,
  version text not null,
  verified_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint band_conversion_tables_skill_valid check (skill in ('listening', 'reading_academic', 'reading_general')),
  constraint band_conversion_tables_raw_range_valid check (raw_min >= 0 and raw_max <= 40 and raw_min <= raw_max),
  constraint band_conversion_tables_band_valid check (band between 0 and 9 and band * 2 = floor(band * 2)),
  constraint band_conversion_tables_source_present check (btrim(source) <> '' and btrim(version) <> '')
);
create unique index band_conversion_tables_skill_band_version_key on band_conversion_tables (skill, band, version);
create index band_conversion_tables_lookup_idx on band_conversion_tables (skill, version, raw_min, raw_max);

-- Raw ranges of one skill/version must not overlap (an exclusion constraint would need
-- the btree_gist extension, which is not allowed here).
create or replace function band_conversion_tables_check_overlap() returns trigger as $$
begin
  if exists (
    select 1 from band_conversion_tables t
    where t.skill = new.skill and t.version = new.version and t.id <> new.id
      and t.raw_min <= new.raw_max and new.raw_min <= t.raw_max
  ) then
    raise exception 'band_conversion_tables_overlap: raw range %-% overlaps an existing row for % %',
      new.raw_min, new.raw_max, new.skill, new.version
      using errcode = '23P01';
  end if;
  return new;
end;
$$ language plpgsql;
create trigger band_conversion_tables_no_overlap before insert or update on band_conversion_tables
  for each row execute function band_conversion_tables_check_overlap();
create trigger band_conversion_tables_set_updated_at before update on band_conversion_tables
  for each row execute function set_updated_at();
