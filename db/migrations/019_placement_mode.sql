-- The length chosen for this attempt. Skill deadlines use it; null keeps the section limit.

alter table placement_attempts add column placement_mode text;
alter table placement_attempts add constraint placement_attempts_mode_valid check (
  placement_mode is null or placement_mode in ('quick', 'full')
);
