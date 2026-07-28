-- Two chat holes: forged senders, and joining any chat you like.
--
-- ── A. chat_messages never tied sender_id to the caller ─────────────────────
-- 016's insert policy is `with check (is_chat_member(chat_id))` and nothing
-- more, so a chat member could post a message carrying anyone else's sender_id
-- — the brand owner's, say — and the UI renders it under their name. In a tool
-- where chat is where production decisions get agreed, a message that looks like
-- it came from the owner is a real problem, not a cosmetic one.
--
-- The client legitimately inserts exactly two shapes (ChatContext.sendMessage):
--   { sender_type: 'user', sender_id: <the caller> }
--   { sender_type: 'ai',   sender_id: null }
-- so the policy pins both rather than just requiring sender_id = auth.uid(),
-- which would break the assistant's replies.
--
-- KNOWN RESIDUAL, stated rather than papered over: this stops impersonating
-- another PERSON, but a member can still insert a row as sender_type 'ai' with
-- a body of their choosing, because the AI reply is written by the browser after
-- /api/chat-reply returns. Closing that means moving the assistant's insert to
-- the backend, where the service-role key writes it and the client never can.
-- That is a bigger change than this migration and is not attempted here.
--
-- ── B. chat_participants could be moved between chats ───────────────────────
-- "member marks own read state" is `for update using (user_id = auth.uid())`
-- with no WITH CHECK, so the row survives being repointed at any chat_id — the
-- caller stays the owner of the row, the check still passes, and they are now a
-- participant of a chat they were never added to. chat_messages SELECT is gated
-- on is_chat_member(chat_id), so that is a straight read of someone else's
-- conversation.
--
-- Adding a WITH CHECK does not fix it: the check sees only the new row, and
-- `user_id = auth.uid()` is just as true after the chat_id changes. Same
-- limitation as 048. Here, though, a column grant is the exact tool — the only
-- update the client ever makes is markRead setting last_read_at
-- (ChatContext.jsx:210), so no other column needs to be writable at all.
--
-- Same Postgres gotcha as 045: a column-level REVOKE cannot subtract from a
-- table-level grant, so the table-wide UPDATE goes first and last_read_at is
-- granted back.

-- A.
drop policy if exists "chat members send messages" on public.chat_messages;

create policy "chat members send messages" on public.chat_messages
  for insert to authenticated
  with check (
    public.is_chat_member(chat_id)
    and (
      (sender_type = 'user' and sender_id = auth.uid())
      or (sender_type = 'ai' and sender_id is null)
    )
  );

-- B.
revoke update on public.chat_participants from authenticated, anon;
grant update (last_read_at) on public.chat_participants to authenticated;
