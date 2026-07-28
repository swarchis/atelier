-- Only claim a pending invite once the email address is actually confirmed.
--
-- 038 fixed the column name in handle_new_user, but left the timing wrong: the
-- invite link ran on INSERT into auth.users, which happens BEFORE the
-- confirmation email is opened. So signing up as an address that had an invite
-- waiting bound that invite to the new user immediately — even though that user
-- had not proven they own the address and could not log in. The real invitee was
-- then locked out of their own row.
--
-- The fix has to cover two different paths, which is why this is more than
-- moving one statement:
--
--   · Email/password signup — email_confirmed_at is NULL at INSERT and gets set
--     later, when the link is opened. Handled by the new UPDATE trigger below.
--   · Google OAuth — the provider has already verified the address, so
--     email_confirmed_at is already set at INSERT. The UPDATE trigger would
--     never fire for these users, so handle_new_user still links them, but only
--     when that column is non-null.
--
-- Both paths also now require `user_id is null`, so an invite that has already
-- been claimed can never be reassigned by a later signup on the same address.

-- 1. Brand creation stays on INSERT. Invite linking now happens there only for
--    already-verified addresses (the OAuth case).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
BEGIN
  -- Create a default brand workspace for the new user
  INSERT INTO public.brands (user_id, name, plan_tier)
  VALUES (new.id, 'My Personal Workspace', 'free');

  -- Only link invites here if the provider already verified the address
  -- (OAuth). Unconfirmed email/password signups are handled on confirmation
  -- by on_auth_user_confirmed below.
  IF new.email_confirmed_at IS NOT NULL THEN
    UPDATE public.brand_members
       SET user_id = new.id, status = 'active', joined_at = now()
     WHERE invited_email = new.email
       AND user_id IS NULL;
  END IF;

  RETURN new;
END;
$$;

-- 2. Link pending invites at the moment the address is confirmed.
create or replace function public.link_pending_invites()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
BEGIN
  -- Fire only on the null -> not-null transition, so ordinary user updates
  -- (password change, metadata edit, last_sign_in_at) don't re-run this.
  IF new.email_confirmed_at IS NOT NULL AND old.email_confirmed_at IS NULL THEN
    UPDATE public.brand_members
       SET user_id = new.id, status = 'active', joined_at = now()
     WHERE invited_email = new.email
       AND user_id IS NULL;
  END IF;

  RETURN new;
END;
$$;

drop trigger if exists on_auth_user_confirmed on auth.users;
create trigger on_auth_user_confirmed
  after update on auth.users
  for each row execute function public.link_pending_invites();
