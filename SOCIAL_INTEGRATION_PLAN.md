# Social integration plan — TikTok read + publish, one application

Goal: turn the Content Hub's Accounts and Analytics tabs from honestly-empty
into real data, and make a scheduled post actually post. Written so both go into
**one** TikTok app revision rather than two rounds of review.

Status: plan only, nothing implemented. Nothing here is live.

## Why one revision works after all

The earlier worry was that bundling `video.publish` would sink the read scopes,
because TikTok requires every requested scope be demonstrated in the demo video
and we had no video files to post. That turned out to be wrong in a useful way:

- **Photo posts use the `video.publish` scope.** There is no separate
  `photo.publish`. `/v2/post/publish/content/init/` with `media_type: PHOTO`
  posts an image carousel, which is exactly what `content_posts` already holds.
- So a single scope covers photo posting now and video posting later, and the
  demo video can show a real photo post going up.

What still can't be bundled is the **audit**. Approval of `video.publish` lets us
call the API; until a separate audit passes, everything posts `SELF_ONLY`
(private). That is a second, later submission and it is not on this plan's
critical path — the feature works, the visibility is limited, and the UI must say
so rather than implying a public post.

## Scopes to request in the revision

| Product | Scope | Buys us |
|---|---|---|
| Display API | `video.list` | The user's own posts: cover, caption, `like_count`, `comment_count`, `share_count`, `view_count` |
| Display API | `user.info.stats` | Follower count, following, total likes, video count |
| Display API | `user.info.profile` | Bio, verified badge, profile link (cheap, makes Accounts look real) |
| Content Posting API | `video.publish` | Direct photo post now, video post later |

`user.info.basic` is already approved and stays.

## External steps — these are on you, not code

1. **Enable Sandbox** and connect your own TikTok account. Lets us build and test
   the whole thing before review, so code isn't blocked on approval.
2. **Add the two products** and the three new scopes to a new revision.
3. ~~Verify a URL property~~ — **not needed.** We settled on `FILE_UPLOAD`, which
   requires no domain verification. See "Media delivery" below.
4. **Record a demo video** showing: connect account → posts and metrics appear →
   compose a post → it publishes. Must be filmed on `atelierlabs.app`, matching
   the Web URL on the app record.
5. **Confirm `TIKTOK_CLIENT_KEY` / `TIKTOK_CLIENT_SECRET` are set on Railway.**
   If they aren't, the connect button already redirects to
   `?social_error=missing_keys` and nothing else matters.
6. Submit. Review takes days, not hours — build in Sandbox while it sits.

## Phase 0 — DONE (code written, migration not yet run)

Both fixes are implemented. `node --check` passes, the API boots clean, and
`vite build` succeeds. **Not verified against a signed-in session** — see the
manual check below.

- `054_social_tokens_server_side.sql` — adds `token_expires_at`; revokes client
  SELECT on the two token columns and INSERT/UPDATE outright.
- `SOCIAL_OAUTH.tiktok.getToken` keeps `refresh_token` + `expires_in`; new
  `refresh()` handles TikTok's rotating refresh token.
- `persistSocialAccount()` — service-role upsert in the OAuth callback, degrading
  to a write without `token_expires_at` if 054 hasn't run.
- `getSocialAccessToken()` — loads and refreshes within a 5-minute skew window.
- `/api/social/publish/:platform` — takes `brandId`, verifies brand access, looks
  the token up server-side. `accessToken` removed from the request body.
- Handoff payload no longer carries tokens (`/api/oauth/consume` is
  unauthenticated, so it never should have).
- `connectAccount()` deleted from `ContentContext`; `publishNow` gates on
  `connected` and sends `brandId`.

**Deploy backend + frontend together, then run 054.** That order is safe; the
reverse breaks connecting an account for anyone still on the old bundle.

**Manual check after deploying:** connect TikTok in Settings → Content → Accounts,
confirm the row appears as connected, then in the SQL editor confirm
`select access_token from social_accounts` fails for an authenticated client and
that `token_expires_at` is ~24h out.

Original write-up of both problems, kept for the reasoning:

**0a. TikTok connections die after 24 hours.** `SOCIAL_OAUTH.tiktok.getToken`
(`api/index.js:2384`) returns only `{ accessToken }`, dropping `refresh_token`
and `expires_in`. YouTube and Pinterest keep theirs. TikTok access tokens expire
in 24h; refresh tokens last a year. `social_accounts.refresh_token` already
exists and is simply never populated for TikTok. There is no refresh path for
social platforms at all — only Etsy has one (`api/index.js:1733`).

