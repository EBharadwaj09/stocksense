-- M3: daily units sold per product, in the shop's own timezone.
-- This is the forecasting model's input (manual and imported sales alike).
-- security_invoker: the caller's row-level security applies, so users only see their own shops.
create view public.daily_sales with (security_invoker = true) as
select
  s.shop_id,
  s.product_id,
  (s.sold_at at time zone sh.timezone)::date as day,
  sum(s.quantity)::numeric(14, 3) as quantity,
  sum(s.quantity * s.unit_price)::numeric(14, 2) as revenue,
  count(*)::integer as lines
from public.sales s
join public.shops sh on sh.id = s.shop_id
group by s.shop_id, s.product_id, (s.sold_at at time zone sh.timezone)::date;

comment on view public.daily_sales is 'Units sold per product per shop-local day. Days without sales have no row.';

revoke insert, update, delete, truncate, trigger, references on public.daily_sales from authenticated;
revoke all on public.daily_sales from anon;
