-- 1. Fix group-chat creation ("new row violates row-level security policy for
--    table chats") and 2. give teammates real names instead of raw emails.

-- ── 1a. Repair the chats INSERT policy ──────────────────────────────────────
-- The 022 version compared `bm.brand_id = brand_id` inside a subquery over
-- brand_members. Because brand_members HAS a brand_id column, the unqualified
-- reference bound to the SUBQUERY's column rather than the new row's — so the
-- condition was `bm.brand_id = bm.brand_id` (trivially true for any member of
-- any brand), while the owner branch could still fail depending on how the
-- brands row was reachable. Qualify the new row explicitly so both branches
-- mean what they say.
drop policy if exists "brand members create chats" on public.chats;

create policy "brand members create chats" on public.chats for insert
  with check (
    created_by = auth.uid()
    and (
      exists (
        select 1 from public.brands b
         where b.id = chats.brand_id
           and b.user_id = auth.uid()
      )
      or exists (
        select 1 from public.brand_members bm
         where bm.brand_id = chats.brand_id
           and bm.user_id = auth.uid()
           and bm.status = 'active'
      )
    )
  );

-- ── 1b. A definer-rights path for group chats ───────────────────────────────
-- Mirrors ensure_personal_ai_chat: the access decision lives in one place and
-- the insert can't be tripped up by RLS on the tables the check reads. Creates
-- the chat AND its participant rows in one transaction, so a chat can never be
-- left orphaned without members.
create or replace function public.create_group_chat(
  p_brand_id uuid,
  p_name text,
  p_participant_ids uuid[]
)
returns public.chats
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_chat public.chats;
  v_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1 from public.brands b
     where b.id = p_brand_id and b.user_id = v_user_id
  ) and not exists (
    select 1 from public.brand_members bm
     where bm.brand_id = p_brand_id
       and bm.user_id = v_user_id
       and bm.status = 'active'
  ) then
    raise exception 'No access to brand %', p_brand_id;
  end if;

  insert into public.chats (brand_id, type, name, created_by)
  values (p_brand_id, 'group', coalesce(nullif(btrim(p_name), ''), 'New chat'), v_user_id)
  returning * into v_chat;

  -- The creator is always a participant so their own read state is tracked.
  insert into public.chat_participants (chat_id, user_id)
  values (v_chat.id, v_user_id)
  on conflict (chat_id, user_id) do nothing;

  -- Only people who actually belong to this brand can be added.
  foreach v_id in array coalesce(p_participant_ids, array[]::uuid[])
  loop
    if exists (
      select 1 from public.brands b where b.id = p_brand_id and b.user_id = v_id
    ) or exists (
      select 1 from public.brand_members bm
       where bm.brand_id = p_brand_id and bm.user_id = v_id and bm.status = 'active'
    ) then
      insert into public.chat_participants (chat_id, user_id)
      values (v_chat.id, v_id)
      on conflict (chat_id, user_id) do nothing;
    end if;
  end loop;

  return v_chat;
end;
$$;

grant execute on function public.create_group_chat(uuid, text, uuid[]) to authenticated;

-- ── 2. Member display names ─────────────────────────────────────────────────
-- Teammates were shown as raw invite emails (or a guess derived from the email
-- prefix). user_preferences.full_name can't help because RLS scopes it to its
-- own user, so the name has to live on the membership row where the rest of
-- the brand can read it.
alter table public.brand_members add column if not exists display_name text;

-- A member may rename themselves; admins may rename anyone on their brand
-- (the existing admin update policy already covers role changes).
drop policy if exists "Member sets own display name" on public.brand_members;
create policy "Member sets own display name"
  on public.brand_members for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
