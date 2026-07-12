import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { generateSku } from '../../lib/sku.js';

function ChipList({ label, placeholder, items, onAdd, onRemove }) {
  const [draft, setDraft] = useState('');

  const add = () => {
    const value = draft.trim();
    if (!value || items.includes(value)) return;
    onAdd(value);
    setDraft('');
  };

  return (
    <div className="card-raised" style={{ padding: 18 }}>
      <span className="card-title" style={{ display: 'block', marginBottom: 12 }}>{label}</span>
      <div style={{ display: 'flex', gap: 8, marginBottom: items.length ? 12 : 0 }}>
        <input
          className="form-input"
          placeholder={placeholder}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          style={{ flex: 1 }}
        />
        <button className="btn btn-sm" onClick={add} disabled={!draft.trim()}><i className="ph ph-plus" /> Add</button>
      </div>
      {items.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {items.map(item => (
            <span key={item} className="tag" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {item}
              <button onClick={() => onRemove(item)} style={{ background: 'none', border: 'none', color: 'var(--ink-3)', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// Colorways/sizes live on the product row as a lightweight matrix source;
// the actual SKUs are separate `product_variants` rows generated from that
// matrix, so removing a colorway/size here never silently deletes a SKU
// that's already been generated from it — variants are only ever removed
// one at a time, deliberately.
export default function SkuVariantsTab({ productId, product, brandName, onUpdateProduct }) {
  const [colorways, setColorways] = useState(product.colorways || []);
  const [sizes, setSizes] = useState(product.sizes || []);
  const [variants, setVariants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setColorways(product.colorways || []);
    setSizes(product.sizes || []);
  }, [product.id]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data, error: loadError } = await supabase
        .from('product_variants')
        .select('*')
        .eq('product_id', productId)
        .order('colorway', { ascending: true });
      if (loadError) setError(loadError.message);
      else setVariants(data || []);
      setLoading(false);
    }
    load();
  }, [productId]);

  const persistList = async (field, list, setter) => {
    setter(list);
    try {
      await onUpdateProduct({ [field]: list });
    } catch (err) {
      setError(err.message);
    }
  };

  const addColorway = name => persistList('colorways', [...colorways, name], setColorways);
  const removeColorway = name => persistList('colorways', colorways.filter(c => c !== name), setColorways);
  const addSize = name => persistList('sizes', [...sizes, name], setSizes);
  const removeSize = name => persistList('sizes', sizes.filter(s => s !== name), setSizes);

  const generateVariants = async () => {
    setError(null);
    const existing = new Set(variants.map(v => `${v.colorway}::${v.size}`));
    const rows = [];
    colorways.forEach(colorway => {
      sizes.forEach(size => {
        if (existing.has(`${colorway}::${size}`)) return;
        rows.push({
          product_id: productId,
          colorway,
          size,
          sku: generateSku({ brandName, category: product.category, productName: product.name, colorway, size }),
        });
      });
    });
    if (rows.length === 0) return;

    setGenerating(true);
    try {
      const { data, error: insertError } = await supabase.from('product_variants').insert(rows).select();
      if (insertError) throw insertError;
      setVariants(prev => [...prev, ...(data || [])].sort((a, b) => a.colorway.localeCompare(b.colorway) || a.size.localeCompare(b.size)));
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const removeVariant = async id => {
    const { error: deleteError } = await supabase.from('product_variants').delete().eq('id', id);
    if (deleteError) { setError(deleteError.message); return; }
    setVariants(prev => prev.filter(v => v.id !== id));
  };

  const missingCount = colorways.length && sizes.length
    ? colorways.length * sizes.length - variants.filter(v => colorways.includes(v.colorway) && sizes.includes(v.size)).length
    : 0;

  return (
    <div style={{ maxWidth: 1080 }}>
      {error && (
        <div className="alert" style={{ display: 'flex', gap: 10, padding: '11px 13px', borderRadius: 8, background: 'var(--red-bg)', border: '1px solid var(--red-border)', color: 'var(--red)', fontSize: 13, marginBottom: 16 }}>
          <i className="ph ph-warning" style={{ marginTop: 1 }} />
          <div>{error}</div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <ChipList label="Colorways" placeholder="e.g. Black" items={colorways} onAdd={addColorway} onRemove={removeColorway} />
        <ChipList label="Sizes" placeholder="e.g. M" items={sizes} onAdd={addSize} onRemove={removeSize} />
      </div>

      <div className="card-raised" style={{ padding: '14px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>
          {colorways.length === 0 || sizes.length === 0
            ? 'Add at least one colorway and one size to generate SKUs.'
            : missingCount === 0
              ? 'Every colorway × size combination already has a SKU.'
              : `${missingCount} combination${missingCount === 1 ? '' : 's'} missing a SKU.`}
        </div>
        <button className="btn btn-sm btn-primary" onClick={generateVariants} disabled={generating || missingCount === 0}>
          {generating ? <><i className="ph ph-spinner ph-spin" /> Generating...</> : <><i className="ph ph-grid-four" /> Generate SKUs</>}
        </button>
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-2)' }}>
              <th style={{ textAlign: 'left', padding: '12px 20px', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-3)' }}>Colorway</th>
              <th style={{ textAlign: 'left', padding: '12px 20px', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-3)' }}>Size</th>
              <th style={{ textAlign: 'left', padding: '12px 20px', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-3)' }}>SKU</th>
              <th style={{ width: '4%' }}></th>
            </tr>
          </thead>
          <tbody>
            {variants.map((v, i) => (
              <tr key={v.id} style={{ borderBottom: i < variants.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <td style={{ padding: '10px 20px' }}>{v.colorway}</td>
                <td style={{ padding: '10px 20px' }}>{v.size}</td>
                <td style={{ padding: '10px 20px', fontFamily: 'var(--mono)' }}>{v.sku}</td>
                <td style={{ padding: '10px 20px 10px 0', textAlign: 'right' }}>
                  <button onClick={() => removeVariant(v.id)} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 18, opacity: 0.6 }}>×</button>
                </td>
              </tr>
            ))}
            {!loading && variants.length === 0 && (
              <tr><td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: 'var(--ink-4)', fontStyle: 'italic', fontSize: 12.5 }}>No SKUs generated yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
