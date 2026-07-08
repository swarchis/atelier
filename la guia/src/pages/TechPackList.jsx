import React from 'react';
import { useNavigate } from 'react-router-dom';
import { techPacks } from '../data/mockData.js';
import { readinessColor, riskTagClass, swatchGradient } from '../lib/format.js';
import { useProducts } from '../context/ProductsContext.jsx';

export default function TechPackList() {
  const navigate = useNavigate();
  const { products } = useProducts();
  const items = products.filter(p => ['techpack', 'sourcing', 'sampling', 'production', 'launched'].includes(p.stage));

  return (
    <>
      <div className="topbar">
        <div className="topbar-left">
          <div>
            <div className="page-eyebrow" style={{ color: 'var(--c-techpack)' }}>Tech Packs</div>
            <h1 className="page-title">Tech Pack List</h1>
          </div>
          <div className="page-sub">{items.length} tech packs across every design</div>
        </div>
      </div>

      <div className="content">
        <div className="grid-cards">
          {items.map(p => {
            const tp = techPacks[p.id];
            const warnings = tp?.materialWarnings?.length || 0;
            return (
              <div key={p.id} className="card-raised card-hover" style={{ padding: '16px 18px', cursor: 'pointer' }} onClick={() => navigate(`/tech-packs/${p.id}`)}>
                <div className="corner-fold" style={{ '--fold-color': 'var(--c-techpack)' }} />
                <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
                  <div className="swatch" style={{ background: swatchGradient(p.id) }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{p.name}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>{p.category}</div>
                  </div>
                </div>
                <div className="readiness" style={{ marginBottom: 10 }}>
                  <div className="readiness-track">
                    <div className="readiness-fill" style={{ width: `${p.readiness}%`, background: readinessColor(p.readiness) }} />
                    <div className="readiness-gate" style={{ left: '80%' }} />
                  </div>
                  <span className="readiness-value">{p.readiness}%</span>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <span className={riskTagClass(p.risk)}>{p.risk}</span>
                  {warnings > 0 && <span className="tag tag-amber"><i className="ph ph-warning" style={{ marginRight: 4 }} />{warnings} material warning{warnings > 1 ? 's' : ''}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
