import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useProducts } from '../../context/ProductsContext.jsx';
import { useVendors } from '../../context/VendorsContext.jsx';
import { useMaterials } from '../../context/MaterialsContext.jsx';
import { usePinned } from '../../context/PinnedContext.jsx';
import { readinessColor, stageLink, swatchGradient } from '../../lib/format.js';

const TYPE_META = {
  product: { icon: 'ph-t-shirt', label: 'Design' },
  vendor: { icon: 'ph-handshake', label: 'Vendor' },
  material: { icon: 'ph-flask', label: 'Material' },
};

// Unified across three separate mechanisms that already exist —
// products' `is_favorite` star, vendors' `favorited` star, and the newer
// generic `pinned_items` table (used so far only for materials, which had
// no favorite concept before) — rather than adding a fourth. Each keeps its
// own toggle on its own page; this widget just merges all three into one
// "what I've marked as important" list.
export default function FavoriteProjects() {
  const navigate = useNavigate();
  const { products, toggleFavorite: toggleProductFavorite } = useProducts();
  const { vendors, toggleFavorite: toggleVendorFavorite } = useVendors();
  const { materials } = useMaterials();
  const { isPinned, togglePin } = usePinned();

  const items = [
    ...products.filter(p => p.is_favorite).map(p => ({
      type: 'product', id: p.id, name: p.name, sub: `${p.readiness}% ready`, subColor: readinessColor(p.readiness),
      swatch: swatchGradient(p.id), path: stageLink(p.stage, p.id), onUnpin: () => toggleProductFavorite(p.id),
    })),
    ...vendors.filter(v => v.favorited).map(v => ({
      type: 'vendor', id: v.id, name: v.name, sub: v.category || 'Vendor', subColor: 'var(--ink-3)',
      swatch: swatchGradient(v.id), path: `/vendors/${v.id}`, onUnpin: () => toggleVendorFavorite(v),
    })),
    ...materials.filter(m => isPinned('material', m.id)).map(m => ({
      type: 'material', id: m.id, name: m.name, sub: m.category || 'Material', subColor: 'var(--ink-3)',
      swatch: swatchGradient(m.id), path: `/materials/${m.id}`, onUnpin: () => togglePin('material', m.id),
    })),
  ];

  return (
    <div data-tour="favorites-widget" className="card-raised" style={{ padding: 20 }}>
      <div className="card-title" style={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 11, marginBottom: 12 }}>
        Pinned
      </div>
      {items.length === 0 ? (
        <div style={{ fontSize: 12.5, color: 'var(--ink-4)', fontStyle: 'italic', padding: '14px 0' }}>
          Star a product or vendor, or pin a material, and it'll show up here.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 260, overflowY: 'auto' }}>
          {items.map(it => {
            const meta = TYPE_META[it.type];
            return (
              <div
                key={`${it.type}-${it.id}`}
                className="card-hover"
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 8px', borderRadius: 'var(--r-sm)', cursor: 'pointer' }}
                onClick={() => navigate(it.path)}
              >
                <div style={{ width: 24, height: 24, borderRadius: 6, background: it.swatch, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className={`ph ${meta.icon}`} style={{ fontSize: 12, color: '#fff' }} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name}</div>
                  <div style={{ fontSize: 10.5, color: it.subColor }}>{it.sub}</div>
                </div>
                <button
                  title="Unpin"
                  onClick={e => { e.stopPropagation(); it.onUnpin(); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--amber)', fontSize: 14, flexShrink: 0 }}
                >
                  <i className="ph-fill ph-star" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
