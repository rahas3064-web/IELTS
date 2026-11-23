-- 020_mock_cadence: half vs full mocks, and the quota that replaces "premium 4 per month".
-- Free: one half-mock every 7 Tehran days. Premium: one full mock per Tehran day.
-- full_mock monthly_limit is no longer a grant (0). Cadence is enforced on attempts.

alter table mocks add column mock_kind text not null default 'full';
alter table mocks add constraint mocks_kind_valid check (mock_kind in ('full', 'half'));

update ai_quota_configs
set monthly_limit = 0
where quota_key = 'full_mock' and plan_key in ('premium_monthly', 'premium_quarterly');

insert into feature_entitlements (plan_key, feature_key, enabled, limit_value) values
  ('free', 'half_mock', true, 7),
  ('premium_monthly', 'half_mock', true, 7),
  ('premium_quarterly', 'half_mock', true, 7)
on conflict (plan_key, feature_key) do nothing;
