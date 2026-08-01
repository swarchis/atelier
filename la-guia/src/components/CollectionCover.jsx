import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { PhotoPanel } from './decor.jsx';
import { isRenderableImageUrl, PSD_VERSION_LABEL } from '../lib/designImages.js';
import { swatchGradient } from '../lib/format.js';

// Resolves one image per product: the tech pack image if there is one, else the
// newest renderable design snapshot. Same precedence Home uses for its hero, so
// a piece looks the same wherever it appears.
//
// One pair of queries for the whole collection rather than two per product —
// a collection of twelve would otherwise fire twenty-four requests to draw a
// thumbnail strip.
async function loadCoverImages(productIds) {
  if (!productIds.length) return {};
  const byProduct = {};

  const { data: packs } = await supabase
    .from('tech_packs').select('product_id, image_url').in('product_id', productIds);
  (packs || []).forEach(tp => {
    if (isRenderableImageUrl(tp.image_url)) byProduct[tp.product_id] = tp.image_url;
  });

  const missing = productIds.filter(id => !byProduct[id]);
  if (missing.length) {
    const { data: versions } = await supabase
      .from('design_versions')
      .select('product_id, image_url, created_at, label')
      .in('product_id', missing)
      .order('created_at', { ascending: false });
    // Ordered newest-first, so the first hit per product wins. PSD rows carry a
    // label that marks them as layered files rather than viewable images.
    (versions || []).forEach(v => {
      if (byProduct[v.product_id]) return;
      if (v.label === PSD_VERSION_LABEL) return;
      if (isRenderableImageUrl(v.image_url)) byProduct[v.product_id] = v.image_url;
    });
  }
  return byProduct;
}

export default function CollectionCover({ members, name, tone, style }) {
  const [images, setImages] = useState({});
  const ids = members.map(m => m.id);
  const key = ids.join(',');

  useEffect(() => {
    let alive = true;
    loadCoverImages(ids).then(map => { if (alive) setImages(map); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // An empty collection has nothing to show, so keep the woven placeholder
  // rather than an empty strip that reads as a loading failure.
  if (members.length === 0) {
    return <PhotoPanel variant="weave" tone={tone} aspect="16 / 6" label={name} icon="ph-stack" style={style} />;
  }

  const shown = members.slice(0, 6);
  const overflow = members.length - shown.length;

  return (
    <div
      style={{
        display: 'flex', gap: 1, aspectRatio: '16 / 6', overflow: 'hidden',
        background: 'var(--bg-3)', ...style,
      }}
      aria-label={`${name}: ${members.length} piece${members.length === 1 ? '' : 's'}`}
    >
      {shown.map(m => {
        const src = images[m.id];
        return (
          <div key={m.id} style={{ flex: 1, minWidth: 0, position: 'relative', background: 'var(--bg-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {src ? (
              <img
                src={src}
                alt={m.name}
                loading="lazy"
                style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#fff' }}
                // A dead storage URL falls back to the swatch rather than
                // leaving a broken-image glyph in the strip.
                onError={e => { e.currentTarget.style.display = 'none'; }}
              />
            ) : (
              // No snapshot yet: the piece still gets a slot, so the strip
              // shows how many things are in the collection rather than
              // silently hiding the ones without art.
              <div style={{ width: '100%', height: '100%', background: swatchGradient(m.id), opacity: 0.55, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="ph ph-t-shirt" style={{ fontSize: 16, color: 'var(--ink-4)' }} />
              </div>
            )}
          </div>
        );
      })}
      {overflow > 0 && (
        <div style={{ flex: 0.5, minWidth: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-2)', fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--ink-3)' }}>
          +{overflow}
        </div>
      )}
    </div>
  );
}
