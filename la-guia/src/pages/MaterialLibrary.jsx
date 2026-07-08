import React from 'react';
import { useNavigate } from 'react-router-dom';
import { materials } from '../data/mockData.js';
import { trustTagClass } from '../lib/format.js';

export default function MaterialLibrary() {
  const navigate = useNavigate();

  return (
    <>
      <div className="topbar">
        <div className="topbar-left">
          <div>
            <div className="page-eyebrow" style={{ color: 'var(--c-materials)' }}>Materials & Production</div>
            <h1 className="page-title">Material Library</h1>
          </div>
          <div className="page-sub">Browse and search material risk reference data</div>
        </div>
      </div>

      <div className="content">
        <div className="grid-cards">
          {materials.map(m => (
            <div key={m.id} className="card-raised card-hover" style={{ padding: '16px 18px', cursor: 'pointer' }} onClick={() => navigate(`/materials/${m.id}`)}>
              <div className="corner-fold" style={{ '--fold-color': 'var(--c-materials)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{m.name}</div>
                <span className={trustTagClass(m.riskLevel === 'green' ? 'green' : m.riskLevel === 'red' ? 'red' : 'amber')}>{m.riskLevel === 'green' ? 'Low risk' : m.riskLevel === 'red' ? 'High risk' : 'Watch'}</span>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginBottom: 10 }}>{m.category}</div>
              <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6 }}>{m.warning}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
