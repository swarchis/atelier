-- Storefront credentials stop being client-readable.
--
-- ── THE HOLE ────────────────────────────────────────────────────────────────
-- store_connections holds Shopify access tokens, Etsy OAuth token pairs, and
-- WooCommerce consumer key/secret pairs. SalesContext read the table with
-- `select('*')` and the frontend posted those credentials back in the request
-- body of nine endpoints, so every member of a brand — viewers included — held
-- keys that can read a founder's real orders and, on WooCommerce and Etsy,
-- create real products on their live store.
--
-- Identical in shape to the social_accounts leak closed in 054, and worse in
-- consequence: a TikTok token posts to a feed, these touch a storefront.
--
-- ── WHY NOW, WITH ZERO ROWS ─────────────────────────────────────────────────
-- store_connections is currently EMPTY — nobody has ever connected a storefront.
-- That makes this the cheapest possible moment to fix it: no live connection to
-- migrate, no session to break, no deploy-order dance. The same change once
-- founders have connected stores means re-authenticating all of them.
--
-- ── MECHANISM ───────────────────────────────────────────────────────────────
-- Same as 054. "Readable except for these columns" is not a row-level condition,
-- so RLS cannot express it, and per 044's lesson a column-level REVOKE cannot
-- subtract from a table-level grant — so SELECT is revoked table-wide and the
-- non-secret columns are granted back by name.
--
-- INSERT and UPDATE are revoked outright: the backend now writes every row with
-- the service-role key, in the Shopify and Etsy OAuth callbacks and in
-- /api/woocommerce/connect. DELETE is untouched, so Disconnect still works.
--
-- ── CALLER REQUIREMENT ──────────────────────────────────────────────────────
-- `select('*')` requires TABLE-level SELECT, which this revokes; per-column
-- grants do not satisfy it. Every client read of store_connections must name its
-- columns. SalesContext was updated alongside this. Getting it wrong is quiet:
-- the error is swallowed and every connected store renders as not connected,
-- exactly as it did for social_accounts.
--
-- ── DEPLOY ORDER ────────────────────────────────────────────────────────────
-- Ship backend and frontend together FIRST, then run this. With zero rows the
-- blast radius is nil either way, but the order still matters for the next
-- environment that has data.

revoke select on public.store_connections from authenticated, anon;
grant select (
  id, brand_id, platform, shop_domain, connected_at, token_expires_at
) on public.store_connections to authenticated;

-- api_key, access_token and refresh_token are deliberately absent above.

revoke insert, update on public.store_connections from authenticated, anon;
