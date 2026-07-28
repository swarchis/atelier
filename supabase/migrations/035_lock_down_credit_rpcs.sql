-- Lock the AI credit functions to the service-role API.
--
-- 028_ai_credits.sql states the intended model: "All writes happen from the
-- API's service-role client — clients can only READ their own balance (RLS
-- below), never mint credits." The RLS half was implemented correctly (read-only
-- select policies, no write policies). The other half was missing.
--
-- These four functions are SECURITY DEFINER, so they bypass RLS by design — the
-- table's policies are irrelevant to them. Postgres grants EXECUTE on new
-- functions to PUBLIC by default, and PostgREST publishes anything in `public`
-- as an RPC, so every one of them was callable straight from the browser with
-- the anon key. None validates its caller; p_brand_id is just a parameter. That
-- meant any signed-up user could run
--
--   supabase.rpc('grant_subscription_credits',
--     { p_brand_id: <any brand>, p_amount: 99999999, p_reset_at: null })
--
-- to mint unlimited AI credits (real OpenAI/Gemini/Tavily spend) for themselves,
-- or pass p_amount: 0 against someone else's brand id to zero a paying
-- customer's balance. debit_ai_credits could drain another brand the same way.
--
-- Revoking EXECUTE is the whole fix: the backend calls these with
-- SUPABASE_SERVICE_ROLE_KEY, which is unaffected by grants to other roles, and
-- nothing in the frontend calls them (it only SELECTs the balance).
--
-- Deliberately NOT adding a has_brand_access() guard inside the function bodies.
-- That was the obvious defense-in-depth move and it would have broken every AI
-- call in the app: under the service-role key there is no user JWT, so
-- auth.uid() is NULL and has_brand_access() returns false — every debit would
-- raise and every AI feature would fail closed. The caller check belongs where
-- it already is, in metered() in api/index.js, which runs verifyBrandAccess
-- against a verified JWT before it ever reaches these.

revoke all on function public.debit_ai_credits(uuid, integer, text) from public, anon, authenticated;
revoke all on function public.refund_ai_credits(uuid, integer, text) from public, anon, authenticated;
revoke all on function public.grant_subscription_credits(uuid, integer, timestamptz) from public, anon, authenticated;
revoke all on function public.add_topup_credits(uuid, integer, text) from public, anon, authenticated;

-- service_role held EXECUTE only by way of the PUBLIC grant just revoked, so it
-- has to be granted back explicitly or the API loses the ability to move credits.
grant execute on function public.debit_ai_credits(uuid, integer, text) to service_role;
grant execute on function public.refund_ai_credits(uuid, integer, text) to service_role;
grant execute on function public.grant_subscription_credits(uuid, integer, timestamptz) to service_role;
grant execute on function public.add_topup_credits(uuid, integer, text) to service_role;
