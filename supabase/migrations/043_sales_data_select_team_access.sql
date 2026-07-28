-- Let team members read sales_data, matching the writes added in 042.
--
-- The deployed SELECT policy is owner-only:
--   brand_id IN (SELECT id FROM brands WHERE user_id = auth.uid())
-- which is 009_shopify.sql's version. (INITIAL_SCHEMA.sql:220 defines a
-- member-inclusive policy of the same name, but that is not what is running —
-- confirmed against pg_policies on the live database.)
--
-- That leaves sales_data as the only brand-scoped table where an active team
-- member is locked out: they can read products, vendors, quotes, production
-- orders and samples, but not the sales figures for the same brand. Every other
-- table has used has_brand_access() since 007.
--
-- It also breaks the writes 042 just added for anyone who is not the owner.
-- SalesDashboard.jsx:179 uses .upsert(), which compiles to
-- INSERT ... ON CONFLICT DO UPDATE and needs SELECT to see the conflicting row —
-- so without this, a member's store sync fails on the second run even though
-- INSERT and UPDATE are now permitted.
--
-- This widens read access from owner to owner-or-active-member. That is the
-- intended team model, but it is a genuine change in who can see revenue data,
-- so it is a separate migration rather than folded into 042.

drop policy if exists "Users can view their sales data" on public.sales_data;

create policy "brand access select sales_data" on public.sales_data
  for select using (public.has_brand_access(brand_id));
