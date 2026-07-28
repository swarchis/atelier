# Atelier — Pre-Launch Security Audit

**Date:** 2026-07-28
**Scope:** `api/` (Express, 2,391 lines), `la-guia/src/` (React SPA), `supabase/migrations/` (33 files), git history, dependency tree.
**Method:** Read-only. Every route, every RLS policy, every SECURITY DEFINER function, and the full git object history were read by hand. No code was changed.

**Confidence labels**
- **CONFIRMED** — I traced the actual code path end to end in this repo.
- **SUSPECTED** — depends on deployed configuration (Supabase dashboard, Railway env) that is not in the repo and that I cannot read from here. Each one includes a query or command you can run to settle it.

**Bottom line:** one Critical and one High finding, both in the billing/credits path, both reachable by anyone who can sign up. Everything else is Medium or below. The parts of this codebase that were hardened previously (SSRF helpers, OAuth state signing, email auth, AI metering) held up under a second read. The gaps are in the database layer, which that earlier pass did not reach.

---

## Findings

| # | Sev | File / line | What an attacker can actually do | Confidence |
|---|---|---|---|---|
| 1 | **Critical** | `supabase/migrations/028_ai_credits.sql:54–135` | Mint themselves unlimited AI credits, or zero out any other brand's credits, with one `supabase.rpc()` call from the browser console | CONFIRMED |
| 2 | **High** | `supabase/migrations/007_teams_and_rls.sql:72`; `api/index.js:1131–1141`, `934–957` | Set their own `plan_tier` to `premium`; graft another brand's Stripe customer onto their own to harvest that subscription's monthly credits and open that customer's billing portal | CONFIRMED |
| 3 | Medium | `api/index.js:1686–1717` | Send arbitrary HTML to any address from `invites@atelierlabs.app`, carrying your SPF/DKIM — a phishing relay wearing your domain | CONFIRMED |
| 4 | Medium | `supabase/migrations/016_chat.sql:63–64` | A team member (any role, incl. `viewer`) can add a total outsider to a brand chat, giving them read access to its full history | CONFIRMED |
| 5 | Medium | `api/index.js:50–64` | If `ALLOWED_ORIGINS` is unset on Railway, any website can make credentialed cross-origin calls to your API | SUSPECTED |
| 6 | Low | `api/index.js:1042–1050` | Steal a store/social access token by capturing a handoff code from browser history or a referrer header within a 2-minute window | CONFIRMED |
| 7 | Low | `api/index.js:730–743` | Blind SSRF: make the server issue GETs to internal addresses. No response body is returned, so it is a probe, not a read | CONFIRMED |
| 8 | Low | `la-guia/src/components/PhotopeaEditor.jsx:82, 112` | If the Photopea iframe were ever navigated off-origin, design data sent with `postMessage(…, '*')` would follow it | CONFIRMED |
| 9 | Low | `la-guia/src/lib/designImages.js:34–48`, `ProductsContext.jsx:489–495` | Anyone with a file URL reads it forever (buckets are public); knowing a product UUID may allow overwriting or deleting another brand's assets | SUSPECTED |

---

### 1. Critical — AI credit functions are callable directly by any user

`028_ai_credits.sql` defines four `SECURITY DEFINER` functions: `debit_ai_credits`, `refund_ai_credits`, `grant_subscription_credits`, `add_topup_credits`. `SECURITY DEFINER` means they run as the definer and **bypass RLS entirely**.

Two things are missing from all four:

1. **No caller validation.** Not one of them checks `auth.uid()` or calls `has_brand_access(p_brand_id)`. The brand ID is just a parameter.
2. **No `REVOKE`.** Postgres grants `EXECUTE` to `PUBLIC` on new functions by default, and PostgREST publishes anything in the `public` schema as an RPC endpoint. Nothing in the migrations takes that grant back.

The file's own header comment states the intended model — *"All writes happen from the API's service-role client — clients can only READ their own balance (RLS below), never mint credits."* The RLS part of that is correctly implemented (lines 45–48 add `select` policies and no write policies). But RLS on the table is irrelevant when the RPC that writes to it is exposed directly.

