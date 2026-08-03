-- A scheduled post carried one `caption`, and publishTikTokPhoto derived BOTH
-- TikTok fields from it:
--
--     title       = caption.slice(0, 90)
--     description = caption.slice(0, 4000)
--
-- TikTok shows the title on the post and the description as its body, so they
-- want different text. Until now the title was simply the caption's first 90
-- characters, and there was nowhere to put anything else.
--
-- ── WHY TWO SHAPES ──────────────────────────────────────────────────────────
-- `title` is a real column: YouTube and Pinterest have titles too, and the
-- calendar and grid preview will want to render one without reaching into JSON.
--
-- `options` is jsonb because the rest is platform-specific and write-once —
-- disable_comment, auto_add_music, brand_content_toggle, brand_organic_toggle
-- are set when the post is composed and read once at publish, never queried or
-- filtered on. Five TikTok-shaped columns on a table shared by four platforms
-- would be null for three of them.
--
-- ── WHY THIS IS SAFE ON LIVE DATA ───────────────────────────────────────────
-- Both are optional. Every existing row stays valid, and the publish path falls
-- back to `caption.slice(0, 90)` when `title` is null, so posts composed before
-- this migration behave exactly as they did before it.
--
-- No grant changes are needed. content_posts carries table-level privileges for
-- `authenticated` and has NO column-level ACLs, so new columns are writable the
-- moment they exist. That is NOT true of `brands`, where a new user-editable
-- column must also be added to the grant update/insert lists or the save fails
-- with a permission error rather than an RLS error — see 045/049.

alter table content_posts add column if not exists title text;
alter table content_posts add column if not exists options jsonb not null default '{}'::jsonb;

comment on column content_posts.title is
  'Short headline. TikTok caps this at 90 UTF-16 runes for photo posts; the publish path truncates as a backstop. Null means fall back to the first 90 characters of caption.';

comment on column content_posts.options is
  'Platform-specific post settings, read at publish. TikTok: disable_comment, auto_add_music, brand_content_toggle, brand_organic_toggle. privacy_level is deliberately NOT honoured from here — the server clamps it to TIKTOK_PRIVACY_LEVEL so a client cannot request a visibility the app is not audited for.';
