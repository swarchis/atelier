-- Sampling: physical sample requests/rounds per product, with images,
-- pinned annotations, structured fit feedback, and an approval workflow
-- (Approved / Rejected / Revision Requested, same shape as the Tech Pack
-- Builder's approval workflow). A "round" is just samples.round_number —
-- requesting a revision creates a new samples row with round_number + 1
-- rather than mutating the old one, so every round stays in the timeline.
-- Run this in the Supabase SQL Editor after 003_vendor_enhancements.sql.

create table if not exists public.samples (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  vendor_id uuid references public.vendors(id) on delete set null,
  round_number integer not null default 1,
  status text not null default 'Requested', -- Requested | In Production | Shipped | Received | Under Review | Revision Requested | Approved | Rejected
  request_notes text,
  expected_date date,
  received_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.sample_images (
  id uuid primary key default gen_random_uuid(),
  sample_id uuid not null references public.samples(id) on delete cascade,
  image_url text not null,
  caption text,
  created_at timestamptz not null default now()
);

-- Pinned to a specific image via x/y percent when image_id is set, or a
-- general round-level note when it's null.
create table if not exists public.sample_annotations (
  id uuid primary key default gen_random_uuid(),
  sample_id uuid not null references public.samples(id) on delete cascade,
  image_id uuid references public.sample_images(id) on delete cascade,
  x_percent numeric,
  y_percent numeric,
  note text not null,
  resolved boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.sample_fit_feedback (
  id uuid primary key default gen_random_uuid(),
  sample_id uuid not null references public.samples(id) on delete cascade,
  area text not null,
  rating text not null,
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.samples enable row level security;
alter table public.sample_images enable row level security;
alter table public.sample_annotations enable row level security;
alter table public.sample_fit_feedback enable row level security;

create policy "brand access select samples" on public.samples for select using (public.has_brand_access(brand_id));
create policy "brand access insert samples" on public.samples for insert with check (public.has_brand_access(brand_id));
create policy "brand access update samples" on public.samples for update using (public.has_brand_access(brand_id));
create policy "brand access delete samples" on public.samples for delete using (public.has_brand_access(brand_id));

create policy "brand access select sample images" on public.sample_images for select
  using (exists (select 1 from public.samples s where s.id = sample_id and public.has_brand_access(s.brand_id)));
create policy "brand access insert sample images" on public.sample_images for insert
  with check (exists (select 1 from public.samples s where s.id = sample_id and public.has_brand_access(s.brand_id)));
create policy "brand access delete sample images" on public.sample_images for delete
  using (exists (select 1 from public.samples s where s.id = sample_id and public.has_brand_access(s.brand_id)));

create policy "brand access select annotations" on public.sample_annotations for select
  using (exists (select 1 from public.samples s where s.id = sample_id and public.has_brand_access(s.brand_id)));
create policy "brand access insert annotations" on public.sample_annotations for insert
  with check (exists (select 1 from public.samples s where s.id = sample_id and public.has_brand_access(s.brand_id)));
create policy "brand access update annotations" on public.sample_annotations for update
  using (exists (select 1 from public.samples s where s.id = sample_id and public.has_brand_access(s.brand_id)));
create policy "brand access delete annotations" on public.sample_annotations for delete
  using (exists (select 1 from public.samples s where s.id = sample_id and public.has_brand_access(s.brand_id)));

create policy "brand access select fit feedback" on public.sample_fit_feedback for select
  using (exists (select 1 from public.samples s where s.id = sample_id and public.has_brand_access(s.brand_id)));
create policy "brand access insert fit feedback" on public.sample_fit_feedback for insert
  with check (exists (select 1 from public.samples s where s.id = sample_id and public.has_brand_access(s.brand_id)));
