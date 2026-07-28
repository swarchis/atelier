-- Let the brand owner have a real name in chat and the member list.
--
-- Members get theirs from brand_members.display_name (031), but the owner has
-- no membership row, so they were hardcoded as "Brand owner" everywhere. Their
-- name in user_preferences can't be used: RLS scopes that table to its own
-- user, so teammates can't read it. Storing it on the brand puts it somewhere
-- every member of the brand can already SELECT.
alter table public.brands add column if not exists owner_display_name text;
