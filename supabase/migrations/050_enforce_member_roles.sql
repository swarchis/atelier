-- Make the `role` column on brand_members actually mean something.
--
-- ── THE HOLE ────────────────────────────────────────────────────────────────
-- has_brand_access() (007) returns true for the brand owner OR any active
-- member, and never looks at `role`. Every write policy in the schema is built
-- on it — 37 INSERT, 20 UPDATE, 29 DELETE across 37 tables — so a teammate
-- invited as a `viewer` has exactly the same power as the owner: create, edit
-- and delete products, designs, tech packs, vendors, quotes, production orders,
-- samples, and the rest. The role dropdown in the invite UI is decorative.
--
-- That is the actual problem: the product promises a restriction the database
-- does not enforce, so a founder inviting a contractor as "viewer" is handing
-- over delete rights on everything without being told.
--
-- ── APPROACH: RESTRICTIVE POLICIES, NOT 86 REWRITES ─────────────────────────
-- The obvious fix — swapping has_brand_access for a write-aware variant in every
-- write policy — means rewriting 86 policies, each with its own shape, where a
-- single typo silently opens or closes a table. Instead this adds RESTRICTIVE
-- policies, which AND with the existing permissive ones. They can only ever
-- subtract access, never grant it, so a mistake here fails closed. The existing
-- policies are left untouched, and SELECT is deliberately NOT restricted — a
-- viewer must still be able to read, or the role is pointless rather than safe.
--
-- The direct-brand_id table list is derived from pg_policies at run time rather
-- than hardcoded, so it matches whatever is actually live rather than what this
-- repo believes. See 042 and 044 for why that distinction earned its own note.
--
-- The `drop policy if exists` lines only ever drop policies this same migration
-- creates; they are there to make it safely re-runnable.
--
-- service_role is unaffected (BYPASSRLS), so the API keeps working. Owners,
-- admins and editors are unaffected. Only `viewer` loses write access.
--
-- Roles per 007: owner | admin | editor | viewer.

create or replace function public.has_brand_write_access(check_brand_id uuid)
returns boolean language sql security definer stable
set search_path = public
as $$
  select exists (
           select 1 from public.brands
            where id = check_brand_id and user_id = auth.uid()
         )
      or exists (
           select 1 from public.brand_members
            where brand_id = check_brand_id
              and user_id = auth.uid()
              and status = 'active'
              and role in ('owner', 'admin', 'editor')
         );
$$;

-- 1. Tables carrying a direct brand_id column.
do $$
declare
  t text;
begin
  for t in
    select distinct p.tablename
      from pg_policies p
     where p.schemaname = 'public'
       and p.cmd in ('INSERT', 'UPDATE', 'DELETE')
       and (coalesce(p.qual, '') like '%has_brand_access%'
            or coalesce(p.with_check, '') like '%has_brand_access%')
       and exists (
             select 1 from information_schema.columns c
              where c.table_schema = 'public'
                and c.table_name = p.tablename
                and c.column_name = 'brand_id'
           )
  loop
    execute format('drop policy if exists "writer role required insert" on public.%I', t);
    execute format('drop policy if exists "writer role required update" on public.%I', t);
    execute format('drop policy if exists "writer role required delete" on public.%I', t);

    execute format(
      'create policy "writer role required insert" on public.%I as restrictive for insert to authenticated '
      'with check (public.has_brand_write_access(brand_id))', t);
    execute format(
      'create policy "writer role required update" on public.%I as restrictive for update to authenticated '
      'using (public.has_brand_write_access(brand_id))', t);
    execute format(
      'create policy "writer role required delete" on public.%I as restrictive for delete to authenticated '
      'using (public.has_brand_write_access(brand_id))', t);
  end loop;
end $$;

-- 2. Child tables, which carry no brand_id and are scoped through a parent.
--    Every (table, fk, parent) triple below was confirmed against
--    information_schema rather than inferred from the migration that created it.
do $$
declare
  rec record;
begin
  for rec in
    select * from (values
      ('designs',               'product_id',          'products'),
      ('design_versions',       'product_id',          'products'),
      ('design_comments',       'product_id',          'products'),
      ('tech_packs',            'product_id',          'products'),
      ('tech_pack_versions',    'product_id',          'products'),
      ('product_variants',      'product_id',          'products'),
      ('product_stage_history', 'product_id',          'products'),
      ('production_issues',     'production_order_id', 'production_orders'),
      ('production_updates',    'production_order_id', 'production_orders'),
      ('quote_negotiations',    'quote_id',            'quotes'),
      ('sample_images',         'sample_id',           'samples'),
      ('sample_annotations',    'sample_id',           'samples'),
      ('sample_fit_feedback',   'sample_id',           'samples')
    ) as t(tbl, fk, parent)
  loop
    execute format('drop policy if exists "writer role required insert" on public.%I', rec.tbl);
    execute format('drop policy if exists "writer role required update" on public.%I', rec.tbl);
    execute format('drop policy if exists "writer role required delete" on public.%I', rec.tbl);

    -- The child's own column is qualified with its table name so it cannot be
    -- shadowed by a same-named column on the parent inside the subquery — the
    -- mistake that would have made 048's guard compare a row to itself.
    execute format(
      'create policy "writer role required insert" on public.%I as restrictive for insert to authenticated '
      'with check (exists (select 1 from public.%I p where p.id = %I.%I and public.has_brand_write_access(p.brand_id)))',
      rec.tbl, rec.parent, rec.tbl, rec.fk);
    execute format(
      'create policy "writer role required update" on public.%I as restrictive for update to authenticated '
      'using (exists (select 1 from public.%I p where p.id = %I.%I and public.has_brand_write_access(p.brand_id)))',
      rec.tbl, rec.parent, rec.tbl, rec.fk);
    execute format(
      'create policy "writer role required delete" on public.%I as restrictive for delete to authenticated '
      'using (exists (select 1 from public.%I p where p.id = %I.%I and public.has_brand_write_access(p.brand_id)))',
      rec.tbl, rec.parent, rec.tbl, rec.fk);
  end loop;
end $$;
