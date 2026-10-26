-- M5: public demo account.
-- The nightly job (secret key = service_role) calls demo_prepare() to wipe the demo
-- account's shops and give it a fresh, empty "Demo Kirana Store"; the job then loads
-- the sample history into it. Only an account whose app_metadata has "demo": true can
-- be reset, and app_metadata can only be set with the secret key (Auth admin API),
-- never by the user, so this can't be pointed at a real shop.

create function public.demo_prepare(p_user uuid, p_shop_name text default 'Demo Kirana Store')
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_email text;
  v_is_demo boolean;
  v_shops uuid[];
  v_shop uuid;
begin
  select lower(u.email), coalesce((u.raw_app_meta_data ->> 'demo')::boolean, false)
    into v_email, v_is_demo
  from auth.users u where u.id = p_user;
  if v_email is null then
    raise exception 'Demo user % not found', p_user using errcode = 'P0002';
  end if;
  if not v_is_demo then
    raise exception 'User % is not a demo account', p_user using errcode = '42501';
  end if;

  -- Shops the demo account owns or created (visitors may have made extra ones).
  select coalesce(array_agg(distinct s.id), '{}') into v_shops
  from public.shops s
  where s.created_by = p_user
     or s.id in (select m.shop_id from public.shop_members m where m.user_id = p_user and m.role = 'owner');

  -- Children first: sales -> products is ON DELETE RESTRICT.
  delete from public.stock_movements where shop_id = any (v_shops);
  delete from public.sales where shop_id = any (v_shops);
  delete from public.forecasts where shop_id = any (v_shops);
  delete from public.products where shop_id = any (v_shops);
  delete from public.shops where id = any (v_shops); -- cascades members, invites, forecast_runs

  -- Staff seats the demo account accepted in other people's shops, and invites addressed to it.
  delete from public.shop_members where user_id = p_user;
  delete from public.shop_invites where email = v_email;

  insert into public.shops (name, created_by) values (p_shop_name, p_user) returning id into v_shop;
  insert into public.shop_members (shop_id, user_id, role, display_name, email)
  values (v_shop, p_user, 'owner', 'Demo Owner', v_email);
  return v_shop;
end;
$$;

revoke execute on function public.demo_prepare(uuid, text) from public, anon, authenticated;
grant execute on function public.demo_prepare(uuid, text) to service_role;
