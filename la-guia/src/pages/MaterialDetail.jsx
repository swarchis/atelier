import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { trustTagClass } from '../lib/format.js';
import EmptyState from '../components/EmptyState.jsx';
import { PhotoPanel } from '../components/decor.jsx';

const TONE_BY_RISK = { green: 'sage', amber: 'gold', red: 'clay' };

export default function MaterialDetail() {
  const { id } = useParams();
  const [material, setMaterial] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadMaterial() {
      const { data, error } = await supabase
        .from('materials')
        .select('*')
        .eq('id', id)
        .single();
      
      if (!error) setMaterial(data);
      setLoading(false);
    }
    loadMaterial();
  }, [id]);

  if (loading) return <div className="content" style={{ textAlign: 'center' }}><i className="ph ph-circle-notch ph-spin" /></div>;

  if (!material) {
    return <div className="content"><EmptyState icon="ph-magnifying-glass" title="Material not found" sub="This material isn't in the library yet." /></div>;
  }

  return (
    <>
      <div className="topbar">
        <div className="topbar-left">
          <div>
            <div className="page-eyebrow" style={{ color: 'var(--c-materials)' }}>Material Intelligence</div>
            <h1 className="page-title">{material.name}</h1>
          </div>
          <div className="page-sub">{material.category}</div>
        </div>
        <div className="topbar-right">
          <span className={trustTagClass(material.risk_level)}>
            {material.risk_level === 'green' ? 'Low risk' : material.risk_level === 'red' ? 'High risk' : 'Watch'}
          </span>
        </div>
      </div>

      <div className="content">
        <PhotoPanel variant="weave" tone={TONE_BY_RISK[material.risk_level] || 'gold'} aspect="21 / 5" label={material.name} icon="ph-flask" style={{ marginBottom: 20 }} />

        <div className="grid-2">
            <div className="card-raised" style={{ marginBottom: 20 }}>
                <div className="card-header"><span className="card-title">Production Warning</span></div>
                <div className="card-body">
                    <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--ink)' }}>{material.warning}</p>
                </div>
            </div>

            <div className="card-raised" style={{ marginBottom: 20 }}>
                <div className="card-header"><span className="card-title">Handling Notes</span></div>
                <div className="card-body">
                    <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--ink-2)' }}>{material.handling_notes || 'No specific handling notes on file.'}</p>
                </div>
            </div>
        </div>

        <div className="section-label">Usage Analysis</div>
        <div className="card-raised" style={{ padding: 20, textAlign: 'center', color: 'var(--ink-3)' }}>
            <i className="ph ph-chart-pie" style={{ fontSize: 24, marginBottom: 8, display: 'block' }} />
            Cross-product usage tracking coming in Phase 4.
        </div>
      </div>
    </>
  );
}