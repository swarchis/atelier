-- "Continue where you left off" was showing the newest product, not the one you
-- last touched. Home took products[0] from a list ordered by created_at, so
-- reopening an old design and saving an edit left it invisible while a design
-- created weeks ago and never opened since sat at the top.
--
-- created_at cannot answer "what was I last working on", so this adds the
-- column that can. The trigger covers every UPDATE, which is most of it:
-- renames, stage moves, readiness recalculation on tech pack save. Canvas
-- saves write to `designs`/`design_versions` rather than `products`, so
-- DesignDetail touches the product row explicitly on save.
alter table public.products add column if not exists updated_at timestamptz not null default now();

create or replace function public.touch_products_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists products_touch_updated_at on public.products;
create trigger products_touch_updated_at
  before update on public.products
  for each row execute function public.touch_products_updated_at();

-- Existing rows start from their creation date rather than "now", so the very
-- first load after this migration does not claim every product was just edited.
update public.products set updated_at = created_at where updated_at is null;
