-- Restore uploads to `mockups`, which 039 broke, without reopening what it closed.
--
-- WHAT WENT WRONG
-- 039 dropped both "Public Read Access" (SELECT) and "Authenticated Updates"
-- (UPDATE), leaving only INSERT. Every upload in the app passes
-- `upsert: true`, which compiles to INSERT ... ON CONFLICT DO UPDATE, and
-- Postgres requires the SELECT and UPDATE policies for that statement WHETHER
-- OR NOT A CONFLICT OCCURS — the check belongs to the plan, not to the runtime
-- outcome. So every save failed with "new row violates row-level security
-- policy". 039's stated reasoning ("filenames are timestamped so collisions
-- never happen, therefore dropping UPDATE is near-zero risk") was simply wrong
-- about how the requirement works.
--
-- WHY NOT JUST PUT 039's POLICIES BACK
-- Because they were the vulnerability: both were scoped on `bucket_id` alone,
-- so SELECT let anyone with the public anon key list all 732 objects (and every
-- key is a working public URL), and UPDATE let any signed-in user overwrite any
-- other brand's design.
--
-- THE FIX
-- Scope both to the uploader instead of the whole bucket. storage.objects.owner
-- is set to auth.uid() at insert time and is populated on all 732 existing rows
-- (3 distinct owners), so this is a live column, not an aspiration.
--
--   · upsert works again — a user can see and overwrite their OWN objects, which
--     is all ON CONFLICT needs.
--   · enumeration stays closed — a list returns only the caller's own files, not
--     the bucket. Anonymous listing is impossible: `anon` has no auth.uid().
--   · cross-tenant overwrite stays closed — you cannot update a row you do not
--     own, so knowing another brand's filename buys nothing.
--
-- This is stricter than what existed before 039, not a rollback of it.
--
-- Public downloads are unaffected either way: a public bucket serves
-- /object/public/... without consulting RLS, which is why getPublicUrl kept
-- working throughout the outage.
--
-- STILL NOT FIXED, deliberately: there is no DELETE policy, so .remove()
-- continues to no-op silently. An owner-scoped DELETE would only let users
-- delete files they personally uploaded, which is not the same as "files
-- belonging to this brand" — a teammate could not clean up another's work. That
-- needs the per-brand path namespacing of phase 2 to do properly.

create policy "own objects select" on storage.objects
  for select to authenticated
  using (bucket_id = 'mockups' and owner = auth.uid());

create policy "own objects update" on storage.objects
  for update to authenticated
  using (bucket_id = 'mockups' and owner = auth.uid())
  with check (bucket_id = 'mockups' and owner = auth.uid());
