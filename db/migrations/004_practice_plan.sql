-- 004_practice_plan: practice sets and attempts (the single source for plan auto-tick,
-- streaks, minutes and mastery), the question-type mastery cache, and the weekly study
-- plan with its tasks. PostgreSQL 13+ and PGlite.
-- Attempts made inside a mock exam (Writing/Speaking scoring) are practice_attempts of
-- kind 'mock_scoring'; they are linked to their mock section in 006_mock (mock tables do
-- not exist yet here and tables are never altered after creation).

-- ---------------------------------------------------------------- sets
create table practice_sets (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  skill text not null,
  exam_type text not null,
  question_type text,
  part_no smallint,
  title_fa text not null,
  title_en text not null,
  -- Skill sets have no strict timer; exam parts count down and auto-submit.
  time_limit_sec integer,
  est_minutes integer not null,
  is_free boolean not null default false,
  status text not null default 'draft',
  reviewed_by uuid references users (id) on delete set null,
  reviewed_at timestamptz,
  rejection_reason text,
  created_by uuid references users (id) on delete set null,
  is_dev_fixture boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint practice_sets_kind_valid check (kind in ('skill_set', 'exam_part')),
  constraint practice_sets_skill_valid check (skill in ('listening', 'reading', 'writing', 'speaking')),
  constraint practice_sets_exam_type_valid check (exam_type in ('academic', 'general', 'both')),
  constraint practice_sets_part_no_valid check (part_no is null or part_no between 1 and 4),
  constraint practice_sets_titles_present check (btrim(title_fa) <> '' and btrim(title_en) <> ''),
  constraint practice_sets_minutes_valid check (est_minutes > 0),
  constraint practice_sets_time_limit_valid check (time_limit_sec is null or time_limit_sec > 0),
  constraint practice_sets_skill_set_needs_type check (kind <> 'skill_set' or question_type is not null),
  constraint practice_sets_exam_part_needs_part check (kind <> 'exam_part' or part_no is not null),
  constraint practice_sets_timer_matches_kind check ((kind = 'exam_part') = (time_limit_sec is not null)),
  -- Free tier = one full skill set per question type; exam parts are paid (spec S6).
  constraint practice_sets_free_skill_set_only check (kind = 'skill_set' or not is_free),
  constraint practice_sets_status_valid check (status in ('draft', 'in_review', 'published', 'rejected')),
  constraint practice_sets_rejected_needs_reason check (
    status <> 'rejected' or (rejection_reason is not null and btrim(rejection_reason) <> '')
  ),
  constraint practice_sets_published_needs_review check (status <> 'published' or reviewed_at is not null),
  constraint practice_sets_question_type_skill_fkey
    foreign key (question_type, skill) references question_types (key, skill) on delete restrict
);
create index practice_sets_question_type_idx on practice_sets (question_type, skill);
create index practice_sets_reviewed_by_idx on practice_sets (reviewed_by);
create index practice_sets_created_by_idx on practice_sets (created_by);
-- At most one free skill set per question type and exam type (rejected sets and dev
-- fixtures do not hold the slot).
create unique index practice_sets_one_free_per_type on practice_sets (question_type, exam_type)
  where kind = 'skill_set' and is_free and status <> 'rejected' and not is_dev_fixture;
create index practice_sets_published_idx on practice_sets (skill, kind, question_type)
  where status = 'published' and not is_dev_fixture;
create trigger practice_sets_set_updated_at before update on practice_sets
  for each row execute function set_updated_at();

create table practice_set_items (
  set_id uuid not null references practice_sets (id) on delete cascade,
  item_id uuid not null references content_items (id) on delete restrict,
  sort integer not null default 0,
  primary key (set_id, item_id)
);
create index practice_set_items_item_idx on practice_set_items (item_id);

-- ---------------------------------------------------------------- attempts
-- set_id is null exactly for 'mock_scoring' attempts. Short skill sets never count for
-- the band (they only feed mastery); exam parts and mock scoring may.
create table practice_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  set_id uuid references practice_sets (id) on delete restrict,
  kind text not null,
  skill text not null,
  question_type text,
  status text not null default 'in_progress',
  started_at timestamptz not null default now(),
  deadline_at timestamptz,
  completed_at timestamptz,
  duration_sec integer,
  raw_score integer,
  max_score integer,
  band numeric(2, 1),
  counts_for_band boolean not null default false,
  minutes_studied integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint practice_attempts_kind_valid check (kind in ('skill_set', 'exam_part', 'mock_scoring')),
  constraint practice_attempts_skill_valid check (skill in ('listening', 'reading', 'writing', 'speaking')),
  constraint practice_attempts_status_valid check (
    status in ('in_progress', 'submitted', 'scoring', 'scored', 'scoring_failed', 'abandoned')
  ),
  constraint practice_attempts_set_matches_kind check ((kind = 'mock_scoring') = (set_id is null)),
  constraint practice_attempts_completed_matches_status check (
    (status in ('submitted', 'scoring', 'scored', 'scoring_failed')) = (completed_at is not null)
  ),
  constraint practice_attempts_duration_valid check (duration_sec is null or duration_sec >= 0),
  constraint practice_attempts_scores_paired check ((raw_score is null) = (max_score is null)),
  constraint practice_attempts_scores_valid check (
    raw_score is null or (raw_score >= 0 and max_score > 0 and raw_score <= max_score)
  ),
  -- A failed AI scoring never leaves a made-up band behind.
  constraint practice_attempts_band_needs_scored check (band is null or status = 'scored'),
  constraint practice_attempts_band_valid check (
    band is null or (band between 0 and 9 and band * 2 = floor(band * 2))
  ),
  constraint practice_attempts_skill_set_no_band check (kind <> 'skill_set' or not counts_for_band),
  constraint practice_attempts_minutes_valid check (minutes_studied >= 0),
  constraint practice_attempts_question_type_skill_fkey
    foreign key (question_type, skill) references question_types (key, skill) on delete restrict
);
create index practice_attempts_user_completed_idx on practice_attempts (user_id, completed_at desc);
create index practice_attempts_user_status_idx on practice_attempts (user_id, status);
create index practice_attempts_set_idx on practice_attempts (set_id);
create index practice_attempts_question_type_idx on practice_attempts (question_type, skill);
create unique index practice_attempts_one_in_progress_per_set on practice_attempts (user_id, set_id)
  where status = 'in_progress' and set_id is not null;
