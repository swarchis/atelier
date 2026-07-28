-- Reusable mockup templates a brand saves for itself.
--
-- Starting a design previously meant one of the nine built-in silhouettes, a
-- one-off upload, or an AI sketch. A brand that works from its own blocks (its
-- standard hoodie, its own body shape) had to re-upload the same file every
-- time. These are saved once and then appear beside the built-in presets.
--
-- The image itself lives in the existing `mockups` storage bucket; this table
-- just records it and scopes it to the brand.
create table if not exists public.brand_mockups (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  name text not null,
  image_url text not null,
  -- Set when the mockup was saved straight off a design canvas, so the
  -- layered original can be reopened rather than a flattened copy.
  psd_url text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists brand_mockups_brand_idx on public.brand_mockups(brand_id, created_at desc);

alter table public.brand_mockups enable row level security;

-- Anyone who can see the brand can use its mockups; any member can add or
-- remove one, the same way they can add a product.
create policy "brand access selects mockups"
  on public.brand_mockups for select using (public.has_brand_access(brand_id));
create policy "brand access inserts mockups"
  on public.brand_mockups for insert with check (public.has_brand_access(brand_id));
create policy "brand access deletes mockups"
  on public.brand_mockups for delete using (public.has_brand_access(brand_id));
create policy "brand access updates mockups"
  on public.brand_mockups for update using (public.has_brand_access(brand_id));
