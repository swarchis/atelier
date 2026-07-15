-- Ecommerce platform expansion: WooCommerce and Etsy reuse the existing
-- store_connections table (shop_domain/access_token already generalize
-- fine) but need a couple of platform-specific fields it doesn't have yet
-- -- WooCommerce's Consumer Key and Etsy's OAuth refresh token/expiry
-- (Etsy access tokens expire hourly; Shopify's don't, so this wasn't
-- needed until now). Also adds platform_listings, so Product Publishing
-- knows whether a given Atelier product has already been pushed to a
-- given platform (and can link to the live listing) instead of guessing.
-- Run this in the Supabase SQL Editor after 009_shopify.sql.

alter table public.store_connections add column if not exists api_key text; -- WooCommerce consumer key / Etsy keystring
alter table public.store_connections add column if not exists refresh_token text; -- Etsy only
alter table public.store_connections add column if not exists token_expires_at timestamptz; -- Etsy only

create table if not exists public.platform_listings (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  platform text not null, -- shopify | woocommerce | etsy
  external_id text not null,
  external_url text,
  status text not null default 'published', -- published | failed | removed
  published_at timestamptz not null default now(),
  unique(product_id, platform)
);

create index if not exists platform_listings_brand_idx on public.platform_listings(brand_id);

alter table public.platform_listings enable row level security;

create policy "brand access select listings" on public.platform_listings for select using (public.has_brand_access(brand_id));
create policy "brand access insert listings" on public.platform_listings for insert with check (public.has_brand_access(brand_id));
create policy "brand access update listings" on public.platform_listings for update using (public.has_brand_access(brand_id));
create policy "brand access delete listings" on public.platform_listings for delete using (public.has_brand_access(brand_id));
