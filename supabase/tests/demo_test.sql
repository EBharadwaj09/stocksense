-- Checks demo_prepare(). Runs inside a transaction that is always rolled back.
-- Run in the Supabase SQL editor (or with the connector); expect DEMO_TESTS_PASSED.
begin;

do $$
declare
  v_demo uuid := gen_random_uuid();
  v_real uuid := gen_random_uuid();
  v_old_shop uuid;
  v_real_shop uuid;
  v_new_shop uuid;
  v_prod uuid;
  v_other_shops int;
  v_other_sales int;
  v_ok boolean;
begin
  insert into auth.users (id, email, raw_app_meta_data, aud, role)
  values (v_demo, 'demo-test@example.com', '{"demo": true}', 'authenticated', 'authenticated'),
         (v_real, 'real-test@example.com', '{}', 'authenticated', 'authenticated');

  select count(*) into v_other_shops from public.shops;
  select count(*) into v_other_sales from public.sales;

  -- A demo shop with data, and a real shop where the demo account is staff.
  insert into public.shops (name, created_by) values ('Old demo', v_demo) returning id into v_old_shop;
  insert into public.shop_members (shop_id, user_id, role) values (v_old_shop, v_demo, 'owner');
  insert into public.products (shop_id, name) values (v_old_shop, 'Tea') returning id into v_prod;
  insert into public.sales (shop_id, product_id, quantity) values (v_old_shop, v_prod, 2);
  insert into public.stock_movements (shop_id, product_id, quantity, reason) values (v_old_shop, v_prod, 5, 'opening');
  insert into public.forecasts (shop_id, product_id, day, quantity) values (v_old_shop, v_prod, current_date, 1);
  insert into public.shop_invites (shop_id, email, invited_by) values (v_old_shop, 'someone@example.com', v_demo);

  insert into public.shops (name, created_by) values ('Real shop', v_real) returning id into v_real_shop;
  insert into public.shop_members (shop_id, user_id, role) values (v_real_shop, v_real, 'owner'), (v_real_shop, v_demo, 'staff');
  insert into public.shop_invites (shop_id, email, invited_by) values (v_real_shop, 'demo-test@example.com', v_real);

  -- 1. Signed-in users and anonymous visitors cannot call it.
  if has_function_privilege('authenticated', 'public.demo_prepare(uuid, text)', 'execute')
     or has_function_privilege('anon', 'public.demo_prepare(uuid, text)', 'execute') then
    raise exception 'FAIL: demo_prepare is callable by app users';
  end if;
  if not has_function_privilege('service_role', 'public.demo_prepare(uuid, text)', 'execute') then
    raise exception 'FAIL: service_role cannot call demo_prepare';
  end if;

  -- 2. A normal account is refused.
  v_ok := false;
  begin
    perform public.demo_prepare(v_real);
  exception when insufficient_privilege then v_ok := true;
  end;
  if not v_ok then raise exception 'FAIL: non-demo account was reset'; end if;

  -- 3. The demo account gets one fresh, empty shop; the old one and its data are gone.
  v_new_shop := public.demo_prepare(v_demo);
  if exists (select 1 from public.shops where id = v_old_shop) then raise exception 'FAIL: old demo shop kept'; end if;
  if exists (select 1 from public.products where id = v_prod) then raise exception 'FAIL: old products kept'; end if;
  if (select count(*) from public.shop_members where user_id = v_demo) <> 1
     or not exists (select 1 from public.shop_members where user_id = v_demo and shop_id = v_new_shop and role = 'owner') then
    raise exception 'FAIL: demo membership not reset';
  end if;
  if exists (select 1 from public.products where shop_id = v_new_shop) then raise exception 'FAIL: new shop not empty'; end if;

  -- 4. Other people's shops survive; only the demo account's seat and invite are removed.
  if not exists (select 1 from public.shops where id = v_real_shop) then raise exception 'FAIL: real shop deleted'; end if;
  if not exists (select 1 from public.shop_members where shop_id = v_real_shop and user_id = v_real) then
    raise exception 'FAIL: real owner removed';
  end if;
  if exists (select 1 from public.shop_invites where email = 'demo-test@example.com') then
    raise exception 'FAIL: invite to demo account kept';
  end if;
  if (select count(*) from public.shops) <> v_other_shops + 2 then raise exception 'FAIL: unexpected shop count'; end if;
  if (select count(*) from public.sales) <> v_other_sales then raise exception 'FAIL: sales of other shops changed'; end if;

  raise notice 'DEMO_TESTS_PASSED';
end;
$$;

select 'DEMO_TESTS_PASSED' as result;
rollback;
