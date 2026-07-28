-- Fix the signup trigger. Signup was failing in production with
-- "500: Database error saving new user".
--
-- handle_new_user() runs on every insert into auth.users and did:
--
--   UPDATE public.brand_members SET user_id = new.id, status = 'active'
--    WHERE email = new.email;
--
-- brand_members has no `email` column — 007 created it as `invited_email` and
-- it was never renamed. Postgres raises 42703 (column does not exist), the
-- trigger aborts, and because the trigger runs inside the auth.users insert,
-- the whole signup transaction rolls back. Every signup path was affected
-- (email/password and OAuth alike), not just the invite case: the broken
-- statement is unconditional, so it runs even when there is no pending invite.
--
-- Confirmed in the auth logs before this fix — two real Google signup attempts
-- on 2026-07-28 (14:28:21 and 14:30:44) both returned
-- "500: Database error saving new user ... column \"email\" does not exist".
-- The most recent successful signup was 2026-07-20.
--
-- The only change to the logic is the column name. The brand insert below is
-- unchanged and still intentional: AuthContext.signUp checks for an existing
-- brand before creating one, so the trigger's workspace and the frontend's
-- named workspace do not duplicate each other.
--
-- `set search_path = public` is added because this is SECURITY DEFINER and the
-- database linter flags it (0011_function_search_path_mutable). Both tables are
-- already schema-qualified, so it changes no behavior.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
BEGIN
  -- 1. Create a default brand workspace for the new user
  INSERT INTO public.brands (user_id, name, plan_tier)
  VALUES (new.id, 'My Personal Workspace', 'free');

  -- 2. Automatically link them to any pending team invitations matching their email
  UPDATE public.brand_members
  SET user_id = new.id, status = 'active'
  WHERE invited_email = new.email;

  RETURN new;
END;
$$;
