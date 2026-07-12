-- Tech Pack Builder: every section beyond BOM/measurements/sampling that
-- already existed, plus a real approval workflow and version history.
alter table public.tech_packs add column if not exists construction jsonb default '[]'::jsonb;
alter table public.tech_packs add column if not exists print_placements jsonb default '[]'::jsonb;
alter table public.tech_packs add column if not exists trims jsonb default '[]'::jsonb;
alter table public.tech_packs add column if not exists labels jsonb default '[]'::jsonb;
alter table public.tech_packs add column if not exists packaging jsonb default '[]'::jsonb;
alter table public.tech_packs add column if not exists material_usage jsonb default '[]'::jsonb;
alter table public.tech_packs add column if not exists manufacturing_notes text default '';
alter table public.tech_packs add column if not exists compliance_notes text default '';
alter table public.tech_packs add column if not exists questionnaire jsonb default '{}'::jsonb;
alter table public.tech_packs add column if not exists approval_status text not null default 'draft'; -- draft | pending | approved | rejected
alter table public.tech_packs add column if not exists approved_by uuid references auth.users(id) on delete set null;
alter table public.tech_packs add column if not exists approved_at timestamptz;
alter table public.tech_packs add column if not exists approval_comment text;

create table if not exists public.tech_pack_versions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  snapshot jsonb not null,
  label text not null default 'Snapshot',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.tech_pack_versions enable row level security;
create policy "brand access select tp versions" on public.tech_pack_versions for select
  using (exists (select 1 from public.products p where p.id = product_id and public.has_brand_access(p.brand_id)));
create policy "brand access insert tp versions" on public.tech_pack_versions for insert
  with check (exists (select 1 from public.products p where p.id = product_id and public.has_brand_access(p.brand_id)));
create policy "brand access delete tp versions" on public.tech_pack_versions for delete
  using (exists (select 1 from public.products p where p.id = product_id and public.has_brand_access(p.brand_id)));
