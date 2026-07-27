-- Alternate garment views (back, side, detail, ...) for a design.
--
-- The AI "Generate a View" tool used to replace the canvas outright, which
-- destroyed the front view to show the back. Views are now their own switchable
-- tabs inside the design screen: the main canvas remains the front view (backed
-- by design_versions as before) and every generated view is an entry here.
--
-- Shape: [{ "key": "view-1723...", "label": "Back", "imageUrl": "https://..." }]
alter table public.designs add column if not exists views jsonb not null default '[]'::jsonb;
