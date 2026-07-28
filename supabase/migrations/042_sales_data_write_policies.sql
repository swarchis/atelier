-- Give sales_data the write policies it never had.
--
-- RLS was enabled on this table in INITIAL_SCHEMA / 009 with a SELECT policy and
-- nothing else, so every write the frontend attempts is denied by RLS:
--
--   · SalesDashboard.jsx:179  .upsert(chunk, { onConflict: 'brand_id, product_id, month, platform' })
--   · SalesContext.jsx:81     .delete().eq('brand_id', …).eq('platform', …)
--
-- This failed closed, so it was never a security hole — it just meant store sync
-- could not persist anything. Confirmed inert rather than broken-in-use:
-- sales_data, store_connections and platform_listings are all empty, and the
-- e-commerce integrations have never been switched on (no API keys, no platform
-- verification yet). So this migration unblocks a feature for when those keys
-- land rather than repairing live data.
--
-- The upsert above needs INSERT, UPDATE and SELECT together — Postgres evaluates
-- all three for INSERT ... ON CONFLICT DO UPDATE. SELECT already exists, so
-- INSERT and UPDATE are added here; DELETE covers the platform-refresh path in
-- SalesContext, which clears a platform's rows before re-inserting them.
--
-- The matching unique constraint the upsert targets is already in place
-- (sales_data_brand_product_month_platform_key), so no schema change is needed.
--
-- These use has_brand_access() to match every other table since 007.
--
-- NOTE (corrected after checking the live database): the pre-existing SELECT
-- policy is NOT equivalent to has_brand_access(). The deployed version is
-- 009_shopify.sql's, which is owner-only:
--   brand_id IN (SELECT id FROM brands WHERE user_id = auth.uid())
-- INITIAL_SCHEMA.sql:220 shows a member-inclusive variant of the same policy
-- name, but that is not what is running. So team members currently cannot read
-- sales_data at all, and since upsert needs SELECT to see the conflicting row,
-- a non-owner member's sync would still fail despite the writes added here.
-- Aligning that SELECT policy is handled in 043.

drop policy if exists "brand access insert sales_data" on public.sales_data;
create policy "brand access insert sales_data" on public.sales_data
  for insert with check (public.has_brand_access(brand_id));

drop policy if exists "brand access update sales_data" on public.sales_data;
create policy "brand access update sales_data" on public.sales_data
  for update using (public.has_brand_access(brand_id));

drop policy if exists "brand access delete sales_data" on public.sales_data;
create policy "brand access delete sales_data" on public.sales_data
  for delete using (public.has_brand_access(brand_id));
