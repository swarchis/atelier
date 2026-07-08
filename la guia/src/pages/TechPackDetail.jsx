import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { techPacks } from '../data/mockData.js';
import { riskTagClass, readinessColor, currency } from '../lib/format.js';
import { useProducts } from '../context/ProductsContext.jsx';
import FlowStepper from '../components/FlowStepper.jsx';
import TabBar from '../components/TabBar.jsx';
import EmptyState from '../components/EmptyState.jsx';

const TABS = [
  { key: 'overview', label: 'Overview', icon: 'ph-squares-four' },
  { key: 'bom', label: 'Bill of Materials', icon: 'ph-list-checks' },
  { key: 'measurements', label: 'Measurements', icon: 'ph-ruler' },
  { key: 'sampling', label: 'Sampling', icon: 'ph-scissors' },
  { key: 'readiness', label: 'Readiness', icon: 'ph-check-circle' },
];

export default function TechPackDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState('overview');
  const { products } = useProducts();
  const product = products.find(p => p.id === id);
  const tp = techPacks[id];

  // --- Interactive State ---
  const [bom, setBom] = useState(
    tp?.bom?.map((b, i) => ({ ...b, id: `bom-${i}` })) || [
      { id: 'bom-init', material: '', supplier: '', qtyPerUnit: '', unitCost: '' }
    ]
  );
  
  const [measurements, setMeasurements] = useState(
    tp?.measurements?.map((m, i) => ({ ...m, id: `meas-${i}` })) || [
      { id: 'meas-init', size: 'M', chest: '', length: '', sleeve: '' }
    ]
  );

  const [saving, setSaving] = useState(false);

  if (!product) {
    return <div className="content"><EmptyState icon="ph-magnifying-glass" title="Tech pack not found" sub="This workspace doesn't exist yet." /></div>;
  }

  // --- Handlers: BOM ---
  const updateBom = (id, field, value) => {
    setBom(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };
  const addBomRow = () => {
    setBom(prev => [...prev, { id: `bom-${Date.now()}`, material: '', supplier: '', qtyPerUnit: '', unitCost: '' }]);
  };
  const removeBomRow = (id) => {
    setBom(prev => prev.filter(item => item.id !== id));
  };

  // --- Handlers: Measurements ---
  const updateMeas = (id, field, value) => {
    setMeasurements(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };
  const addMeasRow = () => {
    setMeasurements(prev => [...prev, { id: `meas-${Date.now()}`, size: '', chest: '', length: '', sleeve: '' }]);
  };
  const removeMeasRow = (id) => {
    setMeasurements(prev => prev.filter(item => item.id !== id));
  };

  const handleSave = () => {
    setSaving(true);
    // In Phase 2, this will save to the Supabase tech_packs table
    setTimeout(() => setSaving(false), 600);
  };

  // --- Calculations ---
  const totalBomCost = bom.reduce((sum, item) => {
    const qty = parseFloat(item.qtyPerUnit) || 0;
    const cost = parseFloat(item.unitCost) || 0;
    return sum + (qty * cost);
  }, 0);

  return (
    <>
      <div className="topbar">
        <div className="topbar-left">
          <div>
            <div className="page-eyebrow" style={{ color: 'var(--c-techpack)' }}>Tech Pack</div>
            <h1 className="page-title">{product.name}</h1>
          </div>
          <div className="page-sub">{product.category}</div>
        </div>
        <div className="topbar-right">
          <span className={riskTagClass(product.risk)} style={{ marginRight: 8 }}>{product.risk}</span>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            <i className="ph ph-check" /> {saving ? 'Saving...' : 'Save Tech Pack'}
          </button>
        </div>
      </div>

      <div style={{ padding: '14px 30px 0' }}>
        <FlowStepper productId={product.id} current="techpack" />
      </div>

      <TabBar tabs={TABS} active={tab} onChange={setTab} accent="var(--c-techpack)" />

      <div className="content">
        {tab === 'overview' && (
          <>
            <div className="stats-row">
              <div className="stat-card" style={{ '--stat-accent': 'var(--c-techpack)' }}>
                <div className="stat-label">Factory readiness</div>
                <div className="stat-value" style={{ color: readinessColor(product.readiness) }}>{product.readiness}%</div>
              </div>
              <div className="stat-card" style={{ '--stat-accent': 'var(--c-materials)' }}>
                <div className="stat-label">Target Unit Cost</div>
                <div className="stat-value">{currency(totalBomCost || product.budget)}</div>
              </div>
              <div className="stat-card" style={{ '--stat-accent': 'var(--c-vendors)' }}>
                <div className="stat-label">BOM line items</div>
                <div className="stat-value">{bom.length}</div>
              </div>
              <div className="stat-card" style={{ '--stat-accent': 'var(--c-finalcheck)' }}>
                <div className="stat-label">Material warnings</div>
                <div className="stat-value" style={{ color: (tp?.materialWarnings?.length || 0) > 0 ? 'var(--amber)' : 'var(--ink)' }}>{tp?.materialWarnings?.length || 0}</div>
              </div>
            </div>
            {tp?.materialWarnings?.length > 0 && (
              <div className="card-raised" style={{ marginBottom: 20 }}>
                <div className="card-header"><span className="card-title">Production Mistake Predictor</span></div>
                <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {tp.materialWarnings.map((w, i) => (
                    <div key={i} className={`alert alert-${w.severity === 'red' ? 'red' : 'amber'}`} style={{ display: 'flex', gap: 10, padding: '12px 14px', borderRadius: 8, background: `var(--${w.severity}-bg)`, border: `1px solid var(--${w.severity}-border)`, color: `var(--${w.severity})`, fontSize: 13.5 }}>
                      <i className="ph ph-warning" style={{ marginTop: 2 }} />
                      <div><strong>{w.material}:</strong> {w.warning}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {tab === 'bom' && (
          <div className="card">
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-2)' }}>
                    <th style={{ textAlign: 'left', padding: '12px 20px', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-3)', width: '35%' }}>Material / Component</th>
                    <th style={{ textAlign: 'left', padding: '12px 20px', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-3)', width: '25%' }}>Supplier</th>
                    <th style={{ textAlign: 'right', padding: '12px 20px', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-3)', width: '12%' }}>Qty / Unit</th>
                    <th style={{ textAlign: 'right', padding: '12px 20px', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-3)', width: '12%' }}>Est. Cost</th>
                    <th style={{ textAlign: 'right', padding: '12px 20px', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-3)', width: '12%' }}>Line Total</th>
                    <th style={{ width: '4%' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {bom.map((b, i) => {
                    const lineTotal = (parseFloat(b.qtyPerUnit) || 0) * (parseFloat(b.unitCost) || 0);
                    return (
                      <tr key={b.id} style={{ borderBottom: i < bom.length - 1 ? '1px solid var(--border)' : 'none', transition: 'background 0.1s' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <td style={{ padding: '8px 20px' }}>
                          <input className="form-input" style={{ padding: '8px 12px', fontSize: 13 }} placeholder="e.g. 14oz Heavyweight Cotton" value={b.material} onChange={e => updateBom(b.id, 'material', e.target.value)} />
                        </td>
                        <td style={{ padding: '8px 20px' }}>
                          <input className="form-input" style={{ padding: '8px 12px', fontSize: 13 }} placeholder="Supplier name" value={b.supplier} onChange={e => updateBom(b.id, 'supplier', e.target.value)} />
                        </td>
                        <td style={{ padding: '8px 20px' }}>
                          <input className="form-input" type="number" style={{ padding: '8px 12px', fontSize: 13, fontFamily: 'var(--mono)', textAlign: 'right' }} placeholder="1.5" value={b.qtyPerUnit} onChange={e => updateBom(b.id, 'qtyPerUnit', e.target.value)} />
                        </td>
                        <td style={{ padding: '8px 20px', position: 'relative' }}>
                          <span style={{ position: 'absolute', left: 28, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-4)', zIndex: 1 }}>$</span>
                          <input className="form-input" type="number" style={{ padding: '8px 12px 8px 20px', fontSize: 13, fontFamily: 'var(--mono)', textAlign: 'right' }} placeholder="0.00" value={b.unitCost} onChange={e => updateBom(b.id, 'unitCost', e.target.value)} />
                        </td>
                        <td style={{ padding: '8px 20px', textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: 600, color: 'var(--ink)' }}>
                          {currency(lineTotal)}
                        </td>
                        <td style={{ padding: '8px 20px 8px 0', textAlign: 'right' }}>
                          <button onClick={() => removeBomRow(b.id)} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 18, opacity: 0.6 }} title="Remove item">×</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: 'var(--bg-3)', borderTop: '2px solid var(--border)' }}>
                    <td colSpan="4" style={{ padding: '12px 20px', textAlign: 'right', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Estimated Total BOM Cost</td>
                    <td style={{ padding: '12px 20px', textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 16, color: 'var(--c-techpack)' }}>{currency(totalBomCost)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)' }}>
              <button className="btn btn-sm" onClick={addBomRow}><i className="ph ph-plus" /> Add Material</button>
            </div>
          </div>
        )}

        {tab === 'measurements' && (
          <div className="card" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-2)' }}>
                  <th style={{ textAlign: 'left', padding: '12px 20px', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-3)', width: '20%' }}>Size (Grade)</th>
                  <th style={{ textAlign: 'left', padding: '12px 20px', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-3)', width: '25%' }}>Chest (in)</th>
                  <th style={{ textAlign: 'left', padding: '12px 20px', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-3)', width: '25%' }}>Length (in)</th>
                  <th style={{ textAlign: 'left', padding: '12px 20px', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-3)', width: '25%' }}>Sleeve (in)</th>
                  <th style={{ width: '5%' }}></th>
                </tr>
              </thead>
              <tbody>
                {measurements.map((m, i) => (
                  <tr key={m.id} style={{ borderBottom: i < measurements.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <td style={{ padding: '8px 20px' }}>
                      <input className="form-input" style={{ padding: '8px 12px', fontSize: 13, fontWeight: 600 }} placeholder="e.g. Medium" value={m.size} onChange={e => updateMeas(m.id, 'size', e.target.value)} />
                    </td>
                    <td style={{ padding: '8px 20px' }}>
                      <input className="form-input" style={{ padding: '8px 12px', fontSize: 13, fontFamily: 'var(--mono)' }} placeholder='22.5"' value={m.chest} onChange={e => updateMeas(m.id, 'chest', e.target.value)} />
                    </td>
                    <td style={{ padding: '8px 20px' }}>
                      <input className="form-input" style={{ padding: '8px 12px', fontSize: 13, fontFamily: 'var(--mono)' }} placeholder='28"' value={m.length} onChange={e => updateMeas(m.id, 'length', e.target.value)} />
                    </td>
                    <td style={{ padding: '8px 20px' }}>
                      <input className="form-input" style={{ padding: '8px 12px', fontSize: 13, fontFamily: 'var(--mono)' }} placeholder='25"' value={m.sleeve} onChange={e => updateMeas(m.id, 'sleeve', e.target.value)} />
                    </td>
                    <td style={{ padding: '8px 20px 8px 0', textAlign: 'right' }}>
                      <button onClick={() => removeMeasRow(m.id)} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 18, opacity: 0.6 }} title="Remove size">×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)' }}>
              <button className="btn btn-sm" onClick={addMeasRow}><i className="ph ph-plus" /> Add Size</button>
            </div>
          </div>
        )}

        {tab === 'sampling' && (
          tp?.samplingRounds?.length ? (
            <div className="card">
              {tp.samplingRounds.map((r, i) => (
                <div className="list-row" key={i}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>Round {r.round} · {r.type}</div>
                    {r.notes && <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{r.notes}</div>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 12, color: 'var(--ink-3)', fontFamily: 'var(--mono)' }}>{r.date}</span>
                    <span className={r.status === 'Approved' ? 'tag tag-green' : r.status === 'Revision requested' ? 'tag tag-amber' : 'tag tag-blue'}>{r.status}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : <EmptyState icon="ph-scissors" title="No samples logged" color="var(--c-materials)" sub="Track proto → fit → revised → size set → pre-production here, with a full revision memory log." />
        )}

        {tab === 'readiness' && (
          <>
            <div className="card-raised" style={{ marginBottom: 20 }}>
              <div className="card-header"><span className="card-title">Factory Readiness Score</span></div>
              <div className="card-body">
                <div className="readiness" style={{ marginBottom: 6 }}>
                  <div className="readiness-track" style={{ height: 10 }}>
                    <div className="readiness-fill" style={{ width: `${product.readiness}%`, background: readinessColor(product.readiness) }} />
                    <div className="readiness-gate" style={{ left: '80%', height: 16, top: -3 }} />
                  </div>
                  <span className="readiness-value" style={{ fontSize: 18 }}>{product.readiness}%</span>
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>Gate clears at 80% — below that, sending an RFQ requires an explicit override.</div>
              </div>
            </div>
            {tp?.readinessChecklist ? (
              <div className="card">
                {tp.readinessChecklist.map((c, i) => (
                  <div className="list-row" key={i}>
                    <span style={{ fontSize: 13.5 }}>{c.item}</span>
                    {c.status === 'done'
                      ? <span className="tag tag-green"><i className="ph ph-check" style={{ marginRight: 4 }} />Done</span>
                      : <span className="tag tag-amber"><i className="ph ph-clock" style={{ marginRight: 4 }} />Pending</span>}
                  </div>
                ))}
              </div>
            ) : <EmptyState icon="ph-check-circle" color="var(--c-finalcheck)" title="No readiness checklist yet" sub="The final pre-production validation checklist appears here before this tech pack can go to a vendor." />}
            <button className="btn btn-primary" style={{ marginTop: 20, opacity: product.readiness >= 80 ? 1 : 0.55 }} onClick={() => navigate('/vendors')}>
              <i className="ph ph-paper-plane-tilt" /> {product.readiness >= 80 ? 'Send to vendor' : 'Override & send anyway'}
            </button>
          </>
        )}
      </div>
    </>
  );
}