**0b. The access token is readable by any brand member.** `ContentHub.jsx:176`
reads `account.access_token` in the browser and posts it to the API. `SELECT` is
deliberately unrestricted after migration 050, so a **viewer** can read the
brand's TikTok token. Read-only that is a leak; with `video.publish` attached it
means a viewer can post to the brand's TikTok. This must be closed *before* the
publish scope is granted, not after.

The fix for 0b is the same shape as the rest of the backend: the token stays
server-side, the client sends `brandId` + `platform`, and the API looks the token
up with the service-role key. That removes `accessToken` from the
`/api/social/publish/:platform` request body — a **request-shape change**, so
Pinterest's existing publish path has to move at the same time or it breaks.

## Phase 1 — DONE (code written, migration 055 not yet run)

`node --check` passes, the API boots clean, `vite build` succeeds. **Nothing here
returns real data until TikTok approves `video.list` + `user.info.stats`** — the
sync endpoint exists and will answer `scope_not_authorized` with a sentence
saying exactly that until the revision passes.

- `055_social_post_metrics_cache.sql` — `social_posts_synced` (SELECT on brand
  access, DELETE on write access, INSERT/UPDATE revoked so only the service role
  writes it) + `stats_synced_at` on `social_accounts`, **granted by name**
  because 054 revoked table SELECT.
- `tiktokDisplayCall()` — one chokepoint for the fact that TikTok answers HTTP
  200 with a non-`ok` `error.code`; translates scope/token/rate-limit errors and
  never echoes the upstream body.
- `fetchStats` / `fetchPosts` on the TikTok config; one page of 20, deliberately
  not paged, because the quota is per API client and not per user.
- `POST /api/social/sync/:platform` — `requireAuth` + `verifyBrandAccess` +
  a dedicated 10-per-5-min limiter. Not metered; no AI is involved.
- Prunes posts deleted on the platform, but **only when `has_more` is false**, so
  older posts aren't deleted for being absent from a window they were never in.
- `ContentContext` — `syncedPosts`, `syncAccount()`, disconnect now clears cached
  metrics, and the `stats_synced_at` read degrades if 055 hasn't run.
- Accounts tab — follower count, "synced 2h ago", Sync now. Followers render only
  once a sync returned a number, since the column defaults to `0` and that reads
  as "no followers" rather than "unknown".
- Analytics tab — real views/likes/comments/followers and top posts by views, in
  a section kept **separate** from the planning counts. Cover images are dropped
  after 6 hours rather than rendered as broken images.
- `ComingSoonNotice` on Analytics disappears once real numbers exist.

**Not verified:** no signed-in session, and no platform call has ever succeeded
because the scopes aren't granted. The first real test is only possible in
Sandbox or post-approval.

Original write-up:

### Schema

```
alter table social_accounts
  add column token_expires_at timestamptz,   -- so refresh happens before a call fails
  add column stats_synced_at  timestamptz;   -- last successful metrics pull
-- followers already exists and is always 0; it starts being real here.

create table social_posts_synced (   -- their real TikTok posts, cached
  id, brand_id, platform, external_id, caption, cover_image_url, share_url,
  posted_at, like_count, comment_count, share_count, view_count, synced_at
  unique (brand_id, platform, external_id)
);
```

**No media bytes are stored for reads** — `cover_image_url`, `share_url` and
`embed_link` are links into TikTok's CDN, so their entire back catalogue costs us
nothing but rows.

Cached, not fetched live: `/v2/video/list/` returns max 20 per page and is
rate-limited, so hitting it on every render would break the page for anyone with
a real posting history. Sync on demand plus a "last updated" timestamp shown in
the UI — an honest stale number beats a spinner that rate-limits.

**`cover_image_url` has a 6-hour TTL.** It is stored for the freshly-synced case
only and must not be treated as a durable thumbnail — a card older than that
falls back to `embed_link`, or the row is re-synced. Storing it and rendering it
weeks later is a broken-image bug waiting to happen, the same shape as the PSD
thumbnail bug in `ba48098`.

Needs a SELECT policy on `has_brand_access` and the restrictive write policies
from 050. **`social_posts_synced` is written only by the service role**, so
clients need SELECT alone.

### Backend

- `refreshSocialToken(platform, account)` — refresh when `token_expires_at` is
  near, persist the new pair. Generic, since YouTube and Pinterest need it too.
- `POST /api/social/sync/:platform` — `requireAuth` + `verifyBrandAccess`,
  fetches `/v2/video/list/` + `/v2/user/info/`, upserts into
  `social_posts_synced`, updates `followers`. Not metered (no AI).
- Store the token, stop returning it to the client.

### Frontend

- Accounts tab: real handle, follower count, "synced 2h ago", Sync now button.
- Analytics tab: real reach and engagement from `social_posts_synced`, replacing
  the current counts of *our own scheduled rows* — which today report on the
  user's planning, not their audience.
