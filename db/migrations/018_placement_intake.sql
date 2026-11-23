-- Target bands are 5.0–9.0 in half steps. placement_mode is the length chosen
-- before the test (quick or full). Skip leaves it null.

alter table learner_profiles drop constraint learner_profiles_target_band_valid;
alter table learner_profiles add constraint learner_profiles_target_band_valid check (
  target_band between 5.0 and 9.0 and target_band * 2 = floor(target_band * 2)
);

alter table learner_profiles add column placement_mode text;
alter table learner_profiles add constraint learner_profiles_placement_mode_valid check (
  placement_mode is null or placement_mode in ('quick', 'full')
);
