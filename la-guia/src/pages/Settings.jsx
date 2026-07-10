import React, { useState, useEffect } from 'react';
import TabBar from '../components/TabBar.jsx';
import { useProducts } from '../context/ProductsContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const TABS = [
  { key: 'profile', label: 'Profile', icon: 'ph-user-circle' },
  { key: 'brand', label: 'Brand Details', icon: 'ph-storefront' },
  { key: 'billing', label: 'Billing & Plan', icon: 'ph-credit-card' },
  { key: 'notifications', label: 'Notifications', icon: 'ph-bell' },
  { key: 'risk', label: 'Risk Tolerance', icon: 'ph-gauge' },
];

const RISK_LEVELS = ['Conservative', 'Balanced', 'Aggressive'];

function Toggle({ on, onToggle }) {
  return (
    <button
      onClick={onToggle}
      style={{
        width: 38, height: 22, borderRadius: 99, border: 'none', cursor: 'pointer', position: 'relative',
        background: on ? 'var(--accent)' : 'var(--bg-3)', transition: 'background 0.15s', flexShrink: 0,
      }}
    >
      <span style={{ 
        position: 'absolute', top: 3, left: on ? 19 : 3, 
        width: 16, height: 16, borderRadius: '50%', 
        background: '#fff', transition: 'left 0.15s', 
        boxShadow: '0 1px 3px rgba(0,0,0,0.25)' 
      }} />
    </button>
  );
}

export default function Settings() {
  const [tab, setTab] = useState('profile');
  const { activeBrand, updateBrand } = useProducts();
  const { user } = useAuth();
  
  const [saving, setSaving] = useState(false);
  
  // Unified Form State for all database columns
  const [form, setForm] = useState({
    name: '',
    target_customer: '',
    quality_tier: 'Premium contemporary',
    budget_philosophy: '',
    sustainability: '',
    manufacturer_preferences: '',
    global_risk: 'Balanced',
    notification_settings: {
      readiness: true,
      quotes: true,
      materials: true,
      timeline: true
    }
  });

  // Sync state when activeBrand loads or changes
  useEffect(() => {
    if (activeBrand) {
      setForm({
        name: activeBrand.name || '',
        target_customer: activeBrand.target_customer || '',
        quality_tier: activeBrand.quality_tier || 'Premium contemporary',
        budget_philosophy: activeBrand.budget_philosophy || '',
        sustainability: activeBrand.sustainability || '',
        manufacturer_preferences: activeBrand.manufacturer_preferences || '',
        global_risk: activeBrand.global_risk || 'Balanced',
        notification_settings: activeBrand.notification_settings || {
          readiness: true,
          quotes: true,
          materials: true,
          timeline: true
        }
      });
    }
  }, [activeBrand]);

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  // Helper to toggle specific notification keys
  const toggleNotification = (key) => {
    const nextSettings = { ...form.notification_settings, [key]: !form.notification_settings[key] };
    f('notification_settings', nextSettings);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateBrand(form);
      alert("✓ Brand settings successfully updated.");
    } catch (err) {
      alert("Failed to save settings: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!activeBrand) return (
    <div className="content" style={{ textAlign: 'center', padding: 40 }}>
      <i className="ph ph-spinner ph-spin" style={{ fontSize: 24 }} />
    </div>
  );

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
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            <i className="ph ph-check" /> {saving ? 'Saving...' : 'Save All Changes'}
          </button>
        </div>
      </div>

      <TabBar tabs={TABS} active={tab} onChange={setTab} accent="var(--c-settings)" />

      <div className="content">
        {tab === 'profile' && (
          <div className="card-raised" style={{ maxWidth: 520 }}>
            <div className="card-header"><span className="card-title">Account summary</span></div>
            <div className="card-body">
              <div className="list-row" style={{ padding: '10px 0' }}><span>Email</span><strong>{user?.email}</strong></div>
              <div className="list-row" style={{ padding: '10px 0' }}><span>Role</span><strong>Owner</strong></div>
              <div className="list-row" style={{ padding: '10px 0' }}><span>Member since</span><strong>{new Date(user?.created_at || Date.now()).toLocaleDateString()}</strong></div>
              <div className="list-row" style={{ padding: '10px 0' }}><span>Active brand</span><strong>{activeBrand.name}</strong></div>
            </div>
          </div>
        )}

        {tab === 'brand' && (
          <div className="grid-2">
            <div className="card-raised">
              <div className="card-header"><span className="card-title">Identity</span></div>
              <div className="card-body">
                <div className="form-group">
                  <label className="form-label">Brand name</label>
                  <input className="form-input" value={form.name} onChange={e => f('name', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Target customer</label>
                  <textarea className="form-textarea" value={form.target_customer} onChange={e => f('target_customer', e.target.value)} placeholder="e.g. Gen Z streetwear enthusiasts looking for heavyweight basics." />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Quality tier</label>
                  <select className="form-select" value={form.quality_tier} onChange={e => f('quality_tier', e.target.value)}>
                    <option value="Value / accessible">Value / accessible</option>
                    <option value="Premium contemporary">Premium contemporary</option>
                    <option value="Luxury / made-to-order">Luxury / made-to-order</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="card-raised">
              <div className="card-header"><span className="card-title">Production philosophy</span></div>
              <div className="card-body">
                <div className="form-group">
                  <label className="form-label">Budget philosophy</label>
                  <textarea className="form-textarea" value={form.budget_philosophy} onChange={e => f('budget_philosophy', e.target.value)} placeholder="e.g. Willing to pay more for higher MOQ if quality is unmatched." />
                </div>
                <div className="form-group">
                  <label className="form-label">Sustainability preferences</label>
                  <input className="form-input" value={form.sustainability} onChange={e => f('sustainability', e.target.value)} placeholder="e.g. Requires GOTS certified cotton." />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Manufacturer preferences</label>
                  <input className="form-input" value={form.manufacturer_preferences} onChange={e => f('manufacturer_preferences', e.target.value)} placeholder="e.g. Strong preference for Portugal or Italy." />
                </div>
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
                  <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{Math.max(0, 14 - Math.floor((new Date() - new Date(user?.created_at)) / (1000 * 60 * 60 * 24)))} days remaining</div>
                </div>
                <span className="tag tag-accent">Trial</span>
              </div>
              <button className="btn btn-primary" disabled style={{ opacity: 0.6, cursor: 'not-allowed' }}>Billing coming soon</button>
            </div>
          </div>
        )}

        {tab === 'notifications' && (
          <div className="card" style={{ maxWidth: 520 }}>
            <div className="list-row">
              <span style={{ fontSize: 13.5 }}>Readiness score changes</span>
              <Toggle on={form.notification_settings.readiness} onToggle={() => toggleNotification('readiness')} />
            </div>
            <div className="list-row">
              <span style={{ fontSize: 13.5 }}>Vendor quote received</span>
              <Toggle on={form.notification_settings.quotes} onToggle={() => toggleNotification('quotes')} />
            </div>
            <div className="list-row">
              <span style={{ fontSize: 13.5 }}>Material price alerts</span>
              <Toggle on={form.notification_settings.materials} onToggle={() => toggleNotification('materials')} />
            </div>
            <div className="list-row">
              <span style={{ fontSize: 13.5 }}>Timeline conflicts</span>
              <Toggle on={form.notification_settings.timeline} onToggle={() => toggleNotification('timeline')} />
            </div>
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
                  <button 
                    key={level} 
                    className={`pill ${form.global_risk === level ? 'active' : ''}`} 
                    data-risk={level} 
                    onClick={() => f('global_risk', level)}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}