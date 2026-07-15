-- Marketing foundation: content_posts/social_accounts have been read and
-- written by ContentContext.jsx since an earlier session with no
-- migration ever creating them (same drift pattern as production_payments
-- before it) -- this creates them for real, and adds the access_token/
-- refresh_token columns the OAuth rebuild in api/index.js now actually
-- needs (the old flow discarded the token instead of storing it, so it
-- was never missed until now). Also lays the schema for Influencer CRM,
-- Email Campaigns, and the Product Launch Planner.
-- Run this in the Supabase SQL Editor after 025_woocommerce_and_multiplatform_sales.sql.

create table if not exists public.social_accounts (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  platform text not null, -- instagram | tiktok | youtube | pinterest
  handle text,
  connected boolean not null default true,
  followers integer default 0,
  access_token text,
  refresh_token text,
  connected_at timestamptz not null default now(),
  unique(brand_id, platform)
);

create table if not exists public.content_posts (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  platform text not null,
  scheduled_for timestamptz not null,
  caption text,
  status text not null default 'Scheduled', -- Draft | Scheduled | Posted | Failed
  image_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.influencers (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  name text not null,
  handle text,
  platform text,
  followers integer,
  contact_info text,
  rate numeric,
  status text not null default 'Prospect', -- Prospect | Contacted | Negotiating | Active | Completed
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.influencer_deals (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  influencer_id uuid not null references public.influencers(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  deliverables text,
  amount numeric,
  status text not null default 'Proposed', -- Proposed | Agreed | Delivered | Paid
  deal_date date,
  created_at timestamptz not null default now()
);

create table if not exists public.email_contacts (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  email text not null,
  name text,
  tags jsonb not null default '[]'::jsonb,
  subscribed boolean not null default true,
  added_at timestamptz not null default now(),
  unique(brand_id, email)
);

create table if not exists public.email_campaigns (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  subject text not null,
  body text not null,
  status text not null default 'Draft', -- Draft | Sent
  recipient_count integer default 0,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.products add column if not exists launch_date date;
alter table public.products add column if not exists launch_plan jsonb not null default '[]'::jsonb;

alter table public.social_accounts enable row level security;
alter table public.content_posts enable row level security;
alter table public.influencers enable row level security;
alter table public.influencer_deals enable row level security;
alter table public.email_contacts enable row level security;
alter table public.email_campaigns enable row level security;

create policy "brand access select social_accounts" on public.social_accounts for select using (public.has_brand_access(brand_id));
create policy "brand access insert social_accounts" on public.social_accounts for insert with check (public.has_brand_access(brand_id));
create policy "brand access update social_accounts" on public.social_accounts for update using (public.has_brand_access(brand_id));
create policy "brand access delete social_accounts" on public.social_accounts for delete using (public.has_brand_access(brand_id));

create policy "brand access select content_posts" on public.content_posts for select using (public.has_brand_access(brand_id));
create policy "brand access insert content_posts" on public.content_posts for insert with check (public.has_brand_access(brand_id));
create policy "brand access update content_posts" on public.content_posts for update using (public.has_brand_access(brand_id));
create policy "brand access delete content_posts" on public.content_posts for delete using (public.has_brand_access(brand_id));

create policy "brand access select influencers" on public.influencers for select using (public.has_brand_access(brand_id));
create policy "brand access insert influencers" on public.influencers for insert with check (public.has_brand_access(brand_id));
create policy "brand access update influencers" on public.influencers for update using (public.has_brand_access(brand_id));
create policy "brand access delete influencers" on public.influencers for delete using (public.has_brand_access(brand_id));

create policy "brand access select influencer_deals" on public.influencer_deals for select using (public.has_brand_access(brand_id));
create policy "brand access insert influencer_deals" on public.influencer_deals for insert with check (public.has_brand_access(brand_id));
create policy "brand access update influencer_deals" on public.influencer_deals for update using (public.has_brand_access(brand_id));
create policy "brand access delete influencer_deals" on public.influencer_deals for delete using (public.has_brand_access(brand_id));

create policy "brand access select email_contacts" on public.email_contacts for select using (public.has_brand_access(brand_id));
create policy "brand access insert email_contacts" on public.email_contacts for insert with check (public.has_brand_access(brand_id));
create policy "brand access update email_contacts" on public.email_contacts for update using (public.has_brand_access(brand_id));
create policy "brand access delete email_contacts" on public.email_contacts for delete using (public.has_brand_access(brand_id));

create policy "brand access select email_campaigns" on public.email_campaigns for select using (public.has_brand_access(brand_id));
create policy "brand access insert email_campaigns" on public.email_campaigns for insert with check (public.has_brand_access(brand_id));
create policy "brand access update email_campaigns" on public.email_campaigns for update using (public.has_brand_access(brand_id));
