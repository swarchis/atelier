-- Size curve: the quantity split of a production order across sizes.
--
-- production_orders.units has always been a single integer, so a founder could
-- take a design all the way to a factory PO and commit capital on "300 units"
-- with no size split. That is not a missing field, it is a missing decision —
-- and it is the one that quietly costs the most:
--
--   Core sizes (M/L) clear at full price in weeks; fringe sizes (XS/XXL) sit at
--   38-42% sell-through and get marked down 50%. A flat buy therefore loses
--   money twice — visibly, on the markdown, and invisibly, on the core-size
--   demand there was no stock to serve. The second loss is larger and appears
--   in no report, because "sold out of M and L" reads as success.
--
-- The size axis already existed in product_variants (product_id, colorway,
-- size, sku) from 014. What was missing everywhere was a QUANTITY against it.
create table if not exists public.production_order_sizes (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  production_order_id uuid not null references public.production_orders(id) on delete cascade,
  -- Size and colorway are stored as text rather than a product_variants FK on
  -- purpose. An order is placed before variants necessarily exist, and a
  -- factory PO must stay readable after a product is renamed or a colorway
  -- dropped. The PO is a historical record of what was ordered.
  colorway text not null default '',
  size text not null,
  units integer not null default 0 check (units >= 0),
  -- Filled in at goods-in. Factories ship short on some sizes and over on
  -- others, and a curve you planned is not a curve you received.
  received_units integer check (received_units is null or received_units >= 0),
  created_at timestamptz not null default now(),
  unique(production_order_id, colorway, size)
);

create index if not exists production_order_sizes_order_idx
  on public.production_order_sizes(production_order_id);

alter table public.production_order_sizes enable row level security;

create policy "brand access select order sizes" on public.production_order_sizes
  for select using (public.has_brand_access(brand_id));
create policy "brand access insert order sizes" on public.production_order_sizes
  for insert with check (public.has_brand_access(brand_id));
create policy "brand access update order sizes" on public.production_order_sizes
  for update using (public.has_brand_access(brand_id));
create policy "brand access delete order sizes" on public.production_order_sizes
  for delete using (public.has_brand_access(brand_id));

-- production_orders.units stays authoritative as the order total and is kept in
-- step by this trigger. Deliberately NOT dropped in favour of a computed sum:
-- every existing order, dashboard stat, financial calculation and analytics
-- query reads `units`, and an order with no size breakdown is still a valid
-- order. Adding the curve must not invalidate what is already there.
create or replace function public.sync_production_order_units()
returns trigger language plpgsql security definer as $$
declare
  v_order uuid;
  v_total integer;
begin
  v_order := coalesce(new.production_order_id, old.production_order_id);
  select sum(units) into v_total
    from public.production_order_sizes where production_order_id = v_order;
  -- All size rows deleted means the founder removed the breakdown, not that the
  -- order is now zero units. Leave the existing total alone in that case.
  if v_total is not null then
    update public.production_orders set units = v_total where id = v_order;
  end if;
  return null;
end $$;

drop trigger if exists production_order_sizes_sync on public.production_order_sizes;
create trigger production_order_sizes_sync
  after insert or update or delete on public.production_order_sizes
  for each row execute function public.sync_production_order_units();