The author clearly knew about grants — `021`, `022`, and `031` all end with an explicit `grant execute … to authenticated`. The credit functions were simply never given the matching `revoke`.

**Attack, from the browser console of any signed-up account:**

```js
// Unlimited credits, permanently, for free:
await supabase.rpc('grant_subscription_credits',
  { p_brand_id: '<my-own-brand-uuid>', p_amount: 99999999, p_reset_at: null })

// Or grant paid top-up credits without paying:
await supabase.rpc('add_topup_credits',
  { p_brand_id: '<my-own-brand-uuid>', p_amount: 99999999, p_stripe_ref: 'none' })
```

That is direct, unbounded spend on your OpenAI (`gpt-image-1`), Gemini, and Tavily accounts. The `metered()` middleware, the `$0.005`-per-credit ceiling, and the AI rate limiter all still apply per request — but the credit balance that is supposed to bound total spend no longer bounds anything.

It is also a **cross-tenant** issue, because `p_brand_id` is arbitrary. Brand UUIDs are not secret from a teammate, a former teammate, or anyone who has ever been shown one:

```js
// Zero another brand's credits — denial of service against a paying customer:
await supabase.rpc('grant_subscription_credits',
  { p_brand_id: '<victim-brand-uuid>', p_amount: 0, p_reset_at: null })

// Or drain them one debit at a time:
await supabase.rpc('debit_ai_credits',
  { p_brand_id: '<victim-brand-uuid>', p_cost: 100000, p_feature: 'x' })
```

**How I verified:** read all four function bodies (no `auth.uid()` appears in any of them); grepped every migration for `grant`/`revoke` — only three `grant execute` lines exist, all for the chat functions, none for these; confirmed the frontend uses the anon key (`la-guia/src/lib/supabase.js:9`) and already calls `supabase.rpc()` successfully elsewhere (`ChatContext.jsx:54`), so the RPC surface is demonstrably reachable from the client.

**Settle the SUSPECTED half** (whether a manual `REVOKE` was ever applied in the dashboard) by running this in the Supabase SQL editor:

```sql
select p.proname,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_call,
       has_function_privilege('anon',          p.oid, 'EXECUTE') as anon_can_call
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('debit_ai_credits','refund_ai_credits',
                    'grant_subscription_credits','add_topup_credits');
```

Any `true` in either column confirms the finding as deployed.

---

### 2. High — plan tier and Stripe identifiers are client-writable

`brands` has this update policy (`007_teams_and_rls.sql:72`):

```sql
create policy "Owner updates their own brand" on public.brands for update using (user_id = auth.uid());
```

That is row-level, as intended — but there is no column-level restriction, and `brands` holds `plan_tier`, `stripe_customer_id`, and `stripe_subscription_id` (`INITIAL_SCHEMA.sql:22–24`). A brand owner can write all three directly through the anon key.

**2a — Self-upgrade.** `await supabase.from('brands').update({ plan_tier: 'premium' }).eq('id', myBrandId)` grants every `plan_tier`-gated feature. Entitlement is read client-side in at least four places (`AIUsageContext.jsx:67`, `VendorDiscovery.jsx:201`, `Design.jsx:142`, `Settings.jsx:53`) via `getPlan(activeBrand?.plan_tier)`. This does **not** grant AI credits — those come from the webhook, and server-side AI spend is correctly gated on the credit balance rather than on `plan_tier`, which is good design and limits the blast radius here.

**2b — Stripe customer grafting.** This one is worse, because it converts a client-side write into recurring server-granted value. `api/index.js:1138–1141` handles `invoice.paid` by looking brands up **by customer ID** and granting credits to every match:

```js
const { data: brands } = await supabase.from('brands').select('id').eq('stripe_customer_id', customerId);
for (const b of brands || []) {
  await supabase.rpc('grant_subscription_credits', { p_brand_id: b.id, p_amount: amount, p_reset_at: periodEnd });
}
```

