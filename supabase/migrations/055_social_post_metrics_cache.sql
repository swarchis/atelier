-- Phase 1 of the social integration: a cache for the brand's real platform posts.
--
-- ── WHY A CACHE AND NOT A LIVE FETCH ────────────────────────────────────────
-- TikTok's /v2/video/list/ returns at most 20 rows per page and is rate-limited
-- per client, not per user. Fetching on every render means one founder with a
-- long posting history can exhaust the limit for everybody on the platform. So
-- the sync is explicit, the result is stored, and the UI shows how stale it is.
-- An honest "synced 2 hours ago" is better than a spinner that 429s.
--
-- ── NO MEDIA IS STORED ──────────────────────────────────────────────────────
-- cover_image_url, share_url and embed_link are links into TikTok's own CDN, so
-- a brand's entire back catalogue costs rows and nothing else. This is the whole
-- reason reads are cheap and publishing is not.
--
-- cover_image_url has a SIX HOUR TTL. It is stored so a freshly-synced card has a
-- thumbnail, and must not be treated as durable — anything rendering these needs
-- to fall back to embed_link rather than show a broken image. Same trap as the
-- PSD thumbnails in ba48098.
--
-- ── WHO MAY WRITE ───────────────────────────────────────────────────────────
-- Nobody, from the client. These rows are the platform's numbers, not the user's
-- data, and a client-writable metrics table is a client-writable set of numbers
-- we then present as fact. The backend writes with the service-role key (which
-- bypasses RLS and grants); INSERT and UPDATE are revoked outright.
--
-- DELETE is the exception. Disconnecting an account has to actually remove its
-- cached posts, or Analytics keeps reporting on a connection the user just
-- severed. That is scoped to has_brand_write_access, matching 050 — a viewer
-- reads metrics, an editor can drop them by disconnecting.

create table if not exists public.social_posts_synced (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  platform text not null,             -- instagram | tiktok | youtube | pinterest
  external_id text not null,          -- the platform's own id for the post
  caption text,
  cover_image_url text,               -- 6h TTL, see above
  share_url text,
  embed_link text,
  posted_at timestamptz,
  like_count integer,
  comment_count integer,
  share_count integer,
  view_count bigint,                  -- int64 on TikTok's side; integer overflows
  synced_at timestamptz not null default now(),
  unique (brand_id, platform, external_id)
);

create index if not exists social_posts_synced_brand_platform_idx
  on public.social_posts_synced (brand_id, platform, posted_at desc);

alter table public.social_posts_synced enable row level security;

drop policy if exists "brand access select social_posts_synced" on public.social_posts_synced;
create policy "brand access select social_posts_synced" on public.social_posts_synced
  for select to authenticated
  using (public.has_brand_access(brand_id));

drop policy if exists "writer role required delete social_posts_synced" on public.social_posts_synced;
create policy "writer role required delete social_posts_synced" on public.social_posts_synced
  for delete to authenticated
  using (public.has_brand_write_access(brand_id));

-- Grants, belt to RLS's braces: no client INSERT/UPDATE path exists at all, so a
-- future policy mistake still cannot let one through.
revoke insert, update on public.social_posts_synced from authenticated, anon;

-- When the last sync succeeded, so the UI can say how stale the numbers are
-- rather than presenting them as live.
alter table public.social_accounts
  add column if not exists stats_synced_at timestamptz;

-- 054 revoked table-level SELECT on social_accounts and granted the readable
-- columns back BY NAME, so a new column is invisible to the client until it is
-- added to that list. This is the trap CLAUDE.md documents for `brands`, and it
-- applies here for exactly the same reason.
grant select (stats_synced_at) on public.social_accounts to authenticated;
