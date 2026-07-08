import React, { useState } from 'react';
import { quotes } from '../data/mockData.js';

const STATUSES = ['All', 'Requested', 'Received', 'Accepted', 'Declined'];

export default function QuoteTracker() {
  const [filter, setFilter] = useState('All');
  const filtered = filter === 'All' ? quotes : quotes.filter(q => q.status === filter);

  return (
    <>
      <div className="topbar">
        <div className="topbar-left">
          <div>
            <div className="page-eyebrow" style={{ color: 'var(--c-vendors)' }}>Vendors</div>
            <h1 className="page-title">Quote Tracker</h1>
          </div>
          <div className="page-sub">Status of every outstanding and received quote, across vendors</div>
        </div>
      </div>

      <div className="content">
        <div className="pill-group" style={{ marginBottom: 22 }}>
          {STATUSES.map(s => (
            <button key={s} className={`pill ${filter === s ? 'active' : ''}`} onClick={() => setFilter(s)}>{s}</button>
          ))}
        </div>

        <div className="card">
          {filtered.map(q => (
            <div className="list-row" key={q.id}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{q.productName}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{q.vendorName} · requested {q.requestedAt}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                {q.amount && <span style={{ fontFamily: 'var(--mono)', fontSize: 13.5 }}>${q.amount.toFixed(2)}/unit</span>}
                <span className={q.status === 'Accepted' ? 'tag tag-green' : q.status === 'Declined' ? 'tag tag-red' : q.status === 'Received' ? 'tag tag-blue' : 'tag tag-neutral'}>{q.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
