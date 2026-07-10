import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProduction } from '../context/ProductionContext.jsx';
import FlowStepper from '../components/FlowStepper.jsx';
import EmptyState from '../components/EmptyState.jsx';

export default function ProductionOrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  // Bring in the real production data
  const { orders, loading, updateOrder, updateOrderStage } = useProduction();
  const [updating, setUpdating] = useState(false);

  const order = orders.find(o => String(o.id) === id);

  if (loading) {
    return <div className="content" style={{ textAlign: 'center', padding: 40 }}><i className="ph ph-circle-notch ph-spin" /></div>;
  }

  if (!order) {
    return <div className="content"><EmptyState icon="ph-magnifying-glass" title="Production order not found" sub="This order doesn't exist yet." /></div>;
  }

  // Safely extract joined relational data
  const productName = order.products?.name || 'Unknown Product';
  const vendorName = order.vendors?.name || 'Unknown Vendor';
  const checkpoints = order.checkpoints || [];

  // Handle checking off items in the production flow
  const toggleCheckpoint = async (index) => {
    if (updating) return;
    setUpdating(true);
    try {
      const newCheckpoints = [...checkpoints];
      newCheckpoints[index].status = newCheckpoints[index].status === 'done' ? 'pending' : 'done';
      await updateOrder(order.id, { checkpoints: newCheckpoints });
    } catch (err) {
      alert("Could not update checklist: " + err.message);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <>
      <div className="topbar">
        <div className="topbar-left">
          <div>
            <div className="page-eyebrow" style={{ color: 'var(--c-materials)' }}>Production Order</div>
            <h1 className="page-title">{productName}</h1>
          </div>
          <div className="page-sub">{order.po_number || 'No PO Number'} · {vendorName}</div>
        </div>
        <div className="topbar-right">
          <button className="btn btn-sm" onClick={() => navigate(`/tech-packs/${order.product_id}`)}>
            <i className="ph ph-scissors" /> Sampling log
          </button>
        </div>
      </div>

      <div style={{ padding: '14px 30px 0' }}>
        <FlowStepper productId={order.product_id} current="production" />
      </div>

      <div className="content">
        <div className="stats-row">
          <div className="stat-card" style={{ '--stat-accent': 'var(--c-materials)' }}>
            <div className="stat-label">Stage</div>
            <div className="stat-value" style={{ fontSize: 19 }}>
              <select 
                className="form-select" 
                style={{ fontSize: 16, padding: '4px 28px 4px 8px', border: 'none', background: 'transparent', boxShadow: 'none', margin: '-4px 0 0 -8px', cursor: 'pointer', fontWeight: 600, color: 'var(--ink)' }}
                value={order.stage}
                onChange={(e) => updateOrderStage(order.id, e.target.value)}
                disabled={updating}
              >
                <option value="Sampling">Sampling</option>
                <option value="In production">In production</option>
                <option value="Shipped">Shipped</option>
                <option value="Delivered">Delivered</option>
              </select>
            </div>
          </div>
          <div className="stat-card" style={{ '--stat-accent': 'var(--c-materials)' }}>
            <div className="stat-label">Units</div>
            <div className="stat-value">{order.units || '—'}</div>
          </div>
          <div className="stat-card" style={{ '--stat-accent': 'var(--c-materials)' }}>
            <div className="stat-label">Due date</div>
            <div className="stat-value" style={{ fontSize: 19 }}>{order.due_date || '—'}</div>
          </div>
          <div className="stat-card" style={{ '--stat-accent': 'var(--c-materials)' }}>
            <div className="stat-label">Vendor</div>
            <div className="stat-value" style={{ fontSize: 15 }}>{vendorName}</div>
          </div>
        </div>

        <div className="section-label">Production checklist</div>
        <div className="card">
          {checkpoints.length === 0 ? (
            <div style={{ padding: 20, color: 'var(--ink-3)', fontSize: 13.5, fontStyle: 'italic' }}>
              No checkpoints configured for this order.
            </div>
          ) : (
            checkpoints.map((item, i) => (
              <div 
                className="list-row" 
                key={i} 
                style={{ cursor: updating ? 'wait' : 'pointer' }}
                onClick={() => toggleCheckpoint(i)}
              >
                <span style={{ fontSize: 13.5, color: item.status === 'done' ? 'var(--ink-3)' : 'var(--ink)', textDecoration: item.status === 'done' ? 'line-through' : 'none' }}>
                  {item.label}
                </span>
                {item.status === 'done'
                  ? <span className="tag tag-green"><i className="ph ph-check" style={{ marginRight: 4 }} />Done</span>
                  : <span className="tag tag-neutral">Pending</span>}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}