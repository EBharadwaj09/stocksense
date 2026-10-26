-- Faster import_sales: look up the shop's products once per batch and hash-join,
-- instead of a per-row lateral scan (which re-ran the RLS check for every product
-- on every row). Same behaviour and checks as before.
create or replace function public.import_sales(p_shop uuid, p_rows jsonb, p_create_missing boolean default true)
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

  if p_create_missing then
    with r as (
      select nullif(btrim(x.sku), '') as sku, nullif(btrim(x.name), '') as name, x.quantity, x.sold_at
      from jsonb_to_recordset(p_rows) as x(sku text, name text, quantity numeric, sold_at timestamptz)
    ),
    p as materialized (
      select lower(sku) as sku_l, lower(name) as name_l from public.products where shop_id = p_shop
    )
    insert into public.products (shop_id, sku, name)
    select distinct on (coalesce(lower(r.sku), lower(r.name)))
      p_shop, r.sku, coalesce(r.name, r.sku)
    from r
    where coalesce(r.sku, r.name) is not null
      and r.quantity > 0
      and r.sold_at is not null
      and (
        (r.sku is not null and not exists (select 1 from p where p.sku_l = lower(r.sku)))
        or (r.sku is null and not exists (select 1 from p where p.name_l = lower(r.name)))
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
  p as materialized (
    select id, lower(sku) as sku_l, lower(name) as name_l from public.products where shop_id = p_shop
  ),
  m as (
    select r.*, case when r.sku is not null then ps.id else pn.id end as product_id
    from r
    left join p ps on r.sku is not null and ps.sku_l = lower(r.sku)
    left join p pn on r.sku is null and pn.name_l = lower(r.name)
  ),
  v as (
    select m.*,
      case
        when m.product_id is null then 'Product not found'
        when m.quantity is null or m.quantity <= 0 then 'Quantity must be more than 0'
        when m.unit_price is not null and m.unit_price < 0 then 'Price cannot be negative'
        when m.sold_at is null then 'Date is missing'
        when m.sold_at > now() + interval '1 day' then 'Date is in the future'
      end as error
    from m
  ),
  ins as (
    insert into public.sales (shop_id, product_id, quantity, unit_price, sold_at, source, created_by)
    select p_shop, v.product_id, v.quantity, v.unit_price, v.sold_at, 'import', auth.uid()
    from v where v.error is null
    returning 1
  )
  select
    (select count(*) from ins),
    coalesce((select jsonb_agg(jsonb_build_object('row', v."row", 'error', v.error) order by v."row")
              from v where v.error is not null), '[]'::jsonb)
  into v_inserted, v_errors;

  return jsonb_build_object('inserted', v_inserted, 'created_products', v_created, 'errors', v_errors);
end;
$$;
