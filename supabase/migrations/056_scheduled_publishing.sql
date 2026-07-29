-- Phase 2: make the word "scheduled" true.
--
-- ── WHAT WAS ACTUALLY BROKEN ────────────────────────────────────────────────
-- content_posts.scheduled_for has only ever been read for sorting
-- (ContentContext) and drawing the calendar (ContentHub). Nothing ran at that
-- time. Publishing was a manual button, and toggleStatus just cycled the label,
-- so a post could read "Posted" having never left the building. The calendar was
-- a planner wearing a scheduler's vocabulary.
--
-- ── THE CLAIM, AND WHY IT IS A FUNCTION ─────────────────────────────────────
-- Two processes must never publish the same post. That is not solvable by
-- checking the status and then updating it — between the two statements another
-- worker reads the same row. claim_due_content_posts does it in one statement:
-- FOR UPDATE SKIP LOCKED takes the rows nobody else holds, and the UPDATE flips
-- them to 'Publishing' before returning them. A second caller running
-- concurrently sees them already claimed and gets nothing.
--
-- SKIP LOCKED rather than plain FOR UPDATE on purpose: a second worker should
-- move on to other posts, not block waiting for the first one's transaction.
--
-- ── STUCK ROWS ──────────────────────────────────────────────────────────────
-- If the process dies mid-publish, a row stays 'Publishing' forever and would
-- never be retried. publish_started_at lets a claim reclaim anything that has sat
-- in 'Publishing' longer than the stale window. publish_attempts then caps how
-- many times that can happen, so a post that always fails stops rather than
-- retrying until the platform rate-limits us. It ends up 'Failed' with the real
-- reason in publish_error, which is a thing the user can see and act on.
--
-- ── SECURITY ────────────────────────────────────────────────────────────────
-- SECURITY DEFINER, and EXECUTE revoked from public/anon/authenticated exactly as
-- 035 did for the credit RPCs. auth.uid() is NULL under service_role, so there is
-- no per-user check to make inside it — the protection is that only the backend
-- can call it at all. PostgREST exposes every public-schema function as RPC, so
-- leaving the default PUBLIC grant would let any signed-in user claim and stall
-- another brand's posts.
--
-- NOTE: no new client-writable column here. The publish record (external_url,
-- published_at, publish_error) is written by the backend only. A client-writable
-- "this was published, here's the link" field is a client-writable claim about
-- reality, which is the same reason 052 fenced off tech pack approval.

alter table public.content_posts
  add column if not exists external_url       text,
  add column if not exists published_at       timestamptz,
  add column if not exists publish_error      text,
  add column if not exists publish_attempts   integer not null default 0,
  add column if not exists publish_started_at timestamptz;

-- status now also takes 'Publishing' (in flight). Existing values unchanged:
-- Draft | Scheduled | Posted | Failed. No constraint is added because none
-- existed before and adding one would reject whatever historical values are
-- already in there.

create index if not exists content_posts_due_idx
  on public.content_posts (status, scheduled_for)
  where status in ('Scheduled', 'Publishing');

create or replace function public.claim_due_content_posts(
  p_limit int default 10,
  p_stale_minutes int default 10,
  p_max_attempts int default 3
)
returns setof public.content_posts
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with due as (
    select cp.id
      from public.content_posts cp
     where cp.scheduled_for is not null
       and cp.scheduled_for <= now()
       and cp.publish_attempts < p_max_attempts
       -- Never republish something that has already gone out. `status` alone is
       -- not enough: the status tag in the UI is user-editable, so a published
       -- post can be cycled back to 'Scheduled' with a past date, and it would
       -- otherwise be claimed and posted a second time. published_at is written
       -- only by the backend and is the durable fact.
       and cp.published_at is null
       and (
         cp.status = 'Scheduled'
         -- Reclaim anything abandoned mid-flight by a process that died.
         or (cp.status = 'Publishing'
             and cp.publish_started_at is not null
             and cp.publish_started_at < now() - make_interval(mins => p_stale_minutes))
       )
     order by cp.scheduled_for
     for update skip locked
     limit p_limit
  )
  update public.content_posts p
     set status             = 'Publishing',
         publish_attempts   = p.publish_attempts + 1,
         publish_started_at = now()
    from due
   where p.id = due.id
  returning p.*;
end;
$$;

revoke all on function public.claim_due_content_posts(int, int, int) from public, anon, authenticated;
grant execute on function public.claim_due_content_posts(int, int, int) to service_role;
