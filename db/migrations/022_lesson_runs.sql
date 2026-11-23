-- 022_lesson_runs: where a learner is inside a lesson, so a refresh resumes that stage.
-- completed_at is the first finish. A repeat does not move it, so the streak and the daily goal do not grow again.

create table lesson_runs (
  user_id uuid not null references users (id) on delete cascade,
  node_id uuid not null references path_nodes (id) on delete cascade,
  stage text not null default 'learn',
  practice text,
  apply_text text not null default '',
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, node_id),
  constraint lesson_runs_stage_valid check (stage in ('learn', 'practice', 'apply', 'review')),
  constraint lesson_runs_practice_valid check (practice is null or practice in ('topic', 'example'))
);
create index lesson_runs_node_idx on lesson_runs (node_id);
create index lesson_runs_completed_idx on lesson_runs (user_id, completed_at);

alter table lesson_runs enable row level security;

create trigger lesson_runs_set_updated_at before update on lesson_runs
  for each row execute function set_updated_at();
