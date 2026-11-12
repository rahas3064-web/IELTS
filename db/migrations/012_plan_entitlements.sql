-- 012_plan_entitlements: what each plan can open (feature_entitlements from 007, editable in
-- admin like the AI quotas). Rows only, no new tables.
--   practice_parts  limit_value = the highest exam part a plan may open in practice
--                   (Listening Part, Reading Passage, Writing Task, Speaking Part number);
--                   null = every part. Free opens part 1 of each skill only.
--   mock_ai         enabled = full mock exams with AI scoring (monthly count in
--                   ai_quota_configs.full_mock).
-- Placement is not gated: every learner takes it.
insert into feature_entitlements (plan_key, feature_key, enabled, limit_value) values
  ('free', 'practice_parts', true, 1),
  ('premium_monthly', 'practice_parts', true, null),
  ('premium_quarterly', 'practice_parts', true, null),
  ('free', 'mock_ai', false, null),
  ('premium_monthly', 'mock_ai', true, null),
  ('premium_quarterly', 'mock_ai', true, null)
on conflict (plan_key, feature_key) do nothing;
