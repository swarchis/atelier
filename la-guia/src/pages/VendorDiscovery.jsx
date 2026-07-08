import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { vendors, TRUST_LABELS } from '../data/mockData.js';
import { trustTagClass } from '../lib/format.js';
import TabBar from '../components/TabBar.jsx';

const TABS = [
  { key: 'discover', label: 'Discover & Compare', icon: 'ph-magnifying-glass' },
  { key: 'saved', label: 'Saved Vendors', icon: 'ph-star' },
];

function VendorRow({ v, onClick }) {
  return (
    <div className="list-row" style={{ cursor: 'pointer' }} onClick={onClick}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--accent-bg)', color: 'var(--c-vendors)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <i className="ph ph-buildings" style={{ fontSize: 17 }} />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{v.name}</div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{v.category} · {v.location}</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {v.rating && <span style={{ fontSize: 12.5, fontFamily: 'var(--mono)', color: 'var(--ink-2)' }}><i className="ph-fill ph-star" style={{ color: 'var(--c-vendors)', marginRight: 3 }} />{v.rating}</span>}
        <span className={trustTagClass(TRUST_LABELS.find(t => t.label === v.label)?.tone)}>{v.label}</span>
      </div>
    </div>
  );
}

export default function VendorDiscovery() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('discover');
  const [mode, setMode] = useState('search');
  const saved = vendors.filter(v => v.quoteHistory > 0);

  return (
    <>
      <div className="topbar">
        <div className="topbar-left">
          <div>
            <div className="page-eyebrow" style={{ color: 'var(--c-vendors)' }}>Vendors</div>
            <h1 className="page-title">Vendor Hub</h1>
          </div>
          <div className="page-sub">Private workspace — nothing here is presented as officially vetted unless labeled so</div>
        </div>
      </div>

      <TabBar tabs={TABS} active={tab} onChange={setTab} accent="var(--c-vendors)" />

      <div className="content">
        {tab === 'discover' && (
          <>
            <div className="pill-group" style={{ marginBottom: 20 }}>
              <button className={`pill ${mode === 'search' ? 'active' : ''}`} onClick={() => setMode('search')}>Search</button>
              <button className={`pill ${mode === 'import' ? 'active' : ''}`} onClick={() => setMode('import')}>Import</button>
            </div>

            {mode === 'import' ? (
              <div className="card-raised" style={{ marginBottom: 24 }}>
                <div className="card-body">
                  <div className="form-group" style={{ marginBottom: 12 }}>
                    <label className="form-label">Paste a link, email, or vendor page</label>
                    <input className="form-input" placeholder="e.g. alibaba.com/... or a forwarded vendor email" disabled />
                    <div className="form-hint">A private vendor profile gets created from whatever you paste — nothing is published or shared.</div>
                  </div>
                  <button className="btn btn-primary" disabled style={{ opacity: 0.6 }}><i className="ph ph-plus" /> Import vendor</button>
                </div>
              </div>
            ) : (
              <div className="card-raised" style={{ marginBottom: 24 }}>
                <div className="card-body">
                  <div className="grid-3">
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Category</label>
                      <select className="form-select" disabled><option>Any category</option></select>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Location</label>
                      <select className="form-select" disabled><option>Any location</option></select>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Max MOQ</label>
                      <input className="form-input" placeholder="e.g. 500 units" disabled />
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="section-label">All vendors</div>
            <div className="card" style={{ marginBottom: 24 }}>
              {vendors.map(v => <VendorRow key={v.id} v={v} onClick={() => navigate(`/vendors/${v.id}`)} />)}
            </div>

            <div className="section-label">Trust labels</div>
            <div className="card-raised">
              <div className="card-body" style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {TRUST_LABELS.map(t => <span key={t.label} className={trustTagClass(t.tone)}>{t.label}</span>)}
              </div>
            </div>
          </>
        )}

        {tab === 'saved' && (
          <div className="card">
            {saved.map(v => <VendorRow key={v.id} v={v} onClick={() => navigate(`/vendors/${v.id}`)} />)}
          </div>
        )}
      </div>
    </>
  );
}
