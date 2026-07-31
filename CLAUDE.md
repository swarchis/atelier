# Atelier — working notes for Claude

Production OS for independent clothing brands: sketch → tech pack → vendors →
quotes → sampling → production → sales. `README.md` documents *what exists*;
this file covers *what will bite you*. Read this first, trust the code over
both, and update this file when one of these invariants changes.

## Layout

| Path | What it is |
|---|---|
| `la-guia/` | React 18 + Vite SPA. `src/context/` are the data layers, `src/pages/` one file per route |
| `api/` | Single-file Express backend (`index.js`, ~2.3k lines, numbered sections) |
| `api/config/aiCredits.js` | **Authoritative** credit prices — the backend enforces these |
| `supabase/migrations/` | 32 SQL files, run in order |

**The architecture split is load-bearing:** the frontend talks to Supabase
**directly** for all CRUD, protected by RLS. The backend exists only for things
needing a secret key, plus the two things clients must never be trusted with —
validating JWTs and moving AI credits. Don't add a CRUD proxy endpoint to the
API; add a Supabase query with an RLS policy.

## Running and verifying

```bash
cd api && node index.js        # :3001 — needs api/.env
cd la-guia && npm run dev      # :5173 — needs la-guia/.env.local
```

**There are no tests.** `npm test` in `api/` is a placeholder that exits 1.
Verify changes with:

```bash
cd api && node --check index.js                                    # syntax
cd api && PORT=3999 node -e "require('./index.js')"                # boots clean
cd la-guia && npx vite build                                       # catches broken imports
```

A `vite build` is the only thing that reliably catches a bad import path or a
JSX-in-`.js` mistake — a syntax checker won't. Run it before claiming a
frontend change works. Neither check exercises a signed-in session, so say so
rather than implying a feature was tested end to end.

## Authorization is no longer "just RLS" — read this before touching permissions

The architecture note above still holds: the frontend talks to Supabase directly
and RLS is the primary gate. But after the July 2026 audit, four tables enforce
rules that **do not appear in `pg_policies`**. Reading policies alone will tell
you the wrong thing.

| Table | Extra mechanism | What it enforces |
|---|---|---|
| `brand_members` | `BEFORE UPDATE` trigger (048) | A row's `brand_id`, `role`, and claimed `user_id` cannot change except by a brand admin |
| `tech_packs` | `BEFORE UPDATE` trigger (052) | The four `approval_*` columns are admin-only |
| `brands` | Column `GRANT`s (045, 049) | Only 9 columns are client-writable; `plan_tier` and the `stripe_*` ids are not, on INSERT **or** UPDATE |
| `chat_participants` | Column `GRANT` (051) | Only `last_read_at` is client-writable, so a row can't be moved into another chat |
| `social_accounts` | Column `GRANT` (054) | `access_token`/`refresh_token` are not client-**readable**; INSERT/UPDATE are revoked entirely, so the backend owns every write except the client's DELETE (Disconnect) |

Plus **111 restrictive policies** across 37 tables (050) that require
`has_brand_write_access()` — owner/admin/editor — for INSERT/UPDATE/DELETE.
Restrictive policies AND with the permissive ones and can only subtract, so if a
write mysteriously fails for a non-owner, check these before the permissive
policy. `SELECT` is deliberately unrestricted: viewers read everything.

**Three rules that follow from this:**

- **Adding a user-editable column to `brands` requires adding it to the
  `grant update (...)`/`grant insert (...)` lists**, or the save fails with a
  permission error rather than an RLS error — which sends you looking in
  entirely the wrong place.
- **A column-level `REVOKE` cannot subtract from a table-level grant.** Migration
  044 tried, reported success, and changed nothing. To restrict columns you must
  revoke the table-wide privilege and grant back the allowed list (045, 049, 051).
- **`select('*')` needs table-level SELECT — per-column grants do not satisfy
  it.** 054 is the only migration that revokes SELECT, and it makes
  `social_accounts` the one table you must query with an explicit column list.
  A `select('*')` there returns a permission error, and because `loadData`
  destructures `{ data }` without checking `error`, the symptom is every connected
  account silently rendering as "Not connected" — not an error anyone sees.
- **RLS `WITH CHECK` cannot see the old row**, so "this column may not *change*"
  is not expressible as a policy. That's why 048 and 052 are triggers.

## Verify against the database, not the migrations

`supabase/migrations/` records what *should* be true. It disagreed with the live
database three times during the audit, and the database was right every time:
`sales_data`'s live SELECT policy was the owner-only variant rather than the
member-inclusive one in `INITIAL_SCHEMA`; migration 044 was a silent no-op; and
`handle_new_user` referenced a column that had never existed, which broke every
signup for eight days without anyone noticing.

