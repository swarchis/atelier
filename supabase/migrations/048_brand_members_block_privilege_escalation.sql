-- Close two independent cross-tenant takeover paths through brand_members.
--
-- ── THE HOLE ────────────────────────────────────────────────────────────────
-- Two UPDATE policies constrain who owns a row but not what the row may become:
--
--   "Member sets own display name" (031)
--     using (user_id = auth.uid())  with check (user_id = auth.uid())
--
--   "Invited users accept their own invite" (007)
--     using (invited_email = jwt email and user_id is null)
--     with check (user_id = auth.uid() and status = 'active')
--
-- Neither pins `brand_id` or `role`, so the row can be rewritten to point at any
-- brand, at any role, while still satisfying the check. Full chain from a fresh
-- signup, needing nothing but the victim's brand UUID:
--
--   1. Sign up. You own a brand, so is_brand_admin(your_brand) is true.
--   2. INSERT a brand_members row into your own brand — "Admins invite members"
--      permits it.
--   3. UPDATE that row: brand_id = <victim>, role = 'owner', status = 'active'.
--      user_id never changes, so both USING and WITH CHECK still pass.
--
-- has_brand_access(<victim>) now returns true, which hands over every
-- brand-scoped table via RLS, and the API's verifyBrandAccess() returns true,
-- which hands over their AI credits and outbound email. It also defeats removal:
-- an admin deleting the row does not stop it being recreated. The second policy
-- reaches the same place independently, so both need closing.
--
-- ── WHY A TRIGGER RATHER THAN A TIGHTER POLICY ──────────────────────────────
-- The rule is "these columns may not CHANGE", and an RLS WITH CHECK only sees
-- the new row — it cannot compare against the old one. Reading the old value
-- back with a subquery on the same table re-enters RLS and is fragile. A
-- column-level GRANT cannot express it either: `role` has to stay writable for
-- "Admins manage member roles", and grants apply per role, not per policy.
-- A BEFORE UPDATE trigger sees OLD and NEW together and is the honest fit.
--
-- NOTE FOR FUTURE READERS: enforcement for this table is now split between the
-- RLS policies and this trigger. Reading pg_policies alone will NOT tell you
-- what brand_members permits.
--
-- ── PRESERVED BEHAVIOUR (both verified against the live callers) ────────────
--   · TeamContext.setMyDisplayName — updates only display_name across the
--     caller's own rows. Untouched.
--   · TeamContext.claimInvites — sets user_id, status, joined_at, display_name
--     on a row whose user_id is still NULL. Allowed: the reassignment guard only
--     fires when old.user_id is already set, which is what makes claiming work
--     while stealing someone else's claimed row does not.
--   · "Admins manage member roles" — admins bypass every guard, so promoting
--     and demoting teammates still works.

create or replace function public.brand_members_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- An admin of the row's CURRENT brand may change anything about it. Checked
  -- against old.brand_id deliberately: checking new.brand_id would let a user
  -- move a row into a brand they administer and call that authorisation.
  if public.is_brand_admin(old.brand_id) then
    return new;
  end if;

  if new.brand_id is distinct from old.brand_id then
    raise exception 'brand_id cannot be changed on an existing membership';
  end if;

  if new.role is distinct from old.role then
    raise exception 'role can only be changed by a brand admin';
  end if;

  -- NULL -> auth.uid() is the invite claim and must stay possible. Moving an
  -- already-claimed membership to a different user must not.
  if old.user_id is not null and new.user_id is distinct from old.user_id then
    raise exception 'membership cannot be reassigned to another user';
  end if;

  return new;
end;
$$;

drop trigger if exists brand_members_guard_trg on public.brand_members;
create trigger brand_members_guard_trg
  before update on public.brand_members
  for each row execute function public.brand_members_guard();
