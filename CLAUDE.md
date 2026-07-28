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
