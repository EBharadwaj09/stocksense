-- Row-level security tests for the M2 schema.
-- Runs entirely inside one transaction and always rolls back: on success it
-- raises 'ALL_RLS_TESTS_PASSED'; on failure it raises 'FAIL: <which check>'.
-- Run with the Supabase SQL editor or the Supabase connector's execute_sql.
do $test$
declare
  a uuid := gen_random_uuid();  -- owner of shop A
  b uuid := gen_random_uuid();  -- owner of shop B
  c uuid := gen_random_uuid();  -- staff invited to shop A
  shop_a uuid; shop_b uuid; product_a uuid; invite_c uuid;
  n bigint; v numeric; res jsonb; failed boolean;
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data) values
    (a, 'owner-a@test.local', 'authenticated', 'authenticated', '{"full_name":"Owner A"}'),
    (b, 'owner-b@test.local', 'authenticated', 'authenticated', '{"full_name":"Owner B"}'),
    (c, 'staff-c@test.local', 'authenticated', 'authenticated', '{"full_name":"Staff C"}');

  execute 'set local role authenticated';

  -- Owner A creates a shop and a product.
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated',
    'email', 'owner-a@test.local', 'user_metadata', json_build_object('full_name', 'Owner A'))::text, true);
  shop_a := public.create_shop('Shop A');
  insert into public.products (shop_id, sku, name, reorder_point) values (shop_a, 'TEA1', 'Tea 1kg', 5)
    returning id into product_a;
  insert into public.shop_invites (shop_id, email) values (shop_a, 'staff-c@test.local') returning id into invite_c;
  insert into public.stock_movements (shop_id, product_id, quantity, reason)
    values (shop_a, product_a, 10, 'purchase');

  -- Owner B creates their own shop.
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated',
    'email', 'owner-b@test.local')::text, true);
  shop_b := public.create_shop('Shop B');

  -- 1. B cannot see A's shop, products, invites or stock.
  select count(*) into n from public.shops where id = shop_a;
  if n <> 0 then raise exception 'FAIL: B can see shop A'; end if;
  select count(*) into n from public.products where shop_id = shop_a;
  if n <> 0 then raise exception 'FAIL: B can see shop A products'; end if;
  select count(*) into n from public.shop_invites where shop_id = shop_a;
  if n <> 0 then raise exception 'FAIL: B can see shop A invites'; end if;
  select count(*) into n from public.product_stock where shop_id = shop_a;
  if n <> 0 then raise exception 'FAIL: B can see shop A stock'; end if;

  -- 2. B cannot write into A's shop.
  failed := false;
  begin
    insert into public.products (shop_id, name) values (shop_a, 'Injected');
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'FAIL: B inserted a product into shop A'; end if;

  failed := false;
  begin
    perform public.record_sale(product_a, 1);
  exception when others then failed := true;
  end;
  if not failed then raise exception 'FAIL: B recorded a sale in shop A'; end if;

  update public.products set reorder_point = 999 where id = product_a;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: B updated a shop A product'; end if;

  -- 3. Staff C sees the invite, accepts it and becomes staff.
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated',
    'email', 'staff-c@test.local', 'user_metadata', json_build_object('full_name', 'Staff C'))::text, true);
  select count(*) into n from public.shop_invites where id = invite_c;
  if n <> 1 then raise exception 'FAIL: invitee cannot see their invite'; end if;
  perform public.accept_invite(invite_c);
  select count(*) into n from public.shop_members where shop_id = shop_a and user_id = c and role = 'staff';
  if n <> 1 then raise exception 'FAIL: invite did not create staff membership'; end if;

  -- 4. Staff can read and record sales, but cannot change products or reorder rules.
  select count(*) into n from public.products where shop_id = shop_a;
  if n <> 1 then raise exception 'FAIL: staff cannot read shop products'; end if;

  perform public.record_sale(product_a, 3, 250);
  select on_hand into v from public.product_stock where product_id = product_a;
  if v <> 7 then raise exception 'FAIL: stock after sale is %, expected 7', v; end if;

  update public.products set reorder_point = 0 where id = product_a;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: staff changed reorder rules'; end if;

  failed := false;
  begin
    insert into public.products (shop_id, name) values (shop_a, 'Staff product');
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'FAIL: staff created a product'; end if;

  delete from public.sales where shop_id = shop_a;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: staff deleted sales'; end if;

  failed := false;
  begin
    perform public.import_sales(shop_a, '[{"row":2,"sku":"X","quantity":1,"sold_at":"2026-01-01"}]'::jsonb);
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'FAIL: staff ran an import'; end if;

  -- Staff cannot remove the owner.
  delete from public.shop_members where shop_id = shop_a and user_id = a;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: staff removed the owner'; end if;

  -- 5. Owner import: one good row (creates product), one bad quantity, one future date.
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated',
    'email', 'owner-a@test.local')::text, true);
  res := public.import_sales(shop_a, jsonb_build_array(
    jsonb_build_object('row', 2, 'sku', 'RICE5', 'name', 'Rice 5kg', 'quantity', 4, 'unit_price', 300, 'sold_at', '2026-01-05'),
    jsonb_build_object('row', 3, 'sku', 'TEA1', 'quantity', 0, 'sold_at', '2026-01-06'),
    jsonb_build_object('row', 4, 'sku', 'TEA1', 'quantity', 2, 'sold_at', '2099-01-01')
  ));
  if (res ->> 'inserted')::int <> 1 or (res ->> 'created_products')::int <> 1
     or jsonb_array_length(res -> 'errors') <> 2 then
    raise exception 'FAIL: unexpected import result %', res;
  end if;
  -- Imported history does not change current stock.
  select on_hand into v from public.product_stock where product_id = product_a;
  if v <> 7 then raise exception 'FAIL: import changed stock to %', v; end if;

  -- Owner can remove staff.
  delete from public.shop_members where shop_id = shop_a and user_id = c;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL: owner could not remove staff'; end if;

  -- 6. Signed-out visitors see nothing.
  execute 'set local role anon';
  failed := false;
  begin
    perform 1 from public.products limit 1;
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'FAIL: anon can read products'; end if;

  raise exception 'ALL_RLS_TESTS_PASSED';
end;
$test$;
