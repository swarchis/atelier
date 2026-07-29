-- Social OAuth tokens stop being client-readable, and gain an expiry.
--
-- ── A. THE LEAK ─────────────────────────────────────────────────────────────
-- social_accounts.access_token / refresh_token are selectable by any brand
-- member. 026's SELECT policy is has_brand_access(brand_id), and 050
-- deliberately left SELECT unrestricted so viewers can read — which is right for
-- products and quotes, and wrong for a bearer token. ContentHub.jsx read
-- account.access_token straight out of the row and posted it to the API, so the
-- token was in the browser of every member of the brand, viewers included.
--
-- Today that token carries user.info.basic and is nearly harmless. The reason
-- this lands NOW rather than alongside the feature that needs it: the whole point
-- of the upcoming TikTok revision is to attach video.publish to this same token.
-- The moment that scope is granted, a read-only teammate holds a credential that
-- can post to the brand's TikTok. Closing it afterwards means shipping the hole
-- first and hoping.
--
-- ── WHY A COLUMN GRANT, NOT A POLICY ────────────────────────────────────────
-- "Everyone with brand access may read this row except for two columns" is not a
-- row-level condition, so RLS cannot express it — the same reason 051 used a
-- grant for chat_participants. And per 044's lesson, a column-level REVOKE
-- cannot subtract from a table-level grant, so SELECT is revoked table-wide and
-- the readable columns are granted back by name.
--
-- INSERT and UPDATE are revoked outright with nothing granted back: after this,
-- the backend writes this table with the service-role key (which bypasses both
-- grants and RLS) during the OAuth callback, and the client's only remaining
-- write is DELETE — the Disconnect button, which is left alone.
--
-- ── B. THE 24-HOUR EXPIRY ───────────────────────────────────────────────────
-- TikTok access tokens last 24 hours and refresh tokens a year, but
-- SOCIAL_OAUTH.tiktok.getToken dropped both refresh_token and expires_in, so
-- every TikTok connection silently went dead the next day and looked like our
-- bug. token_expires_at is what lets the backend refresh before a call fails
-- rather than after.
--
-- ── DRIFT NOTE ──────────────────────────────────────────────────────────────
-- The live table disagrees with 026 in two places, and the live table is what
-- this migration was written against: the column is `created_at`, not
-- `connected_at`, and `connected` defaults to false, not true. Same pattern the
-- July audit hit three times. Do not "correct" 026 from this file — query the
-- database.
--
-- ── DEPLOY ORDER ────────────────────────────────────────────────────────────
-- Ship the backend and frontend together FIRST, then run this. The old bundle's
-- connectAccount() upserts this table directly; if the grant is revoked while
-- that bundle is live, connecting an account fails with a permission error.
-- Reversed, the worst case is one redundant client write, which is harmless.

alter table public.social_accounts
  add column if not exists token_expires_at timestamptz;

-- A. Tokens out of reach of the client. Every other column stays readable.
--
-- CALLER REQUIREMENT, learned the hard way: `select('*')` requires the
-- TABLE-level SELECT privilege, which this revokes. Granting the columns back
-- individually does not satisfy it. Every client read of social_accounts must
-- name its columns, or it fails with a permission error — and since
-- ContentContext.loadData ignores the error, the visible symptom is a connected
-- account rendering as "Not connected" rather than anything that looks like a
-- fault. ContentContext was updated alongside this; check any new caller.
revoke select on public.social_accounts from authenticated, anon;
grant select (
  id, brand_id, platform, handle, followers, connected, created_at,
  token_expires_at
) on public.social_accounts to authenticated;

-- The backend owns every write to this table now, except Disconnect.
revoke insert, update on public.social_accounts from authenticated, anon;
