-- Close the INSERT half of the billing-column lockdown that 045 left open.
--
-- 045 revoked table-level UPDATE on brands and granted back only the nine
-- columns the client legitimately writes. It never touched INSERT. The live ACL
-- still reads `authenticated=ardDxtm` — the `a` is INSERT — and
-- has_column_privilege(...,'plan_tier','INSERT') returns true.
--
-- So the columns cannot be CHANGED but can still be SET at creation:
--
--   supabase.from('brands').insert({ user_id: me, name: 'x',
--                                    plan_tier: 'premium',
--                                    stripe_customer_id: '<a real cus_…>' })
--
-- The RLS insert policy only checks `user_id = auth.uid()`, so this passes.
-- First half is free Premium on a brand you own. The second half is worse:
-- the invoice.paid handler looks brands up BY customer id and grants credits to
-- every match, with no cardinality check — so a brand created pointing at
-- someone else's live subscription collects that tier's allowance every cycle,
-- with nothing in Stripe connecting it to you. Creating brands is unlimited, so
-- one subscription can fund arbitrarily many.
--
-- Same fix shape as 045, and the same Postgres gotcha applies: a column-level
-- REVOKE cannot subtract from a table-level grant, so the table-wide INSERT has
-- to go first and the permitted columns be granted back.
--
-- The granted set is 045's nine columns plus user_id. Keeping INSERT and UPDATE
-- on the same column set means "settable at creation" and "settable later" agree,
-- which is one less rule to remember. user_id is INSERT-only by design: it is
-- brand ownership, the insert policy already forces it to equal auth.uid(), and
-- 045 deliberately left it out of the UPDATE set so a brand cannot be handed to
-- another account afterwards.
--
-- Not granted, and therefore no longer settable by a client at creation:
-- plan_tier, stripe_customer_id, stripe_subscription_id, id, created_at.
-- handle_new_user still sets plan_tier on signup — it is SECURITY DEFINER and
-- runs as the owner, so grants to authenticated do not apply to it.
--
-- Verified callers, both of which insert only user_id and name:
--   · AuthContext.jsx:44 (signUp)
--   · ProductsContext.jsx createBrand

revoke insert on public.brands from authenticated, anon;

grant insert (
  user_id,
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
