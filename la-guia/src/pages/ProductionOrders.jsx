import React from 'react';
import { useNavigate } from 'react-router-dom';
import { productionOrders } from '../data/mockData.js';

const STAGE_TAG = { Sampling: 'tag-blue', 'In production': 'tag-amber', Shipped: 'tag-accent', Delivered: 'tag-green' };

export default function ProductionOrders() {
  const navigate = useNavigate();

  return (
    <>
      <div className="topbar">
        <div className="topbar-left">
          <div>
            <div className="page-eyebrow" style={{ color: 'var(--c-materials)' }}>Materials & Production</div>
            <h1 className="page-title">Production Orders</h1>
          </div>
          <div className="page-sub">Every active and past production order</div>
        </div>
      </div>

      <div className="content">
        <div className="card">
          {productionOrders.map(o => (
            <div className="list-row" key={o.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/production/${o.id}`)}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{o.productName}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{o.vendorName} · {o.poNumber}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>{o.units || '—'} units</span>
                <span style={{ fontSize: 12, color: 'var(--ink-3)', fontFamily: 'var(--mono)' }}>Due {o.dueDate}</span>
                <span className={`tag ${STAGE_TAG[o.stage]}`}>{o.stage}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
