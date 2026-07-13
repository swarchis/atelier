-- Materials Library: a fabric/trim type filter, honest sustainability and
-- availability fields on the shared global `materials` table, plus real
-- write access to it (today it's select-only for authenticated users, so
-- the existing deleteMaterial() call has had nothing to actually delete
-- with — this adds insert/update/delete policies too).
-- Cost history and supplier links are inherently per-brand facts (what
-- YOU paid, WHO you buy from), so they live in new brand-scoped child
-- tables that reference the shared material row rather than as columns on
-- `materials` itself.
-- Run this in the Supabase SQL Editor after 007_teams_and_rls.sql.

alter table public.materials add column if not exists type text not null default 'fabric'; -- fabric | trim | notion
alter table public.materials add column if not exists sustainability_info text;
alter table public.materials add column if not exists certifications jsonb not null default '[]'::jsonb;
alter table public.materials add column if not exists availability text not null default 'Unknown'; -- In Stock | Low Stock | Backordered | Discontinued | Unknown

-- Materials is a shared reference library (no brand_id, no ownership),
-- matching the existing wide-open "any authenticated user can read" policy
-- — write access is opened the same way rather than inventing a new
-- per-row ownership model for a table that was never designed to have one.
create policy "authenticated users insert materials" on public.materials for insert with check (auth.role() = 'authenticated');
create policy "authenticated users update materials" on public.materials for update using (auth.role() = 'authenticated');
create policy "authenticated users delete materials" on public.materials for delete using (auth.role() = 'authenticated');

create table if not exists public.material_cost_log (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  material_id uuid not null references public.materials(id) on delete cascade,
  unit_cost numeric not null,
  note text,
  logged_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create table if not exists public.material_vendors (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  material_id uuid not null references public.materials(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(brand_id, material_id, vendor_id)
);

alter table public.material_cost_log enable row level security;
alter table public.material_vendors enable row level security;

create policy "brand access select cost log" on public.material_cost_log for select using (public.has_brand_access(brand_id));
create policy "brand access insert cost log" on public.material_cost_log for insert with check (public.has_brand_access(brand_id));
create policy "brand access delete cost log" on public.material_cost_log for delete using (public.has_brand_access(brand_id));

create policy "brand access select material vendors" on public.material_vendors for select using (public.has_brand_access(brand_id));
create policy "brand access insert material vendors" on public.material_vendors for insert with check (public.has_brand_access(brand_id));
create policy "brand access delete material vendors" on public.material_vendors for delete using (public.has_brand_access(brand_id));
