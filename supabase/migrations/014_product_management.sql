-- Product Management: real categories (replacing ad-hoc free text),
-- colorway/size variant matrix with generated SKUs, product status
-- (distinct from the production `stage`), and a lifecycle history log.
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique(brand_id, name)
);
alter table public.categories enable row level security;
create policy "brand access select categories" on public.categories for select using (public.has_brand_access(brand_id));
create policy "brand access insert categories" on public.categories for insert with check (public.has_brand_access(brand_id));
create policy "brand access delete categories" on public.categories for delete using (public.has_brand_access(brand_id));

alter table public.products add column if not exists status text not null default 'active'; -- active | archived | discontinued
alter table public.products add column if not exists colorways jsonb default '[]'::jsonb;
alter table public.products add column if not exists sizes jsonb default '[]'::jsonb;

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  colorway text not null,
  size text not null,
  sku text not null,
  created_at timestamptz not null default now(),
  unique(product_id, colorway, size)
);
alter table public.product_variants enable row level security;
create policy "brand access select variants" on public.product_variants for select
  using (exists (select 1 from public.products p where p.id = product_id and public.has_brand_access(p.brand_id)));
create policy "brand access insert variants" on public.product_variants for insert
  with check (exists (select 1 from public.products p where p.id = product_id and public.has_brand_access(p.brand_id)));
create policy "brand access delete variants" on public.product_variants for delete
  using (exists (select 1 from public.products p where p.id = product_id and public.has_brand_access(p.brand_id)));

-- Append-only log of `products.stage` changes — "lifecycle" as a real
-- history, distinct from the `status` flag (active/archived/discontinued)
-- above and from the current-value `stage` column that already existed.
create table if not exists public.product_stage_history (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  stage text not null,
  changed_at timestamptz not null default now()
);
alter table public.product_stage_history enable row level security;
create policy "brand access select stage history" on public.product_stage_history for select
  using (exists (select 1 from public.products p where p.id = product_id and public.has_brand_access(p.brand_id)));
create policy "brand access insert stage history" on public.product_stage_history for insert
  with check (exists (select 1 from public.products p where p.id = product_id and public.has_brand_access(p.brand_id)));
