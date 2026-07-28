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

`mockups` still has **no DELETE policy**, so `.remove()` deletes nothing and
returns `{data: [], error: null}` — not an error, which is why it went unnoticed.
Paths are flat with no per-brand folder, so a safe DELETE policy needs the
namespacing work first.

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
