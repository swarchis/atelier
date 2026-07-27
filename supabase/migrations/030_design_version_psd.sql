-- Give every saved version its own layered working file.
--
-- Until now a save stored only a flattened PNG, and the layer stack lived in a
-- single rolling "Working file (PSD)" row. That meant restoring an older
-- version — or opening any view other than the front — collapsed the design
-- into one flat image and permanently lost the layers.
--
-- Each design_versions row now carries its own PSD alongside the raster
-- preview: image_url stays the flattened thumbnail (used for history and
-- previews), psd_url is the layered file that actually gets reopened.
alter table public.design_versions add column if not exists psd_url text;

-- Alternate garment views store their layered file the same way, inside the
-- designs.views entries added in 029:
--   [{ "key": "...", "label": "Back", "imageUrl": "...", "psdUrl": "..." }]
-- No schema change needed for that — jsonb already carries it.
