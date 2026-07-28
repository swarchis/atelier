-- Same fix as 046, for the bucket that had the same bug and had not been noticed.
--
-- 040 dropped content_media's bucket-wide SELECT policy to stop any signed-in
-- user listing the bucket. ContentHub.jsx:111-113 uploads there with
-- `upsert: true`, which needs SELECT and UPDATE as well as INSERT — see the note
-- in 046 — so Content Hub media uploads have been failing with "new row
-- violates row-level security policy" ever since, exactly like the mockups
-- outage. It went unreported only because Content Hub had not been used since.
--
-- Found by sweeping every storage call site against the policies changed this
-- session rather than waiting for a second bug report. The earlier grep missed
-- it because the upload is split across three lines.
--
-- Fix mirrors 046: scope to the uploader instead of the bucket, so upsert works
-- on your own object while enumeration and cross-tenant overwrite stay closed.
-- owner is populated on the existing row.
--
-- Also replaces the two remaining bucket-wide policies here. They were the same
-- shape as the mockups UPDATE policy that allowed cross-tenant overwrite:
--   · UPDATE (bucket_id = 'content_media') — any signed-in user could overwrite
--     any other brand's uploaded media.
--   · DELETE (bucket_id = 'content_media') — and delete it.
-- 040 left them alone because ContentHub has no delete path and the risk looked
-- theoretical; since this migration has to touch the bucket anyway, they are
-- narrowed rather than left as a known-bad pattern. Nothing in la-guia/src calls
-- .remove() on content_media, so the DELETE narrowing changes no behaviour.

drop policy if exists "Allow authenticated updates to content_media" on storage.objects;
drop policy if exists "Allow authenticated deletes from content_media" on storage.objects;

create policy "own content_media select" on storage.objects
  for select to authenticated
  using (bucket_id = 'content_media' and owner = auth.uid());

create policy "own content_media update" on storage.objects
  for update to authenticated
  using (bucket_id = 'content_media' and owner = auth.uid())
  with check (bucket_id = 'content_media' and owner = auth.uid());

create policy "own content_media delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'content_media' and owner = auth.uid());
