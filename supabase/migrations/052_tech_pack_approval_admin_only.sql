-- Approval is admin-only in the UI. Make the database agree.
--
-- TechPackDetail.jsx:270 writes approval_status, approved_by, approved_at and
-- approval_comment on tech_packs. The screen only offers the control to owners
-- and admins, but nothing stops any brand member writing those columns
-- directly — so a viewer or editor can mark a tech pack approved, and
-- approved_by records whoever they say it was.
--
-- That matters more than a normal permission gap because approval is the record
-- of a decision. A tech pack marked approved is what gets sent to a factory; if
-- anyone on the brand can set it, and set who approved it, the field is not
-- evidence of anything.
--
-- ── WHY A TRIGGER ───────────────────────────────────────────────────────────
-- Same reasoning as 048. The rule is "these four columns may only be changed by
-- an admin", which is neither a row-level condition (RLS cannot see which
-- columns changed) nor a column grant (grants are per role, not per person's
-- relationship to a brand). A BEFORE UPDATE trigger sees OLD and NEW together
-- and can ask is_brand_admin about the row's own brand.
--
-- tech_packs has no brand_id of its own — it hangs off product_id — so the
-- brand is resolved through products, and the check is skipped entirely when the
-- four columns are untouched, which is the overwhelmingly common case (every
-- ordinary tech pack edit).
--
-- NOTE: enforcement for tech_packs is now split between RLS policies and this
-- trigger, as it already is for brand_members. pg_policies alone will not tell
-- you what this table permits.
--
-- Non-admins keep full edit rights on the tech pack itself — BOM, measurements,
-- construction, everything. Only the approval record is fenced off.

create or replace function public.tech_pack_approval_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_brand_id uuid;
begin
  -- Untouched approval fields: nothing to check, and no lookup to pay for.
  if new.approval_status  is not distinct from old.approval_status
     and new.approved_by  is not distinct from old.approved_by
     and new.approved_at  is not distinct from old.approved_at
     and new.approval_comment is not distinct from old.approval_comment then
    return new;
  end if;

  select p.brand_id into v_brand_id
    from public.products p
   where p.id = old.product_id;

  if v_brand_id is null or not public.is_brand_admin(v_brand_id) then
    raise exception 'Only a brand owner or admin can change tech pack approval';
  end if;

  return new;
end;
$$;

drop trigger if exists tech_pack_approval_guard_trg on public.tech_packs;
create trigger tech_pack_approval_guard_trg
  before update on public.tech_packs
  for each row execute function public.tech_pack_approval_guard();
