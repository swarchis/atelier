-- Autosave has never worked. This is why.
--
-- ── THE BUG ─────────────────────────────────────────────────────────────────
-- design_versions has permissive policies for SELECT, INSERT and DELETE, and a
-- RESTRICTIVE one for UPDATE (added by 050) — but no PERMISSIVE UPDATE policy,
-- and there never was one. Restrictive policies AND with permissive ones and can
-- only ever subtract; with no permissive policy for a command, that command is
-- denied to everybody, brand owner included.
--
-- So every UPDATE on this table has been blocked since the table was created.
--
-- ── WHY NOBODY NOTICED ──────────────────────────────────────────────────────
-- An RLS-blocked UPDATE is not an error. It matches zero rows and returns
-- `{data: null, error: null}` — the same shape as success. DesignDetail's
-- writeVersionRow returned that null error, the caller saw no failure, the
-- autosave failure counter reset, and no toast fired.
--
-- The rolling 'Autosave' row is INSERTed the first time (permissive INSERT
-- exists, so that works) and updated every two minutes thereafter — which is to
-- say, never. On the product this was found on, the Autosave row was written
-- 2026-07-28 07:13 and had not moved since, while autosave files kept uploading
-- to storage every 120 seconds. Every one of those files was orphaned the
-- instant it was created: uploaded, then never referenced by any row.
--
-- That also explains the storage leak that survived 058's DELETE policy and the
-- deleteMockupFiles cleanup. The cleanup was working; there was simply nothing
-- for it to supersede, because the row it reads never changed.
--
-- The real cost is not the megabytes. Autosave silently has not been saving.
--
-- ── SCOPE ───────────────────────────────────────────────────────────────────
-- Sixteen tables share this shape (restrictive UPDATE, no permissive UPDATE):
-- ai_usage_log, categories, comments, design_comments, design_versions,
-- material_cost_log, material_vendors, pinned_items, product_stage_history,
-- product_variants, production_updates, quote_negotiations, rfqs,
-- sample_fit_feedback, sample_images, tech_pack_versions.
--
-- Only design_versions is granted an UPDATE policy here, because it is the only
-- one the application actually calls .update() on (verified by grepping every
-- `from('<table>')` chain in la-guia/src and api/index.js). The other fifteen are
-- append-only in practice, and handing them UPDATE would widen write access to
-- fix a problem they do not have. If one of them ever needs updating, it gets its
-- own policy then.
--
-- Scoped to has_brand_access to match its sibling SELECT/INSERT/DELETE policies.
-- 050's restrictive policy still ANDs on top, so a viewer remains unable to
-- write — owner, admin and editor can, which is the intended behaviour.
--
-- WITH CHECK is stated explicitly rather than left to default to USING, so the
-- row cannot be repointed at a product in a brand the caller has no access to.

drop policy if exists "brand access update versions" on public.design_versions;

create policy "brand access update versions" on public.design_versions
  for update to authenticated
  using (
    exists (
      select 1 from public.products p
       where p.id = design_versions.product_id
         and public.has_brand_access(p.brand_id)
    )
  )
  with check (
    exists (
      select 1 from public.products p
       where p.id = design_versions.product_id
         and public.has_brand_access(p.brand_id)
    )
  );
