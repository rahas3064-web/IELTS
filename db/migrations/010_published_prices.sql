-- Prices shown on the marketing plans: 998,000 toman / month and 1,897,000 toman / quarter.
-- Stored in rials (toman × 10). A plan that already has an active price is left alone.
insert into plan_prices (plan_key, amount_rial)
select v.plan_key, v.amount_rial
from (values
  ('premium_monthly', 9980000::bigint),
  ('premium_quarterly', 18970000::bigint)
) as v(plan_key, amount_rial)
where not exists (
  select 1 from plan_prices p where p.plan_key = v.plan_key and p.is_active
);
