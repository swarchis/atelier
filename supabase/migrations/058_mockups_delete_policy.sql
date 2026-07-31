-- Give the `mockups` bucket a DELETE policy, so cleanup can happen at all.
--
-- ── WHAT THIS FIXES ─────────────────────────────────────────────────────────
-- `mockups` has INSERT, SELECT and UPDATE policies and has never had a DELETE
-- one. An RLS-blocked delete is not an error — it matches zero rows and returns
-- `{data: [], error: null}` — so the NINE `.remove()` call sites in the frontend
-- have all been silently deleting nothing:
--
--   SamplingContext.jsx:99,136   ProductsContext.jsx:263,578,614
--   VariantsTab.jsx:38           InspirationTab.jsx:35
--   HistoryTab.jsx:41            DesignDetail (via helpers)
--
-- Deleting a design, a product, a sample image or a version has been leaving
-- every file behind since the bucket was created. At the time of writing that is
-- 713 orphaned objects holding 2304 MB, against 65 MB actually referenced — 97%
-- of the bucket is garbage. The single biggest contributor is the Photopea
-- working file: 348 `-working-*.psd` objects totalling 1933 MB, because every
-- autosave uploads a new timestamped PSD and repoints the rolling version row
-- without removing the file it replaced.
--
-- ── WHY OWNER-SCOPED, AND WHAT THAT DOESN'T COVER ───────────────────────────
-- Scoped to `owner = auth.uid()`, matching what 046/047 did for `content_media`.
-- That is deliberately narrower than brand membership, and the limitation is
-- real: a teammate cannot delete a file another member uploaded, so a shared
-- design cleaned up by the wrong person still leaves orphans.
--
-- The reason it isn't brand-scoped is that mockup paths are flat — the filename
-- is `{productId}-{kind}-{timestamp}.{ext}` with no per-brand folder — so a
-- brand-aware policy would have to parse a filename inside a policy expression
-- and join through products. That is fragile in exactly the place where being
-- wrong means either deleting other brands' files or silently deleting nothing.
-- Per-brand path namespacing is the real fix and is tracked separately.
--
-- Owner-scoped IS sufficient for the leak that actually accounts for the 1933 MB:
-- the person autosaving a design is the same person who uploaded the file being
-- replaced, so the common case works from day one.
--
-- Nothing here deletes any existing object. The 713 orphans stay until a
-- separate, explicitly approved cleanup removes them.

drop policy if exists "own objects delete" on storage.objects;

create policy "own objects delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'mockups' and owner = auth.uid());
