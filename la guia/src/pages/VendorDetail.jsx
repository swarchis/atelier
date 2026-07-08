import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { vendors, quotes, techPacks, TRUST_LABELS } from '../data/mockData.js';
import { trustTagClass } from '../lib/format.js';
import { useProducts } from '../context/ProductsContext.jsx';
import EmptyState from '../components/EmptyState.jsx';

export default function VendorDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { products } = useProducts();
  const [showRequest, setShowRequest] = useState(false);
  const vendor = vendors.find(v => String(v.id) === id);
  const vendorQuotes = quotes.filter(q => q.vendorName === vendor?.name);
  const techPackProducts = products.filter(p => techPacks[p.id]);

  if (!vendor) {
    return <div className="content"><EmptyState icon="ph-magnifying-glass" title="Vendor not found" sub="This vendor profile doesn't exist yet." /></div>;
  }

  return (
    <>
      <div className="topbar">
        <div className="topbar-left">
          <div>
            <div className="page-eyebrow" style={{ color: 'var(--c-vendors)' }}>Vendor</div>
            <h1 className="page-title">{vendor.name}</h1>
          </div>
          <div className="page-sub">{vendor.category} · {vendor.location}</div>
        </div>
        <div className="topbar-right">
          <span className={trustTagClass(TRUST_LABELS.find(t => t.label === vendor.label)?.tone)}>{vendor.label}</span>
          <button className="btn btn-primary" onClick={() => setShowRequest(s => !s)}><i className="ph ph-file-text" /> Request a quote</button>
        </div>
      </div>

      <div className="content">
        <div className="stats-row">
          <div className="stat-card" style={{ '--stat-accent': 'var(--c-vendors)' }}>
            <div className="stat-label">Rating</div>
            <div className="stat-value">{vendor.rating ? `${vendor.rating}★` : '—'}</div>
          </div>
          <div className="stat-card" style={{ '--stat-accent': 'var(--c-vendors)' }}>
            <div className="stat-label">MOQ</div>
            <div className="stat-value">{vendor.moq ?? '—'}</div>
          </div>
          <div className="stat-card" style={{ '--stat-accent': 'var(--c-vendors)' }}>
            <div className="stat-label">Lead time</div>
            <div className="stat-value" style={{ fontSize: 20 }}>{vendor.leadTime}</div>
          </div>
          <div className="stat-card" style={{ '--stat-accent': 'var(--c-vendors)' }}>
            <div className="stat-label">Quotes exchanged</div>
            <div className="stat-value">{vendor.quoteHistory}</div>
          </div>
        </div>

        {showRequest && (
          <div className="card-raised enter" style={{ marginBottom: 24 }}>
            <div className="corner-fold" style={{ '--fold-color': 'var(--c-vendors)' }} />
            <div className="card-header"><span className="card-title">Quote request</span></div>
            <div className="card-body">
              <div className="form-group">
                <label className="form-label">Tech pack</label>
                <select className="form-select" defaultValue="">
                  <option value="" disabled>Choose a tech pack</option>
                  {techPackProducts.map(p => <option key={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">Message</label>
                <textarea className="form-textarea" placeholder="Target quantity, deadline, anything the vendor should know up front" />
              </div>
              <button className="btn btn-primary" disabled style={{ opacity: 0.6 }}><i className="ph ph-paper-plane-tilt" /> Send request</button>
            </div>
          </div>
        )}

        <div className="section-label">Specialties</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 28 }}>
          {vendor.specialties.map(s => <span key={s} className="tag tag-neutral">{s}</span>)}
        </div>

        <div className="section-label">Quote history</div>
        {vendorQuotes.length ? (
          <div className="card">
            {vendorQuotes.map(q => (
              <div className="list-row" key={q.id}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{q.productName}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>Requested {q.requestedAt}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  {q.amount && <span style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>${q.amount.toFixed(2)}/unit</span>}
                  <span className={q.status === 'Accepted' ? 'tag tag-green' : q.status === 'Declined' ? 'tag tag-red' : q.status === 'Received' ? 'tag tag-blue' : 'tag tag-neutral'}>{q.status}</span>
                </div>
              </div>
            ))}
          </div>
        ) : <EmptyState icon="ph-file-text" color="var(--c-vendors)" title="No quotes yet" sub="Requested and received quotes with this vendor will show up here." />}
      </div>
    </>
  );
}