An attacker who sets their own brand's `stripe_customer_id` to a real paying customer's `cus_…` receives that tier's full credit allowance every time the victim's invoice is paid — funded by the victim's subscription, indefinitely, with no Stripe record tying it to the attacker.

**2c — Billing portal IDOR.** `/api/create-portal-session` (`api/index.js:934–957`) resolves the brand *from* the client-supplied `customerId`, then checks access against that resolved brand. Write your own row's `stripe_customer_id` to a `cus_…` you want to reach, and the lookup resolves to *your* brand, `verifyBrandAccess` passes, and Stripe opens the portal for someone else's customer — payment methods, invoices, cancellation. The `maybeSingle()` call means this only works while no other brand row carries that same ID, which is the common case for a fresh target.

**How I verified:** read the policy and the `brands` DDL; confirmed the omission of `WITH CHECK` is *not* the issue here (Postgres reuses `USING` as the check when `WITH CHECK` is absent, so row ownership is enforced correctly — the gap is column scope, not row scope); traced all three consumer paths in `api/index.js` and `BillingTab.jsx`.

**This fix changes behavior — see "Needs your decision" below.** `BillingTab.jsx:39, 79, 82, 108` writes these columns from the client today, so a blanket column revoke would break upgrade confirmation.

---

### 3. Medium — `/api/send-vendor-email` is an authenticated open relay

```js
app.post('/api/send-vendor-email', requireAuth, async (req, res) => {
  const { to, subject, body, vendorName } = req.body;
  ...
  const htmlBody = `<div style="...">${body.replace(/\n/g, '<br/>')}</div>`;
  await resend.emails.send({ from: 'Atelier Outreach <invites@atelierlabs.app>', to: [to], subject, html: htmlBody });
```

`requireAuth` is present, but unlike its two siblings this endpoint has **no `verifyBrandAccess`**, and `body` goes into the HTML **unescaped**. Recipient, subject, and full HTML are all caller-controlled. Since signup is open, "authenticated" is a formality: register an account, then send arbitrary branded HTML from your verified domain to anyone. Deliverability damage compounds — a spam run here degrades the domain reputation that your invite and RFQ mail depends on.

`/api/send-campaign` also sends caller-supplied HTML, but that is the actual feature (email campaigns), and it is correctly brand-scoped and capped at 500 recipients. The gap specific to this endpoint is the missing brand check and the missing escape.

Rate limiting is in place (`emailLimiter`, 15 per 15 min per IP), which caps volume but not the ability to send.

**How I verified:** read the handler; compared against `/api/send-invite` (line 1605) and `/api/send-campaign` (line 1658), both of which do call `verifyBrandAccess`; confirmed `escapeHtml` exists at line 231 and is simply not applied here.

---

### 4. Medium — any chat member can add any user to a chat

```sql
create policy "chat members add participants" on public.chat_participants for insert
  with check (public.is_chat_member(chat_id));
```

The check confirms the *inserter* is a chat member. It never checks the `user_id` being inserted. So any participant can insert an arbitrary `user_id` and give that account full read access to the chat — `chat_messages` select is gated on `is_chat_member(chat_id)`, which the new row now satisfies.

This is notable because `create_group_chat` (`031:78–89`) does exactly the right thing: it loops the requested participants and adds only those with brand ownership or an active `brand_members` row. That careful check is bypassed entirely by writing to the table directly, which the anon key permits.

Practical impact: a `viewer`-role teammate, or anyone who stays a chat participant after being removed from `brand_members`, can leak an entire brand chat to an outside account. Requires knowing the target's auth UUID.

The delete policy has the same shape (`using (public.is_chat_member(chat_id))`) — any member can remove any other participant.

**How I verified:** read the policies in `016_chat.sql`, the `is_chat_member` definition (`016:37`), and the contrasting membership loop in `031`.

---

### 5. Medium (config) — CORS fails open

```js
if (allowedOrigins.length === 0) return cb(null, true);
```

