-- Stop the browser writing the columns that decide entitlement and billing.
-- Replaces 044, which was a silent no-op (see the note at the top of that file).
--
-- Why 044 failed: a column-level REVOKE cannot subtract from a table-level
-- grant. brands carries a table-wide UPDATE for anon and authenticated —
-- pg_class.relacl reads `authenticated=arwdDxtm/postgres`, where `w` covers
-- every column — and `revoke update (plan_tier, …)` leaves that untouched.
-- Postgres accepts the statement and changes nothing.
--
-- The working shape is the opposite: drop the table-wide UPDATE, then grant back
-- exactly the columns the client is allowed to write.
--
-- What this protects:
--   plan_tier              — entitlement. One update = free Premium.
--   stripe_customer_id     — what the invoice.paid webhook matches on when it
--                            grants a cycle's AI credits. Pointing your brand at
--                            a real customer's cus_… makes their subscription
--                            fund your credits every cycle, with nothing in
--                            Stripe linking you to it. There is a live cus_… in
--                            this database now, so this is not hypothetical.
--   stripe_subscription_id — resolves the brand in /api/subscription-status.
--
-- Also now unwritable, as a side benefit rather than the goal: id, user_id and
-- created_at. user_id is brand ownership — RLS already stopped it being set to
-- someone else (the UPDATE policy's USING doubles as its WITH CHECK), but there
-- is no reason for the client to hold the grant either. Nothing in the app
-- writes any of the three.
--
-- The 9 columns granted back are exactly what the client writes today:
--   · Settings.jsx:264 updateBrand(form) — name, target_customer, quality_tier,
--     budget_philosophy, sustainability, manufacturer_preferences, global_risk,
--     notification_settings
--   · TeamContext.jsx:82 — owner_display_name
-- Adding a new user-editable brand field means adding it here too, or the write
-- fails with a permission error rather than an RLS error.
--
-- anon is deliberately not granted anything back: the brands UPDATE policy
-- requires user_id = auth.uid(), which an unauthenticated caller can never
-- satisfy, so anon has no legitimate write path to begin with.
--
-- service_role is untouched — it is a separate grantee in the ACL, so
-- /api/confirm-checkout and /api/subscription-status keep writing normally.

revoke update on public.brands from authenticated, anon;

grant update (
  name,
  target_customer,
  quality_tier,
  budget_philosophy,
  sustainability,
  manufacturer_preferences,
  global_risk,
  notification_settings,
  owner_display_name
) on public.brands to authenticated;
