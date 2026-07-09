-- Production orders — connects a product + vendor into a trackable production run.
-- Run this in the Supabase SQL Editor after 003_vendor_enhancements.sql.
-- (Reverse-engineered from ProductionContext.jsx / ProductionOrders.jsx — if this
-- table was already created by hand in the Supabase dashboard, diff before running.)

create table if not exists production_orders (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  vendor_id uuid references vendors(id) on delete set null,
  po_number text,
  units integer,
  due_date date,
  stage text not null default 'Sampling',
  checkpoints jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table production_orders enable row level security;

create policy "Users manage their own brand's production orders"
  on production_orders for all
  using (brand_id in (select id from brands where user_id = auth.uid()))
  with check (brand_id in (select id from brands where user_id = auth.uid()));
