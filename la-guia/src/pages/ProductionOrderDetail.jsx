import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { productionOrders } from '../data/mockData.js';
import FlowStepper from '../components/FlowStepper.jsx';
import EmptyState from '../components/EmptyState.jsx';

const CHECKLIST = ['Cutting', 'Sewing', 'Quality control', 'Packing', 'Shipping'];
const STAGE_INDEX = { Sampling: -1, 'In production': 1, Shipped: 4, Delivered: 5 };

export default function ProductionOrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const order = productionOrders.find(o => String(o.id) === id);

  if (!order) {
    return <div className="content"><EmptyState icon="ph-magnifying-glass" title="Production order not found" sub="This order doesn't exist yet." /></div>;
  }

  const doneIndex = STAGE_INDEX[order.stage] ?? -1;

  return (
    <>
      <div className="topbar">
        <div className="topbar-left">
          <div>
            <div className="page-eyebrow" style={{ color: 'var(--c-materials)' }}>Production Order</div>
            <h1 className="page-title">{order.productName}</h1>
          </div>
          <div className="page-sub">{order.poNumber} · {order.vendorName}</div>
        </div>
        <div className="topbar-right">
          <button className="btn btn-sm" onClick={() => navigate(`/tech-packs/${order.productId}`)}><i className="ph ph-scissors" /> Sampling log</button>
        </div>
      </div>

      <div style={{ padding: '14px 30px 0' }}>
        <FlowStepper productId={order.productId} current="production" />
      </div>

      <div className="content">
        <div className="stats-row">
          <div className="stat-card" style={{ '--stat-accent': 'var(--c-materials)' }}>
            <div className="stat-label">Stage</div>
            <div className="stat-value" style={{ fontSize: 19 }}>{order.stage}</div>
          </div>
          <div className="stat-card" style={{ '--stat-accent': 'var(--c-materials)' }}>
            <div className="stat-label">Units</div>
            <div className="stat-value">{order.units || '—'}</div>
          </div>
          <div className="stat-card" style={{ '--stat-accent': 'var(--c-materials)' }}>
            <div className="stat-label">Due date</div>
            <div className="stat-value" style={{ fontSize: 19 }}>{order.dueDate}</div>
          </div>
          <div className="stat-card" style={{ '--stat-accent': 'var(--c-materials)' }}>
            <div className="stat-label">Vendor</div>
            <div className="stat-value" style={{ fontSize: 15 }}>{order.vendorName}</div>
          </div>
        </div>

        <div className="section-label">Production checklist</div>
        <div className="card">
          {CHECKLIST.map((item, i) => (
            <div className="list-row" key={item}>
              <span style={{ fontSize: 13.5 }}>{item}</span>
              {i <= doneIndex
                ? <span className="tag tag-green"><i className="ph ph-check" style={{ marginRight: 4 }} />Done</span>
                : <span className="tag tag-neutral">Pending</span>}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
