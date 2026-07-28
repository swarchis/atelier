-- Require an added chat participant to actually belong to the chat's brand.
--
-- 016_chat.sql's insert policy checked only that the *inserter* was already a
-- chat member:
--
--   with check (public.is_chat_member(chat_id))
--
-- It never constrained the user_id being inserted. So any participant could add
-- an arbitrary auth user to a chat, and since chat_messages select is gated on
-- is_chat_member(chat_id), that hands a total outsider the chat's full history.
-- A viewer-role teammate, or anyone left as a participant after being removed
-- from brand_members, could leak a brand's entire chat to an outside account.
--
-- create_group_chat (031) already does this check properly when it adds
-- participants, but it's a SECURITY DEFINER function — writing to the table
-- directly with the anon key skipped it entirely. This puts the same rule at the
-- table, where it can't be routed around.
--
-- Matches ChatContext.addableMembers (brand owner + active members), which is
-- the only set the participant picker ever offers, so legitimate adds are
-- unaffected.

drop policy if exists "chat members add participants" on public.chat_participants;

create policy "chat members add participants" on public.chat_participants for insert
  with check (
    public.is_chat_member(chat_participants.chat_id)
    and exists (
      select 1
        from public.chats c
       where c.id = chat_participants.chat_id
         and (
           -- The brand's owner.
           exists (
             select 1
               from public.brands b
              where b.id = c.brand_id
                and b.user_id = chat_participants.user_id
           )
           -- ...or someone with an active membership in it. Columns are
           -- qualified with chat_participants throughout because both brands
           -- and brand_members have their own user_id, which would otherwise
           -- shadow the new row's column and silently compare a row to itself.
           or exists (
             select 1
               from public.brand_members bm
              where bm.brand_id = c.brand_id
                and bm.user_id = chat_participants.user_id
                and bm.status = 'active'
           )
         )
    )
  );