With `ALLOWED_ORIGINS` unset, every origin is allowed, and `credentials: true` is set. The code warns loudly at boot, and the comment says this was a deliberate no-break default. That is a reasonable migration choice, but it is the wrong default to launch on.

The practical exposure is narrower than it looks: your API authenticates with a `Bearer` token from `localStorage`, not cookies, so a malicious site cannot ride an ambient session. It would still be able to call unauthenticated endpoints from a victim's browser and IP.

**I cannot see your Railway environment.** Confirm with `railway variables | grep ALLOWED_ORIGINS`, or check the service's Variables tab. If it is set to your real frontend origins, this finding is closed with no code change.

---

### 6–9. Low

**6 — `/api/oauth/consume` is unauthenticated.** The handoff code is 160 bits of CSPRNG entropy, single-use, and expires in 2 minutes, so it cannot be guessed. But it is delivered as a **URL query parameter** (`api/index.js:1203, 1474, 2106`), which puts it in browser history, and potentially in referrer headers and any logging in front of the SPA. Anyone who captures it inside the 2-minute window and redeems it first receives the store/social access token. The design already avoids the worse version of this (the token itself used to be in the URL); this is the residual.

**7 — Blind SSRF in `isLikelyAlive()`.** `api/index.js:735` fetches URLs that came from Tavily results as filtered by Gemini, with no `safeStoreUrl()` validation, a 5s timeout, and `redirect: 'follow'`. Only a boolean reaches the client and the body is never echoed, so this is a probe rather than a read, and the URL is only indirectly attacker-influenced (it would take poisoning a search result). Worth noting mainly because `safeStoreUrl` already exists and is not applied here.

**8 — Photopea `postMessage` target origin is `'*'`.** Incoming messages are correctly gated on `e.source === iframeRef.current?.contentWindow`, which is the strong check. Outbound calls use `'*'`, so if the iframe were ever navigated off photopea.com the design payload would follow it. Separately, `dataUrl` is interpolated into a JS string sent as a script (`app.open("${dataUrl}")`); the URLs come from your own Supabase storage, so this is not currently reachable, but it is a script-injection shape.

**9 — Storage buckets.** `mockups` and `content_media` are used via `getPublicUrl()`, so they are public buckets: anything uploaded is world-readable forever to anyone holding the URL, including PSDs of unreleased designs. Paths are flat with no per-brand prefix (`${productId}-asset-${Date.now()}.ext`) and every upload uses `upsert: true`. **There are no storage policies anywhere in the repo** — they live only in your dashboard, so I could not audit them. See "Needs your decision".

---

## Areas reviewed — no issues found

