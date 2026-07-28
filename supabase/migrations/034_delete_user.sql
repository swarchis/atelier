-- Captures the `delete_user` function that already exists in the deployed
-- database. It was created directly in the Supabase dashboard and had never
-- been committed, so it was invisible to code review and would have been lost
-- in any project rebuild — `Settings.jsx:291` calls it and nothing in the repo
-- explained what it did.
--
-- Reviewed in the 2026-07-28 audit and found safe: it takes no arguments and
-- scopes the delete to auth.uid(), so it cannot be pointed at another account.
-- Called unauthenticated, auth.uid() is NULL and `id = NULL` matches no rows,
-- so there is no mass-delete path either.
--
-- SECURITY DEFINER is required — auth.users is not writable by the
-- `authenticated` role. Every identifier in the body is schema-qualified
-- (auth.users, auth.uid), so the missing `set search_path` cannot be used to
-- shadow anything; left as-is rather than "improved", since changing a live
-- account-deletion function to tidy it is not worth the risk.
--
-- NOTE: this is a faithful reconstruction from `prosrc`. Confirm it matches the
-- deployed definition with:
--   select pg_get_functiondef(oid) from pg_proc where proname = 'delete_user';
-- before treating this file as the source of truth.

create or replace function public.delete_user()
returns void
language sql
security definer
as $$
  -- Deletes the authenticated user.
  -- Because our schema uses "ON DELETE CASCADE", this will automatically
  -- wipe all their brands, products, designs, and tech packs instantly.
  DELETE FROM auth.users WHERE id = auth.uid();
$$;