-- Band data points come only from attempts flagged counts_for_band.
create index practice_attempts_band_idx on practice_attempts (user_id, skill, completed_at)
  where counts_for_band and status = 'scored';
create trigger practice_attempts_set_updated_at before update on practice_attempts
  for each row execute function set_updated_at();

create table practice_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references practice_attempts (id) on delete cascade,
  item_id uuid not null references content_items (id) on delete restrict,
  answer jsonb not null,
  is_correct boolean,
  answered_at timestamptz not null default now()
);
create unique index practice_answers_attempt_item_key on practice_answers (attempt_id, item_id);
create index practice_answers_item_idx on practice_answers (item_id);

-- ---------------------------------------------------------------- mastery cache
-- Recomputable from practice_answers.
create table question_type_mastery (
  user_id uuid not null references users (id) on delete cascade,
  question_type text not null references question_types (key) on delete cascade,
  answered integer not null default 0,
  correct integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, question_type),
  constraint question_type_mastery_counts_valid check (answered >= 0 and correct >= 0 and correct <= answered)
);
create index question_type_mastery_question_type_idx on question_type_mastery (question_type);
create trigger question_type_mastery_set_updated_at before update on question_type_mastery
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------- study plans
-- week_start is the Saturday (Tehran) the plan week begins; superseded plans are kept.
create table study_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  week_start date not null,
  path text not null default 'auto',
  phase smallint not null,
  -- Snapshot of the builder inputs, kept for debugging and reproducibility.
  inputs jsonb not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint study_plans_week_start_saturday check (extract(dow from week_start) = 6),
  constraint study_plans_path_valid check (path in ('auto', 'balanced', 'bottleneck', 'sprint')),
  constraint study_plans_phase_valid check (phase between 1 and 4),
  constraint study_plans_inputs_object check (jsonb_typeof(inputs) = 'object'),
  constraint study_plans_status_valid check (status in ('active', 'superseded'))
);
create unique index study_plans_one_active_per_week on study_plans (user_id, week_start) where status = 'active';
create index study_plans_user_week_idx on study_plans (user_id, week_start desc);
create trigger study_plans_set_updated_at before update on study_plans
  for each row execute function set_updated_at();

-- ref_type/ref_id point at the suggested practice set or mock (polymorphic, no foreign
-- key). match_rule says how a finished attempt auto-ticks the task:
--   set = the same practice set, skill_type = same skill + question type,
--   skill = any attempt of the skill, none = ticked manually / not auto-tickable.
create table plan_tasks (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references study_plans (id) on delete cascade,
  day date not null,
  sort integer not null default 0,
  skill text,
  kind text not null,
  ref_type text,
  ref_id uuid,
  question_type text references question_types (key) on delete restrict,
  title_fa text not null,
  title_en text not null,
  why_fa text,
  why_en text,
  minutes integer not null,
  original_day date not null,
  match_rule text not null default 'none',
  status text not null default 'pending',
  shortened boolean not null default false,
  done_at timestamptz,
  done_attempt_id uuid references practice_attempts (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plan_tasks_skill_valid check (skill is null or skill in ('listening', 'reading', 'writing', 'speaking')),
  constraint plan_tasks_kind_valid check (kind in ('skill_set', 'exam_part', 'mock', 'review', 'placement')),
  constraint plan_tasks_skill_needed check (skill is not null or kind in ('mock', 'placement')),
  constraint plan_tasks_titles_present check (btrim(title_fa) <> '' and btrim(title_en) <> ''),
  constraint plan_tasks_minutes_valid check (minutes between 1 and 240),
  constraint plan_tasks_ref_paired check ((ref_type is null) = (ref_id is null)),
  constraint plan_tasks_ref_type_valid check (ref_type is null or ref_type in ('practice_set', 'mock')),
  constraint plan_tasks_match_rule_valid check (match_rule in ('set', 'skill_type', 'skill', 'none')),
  constraint plan_tasks_match_rule_needs_data check (
    (match_rule <> 'set' or ref_id is not null)
    and (match_rule <> 'skill_type' or (skill is not null and question_type is not null))
    and (match_rule <> 'skill' or skill is not null)
  ),
  constraint plan_tasks_status_valid check (status in ('pending', 'done', 'skipped')),
  constraint plan_tasks_done_matches_status check ((status = 'done') = (done_at is not null)),
  constraint plan_tasks_attempt_needs_done check (done_attempt_id is null or status = 'done')
);
create index plan_tasks_plan_day_idx on plan_tasks (plan_id, day, sort);
create index plan_tasks_day_idx on plan_tasks (day);
create index plan_tasks_question_type_idx on plan_tasks (question_type);
create index plan_tasks_done_attempt_idx on plan_tasks (done_attempt_id);
create trigger plan_tasks_set_updated_at before update on plan_tasks
  for each row execute function set_updated_at();