**Secrets and config**
- No `.env` file has ever been committed. I enumerated all 895 non-`node_modules` blobs across every reachable commit and scanned each for live key patterns (`sk_live_`, `sk_test_`, `whsec_`, `re_`, `tvly-`, `shpss_`, `sb_secret_`, `AIza…`). Zero hits. The one apparent match was `re_techpackque` in a graphify cache file — a false positive on the Resend prefix.
- `.gitignore` correctly covers `.env` and `.env.*` with an allowlist exception for `*.example`.
- Only four `VITE_`-prefixed variables exist: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL`, `VITE_SENTRY_DSN`. All four are safe to ship in a public bundle.
- The frontend client is instantiated with the **anon** key (`lib/supabase.js:9`). The service-role key appears only in `api/index.js:137`, server-side. Correct on both sides.
- No hardcoded credentials in any source file.

**Express**
- All 15 `metered()` AI routes are listed in `AI_PATHS`, so all 15 get `requireAuth` and the strict AI limiter. `/api/generate-tech-pack-full` is covered by prefix match on `/api/generate-tech-pack`. I checked this route by route rather than trusting the list.
- JWT is genuinely verified — `supabase.auth.getUser(token)` performs real validation, not a local decode.
- `metered()` re-derives authorization from the verified `req.user` and calls `verifyBrandAccess` before any spend. `brandId` from the body is checked, never trusted.
- Credit debit is atomic (`FOR UPDATE` row lock), so concurrent AI calls cannot overspend, and failed calls auto-refund on `res.on('finish')` at status ≥ 400.
- Stripe webhook signature is verified against the **raw body buffer** (`req.rawBody`, captured by the `express.json` `verify` hook) with the signing secret, and rejects when the secret is missing.
- Webhook idempotency is handled correctly and deliberately: `invoice.paid` uses SET semantics so retries cannot stack, and `checkout.session.completed` uses ADD but dedupes on `session.id` against the ledger first.
- Prices are entirely server-side — subscription prices from the `PRICE_IDS` env map, top-up prices from `getPack(packId)` in `api/config/aiCredits.js`. No amount is ever read from the request.
- `/api/create-checkout-session`, `/api/confirm-checkout`, `/api/create-topup-session`, `/api/subscription-status` all call `verifyBrandAccess` against the verified user.
- SSRF defenses hold: `safeStoreUrl()` (https-only, blocks loopback/RFC1918/link-local/metadata/IPv6 ULA, rebuilds the URL from parsed parts) on all four WooCommerce routes, `safeShopifyShop()` pinning to `*.myshopify.com` on the Shopify auth redirect and both fetch routes. WooCommerce errors deliberately do not echo the upstream body.
- Shopify HMAC uses `crypto.timingSafeEqual` with a length pre-check, and fails closed when the secret is absent. All three mandatory GDPR webhooks are behind `shopifyWebhookGuard`.
- OAuth `state` is HMAC-signed and verified in constant time; the secret falls back to a random per-boot value rather than a published constant. Etsy PKCE verifiers are single-use with a 10-minute TTL.
- No raw SQL, no string-concatenated queries, no shell execution anywhere in the backend. All DB access goes through the Supabase client or parameterized RPC.
- Error handling does not leak internals: 404s are generic, the last-resort handler returns `'Internal server error'` for 500s, and `x-powered-by` is disabled. Helmet is applied with CSP/CORP intentionally off for a cross-origin JSON API (correct — those headers govern document loading, not API responses).
- Rate limiting is layered: 600/15min globally, 20/min on AI, 15/15min on email, with webhooks and `/health` exempt so Stripe and Shopify retries are not dropped. `trust proxy: 1` is set, so limits key on the real client IP behind Railway.
- No secrets or PII in log statements — logs carry counts, feature names, shop domains, and error messages only.

**Supabase / RLS**
- RLS is enabled on **all 47 tables**. My first grep appeared to show `products`, `designs`, `collections`, and `tech_packs` unprotected; that was my error — they are covered by the `execute format(...)` loops in `007_teams_and_rls.sql:75–110`. I read those loops to confirm rather than relying on the grep.
- All 134 policies are brand-scoped through `has_brand_access(brand_id)`, an ownership subquery, or a join to the parent row's brand. I found no `USING (true)`, no unchecked insert, and no policy that authorizes on a client-supplied column instead of `auth.uid()`.
- Tenant isolation traced end to end for tech packs, designs, vendors, RFQs, quotes, production orders, samples, materials, and platform listings. Child tables without a direct `brand_id` (`product_variants`, `tech_pack_versions`, `sample_images`, `sample_annotations`, `sample_fit_feedback`, `quote_negotiations`, `product_stage_history`) all correctly join through to the parent's brand.
- Omitted `WITH CHECK` on the update policies is **not** a vulnerability: Postgres reuses the `USING` expression as the check when `WITH CHECK` is absent, so a row cannot be moved to a brand the caller lacks access to. I verified this reasoning against the actual policy text rather than assuming.
- `has_brand_access` and `is_brand_admin` are `SECURITY DEFINER` but safe — both answer only about `auth.uid()`, take no caller-controlled identity, and cannot be steered with arbitrary arguments.
- `ensure_personal_ai_chat` (`022:31`) and `create_group_chat` (`031`) both validate the caller against brand ownership/membership before doing anything, raise on `auth.uid() is null`, and set `search_path = public`. Both are correctly written.
- `brand_members` policies are sound: invite requires `is_brand_admin`, and the accept-invite update is narrowly scoped (`invited_email = auth.jwt()->>'email' and user_id is null` → `with check (user_id = auth.uid() and status = 'active')`), which prevents both self-elevation and hijacking someone else's pending invite.
- `materials` is intentionally a shared read-only library with no write policy. Correct as designed.

**Frontend**
- Exactly one `dangerouslySetInnerHTML` (`ContentHub.jsx:856`), rendering the campaign draft the same user just typed, in their own session. Self-XSS only — no stored or cross-user path. No other HTML sink anywhere.
- User-controlled text (brand names, vendor notes, tech pack fields) renders through normal JSX interpolation, which escapes by default. I checked the render paths specifically called out in the brief.
- No secrets or tokens written to `localStorage` by application code — only theme, sidebar state, last-brand ID, onboarding flags, and AI response caches. The Supabase session lives in `localStorage` via the SDK's default, which is standard for an SPA and not something to change here.
- Photopea incoming messages are gated on `e.source === iframeRef.current?.contentWindow`.
- `ecommerceSync.js`, `TeamContext.jsx`, and `ContentHub.jsx` all use `apiPost`, so the JWT is attached. `QuoteTracker.jsx:113` uses a raw `fetch` but attaches the `Authorization` header explicitly (line 117) — it deviates from the convention but is functionally correct and authenticated. **Not changed** (no vulnerability; the brief forbids cosmetic diffs).
- All `navigate()` targets are internal literals or `/path/${uuid}` — no user-controlled navigation strings.

**Auth flows**
- Signup, login, password reset, and password update are delegated entirely to Supabase Auth (`AuthContext.jsx:27, 52, 74, 84`). Token entropy, expiry, single-use semantics, and enumeration behavior are Supabase's implementation, not custom code — there is nothing hand-rolled here to get wrong.

**Dependencies**
- `api/`: **0 vulnerabilities**.
- `la-guia/`: 2 moderate, both in `react-router`, **neither exploitable here**:
  - *Arbitrary Constructor Injection via `deserializeErrors()`* — requires SSR hydration. This is a static SPA on Cloudflare Pages with no SSR. Not reachable.
  - *Open redirect via backslash in `<Link>`/`useNavigate`* — requires a user-controlled value reaching `to`/`navigate()`. I enumerated every call site; all are internal literals or UUID-interpolated paths. Not reachable.
  - **Recommendation: do not upgrade for these.** Per the brief, no mass upgrades. Worth doing on its own schedule, not as a launch blocker.

---

## Needs your decision

Each of these either changes behavior or needs information I cannot obtain from the repo. **Nothing here has been changed.**

**A. Fix for Finding 2 changes the billing flow.**
The clean fix is `REVOKE UPDATE (plan_tier, stripe_customer_id, stripe_subscription_id) ON public.brands FROM authenticated, anon;`. That breaks `BillingTab.jsx` at lines 39, 79, 82, and 108, which write those columns from the client today. To keep the feature working, the write has to move server-side: `/api/confirm-checkout` already verifies the session with Stripe and checks brand access, so it can persist the plan with the service-role client and return it, and the reconciliation at lines 79/82 can move into `/api/subscription-status` the same way. The dev-only override at line 108 (`import.meta.env.DEV`-gated) would need a local-only path or removal.

This is a two-file change with a real behavior surface. I did not touch it. **Tell me whether to do the full server-side move, or to hold.** Note that Finding 1 is independently fixable and does not depend on this.

**B. Storage bucket policies are not in the repo.**
No `storage.objects` policy or bucket configuration appears in any migration — it is all dashboard state I cannot read. Given flat, non-namespaced paths and `upsert: true` on every upload, the questions that matter are whether an authenticated user can write to or delete a path belonging to another brand. Run this and send me the output:

```sql
select bucket_id, name, public from storage.buckets;
select policyname, cmd, qual, with_check from pg_policies
 where schemaname = 'storage' and tablename = 'objects';