Several functions (`handle_new_user`, `delete_user`) were created in the
dashboard and only captured as migrations retroactively. Before trusting a
policy or function, query `pg_policies` / `pg_proc` / `pg_class.relacl`.

## Storage: uploads use `upsert`, which needs more than INSERT

Every upload passes `upsert: true`, so Postgres runs `INSERT ... ON CONFLICT DO
UPDATE` and requires SELECT **and** UPDATE policies **whether or not a conflict
happens** — the check is at plan time. Dropping the SELECT policy on `mockups`
because "timestamped filenames never collide" broke every image save for three
hours. Both buckets now scope SELECT/UPDATE to `owner = auth.uid()` (046, 047).

`mockups` got its DELETE policy in **057**, owner-scoped like `content_media`.
Before that it had none, so all nine `.remove()` call sites silently deleted
nothing — `{data: [], error: null}` is what an RLS-blocked delete returns, not an
error. That is how the bucket reached **2304 MB of orphans against 65 MB of live
data**, 1933 MB of it superseded Photopea working PSDs.

**Anything that repoints a stored URL must delete the file it replaced.** Use
`deleteMockupFiles()` (`lib/designImages.js`), always *after* the row is written,
and never for a file the new row still references — a failed PSD capture leaves
`psdUrl` null and the row keeps pointing at the old file. Autosave filenames are
timestamped on purpose (a reused name serves stale CDN bytes), so every save is a
new object and nothing is overwritten in place.

Owner-scoped DELETE means a teammate still cannot remove another member's file;
that returns success and deletes nothing. Per-brand path namespacing is the real
fix and is not done — mockup paths are flat (`{productId}-{kind}-{timestamp}`).

## Invariants that break things quietly

**AI credits live in two files.** `api/config/aiCredits.js` is authoritative;
`la-guia/src/data/aiCredits.js` is a display-only mirror. Nothing enforces the
sync — change one, change both. The pricing rule: no action may cost more than
**$0.005 of API spend per credit charged**. If you change an image call's
`size`/`quality`/`background`, re-check that ceiling.

**A new AI endpoint must be added to `AI_PATHS`.** That array is what applies
`requireAuth` and the strict AI rate limiter. `metered()` alone fails closed
(403, since `req.user` is undefined) but you silently lose rate limiting on an
endpoint that costs real money per call.

**Endpoints that fetch a user-supplied URL must validate it.** Use
`safeStoreUrl()` (https-only, blocks private/loopback/metadata hosts) or
`safeShopifyShop()` (pins to `*.myshopify.com`). Never echo an upstream
response body back in an error — that turns a server-side fetch into a
readable one. This is why those helpers exist; a previous version had a live
SSRF through the WooCommerce endpoints.

**Anything that sends email requires `requireAuth` + `verifyBrandAccess`.**
It sends from our verified domain, so an open version is a phishing relay
wearing our SPF and DKIM. Escape every interpolated value into email HTML.

**`/api/media/content/:postId` is an unauthenticated proxy, and its validation is
load-bearing.** TikTok photo posts only accept `PULL_FROM_URL` (`FILE_UPLOAD` is
video-only) and only from a verified domain, so post media is served from
`api.atelierlabs.app` instead of Supabase. TikTok's fetch carries no session, so
the route can't require auth. `image_url` is client-written — if you loosen the
exact-prefix check against our own `content_media` bucket, this becomes an open
SSRF proxy.

**That proxy also re-encodes, and publishing breaks without it.** TikTok rejects
PNG (`file_format_check_failed`, checked on the actual bytes — relabelling the
Content-Type fails identically) and caps photos at 1920x1080 landscape /
1080x1920 portrait (`picture_size_check_failed`). Composer uploads are PNG and the
AI image features emit 2048x2048, so both gates would fail every post. `sharp`
resizes and converts on the way out; the stored original is left alone so the
user's own calendar keeps full quality. Square images land at 1080x1080, and the
buffer is flattened onto white because JPEG has no alpha.

**Publishing while unaudited needs the account itself set to private.**
`unaudited_client_can_only_post_to_private_accounts` means the TikTok *account*,
not just the post — TikTok requires both that and `SELF_ONLY`, which is why
`TIKTOK_PRIVACY_LEVEL` defaults to `SELF_ONLY` and should only be widened after
the audit. Unaudited clients are also capped at 5 posting users per 24h.

