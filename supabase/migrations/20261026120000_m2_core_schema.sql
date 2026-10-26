-- M2 core schema: shops, members, invites, products, sales, stock movements.
-- Every table has row-level security; users only ever see shops they belong to.
-- Owners manage products, team and imports. Staff record sales and stock.

create schema if not exists private;
grant usage on schema private to authenticated;

create type public.shop_role as enum ('owner', 'staff');

-- ---------------------------------------------------------------- tables

create table public.shops (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  currency text not null default 'INR' check (currency ~ '^[A-Z]{3}$'),
  timezone text not null default 'Asia/Kolkata',
  created_by uuid not null default auth.uid() references auth.users (id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.shop_members (
  shop_id uuid not null references public.shops (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.shop_role not null,
  display_name text,
  email text,
  created_at timestamptz not null default now(),
  primary key (shop_id, user_id)
);
create index shop_members_user_id_idx on public.shop_members (user_id);

create table public.shop_invites (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  email text not null check (email = lower(btrim(email)) and email like '%_@_%'),
  role public.shop_role not null default 'staff' check (role = 'staff'),
  invited_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  unique (shop_id, email)
);
create index shop_invites_email_idx on public.shop_invites (email) where accepted_at is null;

create table public.products (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  sku text check (sku is null or char_length(btrim(sku)) between 1 and 64),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  unit text not null default 'pcs' check (char_length(btrim(unit)) between 1 and 16),
  price numeric(12, 2) check (price is null or price >= 0),
  cost numeric(12, 2) check (cost is null or cost >= 0),
  reorder_point integer not null default 0 check (reorder_point >= 0),
  lead_time_days integer not null default 7 check (lead_time_days between 0 and 365),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, shop_id)
);
create unique index products_shop_sku_key on public.products (shop_id, lower(sku)) where sku is not null;
create unique index products_shop_name_key on public.products (shop_id, lower(name));

create table public.sales (
  id bigint generated always as identity primary key,
  shop_id uuid not null references public.shops (id) on delete cascade,
  product_id uuid not null,
  quantity numeric(12, 3) not null check (quantity > 0),
  unit_price numeric(12, 2) check (unit_price is null or unit_price >= 0),
  sold_at timestamptz not null default now(),
  source text not null default 'manual' check (source in ('manual', 'import')),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  -- the product must belong to the same shop as the sale
  foreign key (product_id, shop_id) references public.products (id, shop_id) on delete restrict
);
create index sales_shop_sold_at_idx on public.sales (shop_id, sold_at desc);
create index sales_product_sold_at_idx on public.sales (product_id, sold_at);

create table public.stock_movements (
  id bigint generated always as identity primary key,
  shop_id uuid not null references public.shops (id) on delete cascade,
  product_id uuid not null,
  quantity numeric(12, 3) not null check (quantity <> 0),
  reason text not null check (reason in ('opening', 'purchase', 'sale', 'adjustment')),
  sale_id bigint references public.sales (id) on delete cascade,
  note text check (note is null or char_length(note) <= 200),
  occurred_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (product_id, shop_id) references public.products (id, shop_id) on delete restrict
);
create index stock_movements_product_idx on public.stock_movements (product_id);
create index stock_movements_shop_occurred_idx on public.stock_movements (shop_id, occurred_at desc);
create index stock_movements_sale_idx on public.stock_movements (sale_id) where sale_id is not null;

-- Current stock per product. security_invoker makes the view obey the caller's RLS.
create view public.product_stock with (security_invoker = true) as
select p.id as product_id, p.shop_id, coalesce(sum(m.quantity), 0)::numeric(14, 3) as on_hand
from public.products p
left join public.stock_movements m on m.product_id = p.id
group by p.id, p.shop_id;

create function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger products_touch_updated_at before update on public.products
for each row execute function private.touch_updated_at();

-- -------------------------------------------------------- access helpers
-- security definer so policies can check membership without recursing into
-- shop_members' own policies. Kept in the non-exposed `private` schema.

create function private.is_shop_member(p_shop uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.shop_members
    where shop_id = p_shop and user_id = (select auth.uid())
  );
$$;

create function private.is_shop_owner(p_shop uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.shop_members
    where shop_id = p_shop and user_id = (select auth.uid()) and role = 'owner'
  );
$$;

revoke all on function private.is_shop_member(uuid), private.is_shop_owner(uuid) from public;
grant execute on function private.is_shop_member(uuid), private.is_shop_owner(uuid) to authenticated;

-- -------------------------------------------------------------- policies

alter table public.shops enable row level security;
alter table public.shop_members enable row level security;
alter table public.shop_invites enable row level security;
alter table public.products enable row level security;
alter table public.sales enable row level security;
alter table public.stock_movements enable row level security;

create policy "members read their shops" on public.shops
  for select to authenticated using (private.is_shop_member(id));
create policy "owners update their shops" on public.shops
  for update to authenticated using (private.is_shop_owner(id)) with check (private.is_shop_owner(id));

create policy "members read their team" on public.shop_members
  for select to authenticated using (private.is_shop_member(shop_id));
create policy "owners remove staff" on public.shop_members
  for delete to authenticated using (private.is_shop_owner(shop_id) and role = 'staff');

create policy "owners and invitees read invites" on public.shop_invites
  for select to authenticated
  using (private.is_shop_owner(shop_id) or email = lower((select auth.jwt()) ->> 'email'));
create policy "owners create invites" on public.shop_invites
  for insert to authenticated
  with check (private.is_shop_owner(shop_id) and invited_by = (select auth.uid()));
create policy "owners delete invites" on public.shop_invites
  for delete to authenticated using (private.is_shop_owner(shop_id));

create policy "members read products" on public.products
  for select to authenticated using (private.is_shop_member(shop_id));
create policy "owners create products" on public.products
  for insert to authenticated with check (private.is_shop_owner(shop_id));
create policy "owners update products" on public.products
  for update to authenticated using (private.is_shop_owner(shop_id)) with check (private.is_shop_owner(shop_id));
create policy "owners delete products" on public.products
  for delete to authenticated using (private.is_shop_owner(shop_id));

create policy "members read sales" on public.sales
  for select to authenticated using (private.is_shop_member(shop_id));
create policy "members record sales" on public.sales
  for insert to authenticated
  with check (private.is_shop_member(shop_id) and created_by = (select auth.uid()));
create policy "owners delete sales" on public.sales
  for delete to authenticated using (private.is_shop_owner(shop_id));

create policy "members read stock movements" on public.stock_movements
  for select to authenticated using (private.is_shop_member(shop_id));
create policy "members record stock movements" on public.stock_movements
  for insert to authenticated
  with check (private.is_shop_member(shop_id) and created_by = (select auth.uid()));
create policy "owners delete stock movements" on public.stock_movements
  for delete to authenticated using (private.is_shop_owner(shop_id));

-- Signed-out visitors get nothing.
revoke all on public.shops, public.shop_members, public.shop_invites, public.products,
  public.sales, public.stock_movements, public.product_stock from anon;

-- -------------------------------------------------------- RPC functions

-- Creates a shop and makes the caller its owner, atomically.
create function public.create_shop(p_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_shop uuid;
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if (select count(*) from public.shop_members where user_id = v_uid and role = 'owner') >= 3 then
    raise exception 'You can own at most 3 shops' using errcode = 'P0001';
  end if;

  insert into public.shops (name, created_by) values (btrim(p_name), v_uid) returning id into v_shop;
  insert into public.shop_members (shop_id, user_id, role, display_name, email)
  values (
    v_shop, v_uid, 'owner',
    (select auth.jwt()) -> 'user_metadata' ->> 'full_name',
    lower((select auth.jwt()) ->> 'email')
  );
  return v_shop;
end;
$$;

-- Accepts an invite addressed to the caller's email.
create function public.accept_invite(p_invite uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower((select auth.jwt()) ->> 'email');
  v_invite public.shop_invites;
begin
  if v_uid is null or v_email is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  select * into v_invite from public.shop_invites
  where id = p_invite and email = v_email and accepted_at is null
  for update;
  if not found then
    raise exception 'Invite not found or already used' using errcode = 'P0002';
  end if;

  insert into public.shop_members (shop_id, user_id, role, display_name, email)
  values (
    v_invite.shop_id, v_uid, v_invite.role,
    (select auth.jwt()) -> 'user_metadata' ->> 'full_name', v_email
  )
  on conflict (shop_id, user_id) do nothing;

  update public.shop_invites set accepted_at = now() where id = p_invite;
  return v_invite.shop_id;
end;
$$;

-- Records a sale and the matching stock decrease in one transaction.
-- security invoker: the caller's RLS rules apply to every insert.
create function public.record_sale(
  p_product uuid,
  p_quantity numeric,
  p_unit_price numeric default null,
  p_sold_at timestamptz default now()
) returns bigint
language plpgsql security invoker set search_path = '' as $$
declare
  v_shop uuid;
  v_sale bigint;
begin
  select shop_id into v_shop from public.products where id = p_product and active;
  if v_shop is null then
    raise exception 'Product not found' using errcode = 'P0002';
  end if;

  insert into public.sales (shop_id, product_id, quantity, unit_price, sold_at, source, created_by)
  values (v_shop, p_product, p_quantity, p_unit_price, coalesce(p_sold_at, now()), 'manual', auth.uid())
  returning id into v_sale;

  insert into public.stock_movements (shop_id, product_id, quantity, reason, sale_id, occurred_at, created_by)
  values (v_shop, p_product, -p_quantity, 'sale', v_sale, coalesce(p_sold_at, now()), auth.uid());

  return v_sale;
end;
$$;

-- Imports historical sales (for forecasting; does not change current stock).
-- p_rows: [{"row": 2, "sku": "A1", "name": "Tea 1kg", "quantity": 3, "unit_price": 250, "sold_at": "2026-01-05"}]
-- Returns {"inserted": n, "created_products": n, "errors": [{"row": 7, "error": "..."}]}
create function public.import_sales(p_shop uuid, p_rows jsonb, p_create_missing boolean default true)
returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_inserted integer := 0;
  v_created integer := 0;
  v_errors jsonb;
begin
  if not private.is_shop_owner(p_shop) then
    raise exception 'Only shop owners can import sales' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 2000 then
    raise exception 'Send between 1 and 2000 rows per call' using errcode = '22023';
  end if;

  -- Create products that don't exist yet (only for otherwise-valid rows).
  if p_create_missing then
    insert into public.products (shop_id, sku, name)
    select distinct on (coalesce(lower(r.sku), lower(r.name)))
      p_shop, r.sku, coalesce(r.name, r.sku)
    from (
      select nullif(btrim(x.sku), '') as sku, nullif(btrim(x.name), '') as name, x.quantity, x.sold_at
      from jsonb_to_recordset(p_rows) as x(sku text, name text, quantity numeric, sold_at timestamptz)
    ) r
    where coalesce(r.sku, r.name) is not null
      and r.quantity > 0
      and r.sold_at is not null
      and not exists (
        select 1 from public.products p
        where p.shop_id = p_shop
          and (case when r.sku is not null then lower(p.sku) = lower(r.sku)
                    else lower(p.name) = lower(r.name) end)
      )
    on conflict do nothing;
    get diagnostics v_created = row_count;
  end if;

  with r as (
    select x."row", nullif(btrim(x.sku), '') as sku, nullif(btrim(x.name), '') as name,
           x.quantity, x.unit_price, x.sold_at
    from jsonb_to_recordset(p_rows) as x("row" integer, sku text, name text, quantity numeric,
                                         unit_price numeric, sold_at timestamptz)
  ),
  m as (
    select r.*, pr.id as product_id,
      case
        when pr.id is null then 'Product not found'
        when r.quantity is null or r.quantity <= 0 then 'Quantity must be more than 0'
        when r.unit_price is not null and r.unit_price < 0 then 'Price cannot be negative'
        when r.sold_at is null then 'Date is missing'
        when r.sold_at > now() + interval '1 day' then 'Date is in the future'
      end as error
    from r
    left join lateral (
      select p.id from public.products p
      where p.shop_id = p_shop
        and (case when r.sku is not null then lower(p.sku) = lower(r.sku)
                  else lower(p.name) = lower(r.name) end)
      limit 1
    ) pr on true
  ),
  ins as (
    insert into public.sales (shop_id, product_id, quantity, unit_price, sold_at, source, created_by)
    select p_shop, m.product_id, m.quantity, m.unit_price, m.sold_at, 'import', auth.uid()
    from m where m.error is null
    returning 1
  )
  select
    (select count(*) from ins),
    coalesce((select jsonb_agg(jsonb_build_object('row', m."row", 'error', m.error) order by m."row")
              from m where m.error is not null), '[]'::jsonb)
  into v_inserted, v_errors;

  return jsonb_build_object('inserted', v_inserted, 'created_products', v_created, 'errors', v_errors);
end;
$$;

revoke all on function public.create_shop(text), public.accept_invite(uuid),
  public.record_sale(uuid, numeric, numeric, timestamptz),
  public.import_sales(uuid, jsonb, boolean) from public, anon;
grant execute on function public.create_shop(text), public.accept_invite(uuid),
  public.record_sale(uuid, numeric, numeric, timestamptz),
  public.import_sales(uuid, jsonb, boolean) to authenticated;
