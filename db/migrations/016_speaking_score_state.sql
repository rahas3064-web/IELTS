-- Score state for one stored speaking answer. partial means the three text
-- criteria are saved and pronunciation can be retried without a new quota.
alter table speaking_recordings
  add column score_state text,
  add column criteria jsonb,
  add column band numeric(2, 1),
  add column pronunciation_tries integer not null default 0,
  add column injection boolean not null default false;

alter table speaking_recordings
  add constraint speaking_recordings_score_state_valid
    check (score_state is null or score_state in ('partial', 'scored'));

alter table speaking_recordings
  add constraint speaking_recordings_criteria_object
    check (criteria is null or jsonb_typeof(criteria) = 'object');

alter table speaking_recordings
  add constraint speaking_recordings_band_valid
    check (band is null or (band between 0 and 9 and band * 2 = floor(band * 2)));

alter table speaking_recordings
  add constraint speaking_recordings_band_matches_state
    check ((score_state = 'scored') = (band is not null));

alter table speaking_recordings
  add constraint speaking_recordings_state_has_criteria
    check (score_state is null or criteria is not null);

alter table speaking_recordings
  add constraint speaking_recordings_tries_valid
    check (pronunciation_tries >= 0 and pronunciation_tries <= 4);