**`TIKTOK_SCOPES` is what the authorize URL is built from.** A scope missing there
can never reach the token no matter what the developer portal says — the single
most time-wasting bug in this integration, twice. The token's *granted* scopes are
logged on connect (`🔑 tiktok token granted scopes:`); check that line first.

**Scheduled publishing runs when `RAILWAY_ENVIRONMENT` is set** — on in any
deploy, off on a laptop, no configuration. That matters because `api/.env` points
a local machine at production, so a default-on scheduler would publish real posts
from a dev machine. `ENABLE_PUBLISH_SCHEDULER=true|false` overrides either way.
Concurrency is handled in the database by
`claim_due_content_posts` (`FOR UPDATE SKIP LOCKED`), not by assuming one instance.
**Gate "already published" on `published_at`, never on `status`** — the status tag
is user-editable, so a published post can be cycled back to `Scheduled` and
double-posted.

**TikTok's Display API answers HTTP 200 on failure.** A non-`ok` `error.code` in
the body is how errors arrive, so `response.ok` will hand you an empty result and
call it success. Every read goes through `tiktokDisplayCall()` so that check can't
be skipped. `social_posts_synced` is a cache written only by the service role;
`cover_image_url` in it expires after **6 hours** and must never be rendered
without a freshness check.

**Social platform tokens never reach the browser.** `social_accounts` rows are
written by the backend in the OAuth callback (`persistSocialAccount`), and
`/api/social/publish/:platform` takes a `brandId` and looks the token up itself
via `getSocialAccessToken`, which also refreshes it when it's within 5 minutes of
expiry. Don't add a client-side read of a token column — 054 revoked SELECT on
them, so it returns a permission error, not a null. `sales_connections` (Shopify/
Etsy/Woo) still holds tokens the client reads; that's the same shape and is *not*
fixed yet.

**Frontend never raw-`fetch`es the API.** Use `aiPost()` for metered AI routes
(injects JWT + brandId + brand profile) or `apiPost()` for authenticated
non-metered ones. A raw `fetch` will 401 and you'll debug it as a backend bug.

**The canvas restore rule is recency-first.** Newest non-`PSD_VERSION_LABEL`
row wins; layers preferred only *within* that row. Reordering this to "prefer
whichever row has a layered file" reopens the stale legacy rolling row —
that's the "designs reopen as their first version" bug. Display surfaces
(previews, history, activity) must **skip** `PSD_VERSION_LABEL` rows.

**Photopea content loads once per iframe document** (`lastLoadedRef`), so a
fullscreen or split-view toggle can't open a second document over the user's
work. Captures carry a token each because autosave chains PNG + PSD captures.
The message handler only trusts `e.source === iframe.contentWindow`.

**The backend's OAuth state is in-memory `Map`s** (handoff codes, Etsy PKCE
verifiers). That assumes ONE API instance — horizontal scaling breaks connect
flows mid-redirect. `OAUTH_STATE_SECRET` unset falls back to a random
per-boot secret, so flows don't survive a restart.

**Migrations degrade gracefully on purpose.** Several paths retry without a
column if a migration hasn't run (e.g. `psd_url`). Preserve that pattern —
an out-of-date DB should lose a feature, not the whole save.

## Conventions

- **Comments explain *why*, including what was rejected.** Match that density;
  a non-obvious line without a reason reads as unfinished here.
- **Honesty over fabrication** — this is the project's defining value. No
  invented metrics, no `Math.random()` follower counts, no feature listed in
  `plans.js` that isn't built, no OAuth stub pretending to connect. If data
  isn't available, the UI says so plainly. Uphold this in code *and* in what
  you report back.
- **Deletes go through `ConfirmDeleteModal`** (type the exact name). Bulk
  delete was deliberately not built — don't add a shortcut around that friction.
- Styling is CSS variables in `la-guia/src/index.css`; no CSS framework.
- Icons are Phosphor (`<i className="ph ph-*" />`), loaded via CDN in
  `index.html`.
- `mockData.js` is **not** mock data any more — it's a shared `STAGES`
  constant. Every page reads real Supabase data.

## Gotchas that cost real time

- The `mockups` storage bucket holds PSDs too — restrict its MIME types and
  every save silently flattens.
- Resend's free tier only delivers to your own verified address; team invites
  to anyone else fail silently while the `brand_members` row is still created.
- Image features need `OPENAI_API_KEY` (`gpt-image-1`); text features need
  `GEMINI_API_KEY`. "AI works but images don't" is almost always the former.
- Auth changes require deploying backend **and** frontend together — an old
  bundle won't send the JWT to a newly protected endpoint.
- `LAUNCH.md` is the live operational checklist. Check it before claiming
  something is production-ready.