```

Also worth confirming the MIME allowlist on `mockups` permits `image/vnd.adobe.photoshop` — per `CLAUDE.md`, restricting it silently flattens every PSD save.

**C. `delete_user` RPC exists but is not in the repo.**
`Settings.jsx:291` calls `supabase.rpc('delete_user')`, and no migration defines it — it was created in the dashboard. An account-deletion function is almost certainly `SECURITY DEFINER`, which makes it exactly the shape as Finding 1. If it takes any parameter, or deletes by anything other than `auth.uid()`, it is a critical account-deletion primitive. Send me `select prosrc from pg_proc where proname = 'delete_user';` and I will review it. Separately, it should be committed as a migration so it is auditable.

**D. `sales_data` has no write policy — this may already be breaking a feature.**
RLS is enabled on `sales_data`, but the only policy that exists anywhere is `FOR SELECT`. Meanwhile `SalesDashboard.jsx:179` calls `.upsert()` and `SalesContext.jsx:81` calls `.delete()`. With RLS on and no matching policy, Postgres denies both. This fails **closed**, so it is not a vulnerability — but if store sync currently works in production, a policy was added via the dashboard that is not in the repo, and I could not audit it. Tell me which it is: broken feature, or undocumented policy.

**E. Confirm `ALLOWED_ORIGINS` is set on Railway** (Finding 5). If it is, that finding closes with no code change. If you would rather the code refuse to start with permissive CORS when `NODE_ENV=production`, that is a small, safe change — say the word.

---

## What I would fix first

If you want a minimum set before beta users arrive, in order:

1. **Finding 1** — one migration adding `revoke execute … from anon, authenticated` on the four credit functions, plus a `has_brand_access` guard inside each as defense in depth. No behavior change: the backend calls these with the service-role key, which is unaffected by grants to other roles. This is the highest-value, lowest-risk fix in the report.
2. **Finding 3** — add `verifyBrandAccess` and apply the existing `escapeHtml` to `/api/send-vendor-email`. `QuoteTracker.jsx:113` already sends the JWT, but does **not** currently send a `brandId`, so this needs a one-line frontend change alongside it. Small, but it is a behavior-adjacent edit and I want your go-ahead.
3. **Finding 4** — tighten the `chat_participants` insert policy to require the added `user_id` to belong to the chat's brand, mirroring the check `create_group_chat` already performs. Migration only.
4. **Finding 2** — the larger one, per decision A above.

Findings 6–9 I would leave alone for launch; each is either well-mitigated already or not currently reachable.

**Awaiting your approval before changing any code.**

---

## Changes applied

Approved 2026-07-28: Findings 1, 4, and 3. Finding 2 deliberately left alone — it needs the billing-flow rework described in decision A.

| File | Change | Finding |
|---|---|---|
| `supabase/migrations/032_lock_down_credit_rpcs.sql` | **New.** Revokes `EXECUTE` on the four AI credit functions from `public`, `anon`, `authenticated`; re-grants to `service_role` | 1 |
| `supabase/migrations/033_chat_participant_brand_check.sql` | **New.** Replaces the `chat_participants` insert policy so the added `user_id` must own or actively belong to the chat's brand | 4 |
| `api/index.js` (`/api/send-vendor-email`, ~line 1686) | Requires `brandId` + `verifyBrandAccess`; applies existing `escapeHtml` to the body before the newline→`<br/>` substitution | 3 |
| `la-guia/src/pages/QuoteTracker.jsx` | Destructures `activeBrand` from `useProducts()`; sends `brandId` with the RFQ dispatch | 3 |

### Notes on each

**Finding 1.** Revoking `EXECUTE` is the entire fix — nothing in the frontend calls these functions (it only `SELECT`s the balance through the read policies), and the backend calls them with the service-role key.

One correction to what I recommended earlier in this report: I suggested also adding a `has_brand_access()` guard inside each function body as defense in depth. **That would have broken every AI feature in the app.** Under the service-role key there is no user JWT, so `auth.uid()` is `NULL`, `has_brand_access()` returns false, and every debit would raise — the credit system would fail closed on the first call. The guard belongs where it already is: `metered()` in `api/index.js` runs `verifyBrandAccess` against a verified JWT before anything reaches these functions. The migration comment records this so the next person doesn't "improve" it back in.

Because the PUBLIC grant is what `service_role` was inheriting, the migration re-grants to `service_role` explicitly. Without that line the revoke would have taken the API's own access down with it.

**Finding 4.** The new policy permits exactly the set the UI already offers. `ChatContext.addableMembers` (line 115) is built from the brand owner plus `members.filter(m => m.status === 'active' && m.user_id)`, which is the same condition the policy now enforces — so no legitimate add is affected. `create_group_chat` is `SECURITY DEFINER` and owned by a `BYPASSRLS` role, so it is unaffected either way, and it already performs this check itself.

Both `user_id` references are qualified as `chat_participants.user_id`. This matters: `brands` and `brand_members` each have their own `user_id` column, which would otherwise shadow the new row's column inside the `EXISTS` subqueries and silently compare a row to itself — the policy would have passed for everyone.

**Finding 3.** `requireAuth` was already present; the endpoint was missing the brand check its two siblings have, and the body was interpolated into HTML unescaped. Escaping happens **before** the `\n` → `<br/>` substitution, or the `<br/>` tags would themselves be escaped and the mail would render as one line of visible tag soup.

This is behavior-preserving for real traffic: the body is always plain text (composed in `QuoteTracker.jsx:122`, and `/api/draft-vendor-email` is prompted for plain text with `\n` breaks). The visible change is that a vendor name containing `&` or `<` now renders correctly instead of as broken markup.

Caught during the edit: my first pass added `brandId: activeBrand?.id` to the fetch body, but `QuoteTracker` only destructured `products` from `useProducts()` — `activeBrand` was never in scope, so it would have thrown `ReferenceError` at send time. A Vite build does not catch that. Fixed by adding it to the destructure and confirming `ProductsContext` exposes it (line 521).

### Verification performed

- `node --check api/index.js` — passes.
- API boots clean on `PORT=3999`; `/health` returns `200 OK`.
- `POST /api/send-vendor-email` with no token returns `401 {"ok":false,"error":"Sign in required."}` — auth runs before any work, and no email is attempted.
- Escape ordering unit-checked against the real `escapeHtml`: `"Line2 & co <b>bold</b>\n<a href=...>"` → `"Line2 &amp; co &lt;b&gt;bold&lt;/b&gt;<br/>&lt;a href=&quot;...&quot;&gt;"`. Line breaks preserved, injected link inert.
- `npx vite build` — succeeds in 12.58s, no new warnings.

### Not verified — please confirm after deploying

**The two migrations have not been run against a Postgres.** There is no Docker on this machine, so `supabase db start` could not bring up a local database, and I will not run migrations against your production project. The SQL was checked by hand: all four function signatures match their `028` definitions exactly `(uuid, integer, text)` ×3 and `(uuid, integer, timestamptz)`, and the dropped policy name matches `016` exactly. That is a careful read, not an execution.

After applying them:

1. Re-run the privilege query from Finding 1 — all four columns should now read `false`.
2. Confirm an AI action still works end to end (generate a silhouette, say) and that the credit balance decrements. This is the one thing that would break if the `service_role` re-grant were wrong.
3. Create a group chat and add a teammate, to confirm the participant policy admits legitimate members.
4. Send an RFQ from Quote Tracker to a vendor with an email on file, and confirm it arrives and renders with correct line breaks.

None of the above was exercised against a signed-in session — I have no way to reach one from here, so nothing in this section should be read as tested end to end.

**Findings 2, 5, 6, 7, 8, 9 remain open**, along with decision items B (storage bucket policies), C (`delete_user`), D (`sales_data` write policies), and E (`ALLOWED_ORIGINS`). Item C is the one I would still chase before launch — an undocumented `SECURITY DEFINER` account-deletion function is the same shape as the Critical finding just fixed.
