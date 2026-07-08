import React, { useState } from 'react';
import { brands, activeBrandId, RISK_LEVELS } from '../data/mockData.js';
import TabBar from '../components/TabBar.jsx';

const TABS = [
  { key: 'profile', label: 'Profile', icon: 'ph-user-circle' },
  { key: 'brand', label: 'Brand Details', icon: 'ph-storefront' },
  { key: 'billing', label: 'Billing & Plan', icon: 'ph-credit-card' },
  { key: 'notifications', label: 'Notifications', icon: 'ph-bell' },
  { key: 'risk', label: 'Risk Tolerance', icon: 'ph-gauge' },
];

function Toggle({ defaultOn = true }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <button
      onClick={() => setOn(o => !o)}
      style={{
        width: 38, height: 22, borderRadius: 99, border: 'none', cursor: 'pointer', position: 'relative',
        background: on ? 'var(--accent)' : 'var(--bg-3)', transition: 'background 0.15s', flexShrink: 0,
      }}
    >
      <span style={{ position: 'absolute', top: 3, left: on ? 19 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.15s', boxShadow: '0 1px 3px rgba(0,0,0,0.25)' }} />
    </button>
  );
}

export default function Settings() {
  const [tab, setTab] = useState('profile');
  const brand = brands.find(b => b.id === activeBrandId);
  const [risk, setRisk] = useState(brand.globalRisk);

  return (
    <>
      <div className="topbar">
        <div className="topbar-left">
          <div>
            <div className="page-eyebrow" style={{ color: 'var(--c-settings)' }}>Profile & Settings</div>
            <h1 className="page-title">Settings</h1>
          </div>
        </div>
        <div className="topbar-right">
          <button className="btn btn-primary"><i className="ph ph-check" /> Save</button>
        </div>
      </div>

      <TabBar tabs={TABS} active={tab} onChange={setTab} accent="var(--c-settings)" />

      <div className="content">
        {tab === 'profile' && (
          <div className="card-raised" style={{ maxWidth: 520 }}>
            <div className="card-header"><span className="card-title">Account summary</span></div>
            <div className="card-body">
              <div className="list-row" style={{ padding: '10px 0' }}><span>Name</span><strong>Founder workspace</strong></div>
              <div className="list-row" style={{ padding: '10px 0' }}><span>Role</span><strong>Owner</strong></div>
              <div className="list-row" style={{ padding: '10px 0' }}><span>Member since</span><strong>Jan 2026</strong></div>
              <div className="list-row" style={{ padding: '10px 0' }}><span>Active brands</span><strong>{brands.length}</strong></div>
            </div>
          </div>
        )}

        {tab === 'brand' && (
          <div className="grid-2">
            <div className="card-raised">
              <div className="card-header"><span className="card-title">Identity</span></div>
              <div className="card-body">
                <div className="form-group"><label className="form-label">Brand name</label><input className="form-input" defaultValue={brand.name} /></div>
                <div className="form-group"><label className="form-label">Target customer</label><textarea className="form-textarea" defaultValue={brand.targetCustomer} /></div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Quality tier</label>
                  <select className="form-select" defaultValue={brand.qualityTier}>
                    <option>Value / accessible</option><option>Premium contemporary</option><option>Luxury / made-to-order</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="card-raised">
              <div className="card-header"><span className="card-title">Production philosophy</span></div>
              <div className="card-body">
                <div className="form-group"><label className="form-label">Budget philosophy</label><textarea className="form-textarea" defaultValue={brand.budgetPhilosophy} /></div>
                <div className="form-group"><label className="form-label">Sustainability preferences</label><input className="form-input" defaultValue={brand.sustainability} /></div>
                <div className="form-group" style={{ marginBottom: 0 }}><label className="form-label">Manufacturer preferences</label><input className="form-input" defaultValue={brand.manufacturerPreferences} /></div>
              </div>
            </div>
          </div>
        )}

        {tab === 'billing' && (
          <div className="card-raised" style={{ maxWidth: 520 }}>
            <div className="card-header"><span className="card-title">Current plan</span></div>
            <div className="card-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 600 }}>Founder Trial</div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>14 days remaining</div>
                </div>
                <span className="tag tag-accent">Trial</span>
              </div>
              <button className="btn btn-primary">Upgrade plan</button>
            </div>
          </div>
        )}

        {tab === 'notifications' && (
          <div className="card" style={{ maxWidth: 520 }}>
            {['Readiness score changes', 'Vendor quote received', 'Material price alerts', 'Timeline conflicts'].map(label => (
              <div className="list-row" key={label}><span style={{ fontSize: 13.5 }}>{label}</span><Toggle /></div>
            ))}
          </div>
        )}

        {tab === 'risk' && (
          <div className="card-raised" style={{ maxWidth: 560 }}>
            <div className="card-header"><span className="card-title">Global risk setting</span></div>
            <div className="card-body">
              <p style={{ fontSize: 13.5, color: 'var(--ink-3)', marginBottom: 16, lineHeight: 1.7 }}>
                Applied as the default to every new product workspace. Editing a specific product's risk setting
                overrides it locally — it never changes this default or any other product.
              </p>
              <div className="pill-group">
                {RISK_LEVELS.map(level => (
                  <button key={level} className={`pill ${risk === level ? 'active' : ''}`} data-risk={level} onClick={() => setRisk(level)}>{level}</button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
