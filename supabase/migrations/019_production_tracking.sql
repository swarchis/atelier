-- Production: shipment tracking, a real delivered/received timestamp for
-- honest delivery estimation, an inventory-received ledger, plus issue and
-- factory-update logs. No Shopify write-back here -- the existing Shopify
-- integration is read-only (orders only, no inventory endpoint), so
-- "inventory sync" is implemented as real in-app bookkeeping of units
-- received from production, not a fake external sync.
-- Run this in the Supabase SQL Editor after 004_production_orders.sql.

alter table public.production_orders add column if not exists carrier text;
alter table public.production_orders add column if not exists tracking_number text;
alter table public.production_orders add column if not exists tracking_url text;
alter table public.production_orders add column if not exists shipped_at timestamptz;
alter table public.production_orders add column if not exists delivered_at timestamptz;
alter table public.production_orders add column if not exists received_units integer;

create table if not exists public.production_issues (
  id uuid primary key default gen_random_uuid(),
  production_order_id uuid not null references public.production_orders(id) on delete cascade,
  severity text not null default 'Medium', -- Low | Medium | High | Critical
  description text not null,
  resolved boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.production_updates (
  id uuid primary key default gen_random_uuid(),
  production_order_id uuid not null references public.production_orders(id) on delete cascade,
  note text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.production_issues enable row level security;
alter table public.production_updates enable row level security;

create policy "brand access select issues" on public.production_issues for select
  using (exists (select 1 from public.production_orders o where o.id = production_order_id and public.has_brand_access(o.brand_id)));
create policy "brand access insert issues" on public.production_issues for insert
  with check (exists (select 1 from public.production_orders o where o.id = production_order_id and public.has_brand_access(o.brand_id)));
create policy "brand access update issues" on public.production_issues for update
  using (exists (select 1 from public.production_orders o where o.id = production_order_id and public.has_brand_access(o.brand_id)));

create policy "brand access select updates" on public.production_updates for select
  using (exists (select 1 from public.production_orders o where o.id = production_order_id and public.has_brand_access(o.brand_id)));
create policy "brand access insert updates" on public.production_updates for insert
  with check (exists (select 1 from public.production_orders o where o.id = production_order_id and public.has_brand_access(o.brand_id)));
