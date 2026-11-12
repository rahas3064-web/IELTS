-- 009_billing_catalogue: the closed plan catalogue and the agreed monthly AI quotas.
-- Reference data only: no prices. plan_prices rows are set by an admin (amounts are a
-- product decision, never seeded). Every insert skips an existing key, so re-running is a
-- no-op and a value an admin later edits is never overwritten.
-- Quotas are per Tehran calendar month (period 'YYYY-MM').

insert into plans (key, tier, name_fa, name_en, duration_days, sort) values
  ('free', 'free', 'رایگان', 'Free', null, 0),
  ('premium_monthly', 'premium', 'پریمیوم ماهانه', 'Premium monthly', 30, 10),
  ('premium_quarterly', 'premium', 'پریمیوم سه‌ماهه', 'Premium quarterly', 90, 20)
on conflict (key) do nothing;

insert into ai_quota_configs (plan_key, quota_key, monthly_limit) values
  ('free', 'writing_scoring', 2),
  ('free', 'speaking_scoring', 2),
  ('free', 'assistant_messages', 10),
  ('free', 'full_mock', 0),
  ('premium_monthly', 'writing_scoring', 30),
  ('premium_monthly', 'speaking_scoring', 30),
  ('premium_monthly', 'assistant_messages', 150),
  ('premium_monthly', 'full_mock', 4),
  ('premium_quarterly', 'writing_scoring', 30),
  ('premium_quarterly', 'speaking_scoring', 30),
  ('premium_quarterly', 'assistant_messages', 150),
  ('premium_quarterly', 'full_mock', 4)
on conflict (plan_key, quota_key) do nothing;
