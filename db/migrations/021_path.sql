-- 021_path: home chapters, nodes, and per-user node state.
-- Mid-journey catalogue: chapter 2 is the open unit, chapter 3 stays locked.
-- A learner with no placement starts on chapter 1 (the app overrides node state).

create table path_chapters (
  key text primary key,
  sort integer not null,
  title_fa text not null,
  band_from numeric(2, 1) not null,
  band_to numeric(2, 1) not null,
  constraint path_chapters_title_present check (btrim(title_fa) <> ''),
  constraint path_chapters_bands check (band_to > band_from)
);

create table path_nodes (
  id uuid primary key default gen_random_uuid(),
  chapter_key text not null references path_chapters (key) on delete cascade,
  sort integer not null,
  kind text not null,
  title_fa text not null,
  premium boolean not null default false,
  demo_state text not null,
  constraint path_nodes_kind_valid check (kind in ('lesson', 'practice', 'challenge', 'review', 'checkpoint')),
  constraint path_nodes_state_valid check (demo_state in ('done', 'current', 'locked', 'premium')),
  constraint path_nodes_title_present check (btrim(title_fa) <> ''),
  unique (chapter_key, sort)
);
create index path_nodes_chapter_idx on path_nodes (chapter_key);

create table path_node_progress (
  user_id uuid not null references users (id) on delete cascade,
  node_id uuid not null references path_nodes (id) on delete cascade,
  state text not null,
  primary key (user_id, node_id),
  constraint path_node_progress_state_valid check (state in ('done', 'current', 'locked', 'premium'))
);
create index path_node_progress_node_idx on path_node_progress (node_id);

insert into path_chapters (key, sort, title_fa, band_from, band_to) values
  ('c1', 1, 'فصل ۱: از ۵ به ۵٫۵', 5, 5.5),
  ('c2', 2, 'فصل ۲: از ۵ به ۵٫۵', 5, 5.5),
  ('c3', 3, 'فصل ۳: از ۵٫۵ به ۶', 5.5, 6);

insert into path_nodes (chapter_key, sort, kind, title_fa, premium, demo_state) values
  ('c1', 1, 'lesson', 'درس', false, 'current'),
  ('c1', 2, 'practice', 'تمرین', false, 'locked'),
  ('c1', 3, 'challenge', 'چالش', true, 'locked'),
  ('c1', 4, 'review', 'مرور', false, 'locked'),
  ('c1', 5, 'checkpoint', 'ایستگاه', false, 'locked'),
  ('c2', 1, 'lesson', 'درس', false, 'done'),
  ('c2', 2, 'practice', 'تمرین', false, 'done'),
  ('c2', 3, 'challenge', 'چالش', false, 'current'),
  ('c2', 4, 'review', 'مرور', false, 'locked'),
  ('c2', 5, 'checkpoint', 'ایستگاه', true, 'locked'),
  ('c3', 1, 'lesson', 'درس', false, 'locked'),
  ('c3', 2, 'practice', 'تمرین', false, 'locked'),
  ('c3', 3, 'challenge', 'چالش', false, 'locked'),
  ('c3', 4, 'review', 'مرور', false, 'locked'),
  ('c3', 5, 'checkpoint', 'ایستگاه', false, 'locked');

alter table path_chapters enable row level security;
alter table path_nodes enable row level security;
alter table path_node_progress enable row level security;
