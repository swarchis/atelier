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

  if (!product) {
    return <div className="content"><EmptyState icon="ph-magnifying-glass" title="Tech pack not found" sub="This workspace doesn't exist yet." /></div>;
  }

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
          <span className={riskTagClass(product.risk)}>{product.risk}</span>
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
                <div className="stat-label">Budget</div>
                <div className="stat-value">{currency(product.budget)}</div>
              </div>
              <div className="stat-card" style={{ '--stat-accent': 'var(--c-vendors)' }}>
                <div className="stat-label">BOM line items</div>
                <div className="stat-value">{tp?.bom?.length || 0}</div>
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
          tp?.bom?.length ? (
            <div className="card">
              {tp.bom.map((b, i) => (
                <div className="list-row" key={i}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{b.material}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>Supplier: {b.supplier}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 24, fontFamily: 'var(--mono)', fontSize: 13 }}>
                    <span>{b.qtyPerUnit} / unit</span>
                    <span style={{ minWidth: 60, textAlign: 'right' }}>${b.unitCost.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : <EmptyState icon="ph-list-checks" title="No BOM yet" color="var(--c-techpack)" sub="Add, edit, and remove bill-of-materials line items here once sourcing begins." />
        )}

        {tab === 'measurements' && (
          tp?.measurements?.length ? (
            <div className="card" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Size', 'Chest', 'Length', 'Sleeve'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '12px 20px', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-3)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tp.measurements.map((m, i) => (
                    <tr key={i} style={{ borderBottom: i < tp.measurements.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <td style={{ padding: '12px 20px', fontWeight: 600 }}>{m.size}</td>
                      <td style={{ padding: '12px 20px', fontFamily: 'var(--mono)' }}>{m.chest}</td>
                      <td style={{ padding: '12px 20px', fontFamily: 'var(--mono)' }}>{m.length}</td>
                      <td style={{ padding: '12px 20px', fontFamily: 'var(--mono)' }}>{m.sleeve}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <EmptyState icon="ph-ruler" title="No graded measurements yet" color="var(--c-techpack)" sub="Edit graded measurements across every size once the fit block is confirmed." />
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
