-- M4: forecasts written by the nightly job (GitHub Actions, using a secret key that bypasses RLS).
-- App users can only read their own shop's forecasts; they never write them.

create table public.forecasts (
  product_id uuid not null,
  shop_id uuid not null references public.shops (id) on delete cascade,
  day date not null,
  quantity numeric(12, 3) not null check (quantity >= 0),
  generated_at timestamptz not null default now(),
  primary key (product_id, day),
  foreign key (product_id, shop_id) references public.products (id, shop_id) on delete cascade
);
create index forecasts_shop_day_idx on public.forecasts (shop_id, day);

create table public.forecast_runs (
  shop_id uuid primary key references public.shops (id) on delete cascade,
  generated_at timestamptz not null default now(),
  first_day date not null,
  horizon_days integer not null check (horizon_days between 1 and 60),
  model text not null,
  products integer not null default 0,
  history_days integer not null default 0,
  note text
);

alter table public.forecasts enable row level security;
alter table public.forecast_runs enable row level security;

create policy "members read forecasts" on public.forecasts
  for select to authenticated using (private.is_shop_member(shop_id));
create policy "members read forecast runs" on public.forecast_runs
  for select to authenticated using (private.is_shop_member(shop_id));

revoke insert, update, delete, truncate, trigger, references on public.forecasts, public.forecast_runs from authenticated;
revoke all on public.forecasts, public.forecast_runs from anon;
