-- Least privilege: app users never need TRUNCATE, TRIGGER or REFERENCES,
-- and TRUNCATE would bypass row-level security entirely.
revoke truncate, trigger, references on
  public.shops, public.shop_members, public.shop_invites, public.products,
  public.sales, public.stock_movements
from authenticated;

-- product_stock is a read-only view.
revoke insert, update, delete, truncate, trigger, references on public.product_stock from authenticated;

-- Sales and stock movements are an append-only ledger; corrections are new rows.
revoke update on public.sales, public.stock_movements from authenticated;

-- Membership changes only through create_shop / accept_invite.
revoke insert, update on public.shop_members from authenticated;
revoke update on public.shop_invites from authenticated;
