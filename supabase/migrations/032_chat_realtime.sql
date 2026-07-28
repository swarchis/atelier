-- Publish the chat tables to Supabase Realtime so conversations update over a
-- websocket instead of only on page reload.
--
-- Realtime still enforces RLS on postgres_changes, so a subscriber only
-- receives rows they could already SELECT — chat_messages remains gated by
-- is_chat_member(), exactly as it is for normal reads.
--
-- Idempotent: adding a table that is already published raises, so each is
-- guarded rather than assumed absent.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime add table public.chat_messages;
  end if;

  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chats'
  ) then
    alter publication supabase_realtime add table public.chats;
  end if;

  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_participants'
  ) then
    alter publication supabase_realtime add table public.chat_participants;
  end if;
end $$;