- Drop `ComingSoonNotice` from both tabs **only** for platforms actually
  approved. It stays for the others; that component exists so a founder knows
  which connections are real.

## Phase 2 — publish + the scheduler

### The real gap

`scheduled_for` is used only for sorting (`ContentContext.jsx:20`) and drawing
the calendar (`ContentHub.jsx:191`). **Nothing runs at that time.** `publishNow`
is a manual button and `toggleStatus` just cycles the label, so a user can mark a
post "Posted" that was never posted. The calendar is a planner today, and
Phase 2 is what makes the word "scheduled" true.

### Scheduler

`pg_cron` and `pg_net` are both available in this project but **not installed**.
Recommended: enable both, and have a Postgres cron job call a protected endpoint
on Railway every 5 minutes.

Rejected: `setInterval` in `api/index.js`. The backend's OAuth state is already
in-memory `Map`s that assume one instance; adding an in-process timer means a
Railway restart silently drops due posts, and two instances double-post. A cron
row survives restarts and lives outside the web process.

- `POST /api/social/run-scheduled` — shared-secret header, not a user JWT.
  Claims due rows with a status transition so a double fire can't double-post,
  publishes, writes back `Posted`/`Failed` + the external URL and the real error.

### Publishing

- `publishTikTokPhoto()` — `/v2/post/publish/content/init/` with
  `post_mode: DIRECT_POST`, `media_type: PHOTO`, then poll
  `/v2/post/publish/status/fetch/` since the post completes asynchronously.
- Replace the honest `400` stub at `api/index.js:2504` once the scope is live.
  Keep a stub for any platform still unapproved — that pattern is correct and
  should survive.
- **While unaudited, pass `SELF_ONLY` and say so in the UI.** Posting privately
  while the UI implies public would be exactly the kind of quiet dishonesty the
  project's conventions rule out.

### Media delivery — decided: Supabase + `FILE_UPLOAD`

`PULL_FROM_URL` requires verifying ownership of the domain hosting the file.
Images live on `*.supabase.co` public URLs, which we don't own, so that route
would need a media proxy on `atelierlabs.app` before it worked at all.

**Decision: keep media in Supabase and hand TikTok the bytes via `FILE_UPLOAD`.**
No domain verification, no new provider, and the backend keeps owning the whole
TikTok integration — which is where every other part of it already lives.

**Cloudflare R2 was considered and rejected for now.** It is genuinely cheaper —
$0.015/GB-month and free egress against Supabase's $0.125/GB and $0.09/GB — and
a custom domain on it would have solved the verification problem too. It was
rejected because the saving it buys is imaginary at this scale: with
delete-after-publish (below), pending media stays well under a gigabyte, so the
difference is single-digit cents per month. What it costs instead is a second
storage system with its own SDK, secrets, and policies, and two places a file can
live — which is a real cleanup-bug surface. Revisit only if video ships and
storage actually grows.

**Delete after successful publish.** A composed file is only needed until the
post is live, so the publish path deletes it on success. This is the part that
actually controls cost, and it is provider-independent.

One caveat inherited from `mockups`: the `content_media` bucket's DELETE policy
has to actually exist and be owner-scoped, or `.remove()` returns
`{data: [], error: null}` and deletes nothing — silently, which is exactly how
the mockups leak went unnoticed for so long. Verify the delete against the live
bucket, not against this document.

Also: `uploadMedia` hardcodes `.png` filenames
(`ContentHub.jsx:111`) and the column is `image_url`. Video support means a real
content type and a `media_type` column — deliberately **out of scope here**;
photo posting is what makes the application filmable.

## Order of work

1. Phase 0a + 0b — needed regardless, and 0b must land before publish approval
2. Phase 1 behind Sandbox
3. Phase 2 scheduler + photo publish behind Sandbox
4. Film the demo, submit the revision
5. Swap Sandbox for production once approved, remove the notices per platform
6. Later, separately: the audit for public visibility; then video support

## Decided against

- **Cursor paging on sync.** Considered once real data landed (19 posts cached,
  9,111 views) and declined: TikTok's rate limit is per API client, not per user,
  so fetching one brand's full history spends every brand's quota. Newest 20 per
  sync is the intended ceiling. Revisit only behind a per-brand throttle.
- **Cloudflare R2 for media.** See "Media delivery" — cheaper per GB, but the
  saving is cents at this scale against a whole second storage system.

## What this plan does not do

- Instagram, YouTube, Pinterest reads — each needs its own platform review.
  Pinterest already publishes for real and is untouched.
- Video posting (no video pipeline; see above).
- The public-visibility audit.
- Any change to AI credits — none of this calls an AI model, so
  `api/config/aiCredits.js` and its mirror stay as they are.
